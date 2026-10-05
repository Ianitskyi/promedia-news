import { renderHomepage, renderArticlePage, renderNotFound } from "../lib/render.js";
import { handlePublicPushRoute } from "../lib/push.js";

// Мова — перший сегмент шляху: /en/…, /crh/… (uk — без префікса).
const LANG_PATH = /^\/(en|crh)(?=\/|$)/;

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
  const prefix = lang === "en" || lang === "crh" ? `/${lang}` : "";
  target.pathname = path === "/" && prefix ? `${prefix}/` : prefix + path;
  return Response.redirect(target.toString(), 301);
}

function corsJson(data, status) {
  return new Response(JSON.stringify(data), {
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

function sitemapUrl(loc, urls, lastmod) {
  return `<url>\n  <loc>${escapeXml(loc)}</loc>${lastmod ? `\n  <lastmod>${escapeXml(lastmod)}</lastmod>` : ""}\n  <xhtml:link rel="alternate" hreflang="uk" href="${escapeXml(urls.uk)}" />\n  <xhtml:link rel="alternate" hreflang="en" href="${escapeXml(urls.en)}" />\n  <xhtml:link rel="alternate" hreflang="crh" href="${escapeXml(urls.crh)}" />\n  <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(urls.uk)}" />\n</url>`;
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

async function fetchRelatedMediaNames(mediaIds, env, baseUrl) {
  if (!mediaIds.length) return [];
  try {
    const [communityRes, atlasRes] = await Promise.allSettled([
      fetch("https://communities.promedia.report/data/communities.json").then(res => res.ok ? res.json() : []),
      env.ASSETS.fetch(new Request(`${baseUrl}/data/atlas-brands.json`)).then(res => res.ok ? res.json() : [])
    ]);
    const all = communityRes.status === "fulfilled" ? communityRes.value : [];
    const atlas = atlasRes.status === "fulfilled" ? atlasRes.value : [];
    return mediaIds.map((id) => {
      const brand = atlas.find(m => m.id === id || (m.newsIds || []).includes(id));
      if (brand) return { id, name: brand.name, url: brand.url };
      const found = all.find((m) => m.id === id);
      return { id, name: found ? found.name : id };
    });
  } catch (err) {
    return mediaIds.map((id) => ({ id, name: id }));
  }
}

export async function handlePublicRoute(request, env, url) {
  const lang = getLang(url);
  const pagePath = stripLangPrefix(url.pathname);
  const isPage = request.method === "GET" && (pagePath === "/" || /^\/article\/[a-z0-9-]+$/.test(pagePath));
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
Disallow: /img-storage/

Sitemap: ${baseUrl}/sitemap.xml
`);
  }

  if (url.pathname === "/sitemap.xml" && request.method === "GET") {
    const { results } = await db.prepare(`
      SELECT slug, published_at, updated_at
      FROM articles
      WHERE status = 'published' AND deleted_at IS NULL
      ORDER BY published_at DESC
    `).all();
    const forLangs = (path) => ({ uk: `${baseUrl}${path}`, en: `${baseUrl}/en${path}`, crh: `${baseUrl}/crh${path}` });
    const home = forLangs("/");
    const entries = ["uk", "en", "crh"].map((l) => sitemapUrl(home[l], home, ""));
    results.forEach((article) => {
      const urls = forLangs(`/article/${article.slug}`);
      const lastmod = sitemapDate(article.updated_at || article.published_at);
      ["uk", "en", "crh"].forEach((l) => entries.push(sitemapUrl(urls[l], urls, lastmod)));
    });
    return xml(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
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

    let query = "SELECT id, slug, title, title_en, title_crh, excerpt, excerpt_en, excerpt_crh, cover_image_url, cover_image_url_en, tags, related_media_ids, is_important, card_style, published_at FROM articles WHERE status = 'published' AND deleted_at IS NULL";
    const binds = [];
    if (tag) {
      query += " AND tags LIKE ?";
      binds.push(`%"${tag}"%`);
    }
    if (mediaId) {
      query += " AND related_media_ids LIKE ?";
      binds.push(`%"${mediaId}"%`);
    }
    if (important === "1" || important === "true") {
      query += " AND is_important = 1";
    }
    query += " ORDER BY published_at DESC LIMIT ?";
    binds.push(limit);

    const { results } = await db.prepare(query).bind(...binds).all();
    const items = results.map((a) => ({
      slug: a.slug,
      title: a.title,
      titleEn: a.title_en,
      titleCrh: a.title_crh,
      excerpt: a.excerpt,
      excerptEn: a.excerpt_en,
      excerptCrh: a.excerpt_crh,
      coverImageUrl: a.cover_image_url,
      coverImageUrlEn: a.cover_image_url_en,
      tags: parseJsonArray(a.tags),
      relatedMediaIds: parseJsonArray(a.related_media_ids),
      isImportant: Boolean(a.is_important),
      cardStyle: a.card_style || "auto",
      publishedAt: a.published_at,
      url: `https://news.promedia.report/article/${a.slug}`
    }));
    return corsJson({ items });
  }

  // A versioned, machine-readable archive of public content. Drafts, accounts,
  // and other private editorial data intentionally remain in D1 only.
  if (url.pathname === "/api/export/published-news.json" && request.method === "GET") {
    const { results } = await db.prepare(`
      SELECT slug, title, title_en, excerpt, excerpt_en, body_md, body_md_en,
        cover_image_url, cover_image_url_en, tags, related_media_ids, is_important, card_style,
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
      "SELECT * FROM articles WHERE slug = ? AND status = 'published' AND deleted_at IS NULL"
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
      tags: parseJsonArray(article.tags),
      relatedMediaIds: parseJsonArray(article.related_media_ids),
      isImportant: Boolean(article.is_important),
      cardStyle: article.card_style || "auto",
      publishedAt: article.published_at
    });
  }

  if (url.pathname === "/api/articles" && request.method === "OPTIONS") {
    return corsJson({}, 204);
  }

  // GET /article/:slug
  const articleMatch = pagePath.match(/^\/article\/([a-z0-9-]+)$/);
  if (articleMatch && request.method === "GET") {
    const article = await db.prepare(
      "SELECT * FROM articles WHERE slug = ? AND status = 'published' AND deleted_at IS NULL"
    ).bind(articleMatch[1]).first();
    if (!article) {
      return new Response(renderNotFound(lang, baseUrl), {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }
    const relatedMediaNames = await fetchRelatedMediaNames(parseJsonArray(article.related_media_ids), env, baseUrl);
    return html(renderArticlePage({ article, lang, baseUrl, relatedMediaNames }));
  }

  // GET / (homepage, optional ?tag=)
  if (pagePath === "/" && request.method === "GET") {
    const tag = url.searchParams.get("tag");
    let query = "SELECT id, slug, title, title_en, title_crh, excerpt, excerpt_en, excerpt_crh, cover_image_url, cover_image_url_en, tags, card_style, published_at FROM articles WHERE status = 'published' AND deleted_at IS NULL";
    const binds = [];
    if (tag) {
      query += " AND tags LIKE ?";
      binds.push(`%"${tag}"%`);
    }
    query += " ORDER BY published_at DESC LIMIT 60";
    const { results } = await db.prepare(query).bind(...binds).all();
    return html(renderHomepage({ articles: results, lang, activeTag: tag, baseUrl }));
  }

  return null;
}
