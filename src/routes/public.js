import { renderHomepage, renderArticlePage, renderNotFound } from "../lib/render.js";

function getLang(url) {
  const l = url.searchParams.get("lang");
  return l === "en" ? "en" : "uk";
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

async function fetchRelatedMediaNames(mediaIds) {
  if (!mediaIds.length) return [];
  try {
    const res = await fetch("https://communities.promedia.report/data/communities.json");
    if (!res.ok) return mediaIds.map((id) => ({ id, name: id }));
    const all = await res.json();
    return mediaIds.map((id) => {
      const found = all.find((m) => m.id === id);
      return { id, name: found ? found.name : id };
    });
  } catch (err) {
    return mediaIds.map((id) => ({ id, name: id }));
  }
}

export async function handlePublicRoute(request, env, url) {
  const lang = getLang(url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const db = env.DB;

  // GET /api/articles?tag=&mediaId=&limit=
  if (url.pathname === "/api/articles" && request.method === "GET") {
    const tag = url.searchParams.get("tag");
    const mediaId = url.searchParams.get("mediaId");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 100);

    let query = "SELECT id, slug, title, title_en, excerpt, excerpt_en, cover_image_url, tags, related_media_ids, published_at FROM articles WHERE status = 'published'";
    const binds = [];
    if (tag) {
      query += " AND tags LIKE ?";
      binds.push(`%"${tag}"%`);
    }
    if (mediaId) {
      query += " AND related_media_ids LIKE ?";
      binds.push(`%"${mediaId}"%`);
    }
    query += " ORDER BY published_at DESC LIMIT ?";
    binds.push(limit);

    const { results } = await db.prepare(query).bind(...binds).all();
    const items = results.map((a) => ({
      slug: a.slug,
      title: a.title,
      titleEn: a.title_en,
      excerpt: a.excerpt,
      excerptEn: a.excerpt_en,
      coverImageUrl: a.cover_image_url,
      tags: JSON.parse(a.tags || "[]"),
      relatedMediaIds: JSON.parse(a.related_media_ids || "[]"),
      publishedAt: a.published_at,
      url: `https://news.promedia.report/article/${a.slug}`
    }));
    return corsJson({ items });
  }

  // GET /api/articles/:slug
  const apiSlugMatch = url.pathname.match(/^\/api\/articles\/([a-z0-9-]+)$/);
  if (apiSlugMatch && request.method === "GET") {
    const article = await db.prepare(
      "SELECT * FROM articles WHERE slug = ? AND status = 'published'"
    ).bind(apiSlugMatch[1]).first();
    if (!article) return corsJson({ error: "not_found" }, 404);
    return corsJson({
      slug: article.slug,
      title: article.title,
      titleEn: article.title_en,
      excerpt: article.excerpt,
      excerptEn: article.excerpt_en,
      bodyMd: article.body_md,
      bodyMdEn: article.body_md_en,
      coverImageUrl: article.cover_image_url,
      tags: JSON.parse(article.tags || "[]"),
      relatedMediaIds: JSON.parse(article.related_media_ids || "[]"),
      publishedAt: article.published_at
    });
  }

  if (url.pathname === "/api/articles" && request.method === "OPTIONS") {
    return corsJson({}, 204);
  }

  // GET /article/:slug
  const articleMatch = url.pathname.match(/^\/article\/([a-z0-9-]+)$/);
  if (articleMatch && request.method === "GET") {
    const article = await db.prepare(
      "SELECT * FROM articles WHERE slug = ? AND status = 'published'"
    ).bind(articleMatch[1]).first();
    if (!article) {
      return new Response(renderNotFound(lang, baseUrl), {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }
    const relatedMediaNames = await fetchRelatedMediaNames(JSON.parse(article.related_media_ids || "[]"));
    return html(renderArticlePage({ article, lang, baseUrl, relatedMediaNames }));
  }

  // GET / (homepage, optional ?tag=)
  if (url.pathname === "/" && request.method === "GET") {
    const tag = url.searchParams.get("tag");
    let query = "SELECT id, slug, title, title_en, excerpt, excerpt_en, cover_image_url, tags, published_at FROM articles WHERE status = 'published'";
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
