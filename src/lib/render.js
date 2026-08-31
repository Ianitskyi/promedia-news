import { escapeHtml, markdownToHtml, markdownToPlainText } from "./markdown.js";

const SITE_NAME = { uk: "Новини ПроМедіа", en: "ProMedia News" };
const SITE_TAGLINE = {
  uk: "Заяви від ГО «ПроМедіа», а також новини зі світу медіа, громадських організацій та комунікацій.",
  en: "Public statements, press releases and important updates from ProMedia NGO, along with news about communities, education, research and people working in media, civil society and communications."
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
    ? { projects: "Projects", services: "What we do", about: "About us", contacts: "Contacts", news: "News", communities: "Media communities", ratings: "Journalism schools ranking", research: "Research", menu: "Open menu" }
    : { projects: "Проєкти", services: "Що ми робимо", about: "Про нас", contacts: "Контакти", news: "Новини", communities: "Карта спільнот", ratings: "Рейтинг журфаків", research: "Дослідження", menu: "Відкрити меню" };
  const mainBase = lang === "en" ? "https://promedia.report/en" : "https://promedia.report";
  const navLinks = `
    <a href="${mainBase}/projects">${t.projects}</a>
    <a href="${mainBase}/#services">${t.services}</a>
    <a href="${mainBase}/#team">${t.about}</a>
    <a href="${mainBase}/#contacts">${t.contacts}</a>
    <a class="active" href="/${lang === "en" ? "?lang=en" : ""}">${t.news}</a>`;
  return `
<header class="org-header">
  <div class="org-header-shell">
    <div class="org-header-main">
      <a class="org-logo" href="${mainBase}" aria-label="ProMedia">
        <img src="/img/promedia-wordmark.svg" alt="ProMedia" />
      </a>
      <nav class="org-primary-nav" aria-label="${lang === "en" ? "Main navigation" : "Головна навігація"}">${navLinks}</nav>
      <div class="org-lang-select" aria-label="Language">
        <a class="${lang === "uk" ? "active" : ""}" href="?lang=uk">UA</a>
        <a class="${lang === "en" ? "active" : ""}" href="?lang=en">EN</a>
      </div>
      <details class="org-mobile-menu">
        <summary aria-label="${t.menu}"><span></span><span></span><span></span></summary>
        <div class="org-mobile-panel">${navLinks}
          <a href="https://communities.promedia.report/?lang=${lang}">${t.communities}</a>
          <a href="https://ratings.promedia.report/?lang=${lang}">${t.ratings}</a>
          <a href="https://research.promedia.report/?lang=${lang}">${t.research}</a>
        </div>
      </details>
    </div>
    <nav class="org-subnav" aria-label="${lang === "en" ? "Additional ProMedia links" : "Додаткові посилання ПроМедіа"}">
      <a href="https://communities.promedia.report/?lang=${lang}">${t.communities}</a>
      <a href="https://ratings.promedia.report/?lang=${lang}">${t.ratings}</a>
      <a href="https://research.promedia.report/?lang=${lang}">${t.research}</a>
    </nav>
  </div>
</header>`;
}

function footer(lang) {
  const t = lang === "en"
    ? {
        projects: "Projects", services: "What we do", about: "About us", contacts: "Contacts", news: "News",
        communities: "Media communities", ratings: "Journalism schools ranking", research: "Research",
        details: "Organization details", official: "Official name:", officialValue: "ProMedia NGO",
        registration: "Registration number:", address: "Registered address:", addressValue: "19/44 Volodymyra Samiilenka St., Kyiv, Ukraine, 03118",
        chair: "Chair of the Board:", chairValue: "Andrii Ianitskyi", email: "Contact email:", social: "Social media:",
        partnersKicker: "Community", partners: "Partners and donors", partnersText: "We work with organizations that support independent media, quality communications and resilient communities.",
        privacy: "Privacy & cookies", rights: "All rights reserved"
      }
    : {
        projects: "Проєкти", services: "Що ми робимо", about: "Про нас", contacts: "Контакти", news: "Новини",
        communities: "Карта спільнот", ratings: "Рейтинг журфаків", research: "Дослідження",
        details: "Дані про організацію", official: "Офіційна назва:", officialValue: "ГО «ПроМедіа»",
        registration: "Реєстраційний номер:", address: "Юридична адреса:", addressValue: "вул. Володимира Самійленка 19/44, Київ, Україна, 03118",
        chair: "Голова правління:", chairValue: "Андрій Яніцький", email: "Контактна електронна пошта:", social: "Соціальні мережі:",
        partnersKicker: "Спільнота", partners: "Партнери та донори", partnersText: "Співпрацюємо з організаціями, які підтримують незалежні медіа, якісну комунікацію та стійкість громад.",
        privacy: "Приватність і cookie", rights: "Усі права захищені"
      };
  const mainBase = lang === "en" ? "https://promedia.report/en" : "https://promedia.report";
  return `
<footer class="org-footer">
  <div class="org-footer-inner">
    <div class="org-footer-top">
      <a class="org-footer-logo" href="${mainBase}"><img src="https://promedia.report/storage/app/media/logo-footer.svg" alt="ProMedia" /></a>
      <div class="org-footer-contacts">
        <a href="tel:+380506959537">+38 (050) 695 95 37</a>
        <a href="mailto:info@promedia.report">info@promedia.report</a>
        <div class="org-socials">
          <a href="https://www.youtube.com/@prostirmedia" target="_blank" rel="noopener">YouTube</a>
          <a href="https://www.instagram.com/promediaua/" target="_blank" rel="noopener">Instagram</a>
          <a href="https://www.linkedin.com/company/promediaukraine" target="_blank" rel="noopener">LinkedIn</a>
          <a href="https://www.facebook.com/promediaukraine" target="_blank" rel="noopener">Facebook</a>
        </div>
      </div>
      <nav class="org-footer-nav" aria-label="Footer">
        <a href="${mainBase}/projects">${t.projects}</a><a href="${mainBase}/#services">${t.services}</a>
        <a href="${mainBase}/#team">${t.about}</a><a href="${mainBase}/#contacts">${t.contacts}</a>
        <a href="/${lang === "en" ? "?lang=en" : ""}">${t.news}</a><a href="https://communities.promedia.report/?lang=${lang}">${t.communities}</a>
        <a href="https://ratings.promedia.report/?lang=${lang}">${t.ratings}</a><a href="https://research.promedia.report/?lang=${lang}">${t.research}</a>
      </nav>
    </div>
    <section class="org-details" aria-labelledby="org-details-title">
      <h2 id="org-details-title">${t.details}</h2>
      <dl>
        <div><dt>${t.official}</dt><dd>${t.officialValue}</dd></div>
        <div><dt>${t.registration}</dt><dd>45995408</dd></div>
        <div><dt>${t.address}</dt><dd>${t.addressValue}</dd></div>
        <div><dt>${t.chair}</dt><dd>${t.chairValue}</dd></div>
        <div><dt>${t.email}</dt><dd><a href="mailto:info@promedia.report">info@promedia.report</a></dd></div>
        <div><dt>${t.social}</dt><dd><a href="https://www.instagram.com/promediaua/">Instagram</a> · <a href="https://www.facebook.com/promediaukraine">Facebook</a> · <a href="https://www.linkedin.com/company/promediaukraine/">LinkedIn</a> · <a href="https://www.youtube.com/@prostirmedia">YouTube</a></dd></div>
      </dl>
    </section>
    <section class="org-partners" aria-labelledby="org-partners-title">
      <p>${t.partnersKicker}</p><h2 id="org-partners-title">${t.partners}</h2><div class="org-partners-rule"></div>
      <p class="org-partners-text">${t.partnersText}</p>
      <div class="org-partners-grid">
        <a href="https://iwpr.net/" target="_blank" rel="noopener"><img src="https://promedia.report/storage/app/media/partners/iwpr-logo-800x320.png" alt="IWPR" loading="lazy" /></a>
        <span><img src="https://promedia.report/storage/app/media/partners/nda-confidential-partner-800x320.png" alt="Confidential partner" loading="lazy" /></span>
        <a href="https://irrp.org.ua/about-rpdi-eng/" target="_blank" rel="noopener"><img src="https://promedia.report/storage/app/media/partners/Dark%20Vert%20Block%20Full.png" alt="RPDI" loading="lazy" /></a>
        <a href="https://recovery.win/" target="_blank" rel="noopener" class="org-partner-text">Recovery Window</a>
        <a href="https://nsju.org/" target="_blank" rel="noopener"><img src="https://promedia.report/storage/app/media/partners/images.png" alt="НСЖУ" loading="lazy" /></a>
        <a href="https://lvivmediaforum.com/" target="_blank" rel="noopener"><img src="https://promedia.report/storage/app/media/partners/LMF.png" alt="Lviv Media Forum" loading="lazy" /></a>
        <a href="https://gongadzeprize.com.ua/" target="_blank" rel="noopener"><img src="https://promedia.report/storage/app/media/partners/%D0%BB%D0%BE%D0%B3%D0%BE%20%D0%B0%D0%BD%D0%B3.png" alt="Gongadze Prize" loading="lazy" /></a>
      </div>
    </section>
    <div class="org-copyright"><span>© 2025–2026 ProMedia. ${t.rights}</span><a href="${mainBase}/privacy-policy">${t.privacy}</a></div>
  </div>
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

function articleCardVariant(article, automaticVariant) {
  const style = article.card_style || "auto";
  if (style === "image") return "visual";
  if (style === "text" || style === "hero") return style;
  return automaticVariant;
}

export function renderHomepage({ articles, lang, activeTag, baseUrl }) {
  const t = lang === "en" ? SITE_NAME.en : SITE_NAME.uk;
  const tagline = SITE_TAGLINE[lang];
  let list = `<p class="empty-state">${lang === "en" ? "No articles yet." : "Статей поки немає."}</p>`;
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
          <h2>${lang === "en" ? "Latest news" : "Останні новини"}</h2>
          <span>${String(stream.length).padStart(2, "0")}</span>
        </div>
        <div class="article-grid">
          ${stream.map((article, index) => articleCard(article, lang, baseUrl, articleCardVariant(article, index % 4 === 2 ? "text" : "visual"))).join("")}
        </div>`
      : "";
    list = `<section class="news-lead${leadSide ? " news-lead--with-side" : ""}" aria-label="${lang === "en" ? "Top stories" : "Головні новини"}">
        ${articleCard(lead[0], lang, baseUrl, articleCardVariant(lead[0], "hero"))}
        ${leadSide}
      </section>
      ${streamHtml}`;
  }
  const bodyHtml = `
<section class="hero">
  <div class="eyebrow">${escapeHtml(SITE_EYEBROW[lang])}</div>
  <h1>${lang === "en" ? "News from <span>ProMedia</span>" : "Новини від <span>ProMedia</span>"}</h1>
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
