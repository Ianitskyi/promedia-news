import { escapeHtml, markdownToHtml, markdownToPlainText } from "./markdown.js";

const SITE_NAME = { uk: "Новини ПроМедіа", en: "ProMedia News" };
const SITE_TAGLINE = {
  uk: "Спільноти, інновації, навчання, гранти, вакансії, дослідження, регулювання, гроші та люди в медіа та комунікаціях.",
  en: "Communities, innovation, education, grants, jobs, research, regulation, money and people in media and communications."
};
const SITE_EYEBROW = {
  uk: "Про журналістику та громадський активізм в Україні",
  en: "About journalism and civic activism in Ukraine"
};
const CATEGORIES = ["Заяви", "Новини", "Статті"];
const DEFAULT_OG_IMAGE = "https://news.promedia.report/img/og-share.png";

function baseHead({ title, description, url, ogImage, lang }) {
  const altLang = lang === "en" ? "uk" : "en";
  return `
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${escapeHtml(SITE_NAME[lang])}" />
<meta property="og:url" content="${escapeHtml(url)}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${escapeHtml(ogImage || DEFAULT_OG_IMAGE)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(ogImage || DEFAULT_OG_IMAGE)}" />
<link rel="alternate" hreflang="uk" href="${escapeHtml(url.replace(/([?&])lang=en&?/, "$1").replace(/[?&]$/, ""))}" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="stylesheet" href="/css/style.css" />
<!-- lang alt: ${escapeHtml(altLang)} -->`;
}

function header(lang) {
  const t = lang === "en"
    ? { home: "← ProMedia", news: SITE_NAME.en, communities: "Media communities", uk: "UA", en: "EN" }
    : { home: "← ПроМедіа", news: SITE_NAME.uk, communities: "Медіаспільноти", uk: "UA", en: "EN" };
  const other = lang === "en" ? "?lang=uk" : "?lang=en";
  return `
<div class="utility-bar">
  <a class="home-btn" href="https://promedia.report">${t.home}</a>
  <a class="nav-link" href="/">${escapeHtml(t.news)}</a>
  <a class="nav-link" href="https://communities.promedia.report/?lang=${lang}">${escapeHtml(t.communities)}</a>
  <div class="lang-toggle">
    <a class="lang-btn${lang === "uk" ? " active" : ""}" href="?lang=uk">UA</a>
    <a class="lang-btn${lang === "en" ? " active" : ""}" href="?lang=en">EN</a>
  </div>
</div>`;
}

function footer(lang) {
  const t = lang === "en"
    ? { initiative: "An initiative by", report: "Spotted an error? Email" }
    : { initiative: "Ініціатива", report: "Побачили помилку? Напишіть на" };
  return `
<footer class="site-footer">
  <a class="footer-brand" href="https://promedia.report" target="_blank" rel="noopener">
    <span>${escapeHtml(t.initiative)}</span>
    <img src="/img/promedia-wordmark.svg" alt="ГО «ПроМедіа»" class="footer-logo" />
  </a>
  <p>${escapeHtml(t.report)} <a href="mailto:info@promedia.report">info@promedia.report</a></p>
</footer>`;
}

function pageShell({ title, description, url, ogImage, lang, bodyHtml }) {
  return `<!doctype html>
<html lang="${lang}">
<head>
${baseHead({ title, description, url, ogImage, lang })}
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
</body>
</html>`;
}

function formatDate(dateStr, lang) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString(lang === "en" ? "en-GB" : "uk-UA", { year: "numeric", month: "long", day: "numeric" });
}

function articleTitle(article, lang) {
  return (lang === "en" && article.title_en) ? article.title_en : article.title;
}
function articleExcerpt(article, lang) {
  const raw = (lang === "en" && article.excerpt_en) ? article.excerpt_en : article.excerpt;
  return raw || markdownToPlainText(lang === "en" && article.body_md_en ? article.body_md_en : article.body_md, 200);
}

function categoryNav(lang, activeTag) {
  const labels = lang === "en"
    ? { all: "All", "Заяви": "Statements", "Новини": "News", "Статті": "Articles" }
    : { all: "Усі", "Заяви": "Заяви", "Новини": "Новини", "Статті": "Статті" };
  const allHref = lang === "en" ? "/?lang=en" : "/";
  const items = [
    `<a class="category-link${!activeTag ? " active" : ""}" href="${allHref}">${labels.all}</a>`,
    ...CATEGORIES.map((category) => {
      const query = `?tag=${encodeURIComponent(category)}${lang === "en" ? "&lang=en" : ""}`;
      return `<a class="category-link${activeTag === category ? " active" : ""}" href="/${query}">${labels[category]}</a>`;
    })
  ];
  return `<nav class="category-nav" aria-label="${lang === "en" ? "News categories" : "Рубрики новин"}">${items.join("")}</nav>`;
}

function articleCard(article, lang, baseUrl, variant) {
  const title = articleTitle(article, lang);
  const excerpt = articleExcerpt(article, lang);
  const tags = JSON.parse(article.tags || "[]");
  const cardVariant = variant || "visual";
  const showCover = cardVariant !== "text" && article.cover_image_url;
  const cover = showCover
    ? `<a class="article-card-media" href="${baseUrl}/article/${escapeHtml(article.slug)}${lang === "en" ? "?lang=en" : ""}">
        <img class="article-card-img" src="${escapeHtml(article.cover_image_url)}" alt="" loading="${cardVariant === "hero" ? "eager" : "lazy"}" />
      </a>`
    : "";
  const langQ = lang === "en" ? "?lang=en" : "";
  return `
<article class="article-card article-card--${cardVariant}">
  ${cover}
  <div class="article-card-body">
    ${cardVariant === "hero" ? `<span class="lead-label">${lang === "en" ? "Top story" : "Головна новина"}</span>` : ""}
    ${tags.length ? `<div class="article-tags">${tags.map((t) => `<span class="article-tag">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
    <h3><a href="${baseUrl}/article/${escapeHtml(article.slug)}${langQ}">${escapeHtml(title)}</a></h3>
    <p class="article-excerpt">${escapeHtml(excerpt)}</p>
    <p class="article-date">${escapeHtml(formatDate(article.published_at, lang))}</p>
  </div>
</article>`;
}

export function renderHomepage({ articles, lang, activeTag, baseUrl }) {
  const t = lang === "en" ? SITE_NAME.en : SITE_NAME.uk;
  const tagline = SITE_TAGLINE[lang];
  let list = `<p class="empty-state">${lang === "en" ? "No articles yet." : "Статей поки немає."}</p>`;
  if (articles.length) {
    const lead = articles.slice(0, 3);
    const stream = articles.slice(3);
    const leadSide = lead.slice(1).length
      ? `<div class="news-lead-side">
          ${lead[1] ? articleCard(lead[1], lang, baseUrl, "visual") : ""}
          ${lead[2] ? articleCard(lead[2], lang, baseUrl, "text") : ""}
        </div>`
      : "";
    const streamHtml = stream.length
      ? `<div class="news-section-heading">
          <h2>${lang === "en" ? "Latest news" : "Останні новини"}</h2>
          <span>${String(stream.length).padStart(2, "0")}</span>
        </div>
        <div class="article-grid">
          ${stream.map((article, index) => articleCard(article, lang, baseUrl, index % 4 === 2 ? "text" : "visual")).join("")}
        </div>`
      : "";
    list = `<section class="news-lead${leadSide ? " news-lead--with-side" : ""}" aria-label="${lang === "en" ? "Top stories" : "Головні новини"}">
        ${articleCard(lead[0], lang, baseUrl, "hero")}
        ${leadSide}
      </section>
      ${streamHtml}`;
  }
  const bodyHtml = `
<section class="hero">
  <div class="eyebrow">${escapeHtml(SITE_EYEBROW[lang])}</div>
  <h1>${lang === "en" ? "ProMedia News" : "Новини <span>ProMedia</span>"}</h1>
  <p class="lede">${escapeHtml(tagline)}</p>
  ${categoryNav(lang, activeTag)}
</section>
<main class="wrap">
${list}
</main>`;
  return pageShell({
    title: `${t} — ${SITE_TAGLINE[lang]}`,
    description: SITE_TAGLINE[lang],
    url: `${baseUrl}/${lang === "en" ? "?lang=en" : ""}`,
    lang,
    bodyHtml
  });
}

export function renderArticlePage({ article, lang, baseUrl, relatedMediaNames }) {
  const title = articleTitle(article, lang);
  const excerpt = articleExcerpt(article, lang);
  const bodyMd = (lang === "en" && article.body_md_en) ? article.body_md_en : article.body_md;
  const bodyHtmlContent = markdownToHtml(bodyMd);
  const tags = JSON.parse(article.tags || "[]");
  const cover = article.cover_image_url
    ? `<img class="article-cover" src="${escapeHtml(article.cover_image_url)}" alt="" />`
    : "";
  const mediaLinksHtml = relatedMediaNames.length
    ? `<div class="article-related-media">
        <span>${lang === "en" ? "About:" : "Про кого:"}</span>
        ${relatedMediaNames.map((m) => `<a href="https://communities.promedia.report/media/?id=${encodeURIComponent(m.id)}&lang=${lang}">${escapeHtml(m.name)}</a>`).join(", ")}
      </div>`
    : "";
  const bodyHtml = `
<main class="wrap article-page">
  <p class="article-back"><a href="/${lang === "en" ? "?lang=en" : ""}">${lang === "en" ? "← All news" : "← Усі новини"}</a></p>
  ${tags.length ? `<div class="article-tags">${tags.map((tg) => `<a class="article-tag" href="/?tag=${encodeURIComponent(tg)}${lang === "en" ? "&lang=en" : ""}">${escapeHtml(tg)}</a>`).join("")}</div>` : ""}
  <h1>${escapeHtml(title)}</h1>
  <p class="article-date">${escapeHtml(formatDate(article.published_at, lang))}</p>
  ${cover}
  <div class="article-body">${bodyHtmlContent}</div>
  ${mediaLinksHtml}
</main>`;
  return pageShell({
    title: `${title} — ${SITE_NAME[lang]}`,
    description: excerpt,
    url: `${baseUrl}/article/${article.slug}${lang === "en" ? "?lang=en" : ""}`,
    ogImage: article.cover_image_url || undefined,
    lang,
    bodyHtml
  });
}

export function renderNotFound(lang, baseUrl) {
  const bodyHtml = `
<main class="wrap">
  <p class="empty-state">${lang === "en" ? "Page not found." : "Сторінку не знайдено."}</p>
  <p><a href="/${lang === "en" ? "?lang=en" : ""}">${lang === "en" ? "← All news" : "← Усі новини"}</a></p>
</main>`;
  return pageShell({
    title: SITE_NAME[lang],
    description: SITE_TAGLINE[lang],
    url: `${baseUrl}/`,
    lang,
    bodyHtml
  });
}
