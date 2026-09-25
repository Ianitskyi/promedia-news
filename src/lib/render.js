import { escapeHtml, markdownToHtml, markdownToPlainText } from "./markdown.js";

const LANGS = ["uk", "en", "crh"];

function pick(dict, lang) {
  return (dict && dict[lang] != null) ? dict[lang] : dict.uk;
}

// "" for the default (uk) language, "?lang=xx" otherwise — for building a fresh query string.
function langQ(lang) {
  return lang === "uk" ? "" : `?lang=${lang}`;
}

// "" for the default (uk) language, "&lang=xx" otherwise — for appending to an existing query string.
function langAmp(lang) {
  return lang === "uk" ? "" : `&lang=${lang}`;
}

const SITE_NAME = { uk: "Новини ПроМедіа", en: "ProMedia News", crh: "ProMedia haberleri" };
const SITE_TAGLINE = {
  uk: "Заяви від ГО «ПроМедіа», а також новини зі світу медіа, громадських організацій та комунікацій.",
  en: "Public statements, press releases and important updates from ProMedia NGO, along with news about communities, education, research and people working in media, civil society and communications.",
  crh: "ProMedia İCT'niñ beyanatları hem mediya, cemiyet teşkilâtları ve kommunikatsiyalar sahasındaki muhim haberleri."
};
const SITE_EYEBROW = {
  uk: "Про журналістику та громадський активізм в Україні",
  en: "About journalism and civic activism in Ukraine",
  crh: "Ukrainada jurnalistika hem içtimaiy aktivizm aqqında"
};
const OG_LOCALE = { uk: "uk_UA", en: "en_US", crh: "crh_UA" };
const HTML_LOCALE_LABEL = { uk: "Мова / Language", en: "Мова / Language", crh: "Мова / Language" };
const LANG_BUTTON_LABEL = { uk: "UA", en: "EN", crh: "QT" };
const CATEGORIES = ["Заяви", "Новини", "Статті"];
const DEFAULT_OG_IMAGE = "https://news.promedia.report/img/og-share.png";

const TAG_LABELS_EN = {
  "Заяви": "Statements",
  "Новини": "News",
  "Статті": "Articles",
  "освіта": "education",
  "журналістська освіта": "journalism education",
  "вступ": "admissions",
  "рейтинг журфаків": "journalism schools ranking",
  "українські медіа": "Ukrainian media",
  "війна": "war",
  "безпека журналістів": "journalist safety",
  "дослідження": "research",
  "Львівський медіафорум": "Lviv Media Forum",
  "стійкість медіа": "media resilience",
  "державні комунікації": "public communications",
  "суспільство": "society",
  "військова реформа": "military reform",
  "інтерв’ю": "interview",
  "студенти": "students",
  "Україна": "Ukraine",
  "Японія": "Japan",
  "медійні спільноти": "media communities",
  "локальні медіа": "local media",
  "карта спільнот": "community map",
  "медіаправо": "media law",
  "Верховна Рада": "Verkhovna Rada",
  "доступ журналістів": "journalist access",
  "парламент": "parliament",
  "фактчекінг": "fact-checking",
  "журналістські розслідування": "investigative journalism",
  "ІРРП": "RPDI",
  "Суспільне": "Suspilne",
  "державний бюджет": "state budget",
  "медіаполітика": "media policy",
  "незалежні медіа": "independent media",
  "членство": "membership",
  "Велика Британія": "United Kingdom",
  "Чернігів": "Chernihiv"
};

// Best-effort machine translation into Crimean Tatar (Latin orthography) — review by a native speaker recommended.
const TAG_LABELS_CRH = {
  "Заяви": "Beyanatlar",
  "Новини": "Haberler",
  "Статті": "Maqaleler",
  "освіта": "maarif",
  "журналістська освіта": "jurnalistika maarifi",
  "вступ": "qabul",
  "рейтинг журфаків": "jurnalistika fakülteleri reytingi",
  "українські медіа": "Ukraina mediyası",
  "війна": "urış",
  "безпека журналістів": "jurnalistlerniñ emniyeti",
  "дослідження": "tedqiqat",
  "Львівський медіафорум": "Lviv mediya forumı",
  "стійкість медіа": "mediyanıñ turaqlılığı",
  "державні комунікації": "devlet kommunikatsiyaları",
  "суспільство": "cemiyet",
  "військова реформа": "asker reformı",
  "інтерв’ю": "intervyu",
  "студенти": "talebeler",
  "Україна": "Ukraina",
  "Японія": "Yaponiya",
  "медійні спільноти": "mediya cemaatları",
  "локальні медіа": "yerli mediya",
  "карта спільнот": "cemaatlar haritası",
  "медіаправо": "mediya huqoqı",
  "Верховна Рада": "Verhovna Rada",
  "доступ журналістів": "jurnalistlerniñ irişimi",
  "парламент": "parlament",
  "фактчекінг": "faktçeking",
  "журналістські розслідування": "jurnalist teftişleri",
  "ІРРП": "RPDI",
  "Суспільне": "Suspilne",
  "державний бюджет": "devlet byudjeti",
  "медіаполітика": "mediya siyaseti",
  "незалежні медіа": "müstaqil mediya",
  "членство": "azalıq",
  "Велика Британія": "Buyuk Britaniya",
  "Чернігів": "Çernihiv"
};

function tagLabel(tag, lang) {
  if (lang === "en") return TAG_LABELS_EN[tag] || tag;
  if (lang === "crh") return TAG_LABELS_CRH[tag] || tag;
  return tag;
}

function localizedUrls(url) {
  const bare = url.replace(/([?&])lang=[a-z]+&?/, "$1").replace(/[?&]$/, "");
  const withLang = (lang) => lang === "uk" ? bare : bare + (bare.includes("?") ? "&" : "?") + `lang=${lang}`;
  return { ukUrl: withLang("uk"), enUrl: withLang("en"), crhUrl: withLang("crh") };
}

function baseHead({ title, description, url, ogImage, lang, ogType, publishedAt }) {
  const { ukUrl, enUrl, crhUrl } = localizedUrls(url);
  const canonicalUrl = lang === "en" ? enUrl : (lang === "crh" ? crhUrl : ukUrl);
  const locale = OG_LOCALE[lang] || OG_LOCALE.uk;
  const alternateLocales = LANGS.filter((l) => l !== lang).map((l) => OG_LOCALE[l]);
  return `
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
<meta property="og:type" content="${escapeHtml(ogType || "website")}" />
<meta property="og:site_name" content="${escapeHtml(pick(SITE_NAME, lang))}" />
<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${escapeHtml(ogImage || DEFAULT_OG_IMAGE)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:locale" content="${locale}" />
${alternateLocales.map((l) => `<meta property="og:locale:alternate" content="${l}" />`).join("\n")}
${publishedAt ? `<meta property="article:published_time" content="${escapeHtml(publishedAt)}" />` : ""}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(ogImage || DEFAULT_OG_IMAGE)}" />
<link rel="alternate" hreflang="uk" href="${escapeHtml(ukUrl)}" />
<link rel="alternate" hreflang="en" href="${escapeHtml(enUrl)}" />
<link rel="alternate" hreflang="crh" href="${escapeHtml(crhUrl)}" />
<link rel="alternate" hreflang="x-default" href="${escapeHtml(ukUrl)}" />
<link rel="icon" href="/favicon.png" type="image/png" />
<link rel="stylesheet" href="/css/style.css" />`;
}

const NAV_ARIA = { uk: "Проєкти ПроМедіа", en: "ProMedia projects", crh: "ProMedia loyihaları" };
const NAV_LABELS = {
  uk: { communities: "Карта спільнот", ratings: "Рейтинг журфаків", research: "Дослідження", atlas: "Атлас Медіа", news: "Новини" },
  en: { communities: "Media communities", ratings: "Journalism schools", research: "Research", atlas: "Media Atlas", news: "News" },
  crh: { communities: "Cemaatlar haritası", ratings: "Jurnalistika fakülteleri reytingi", research: "Tedqiqatlar", atlas: "Mediya Atlası", news: "Haberler" }
};

function header(lang) {
  // The other network subdomains only publish uk/en, so a crh reader is sent to their uk version.
  const en = lang === "en";
  const q = langQ(lang);
  const main = en ? "https://promedia.report/en" : "https://promedia.report";
  const links = pick(NAV_LABELS, lang);
  const aria = pick(NAV_ARIA, lang);
  return `
<nav class="utility-bar" aria-label="${aria}">
  <a class="home-btn" href="${main}">← ${en ? "ProMedia" : "ПроМедіа"}</a>
  <span class="lang-toggle" aria-label="${HTML_LOCALE_LABEL[lang]}">
    ${LANGS.map((l) => `<a class="lang-btn${l === lang ? " active" : ""}" href="?lang=${l}">${LANG_BUTTON_LABEL[l]}</a>`).join("")}
  </span>
</nav>
<nav class="network-nav" aria-label="${aria}">
  <a class="network-link active" href="/${q}">${links.news}</a>
  <a class="network-link" href="https://communities.promedia.report/${en ? "en/" : ""}">${links.communities}</a>
  <a class="network-link" href="https://ratings.promedia.report/${en ? "?lang=en" : ""}">${links.ratings}</a>
  <a class="network-link" href="https://research.promedia.report/${en ? "en/" : ""}">${links.research}</a>
  <a class="network-link" href="https://atlas.promedia.report/${en ? "en/" : ""}">${links.atlas}</a>
</nav>`;
}

const FOOTER_TEXT = {
  en: {
    details: "Organization details", name: "Official name", nameValue: "ProMedia NGO",
    registration: "Registration number", address: "Registered address",
    addressValue: "19/44 Volodymyra Samiilenka St., Kyiv, Ukraine, 03118",
    chair: "Chair of the Board", chairValue: "Andrii Ianitskyi", phone: "Phone", email: "Email",
    social: "Social media", project: "A ProMedia project", correction: "Found an error?"
  },
  uk: {
    details: "Дані про організацію", name: "Офіційна назва", nameValue: "ГО «ПроМедіа»",
    registration: "Реєстраційний номер", address: "Юридична адреса",
    addressValue: "вул. Володимира Самійленка, 19/44, Київ, Україна, 03118",
    chair: "Голова правління", chairValue: "Андрій Яніцький", phone: "Телефон", email: "Електронна пошта",
    social: "Соціальні мережі", project: "Проєкт ПроМедіа", correction: "Побачили помилку?"
  },
  crh: {
    details: "Teşkilât aqqında malümat", name: "Resmiy adı", nameValue: "«ProMedia» İCT",
    registration: "Qayd nomeri", address: "Yuridik adres",
    addressValue: "Volodymyr Samiylenko soqağı, 19/44, Kiev, Ukraina, 03118",
    chair: "İdare Keñeşi Reisi", chairValue: "Andriy Ianitskiy", phone: "Telefon", email: "Elektron poçta",
    social: "İçtimaiy şebekeler", project: "ProMedia loyihası", correction: "Hata taptıñızmı?"
  }
};

function footer(lang) {
  const en = lang === "en";
  const main = en ? "https://promedia.report/en" : "https://promedia.report";
  const t = pick(FOOTER_TEXT, lang);
  const aria = pick(NAV_ARIA, lang);
  const links = pick(NAV_LABELS, lang);
  return `
<footer class="site-footer">
  <div class="site-footer-heading">
    <a href="${main}">${t.project}</a>
    <h2>${t.details}</h2>
  </div>
  <dl class="site-footer-details">
    <div><dt>${t.name}</dt><dd>${t.nameValue}</dd></div>
    <div><dt>${t.registration}</dt><dd>45995408</dd></div>
    <div><dt>${t.address}</dt><dd>${t.addressValue}</dd></div>
    <div><dt>${t.chair}</dt><dd>${t.chairValue}</dd></div>
    <div><dt>${t.phone}</dt><dd><a href="tel:+380506959537">+38 (050) 695 95 37</a></dd></div>
    <div><dt>${t.email}</dt><dd><a href="mailto:info@promedia.report">info@promedia.report</a></dd></div>
    <div><dt>${t.social}</dt><dd><a href="https://www.instagram.com/promediaua/" target="_blank" rel="noopener">Instagram</a> · <a href="https://www.facebook.com/promediaukraine" target="_blank" rel="noopener">Facebook</a> · <a href="https://www.linkedin.com/company/promediaukraine/" target="_blank" rel="noopener">LinkedIn</a> · <a href="https://www.youtube.com/@prostirmedia" target="_blank" rel="noopener">YouTube</a></dd></div>
  </dl>
  <a class="site-footer-correction" href="mailto:info@promedia.report">${t.correction} info@promedia.report</a>
  <nav class="network-footer" aria-label="${aria}">
    <a href="/${langQ(lang)}">${links.news}</a>
    <a href="https://communities.promedia.report/${en ? "en/" : ""}">${links.communities}</a>
    <a href="https://ratings.promedia.report/${en ? "?lang=en" : ""}">${links.ratings}</a>
    <a href="https://research.promedia.report/${en ? "en/" : ""}">${links.research}</a>
    <a href="https://atlas.promedia.report/${en ? "en/" : ""}">${links.atlas}</a>
  </nav>
</footer>`;
}

function pageShell({ title, description, url, ogImage, lang, ogType, publishedAt, bodyHtml }) {
  return `<!doctype html>
<html lang="${lang}">
<head>
${baseHead({ title, description, url, ogImage, lang, ogType, publishedAt })}
<script async src="https://www.googletagmanager.com/gtag/js?id=G-D8TM22QR9R"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-D8TM22QR9R');
</script>
</head>
<body>
${header(lang)}
${bodyHtml}
${footer(lang)}
<script defer src="/js/promedia-language-suggest.js"></script>
<script defer src="/js/promedia-memorial-popup.js"></script>
<script defer src="/js/promedia-push-bell.js"></script>
<script>
(function(){
  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }
  ready(function(){
    document.querySelectorAll("[data-share-native]").forEach(function(button){
      if (!navigator.share) return;
      button.hidden = false;
      button.addEventListener("click", function(){
        navigator.share({
          title: button.dataset.shareTitle || document.title,
          text: button.dataset.shareText || "",
          url: button.dataset.shareUrl || location.href
        }).catch(function(){});
      });
    });

    document.querySelectorAll("[data-share-copy]").forEach(function(button){
      button.addEventListener("click", function(){
        var url = button.dataset.shareUrl || location.href;
        var label = button.dataset.label || button.textContent;
        var done = button.dataset.done || "Copied";
        function showDone() {
          button.textContent = done;
          window.setTimeout(function(){ button.textContent = label; }, 1800);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(showDone).catch(function(){ window.prompt("Copy link", url); });
        } else {
          window.prompt("Copy link", url);
        }
      });
    });
  });
})();
</script>
</body>
</html>`;
}

const CRH_MONTHS = ["yanvar", "fevral", "mart", "aprel", "mayıs", "iyün", "iyül", "avgust", "sentâbr", "oktâbr", "noyabr", "dekabr"];

function formatDate(dateStr, lang) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (lang === "crh") {
    return `${d.getUTCDate()} ${CRH_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} senesi`;
  }
  return d.toLocaleDateString(lang === "en" ? "en-GB" : "uk-UA", { year: "numeric", month: "long", day: "numeric" });
}

function localizedField(article, field, lang) {
  if (lang === "uk") return article[field];
  const localized = article[`${field}_${lang}`];
  return localized || article[field];
}

function articleTitle(article, lang) {
  return localizedField(article, "title", lang);
}
function articleExcerpt(article, lang) {
  const raw = lang === "uk" ? article.excerpt : (article[`excerpt_${lang}`] || article.excerpt);
  return raw || markdownToPlainText(localizedField(article, "body_md", lang), 200);
}

const ALL_LABEL = { uk: "Усі", en: "All", crh: "Episi" };
const CATEGORY_NAV_ARIA = { uk: "Рубрики новин", en: "News categories", crh: "Haber kategoriyaları" };

function categoryNav(lang, activeTag) {
  const labels = { all: pick(ALL_LABEL, lang), "Заяви": tagLabel("Заяви", lang), "Новини": tagLabel("Новини", lang), "Статті": tagLabel("Статті", lang) };
  const allHref = `/${langQ(lang)}`;
  const items = [
    `<a class="category-link${!activeTag ? " active" : ""}" href="${allHref}">${labels.all}</a>`,
    ...CATEGORIES.map((category) => {
      const query = `?tag=${encodeURIComponent(category)}${langAmp(lang)}`;
      return `<a class="category-link${activeTag === category ? " active" : ""}" href="/${query}">${labels[category]}</a>`;
    })
  ];
  return `<nav class="category-nav" aria-label="${pick(CATEGORY_NAV_ARIA, lang)}">${items.join("")}</nav>`;
}

const TOP_STORY_LABEL = { uk: "Головна новина", en: "Top story", crh: "Baş haber" };

function articleCard(article, lang, baseUrl, variant) {
  const title = articleTitle(article, lang);
  const excerpt = articleExcerpt(article, lang);
  const tags = JSON.parse(article.tags || "[]");
  const cardVariant = variant || "visual";
  const showCover = cardVariant !== "text" && article.cover_image_url;
  const langQuery = langQ(lang);
  const cover = showCover
    ? `<a class="article-card-media" href="${baseUrl}/article/${escapeHtml(article.slug)}${langQuery}">
        <img class="article-card-img" src="${escapeHtml(article.cover_image_url)}" alt="${escapeHtml(title)}" loading="${cardVariant === "hero" ? "eager" : "lazy"}" />
      </a>`
    : "";
  return `
<article class="article-card article-card--${cardVariant}">
  ${cover}
  <div class="article-card-body">
    ${cardVariant === "hero" ? `<span class="lead-label">${pick(TOP_STORY_LABEL, lang)}</span>` : ""}
    ${tags.length ? `<div class="article-tags">${tags.map((t) => `<span class="article-tag">${escapeHtml(tagLabel(t, lang))}</span>`).join("")}</div>` : ""}
    <h3><a href="${baseUrl}/article/${escapeHtml(article.slug)}${langQuery}">${escapeHtml(title)}</a></h3>
    <p class="article-excerpt">${escapeHtml(excerpt)}</p>
    <p class="article-date">${escapeHtml(formatDate(article.published_at, lang))}</p>
  </div>
</article>`;
}

function articleCardVariant(article, automaticVariant) {
  const style = article.card_style || "auto";
  if (style === "image") return "visual";
  if (style === "text" || style === "hero") return style;
  return automaticVariant;
}

const SHARE_LABELS = {
  en: { title: "Share", native: "Instagram / more", copy: "Copy link", copied: "Copied", email: "Email" },
  uk: { title: "Поширити", native: "Instagram / ще", copy: "Копіювати", copied: "Скопійовано", email: "Email" },
  crh: { title: "Paylaş", native: "Instagram / daha", copy: "Kopiyala", copied: "Kopiyalandı", email: "Email" }
};

function articleShareBlock({ title, excerpt, articleUrl, lang }) {
  const encodedUrl = encodeURIComponent(articleUrl);
  const encodedTitle = encodeURIComponent(title);
  const encodedText = encodeURIComponent(`${title}\n\n${articleUrl}`);
  const labels = pick(SHARE_LABELS, lang);
  const links = [
    ["Facebook", `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`],
    ["X", `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`],
    ["Threads", `https://www.threads.net/intent/post?text=${encodedText}`],
    ["Telegram", `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`],
    ["LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`],
    ["WhatsApp", `https://api.whatsapp.com/send?text=${encodedText}`],
    ["Viber", `viber://forward?text=${encodedText}`],
    [labels.email, `mailto:?subject=${encodedTitle}&body=${encodedText}`]
  ];
  return `
<section class="article-share" aria-label="${escapeHtml(labels.title)}">
  <span>${escapeHtml(labels.title)}</span>
  <div class="article-share-links">
    ${links.map(([label, href]) => `<a href="${escapeHtml(href)}" target="_blank" rel="noopener" aria-label="${escapeHtml(`${labels.title}: ${label}`)}">${escapeHtml(label)}</a>`).join("")}
    <button type="button" data-share-copy data-share-url="${escapeHtml(articleUrl)}" data-label="${escapeHtml(labels.copy)}" data-done="${escapeHtml(labels.copied)}">${escapeHtml(labels.copy)}</button>
    <button type="button" hidden data-share-native data-share-title="${escapeHtml(title)}" data-share-text="${escapeHtml(excerpt)}" data-share-url="${escapeHtml(articleUrl)}">${escapeHtml(labels.native)}</button>
  </div>
</section>`;
}

const NO_ARTICLES_LABEL = { uk: "Статей поки немає.", en: "No articles yet.", crh: "Äli maqale yoq." };
const TOP_STORIES_ARIA = { uk: "Головні новини", en: "Top stories", crh: "Baş haberler" };
const LATEST_NEWS_LABEL = { uk: "Останні новини", en: "Latest news", crh: "Soñki haberler" };

export function renderHomepage({ articles, lang, activeTag, baseUrl }) {
  const t = pick(SITE_NAME, lang);
  const tagline = pick(SITE_TAGLINE, lang);
  let list = `<p class="empty-state">${pick(NO_ARTICLES_LABEL, lang)}</p>`;
  if (articles.length) {
    const orderedArticles = articles.slice();
    const manualHeroIndex = orderedArticles.findIndex((article) => article.card_style === "hero");
    if (manualHeroIndex > 0) orderedArticles.unshift(orderedArticles.splice(manualHeroIndex, 1)[0]);
    const lead = orderedArticles.slice(0, 3);
    const stream = orderedArticles.slice(3);
    const leadSide = lead.slice(1).length
      ? `<div class="news-lead-side">
          ${lead[1] ? articleCard(lead[1], lang, baseUrl, articleCardVariant(lead[1], "visual")) : ""}
          ${lead[2] ? articleCard(lead[2], lang, baseUrl, articleCardVariant(lead[2], "text")) : ""}
        </div>`
      : "";
    const streamHtml = stream.length
      ? `<div class="news-section-heading">
          <h2>${pick(LATEST_NEWS_LABEL, lang)}</h2>
          <span>${String(stream.length).padStart(2, "0")}</span>
        </div>
        <div class="article-grid">
          ${stream.map((article, index) => articleCard(article, lang, baseUrl, articleCardVariant(article, index % 4 === 2 ? "text" : "visual"))).join("")}
        </div>`
      : "";
    list = `<section class="news-lead${leadSide ? " news-lead--with-side" : ""}" aria-label="${pick(TOP_STORIES_ARIA, lang)}">
        ${articleCard(lead[0], lang, baseUrl, articleCardVariant(lead[0], "hero"))}
        ${leadSide}
      </section>
      ${streamHtml}`;
  }
  const bodyHtml = `
<section class="hero">
  <div class="eyebrow">${escapeHtml(pick(SITE_EYEBROW, lang))}</div>
  <h1>${lang === "en" ? "News from <span>ProMedia</span>" : (lang === "crh" ? "<span>ProMedia</span>'dan haberler" : "Новини від <span>ProMedia</span>")}</h1>
  ${categoryNav(lang, activeTag)}
</section>
<main class="wrap">
${list}
</main>`;
  return pageShell({
    title: `${t} — ${tagline}`,
    description: tagline,
    url: `${baseUrl}/${langQ(lang)}`,
    lang,
    bodyHtml
  });
}

const BACK_TO_NEWS_LABEL = { uk: "← Усі новини", en: "← All news", crh: "← Episi haberler" };
const ABOUT_LABEL = { uk: "Про кого:", en: "About:", crh: "Kimler aqqında:" };

export function renderArticlePage({ article, lang, baseUrl, relatedMediaNames }) {
  const title = articleTitle(article, lang);
  const excerpt = articleExcerpt(article, lang);
  const articleUrl = `${baseUrl}/article/${article.slug}${langQ(lang)}`;
  const bodyMd = localizedField(article, "body_md", lang);
  const bodyHtmlContent = markdownToHtml(bodyMd);
  const tags = JSON.parse(article.tags || "[]");
  const cover = article.cover_image_url
    ? `<img class="article-cover" src="${escapeHtml(article.cover_image_url)}" alt="${escapeHtml(title)}" />`
    : "";
  const mediaLinksHtml = relatedMediaNames.length
    ? `<div class="article-related-media">
        <span>${pick(ABOUT_LABEL, lang)}</span>
        ${relatedMediaNames.map((m) => `<a href="${escapeHtml(m.url || `https://communities.promedia.report/media/?id=${encodeURIComponent(m.id)}&lang=${lang}`)}">${escapeHtml(m.name)}</a>`).join(", ")}
      </div>`
    : "";
  const bodyHtml = `
<main class="wrap article-page">
  <p class="article-back"><a href="/${langQ(lang)}">${pick(BACK_TO_NEWS_LABEL, lang)}</a></p>
  ${tags.length ? `<div class="article-tags">${tags.map((tg) => `<a class="article-tag" href="/?tag=${encodeURIComponent(tg)}${langAmp(lang)}">${escapeHtml(tagLabel(tg, lang))}</a>`).join("")}</div>` : ""}
  <h1>${escapeHtml(title)}</h1>
  <p class="article-date">${escapeHtml(formatDate(article.published_at, lang))}</p>
  ${articleShareBlock({ title, excerpt, articleUrl, lang })}
  ${cover}
  <div class="article-body">${bodyHtmlContent}</div>
  ${mediaLinksHtml}
</main>`;
  return pageShell({
    title: `${title} — ${pick(SITE_NAME, lang)}`,
    description: excerpt,
    url: articleUrl,
    ogImage: article.cover_image_url || undefined,
    ogType: "article",
    publishedAt: article.published_at,
    lang,
    bodyHtml
  });
}

const NOT_FOUND_LABEL = { uk: "Сторінку не знайдено.", en: "Page not found.", crh: "Saife tapılmadı." };

export function renderNotFound(lang, baseUrl) {
  const bodyHtml = `
<main class="wrap">
  <p class="empty-state">${pick(NOT_FOUND_LABEL, lang)}</p>
  <p><a href="/${langQ(lang)}">${pick(BACK_TO_NEWS_LABEL, lang)}</a></p>
</main>`;
  return pageShell({
    title: pick(SITE_NAME, lang),
    description: pick(SITE_TAGLINE, lang),
    url: `${baseUrl}/`,
    lang,
    bodyHtml
  });
}
