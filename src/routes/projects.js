import { renderProjectsHomepage, renderProjectPage } from "../lib/projectRender.js";

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

function parseJson(value) {
  try { return JSON.parse(value || "[]"); } catch { return []; }
}

function publicProjectCoverUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const base = "https://projects.promedia.report";
  const projectMarker = "/storage/app/media/projects/";
  const mediaMarker = "/storage/app/media/";
  const lower = raw.toLowerCase();

  let i = lower.indexOf(projectMarker);
  if (i >= 0) {
    const file = decodeURIComponent(raw.slice(i + projectMarker.length));
    return `${base}/img/projects/${file.split("/").map(encodeURIComponent).join("/")}`;
  }

  i = lower.indexOf(mediaMarker);
  if (i >= 0) {
    const file = decodeURIComponent(raw.slice(i + mediaMarker.length));
    return `${base}/img/projects/${file.split("/").map(encodeURIComponent).join("/")}`;
  }

  if (raw.startsWith("projects/")) {
    const file = decodeURIComponent(raw.slice("projects/".length));
    return `${base}/img/projects/${file.split("/").map(encodeURIComponent).join("/")}`;
  }

  if (raw.startsWith("/img/projects/")) return base + raw;

  try { return new URL(raw, base).toString(); } catch { return ""; }
}

function publicProjectImageUrl(raw) {
  if (!raw) return null;
  const value = String(raw).trim();

  const marker = "/storage/app/media/projects/";
  const lower = value.toLowerCase();
  const markerIndex = lower.indexOf(marker);
  if (markerIndex >= 0) {
    const file = value.slice(markerIndex + marker.length);
    return `https://projects.promedia.report/img/projects/${file}`;
  }

  if (value.startsWith("projects/")) {
    return `https://projects.promedia.report/img/${value}`;
  }

  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/img/projects/")) return `https://projects.promedia.report${value}`;
  if (value.startsWith("img/projects/")) return `https://projects.promedia.report/${value}`;

  return value.startsWith("/")
    ? `https://projects.promedia.report${value}`
    : `https://projects.promedia.report/${value}`;
}

function serialize(project) {
  return {
    slug: project.slug,
    title: project.title,
    titleEn: project.title_en,
    titleCrh: project.title_crh,
    excerpt: project.excerpt,
    excerptEn: project.excerpt_en,
    excerptCrh: project.excerpt_crh,
    bodyMd: project.body_md,
    bodyMdEn: project.body_md_en,
    bodyMdCrh: project.body_md_crh,
    coverImageUrl: publicProjectImageUrl(project.cover_image_url),
    partner: project.partner,
    partnerEn: project.partner_en,
    partnerCrh: project.partner_crh,
    donor: project.donor,
    donorEn: project.donor_en,
    donorCrh: project.donor_crh,
    projectStatus: project.project_status,
    startDate: project.start_date,
    endDate: project.end_date,
    websiteUrl: project.website_url,
    tags: parseJson(project.tags),
    isFeatured: Boolean(project.is_featured),
    publishedAt: project.published_at,
    url: `https://projects.promedia.report/project/${project.slug}`
  };
}

export async function handleProjectsPublicRoute(request, env, url) {
  const host = url.hostname.toLowerCase();
  const isProjectsHost = host === "projects.promedia.report" || host.startsWith("projects.");
  const pathMatch = url.pathname.match(/^\/(en|crh)(?=\/|$)/);
  const lang = pathMatch ? pathMatch[1] : "uk";
  const path = pathMatch ? (url.pathname.replace(/^\/(en|crh)/, "") || "/") : url.pathname;
  const db = env.DB;

  if (url.pathname === "/api/projects" && request.method === "OPTIONS") return corsJson({}, 204);

  if (url.pathname === "/api/projects" && request.method === "GET") {
    const featured = url.searchParams.get("featured");
    const status = url.searchParams.get("status");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 100);
    let query = "SELECT * FROM projects WHERE publication_status = 'published' AND deleted_at IS NULL";
    const binds = [];
    if (featured === "1" || featured === "true") query += " AND is_featured = 1";
    if (["upcoming", "active", "completed"].includes(status)) { query += " AND project_status = ?"; binds.push(status); }
    query += " ORDER BY COALESCE(start_date, published_at, created_at) DESC, id DESC LIMIT ?";
    binds.push(limit);
    const { results } = await db.prepare(query).bind(...binds).all();
    return corsJson({ items: results.map(serialize) });
  }

  const apiMatch = url.pathname.match(/^\/api\/projects\/([a-z0-9-]+)$/);
  if (apiMatch && request.method === "GET") {
    const project = await db.prepare("SELECT * FROM projects WHERE slug = ? AND publication_status = 'published' AND deleted_at IS NULL").bind(apiMatch[1]).first();
    return project ? corsJson({ item: serialize(project) }) : corsJson({ error: "not_found" }, 404);
  }

  if (!isProjectsHost) return null;

  const baseUrl = "https://projects.promedia.report";
  if (path === "/" && request.method === "GET") {
    const { results } = await db.prepare("SELECT * FROM projects WHERE publication_status = 'published' AND deleted_at IS NULL ORDER BY COALESCE(start_date, published_at, created_at) DESC, id DESC").all();
    const allTags = Array.from(new Set(results.flatMap((project) => parseJson(project.tags)))).sort((a, b) => String(a).localeCompare(String(b), "uk"));
    const selectedTag = url.searchParams.get("tag") || "";
    const filtered = selectedTag ? results.filter((project) => parseJson(project.tags).includes(selectedTag)) : results;
    return new Response(renderProjectsHomepage({ projects: filtered, lang, baseUrl, allTags, selectedTag }), { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const projectMatch = path.match(/^\/project\/([A-Za-z0-9-]+)$/);
  if (projectMatch && request.method === "GET") {
    const project = await db.prepare("SELECT * FROM projects WHERE slug = ? AND publication_status = 'published' AND deleted_at IS NULL").bind(projectMatch[1]).first();
    if (!project) return new Response("Not found", { status: 404 });
    return new Response(renderProjectPage({ project, lang, baseUrl }), { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  return null;
}
