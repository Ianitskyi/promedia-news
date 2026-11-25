#!/usr/bin/env node
// Будує сайт «Люди ПроМедіа» (people.promedia.report) з досьє у people/data/*.json.
//
//   node people-site/build.mjs              — повна збірка в people-site/dist (з пошуком фото у Вікіпедії/Вікісховищі)
//   node people-site/build.mjs --offline    — без мережі: фото лише з матеріалів ПроМедіа
//   node people-site/build.mjs --index-only — лише оновити src/data/people-index.js для новинного сайту
//
// Фото беремо тільки з вільними ліцензіями (CC BY, CC BY-SA, CC0, суспільне надбання).
// Ліцензії NC/ND і «добросовісне використання» відкидаємо.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync, cpSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "people", "data");
const DIST = join(ROOT, "people-site", "dist");
const SITE = "https://people.promedia.report";
const NEWS = "https://news.promedia.report";
// Поки субдомен people.promedia.report не прив'язано, мовні посилання відносні — так перемикач мов
// у шапці працює і на тимчасовій адресі workers.dev. Після прив'язки можна поставити SITE.
const ALT_ORIGIN = SITE;
const CONTACTS = "https://promedia.report/#contacts";
const args = new Set(process.argv.slice(2));
const OFFLINE = args.has("--offline");
const INDEX_ONLY = args.has("--index-only");

const UK_ALPHABET = "АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЮЯ".split("");
const LAT_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
// Кримськотатарська латинська абетка.
const CRH_ALPHABET = ["A", "B", "C", "Ç", "D", "E", "F", "G", "Ğ", "H", "I", "İ", "J", "K", "L", "M", "N", "Ñ", "O", "Ö", "P", "Q", "R", "S", "Ş", "T", "U", "Ü", "V", "Y", "Z"];
const MONTHS_CRH = ["yanvar", "fevral", "mart", "aprel", "mayıs", "iyun", "iyul", "avgust", "sentâbr", "oktâbr", "noyabr", "dekabr"];
const LANGS = ["uk", "en", "crh"];
const MONTHS = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const ukCollator = new Intl.Collator("uk");
const enCollator = new Intl.Collator("en");
const crhCollator = new Intl.Collator("tr");

// ---------- data ----------

function loadPeople() {
  const people = readdirSync(DATA).filter(f => f.endsWith(".json")).sort()
    .map(f => JSON.parse(readFileSync(join(DATA, f), "utf8")));
  const slugs = new Set();
  for (const p of people) {
    for (const key of ["slug", "name", "sort", "role", "summary", "bio", "sources", "updated"]) {
      if (!p[key]) throw new Error(`${p.slug || "?"}: відсутнє поле ${key}`);
    }
    if (slugs.has(p.slug)) throw new Error(`Дубль slug: ${p.slug}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.updated)) throw new Error(`${p.slug}: дата оновлення має бути YYYY-MM-DD`);
    slugs.add(p.slug);
  }
  return people;
}

function loadArticles() {
  const map = new Map();
  const archive = JSON.parse(readFileSync(join(ROOT, "archive", "published-news.json"), "utf8"));
  for (const a of archive.items || []) {
    map.set(a.slug, { slug: a.slug, title: a.title, titleEn: a.titleEn, titleCrh: a.titleCrh, date: (a.publishedAt || "").slice(0, 10), cover: a.coverImageUrl || "" });
  }
  const dir = join(ROOT, "content", "articles");
  for (const f of readdirSync(dir).filter(f => f.endsWith(".json")).sort()) {
    const a = JSON.parse(readFileSync(join(dir, f), "utf8"));
    const prev = map.get(a.slug) || {};
    const cover = a.cover?.url || prev.cover || "";
    map.set(a.slug, { slug: a.slug, title: a.title || prev.title, titleEn: a.titleEn || prev.titleEn, titleCrh: a.titleCrh || prev.titleCrh, date: prev.date || f.slice(0, 10), cover });
  }
  return map;
}

function articlesByPerson(articles) {
  const mapping = JSON.parse(readFileSync(join(ROOT, "people", "article-people.json"), "utf8"));
  const out = new Map();
  for (const [slug, people] of Object.entries(mapping)) {
    const a = articles.get(slug);
    if (!a) throw new Error(`article-people.json: невідома новина ${slug}`);
    for (const p of people) {
      if (!out.has(p)) out.set(p, []);
      out.get(p).push(a);
    }
  }
  for (const list of out.values()) list.sort((x, y) => (y.date || "").localeCompare(x.date || ""));
  return { mapping, byPerson: out };
}

// ---------- photos ----------

const BAD_LICENSE = /(\bnc\b|-nc|\bnd\b|-nd|non-?commercial|no ?deriv|fair use|non-free)/i;
const FREE_LICENSE = /(cc[ -]?by|cc0|public domain|\bpd\b|attribution|gfdl|free art)/i;

function stripHtml(s) {
  return String(s || "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}

async function api(lang, params) {
  const host = lang.includes(".") ? lang : `${lang}.wikipedia.org`;
  const url = `https://${host}/w/api.php?` + new URLSearchParams({ format: "json", formatversion: "2", origin: "*", ...params });
  const res = await fetch(url, { headers: { "user-agent": "ProMediaPeopleBuilder/1.0 (+https://people.promedia.report)" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fileInfo(host, file) {
  const info = await api(host, { action: "query", prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "600", titles: "File:" + file });
  const ii = info.query?.pages?.[0]?.imageinfo?.[0];
  if (!ii) return null;
  const meta = ii.extmetadata || {};
  const license = stripHtml(meta.LicenseShortName?.value);
  if (!license || BAD_LICENSE.test(license) || !FREE_LICENSE.test(license)) return { rejected: license || "?" };
  return {
    src: ii.thumburl || ii.url,
    author: stripHtml(meta.Artist?.value) || "автор невідомий",
    license,
    licenseUrl: meta.LicenseUrl?.value || "",
    sourceUrl: ii.descriptionurl,
    sourceName: "Вікісховище"
  };
}

// Wikidata P18 («зображення») — часто є навіть тоді, коли в статті Вікіпедії немає головного фото.
async function wikidataImage(qid) {
  const c = await api("www.wikidata.org", { action: "wbgetclaims", entity: qid, property: "P18" });
  const files = (c.claims?.P18 || []).map(x => x.mainsnak?.datavalue?.value).filter(Boolean);
  for (const f of files) {
    const r = await fileInfo("commons.wikimedia.org", f);
    if (r && !r.rejected) return r;
  }
  return null;
}

async function wikiPhoto(p) {
  for (const candidate of p.photo?.wiki || []) {
    const [lang, ...rest] = candidate.split(":");
    const title = rest.join(":");
    try {
      const q = await api(lang, { action: "query", redirects: "1", prop: "pageimages|extracts|pageprops", ppprop: "wikibase_item", piprop: "name", pilicense: "free", exintro: "1", explaintext: "1", exchars: "1200", titles: title });
      const page = q.query?.pages?.[0];
      if (!page || page.missing) continue;
      const extract = (page.extract || "").toLowerCase();
      const checks = p.photo.check || [];
      if (checks.length && !checks.some(k => extract.includes(k.toLowerCase()))) {
        console.warn(`  ${p.slug}: ${candidate} — сторінка не схожа на цю людину, пропускаю`);
        continue;
      }
      const wikiPage = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`;
      if (page.pageimage) {
        const r = await fileInfo(lang, page.pageimage);
        if (r && !r.rejected) return { ...r, wikiPage };
        if (r?.rejected) console.warn(`  ${p.slug}: ліцензія «${r.rejected}» не підходить`);
      }
      const qid = page.pageprops?.wikibase_item;
      if (qid) {
        const r = await wikidataImage(qid);
        if (r) return { ...r, wikiPage };
      }
    } catch (err) {
      console.warn(`  ${p.slug}: ${candidate} — ${err.message}`);
    }
  }
  return null;
}

function articlePhoto(p, articles) {
  const slug = p.photo?.article;
  if (!slug || p.photo.articleIsPortrait === false) return null;
  const a = articles.get(slug);
  if (!a?.cover) return null;
  const src = a.cover.startsWith("http") ? a.cover : NEWS + a.cover;
  return { src, author: "ГО «ПроМедіа»", license: "", licenseUrl: "", sourceUrl: `${NEWS}/article/${slug}`, sourceName: `матеріал «${a.title}»`, fromArticle: true };
}

async function resolvePhotos(people, articles) {
  const out = {};
  for (const p of people) {
    let photo = null;
    if (p.photo?.url) photo = { src: p.photo.url, author: p.photo.author || "", license: p.photo.license || "", licenseUrl: p.photo.licenseUrl || "", sourceUrl: p.photo.sourceUrl || "", sourceName: p.photo.sourceName || "" };
    if (!photo && !OFFLINE) photo = await wikiPhoto(p);
    if (!photo) photo = articlePhoto(p, articles);
    out[p.slug] = photo;
    console.log(`${p.slug}: ${photo ? (photo.fromArticle ? "фото з матеріалу ПроМедіа" : `фото ${photo.license}`) : "без фото"}`);
  }
  return out;
}

// ---------- html helpers ----------

const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmtDate = (iso, lang) => {
  const [y, m, d] = iso.split("-").map(Number);
  if (lang === "en") return `${MONTHS_EN[m - 1]} ${d}, ${y}`;
  if (lang === "crh") return `${d} ${MONTHS_CRH[m - 1]} ${y}`;
  return `${d} ${MONTHS[m - 1]} ${y} року`;
};
const paragraphs = text => String(text || "").split(/\n{2,}/).map(t => `<p>${esc(t.trim())}</p>`).join("\n");
const initials = name => name.split(/\s+/).map(w => w[0]).slice(0, 2).join("");
function firstLetter(s, alphabet) {
  const ch = s.trim()[0]?.toLocaleUpperCase(alphabet === CRH_ALPHABET ? "tr" : "uk") || "";
  const plain = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return alphabet.includes(ch) ? ch : alphabet.includes(plain) ? plain : "#";
}
function plural(n, forms) { return forms[(n % 10 === 1 && n % 100 !== 11) ? 0 : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? 1 : 2]; }

const T = {
  uk: {
    title: "Люди", siteTitle: "Люди — ПроМедіа", lead: "Досьє на журналісток, журналістів та інших людей, про яких пише ПроМедіа. Інформацію зібрано з відкритих джерел; біля кожного досьє — дата оновлення.",
    search: "Пошук за ім'ям, редакцією чи роллю", cyr: "Кирилиця", lat: "Латиниця", all: "Усі", ua: "Українські", intl: "Міжнародні",
    updated: "Оновлено", mentions: "Згадки в новинах ПроМедіа", sources: "Джерела", facts: "Коротко", back: "← Усі люди",
    empty: "Нікого не знайдено.", count: n => `${n} ${plural(n, ["досьє", "досьє", "досьє"])}`,
    note: "Досьє компілятивне: його складено з відкритих джерел, перелічених вище, і з матеріалів ПроМедіа. Ми не публікуємо приватних даних.",
    fix: "Помітили неточність або хочете доповнити? Напишіть нам", photo: "Фото", license: "ліцензія", noPhoto: "Фото ще шукаємо",
    official: "Посадова особа", memorial: "Пам'ять", memorialLead: "Журналістки й журналісти, яких ми втратили. Пам'ятні картки складено за даними ІМІ, НСЖУ, Премії імені Георгія Ґонґадзе та інших відкритих джерел.", memorialOpen: "Відкрити розділ «Пам'ять» →", memorialChip: "Пам'ять: журналісти, яких ми втратили", intlLabel: "Міжнародні", country: "Країна", bioLang: "", news: "Новини"
  },
  en: {
    title: "People", siteTitle: "People — ProMedia", lead: "Profiles of journalists and other people ProMedia writes about, compiled from open sources. Each profile shows when it was last updated.",
    search: "Search by name, outlet or role", cyr: "Cyrillic", lat: "Latin", all: "All", ua: "Ukrainian", intl: "International",
    updated: "Updated", mentions: "Mentioned in ProMedia News", sources: "Sources", facts: "At a glance", back: "← All people",
    empty: "No one found.", count: n => `${n} ${n === 1 ? "profile" : "profiles"}`,
    note: "This profile is compiled from the open sources listed above and from ProMedia materials. We do not publish private data.",
    fix: "Spotted an error or want to add something? Contact us", photo: "Photo", license: "licence", noPhoto: "Photo coming",
    official: "Public official", memorial: "In memoriam", memorialLead: "Journalists we have lost. Memorial cards are compiled from IMI, NUJU, the Gongadze Prize and other open sources.", memorialOpen: "Open In memoriam →", memorialChip: "In memoriam: journalists we have lost", intlLabel: "International", country: "Country", bioLang: "The full profile is currently available in Ukrainian.", news: "News"
  },
  // Кримськотатарський інтерфейс: потрібна вичитка носієм мови.
  crh: {
    title: "İnsanlar", siteTitle: "İnsanlar — ProMedia", lead: "ProMedia yazğan jurnalistler ve diger insanlar aqqında dosyeler. Malümat açıq menbalardan toplandı.",
    search: "Adı, redaktsiyası ya da vazifesi boyunca qıdıruv", all: "Episi",
    updated: "Yañartıldı", mentions: "ProMedia haberlerinde", sources: "Menbalar", facts: "Qısqadan", back: "← Episi insanlar",
    empty: "Kimse tapılmadı.", count: n => `${n} dosye`,
    note: "Dosye yuqarıda kösterilgen açıq menbalardan ve ProMedia materiallarından toplandı. Şahsiy malümat derc etmeymiz.",
    fix: "Hata körseñiz ya da bir şey qoşmaq isteseñiz, bizge yazıñız", photo: "Foto", license: "litsenziya", noPhoto: "Foto şimdilik yoq",
    official: "Resmiy şahıs", memorial: "Hatıra", intlLabel: "", country: "Memleket", bioLang: "Tam dosye şimdilik ukrain tilinde.", news: "Haberler"
  }
};

const prefix = lang => lang === "uk" ? "" : "/" + lang;
const nameFor = (p, lang) => lang === "uk" ? p.name.uk : (p.name[lang] || p.name.en || p.name.uk);
const sortFor = (p, lang) => lang === "uk" ? p.sort.uk : (p.sort[lang] || p.sort.en);
const ALPHABETS = { uk: UK_ALPHABET, en: LAT_ALPHABET, crh: CRH_ALPHABET };
const COLLATORS = { uk: ukCollator, en: enCollator, crh: crhCollator };
const textFor = (field, lang) => lang === "crh" ? (field.crh || field.uk) : (field[lang] || field.uk);

function shell({ lang, title, description, path, body, image }) {
  const t = T[lang];
  const url = SITE + prefix(lang) + path;
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(url)}">
<link rel="alternate" hreflang="uk" href="${esc(ALT_ORIGIN + path)}">
<link rel="alternate" hreflang="en" href="${esc(ALT_ORIGIN + "/en" + path)}">
<link rel="alternate" hreflang="crh" href="${esc(ALT_ORIGIN + "/crh" + path)}">
<link rel="alternate" hreflang="x-default" href="${esc(ALT_ORIGIN + path)}">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="${esc(t.siteTitle)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(image || `${SITE}/og-people${lang === "uk" ? "" : "-" + lang}.png`)}">
<link rel="icon" href="${NEWS}/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/people.css">
<script async src="${NEWS}/js/promedia-analytics.js"></script>
</head>
<body>
<promedia-global-header></promedia-global-header>
${body}
<promedia-global-footer></promedia-global-footer>
<script defer src="${NEWS}/js/promedia-global-shell.js"></script>
<script defer src="${NEWS}/js/promedia-language-suggest.js"></script>
<script defer src="${NEWS}/js/promedia-memorial-popup.js"></script>
</body>
</html>
`;
}

function card(p, photo, lang) {
  const name = nameFor(p, lang);
  const other = lang === "uk" ? p.name.en : p.name.uk;
  const search = [p.name.uk, p.name.en, ...(p.aliases || []), p.role.uk, p.role.en].join(" ").toLowerCase();
  return `<a class="pp-card${p.memorial ? " pp-card--memorial" : ""}" href="${prefix(lang)}/${p.slug}/" data-group="${p.group}" data-memorial="${p.memorial ? 1 : 0}" data-letter="${firstLetter(sortFor(p, lang), ALPHABETS[lang])}" data-search="${esc(search)}">
  <span class="pp-avatar${photo ? "" : " pp-avatar--ph"}"><img src="${esc(photo ? photo.src : "/placeholder.svg")}" alt="" loading="lazy" onerror="this.src='/placeholder.svg';this.onerror=null"></span>
  <span class="pp-card-text"><strong>${esc(name)}</strong><small class="pp-alt">${esc(other)}</small>${p.memorial ? `<span class="pp-life">${esc(p.life || "")}</span>` : ""}<span class="pp-role">${esc(textFor(p.role, lang))}</span><small class="pp-date">${T[lang].updated}: ${fmtDate(p.updated, lang)}</small></span>
</a>`;
}

function indexPage(people, photos, lang) {
  const t = T[lang];
  const alphabet = ALPHABETS[lang];
  const sorted = [...people].sort((a, b) => COLLATORS[lang].compare(sortFor(a, lang), sortFor(b, lang)));
  const present = new Set(people.map(p => firstLetter(sortFor(p, lang), alphabet)));
  const letters = alphabet.map(l => `<button type="button" data-letter="${l}"${present.has(l) ? "" : " disabled"}>${l}</button>`).join("");
  const body = `<main class="pp-wrap pp-index">
  <h1 class="pp-sr">${t.title}</h1>
  <section class="pp-tools" aria-label="${esc(t.search)}">
    <div class="pp-row"><input id="pp-search" type="search" placeholder="${esc(t.search)}" autocomplete="off">
    <div class="pp-switch">
      <span class="pp-pills"><button type="button" class="is-active" data-group="all">${t.all}</button><button type="button" data-group="memorial"><span class="pp-candle" aria-hidden="true"></span>${t.memorial}</button></span>
    </div></div>
    <div class="pp-alpha"><button type="button" class="is-active" data-letter="">${t.all}</button>${letters}</div>
  </section>
  <div class="pp-meta"><p class="pp-count" id="pp-count">${t.count(people.length)}</p></div>
  <div class="pp-grid" id="pp-grid">
${sorted.map(p => card(p, photos[p.slug], lang)).join("\n")}
  </div>
  <p class="pp-empty" id="pp-empty" hidden>${t.empty}</p>
</main>
<script>window.PP_LANG=${JSON.stringify(lang)};</script>
<script src="/people.js" defer></script>`;
  return shell({ lang, title: t.siteTitle, description: t.lead, path: "/", body });
}

function photoBlock(photo, name, t) {
  if (!photo) return `<figure class="pp-photo pp-photo--empty"><img src="/placeholder.svg" alt=""><figcaption>${t.noPhoto}</figcaption></figure>`;
  const credit = photo.fromArticle
    ? `<a href="${esc(photo.sourceUrl)}">${esc(photo.sourceName)}</a>, ГО «ПроМедіа»`
    : `${photo.author ? `${esc(photo.author)} / ` : ""}${photo.sourceUrl ? `<a href="${esc(photo.sourceUrl)}">${esc(photo.sourceName)}</a>` : esc(photo.sourceName)}${photo.license ? `, ${t.license} ${photo.licenseUrl ? `<a href="${esc(photo.licenseUrl)}">${esc(photo.license)}</a>` : esc(photo.license)}` : ""}`;
  return `<figure class="pp-photo"><img src="${esc(photo.src)}" alt="${esc(name)}"><figcaption>${t.photo}: ${credit}</figcaption></figure>`;
}

function personPage(p, photo, mentions, lang) {
  const t = T[lang];
  const name = nameFor(p, lang);
  const other = lang === "uk" ? p.name.en : p.name.uk;
  const facts = (p.facts || []).length ? `<section class="pp-facts"><h2>${t.facts}</h2><dl>${p.facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}<dt>${t.country}</dt><dd>${esc(p.country)}</dd></dl></section>` : "";
  const mentionHtml = mentions.length ? `<section class="pp-mentions"><h2>${t.mentions}</h2><ul>${mentions.map(a => `<li><a href="${NEWS}${prefix(lang)}/article/${a.slug}">${esc((lang === "en" && a.titleEn) || (lang === "crh" && a.titleCrh) || a.title)}</a>${a.date ? ` <time datetime="${a.date}">${fmtDate(a.date, lang)}</time>` : ""}</li>`).join("")}</ul></section>` : "";
  const sources = `<section class="pp-sources"><h2>${t.sources}</h2><ol>${p.sources.map(s => `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.title)}</a></li>`).join("")}</ol></section>`;
  const badge = p.memorial ? `<span class="pp-badge pp-badge--memorial">${t.memorial}</span>` : p.kind === "official" ? `<span class="pp-badge">${t.official}</span>` : p.group === "intl" ? `<span class="pp-badge">${t.intlLabel}</span>` : "";
  const bio = lang !== "uk" && !(p.bio[lang]) ? `<p class="pp-note">${t.bioLang}</p><div class="pp-bio" lang="uk">${paragraphs(p.bio.uk)}</div>` : `<div class="pp-bio">${paragraphs(p.bio[lang] || p.bio.uk)}</div>`;
  const body = `<main class="pp-wrap pp-person${p.memorial ? " pp-person--memorial" : ""}">
  <p class="pp-back"><a href="${prefix(lang)}/">${t.back}</a></p>
  <article>
    <header class="pp-person-head">
      ${photoBlock(photo, name, t)}
      <div>
        ${badge}
        <h1>${esc(name)}</h1>
        <p class="pp-alt">${esc(other)}</p>
        ${p.memorial ? `<p class="pp-life-big">${esc(p.life || "")}</p>` : ""}
        <p class="pp-role">${esc(textFor(p.role, lang))}</p>
        <p class="pp-updated">${t.updated}: <time datetime="${p.updated}">${fmtDate(p.updated, lang)}</time></p>
      </div>
    </header>
    <p class="pp-summary">${esc(textFor(p.summary, lang))}</p>
    ${bio}
    ${facts}
    ${mentionHtml}
    ${sources}
    <p class="pp-note">${esc(t.note)} <a href="${CONTACTS}">${t.fix}</a>.</p>
  </article>
</main>`;
  return shell({ lang, title: `${name} — ${t.siteTitle}`, description: textFor(p.summary, lang), path: `/${p.slug}/`, body, image: photo?.src });
}

// ---------- outputs ----------

function writeNewsIndex(people) {
  const index = people.map(p => ({
    slug: p.slug, tag: p.name.uk, aliases: p.aliases || [],
    name: p.name, role: p.role, summary: p.summary
  })).sort((a, b) => ukCollator.compare(a.tag, b.tag));
  const file = join(ROOT, "src", "data", "people-index.js");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `// Згенеровано: node people-site/build.mjs --index-only. Не редагуйте вручну — правте people/data/*.json.\nexport const PEOPLE = ${JSON.stringify(index, null, 2)};\n`);
  console.log(`src/data/people-index.js: ${index.length} людей`);
}

async function main() {
  const people = loadPeople();
  writeNewsIndex(people);
  if (INDEX_ONLY) return;
  const articles = loadArticles();
  const { byPerson } = articlesByPerson(articles);
  const photos = await resolvePhotos(people, articles);

  if (existsSync(DIST)) rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });
  cpSync(join(ROOT, "people-site", "assets"), DIST, { recursive: true });

  for (const lang of LANGS) {
    const base = lang === "uk" ? DIST : join(DIST, lang);
    mkdirSync(base, { recursive: true });
    writeFileSync(join(base, "index.html"), indexPage(people, photos, lang));
    for (const p of people) {
      mkdirSync(join(base, p.slug), { recursive: true });
      writeFileSync(join(base, p.slug, "index.html"), personPage(p, photos[p.slug], byPerson.get(p.slug) || [], lang));
    }
  }

  const apiOut = {
    schemaVersion: 1,
    builtAt: new Date().toISOString(),
    people: people.map(p => ({
      slug: p.slug, url: `${SITE}/${p.slug}/`, name: p.name, sort: p.sort || null, aliases: p.aliases || [], role: p.role, summary: p.summary,
      group: p.group, memorial: Boolean(p.memorial), life: p.life || null, country: p.country, updated: p.updated, photo: photos[p.slug] || null,
      articles: (byPerson.get(p.slug) || []).map(a => a.slug), sources: p.sources
    }))
  };
  mkdirSync(join(DIST, "api"), { recursive: true });
  writeFileSync(join(DIST, "api", "people.json"), JSON.stringify(apiOut, null, 2));
  const urls = LANGS.flatMap(lang => [`${prefix(lang)}/`, ...people.map(p => `${prefix(lang)}/${p.slug}/`)]);
  writeFileSync(join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${SITE}${u}</loc></url>`).join("\n")}\n</urlset>\n`);
  writeFileSync(join(DIST, "404.html"), shell({ lang: "uk", title: "Сторінку не знайдено — Люди ПроМедіа", description: "", path: "/", body: `<main class="pp-wrap pp-person"><p class="pp-back"><a href="/">${T.uk.back}</a></p><h1>Сторінку не знайдено</h1></main>` }));
  writeFileSync(join(DIST, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
  console.log(`Готово: ${people.length} досьє → people-site/dist`);
}

main().catch(err => { console.error(err); process.exit(1); });
