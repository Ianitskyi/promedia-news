import { getCurrentUser } from "../lib/auth.js";
import { slugify } from "../lib/slug.js";
import { markdownToPlainText } from "../lib/markdown.js";
import { completeArticleDraft } from "../lib/articleAssist.js";

function json(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: { "Content-Type": "application/json; charset=utf-8" } });
}

function parseJson(value) {
  try { return JSON.parse(value || "[]"); } catch { return []; }
}

function normalizeProjectTags(tags) {
  const invalid = [], result = [];
  for (const raw of Array.isArray(tags) ? tags : []) {
    const tag = String(raw || "").replace(/\s+/g, " ").trim();
    if (!tag) continue;
    if (tag.length > 48) { invalid.push(tag); continue; }
    const key = tag.toLocaleLowerCase("uk-UA");
    if (!result.some((value) => value.toLocaleLowerCase("uk-UA") === key)) result.push(tag);
    if (result.length > 12) { invalid.push(tag); result.pop(); }
  }
  return { tags: result, invalid };
}

const MONTHS = { "січень":1,"січня":1,"лютий":2,"лютого":2,"березень":3,"березня":3,"квітень":4,"квітня":4,"травень":5,"травня":5,"червень":6,"червня":6,"липень":7,"липня":7,"серпень":8,"серпня":8,"вересень":9,"вересня":9,"жовтень":10,"жовтня":10,"листопад":11,"листопада":11,"грудень":12,"грудня":12 };
function isoDate(year, month, day) { return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`; }
function extractStructuredSections(markdown) {
  const source = String(markdown || "");
  const periodMatch = source.match(/^\s*\*\*Період:\*\*\s*([^\n]+)\s*(?:\n|$)/i);
  const label = periodMatch ? periodMatch[1].trim() : "";
  const body = periodMatch ? source.slice(periodMatch[0].length).replace(/^\s+/, "") : source;
  let startDate = null, endDate = null;
  let match = label.match(/^(\d{1,2})\s*[–—-]\s*(\d{1,2})\s+([а-яіїєґ]+)\s+(\d{4})/i);
  if (match && MONTHS[match[3].toLocaleLowerCase("uk-UA")]) { startDate = isoDate(+match[4], MONTHS[match[3].toLocaleLowerCase("uk-UA")], +match[1]); endDate = isoDate(+match[4], MONTHS[match[3].toLocaleLowerCase("uk-UA")], +match[2]); }
  else { match = label.match(/^(\d{1,2})\s+([а-яіїєґ]+)\s+(\d{4})/i); if (match && MONTHS[match[2].toLocaleLowerCase("uk-UA")]) startDate = endDate = isoDate(+match[3], MONTHS[match[2].toLocaleLowerCase("uk-UA")], +match[1]); }
  const heading = /^##\s+(.+)$/gmi, sections = []; let item;
  while ((item = heading.exec(body))) sections.push({ title: item[1].trim(), start: item.index, contentStart: heading.lastIndex });
  sections.forEach((section, index) => { section.end = index + 1 < sections.length ? sections[index + 1].start : body.length; });
  const work = sections.find((section) => /^що ми (зробили|робили)$/i.test(section.title));
  const results = sections.find((section) => /^результати$/i.test(section.title));
  if (!work && !results) return { overview: body.trim(), work: "", results: "", structured: false, label, startDate, endDate };
  const recognised = [work, results].filter(Boolean).sort((a,b) => a.start-b.start); let cursor = 0; const overview = [];
  recognised.forEach((section) => { overview.push(body.slice(cursor, section.start)); cursor = section.end; }); overview.push(body.slice(cursor));
  return { overview: overview.join("").trim(), work: work ? body.slice(work.contentStart, work.end).trim() : "", results: results ? body.slice(results.contentStart, results.end).trim() : "", structured: true, label, startDate, endDate };
}

function serialize(p) {
  return {
    id: p.id, slug: p.slug,
    title: p.title, titleEn: p.title_en, titleCrh: p.title_crh,
    excerpt: p.excerpt, excerptEn: p.excerpt_en, excerptCrh: p.excerpt_crh,
    bodyMd: p.body_md, bodyMdEn: p.body_md_en, bodyMdCrh: p.body_md_crh,
    workMd: p.work_md, workMdEn: p.work_md_en, workMdCrh: p.work_md_crh,
    resultsMd: p.results_md, resultsMdEn: p.results_md_en, resultsMdCrh: p.results_md_crh,
    coverImageUrl: p.cover_image_url,
    coverImageUrlEn: p.cover_image_url_en,
    coverCropDataEn: JSON.parse(p.cover_crop_data_en || "{}"),
    coverCropData: JSON.parse(p.cover_crop_data || "{}"),
    partner: p.partner, partnerEn: p.partner_en, partnerCrh: p.partner_crh,
    donor: p.donor, donorEn: p.donor_en, donorCrh: p.donor_crh,
    projectStatus: p.project_status, startDate: p.start_date, endDate: p.end_date, periodLabel: p.period_label, periodLabelEn: p.period_label_en, periodLabelCrh: p.period_label_crh, websiteUrl: p.website_url,
    tags: parseJson(p.tags), isFeatured: Boolean(p.is_featured), publicationStatus: p.publication_status,
    authorId: p.author_id, publishedAt: p.published_at, createdAt: p.created_at, updatedAt: p.updated_at, deletedAt: p.deleted_at
  };
}

async function uniqueProjectSlug(db, title) {
  const base = slugify(title);
  let candidate = base, i = 2;
  while (await db.prepare("SELECT id FROM projects WHERE slug = ?").bind(candidate).first()) candidate = `${base}-${i++}`;
  return candidate;
}

function normalizeProjectStatus(value) {
  return ["upcoming","active","completed"].includes(value) ? value : "active";
}

async function autoTranslateProject(body, env) {
  if (!body || !body.title || !body.bodyMd) return body;
  const completed = await completeArticleDraft({
    ...body,
    tags: Array.isArray(body.tags) ? body.tags : []
  }, env);
  return { ...completed, tags: body.tags };
}

export async function handleProjectsAdminRoute(request, env, url) {
  if (!url.pathname.startsWith("/api/admin/projects")) return null;
  const user = await getCurrentUser(request, env);
  if (!user) return json({ error: "unauthenticated" }, 401);
  const db = env.DB;

  if (url.pathname === "/api/admin/projects" && request.method === "GET") {
    const { results } = user.role === "admin"
      ? await db.prepare("SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY COALESCE(start_date, updated_at) DESC, id DESC").all()
      : await db.prepare("SELECT * FROM projects WHERE author_id = ? AND deleted_at IS NULL ORDER BY COALESCE(start_date, updated_at) DESC, id DESC").bind(user.id).all();
    return json({ items: results.map(serialize) });
  }

  if (url.pathname === "/api/admin/projects/translate-missing" && request.method === "POST") {
    if (user.role !== "admin") return json({ error: "forbidden" }, 403);
    const project = await db.prepare(`
      SELECT * FROM projects
      WHERE publication_status = 'published' AND deleted_at IS NULL
        AND (TRIM(COALESCE(title_en, '')) = '' OR TRIM(COALESCE(excerpt_en, '')) = '' OR TRIM(COALESCE(body_md_en, '')) = ''
          OR TRIM(COALESCE(title_crh, '')) = '' OR TRIM(COALESCE(excerpt_crh, '')) = '' OR TRIM(COALESCE(body_md_crh, '')) = ''
          OR (TRIM(COALESCE(partner, '')) <> '' AND (TRIM(COALESCE(partner_en, '')) = '' OR TRIM(COALESCE(partner_crh, '')) = ''))
          OR (TRIM(COALESCE(donor, '')) <> '' AND (TRIM(COALESCE(donor_en, '')) = '' OR TRIM(COALESCE(donor_crh, '')) = '')))
      ORDER BY COALESCE(start_date, published_at, created_at) DESC, id DESC
      LIMIT 1
    `).first();
    if (!project) return json({ done: true, remaining: 0 });

    const translated = await autoTranslateProject({
      title: project.title,
      titleEn: project.title_en,
      titleCrh: project.title_crh,
      excerpt: project.excerpt,
      excerptEn: project.excerpt_en,
      excerptCrh: project.excerpt_crh,
      bodyMd: project.body_md,
      bodyMdEn: project.body_md_en,
      bodyMdCrh: project.body_md_crh,
      partner: project.partner, partnerEn: project.partner_en, partnerCrh: project.partner_crh,
      donor: project.donor, donorEn: project.donor_en, donorCrh: project.donor_crh,
      tags: parseJson(project.tags)
    }, env);

    if (!translated.titleEn || !translated.bodyMdEn || !translated.titleCrh || !translated.bodyMdCrh) {
      return json({ error: "Автопереклад не повернув повний англійський і кримськотатарський текст." }, 502);
    }

    await db.prepare(`UPDATE projects SET
      title_en=?, title_crh=?, excerpt_en=?, excerpt_crh=?, body_md_en=?, body_md_crh=?, partner_en=?, partner_crh=?, donor_en=?, donor_crh=?, tags=?, updated_at=?
      WHERE id=?`).bind(
      translated.titleEn, translated.titleCrh, translated.excerptEn || "", translated.excerptCrh || "",
      translated.bodyMdEn, translated.bodyMdCrh, translated.partnerEn || project.partner_en, translated.partnerCrh || project.partner_crh,
      translated.donorEn || project.donor_en, translated.donorCrh || project.donor_crh, JSON.stringify(translated.tags || parseJson(project.tags)),
      new Date().toISOString(), project.id
    ).run();

    const remainingRow = await db.prepare(`
      SELECT COUNT(*) AS count FROM projects
      WHERE publication_status = 'published' AND deleted_at IS NULL
        AND (TRIM(COALESCE(title_en, '')) = '' OR TRIM(COALESCE(excerpt_en, '')) = '' OR TRIM(COALESCE(body_md_en, '')) = ''
          OR TRIM(COALESCE(title_crh, '')) = '' OR TRIM(COALESCE(excerpt_crh, '')) = '' OR TRIM(COALESCE(body_md_crh, '')) = ''
          OR (TRIM(COALESCE(partner, '')) <> '' AND (TRIM(COALESCE(partner_en, '')) = '' OR TRIM(COALESCE(partner_crh, '')) = ''))
          OR (TRIM(COALESCE(donor, '')) <> '' AND (TRIM(COALESCE(donor_en, '')) = '' OR TRIM(COALESCE(donor_crh, '')) = '')))
    `).first();
    return json({ done: Number(remainingRow.count || 0) === 0, translated: project.title, remaining: Number(remainingRow.count || 0) });
  }

  if (url.pathname === "/api/admin/projects/migrate-legacy-content" && request.method === "POST") {
    if (user.role !== "admin") return json({ error: "forbidden" }, 403);
    const payload = await request.json().catch(() => ({})); const apply = payload.apply === true;
    const { results } = await db.prepare("SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY id").all();
    const items = []; let eligible = 0, applied = 0; const now = new Date().toISOString();
    for (const project of results) {
      const data = extractStructuredSections(project.body_md);
      const canStructure = data.structured && !String(project.work_md || "").trim() && !String(project.results_md || "").trim() && Boolean(data.work || data.results);
      const canPeriod = !String(project.period_label || "").trim() && Boolean(data.label);
      const canStart = !project.start_date && Boolean(data.startDate), canEnd = !project.end_date && Boolean(data.endDate);
      const changed = Number(canStructure) + Number(canPeriod) + Number(canStart) + Number(canEnd);
      if (changed) eligible++;
      const item = { id: project.id, title: project.title, status: !changed ? "unchanged" : (canStructure && data.work && data.results ? "ready" : "partial"), structure: canStructure, period: canPeriod, startDate: canStart ? data.startDate : null, endDate: canEnd ? data.endDate : null, periodLabel: data.label || null };
      if (apply && changed) {
        await db.prepare("UPDATE projects SET body_md=?, work_md=?, results_md=?, period_label=?, start_date=?, end_date=?, updated_at=? WHERE id=?").bind(
          canStructure ? data.overview : project.body_md, canStructure ? data.work : (project.work_md || ""), canStructure ? data.results : (project.results_md || ""),
          canPeriod ? data.label : project.period_label, canStart ? data.startDate : project.start_date, canEnd ? data.endDate : project.end_date, now, project.id
        ).run(); item.applied = true; applied++;
      }
      items.push(item);
    }
    return json({ dryRun: !apply, total: results.length, eligible, applied, items });
  }

  if (url.pathname === "/api/admin/projects" && request.method === "POST") {
    let body = await request.json().catch(() => null);
    if (!body || !body.title) return json({ error: "title обов'язковий" }, 400);
    const normalizedTags = normalizeProjectTags(body.tags);
    if (normalizedTags.invalid.length) return json({ error: "Тег має містити до 48 символів; у проєкті можна вказати до 12 тегів." }, 400);
    body.tags = normalizedTags.tags;
    body = await autoTranslateProject(body, env);
    const now = new Date().toISOString();
    const slug = await uniqueProjectSlug(db, body.title);
    const excerpt = body.excerpt || markdownToPlainText(body.bodyMd || "", 220);
    const result = await db.prepare(`INSERT INTO projects
      (slug,title,title_en,title_crh,excerpt,excerpt_en,excerpt_crh,body_md,body_md_en,body_md_crh,work_md,work_md_en,work_md_crh,results_md,results_md_en,results_md_crh,period_label,period_label_en,period_label_crh,
       cover_image_url,cover_image_url_en,cover_crop_data,cover_crop_data_en,partner,partner_en,partner_crh,donor,donor_en,donor_crh,
       project_status,start_date,end_date,website_url,tags,is_featured,publication_status,author_id,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? , 'draft', ?,?,?)`).bind(
      slug, body.title, body.titleEn || null, body.titleCrh || null,
      excerpt, body.excerptEn || null, body.excerptCrh || null,
      body.bodyMd || "", body.bodyMdEn || null, body.bodyMdCrh || null,
      body.workMd || "", body.workMdEn || null, body.workMdCrh || null, body.resultsMd || "", body.resultsMdEn || null, body.resultsMdCrh || null,
      body.periodLabel || null, body.periodLabelEn || null, body.periodLabelCrh || null,
      body.coverImageUrl || null, body.coverImageUrlEn || null, JSON.stringify(body.coverCropData || {}), JSON.stringify(body.coverCropDataEn || {}),
      body.partner || null, body.partnerEn || null, body.partnerCrh || null,
      body.donor || null, body.donorEn || null, body.donorCrh || null,
      normalizeProjectStatus(body.projectStatus), body.startDate || null, body.endDate || null, body.websiteUrl || null,
      JSON.stringify(body.tags || []), body.isFeatured ? 1 : 0, user.id, now, now
    ).run();
    const project = await db.prepare("SELECT * FROM projects WHERE id = ?").bind(result.meta.last_row_id).first();
    return json({ item: serialize(project) }, 201);
  }

  if (url.pathname === "/api/admin/projects/upload" && request.method === "POST") {
    const type = request.headers.get("Content-Type") || "";
    if (!type.startsWith("image/")) return json({ error: "Дозволені лише зображення" }, 400);
    const buffer = await request.arrayBuffer();
    if (buffer.byteLength > 8 * 1024 * 1024) return json({ error: "Файл завеликий (максимум 8 МБ)" }, 400);
    const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : type === "image/gif" ? "gif" : "jpg";
    const key = `projects/${crypto.randomUUID()}.${ext}`;
    await env.IMAGES.put(key, buffer, { httpMetadata: { contentType: type } });
    const publicUrl = env.IMAGES_PUBLIC_BASE_URL ? `${env.IMAGES_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}` : `/img-storage/${key}`;
    return json({ url: publicUrl });
  }

  if (url.pathname === "/api/admin/projects/trash" && request.method === "GET") {
    if (user.role !== "admin") return json({ error: "forbidden" }, 403);
    const { results } = await db.prepare("SELECT * FROM projects WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC").all();
    return json({ items: results.map(serialize) });
  }

  const restoreMatch = url.pathname.match(/^\/api\/admin\/projects\/(\d+)\/restore$/);
  if (restoreMatch && request.method === "POST") {
    if (user.role !== "admin") return json({ error: "forbidden" }, 403);
    const id = Number(restoreMatch[1]);
    const project = await db.prepare("SELECT * FROM projects WHERE id=? AND deleted_at IS NOT NULL").bind(id).first();
    if (!project) return json({ error: "not_found" }, 404);
    await db.prepare("UPDATE projects SET deleted_at=NULL, updated_at=? WHERE id=?").bind(new Date().toISOString(), id).run();
    return json({ ok: true });
  }

  const permanentMatch = url.pathname.match(/^\/api\/admin\/projects\/(\d+)\/permanent$/);
  if (permanentMatch && request.method === "DELETE") {
    if (user.role !== "admin") return json({ error: "forbidden" }, 403);
    const id = Number(permanentMatch[1]);
    const project = await db.prepare("SELECT id FROM projects WHERE id=? AND deleted_at IS NOT NULL").bind(id).first();
    if (!project) return json({ error: "not_found" }, 404);
    await db.prepare("DELETE FROM projects WHERE id=?").bind(id).run();
    return json({ ok: true });
  }

  const match = url.pathname.match(/^\/api\/admin\/projects\/(\d+)$/);
  if (match) {
    const id = Number(match[1]);
    const project = await db.prepare("SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL").bind(id).first();
    if (!project) return json({ error: "not_found" }, 404);
    if (user.role !== "admin" && project.author_id !== user.id) return json({ error: "forbidden" }, 403);

    if (request.method === "PUT") {
      let body = await request.json().catch(() => null);
      if (!body) return json({ error: "invalid_body" }, 400);
      if (body.tags !== undefined) {
        const normalizedTags = normalizeProjectTags(body.tags);
        if (normalizedTags.invalid.length) return json({ error: "Тег має містити до 48 символів; у проєкті можна вказати до 12 тегів." }, 400);
        body.tags = normalizedTags.tags;
      }
      body = await autoTranslateProject({
        title: body.title ?? project.title,
        titleEn: body.titleEn ?? project.title_en,
        titleCrh: body.titleCrh ?? project.title_crh,
        excerpt: body.excerpt ?? project.excerpt,
        excerptEn: body.excerptEn ?? project.excerpt_en,
        excerptCrh: body.excerptCrh ?? project.excerpt_crh,
        bodyMd: body.bodyMd ?? project.body_md,
        bodyMdEn: body.bodyMdEn ?? project.body_md_en,
        bodyMdCrh: body.bodyMdCrh ?? project.body_md_crh,
        tags: body.tags ?? parseJson(project.tags),
        ...body
      }, env);
      await db.prepare(`UPDATE projects SET
        title=?, title_en=?, title_crh=?, excerpt=?, excerpt_en=?, excerpt_crh=?,
        body_md=?, body_md_en=?, body_md_crh=?, work_md=?, work_md_en=?, work_md_crh=?, results_md=?, results_md_en=?, results_md_crh=?, period_label=?, period_label_en=?, period_label_crh=?, cover_image_url=?, cover_image_url_en=?, cover_crop_data=?, cover_crop_data_en=?,
        partner=?, partner_en=?, partner_crh=?, donor=?, donor_en=?, donor_crh=?,
        project_status=?, start_date=?, end_date=?, website_url=?, tags=?, is_featured=?, updated_at=? WHERE id=?`).bind(
        body.title ?? project.title, body.titleEn ?? project.title_en, body.titleCrh ?? project.title_crh,
        body.excerpt ?? project.excerpt, body.excerptEn ?? project.excerpt_en, body.excerptCrh ?? project.excerpt_crh,
        body.bodyMd ?? project.body_md, body.bodyMdEn ?? project.body_md_en, body.bodyMdCrh ?? project.body_md_crh,
        body.workMd ?? project.work_md, body.workMdEn ?? project.work_md_en, body.workMdCrh ?? project.work_md_crh,
        body.resultsMd ?? project.results_md, body.resultsMdEn ?? project.results_md_en, body.resultsMdCrh ?? project.results_md_crh,
        body.periodLabel ?? project.period_label, body.periodLabelEn ?? project.period_label_en, body.periodLabelCrh ?? project.period_label_crh,
        body.coverImageUrl ?? project.cover_image_url,
        body.coverImageUrlEn ?? project.cover_image_url_en,
        JSON.stringify(body.coverCropData ?? JSON.parse(project.cover_crop_data || "{}")),
        JSON.stringify(body.coverCropDataEn ?? JSON.parse(project.cover_crop_data_en || "{}")),
        body.partner ?? project.partner, body.partnerEn ?? project.partner_en, body.partnerCrh ?? project.partner_crh,
        body.donor ?? project.donor, body.donorEn ?? project.donor_en, body.donorCrh ?? project.donor_crh,
        normalizeProjectStatus(body.projectStatus ?? project.project_status),
        body.startDate ?? project.start_date, body.endDate ?? project.end_date, body.websiteUrl ?? project.website_url,
        JSON.stringify(body.tags ?? parseJson(project.tags)),
        body.isFeatured === undefined ? project.is_featured : (body.isFeatured ? 1 : 0),
        new Date().toISOString(), id
      ).run();
      return json({ item: serialize(await db.prepare("SELECT * FROM projects WHERE id=? AND deleted_at IS NULL").bind(id).first()) });
    }

    if (request.method === "DELETE") {
      await db.prepare("UPDATE projects SET deleted_at=?, updated_at=? WHERE id=?").bind(new Date().toISOString(), new Date().toISOString(), id).run();
      return json({ ok: true });
    }
  }

  const publish = url.pathname.match(/^\/api\/admin\/projects\/(\d+)\/publish$/);
  if (publish && request.method === "POST") {
    const id = Number(publish[1]);
    const project = await db.prepare("SELECT * FROM projects WHERE id=? AND deleted_at IS NULL").bind(id).first();
    if (!project) return json({ error: "not_found" }, 404);
    if (user.role !== "admin" && project.author_id !== user.id) return json({ error: "forbidden" }, 403);
    if (!project.title || !project.body_md) return json({ error: "Назва і опис проєкту обов'язкові" }, 400);
    const now = new Date().toISOString();
    await db.prepare("UPDATE projects SET publication_status='published', published_at=COALESCE(published_at, ?), updated_at=? WHERE id=?").bind(now, now, id).run();
    return json({ ok: true });
  }

  const unpublish = url.pathname.match(/^\/api\/admin\/projects\/(\d+)\/unpublish$/);
  if (unpublish && request.method === "POST") {
    const id = Number(unpublish[1]);
    const project = await db.prepare("SELECT * FROM projects WHERE id=? AND deleted_at IS NULL").bind(id).first();
    if (!project) return json({ error: "not_found" }, 404);
    if (user.role !== "admin" && project.author_id !== user.id) return json({ error: "forbidden" }, 403);
    await db.prepare("UPDATE projects SET publication_status='draft', updated_at=? WHERE id=?").bind(new Date().toISOString(), id).run();
    return json({ ok: true });
  }

  return null;
}
