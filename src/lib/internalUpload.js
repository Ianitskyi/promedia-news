// Службове завантаження фото в R2 через сам сайт (binding IMAGES).
//
// Навіщо: ключ Cloudflare, з яким GitHub Actions публікує новини, не має права писати в R2,
// а D1 — має. Тому сценарій публікації кладе в D1 одноразовий токен (лише його SHA-256 хеш,
// діє 15 хвилин) і надсилає фото сюди з цим токеном. Нових секретів і ручних кроків не треба.
//
// POST /api/internal/r2-put?key=articles/назва.jpg
//   Authorization: Bearer <токен>
//   Content-Type: image/jpeg | image/png | image/webp
//   тіло — байти фото (до 15 МБ)

const TABLE_SQL =
  "CREATE TABLE IF NOT EXISTS upload_tokens (token_hash TEXT PRIMARY KEY, expires_at TEXT NOT NULL)";
const MAX_BYTES = 15 * 1024 * 1024;
const KEY_RE = /^(articles|people|library)\/[a-z0-9][a-z0-9._-]{0,150}\.(jpe?g|png|webp)$/;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function handleInternalUpload(request, env, url) {
  if (url.pathname !== "/api/internal/r2-put") return null;
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (token.length < 32) return json({ error: "unauthorized" }, 401);

  await env.DB.prepare(TABLE_SQL).run();
  const now = new Date().toISOString();
  await env.DB.prepare("DELETE FROM upload_tokens WHERE expires_at < ?").bind(now).run();
  const row = await env.DB.prepare("SELECT 1 AS ok FROM upload_tokens WHERE token_hash = ? AND expires_at >= ?")
    .bind(await sha256Hex(token), now)
    .first();
  if (!row) return json({ error: "unauthorized" }, 401);

  const key = url.searchParams.get("key") || "";
  if (!KEY_RE.test(key)) return json({ error: "bad_key" }, 400);
  const contentType = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (!TYPES.has(contentType)) return json({ error: "bad_type" }, 415);

  const body = await request.arrayBuffer();
  if (!body.byteLength) return json({ error: "empty" }, 400);
  if (body.byteLength > MAX_BYTES) return json({ error: "too_large" }, 413);

  await env.IMAGES.put(key, body, { httpMetadata: { contentType } });
  return json({ ok: true, url: `/img-storage/${key}`, bytes: body.byteLength });
}
