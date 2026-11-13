import { escapeHtml, markdownToHtml, markdownToPlainText } from "./markdown.js";
import { normalizeUkrainianQuotes, normalizeUkrainianTitle } from "./typography.js";

const LANGS = ["uk", "en", "crh"];

function pick(dict, lang) {
  return (dict && dict[lang] != null) ? dict[lang] : dict.uk;
}

// Мова — перший сегмент шляху, як на інших сайтах мережі: "" для uk,
// "/en" чи "/crh" для інших мов (/en/article/<slug>, /crh/?tag=…).
function langPrefix(lang) {
  return lang === "uk" ? "" : `/${lang}`;
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
  crh: "Ukrayinada jurnalistika hem içtimaiy aktivizm aqqında"
};
const OG_LOCALE = { uk: "uk_UA", en: "en_US", crh: "crh_UA" };
const HTML_LOCALE_LABEL = { uk: "Мова / Language", en: "Мова / Language", crh: "Til / Language" };
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
  "медіаграмотність": "media literacy",
  "штучний інтелект": "artificial intelligence",
  "медіаспільноти": "media communities",
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
  "Чернігів": "Chernihiv",
  "Канада": "Canada",
  "місцеві медіа": "local media",
  "фінансування медіа": "media funding"
};

// Crimean Tatar interface labels use the modern Latin orthography and the shared
// editorial terminology standard. Content translations receive a separate source-based check.
const TAG_LABELS_CRH = {
  "Заяви": "Beyanatlar",
  "Новини": "Haberler",
  "Статті": "Maqaleler",
  "освіта": "maarif",
  "журналістська освіта": "jurnalistika maarifi",
  "вступ": "qabul",
  "рейтинг журфаків": "jurnalistika fakülteleri reytingi",
  "українські медіа": "Ukrayina mediyası",
  "війна": "urış",
  "безпека журналістів": "jurnalistlerniñ emniyeti",
  "дослідження": "tedqiqat",
  "медіаграмотність": "mediya savatlılığı",
  "штучний інтелект": "suniy zekâ",
  "медіаспільноти": "mediya cemaatları",
  "Львівський медіафорум": "Lviv mediya forumı",
  "стійкість медіа": "mediyanıñ turaqlılığı",
  "державні комунікації": "devlet kommunikatsiyaları",
  "суспільство": "cemiyet",
  "військова реформа": "asker reformı",
  "інтерв’ю": "intervyu",
  "студенти": "talebeler",
  "Україна": "Ukrayina",
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
  "Чернігів": "Çernihiv",
  "Канада": "Kanada",
  "місцеві медіа": "yerli mediya",
  "фінансування медіа": "mediyanı malieleştirüv"
};

function tagLookupKey(tag) {
  return String(tag || "").normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("uk-UA");
}

const TAG_LABEL_LOOKUP = Object.fromEntries(
  [["en", TAG_LABELS_EN], ["crh", TAG_LABELS_CRH]].map(([lang, labels]) => [
    lang, Object.fromEntries(Object.entries(labels).map(([tag, label]) => [tagLookupKey(tag), label]))
  ])
);

function tagLabel(tag, lang) {
  return TAG_LABEL_LOOKUP[lang]?.[tagLookupKey(tag)] || tag;
}

function articleCoverMetadata(article, lang) {
  let data = lang === "crh" && article.cover_image_url_crh ? article.cover_crop_data_crh
    : lang === "en" && article.cover_image_url_en ? article.cover_crop_data_en : article.cover_crop_data;
  try { return (typeof data === "string" ? JSON.parse(data) : data) || {}; } catch (_) { return {}; }
}

function articleCoverAlt(article, lang, fallback) {
  return articleCoverMetadata(article, lang).alt || fallback;
}

function articleFocalStyle(article, lang, format) {
  let data = articleCoverMetadata(article, lang);
  try { if (typeof data === "string") data = JSON.parse(data); } catch (_) { return ""; }
  const fit = data && data.fit === "contain" ? "object-fit:contain;background:#f1f2fa;" : "";
  const point = data && data[format];
  if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) return "";
  const clamped = (p) => Math.max(0, Math.min(100, Number(p.x))) + "% " + Math.max(0, Math.min(100, Number(p.y))) + "%";
  if (format === "desktop") {
    const mobile = data.mobile && Number.isFinite(Number(data.mobile.x)) && Number.isFinite(Number(data.mobile.y))
      ? clamped(data.mobile) : clamped(point);
    return ' style="' + fit + '--cover-desktop-position:' + clamped(point) + ';--cover-mobile-position:' + mobile + '"';
  }
  return ' style="' + fit + 'object-position:' + clamped(point) + '"';
}

function articleCover(article, lang) {
  if (lang === "crh" && article.cover_image_url_crh) return article.cover_image_url_crh;
  return lang === "en" && article.cover_image_url_en
    ? article.cover_image_url_en
    : article.cover_image_url;
}

// Ту саму сторінку іншими мовами: прибираємо мовний префікс і додаємо потрібний.
function localizedUrls(url) {
  const u = new URL(url);
  u.searchParams.delete("lang");
  const path = u.pathname.replace(/^\/(en|crh)(?=\/|$)/, "") || "/";
  const withLang = (lang) => `${u.origin}${langPrefix(lang)}${path}${u.search}`;
  return { ukUrl: withLang("uk"), enUrl: withLang("en"), crhUrl: withLang("crh") };
}

function baseHead({ title, description, url, ogImage, lang, ogType, publishedAt }) {
  const { ukUrl, enUrl, crhUrl } = localizedUrls(url);
  const canonicalUrl = lang === "en" ? enUrl : (lang === "crh" ? crhUrl : ukUrl);
  const defaultImage = lang === "crh" || lang === "en"
    ? `/img/og-share-${lang}.png`
    : DEFAULT_OG_IMAGE;
  const socialImage = new URL(ogImage || defaultImage, canonicalUrl).toString();
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
<meta property="og:image" content="${escapeHtml(socialImage)}" />
<meta property="og:image:secure_url" content="${escapeHtml(socialImage)}" />
<meta property="og:locale" content="${locale}" />
${alternateLocales.map((l) => `<meta property="og:locale:alternate" content="${l}" />`).join("\n")}
${publishedAt ? `<meta property="article:published_time" content="${escapeHtml(publishedAt)}" />` : ""}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(socialImage)}" />
<link rel="alternate" hreflang="uk" href="${escapeHtml(ukUrl)}" />
<link rel="alternate" hreflang="en" href="${escapeHtml(enUrl)}" />
<link rel="alternate" hreflang="crh" href="${escapeHtml(crhUrl)}" />
<link rel="alternate" hreflang="x-default" href="${escapeHtml(ukUrl)}" />
<link rel="icon" href="/favicon.png" type="image/png" />
<link rel="stylesheet" href="/css/style.css" />`;
}

const NAV_ARIA = { uk: "Проєкти ПроМедіа", en: "ProMedia projects", crh: "ProMedia leyhaları" };
const NAV_LABELS = {
  uk: { communities: "Карта спільнот", ratings: "Рейтинг журфаків", research: "Дослідження", atlas: "Атлас Медіа", news: "Новини" },
  en: { communities: "Media communities", ratings: "Journalism schools", research: "Research", atlas: "Media Atlas", news: "News" },
  crh: { communities: "Cemaatlar haritası", ratings: "Jurnalistika fakülteleri reytingi", research: "Tedqiqatlar", atlas: "Mediya Atlası", news: "Haberler" }
};

// Адреси сусідніх сайтів мережі для кожної мови. Communities, research і
// atlas і рейтинг журфаків мають crh-версію; promedia.report — ні, тож
// кримськотатарський читач потрапляє на його українську версію.
const NETWORK_URLS = {
  communities: { uk: "https://communities.promedia.report/", en: "https://communities.promedia.report/en/", crh: "https://communities.promedia.report/crh/" },
  ratings: { uk: "https://ratings.promedia.report/", en: "https://ratings.promedia.report/en/", crh: "https://ratings.promedia.report/crh/" },
  research: { uk: "https://research.promedia.report/", en: "https://research.promedia.report/en/", crh: "https://research.promedia.report/crh/" },
  atlas: { uk: "https://atlas.promedia.report/", en: "https://atlas.promedia.report/en/", crh: "https://atlas.promedia.report/crh/" }
};

function header() {
  return `<promedia-global-header></promedia-global-header>`;
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
    addressValue: "Volodymyr Samiylenko soqağı, 19/44, Kyiv, Ukrayina, 03118",
    chair: "İdare Keñeşi Reisi", chairValue: "Andrii Ianitskyi", phone: "Telefon", email: "Elektron poçta",
    social: "İçtimaiy şebekeler", project: "ProMedia leyhası", correction: "Hata taptıñızmı?"
  }
};

function footer() {
  return `<promedia-global-footer></promedia-global-footer>`;
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
${header(lang, url)}
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
    document.querySelectorAll("[data-share-instagram]").forEach(function(button){
      button.addEventListener("click", async function(){
        var url = button.dataset.shareUrl || location.href;
        var status = button.closest(".article-share").querySelector("[data-share-status]");
        status.textContent = "";
        if (navigator.share) {
          try {
            await navigator.share({
              title: button.dataset.shareTitle || document.title,
              text: button.dataset.shareText || "",
              url: url
            });
            return;
          } catch (error) {
            if (error.name === "AbortError") return;
          }
        }
        try {
          await navigator.clipboard.writeText(url);
          status.textContent = button.dataset.copied;
        } catch (error) {
          window.prompt(button.dataset.copy, url);
        }
      });
    });
  });
})();
</script>
<script defer src="/js/promedia-global-shell.js"></script>
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

function articleMeta(article, lang) {
  const count = article.view_count;
  const labels = { uk: "Перегляди", en: "Views", crh: "Baqıluvlar" };
  const hints = { uk: "Перегляди за даними Google Analytics", en: "Page views from Google Analytics", crh: "Google Analytics malümatlarına köre baqıluvlar" };
  const views = Number.isSafeInteger(count) && count >= 0
    ? `<span class="article-views" title="${pick(hints, lang)}" aria-label="${pick(labels, lang)}: ${count}"><svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg><span>${new Intl.NumberFormat(lang === "en" ? "en-GB" : "uk-UA").format(count)}</span></span>`
    : "";
  return `<div class="article-meta"><p class="article-date">${escapeHtml(formatDate(article.published_at, lang))}</p>${views}</div>`;
}

function localizedField(article, field, lang) {
  const normalize = field === "title" ? normalizeUkrainianTitle : normalizeUkrainianQuotes;
  if (lang === "uk") return normalize(article[field]);
  const localized = article[`${field}_${lang}`];
  return localized || normalize(article[field]);
}

function articleTitle(article, lang) {
  return localizedField(article, "title", lang);
}
function articleExcerpt(article, lang) {
  const raw = localizedField(article, "excerpt", lang);
  return raw || markdownToPlainText(localizedField(article, "body_md", lang), 200);
}

const ALL_LABEL = { uk: "Усі", en: "All", crh: "Episi" };
const CATEGORY_NAV_ARIA = { uk: "Рубрики новин", en: "News categories", crh: "Haber kategoriyaları" };

function categoryNav(lang, activeTag) {
  const labels = { all: pick(ALL_LABEL, lang), "Заяви": tagLabel("Заяви", lang), "Новини": tagLabel("Новини", lang), "Статті": tagLabel("Статті", lang) };
  const allHref = `${langPrefix(lang)}/`;
  const items = [
    `<a class="category-link${!activeTag ? " active" : ""}" href="${allHref}">${labels.all}</a>`,
    ...CATEGORIES.map((category) => {
      const query = `?tag=${encodeURIComponent(category)}`;
      return `<a class="category-link${activeTag === category ? " active" : ""}" href="${langPrefix(lang)}/${query}">${labels[category]}</a>`;
    })
  ];
  return `<nav class="category-nav" aria-label="${pick(CATEGORY_NAV_ARIA, lang)}">${items.join("")}</nav>`;
}

const TOP_STORY_LABEL = { uk: "У центрі уваги", en: "Top story", crh: "Baş haber" };

function articleCard(article, lang, baseUrl, variant) {
  const title = articleTitle(article, lang);
  const excerpt = articleExcerpt(article, lang);
  const tags = JSON.parse(article.tags || "[]");
  const isArticle = tags.some(t => tagLookupKey(t) === "статті");
  const contentKind = isArticle ? "article" : tags.some(t => tagLookupKey(t) === "заяви") ? "statement" : tags.some(t => tagLookupKey(t) === "новини") ? "news" : "other";
  const cardVariant = variant || "visual";
  const coverUrl = articleCover(article, lang);
  const showCover = coverUrl && (cardVariant !== "text" || isArticle);
  const articleHref = `${baseUrl}${langPrefix(lang)}/article/${escapeHtml(article.slug)}`;
  const cover = showCover
    ? `<a class="article-card-media${cardVariant === "text" ? " article-card-media--mobile-only" : ""}" href="${articleHref}">
        <img class="article-card-img" src="${escapeHtml(coverUrl)}" alt="${escapeHtml(articleCoverAlt(article, lang, title))}"${articleFocalStyle(article, lang, cardVariant === "hero" ? "desktop" : "feed")} loading="${cardVariant === "hero" ? "eager" : "lazy"}" />
      </a>`
    : "";
  return `
<article class="article-card article-card--${cardVariant}" data-content-kind="${contentKind}">
  ${cover}
  <div class="article-card-body">
    ${tags.length ? `<div class="article-tags">${tags.map((t) => `<a class="article-tag" href="${langPrefix(lang)}/?tag=${encodeURIComponent(t)}">${escapeHtml(tagLabel(t, lang))}</a>`).join("")}</div>` : ""}
    <${cardVariant === "hero" ? "h1" : "h3"}><a href="${articleHref}">${escapeHtml(title)}</a></${cardVariant === "hero" ? "h1" : "h3"}>
    <p class="article-excerpt">${escapeHtml(excerpt)}</p>
    ${articleMeta(article, lang)}
  </div>
</article>`;
}

function articleCardVariant(article, automaticVariant) {
  const style = article.card_style || "auto";
  if (style === "image" || style === "hero") return "visual";
  if (style === "text") return style;
  return automaticVariant;
}

const SHARE_LABELS = {
  en: { title: "Share", instagram: "Instagram: open sharing options or copy the link", copy: "Copy this link and paste it into Instagram", copied: "Link copied. Paste it into an Instagram message or a story link sticker." },
  uk: { title: "Поширити", instagram: "Instagram: відкрити меню поширення або скопіювати посилання", copy: "Скопіюйте посилання та вставте в Instagram", copied: "Посилання скопійовано. Вставте його в повідомлення Instagram або стікер посилання в історії." },
  crh: { title: "Paylaş", instagram: "Instagram: paylaşuv menüsini aç ya da bağlantını kopiyala", copy: "Bağlantını kopiyalañız ve Instagram'ğa yapıştırıñız", copied: "Bağlantı kopiyalandı. Onı Instagram mesajına ya da hikâyedeki bağlantı etiketine yapıştırıñız." }
};

// Inline brand icons keep the share controls independent of external icon services.
const SHARE_ICON_PATHS = {
  Facebook: "M13.7 21v-8h2.8l.4-3.2h-3.2V7.7c0-.9.3-1.6 1.7-1.6h1.8V3.2c-.3 0-1.4-.2-2.6-.2-2.6 0-4.4 1.6-4.4 4.5v2.3H7.3V13h2.9v8h3.5Z",
  X: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.64 7.584H.47l8.6-9.835L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
  Threads: "M18.263 11.097c-.03-3.486-1.92-5.586-5.111-5.586-2.13 0-3.922.963-4.863 2.499l2.062 1.438c.535-.843 1.272-1.543 2.628-1.543 1.528 0 2.318.85 2.544 2.431a15 15 0 0 0-2.236-.173c-4.125 0-6.068 1.867-6.068 4.336s1.943 3.99 4.804 3.99c3.139 0 5.013-2.115 5.781-4.735.798.361 1.348 1.204 1.348 2.47 0 3.387-3.907 5.232-7.22 5.232-4.885 0-8.077-3.207-8.077-8.424 0-6.392 4.223-10.487 9.9-10.487 3.808 0 5.69 1.671 6.97 3.914l2.108-1.475C21.44 2.078 18.331 0 13.663 0 6.227 0 1.168 5.277 1.168 12.934c0 7 4.953 11.066 10.856 11.066 4.878 0 9.809-2.846 9.809-7.716 0-2.545-1.46-4.231-3.569-5.187m-6.33 4.855c-1.077 0-2.026-.512-2.026-1.453 0-1.483 1.822-1.934 3.606-1.934.678 0 1.34.045 1.927.173-.422 1.927-1.671 3.215-3.508 3.214Z",
  LinkedIn: "M4.98 3.5A2.5 2.5 0 1 1 5 8.5a2.5 2.5 0 0 1-.02-5ZM3 10h4v11H3V10Zm6 0h3.8v1.5h.05c.53-1 1.83-2.05 3.77-2.05C20.65 9.45 21 12.1 21 15.55V21h-4v-4.83c0-1.15-.02-2.63-1.6-2.63-1.6 0-1.85 1.25-1.85 2.55V21H9V10Z",
  Instagram: "M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm10.5 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
};

function shareIcon(network) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${SHARE_ICON_PATHS[network]}" /></svg>`;
}

function articleShareBlock({ title, excerpt, articleUrl, lang }) {
  const encodedUrl = encodeURIComponent(articleUrl);
  const encodedTitle = encodeURIComponent(title);
  const encodedText = encodeURIComponent(`${title}\n\n${articleUrl}`);
  const labels = pick(SHARE_LABELS, lang);
  const links = [
    ["Facebook", `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`],
    ["X", `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`],
    ["Threads", `https://www.threads.net/intent/post?text=${encodedText}`],
    ["LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`]
  ];
  return `
<section class="article-share" aria-label="${escapeHtml(labels.title)}">
  <span>${escapeHtml(labels.title)}</span>
  <div class="article-share-links">
    ${links.map(([label, href]) => `<a href="${escapeHtml(href)}" target="_blank" rel="noopener" aria-label="${escapeHtml(`${labels.title}: ${label}`)}" title="${escapeHtml(label)}">${shareIcon(label)}</a>`).join("")}
    <button type="button" data-share-instagram data-share-title="${escapeHtml(title)}" data-share-text="${escapeHtml(excerpt)}" data-share-url="${escapeHtml(articleUrl)}" data-copy="${escapeHtml(labels.copy)}" data-copied="${escapeHtml(labels.copied)}" aria-label="${escapeHtml(`${labels.title}: Instagram`)}" title="${escapeHtml(labels.instagram)}">${shareIcon("Instagram")}</button>
  </div>
  <p class="article-share-status" data-share-status role="status"></p>
</section>`;
}

const NO_ARTICLES_LABEL = { uk: "Статей поки немає.", en: "No articles yet.", crh: "Şimdilik maqale yoq." };
const TOP_STORIES_ARIA = { uk: "Головні новини", en: "Top stories", crh: "Baş haberler" };
const LATEST_NEWS_LABEL = { uk: "Останні новини", en: "Latest news", crh: "Soñki haberler" };

export const PRACTICE_TOPICS = [
  { id: "audience", labels: { uk: "Залучати аудиторію", en: "Engage audiences", crh: "Auditoriyanı celp etmek" }, tags: ["медійні спільноти", "медіаспільноти", "Медіаспільноти", "членство", "карта спільнот"] },
  { id: "money", labels: { uk: "Знаходити гроші", en: "Find funding", crh: "Malî imkânlar tapmaq" }, tags: ["локальний бізнес", "фінансування", "фандрейзинг", "медіапідприємництво", "членство"] },
  { id: "technology", labels: { uk: "Автоматизувати роботу", en: "Automate work", crh: "İşni avtomatlaştırmaq" }, tags: ["штучний інтелект", "Штучний інтелект", "ШІ", "автоматизація", "відкриті дані", "фактчекінг"] },
  { id: "team", labels: { uk: "Розвивати команду", en: "Develop your team", crh: "Komandanı inkişaf ettirmek" }, tags: ["журналістська освіта", "освіта", "навчання", "безпека журналістів", "ейджизм"] }
];

function articleTags(article) {
  try { const tags = JSON.parse(article.tags || "[]"); return Array.isArray(tags) ? tags : []; } catch { return []; }
}

const PRACTICE_COPY = {
  uk: { title: "Медіа, які розвиваються", intro: "Досвід, знання та інструменти для вашої редакції.", needs: "Що потрібно вашій редакції?", practice: "Взяти в роботу", latest: "Останні публікації", all: "Усі матеріали", research: "Дослідження", organisation: "ПроМедіа: події та проєкти", services: "Інструменти ПроМедіа", guide: "Посібник із розвитку спільнот", atlas: "Атлас Медіа", jobs: "Робота в медіа", filtered: "Матеріали за темою" },
  en: { title: "Helping media grow", intro: "Experience, knowledge and tools for your newsroom.", needs: "What does your newsroom need?", practice: "Put into practice", latest: "Latest publications", all: "All publications", research: "Research", organisation: "ProMedia: events and projects", services: "ProMedia tools", guide: "Community development guide", atlas: "Media Atlas", jobs: "Media jobs", filtered: "Explore this topic" },
  crh: { title: "İnkişaf etken mediya", intro: "Redaktsiyañız içün tecribe, bilgi ve aletler.", needs: "Redaktsiyañızğa ne kerek?", practice: "Amelde qullanıñız", latest: "Soñki neşirler", all: "Bütün neşirler", research: "Tedqiqatlar", organisation: "ProMedia: tedbirler ve leyhalar", services: "ProMedia aletleri", guide: "Cemaatlarnı inkişaf ettirüv qılavuzı", atlas: "Mediya Atlası", jobs: "Mediyada iş", filtered: "Mevzuğa ait neşirler" }
};


const PROJECT_PROMOS = {
  uk: { label: "Проєкт ПроМедіа", atlas: ["Хто стоїть за українськими медіа?", "Шукайте медіа та їхніх власників в Атласі Медіа.", "Відкрити Атлас"], jobs: ["Знайдіть свою роботу в медіа", "Вакансії та можливості для медійників.", "До вакансій"] },
  en: { label: "A ProMedia project", atlas: ["Who owns Ukrainian media?", "Explore media outlets and their owners in the Media Atlas.", "Open the Atlas"], jobs: ["Find your next media job", "Jobs and opportunities for media professionals.", "Explore jobs"] },
  crh: { label: "ProMedia leyhası", atlas: ["Ukrayina mediyasınıñ saipleri kim?", "Mediya Atlasında mediya ve saiplerini tapıñız.", "Atlasnı aç"], jobs: ["Mediyada iş tapıñız", "Mediya mütehassısları içün vakansiyalar.", "Vakansiyalar"] }
};

function projectPromo(lang, project, placement) {
  const copy = pick(PROJECT_PROMOS, lang);
  const [title, description, action] = copy[project];
  const href = project === "atlas" ? NETWORK_URLS.atlas[lang] : "https://jobs.promedia.report/";
  if (project === "atlas" && placement === "home-mosaic") {
    const labels = pick({
      uk: { label: "Наші проєкти", brand: "АТЛАС МЕДІА", title: "Хто володіє українськими медіа?" },
      en: { label: "Our projects", brand: "MEDIA ATLAS", title: "Who owns Ukrainian media?" },
      crh: { label: "Leyhalarımız", brand: "MEDİYA ATLASI", title }
    }, lang);
    return `<aside class="project-promo-slot" data-ad-slot="home-mosaic" aria-label="${escapeHtml(labels.label)}">
      <a class="project-promo atlas-display-ad" href="${escapeHtml(href)}">
        <span class="atlas-ad-eyebrow">${escapeHtml(labels.label)} <span>↗</span></span>
        <span class="atlas-ad-brand">${escapeHtml(labels.brand)}</span>
        <svg class="atlas-ad-network" viewBox="0 0 140 150" fill="none" aria-hidden="true" focusable="false">
          <g stroke="#ffac33" stroke-width="1.5" opacity=".65"><path d="M76 72 18 24M76 72 126 18M76 72 122 124M76 72 20 132M76 72 16 76"/></g>
          <g fill="#17166c" stroke="#ffac33" stroke-width="2"><circle cx="18" cy="24" r="12"/><circle cx="126" cy="18" r="9"/><circle cx="122" cy="124" r="13"/><circle cx="20" cy="132" r="8"/><circle cx="16" cy="76" r="7"/></g>
          <circle cx="76" cy="72" r="23" fill="#ffac33"/>
          <g stroke="#0d0c5c" stroke-width="2"><rect x="64" y="61" width="24" height="19" rx="2"/><path d="M68 66h16M68 71h10M68 76h14"/></g>
        </svg>
        <h2>${escapeHtml(labels.title)}</h2>
        <span class="atlas-ad-action">${escapeHtml(action)} <span>↗</span></span>
      </a>
    </aside>`;
  }
  return `<aside class="project-promo-slot" data-ad-slot="${escapeHtml(placement)}" aria-label="${escapeHtml(copy.label)}">
    <a class="project-promo project-promo--${project}" href="${escapeHtml(href)}">
      <div class="project-promo-copy"><span class="project-promo-label">${escapeHtml(copy.label)}</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div>
      <span class="project-promo-action">${escapeHtml(action)} ↗</span>
    </a>
  </aside>`;
}


function mosaicPromoTemplates(lang) {
  const copy = pick({
    uk: { label: "Наші проєкти", guide: ["РОЗВИТОК СПІЛЬНОТ", "Як об’єднати аудиторію навколо медіа?", "Відкрити посібник"], ratings: ["РЕЙТИНГ ЖУРФАКІВ", "Де навчатися журналістики?", "Переглянути рейтинг"] },
    en: { label: "Our projects", guide: ["COMMUNITY GUIDE", "Build a community around your media", "Explore the guide"], ratings: ["JOURNALISM SCHOOLS", "Where to study journalism?", "Explore the ranking"] },
    crh: { label: "Leyhalarımız", guide: ["CEMAAT REHBERİ", "Mediya etrafında cemaat quruñız", "Rehberni aç"], ratings: ["FAKÜLTELER REYTİNGİ", "Jurnalistikanı qayda ögrenmeli?", "Reytingni aç"] }
  }, lang);
  return ["guide", "ratings"].map(project => {
    const [brand, title, action] = copy[project];
    const href = project === "guide" ? "https://guide.promedia.report/" + (lang === "uk" ? "" : lang + "/") : NETWORK_URLS.ratings[lang];
    const graphic = project === "guide"
      ? '<path d="M22 32Q48 19 70 34Q94 19 120 32V121Q94 108 70 123Q48 108 22 121Z"/><path d="M70 34V123M33 47L56 45M33 59L56 57M84 45L108 47M84 57L108 59"/>'
      : '<path d="M22 128H126M30 128V88H51V128M65 128V60H86V128M100 128V29H121V128"/><path d="M24 62L62 35L82 43L119 10"/>';
    return `<template data-mosaic-promo-template><div class="mosaic-cell mosaic-cell--promo">
      <aside class="project-promo-slot" data-ad-slot="home-mosaic-${project}" aria-label="${escapeHtml(copy.label)}">
        <a class="project-promo atlas-display-ad display-ad--${project}" href="${escapeHtml(href)}">
          <span class="atlas-ad-eyebrow">${escapeHtml(copy.label)} <span>↗</span></span>
          <span class="atlas-ad-brand">${escapeHtml(brand)}</span>
          <svg class="atlas-ad-network" viewBox="0 0 140 150" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true" focusable="false">${graphic}</svg>
          <h2>${escapeHtml(title)}</h2>
          <span class="atlas-ad-action">${escapeHtml(action)} <span>↗</span></span>
        </a>
      </aside>
    </div></template>`;
  }).join("");
}

export function renderHomepage({ articles, lang, activeTag, activeTopic, baseUrl }) {
  const copy = pick(PRACTICE_COPY, lang);
  const prefix = langPrefix(lang);
  const topic = PRACTICE_TOPICS.find(item => item.id === activeTopic);
  const filtered = Boolean(activeTag || topic);
  const heading = (title, href, label) => `<div class="practice-heading"><h2>${escapeHtml(title)}</h2>${href ? `<a href="${escapeHtml(href)}">${escapeHtml(label || copy.all)} ↗</a>` : ""}</div>`;
  let list = `<p class="empty-state">${pick(NO_ARTICLES_LABEL, lang)}</p>`;
  if (articles.length && filtered) {
    list = heading(topic ? pick(topic.labels, lang) : tagLabel(activeTag, lang), `${prefix}/`) + `<div class="practice-stream">${articles.map(a => articleCard(a, lang, baseUrl, "visual")).join("")}</div>`;
  } else if (articles.length) {
    const featured = articles.filter(a => a.card_style === "hero");
    const hero = featured.length ? featured.reduce((latest, article) => (article.published_at || "") > (latest.published_at || "") ? article : latest) : articles[0];
    const remaining = articles.filter(a => a.slug !== hero.slug);
    const cells = remaining.map((a, i) => `<div class="mosaic-cell">${articleCard(a, lang, baseUrl, articleCardVariant(a, i % 4 === 2 ? "text" : "visual"))}</div>`);
    cells.splice(Math.min(2, cells.length), 0, `<div class="mosaic-cell mosaic-cell--promo">${projectPromo(lang, "atlas", "home-mosaic")}</div>`);
    list = `<section class="magazine-lead" aria-label="${escapeHtml(pick(TOP_STORIES_ARIA, lang))}">${articleCard(hero, lang, baseUrl, "hero")}</section>
      <div class="article-grid restored-feed">${cells.join("")}</div>`;

  }
  const bodyHtml = `<main class="wrap practice-home magazine-home">
    ${list}
  </main>${!filtered && articles.length ? mosaicPromoTemplates(lang) : ""}<script defer src="/js/promedia-mosaic.js"></script>`;
  return pageShell({ title: `${filtered ? (topic ? pick(topic.labels, lang) : tagLabel(activeTag, lang)) : copy.title} — ПроМедіа`, description: copy.intro,
    url: `${baseUrl}${prefix}/${activeTag ? `?tag=${encodeURIComponent(activeTag)}` : topic ? `?topic=${topic.id}` : ""}`, lang, bodyHtml });
}

const BACK_TO_NEWS_LABEL = { uk: "← Усі новини", en: "← All news", crh: "← Episi haberler" };
const ABOUT_LABEL = { uk: "Про кого:", en: "About:", crh: "Kimler aqqında:" };

export function renderArticlePage({ article, lang, baseUrl, relatedMediaNames }) {
  const title = articleTitle(article, lang);
  const excerpt = articleExcerpt(article, lang);
  const articleUrl = `${baseUrl}${langPrefix(lang)}/article/${article.slug}`;
  const bodyMd = localizedField(article, "body_md", lang);
  const bodyHtmlContent = markdownToHtml(bodyMd);
  const tags = JSON.parse(article.tags || "[]");
  const coverUrl = articleCover(article, lang);
  const cover = coverUrl
    ? `<img class="article-cover" src="${escapeHtml(coverUrl)}" alt="${escapeHtml(articleCoverAlt(article, lang, title))}"${articleFocalStyle(article, lang, "desktop")} />`
    : "";
  const mediaLinksHtml = relatedMediaNames.length
    ? `<div class="article-related-media">
        <span>${pick(ABOUT_LABEL, lang)}</span>
        ${relatedMediaNames.map((m) => `<a href="${escapeHtml(m.url || `https://communities.promedia.report${langPrefix(lang)}/media/?id=${encodeURIComponent(m.id)}`)}">${escapeHtml(m.name)}</a>`).join(", ")}
      </div>`
    : "";
  const bodyHtml = `
<main class="wrap article-page">
  <p class="article-back"><a href="${langPrefix(lang)}/">${pick(BACK_TO_NEWS_LABEL, lang)}</a></p>
  ${tags.length ? `<div class="article-tags">${tags.map((tg) => `<a class="article-tag" href="${langPrefix(lang)}/?tag=${encodeURIComponent(tg)}">${escapeHtml(tagLabel(tg, lang))}</a>`).join("")}</div>` : ""}
  <h1>${escapeHtml(title)}</h1>
  ${articleMeta(article, lang)}
  ${articleShareBlock({ title, excerpt, articleUrl, lang })}
  ${cover}
  <div class="article-body">${bodyHtmlContent}</div>
  ${mediaLinksHtml}
  ${projectPromo(lang, "atlas", "article-bottom")}
</main>`;
  return pageShell({
    title: `${title} — ${pick(SITE_NAME, lang)}`,
    description: excerpt,
    url: articleUrl,
    ogImage: coverUrl || undefined,
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
  <p><a href="${langPrefix(lang)}/">${pick(BACK_TO_NEWS_LABEL, lang)}</a></p>
</main>`;
  return pageShell({
    title: pick(SITE_NAME, lang),
    description: pick(SITE_TAGLINE, lang),
    url: `${baseUrl}${langPrefix(lang)}/`,
    lang,
    bodyHtml
  });
}
