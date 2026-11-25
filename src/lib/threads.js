// Автопостинг новин у Threads (25.11.2026).
//
// Як працює (Cloudflare cron кожні 5 хвилин, див. src/worker.js):
// 1. Береться опублікована новина з обкладинкою, яку не правили щонайменше 2 години
//    (тексти ще допрацьовують після виходу, тож у Threads іде вже усталена версія).
// 2. Перший запуск створює в Threads «контейнер» поста, наступний (через 5 хвилин) його
//    публікує — так радить документація Meta, щоб картинка встигла завантажитися.
// 3. Кожна новина постується лише раз (таблиця threads_posts), за раз — не більше однієї.
// 4. Старі новини не постяться: відлік іде з моменту першого запуску (threads_state.start_at).
//
// Секрети (wrangler secret put): THREADS_USER_ID, THREADS_ACCESS_TOKEN (довгий токен, 60 днів).
// Без них модуль нічого не робить. Токен щотижня оновлюється автоматично й зберігається в D1.

import { socialCover } from "./render.js";
import { markdownToPlainText } from "./markdown.js";

const API = "https://graph.threads.net/v1.0";
const SITE = "https://news.promedia.report";
const QUIET_MS = 2 * 60 * 60 * 1000;      // 2 години після останньої правки
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // новини, старші за тиждень, не постимо
const CONTAINER_WAIT_MS = 30 * 1000;
const REFRESH_EVERY_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const TEXT_LIMIT = 500;

export const THREADS_POSTS_SQL =
  "CREATE TABLE IF NOT EXISTS threads_posts (slug TEXT PRIMARY KEY, status TEXT NOT NULL, container_id TEXT, media_id TEXT, permalink TEXT, attempts INTEGER NOT NULL DEFAULT 0, error TEXT, created_at TEXT NOT NULL, posted_at TEXT)";
export const THREADS_STATE_SQL =
  "CREATE TABLE IF NOT EXISTS threads_state (key TEXT PRIMARY KEY, value TEXT)";

async function ensureTables(db) {
  await db.prepare(THREADS_POSTS_SQL).run();
  await db.prepare(THREADS_STATE_SQL).run();
}
async function getState(db, key) {
  return (await db.prepare("SELECT value FROM threads_state WHERE key = ?").bind(key).first())?.value ?? null;
}
async function setState(db, key, value) {
  await db.prepare(
    "INSERT INTO threads_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).bind(key, value).run();
}

export function threadsEnabled(env) {
  return Boolean(env.THREADS_USER_ID && env.THREADS_ACCESS_TOKEN);
}

// Актуальний токен: оновлений з D1, або секрет. Якщо секрет замінили — беремо новий секрет.
async function currentToken(env, now = new Date()) {
  const fingerprint = env.THREADS_ACCESS_TOKEN.slice(-12);
  if (await getState(env.DB, "env_fingerprint") !== fingerprint) {
    await setState(env.DB, "env_fingerprint", fingerprint);
    await setState(env.DB, "access_token", env.THREADS_ACCESS_TOKEN);
    await setState(env.DB, "token_refreshed_at", now.toISOString());
  }
  return (await getState(env.DB, "access_token")) || env.THREADS_ACCESS_TOKEN;
}

async function threadsCall(fetchImpl, method, path, params) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, String(v));
  const res = await fetchImpl(url.toString(), { method });
  let data = {};
  try { data = await res.json(); } catch (_) {}
  if (!res.ok || data.error) {
    const msg = data.error?.error_user_msg || data.error?.message || `HTTP ${res.status}`;
    throw new Error(String(msg).slice(0, 300));
  }
  return data;
}

// --- Текст поста ---------------------------------------------------------------

const chars = s => Array.from(s || "");
function clip(text, max) {
  const c = chars(text);
  if (c.length <= max) return text;
  const cut = c.slice(0, Math.max(0, max - 1)).join("");
  const atSpace = cut.replace(/\s+\S*$/, "");
  return (atSpace.length > cut.length * 0.6 ? atSpace : cut).replace(/[\s,.;:—–-]+$/, "") + "…";
}

export function articleUrl(slug) {
  return `${SITE}/article/${encodeURIComponent(slug)}`;
}

// Заголовок, лід і (для поста з картинкою) посилання. Не довше 500 символів.
export function buildPostText(article, { withLink }) {
  const title = (article.title || "").trim();
  const excerpt = markdownToPlainText(article.excerpt || "", 1000).trim();
  const link = withLink ? articleUrl(article.slug) : "";
  const reserved = chars(title).length + (link ? chars(link).length + 2 : 0) + 2;
  const room = TEXT_LIMIT - reserved;
  const parts = [clip(title, TEXT_LIMIT - (link ? chars(link).length + 2 : 0))];
  if (excerpt && room > 40) parts.push(clip(excerpt, room));
  if (link) parts.push(link);
  return parts.join("\n\n");
}

// Картинка для поста: окрема обкладинка 1200×630 або сама обкладинка, якщо це JPEG/PNG
// з нашого сайту. Інакше — пост із карткою посилання (Threads сам підтягне og:image).
export function pickImage(article) {
  const candidates = [socialCover(article, "uk"), article.cover_image_url];
  for (const src of candidates) {
    if (!src) continue;
    let url;
    try { url = new URL(src, SITE); } catch (_) { continue; }
    if (url.search) continue;
    if (/\.(jpe?g|png)$/i.test(url.pathname)) return url.toString();
  }
  return null;
}

// --- Основний цикл ------------------------------------------------------------

export async function runThreadsAutopost(env, now = new Date(), fetchImpl = fetch) {
  if (!threadsEnabled(env)) return { skipped: "not_configured" };
  const db = env.DB;
  await ensureTables(db);
  const nowIso = now.toISOString();

  // Перший запуск: лише запам'ятовуємо момент старту, щоб не постити архів.
  const startAt = await getState(db, "start_at");
  if (!startAt) {
    await setState(db, "start_at", nowIso);
    return { started: nowIso };
  }

  const token = await currentToken(env, now);
  const userId = env.THREADS_USER_ID;

  // Крок 2: опублікувати вже створений контейнер.
  const pending = await db.prepare(
    "SELECT slug, container_id, attempts, created_at FROM threads_posts WHERE status = 'container' ORDER BY created_at LIMIT 1"
  ).first();
  if (pending) {
    if (now - new Date(pending.created_at) < CONTAINER_WAIT_MS) return { waiting: pending.slug };
    try {
      const pub = await threadsCall(fetchImpl, "POST", `/${userId}/threads_publish`, {
        creation_id: pending.container_id, access_token: token
      });
      let permalink = null;
      try {
        permalink = (await threadsCall(fetchImpl, "GET", `/${pub.id}`, { fields: "permalink", access_token: token })).permalink || null;
      } catch (_) {}
      await db.prepare(
        "UPDATE threads_posts SET status = 'posted', media_id = ?, permalink = ?, posted_at = ?, error = NULL WHERE slug = ?"
      ).bind(pub.id, permalink, nowIso, pending.slug).run();
      return { posted: pending.slug, permalink };
    } catch (e) {
      await failAttempt(db, pending.slug, pending.attempts, e, nowIso);
      return { error: pending.slug, message: e.message };
    }
  }

  // Крок 1: знайти наступну новину й створити контейнер.
  const quietIso = new Date(now - QUIET_MS).toISOString();
  const minPublished = new Date(Math.max(new Date(startAt), now - MAX_AGE_MS)).toISOString();
  const article = await db.prepare(
    `SELECT a.* FROM articles a
     WHERE a.status = 'published' AND a.deleted_at IS NULL
       AND a.cover_image_url IS NOT NULL AND TRIM(a.cover_image_url) <> ''
       AND datetime(a.published_at) >= datetime(?)
       AND datetime(a.updated_at) <= datetime(?)
       AND NOT EXISTS (SELECT 1 FROM threads_posts t WHERE t.slug = a.slug AND (t.status <> 'retry'))
     ORDER BY datetime(a.published_at) ASC LIMIT 1`
  ).bind(minPublished, quietIso).first();
  if (!article) return { idle: true };

  const prev = await db.prepare("SELECT attempts FROM threads_posts WHERE slug = ?").bind(article.slug).first();
  const attempts = prev?.attempts || 0;
  try {
    const image = pickImage(article);
    const params = image
      ? { media_type: "IMAGE", image_url: image, text: buildPostText(article, { withLink: true }) }
      : { media_type: "TEXT", text: buildPostText(article, { withLink: false }), link_attachment: articleUrl(article.slug) };
    const container = await threadsCall(fetchImpl, "POST", `/${userId}/threads`, { ...params, access_token: token });
    await db.prepare(
      `INSERT INTO threads_posts (slug, status, container_id, attempts, created_at) VALUES (?, 'container', ?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET status = 'container', container_id = excluded.container_id, created_at = excluded.created_at, error = NULL`
    ).bind(article.slug, container.id, attempts, nowIso).run();
    return { container: article.slug };
  } catch (e) {
    await db.prepare(
      "INSERT INTO threads_posts (slug, status, attempts, created_at) VALUES (?, 'retry', ?, ?) ON CONFLICT(slug) DO NOTHING"
    ).bind(article.slug, attempts, nowIso).run();
    await failAttempt(db, article.slug, attempts, e, nowIso);
    return { error: article.slug, message: e.message };
  }
}

// Після 3 невдалих спроб новина отримує статус 'error' і більше не пробується.
async function failAttempt(db, slug, attempts, err, nowIso) {
  const next = (attempts || 0) + 1;
  await db.prepare(
    "UPDATE threads_posts SET status = ?, attempts = ?, error = ?, created_at = ? WHERE slug = ?"
  ).bind(next >= MAX_ATTEMPTS ? "error" : "retry", next, String(err.message || err).slice(0, 300), nowIso, slug).run();
  console.error("threads", slug, err.message || err);
}

// Раз на тиждень продовжуємо 60-денний токен (щоденний cron).
export async function refreshThreadsToken(env, now = new Date(), fetchImpl = fetch) {
  if (!threadsEnabled(env)) return null;
  await ensureTables(env.DB);
  const token = await currentToken(env, now);
  const last = await getState(env.DB, "token_refreshed_at");
  if (last && now - new Date(last) < REFRESH_EVERY_MS) return null;
  const url = new URL("https://graph.threads.net/refresh_access_token");
  url.searchParams.set("grant_type", "th_refresh_token");
  url.searchParams.set("access_token", token);
  const res = await fetchImpl(url.toString());
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    await setState(env.DB, "token_error", String(data.error?.message || `HTTP ${res.status}`).slice(0, 300));
    return null;
  }
  await setState(env.DB, "access_token", data.access_token);
  await setState(env.DB, "token_refreshed_at", now.toISOString());
  await setState(env.DB, "token_error", "");
  return true;
}

// Стан для перевірки (без токенів).
export async function threadsStatus(env) {
  if (!threadsEnabled(env)) return { enabled: false };
  await ensureTables(env.DB);
  const recent = (await env.DB.prepare(
    "SELECT slug, status, permalink, error, posted_at FROM threads_posts ORDER BY created_at DESC LIMIT 10"
  ).all()).results || [];
  return {
    enabled: true,
    startAt: await getState(env.DB, "start_at"),
    tokenRefreshedAt: await getState(env.DB, "token_refreshed_at"),
    tokenError: (await getState(env.DB, "token_error")) || null,
    recent
  };
}
