import { getCurrentUser, hashPassword } from "../lib/auth.js";
import { uniqueSlug } from "../lib/slug.js";
import { markdownToPlainText } from "../lib/markdown.js";

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

function serializeArticle(a) {
  return {
    id: a.id,
    slug: a.slug,
    title: a.title,
    titleEn: a.title_en,
    excerpt: a.excerpt,
    excerptEn: a.excerpt_en,
    bodyMd: a.body_md,
    bodyMdEn: a.body_md_en,
    coverImageUrl: a.cover_image_url,
    tags: JSON.parse(a.tags || "[]"),
    relatedMediaIds: JSON.parse(a.related_media_ids || "[]"),
    isImportant: Boolean(a.is_important),
    status: a.status,
    authorId: a.author_id,
    publishedAt: a.published_at,
    createdAt: a.created_at,
    updatedAt: a.updated_at
  };
}

function extFromContentType(ct) {
  if (ct === "image/png") return "png";
  if (ct === "image/webp") return "webp";
  if (ct === "image/gif") return "gif";
  return "jpg";
}

export async function handleAdminRoute(request, env, url) {
  const db = env.DB;
  const user = await getCurrentUser(request, env);
  if (!user) return json({ error: "unauthenticated" }, 401);

  // ---- Статті ----

  if (url.pathname === "/api/admin/articles" && request.method === "GET") {
    const isAdmin = user.role === "admin";
    const { results } = isAdmin
      ? await db.prepare("SELECT * FROM articles ORDER BY updated_at DESC").all()
      : await db.prepare("SELECT * FROM articles WHERE author_id = ? ORDER BY updated_at DESC").bind(user.id).all();
    return json({ items: results.map(serializeArticle) });
  }

  if (url.pathname === "/api/admin/articles" && request.method === "POST") {
    const body = await request.json().catch(() => null);
    if (!body || !body.title) return json({ error: "title обов'язковий" }, 400);
    const slug = await uniqueSlug(db, body.title);
    const excerpt = body.excerpt || markdownToPlainText(body.bodyMd || "", 200);
    const now = new Date().toISOString();
    const result = await db.prepare(`
      INSERT INTO articles (slug, title, title_en, excerpt, excerpt_en, body_md, body_md_en,
        cover_image_url, tags, related_media_ids, is_important, status, author_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)
    `).bind(
      slug, body.title, body.titleEn || null, excerpt, body.excerptEn || null,
      body.bodyMd || "", body.bodyMdEn || null, body.coverImageUrl || null,
      JSON.stringify(body.tags || []), JSON.stringify(body.relatedMediaIds || []),
      body.isImportant ? 1 : 0,
      user.id, now, now
    ).run();
    const article = await db.prepare("SELECT * FROM articles WHERE id = ?").bind(result.meta.last_row_id).first();
    return json({ item: serializeArticle(article) }, 201);
  }

  const articleIdMatch = url.pathname.match(/^\/api\/admin\/articles\/(\d+)$/);
  if (articleIdMatch) {
    const id = parseInt(articleIdMatch[1], 10);
    const article = await db.prepare("SELECT * FROM articles WHERE id = ?").bind(id).first();
    if (!article) return json({ error: "not_found" }, 404);
    const canEdit = user.role === "admin" || article.author_id === user.id;
    if (!canEdit) return json({ error: "forbidden" }, 403);

    if (request.method === "PUT") {
      const body = await request.json().catch(() => null);
      if (!body) return json({ error: "invalid_body" }, 400);
      const excerpt = body.excerpt !== undefined ? body.excerpt : article.excerpt;
      await db.prepare(`
        UPDATE articles SET title = ?, title_en = ?, excerpt = ?, excerpt_en = ?,
          body_md = ?, body_md_en = ?, cover_image_url = ?, tags = ?, related_media_ids = ?,
          is_important = ?,
          updated_at = ?
        WHERE id = ?
      `).bind(
        body.title ?? article.title,
        body.titleEn ?? article.title_en,
        excerpt,
        body.excerptEn ?? article.excerpt_en,
        body.bodyMd ?? article.body_md,
        body.bodyMdEn ?? article.body_md_en,
        body.coverImageUrl ?? article.cover_image_url,
        JSON.stringify(body.tags ?? JSON.parse(article.tags || "[]")),
        JSON.stringify(body.relatedMediaIds ?? JSON.parse(article.related_media_ids || "[]")),
        body.isImportant === undefined ? article.is_important : (body.isImportant ? 1 : 0),
        new Date().toISOString(),
        id
      ).run();
      const updated = await db.prepare("SELECT * FROM articles WHERE id = ?").bind(id).first();
      return json({ item: serializeArticle(updated) });
    }

    if (request.method === "DELETE") {
      await db.prepare("DELETE FROM articles WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }
  }

  const publishMatch = url.pathname.match(/^\/api\/admin\/articles\/(\d+)\/publish$/);
  if (publishMatch && request.method === "POST") {
    const id = parseInt(publishMatch[1], 10);
    const article = await db.prepare("SELECT * FROM articles WHERE id = ?").bind(id).first();
    if (!article) return json({ error: "not_found" }, 404);
    if (user.role !== "admin" && article.author_id !== user.id) return json({ error: "forbidden" }, 403);
    if (!article.title || !article.body_md) return json({ error: "Заголовок і текст обов'язкові перед публікацією" }, 400);
    const now = new Date().toISOString();
    await db.prepare(
      "UPDATE articles SET status = 'published', published_at = COALESCE(published_at, ?), updated_at = ? WHERE id = ?"
    ).bind(now, now, id).run();
    return json({ ok: true });
  }

  const unpublishMatch = url.pathname.match(/^\/api\/admin\/articles\/(\d+)\/unpublish$/);
  if (unpublishMatch && request.method === "POST") {
    const id = parseInt(unpublishMatch[1], 10);
    const article = await db.prepare("SELECT * FROM articles WHERE id = ?").bind(id).first();
    if (!article) return json({ error: "not_found" }, 404);
    if (user.role !== "admin" && article.author_id !== user.id) return json({ error: "forbidden" }, 403);
    await db.prepare("UPDATE articles SET status = 'draft', updated_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), id).run();
    return json({ ok: true });
  }

  // ---- Завантаження зображень ----

  if (url.pathname === "/api/admin/upload" && request.method === "POST") {
    const contentType = request.headers.get("Content-Type") || "";
    if (!contentType.startsWith("image/")) {
      return json({ error: "Дозволені лише зображення" }, 400);
    }
    const bodyBuffer = await request.arrayBuffer();
    if (bodyBuffer.byteLength > 8 * 1024 * 1024) {
      return json({ error: "Файл завеликий (максимум 8 МБ)" }, 400);
    }
    const ext = extFromContentType(contentType);
    const key = `articles/${crypto.randomUUID()}.${ext}`;
    await env.IMAGES.put(key, bodyBuffer, { httpMetadata: { contentType } });
    const publicUrl = env.IMAGES_PUBLIC_BASE_URL
      ? `${env.IMAGES_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`
      : `/img-storage/${key}`;
    return json({ url: publicUrl });
  }

  // ---- Користувачі (лише admin) ----

  if (url.pathname === "/api/admin/users" && request.method === "GET") {
    if (user.role !== "admin") return json({ error: "forbidden" }, 403);
    const { results } = await db.prepare("SELECT id, email, name, role, created_at FROM users ORDER BY created_at").all();
    return json({ items: results });
  }

  if (url.pathname === "/api/admin/users" && request.method === "POST") {
    if (user.role !== "admin") return json({ error: "forbidden" }, 403);
    const body = await request.json().catch(() => null);
    if (!body || !body.email || !body.password || !body.name) {
      return json({ error: "email, password, name обов'язкові" }, 400);
    }
    if (body.password.length < 10) return json({ error: "Пароль має бути не менше 10 символів" }, 400);
    const existing = await db.prepare("SELECT id FROM users WHERE email = ?").bind(body.email.toLowerCase().trim()).first();
    if (existing) return json({ error: "Користувач із таким email вже існує" }, 409);
    const passwordHash = await hashPassword(body.password);
    const role = body.role === "admin" ? "admin" : "author";
    const result = await db.prepare(
      "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)"
    ).bind(body.email.toLowerCase().trim(), passwordHash, body.name, role).run();
    return json({ id: result.meta.last_row_id, email: body.email, name: body.name, role }, 201);
  }

  const userIdMatch = url.pathname.match(/^\/api\/admin\/users\/(\d+)$/);
  if (userIdMatch && request.method === "PUT") {
    const id = parseInt(userIdMatch[1], 10);
    const isSelf = id === user.id;
    if (user.role !== "admin" && !isSelf) return json({ error: "forbidden" }, 403);
    const body = await request.json().catch(() => null);
    if (!body) return json({ error: "invalid_body" }, 400);

    if (body.password) {
      if (body.password.length < 10) return json({ error: "Пароль має бути не менше 10 символів" }, 400);
      const passwordHash = await hashPassword(body.password);
      await db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(passwordHash, id).run();
    }
    if (user.role === "admin" && body.role) {
      await db.prepare("UPDATE users SET role = ? WHERE id = ?").bind(body.role === "admin" ? "admin" : "author", id).run();
    }
    if (user.role === "admin" && body.name) {
      await db.prepare("UPDATE users SET name = ? WHERE id = ?").bind(body.name, id).run();
    }
    return json({ ok: true });
  }

  if (userIdMatch && request.method === "DELETE") {
    if (user.role !== "admin") return json({ error: "forbidden" }, 403);
    const id = parseInt(userIdMatch[1], 10);
    if (id === user.id) return json({ error: "Не можна видалити власний акаунт" }, 400);
    await db.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }

  return null;
}
