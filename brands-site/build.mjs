#!/usr/bin/env node
// Будує сайт «Медіабренди ПроМедіа» (brands.promedia.report) з досьє у brands/data/*.json.
//
//   node brands-site/build.mjs              — повна збірка в brands-site/dist (з перевіркою Вікіпедії й логотипами з Вікісховища)
//   node brands-site/build.mjs --offline    — без мережі: без посилань на Вікіпедію й без логотипів
//   node brands-site/build.mjs --index-only — лише оновити src/data/brands-index.js для новинного сайту
//
// Згадки в новинах шукаються автоматично: за назвою бренду, його псевдонімами або шаблонами з поля `match`
// у тексті й заголовку кожної опублікованої новини. Нова новина з'являється в досьє з наступною збіркою.
// Логотипи беремо лише з вільними ліцензіями (CC BY, CC BY-SA, CC0, суспільне надбання), інакше — монограма.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync, cpSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "brands", "data");
const DIST = join(ROOT, "brands-site", "dist");
const SITE = "https://brands.promedia.report";
const NEWS = "https://news.promedia.report";
const PEOPLE = "https://people.promedia.report";
const CONTACTS = "https://promedia.report/#contacts";
const args = new Set(process.argv.slice(2));
const OFFLINE = args.has("--offline");
const INDEX_ONLY = args.has("--index-only");

const UK_ALPHABET = "АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЮЯ".split("");
const LAT_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const LANGS = ["uk", "en", "crh"];
const MONTHS = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_CRH = ["yanvar", "fevral", "mart", "aprel", "mayıs", "iyun", "iyul", "avgust", "sentâbr", "oktâbr", "noyabr", "dekabr"];
const KINDS = ["agency", "newspaper", "magazine", "tv", "radio", "online", "investigative", "factcheck", "trade", "group"];
// Скільки карток і згадок показувати до кнопки «Показати всі» / «Ще N згадок».
const PREVIEW = 5;
const REQUIRED = ["slug", "group", "country", "kind", "name", "sort", "type", "summary", "bio", "sources", "updated"];

// Назви країн англійською (і для кримськотатарської версії, поки немає перекладу). Нову країну додайте сюди.
const COUNTRY_EN = {
  "Україна": "Ukraine", "США": "United States", "Велика Британія": "United Kingdom", "Франція": "France", "Німеччина": "Germany",
  "Італія": "Italy", "Іспанія": "Spain", "Португалія": "Portugal", "Нідерланди": "Netherlands", "Бельгія": "Belgium", "Ірландія": "Ireland",
  "Швейцарія": "Switzerland", "Швеція": "Sweden", "Норвегія": "Norway", "Чехія": "Czech Republic", "Словаччина": "Slovakia", "Польща": "Poland",
  "Білорусь": "Belarus", "Сербія": "Serbia", "Туреччина": "Turkey", "Росія": "Russia", "Ватикан": "Vatican City", "Ізраїль": "Israel",
  "Ірак": "Iraq", "Катар": "Qatar", "ОАЕ": "United Arab Emirates", "Індія": "India", "Індонезія": "Indonesia", "Малайзія": "Malaysia",
  "Філіппіни": "Philippines", "Тайвань": "Taiwan", "Киргизстан": "Kyrgyzstan", "Австралія": "Australia", "Бразилія": "Brazil",
  "Мексика": "Mexico", "Коста-Рика": "Costa Rica", "Буркіна-Фасо": "Burkina Faso", "—": "—"
};
const FACT_KEYS_EN = {
  "Заснування": "Founded", "Власник": "Owner", "Штаб-квартира": "Headquarters", "Видавець": "Publisher", "Головна редакторка": "Editor-in-chief",
  "Головний редактор": "Editor-in-chief", "Статус": "Status", "Засновник": "Founder", "Засновники": "Founders", "Форма власності": "Ownership",
  "Мережа": "Network", "Роки виходу": "Years published", "Перший випуск": "First broadcast", "Перша трансляція": "First broadcast",
  "Мовить з": "On air since", "Прозорість фінансування (ІМІ, 2026)": "Funding transparency (IMI, 2026)"
};
const factKey = (k, lang) => lang === "uk" ? k : (FACT_KEYS_EN[k] || k);
const countryFor = (b, lang) => lang === "uk" ? b.country : (COUNTRY_EN[b.country] || b.country);

const ukCollator = new Intl.Collator("uk");
const enCollator = new Intl.Collator("en");

// ---------- data ----------

export function loadBrands(dir = DATA) {
  const brands = readdirSync(dir).filter(f => f.endsWith(".json")).sort()
    .map(f => JSON.parse(readFileSync(join(dir, f), "utf8")));
  const slugs = new Set();
  for (const b of brands) {
    for (const key of REQUIRED) if (!b[key]) throw new Error(`${b.slug || "?"}: відсутнє поле ${key}`);
    if (slugs.has(b.slug)) throw new Error(`Дубль slug: ${b.slug}`);
    if (!/^[a-z0-9-]+$/.test(b.slug)) throw new Error(`${b.slug}: slug лише з латинських літер, цифр і дефісів`);
    if (!KINDS.includes(b.kind)) throw new Error(`${b.slug}: невідомий тип ${b.kind}`);
    if (!["ua", "intl"].includes(b.group)) throw new Error(`${b.slug}: group має бути ua або intl`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.updated)) throw new Error(`${b.slug}: дата оновлення має бути YYYY-MM-DD`);
    if (!b.bio.uk) throw new Error(`${b.slug}: немає bio.uk`);
    slugs.add(b.slug);
  }
  return brands;
}

function loadArticles() {
  const map = new Map();
  const archive = JSON.parse(readFileSync(join(ROOT, "archive", "published-news.json"), "utf8"));
  for (const a of archive.items || []) {
    map.set(a.slug, { slug: a.slug, title: a.title, titleEn: a.titleEn, titleCrh: a.titleCrh, date: (a.publishedAt || "").slice(0, 10), text: `${a.title || ""}\n${a.bodyMd || ""}` });
  }
  const dir = join(ROOT, "content", "articles");
  for (const f of readdirSync(dir).filter(f => f.endsWith(".json")).sort()) {
    const a = JSON.parse(readFileSync(join(dir, f), "utf8"));
    const prev = map.get(a.slug) || {};
    const body = a.bodyMd || a.body_md || "";
    map.set(a.slug, {
      slug: a.slug, title: a.title || prev.title, titleEn: a.titleEn || prev.titleEn, titleCrh: a.titleCrh || prev.titleCrh,
      date: prev.date || f.slice(0, 10), text: body ? `${a.title || ""}\n${body}` : prev.text || ""
    });
  }
  return map;
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Шаблони пошуку згадок: поле match (рядки або "re:<регулярний вираз>"), інакше назви й псевдоніми.
// Межі слова — будь-яка не-літера й не-цифра, тож «NV» не знайдеться всередині «INVEST».
export function brandPatterns(b) {
  const list = Array.isArray(b.match) ? b.match : [b.name.uk, b.name.en, ...(b.aliases || [])];
  return [...new Set(list)].filter(Boolean).map((p) => p.startsWith("re:")
    ? new RegExp(p.slice(3), "u")
    : new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(p)}(?![\\p{L}\\p{N}])`, "u"));
}

// Посилання в markdown виду [текст](адреса) лишаємо разом з адресою: так знаходимо й згадки на кшталт [dev.ua](https://dev.ua/...).
export function mentionsByBrand(brands, articles) {
  const out = new Map(brands.map(b => [b.slug, []]));
  for (const b of brands) {
    const patterns = brandPatterns(b);
    const manual = new Set(b.articles || []);
    for (const a of articles.values()) {
      if (manual.has(a.slug) || patterns.some(re => re.test(a.text))) out.get(b.slug).push(a);
    }
    for (const slug of manual) if (!articles.has(slug)) throw new Error(`${b.slug}: невідома новина ${slug}`);
    out.get(b.slug).sort((x, y) => (y.date || "").localeCompare(x.date || ""));
  }
  return out;
}

// ---------- Вікіпедія та логотипи ----------

const BAD_LICENSE = /(\bnc\b|-nc|\bnd\b|-nd|non-?commercial|no ?deriv|fair use|non-free)/i;
const FREE_LICENSE = /(cc[ -]?by|cc0|public domain|\bpd\b|attribution|gfdl|free art)/i;
const stripHtml = s => String(s || "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();

// Вікімедіа обмежує частоту запитів (HTTP 429), тож запити йдуть не частіше ніж раз на MIN_GAP мс,
// а на 429/503 повторюємо з паузою (з урахуванням Retry-After).
const MIN_GAP = 220;
let nextSlot = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_GAP;
  if (wait) await sleep(wait);
}

async function api(host, params) {
  const h = host.includes(".") ? host : `${host}.wikipedia.org`;
  const url = `https://${h}/w/api.php?` + new URLSearchParams({ format: "json", formatversion: "2", origin: "*", ...params });
  for (let attempt = 0; ; attempt++) {
    await throttle();
    const res = await fetch(url, { headers: { "user-agent": "ProMediaBrandsBuilder/1.0 (+https://brands.promedia.report)" } });
    if ((res.status === 429 || res.status === 503) && attempt < 5) {
      const retry = Number(res.headers.get("retry-after")) || 0;
      await sleep(Math.max(retry * 1000, 1500 * 2 ** attempt));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
}

async function commonsFile(file) {
  const info = await api("commons.wikimedia.org", { action: "query", prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "400", titles: "File:" + file });
  const ii = info.query?.pages?.[0]?.imageinfo?.[0];
  if (!ii) return null;
  const meta = ii.extmetadata || {};
  const license = stripHtml(meta.LicenseShortName?.value);
  if (!license || BAD_LICENSE.test(license) || !FREE_LICENSE.test(license)) return null;
  return { src: ii.thumburl || ii.url, author: stripHtml(meta.Artist?.value) || "", license, licenseUrl: meta.LicenseUrl?.value || "", sourceUrl: ii.descriptionurl, sourceName: "Вікісховище" };
}

async function resolveWiki(b) {
  const out = { pages: [], logo: null };
  for (const candidate of b.wiki || []) {
    const [lang, ...rest] = candidate.split(":");
    const title = rest.join(":");
    try {
      const q = await api(lang, { action: "query", redirects: "1", prop: "pageprops", ppprop: "wikibase_item|disambiguation", titles: title });
      const page = q.query?.pages?.[0];
      if (!page || page.missing || page.invalid) { console.warn(`  ${b.slug}: ${candidate} — сторінки немає`); continue; }
      if (page.pageprops && "disambiguation" in page.pageprops) { console.warn(`  ${b.slug}: ${candidate} — сторінка неоднозначності`); continue; }
      const url = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`;
      out.pages.push({ title: `Вікіпедія (${lang}): ${page.title}`, url });
      const qid = page.pageprops?.wikibase_item;
      if (qid && !out.logo) {
        const c = await api("www.wikidata.org", { action: "wbgetclaims", entity: qid, property: "P154" });
        for (const f of (c.claims?.P154 || []).map(x => x.mainsnak?.datavalue?.value).filter(Boolean)) {
          const r = await commonsFile(f);
          if (r) { out.logo = r; break; }
        }
      }
    } catch (err) {
      console.warn(`  ${b.slug}: ${candidate} — ${err.message}`);
    }
  }
  return out;
}

async function resolveAllWiki(brands) {
  const result = {};
  if (OFFLINE) { for (const b of brands) result[b.slug] = { pages: [], logo: null }; return result; }
  const queue = [...brands];
  const worker = async () => {
    while (queue.length) {
      const b = queue.shift();
      result[b.slug] = await resolveWiki(b);
    }
  };
  await Promise.all(Array.from({ length: 2 }, worker));
  const withLogo = Object.values(result).filter(r => r.logo).length;
  const withWiki = Object.values(result).filter(r => r.pages.length).length;
  console.log(`Вікіпедія: ${withWiki} брендів, логотипи: ${withLogo}`);
  return result;
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
export function monogram(name) {
  const plain = String(name).replace(/\(.*?\)/g, "").trim();
  // Абревіатури (BBC, CNN, AFP, ТСН) показуємо повністю.
  if (/^[\p{Lu}\d]{2,4}$/u.test(plain)) return plain;
  const words = plain.replace(/^(The|Le|La|Les|L'|El|Il)\s+/i, "").replace(/[«»"'.:]/g, " ").split(/[\s-]+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toLocaleUpperCase("uk");
  return (words[0][0] + words[1][0]).toLocaleUpperCase("uk");
}
function firstLetter(s, alphabets) {
  const ch = String(s).trim()[0]?.toLocaleUpperCase("uk") || "";
  const plain = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
  for (const al of alphabets) if (al.includes(ch)) return ch;
  for (const al of alphabets) if (al.includes(plain)) return plain;
  return "#";
}
function plural(n, forms) { return forms[(n % 10 === 1 && n % 100 !== 11) ? 0 : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? 1 : 2]; }

const KIND_LABELS = {
  uk: { agency: "Агенції", newspaper: "Газети", magazine: "Журнали", tv: "Телебачення", radio: "Радіо", online: "Онлайн-медіа", investigative: "Розслідувальні", factcheck: "Фактчекінг", trade: "Про медіа", group: "Медіагрупи" },
  en: { agency: "Agencies", newspaper: "Newspapers", magazine: "Magazines", tv: "Television", radio: "Radio", online: "Online", investigative: "Investigative", factcheck: "Fact-checking", trade: "Media trade", group: "Media groups" },
  crh: { agency: "Ajansları", newspaper: "Gazetalar", magazine: "Mecmualar", tv: "Televidenie", radio: "Radio", online: "Onlayn mediya", investigative: "Tedqiqat", factcheck: "Faktçeking", trade: "Mediya aqqında", group: "Mediya gruppaları" }
};

const T = {
  uk: {
    title: "Медіабренди", siteTitle: "Медіабренди — ПроМедіа",
    lead: "Досьє на медіабренди з усього світу, які ПроМедіа згадувала у своїх новинах: агенції, газети, телеканали, онлайн-медіа й розслідувальні редакції. Інформацію зібрано з відкритих джерел; біля кожного досьє — дата оновлення.",
    search: "Пошук за назвою, країною чи типом", all: "Усі", ua: "Українські", intl: "Міжнародні", allKinds: "Усі типи",
    updated: "Оновлено", mentions: "Згадки в новинах ПроМедіа", sources: "Джерела", facts: "Коротко", back: "← Усі медіабренди",
    empty: "Нічого не знайдено.", count: n => `${n} ${plural(n, ["медіабренд", "медіабренди", "медіабрендів"])}`,
    mentionsCount: n => `${n} ${plural(n, ["згадка", "згадки", "згадок"])}`,
    note: "Досьє компілятивне: його складено з відкритих джерел, перелічених вище, і з матеріалів ПроМедіа.",
    fix: "Помітили неточність або хочете доповнити? Напишіть нам", logo: "Логотип", license: "ліцензія",
    country: "Країна", type: "Тип", website: "Сайт", bioLang: "", people: "Люди ПроМедіа", peopleLead: "Досьє на журналістів і медійників →",
    showAll: n => `Показати всі ${n} ${plural(n, ["медіабренд", "медіабренди", "медіабрендів"])}`, moreMentions: n => `Ще ${n} ${plural(n, ["згадка", "згадки", "згадок"])}`,
    promo: ["АТЛАС МЕДІА", "Хто стоїть за українськими медіа?", "Досліджуйте медіа та їхніх власників в одному інструменті.", "Відкрити Атлас"]
  },
  en: {
    title: "Media brands", siteTitle: "Media brands — ProMedia",
    lead: "Profiles of media brands from around the world that ProMedia has mentioned in its news: agencies, newspapers, TV channels, online outlets and investigative newsrooms, compiled from open sources.",
    search: "Search by name, country or type", all: "All", ua: "Ukrainian", intl: "International", allKinds: "All types",
    updated: "Updated", mentions: "Mentioned in ProMedia News", sources: "Sources", facts: "At a glance", back: "← All media brands",
    empty: "Nothing found.", count: n => `${n} ${n === 1 ? "media brand" : "media brands"}`,
    mentionsCount: n => `${n} ${n === 1 ? "mention" : "mentions"}`,
    note: "This profile is compiled from the open sources listed above and from ProMedia materials.",
    fix: "Spotted an error or want to add something? Contact us", logo: "Logo", license: "licence",
    country: "Country", type: "Type", website: "Website", bioLang: "The full profile is currently available in Ukrainian.", people: "ProMedia People", peopleLead: "Profiles of journalists →",
    showAll: n => `Show all ${n} media brands`, moreMentions: n => `${n} more ${n === 1 ? "mention" : "mentions"}`,
    promo: ["MEDIA ATLAS", "Who owns Ukrainian media?", "Explore media outlets and their owners in one tool.", "Explore the Atlas"]
  },
  // Кримськотатарський інтерфейс: потрібна вичитка носієм мови.
  crh: {
    title: "Mediya brendleri", siteTitle: "Mediya brendleri — ProMedia",
    lead: "ProMedia haberlerinde añılğan dünya mediya brendleri aqqında dosyeler. Malümat açıq menbalardan toplandı.",
    search: "Adı, memleketi ya da tipi boyunca qıdıruv", all: "Episi", ua: "Ukrain", intl: "Halqara", allKinds: "Episi tipler",
    updated: "Yañartıldı", mentions: "ProMedia haberlerinde", sources: "Menbalar", facts: "Qısqadan", back: "← Episi mediya brendleri",
    empty: "Hiç bir şey tapılmadı.", count: n => `${n} mediya brendi`,
    mentionsCount: n => `${n} añılma`,
    note: "Dosye yuqarıda kösterilgen açıq menbalardan ve ProMedia materiallarından toplandı.",
    fix: "Hata körseñiz ya da bir şey qoşmaq isteseñiz, bizge yazıñız", logo: "Logotip", license: "litsenziya",
    country: "Memleket", type: "Tip", website: "Sayt", bioLang: "Tam dosye şimdilik ukrain tilinde.", people: "ProMedia insanları", peopleLead: "Jurnalistler aqqında dosyeler →",
    showAll: n => `Episi ${n} mediya brendini köster`, moreMentions: n => `Daa ${n} añılma`,
    promo: ["MEDİYA ATLASI", "Ukrayina mediyasınıñ saipleri kim?", "Mediya ve olarnıñ saiplerini bir alette tedqiq etiñiz.", "Atlasnı aç"]
  }
};

const prefix = lang => lang === "uk" ? "" : "/" + lang;
const nameFor = (b, lang) => lang === "uk" ? b.name.uk : (b.name.en || b.name.uk);
const sortFor = (b, lang) => lang === "uk" ? b.sort.uk : (b.sort.en || b.sort.uk);
const textFor = (field, lang) => lang === "crh" ? (field.crh || field.en || field.uk) : (field[lang] || field.uk);
const ALPHABETS = { uk: [UK_ALPHABET, LAT_ALPHABET], en: [LAT_ALPHABET], crh: [LAT_ALPHABET] };
const COLLATORS = { uk: ukCollator, en: enCollator, crh: new Intl.Collator("tr") };
const hostOf = url => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } };

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
<link rel="alternate" hreflang="uk" href="${esc(SITE + path)}">
<link rel="alternate" hreflang="en" href="${esc(SITE + "/en" + path)}">
<link rel="alternate" hreflang="crh" href="${esc(SITE + "/crh" + path)}">
<link rel="alternate" hreflang="x-default" href="${esc(SITE + path)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(t.siteTitle)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(image || `${SITE}/og-brands${lang === "uk" ? "" : "-" + lang}.png`)}">
<link rel="icon" href="${NEWS}/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/brands.css">
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

function logoImg(b, logo, cls) {
  const mono = esc(monogram(b.name.en || b.name.uk));
  return `<span class="${cls}${logo ? "" : " bb-logo--mono"}"><span class="bb-mono" aria-hidden="true">${mono}</span>${logo ? `<img src="${esc(logo.src)}" alt="" loading="lazy" onerror="this.remove()">` : ""}</span>`;
}

function card(b, logo, count, lang) {
  const t = T[lang];
  const name = nameFor(b, lang);
  const other = lang === "uk" ? (b.name.en !== b.name.uk ? b.name.en : "") : (b.name.uk !== b.name.en ? b.name.uk : "");
  const search = [b.name.uk, b.name.en, ...(b.aliases || []), b.type.uk, b.type.en, b.country, COUNTRY_EN[b.country] || "", hostOf(b.website || "")].join(" ").toLowerCase();
  return `<a class="pp-card bb-card" href="${prefix(lang)}/${b.slug}/" data-group="${b.group}" data-kind="${b.kind}" data-letter="${firstLetter(sortFor(b, lang), ALPHABETS[lang])}" data-search="${esc(search)}">
  ${logoImg(b, logo, "bb-logo")}
  <span class="pp-card-text"><strong>${esc(name)}</strong>${other ? `<small class="pp-alt">${esc(other)}</small>` : ""}<span class="pp-role">${esc(textFor(b.type, lang))}</span><small class="bb-meta">${esc(countryFor(b, lang))} · ${t.mentionsCount(count)}</small></span>
</a>`;
}

function indexPage(brands, wiki, mentions, lang) {
  const t = T[lang];
  const sorted = [...brands].sort((a, b) => COLLATORS[lang].compare(sortFor(a, lang), sortFor(b, lang)));
  const present = new Set(brands.map(b => firstLetter(sortFor(b, lang), ALPHABETS[lang])));
  const letters = ALPHABETS[lang].map(al => al.map(l => `<button type="button" data-letter="${l}"${present.has(l) ? "" : " disabled"}>${l}</button>`).join("")).join('<span class="bb-alpha-sep" aria-hidden="true"></span>');
  const kinds = KINDS.filter(k => brands.some(b => b.kind === k));
  const body = `<main class="pp-wrap pp-index">
  <h1 class="pp-sr">${t.title}</h1>
  <p class="bb-lead">${esc(t.lead)}</p>
  <section class="pp-tools" aria-label="${esc(t.search)}">
    <div class="pp-row"><input id="pp-search" type="search" placeholder="${esc(t.search)}" autocomplete="off">
    <div class="pp-switch">
      <span class="pp-pills"><button type="button" class="is-active" data-group="all">${t.all}</button><button type="button" data-group="ua">${t.ua}</button><button type="button" data-group="intl">${t.intl}</button></span>
      <select id="bb-kind" class="bb-kind" aria-label="${esc(t.type)}"><option value="">${t.allKinds}</option>${kinds.map(k => `<option value="${k}">${KIND_LABELS[lang][k]}</option>`).join("")}</select>
    </div></div>
    <div class="pp-alpha"><button type="button" class="is-active" data-letter="">${t.all}</button>${letters}</div>
  </section>
  <div class="pp-meta"><p class="pp-count" id="pp-count">${t.count(brands.length)}</p><a class="bb-people" href="${PEOPLE}${prefix(lang)}/">${t.people}: ${t.peopleLead}</a></div>
  <div class="pp-grid" id="pp-grid" data-preview="${PREVIEW}">
${sorted.map(b => card(b, wiki[b.slug]?.logo, (mentions.get(b.slug) || []).length, lang)).join("\n")}
  </div>
  <a class="bb-promo" id="bb-promo" href="https://atlas.promedia.report${prefix(lang)}/" hidden><span class="bb-promo-kicker">${esc(t.promo[0])}</span><strong>${esc(t.promo[1])}</strong><span>${esc(t.promo[2])}</span><span class="bb-promo-cta">${esc(t.promo[3])} →</span></a>
  <p class="bb-more"><button type="button" id="bb-show-all" hidden>${esc(t.showAll(brands.length))}</button></p>
  <p class="pp-empty" id="pp-empty" hidden>${t.empty}</p>
</main>
<script>window.PP_LANG=${JSON.stringify(lang)};</script>
<script src="/brands.js" defer></script>`;
  return shell({ lang, title: t.siteTitle, description: t.lead, path: "/", body });
}

function brandPage(b, wikiInfo, mentions, lang) {
  const t = T[lang];
  const name = nameFor(b, lang);
  const other = lang === "uk" ? (b.name.en !== b.name.uk ? b.name.en : "") : (b.name.uk !== b.name.en ? b.name.uk : "");
  const logo = wikiInfo?.logo;
  const factRows = [...(b.facts || [])];
  factRows.push([t.country, countryFor(b, lang)]);
  const facts = `<section class="pp-facts"><h2>${t.facts}</h2><dl>${factRows.map(([k, v]) => `<dt>${esc(factKey(k, lang))}</dt><dd>${esc(v)}</dd>`).join("")}${b.website ? `<dt>${t.website}</dt><dd><a href="${esc(b.website)}" rel="noopener">${esc(hostOf(b.website))}</a></dd>` : ""}</dl></section>`;
  const mentionItem = a => `<li><a href="${NEWS}${prefix(lang)}/article/${a.slug}">${esc((lang === "en" && a.titleEn) || (lang === "crh" && a.titleCrh) || a.title)}</a>${a.date ? ` <time datetime="${a.date}">${fmtDate(a.date, lang)}</time>` : ""}</li>`;
  const restMentions = mentions.slice(PREVIEW);
  const mentionHtml = mentions.length ? `<section class="pp-mentions"><h2>${t.mentions}</h2><ul>${mentions.slice(0, PREVIEW).map(mentionItem).join("")}</ul>${restMentions.length ? `<details class="bb-details"><summary>${esc(t.moreMentions(restMentions.length))}</summary><ul>${restMentions.map(mentionItem).join("")}</ul></details>` : ""}</section>` : "";
  const allSources = [...b.sources, ...(wikiInfo?.pages || [])];
  const sources = `<section class="pp-sources"><h2>${t.sources}</h2><ol>${allSources.map(s => `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.title)}</a></li>`).join("")}${(allSources.length ? [] : mentions.slice(0, PREVIEW)).map(a => `<li><a href="${NEWS}/article/${a.slug}">ПроМедіа: ${esc(a.title)}</a></li>`).join("")}</ol></section>`;
  const logoCredit = logo ? `<p class="bb-credit">${t.logo}: ${logo.sourceUrl ? `<a href="${esc(logo.sourceUrl)}">${esc(logo.sourceName)}</a>` : esc(logo.sourceName)}${logo.license ? `, ${t.license} ${esc(logo.license)}` : ""}</p>` : "";
  const bio = lang !== "uk" && !b.bio[lang] ? `<p class="pp-note">${t.bioLang}</p><div class="pp-bio" lang="uk">${paragraphs(b.bio.uk)}</div>` : `<div class="pp-bio">${paragraphs(b.bio[lang] || b.bio.uk)}</div>`;
  const body = `<main class="pp-wrap pp-person bb-brand">
  <p class="pp-back"><a href="${prefix(lang)}/">${t.back}</a></p>
  <article>
    <header class="bb-head">
      ${logoImg(b, logo, "bb-logo bb-logo--big")}
      <div>
        <span class="pp-badge">${esc(KIND_LABELS[lang][b.kind])}</span>${b.group === "intl" ? ` <span class="pp-badge bb-badge-country">${esc(countryFor(b, lang))}</span>` : ""}
        <h1>${esc(name)}</h1>
        ${other ? `<p class="pp-alt">${esc(other)}</p>` : ""}
        <p class="pp-role">${esc(textFor(b.type, lang))}</p>
        <p class="pp-updated">${t.updated}: <time datetime="${b.updated}">${fmtDate(b.updated, lang)}</time>${mentions.length ? ` · ${t.mentionsCount(mentions.length)}` : ""}</p>
      </div>
    </header>
    <p class="pp-summary">${esc(textFor(b.summary, lang))}</p>
    ${bio}
    ${facts}
    ${mentionHtml}
    ${sources}
    ${logoCredit}
    <p class="pp-note">${esc(t.note)} <a href="${CONTACTS}">${t.fix}</a>.</p>
  </article>
</main>`;
  return shell({ lang, title: `${name} — ${t.siteTitle}`, description: textFor(b.summary, lang), path: `/${b.slug}/`, body });
}

// ---------- outputs ----------

function writeNewsIndex(brands) {
  const index = brands.map(b => ({
    slug: b.slug, tag: b.name.uk, aliases: b.aliases || [], group: b.group, kind: b.kind, country: b.country,
    name: b.name, type: b.type, summary: b.summary
  })).sort((a, b) => ukCollator.compare(a.tag, b.tag));
  const file = join(ROOT, "src", "data", "brands-index.js");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `// Згенеровано: node brands-site/build.mjs --index-only. Не редагуйте вручну — правте brands/data/*.json.\nexport const BRANDS = ${JSON.stringify(index, null, 2)};\n`);
  console.log(`src/data/brands-index.js: ${index.length} брендів`);
}

async function main() {
  const brands = loadBrands();
  const unknown = [...new Set(brands.map(b => b.country))].filter(c => !COUNTRY_EN[c]);
  if (unknown.length) throw new Error(`Додайте англійські назви країн у COUNTRY_EN: ${unknown.join(", ")}`);
  writeNewsIndex(brands);
  if (INDEX_ONLY) return;
  const articles = loadArticles();
  const mentions = mentionsByBrand(brands, articles);
  const silent = brands.filter(b => !mentions.get(b.slug).length).map(b => b.slug);
  if (silent.length) console.warn(`Без згадок у новинах (${silent.length}): ${silent.join(", ")}`);
  const wiki = await resolveAllWiki(brands);

  if (existsSync(DIST)) rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });
  cpSync(join(ROOT, "brands-site", "assets"), DIST, { recursive: true });

  for (const lang of LANGS) {
    const base = lang === "uk" ? DIST : join(DIST, lang);
    mkdirSync(base, { recursive: true });
    writeFileSync(join(base, "index.html"), indexPage(brands, wiki, mentions, lang));
    for (const b of brands) {
      mkdirSync(join(base, b.slug), { recursive: true });
      writeFileSync(join(base, b.slug, "index.html"), brandPage(b, wiki[b.slug], mentions.get(b.slug) || [], lang));
    }
  }

  const apiOut = {
    schemaVersion: 1,
    builtAt: new Date().toISOString(),
    brands: brands.map(b => ({
      slug: b.slug, url: `${SITE}/${b.slug}/`, name: b.name, aliases: b.aliases || [], group: b.group, kind: b.kind, country: { uk: b.country, en: COUNTRY_EN[b.country] },
      type: b.type, summary: b.summary, website: b.website || null, updated: b.updated, logo: wiki[b.slug]?.logo || null,
      articles: (mentions.get(b.slug) || []).map(a => a.slug), sources: [...b.sources, ...(wiki[b.slug]?.pages || [])]
    }))
  };
  mkdirSync(join(DIST, "api"), { recursive: true });
  writeFileSync(join(DIST, "api", "brands.json"), JSON.stringify(apiOut, null, 2));
  const urls = LANGS.flatMap(lang => [`${prefix(lang)}/`, ...brands.map(b => `${prefix(lang)}/${b.slug}/`)]);
  writeFileSync(join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${SITE}${u}</loc></url>`).join("\n")}\n</urlset>\n`);
  writeFileSync(join(DIST, "404.html"), shell({ lang: "uk", title: "Сторінку не знайдено — Медіабренди ПроМедіа", description: "", path: "/", body: `<main class="pp-wrap pp-person"><p class="pp-back"><a href="/">${T.uk.back}</a></p><h1>Сторінку не знайдено</h1></main>` }));
  writeFileSync(join(DIST, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
  const total = [...mentions.values()].reduce((n, l) => n + l.length, 0);
  console.log(`Готово: ${brands.length} досьє, ${total} згадок → brands-site/dist`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(err => { console.error(err); process.exit(1); });
}
