import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { publishDueArticles, schedulerStatus, SCHEDULE_TABLE_SQL } from "../src/lib/scheduler.js";

// Мінімальний адаптер node:sqlite під API Cloudflare D1.
function d1(db) {
  return {
    prepare(sql) {
      let args = [];
      const st = {
        bind(...a) { args = a; return st; },
        async run() { db.prepare(sql).run(...args); return { success: true }; },
        async all() { return { results: db.prepare(sql).all(...args) }; },
        async first() { return db.prepare(sql).get(...args) ?? null; }
      };
      return st;
    }
  };
}

function setup() {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE articles (slug TEXT PRIMARY KEY, status TEXT NOT NULL CHECK (status IN ('draft','published')), deleted_at TEXT, updated_at TEXT)");
  db.exec(SCHEDULE_TABLE_SQL);
  const add = (slug, status, publishAt, deleted = null) => {
    db.prepare("INSERT INTO articles (slug, status, deleted_at) VALUES (?, ?, ?)").run(slug, status, deleted);
    if (publishAt) db.prepare("INSERT INTO scheduled_publications (slug, publish_at) VALUES (?, ?)").run(slug, publishAt);
  };
  return { db, add, status: slug => db.prepare("SELECT status FROM articles WHERE slug = ?").get(slug).status };
}

test("Scheduler publishes only drafts whose time has come", async () => {
  const { db, add, status } = setup();
  const now = new Date("2026-11-24T06:20:00Z");
  add("due", "draft", "2026-11-24T06:15:00.000Z");
  add("future", "draft", "2026-11-24T09:00:00.000Z");
  add("plain-draft", "draft", null);
  add("deleted", "draft", "2026-11-24T06:00:00.000Z", "2026-11-23T10:00:00Z");
  const published = await publishDueArticles(d1(db), now);
  assert.deepEqual(published.sort(), ["deleted", "due"]);
  assert.equal(status("due"), "published");
  assert.equal(status("future"), "draft");
  assert.equal(status("plain-draft"), "draft", "an ordinary admin draft is never published");
  assert.equal(status("deleted"), "draft", "a deleted article stays hidden");
  const s = await schedulerStatus(d1(db));
  assert.equal(s.lastRun, now.toISOString());
  assert.equal(s.pending, 1);
  assert.equal(s.nextPublishAt, "2026-11-24T09:00:00.000Z");
  // Повторний запуск нічого не робить з уже опублікованим.
  assert.deepEqual(await publishDueArticles(d1(db), now), []);
});

test("Worker runs the scheduler on every cron and cleans the bin only once a day", async () => {
  const { readFileSync } = await import("node:fs");
  const worker = readFileSync(new URL("../src/worker.js", import.meta.url), "utf8");
  const wrangler = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
  assert.match(wrangler, /crons = \["\*\/5 \* \* \* \*", "17 3 \* \* \*"\]/);
  assert.match(worker, /publishDueArticles\(env\.DB\)/);
  assert.match(worker, /event\.cron === "17 3 \* \* \*"/);
});
