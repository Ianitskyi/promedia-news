import { markdownToHtml, markdownToPlainText } from "./markdown.js";

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function langPrefix(lang) {
  return lang === "en" ? "/en" : "";
}

function field(project, name, lang) {
  if (lang === "en") return project[name + "_en"] || project[name] || "";
  return project[name] || "";
}

function fmtDate(value, lang) {
  if (!value) return "";
  const d = new Date(value + (value.length === 10 ? "T00:00:00Z" : ""));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(lang === "en" ? "en-GB" : "uk-UA", { year: "numeric", month: "long", day: "numeric" });
}

const LABELS = {
  uk: {
    eyebrow: "Проєкти ПроМедіа", title: "Наші проєкти", active: "Триває", completed: "Завершено",
    upcoming: "Заплановано", partner: "Партнер", donor: "Донор", dates: "Період",
    more: "Докладніше", back: "← Усі проєкти", empty: "Проєктів поки немає."
  },
  en: {
    eyebrow: "ProMedia projects", title: "Our projects", active: "Active", completed: "Completed",
    upcoming: "Upcoming", partner: "Partner", donor: "Donor", dates: "Period",
    more: "Learn more", back: "← All projects", empty: "No projects yet."
  }
};

function shell({ lang, title, description, canonical, body }) {
  const l = LABELS[lang] || LABELS.uk;
  const main = lang === "en" ? "https://promedia.report/en" : "https://promedia.report";
  const news = lang === "en" ? "https://news.promedia.report/en/" : "https://news.promedia.report/";
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${esc(canonical)}" />
<link rel="stylesheet" href="/css/style.css" />
</head>
<body>
<nav class="utility-bar">
  <a class="home-btn" href="${main}">← ProMedia</a>
  <a class="nav-link" href="${news}">${lang === "en" ? "News" : "Новини"}</a>
  <span class="lang-toggle" style="margin-left:auto">
    <a class="lang-btn${lang === "uk" ? " active" : ""}" href="${canonical.replace("/en/", "/").replace("projects.promedia.report/en", "projects.promedia.report")}">UA</a>
    <a class="lang-btn${lang === "en" ? " active" : ""}" href="${canonical.includes("/en/") ? canonical : canonical.replace("projects.promedia.report/", "projects.promedia.report/en/")}">EN</a>
  </span>
</nav>
${body}
<footer class="site-footer">
  <div class="site-footer-heading"><a href="${main}">ProMedia</a><h2>${l.eyebrow}</h2></div>
  <a class="site-footer-correction" href="mailto:info@promedia.report">info@promedia.report</a>
</footer>
</body>
</html>`;
}

function statusLabel(project, lang) {
  const l = LABELS[lang] || LABELS.uk;
  return l[project.project_status] || project.project_status || "";
}

function projectCard(project, lang, baseUrl) {
  const title = field(project, "title", lang);
  const excerpt = field(project, "excerpt", lang) || markdownToPlainText(field(project, "body_md", lang), 220);
  const href = `${baseUrl}${langPrefix(lang)}/project/${esc(project.slug)}`;
  return `<article class="article-card article-card--visual">
    ${project.cover_image_url ? `<a class="article-card-media" href="${href}"><img class="article-card-img" src="${esc(project.cover_image_url)}" alt="${esc(title)}" loading="lazy" /></a>` : ""}
    <div class="article-card-body">
      <div class="article-tags"><span class="article-tag">${esc(statusLabel(project, lang))}</span></div>
      <h3><a href="${href}">${esc(title)}</a></h3>
      <p class="article-excerpt">${esc(excerpt)}</p>
      <p><a href="${href}">${LABELS[lang].more} →</a></p>
    </div>
  </article>`;
}

export function renderProjectsHomepage({ projects, lang, baseUrl }) {
  const l = LABELS[lang] || LABELS.uk;
  const body = `<section class="hero"><div class="eyebrow">${l.eyebrow}</div><h1>${l.title}</h1></section>
<main class="wrap">
  ${projects.length ? `<div class="article-grid">${projects.map((p) => projectCard(p, lang, baseUrl)).join("")}</div>` : `<p class="empty-state">${l.empty}</p>`}
</main>`;
  return shell({ lang, title: `${l.title} — ProMedia`, description: l.eyebrow, canonical: `${baseUrl}${langPrefix(lang)}/`, body });
}

export function renderProjectPage({ project, lang, baseUrl }) {
  const l = LABELS[lang] || LABELS.uk;
  const title = field(project, "title", lang);
  const excerpt = field(project, "excerpt", lang) || markdownToPlainText(field(project, "body_md", lang), 220);
  const meta = [];
  if (project.partner || project.partner_en) meta.push(`<div><strong>${l.partner}:</strong> ${esc(field(project, "partner", lang))}</div>`);
  if (project.donor || project.donor_en) meta.push(`<div><strong>${l.donor}:</strong> ${esc(field(project, "donor", lang))}</div>`);
  if (project.start_date || project.end_date) meta.push(`<div><strong>${l.dates}:</strong> ${esc(fmtDate(project.start_date, lang))}${project.end_date ? " — " + esc(fmtDate(project.end_date, lang)) : ""}</div>`);
  const canonical = `${baseUrl}${langPrefix(lang)}/project/${project.slug}`;
  const body = `<main class="wrap article-page">
    <p class="article-back"><a href="${langPrefix(lang)}/">${l.back}</a></p>
    <div class="article-tags"><span class="article-tag">${esc(statusLabel(project, lang))}</span></div>
    <h1>${esc(title)}</h1>
    <p class="article-excerpt">${esc(excerpt)}</p>
    ${project.cover_image_url ? `<img class="article-cover" src="${esc(project.cover_image_url)}" alt="${esc(title)}" />` : ""}
    ${meta.length ? `<div class="admin-card" style="margin:24px 0">${meta.join("")}</div>` : ""}
    <div class="article-body">${markdownToHtml(field(project, "body_md", lang))}</div>
    ${project.website_url ? `<p><a class="admin-btn" href="${esc(project.website_url)}" target="_blank" rel="noopener">${l.more}</a></p>` : ""}
  </main>`;
  return shell({ lang, title: `${title} — ProMedia`, description: excerpt, canonical, body });
}
