// Публікація за розкладом (23.11.2026): GitHub пропускав запуски за cron, тож новина
// о 08:15 вийшла лише о 10:22. Тепер сценарій публікації одразу кладе новину з
// "publishAt" у базу чернеткою й записує час у scheduled_publications, а сайт
// (Cloudflare cron кожні 5 хвилин) сам відкриває новини, час яких настав.

export const SCHEDULE_TABLE_SQL =
  "CREATE TABLE IF NOT EXISTS scheduled_publications (slug TEXT PRIMARY KEY, publish_at TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, published_at_run TEXT)";
const STATE_TABLE_SQL =
  "CREATE TABLE IF NOT EXISTS scheduler_state (key TEXT PRIMARY KEY, value TEXT)";

export async function publishDueArticles(db, now = new Date()) {
  const nowIso = now.toISOString();
  await db.prepare(SCHEDULE_TABLE_SQL).run();
  await db.prepare(STATE_TABLE_SQL).run();
  const due = (await db.prepare(
    "SELECT slug FROM scheduled_publications WHERE done = 0 AND publish_at <= ?"
  ).bind(nowIso).all()).results || [];
  for (const { slug } of due) {
    // Лише чернетка, не видалена: якщо редактор уже опублікував чи прибрав новину в адмінці, не чіпаємо.
    // Дата публікації = фактичний час виходу (27.11.2026: новина Spokusy, яку спершу запланували на 28.11,
    // а потім перенесли на 18:00 27.11, на сайті стояла з датою 28.11).
    await db.prepare(
      "UPDATE articles SET status = 'published', published_at = ?, updated_at = ? WHERE slug = ? AND status = 'draft' AND deleted_at IS NULL"
    ).bind(nowIso, nowIso, slug).run();
    await db.prepare(
      "UPDATE scheduled_publications SET done = 1, published_at_run = ? WHERE slug = ?"
    ).bind(nowIso, slug).run();
  }
  await db.prepare(
    "INSERT INTO scheduler_state (key, value) VALUES ('last_run', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).bind(nowIso).run();
  return due.map(r => r.slug);
}

export async function schedulerStatus(db) {
  await db.prepare(SCHEDULE_TABLE_SQL).run();
  await db.prepare(STATE_TABLE_SQL).run();
  const last = await db.prepare("SELECT value FROM scheduler_state WHERE key = 'last_run'").first();
  const pending = await db.prepare("SELECT COUNT(*) AS n FROM scheduled_publications WHERE done = 0").first();
  const next = await db.prepare("SELECT MIN(publish_at) AS t FROM scheduled_publications WHERE done = 0").first();
  return { lastRun: last?.value || null, pending: pending?.n || 0, nextPublishAt: next?.t || null };
}
