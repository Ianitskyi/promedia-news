import { markdownToHtml, markdownToPlainText } from "./markdown.js";

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

const LANGS = ["uk", "en", "crh"];
const LANG_BUTTON = { uk: "UA", en: "EN", crh: "QT" };

function langPrefix(lang) {
  return lang === "uk" ? "" : "/" + lang;
}

function field(project, name, lang) {
  if (lang === "en") return project[name + "_en"] || project[name] || "";
  if (lang === "crh") return project[name + "_crh"] || project[name] || "";
  return project[name] || "";
}

function localizedUrls(canonical) {
  const u = new URL(canonical);
  const path = u.pathname.replace(/^\/(en|crh)(?=\/|$)/, "") || "/";
  return {
    uk: u.origin + path,
    en: u.origin + "/en" + path,
    crh: u.origin + "/crh" + path
  };
}

function fmtDate(value, lang) {
  if (!value) return "";
  const d = new Date(value + (value.length === 10 ? "T00:00:00Z" : ""));
  if (Number.isNaN(d.getTime())) return value;
  if (lang === "crh") {
    const months = ["yanvar","fevral","mart","aprel","mayıs","iyün","iyül","avgust","sentâbr","oktâbr","noyabr","dekabr"];
    return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
  return d.toLocaleDateString(lang === "en" ? "en-GB" : "uk-UA", { year: "numeric", month: "long", day: "numeric" });
}

const LABELS = {
  uk: {
    eyebrow: "Проєкти ПроМедіа", title: "Проєкти ProMedia", active: "Триває", completed: "Завершено",
    upcoming: "Заплановано", partner: "Партнер", donor: "Донор", dates: "Період",
    more: "Докладніше", back: "← Усі проєкти", empty: "Проєктів поки немає.",
    details: "Дані про організацію", officialName: "Офіційна назва", officialNameValue: "ГО «ПроМедіа»",
    registration: "Реєстраційний номер", address: "Юридична адреса", addressValue: "вул. Володимира Самійленка, 19/44, Київ, Україна, 03118",
    chair: "Голова правління", chairValue: "Андрій Яніцький", phone: "Телефон", email: "Електронна пошта",
    social: "Соціальні мережі", project: "Проєкт ПроМедіа", correction: "Побачили помилку?"
  },
  en: {
    eyebrow: "ProMedia projects", title: "ProMedia Projects", active: "Active", completed: "Completed",
    upcoming: "Upcoming", partner: "Partner", donor: "Donor", dates: "Period",
    more: "Learn more", back: "← All projects", empty: "No projects yet.",
    details: "Organization details", officialName: "Official name", officialNameValue: "ProMedia NGO",
    registration: "Registration number", address: "Registered address", addressValue: "19/44 Volodymyra Samiilenka St., Kyiv, Ukraine, 03118",
    chair: "Chair of the Board", chairValue: "Andrii Ianitskyi", phone: "Phone", email: "Email",
    social: "Social media", project: "A ProMedia project", correction: "Found an error?"
  },
  crh: {
    eyebrow: "ProMedia loyihaları", title: "ProMedia loyihaları", active: "Devam ete", completed: "Tamamlandı",
    upcoming: "Planlaştırılğan", partner: "Ortaq", donor: "Donor", dates: "Devir",
    more: "Daa tafsilâtlı", back: "← Episi loyihalar", empty: "Şimdilik loyiha yoq.",
    details: "Teşkilât aqqında malümat", officialName: "Resmiy adı", officialNameValue: "«ProMedia» İCT",
    registration: "Qayd nomeri", address: "Yuridik adres", addressValue: "Volodymyr Samiylenko soqağı, 19/44, Kiev, Ukraina, 03118",
    chair: "İdare Keñeşi Reisi", chairValue: "Andrii Ianitskyi", phone: "Telefon", email: "Elektron poçta",
    social: "İçtimaiy şebekeler", project: "ProMedia loyihası", correction: "Hata taptıñızmı?"
  }
};

const NAV = {
  uk: { projects: "Проєкти", news: "Новини", communities: "Карта спільнот", ratings: "Рейтинг журфаків", research: "Дослідження", atlas: "Атлас Медіа" },
  en: { projects: "Projects", news: "News", communities: "Media communities", ratings: "Journalism schools", research: "Research", atlas: "Media Atlas" },
  crh: { projects: "Loyihalar", news: "Haberler", communities: "Cemaatlar haritası", ratings: "Jurnalistika fakülteleri reytingi", research: "Tedqiqatlar", atlas: "Mediya Atlası" }
};

const URLS = {
  news: { uk: "https://news.promedia.report/", en: "https://news.promedia.report/en/", crh: "https://news.promedia.report/crh/" },
  communities: { uk: "https://communities.promedia.report/", en: "https://communities.promedia.report/en/", crh: "https://communities.promedia.report/crh/" },
  ratings: { uk: "https://ratings.promedia.report/", en: "https://ratings.promedia.report/en/", crh: "https://ratings.promedia.report/crh/" },
  research: { uk: "https://research.promedia.report/", en: "https://research.promedia.report/en/", crh: "https://research.promedia.report/crh/" },
  atlas: { uk: "https://atlas.promedia.report/", en: "https://atlas.promedia.report/en/", crh: "https://atlas.promedia.report/crh/" }
};

function header() {
  return `<promedia-global-header></promedia-global-header>`;
}

function footer() {
  return `<promedia-global-footer></promedia-global-footer>`;
}

function shell({ lang, title, description, canonical, body, ogImage }) {
  const urls = localizedUrls(canonical);
  const locale = lang === "en" ? "en_US" : (lang === "crh" ? "crh_UA" : "uk_UA");
  const alternateLocales = ["uk_UA", "en_US", "crh_UA"].filter((item) => item !== locale);
  const defaultOg = lang === "uk" ? "/img/og-share.png" : `/img/og-share-${lang}.png`;
  const socialImage = new URL(ogImage || defaultOg, canonical).toString();
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${esc(canonical)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="ProMedia" />
<meta property="og:url" content="${esc(canonical)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:image" content="${esc(socialImage)}" />
<meta property="og:image:secure_url" content="${esc(socialImage)}" />
<meta property="og:locale" content="${locale}" />
${alternateLocales.map((item) => `<meta property="og:locale:alternate" content="${item}" />`).join("\n")}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(socialImage)}" />
<link rel="alternate" hreflang="uk" href="${esc(urls.uk)}" />
<link rel="alternate" hreflang="en" href="${esc(urls.en)}" />
<link rel="alternate" hreflang="crh" href="${esc(urls.crh)}" />
<link rel="alternate" hreflang="x-default" href="${esc(urls.uk)}" />
<link rel="icon" href="/favicon.png" type="image/png" />
<link rel="stylesheet" href="/css/style.css" />
<script async src="https://www.googletagmanager.com/gtag/js?id=G-D8TM22QR9R"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-D8TM22QR9R');
</script>
</head>
<body>
${header(lang, canonical)}
${body}
${footer(lang)}
<script defer src="/js/promedia-language-suggest.js"></script>
<script defer src="/js/promedia-memorial-popup.js"></script>
<script defer src="/js/promedia-push-bell.js"></script>
<script defer src="/js/promedia-global-shell.js"></script>
</body>
</html>`;
}

function statusLabel(project, lang) {
  const l = LABELS[lang] || LABELS.uk;
  return l[project.project_status] || project.project_status || "";
}

function projectTags(project) {
  if (Array.isArray(project.tags)) return project.tags;
  try { return JSON.parse(project.tags || "[]"); } catch { return []; }
}

function tagLabel(tag, lang) {
  const map = {
    "навчання": { en: "training", crh: "talim" },
    "спільнота": { en: "community", crh: "cemaat" },
    "спільноти": { en: "communities", crh: "cemaatlar" },
    "дослідження": { en: "research", crh: "tedqiqat" },
    "консалтинг": { en: "consulting", crh: "mesleat" },
    "медіа": { en: "media", crh: "mediya" },
    "штучний інтелект": { en: "artificial intelligence", crh: "suniy zekâ" },
    "автоматизація": { en: "automation", crh: "avtomatlaştırma" },
    "фактчекінг": { en: "fact-checking", crh: "faktçeking" },
    "відео": { en: "video", crh: "video" },
    "модерація": { en: "moderation", crh: "moderatsiya" },
    "інструмент": { en: "tool", crh: "alet" },
    "інструменти": { en: "tools", crh: "aletler" },
    "журналістика": { en: "journalism", crh: "jurnalistika" },
    "медіаграмотність": { en: "media literacy", crh: "mediya savatlılığı" }
  };
  const value = String(tag || "").trim();
  if (lang === "uk") return value;
  const key = value.toLocaleLowerCase("uk-UA");
  return (map[key] && map[key][lang]) || value;
}

function tagUrl(baseUrl, lang, tag) {
  return `${baseUrl}${langPrefix(lang)}/?tag=${encodeURIComponent(tag)}`;
}

function projectImageUrl(project, baseUrl) {
  const raw = String(project.cover_image_url || "").trim();
  if (!raw) return "";

  const projectMarker = "/storage/app/media/projects/";
  const mediaMarker = "/storage/app/media/";
  const lower = raw.toLowerCase();

  let markerIndex = lower.indexOf(projectMarker);
  if (markerIndex >= 0) {
    const file = decodeURIComponent(raw.slice(markerIndex + projectMarker.length));
    return `${baseUrl}/img/projects/${file.split("/").map(encodeURIComponent).join("/")}`;
  }

  markerIndex = lower.indexOf(mediaMarker);
  if (markerIndex >= 0) {
    const file = decodeURIComponent(raw.slice(markerIndex + mediaMarker.length));
    return `${baseUrl}/img/projects/${file.split("/").map(encodeURIComponent).join("/")}`;
  }

  if (raw.startsWith("projects/")) {
    const file = decodeURIComponent(raw.slice("projects/".length));
    return `${baseUrl}/img/projects/${file.split("/").map(encodeURIComponent).join("/")}`;
  }

  if (raw.startsWith("/img/projects/")) return baseUrl + raw;

  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return "";
  }
}

function projectCard(project, lang, baseUrl) {
  const title = field(project, "title", lang);
  const excerpt = field(project, "excerpt", lang) || markdownToPlainText(field(project, "body_md", lang), 220);
  const href = `${baseUrl}${langPrefix(lang)}/project/${esc(project.slug)}`;
  const statusClass = project.project_status === "active" ? " project-status-active" : (project.project_status === "completed" ? " project-status-completed" : "");
  const tags = projectTags(project);
  const imageUrl = projectImageUrl(project, baseUrl);
  return `<article class="article-card article-card--visual">
    ${imageUrl ? `<a class="article-card-media" href="${href}"><img class="article-card-img" src="${esc(imageUrl)}" alt="${esc(title)}" loading="lazy" /></a>` : ""}
    <div class="article-card-body">
      <div class="article-tags">
        <span class="article-tag project-status${statusClass}">${esc(statusLabel(project, lang))}</span>
        ${tags.map((tag) => `<a class="article-tag project-tag" href="${esc(tagUrl(baseUrl, lang, tag))}">${esc(tagLabel(tag, lang))}</a>`).join("")}
      </div>
      <h3><a href="${href}">${esc(title)}</a></h3>
      <p class="article-excerpt">${esc(excerpt)}</p>
      <p><a href="${href}">${LABELS[lang].more} →</a></p>
    </div>
  </article>`;
}

export function renderProjectsHomepage({ projects, lang, baseUrl, allTags = [], selectedTag = "" }) {
  const l = LABELS[lang] || LABELS.uk;
  const filterTitle = lang === "en" ? "Filter by tag" : (lang === "crh" ? "Etiket boyunca süz" : "Фільтр за тегом");
  const allLabel = lang === "en" ? "All" : (lang === "crh" ? "Episi" : "Усі");
  const filters = allTags.length ? `<div class="project-filters" aria-label="${esc(filterTitle)}">
    <span class="project-filters-label">${esc(filterTitle)}:</span>
    <a class="article-tag project-filter${!selectedTag ? " active" : ""}" href="${baseUrl}${langPrefix(lang)}/">${esc(allLabel)}</a>
    ${allTags.map((tag) => `<a class="article-tag project-filter${selectedTag === tag ? " active" : ""}" href="${esc(tagUrl(baseUrl, lang, tag))}">${esc(tagLabel(tag, lang))}</a>`).join("")}
  </div>` : "";
  const body = `<section class="hero"><h1>${l.title}</h1></section>
<main class="wrap">
  ${filters}
  ${projects.length ? `<div class="article-grid">${projects.map((p) => projectCard(p, lang, baseUrl)).join("")}</div>` : `<p class="empty-state">${l.empty}</p>`}
</main>`;
  return shell({ lang, title: `${l.title} — ProMedia`, description: l.eyebrow, canonical: `${baseUrl}${langPrefix(lang)}/`, body });
}

export function renderProjectPage({ project, lang, baseUrl }) {
  const l = LABELS[lang] || LABELS.uk;
  const title = field(project, "title", lang);
  const excerpt = field(project, "excerpt", lang) || markdownToPlainText(field(project, "body_md", lang), 220);
  const meta = [];
  if (project.partner || project.partner_en || project.partner_crh) meta.push(`<div><strong>${l.partner}:</strong> ${esc(field(project, "partner", lang))}</div>`);
  if (project.donor || project.donor_en || project.donor_crh) meta.push(`<div><strong>${l.donor}:</strong> ${esc(field(project, "donor", lang))}</div>`);
  if (project.start_date || project.end_date) meta.push(`<div><strong>${l.dates}:</strong> ${esc(fmtDate(project.start_date, lang))}${project.end_date ? " — " + esc(fmtDate(project.end_date, lang)) : ""}</div>`);
  const canonical = `${baseUrl}${langPrefix(lang)}/project/${project.slug}`;
  const statusClass = project.project_status === "active" ? " project-status-active" : (project.project_status === "completed" ? " project-status-completed" : "");
  const imageUrl = projectImageUrl(project, baseUrl);
  const body = `<main class="wrap article-page">
    <p class="article-back"><a href="${langPrefix(lang)}/">${l.back}</a></p>
    <div class="article-tags">
      <span class="article-tag project-status${statusClass}">${esc(statusLabel(project, lang))}</span>
      ${projectTags(project).map((tag) => `<a class="article-tag project-tag" href="${esc(tagUrl(baseUrl, lang, tag))}">${esc(tagLabel(tag, lang))}</a>`).join("")}
    </div>
    <h1>${esc(title)}</h1>
    <p class="article-excerpt">${esc(excerpt)}</p>
    ${imageUrl ? `<img class="article-cover" src="${esc(imageUrl)}" alt="${esc(title)}" />` : ""}
    ${meta.length ? `<div class="admin-card" style="margin:24px 0">${meta.join("")}</div>` : ""}
    <div class="article-body">${markdownToHtml(field(project, "body_md", lang))}</div>
    ${project.website_url ? `<p><a class="admin-btn" href="${esc(project.website_url)}" target="_blank" rel="noopener">${l.more}</a></p>` : ""}
  </main>`;
  return shell({ lang, title: `${title} — ProMedia`, description: excerpt, canonical, body, ogImage: imageUrl || undefined });
}
