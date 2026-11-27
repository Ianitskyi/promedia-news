import { renderHomepage, renderArticlePage, renderNewsletterPage, renderNotFound, renderArchivePage, ARCHIVE_PAGE_SIZE, PRACTICE_TOPICS, viewsVisible } from "../lib/render.js";
import { handlePublicPushRoute } from "../lib/push.js";
import { ukrainianTypographyReplacer } from "../lib/typography.js";
import { pinActiveSql, pinnedAtSelectSql } from "../lib/pinning.js";

// Мова — перший сегмент шляху: /en/…, /crh/…, /de/… (uk — без префікса).
// Німецькою (/de/) показуємо лише вже перекладені матеріали: переклад робить ШІ через 2 години після останньої правки.
const DE_READY = " AND title_de IS NOT NULL AND title_de != ''";

const POPULAR_TTL_MS = 10 * 60 * 1000;
const popularMemo = new Map();

async function popularList(db, lang) {
  const key = lang === "de" ? "de" : "all";
  const hit = popularMemo.get(key);
  if (hit && Date.now() - hit.at < POPULAR_TTL_MS) return hit.list;
  try {
    const { results } = await db.prepare(
      "SELECT id, slug, title, title_en, title_crh, title_de FROM articles LEFT JOIN article_views av ON av.article_id = articles.id WHERE status = 'published' AND deleted_at IS NULL" + (key === "de" ? DE_READY : "") + " AND published_at >= datetime('now', '-30 days') ORDER BY COALESCE(av.ga4_views, 0) DESC, published_at DESC LIMIT 11"
    ).all();
    const list = results || [];
    popularMemo.set(key, { at: Date.now(), list });
    return list;
  } catch (_) {
    return hit ? hit.list : [];
  }
}
const LANG_PATH = /^\/(en|crh|de)(?=\/|$)/;

function getLang(url) {
  const m = url.pathname.match(LANG_PATH);
  return m ? m[1] : "uk";
}

function stripLangPrefix(pathname) {
  return pathname.replace(LANG_PATH, "") || "/";
}

// Старі адреси з ?lang=en|crh|uk (поширені в соцмережах, розсилках і пушах)
// переадресовуємо назавжди на шлях із мовним префіксом.
function legacyLangRedirect(url) {
  const lang = url.searchParams.get("lang");
  if (!url.searchParams.has("lang")) return null;
  const target = new URL(url);
  target.searchParams.delete("lang");
  const path = stripLangPrefix(target.pathname);
  const prefix = lang === "en" || lang === "crh" || lang === "de" ? `/${lang}` : "";
  target.pathname = path === "/" && prefix ? `${prefix}/` : prefix + path;
  return Response.redirect(target.toString(), 301);
}

function coverMetadata(data) {
  try { return (typeof data === "string" ? JSON.parse(data) : data) || {}; } catch (_) { return {}; }
}

function coverPosition(meta) {
  // 50/50 — значення адмінки за замовчуванням: кадр не виставлено, лишаємо типове для сайту.
  const point = (p) => p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)) && !(Number(p.x) === 50 && Number(p.y) === 50)
    ? Math.max(0, Math.min(100, Number(p.x))) + "% " + Math.max(0, Math.min(100, Number(p.y))) + "%" : null;
  const desktop = point(meta.desktop) || point(meta.feed);
  const mobile = point(meta.mobile) || desktop;
  return desktop ? { desktop, mobile } : null;
}

function corsJson(data, status) {
  return new Response(JSON.stringify(data, ukrainianTypographyReplacer), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Cache-Control": "public, max-age=60"
    }
  });
}

function html(body) {
  return new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function text(body) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    }
  });
}

function xml(body) {
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    }
  });
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const NEWS_PUBLICATION_NAME = "ПроМедіа";

function sitemapUrl(loc, urls, lastmod) {
  const alternates = Object.entries(urls).map(([l, href]) => `\n  <xhtml:link rel="alternate" hreflang="${l}" href="${escapeXml(href)}" />`).join("");
  return `<url>\n  <loc>${escapeXml(loc)}</loc>${lastmod ? `\n  <lastmod>${escapeXml(lastmod)}</lastmod>` : ""}${alternates}\n  <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(urls.uk)}" />\n</url>`;
}

function sitemapDate(value) {
  const parsed = new Date(value || "");
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

async function loadAsset(env, baseUrl, path, fallback) {
  try {
    const res = await env.ASSETS.fetch(new Request(`${baseUrl}${path}`));
    return res.ok ? await res.json() : fallback;
  } catch { return fallback; }
}

// relatedMediaIds: id медіа з Атласу чи карти спільнот, а також «univ:<id>» — університет
// з рейтингу журфаків (ratings.promedia.report).
async function fetchRelatedMediaNames(allIds, env, baseUrl) {
  const mediaIds = allIds.filter(id => !String(id).startsWith("univ:"));
  if (!mediaIds.length) return [];
  try {
    const [communityRes, atlasRes, sitesRes] = await Promise.allSettled([
      fetch("https://communities.promedia.report/data/communities.json").then(res => res.ok ? res.json() : []),
      env.ASSETS.fetch(new Request(`${baseUrl}/data/atlas-brands.json`)).then(res => res.ok ? res.json() : []),
      env.ASSETS.fetch(new Request(`${baseUrl}/data/media-sites.json`)).then(res => res.ok ? res.json() : {})
    ]);
    const all = communityRes.status === "fulfilled" && Array.isArray(communityRes.value) ? communityRes.value : [];
    const atlas = atlasRes.status === "fulfilled" && Array.isArray(atlasRes.value) ? atlasRes.value : [];
    const sites = sitesRes.status === "fulfilled" && sitesRes.value && typeof sitesRes.value === "object" ? sitesRes.value : {};
    // Одне медіа може бути і в Атласі, і на карті спільнот: Атлас зберігає id спільноти в newsIds.
    return mediaIds.map((id) => {
      const brand = atlas.find(m => m.id === id || (m.newsIds || []).includes(id));
      const linkIds = new Set([id, ...(brand ? [brand.id, ...(brand.newsIds || [])] : [])]);
      const community = all.find((m) => linkIds.has(m.id) && m.status !== "rejected" && !m.example);
      if (!brand && !community) {
        // Українське медіа, якого немає ні в Атласі (не зареєстроване в Нацраді), ні на карті спільнот:
        // картка лише з назвою й сайтом, якщо його вручну додано в public/data/media-sites.json.
        const manual = sites[id];
        const manualSite = typeof manual === "string" ? manual : (manual && manual.site) || "";
        if (manual && manual.name && manualSite) {
          return { id, name: manual.name, city: manual.city || "", website: manualSite, logo: faviconFor(manualSite), manual: true, community: null };
        }
        return { id, name: id };
      }
      // Сайт медіа: з карти спільнот або з ручного довідника public/data/media-sites.json.
      // Значення в media-sites.json — адреса сайту або {"site": "...", "name": "..."}.
      const curated = [...linkIds].map(k => sites[k]).find(Boolean);
      const curatedSite = typeof curated === "string" ? curated : (curated && curated.site) || "";
      const website = (community && community.website) || curatedSite;
      return {
        id,
        // На карті спільнот назва написана по-людськи, в Атласі — як у реєстрі Нацради (часто великими літерами).
        name: (curated && curated.name) || (community && community.name) || readableRegistryName(brand.name),
        city: (brand && brand.city) || "",
        url: brand ? brand.url : undefined,
        atlasUrl: brand ? brand.url : undefined,
        website,
        logo: (community && community.logo) || faviconFor(website),
        community: community || null
      };
    });
  } catch (err) {
    return mediaIds.map((id) => ({ id, name: id }));
  }
}

// Назва з реєстру Нацради: прибираємо опис логотипа («та графічний елемент…») і великі літери.
function readableRegistryName(name) {
  let n = String(name || "").replace(/\s+та\s+графічн.*$/iu, "").trim();
  if (n && n === n.toUpperCase() && /[А-ЯІЇЄҐ]{2}/u.test(n)) {
    n = n.toLowerCase().replace(/(^|[\s«"(-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
  }
  return n || name;
}

function faviconFor(website) {
  try { return website ? `https://www.google.com/s2/favicons?domain=${new URL(website).hostname}&sz=128` : ""; } catch { return ""; }
}

async function fetchRelatedUniversities(allIds, env, baseUrl) {
  const ids = allIds.filter(id => String(id).startsWith("univ:")).map(id => String(id).slice(5));
  if (!ids.length) return [];
  const list = await loadAsset(env, baseUrl, "/data/ratings-universities.json", []);
  return ids.map(id => (Array.isArray(list) ? list : []).find(u => u.id === id)).filter(Boolean);
}

export async function handlePublicRoute(request, env, url) {
  const lang = getLang(url);
  const pagePath = stripLangPrefix(url.pathname);
  const isPage = request.method === "GET" && (pagePath === "/" || /^\/article\/[a-z0-9-]+$/.test(pagePath) || /^\/archive(\/\d+)?\/?$/.test(pagePath));
  if (isPage) {
    const redirect = legacyLangRedirect(url);
    if (redirect) return redirect;
    // /en і /crh без слеша → /en/ і /crh/
    if (lang !== "uk" && url.pathname === `/${lang}`) return Response.redirect(`${url.origin}/${lang}/${url.search}`, 301);
  }
  const baseUrl = `${url.protocol}//${url.host}`;
  const db = env.DB;

  if (url.pathname.startsWith("/api/push/")) {
    const res = await handlePublicPushRoute(request, env, url);
    if (res) return res;
  }

  if (url.pathname === "/robots.txt" && request.method === "GET") {
    return text(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/admin/
Disallow: /api/auth/
Disallow: /api/me
Disallow: /api/setup

Sitemap: ${baseUrl}/sitemap.xml
Sitemap: ${baseUrl}/news-sitemap.xml
`);
  }

  if (url.pathname === "/sitemap.xml" && request.method === "GET") {
    const { results } = await db.prepare(`
      SELECT slug, published_at, updated_at, (title_de IS NOT NULL AND title_de != '') AS has_de
      FROM articles
      WHERE status = 'published' AND deleted_at IS NULL
      ORDER BY published_at DESC
    `).all();
    const forLangs = (path, withDe = true) => ({ uk: `${baseUrl}${path}`, en: `${baseUrl}/en${path}`, crh: `${baseUrl}/crh${path}`, ...(withDe ? { de: `${baseUrl}/de${path}` } : {}) });
    const home = forLangs("/");
    const entries = Object.keys(home).map((l) => sitemapUrl(home[l], home, ""));
    const archive = forLangs("/archive/");
    Object.keys(archive).forEach((l) => entries.push(sitemapUrl(archive[l], archive, "")));
    results.forEach((article) => {
      const urls = forLangs(`/article/${article.slug}`, Boolean(article.has_de));
      const lastmod = sitemapDate(article.updated_at || article.published_at);
      Object.keys(urls).forEach((l) => entries.push(sitemapUrl(urls[l], urls, lastmod)));
    });
    return xml(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join("\n")}
</urlset>
`);
  }


  // Google News sitemap: лише матеріали за останні 48 годин (вимога Google News).
  // Назва видання має збігатися з назвою в Google Publisher Center.
  if (url.pathname === "/news-sitemap.xml" && request.method === "GET") {
    const { results } = await db.prepare(`
      SELECT slug, title, title_en, title_de, published_at
      FROM articles
      WHERE status = 'published' AND deleted_at IS NULL
        AND published_at >= datetime('now', '-2 days')
      ORDER BY published_at DESC
      LIMIT 1000
    `).all();
    const entries = [];
    results.forEach((a) => {
      const date = escapeXml(new Date(a.published_at).toISOString());
      const item = (loc, language, title) => `<url>
  <loc>${escapeXml(loc)}</loc>
  <news:news>
    <news:publication><news:name>${escapeXml(NEWS_PUBLICATION_NAME)}</news:name><news:language>${language}</news:language></news:publication>
    <news:publication_date>${date}</news:publication_date>
    <news:title>${escapeXml(title)}</news:title>
  </news:news>
</url>`;
      entries.push(item(`${baseUrl}/article/${a.slug}`, "uk", a.title));
      if (a.title_en) entries.push(item(`${baseUrl}/en/article/${a.slug}`, "en", a.title_en));
      if (a.title_de) entries.push(item(`${baseUrl}/de/article/${a.slug}`, "de", a.title_de));
    });
    return xml(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${entries.join("\n")}
</urlset>
`);
  }

  // GET /api/articles?tag=&mediaId=&limit=
  if (url.pathname === "/api/articles" && request.method === "GET") {
    const tag = url.searchParams.get("tag");
    const mediaId = url.searchParams.get("mediaId");
    const important = url.searchParams.get("important");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 100);

    let query = "SELECT id, slug, title, title_en, title_crh, title_de, excerpt, excerpt_en, excerpt_crh, excerpt_de, cover_image_url, cover_image_url_en, cover_image_url_crh, cover_crop_data, cover_crop_data_en, cover_crop_data_crh, tags, related_media_ids, is_important, card_style, " + pinnedAtSelectSql() + ", published_at , (length(body_md) - length(replace(body_md, '![', ''))) / 2 AS media_photos, (length(body_md) - length(replace(body_md, '[youtube](', ''))) / 10 AS media_video, instr(body_md, '[audio](') > 0 AS media_audio, av.ga4_views AS view_count, av.synced_at AS views_updated_at FROM articles LEFT JOIN article_views av ON av.article_id = articles.id WHERE status = 'published' AND deleted_at IS NULL";
    const binds = [];
    if (tag) {
      query += " AND EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(tags) THEN tags ELSE '[]' END) AS tag_filter WHERE tag_filter.value = ?)";
      binds.push(tag);
    }
    if (mediaId) {
      query += " AND EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(related_media_ids) THEN related_media_ids ELSE '[]' END) AS media_filter WHERE media_filter.value = ?)";
      binds.push(mediaId);
    }
    if (important === "1" || important === "true") {
      query += " AND is_important = 1";
    }
    // ?before=<published_at> — наступна сторінка стрічки («Показати ще» на мобільному).
    const before = url.searchParams.get("before");
    if (before) {
      query += " AND published_at < ?";
      binds.push(before);
    }
    query += " ORDER BY published_at DESC LIMIT ?";
    binds.push(limit);

    let { results } = await db.prepare(query).bind(...binds).all();
    // ?withHero=1 (promedia.report): add the editor's lead story even if it is older than the list.
    if (url.searchParams.get("withHero") === "1" && !tag && !mediaId && !results.some(a => a.card_style === "hero")) {
      const lead = await db.prepare(query.replace(" WHERE status = 'published'", " WHERE card_style = 'hero' AND status = 'published'").replace(/LIMIT \?$/, "LIMIT 1")).bind(...binds.slice(0, -1)).first();
      if (lead) results = [...results, lead];
    }
    // Закріплена новина (📌) теж потрібна promedia.report, навіть якщо вона старша за список.
    if (url.searchParams.get("withHero") === "1" && !tag && !mediaId && !before && !results.some(a => a.pinned_at)) {
      const pinned = await db.prepare(query.replace(" WHERE status = 'published'", " WHERE " + pinActiveSql() + " AND status = 'published'").replace(/LIMIT \?$/, "LIMIT 1")).bind(...binds.slice(0, -1)).first();
      if (pinned) results = [...results, pinned];
    }
    const items = results.map((a) => ({
      slug: a.slug,
      title: a.title,
      titleEn: a.title_en,
      titleCrh: a.title_crh,
      titleDe: a.title_de,
      excerpt: a.excerpt,
      excerptEn: a.excerpt_en,
      excerptCrh: a.excerpt_crh,
      excerptDe: a.excerpt_de,
      coverImageUrl: a.cover_image_url,
      coverImageUrlEn: a.cover_image_url_en,
      coverImageUrlCrh: a.cover_image_url_crh,
      coverAlt: coverMetadata(a.cover_crop_data).alt || "",
      coverFit: coverMetadata(a.cover_crop_data).fit || "cover",
      coverHideMobile: Boolean(coverMetadata(a.cover_crop_data).hideMobile),
      coverPosition: coverPosition(coverMetadata(a.cover_crop_data)),
      tags: parseJsonArray(a.tags),
      relatedMediaIds: parseJsonArray(a.related_media_ids),
      isImportant: Boolean(a.is_important),
      isPinned: Boolean(a.pinned_at),
      cardStyle: a.card_style || "auto",
      publishedAt: a.published_at,
      viewCount: viewsVisible(a.published_at) ? (a.view_count ?? null) : null,
      viewsUpdatedAt: a.views_updated_at ?? null,
      url: `https://news.promedia.report/article/${a.slug}`
    }));
    return corsJson({ items });
  }

  // A versioned, machine-readable archive of public content. Drafts, accounts,
  // and other private editorial data intentionally remain in D1 only.
  if (url.pathname === "/api/export/published-news.json" && request.method === "GET") {
    const { results } = await db.prepare(`
      SELECT slug, title, title_en, excerpt, excerpt_en, body_md, body_md_en,
        cover_image_url, cover_image_url_en, cover_image_url_crh, cover_crop_data, cover_crop_data_en, cover_crop_data_crh, tags, related_media_ids, is_important, card_style,
        published_at, created_at, updated_at
      FROM articles
      WHERE status = 'published' AND deleted_at IS NULL
      ORDER BY published_at DESC
    `).all();
    return corsJson({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      items: results.map((article) => ({
        slug: article.slug,
        title: article.title,
        titleEn: article.title_en,
        excerpt: article.excerpt,
        excerptEn: article.excerpt_en,
        bodyMd: article.body_md,
        bodyMdEn: article.body_md_en,
        coverImageUrl: article.cover_image_url,
        coverImageUrlEn: article.cover_image_url_en,
        coverImageUrlCrh: article.cover_image_url_crh,
        tags: parseJsonArray(article.tags),
        relatedMediaIds: parseJsonArray(article.related_media_ids),
        isImportant: Boolean(article.is_important),
        cardStyle: article.card_style || "auto",
        publishedAt: article.published_at,
        createdAt: article.created_at,
        updatedAt: article.updated_at
      }))
    });
  }

  // GET /api/articles/:slug
  const apiSlugMatch = url.pathname.match(/^\/api\/articles\/([a-z0-9-]+)$/);
  if (apiSlugMatch && request.method === "GET") {
    const article = await db.prepare(
      "SELECT articles.*, av.ga4_views AS view_count, av.synced_at AS views_updated_at FROM articles LEFT JOIN article_views av ON av.article_id = articles.id WHERE slug = ? AND status = 'published' AND deleted_at IS NULL"
    ).bind(apiSlugMatch[1]).first();
    if (!article) return corsJson({ error: "not_found" }, 404);
    return corsJson({
      slug: article.slug,
      title: article.title,
      titleEn: article.title_en,
      titleCrh: article.title_crh,
      excerpt: article.excerpt,
      excerptEn: article.excerpt_en,
      excerptCrh: article.excerpt_crh,
      bodyMd: article.body_md,
      bodyMdEn: article.body_md_en,
      bodyMdCrh: article.body_md_crh,
      coverImageUrl: article.cover_image_url,
      coverImageUrlEn: article.cover_image_url_en,
        coverImageUrlCrh: article.cover_image_url_crh,
      tags: parseJsonArray(article.tags),
      relatedMediaIds: parseJsonArray(article.related_media_ids),
      isImportant: Boolean(article.is_important),
      cardStyle: article.card_style || "auto",
      publishedAt: article.published_at,
      viewCount: viewsVisible(article.published_at) ? (article.view_count ?? null) : null,
      viewsUpdatedAt: article.views_updated_at ?? null
    });
  }

  if (url.pathname === "/api/articles" && request.method === "OPTIONS") {
    return corsJson({}, 204);
  }

  // GET /rozsylka/ — newsletter signup page (Ukrainian only).
  if ((url.pathname === "/rozsylka" || url.pathname === "/rozsylka/") && request.method === "GET") {
    if (url.pathname === "/rozsylka") return Response.redirect(`${url.origin}/rozsylka/${url.search}`, 301);
    return html(renderNewsletterPage({ baseUrl }));
  }

  // GET /article/:slug
  const articleMatch = pagePath.match(/^\/article\/([a-z0-9-]+)$/);
  if (articleMatch && request.method === "GET") {
    const article = await db.prepare(
      "SELECT articles.*, av.ga4_views AS view_count, av.synced_at AS views_updated_at FROM articles LEFT JOIN article_views av ON av.article_id = articles.id WHERE slug = ? AND status = 'published' AND deleted_at IS NULL"
    ).bind(articleMatch[1]).first();
    // Німецького перекладу ще немає (з'явиться приблизно через 2 години після останньої правки) — показуємо англійську.
    if (article && lang === "de" && !article.title_de) return Response.redirect(`${baseUrl}/en/article/${article.slug}${url.search}`, 302);
    if (!article) {
      return new Response(renderNotFound(lang, baseUrl), {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }
    const relatedIds = parseJsonArray(article.related_media_ids);
    const [relatedMediaNames, relatedUniversities, popularArticles] = await Promise.all([
      fetchRelatedMediaNames(relatedIds, env, baseUrl),
      fetchRelatedUniversities(relatedIds, env, baseUrl),
      // «Найчитаніше» у правій колонці: найпопулярніші (GA4) за останні 30 днів, без поточної.
      // Список однаковий для всіх статей, тож тримаємо його в пам'яті воркера 10 хвилин,
      // а не читаємо з D1 на кожній сторінці (27.11.2026 — ліміт читань).
      popularList(db, lang).then(list => list.filter(a => a.id !== article.id).slice(0, 10))
    ]);
    return html(renderArticlePage({ article, lang, baseUrl, relatedMediaNames, relatedUniversities, popularArticles }));
  }


  // GET /archive/, /archive/2/ … — легкий архів: лише дати й заголовки, без фото й скриптів.
  // Потрібен, щоб старші новини мали звичайні посилання, які бачить Google.
  const archiveMatch = pagePath.match(/^\/archive(?:\/(\d+))?\/?$/);
  if (archiveMatch && request.method === "GET") {
    const page = Math.max(1, parseInt(archiveMatch[1] || "1", 10) || 1);
    const canonicalPath = page === 1 ? "/archive/" : `/archive/${page}/`;
    if (pagePath !== canonicalPath) return Response.redirect(`${baseUrl}${lang === "uk" ? "" : `/${lang}`}${canonicalPath}`, 301);
    const langFilter = lang === "de" ? DE_READY : "";
    const total = (await db.prepare("SELECT COUNT(*) AS n FROM articles WHERE status = 'published' AND deleted_at IS NULL" + langFilter).first())?.n || 0;
    const pages = Math.max(1, Math.ceil(total / ARCHIVE_PAGE_SIZE));
    if (page > pages) return new Response(renderNotFound(lang, baseUrl), { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
    const { results } = await db.prepare(
      "SELECT slug, title, title_en, title_crh, title_de, tags, published_at FROM articles WHERE status = 'published' AND deleted_at IS NULL" + langFilter + " ORDER BY published_at DESC LIMIT ? OFFSET ?"
    ).bind(ARCHIVE_PAGE_SIZE, (page - 1) * ARCHIVE_PAGE_SIZE).all();
    return html(renderArchivePage({ articles: results, lang, baseUrl, page, pages, total }));
  }

  // GET / (homepage, optional ?tag=)
  if (pagePath === "/" && request.method === "GET") {
    const tag = url.searchParams.get("tag");
    let query = "SELECT id, slug, title, title_en, title_crh, title_de, excerpt, excerpt_en, excerpt_crh, excerpt_de, cover_image_url, cover_image_url_en, cover_image_url_crh, cover_crop_data, cover_crop_data_en, cover_crop_data_crh, tags, is_important, card_style, " + pinnedAtSelectSql() + ", published_at , (length(body_md) - length(replace(body_md, '![', ''))) / 2 AS media_photos, (length(body_md) - length(replace(body_md, '[youtube](', ''))) / 10 AS media_video, instr(body_md, '[audio](') > 0 AS media_audio, av.ga4_views AS view_count, av.synced_at AS views_updated_at FROM articles LEFT JOIN article_views av ON av.article_id = articles.id WHERE status = 'published' AND deleted_at IS NULL";
    if (lang === "de") query += DE_READY;
    const binds = [];
    if (tag) {
      query += " AND EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(tags) THEN tags ELSE '[]' END) AS tag_filter WHERE tag_filter.value = ?)";
      binds.push(tag);
    }
    const topic = PRACTICE_TOPICS.find(item => item.id === url.searchParams.get("topic"));
    if (topic) {
      query += " AND EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(tags) THEN tags ELSE '[]' END) AS topic_filter WHERE topic_filter.value IN (" + topic.tags.map(() => "?").join(",") + "))";
      binds.push(...topic.tags);
    }
    // ?sort=top — the most-read stories first (GA4 views), newest first among equals.
    const top = !tag && !topic && url.searchParams.get("sort") === "top";
    query += top ? " ORDER BY COALESCE(av.ga4_views, 0) DESC, published_at DESC LIMIT 30" : " ORDER BY published_at DESC LIMIT 60";
    const { results } = await db.prepare(query).bind(...binds).all();
    let leadArticle = null;
    if (!tag && !topic && !top && !results.some(a => a.card_style === "hero")) {
      leadArticle = await db.prepare(query.replace(" WHERE status = 'published'", " WHERE card_style = 'hero' AND status = 'published'").replace(/LIMIT \d+$/, "LIMIT 1")).bind(...binds).first();
    }
    // Закріплена новина може бути старшою за 60 останніх — тоді беремо її окремо.
    let pinnedArticle = null;
    if (!tag && !topic && !top) {
      pinnedArticle = results.find(a => a.pinned_at) || await db.prepare(query.replace(" WHERE status = 'published'", " WHERE " + pinActiveSql() + " AND status = 'published'").replace(/LIMIT \d+$/, "LIMIT 1")).bind(...binds).first();
    }
    return html(renderHomepage({ articles: results, leadArticle, pinnedArticle, lang, activeTag: tag, activeTopic: topic?.id, activeSort: top ? "top" : null, baseUrl }));
  }

  return null;
}
