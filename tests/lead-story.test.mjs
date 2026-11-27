import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { keepSingleLead } from "../src/lib/leadStory.js";
import { publishDueArticles, SCHEDULE_TABLE_SQL } from "../src/lib/scheduler.js";

function d1(db) {
  return { prepare(sql) { let args = []; const st = {
    bind(...a) { args = a; return st; },
    async run() { db.prepare(sql).run(...args); return { success: true }; },
    async all() { return { results: db.prepare(sql).all(...args) }; },
    async first() { return db.prepare(sql).get(...args) ?? null; } }; return st; } };
}
function setup() {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE articles (id INTEGER PRIMARY KEY, slug TEXT UNIQUE, card_style TEXT DEFAULT 'auto', is_important INTEGER DEFAULT 0, status TEXT, deleted_at TEXT, updated_at TEXT, published_at TEXT)");
  const add = (id, slug, style, status = "published", date = "2026-11-0" + id, important = 0) =>
    db.prepare("INSERT INTO articles (id, slug, card_style, status, published_at, is_important) VALUES (?, ?, ?, ?, ?, ?)").run(id, slug, style, status, date, important);
  const leads = () => db.prepare("SELECT slug FROM articles WHERE card_style = 'hero' ORDER BY id").all().map(r => r.slug);
  return { db, add, leads };
}

test("A new published lead story clears the previous ones, important flags stay", async () => {
  const { db, add, leads } = setup();
  add(1, "old-news", "hero", "published", "2026-11-01", 1);
  add(2, "older-lead", "hero");
  add(3, "draft-lead", "hero", "draft");
  add(4, "new-article", "hero");
  await keepSingleLead(d1(db), { id: 4 });
  assert.deepEqual(leads(), ["draft-lead", "new-article"], "drafts keep their choice until published");
  assert.equal(db.prepare("SELECT is_important FROM articles WHERE id = 1").get().is_important, 1);
});

test("An ordinary article does not touch the lead story", async () => {
  const { db, add, leads } = setup();
  add(1, "lead", "hero");
  add(2, "plain", "auto");
  await keepSingleLead(d1(db), { id: 2 });
  assert.deepEqual(leads(), ["lead"]);
});

test("Scheduled lead story becomes the only one when it goes out", async () => {
  const { db, add, leads } = setup();
  db.exec(SCHEDULE_TABLE_SQL);
  add(1, "lead", "hero");
  add(2, "scheduled-lead", "hero", "draft");
  db.prepare("INSERT INTO scheduled_publications (slug, publish_at) VALUES ('scheduled-lead', '2026-11-28T00:00:00.000Z')").run();
  await publishDueArticles(d1(db), new Date("2026-11-28T00:05:00Z"));
  assert.deepEqual(leads(), ["scheduled-lead"]);
});

test("Cleanup migration keeps only the lead story shown on the front page", () => {
  const { db, add, leads } = setup();
  add(1, "mykolaiv", "hero", "published", "2026-10-01");
  add(2, "current-lead", "hero", "published", "2026-11-27");
  add(3, "mid", "hero", "published", "2026-11-10");
  add(4, "draft-lead", "hero", "draft", "2026-11-28");
  const sql = readFileSync(new URL("../migrations/0035_single_lead_story.sql", import.meta.url), "utf8");
  db.exec(sql);
  assert.deepEqual(leads(), ["current-lead", "draft-lead"]);
  db.exec(sql);
  assert.deepEqual(leads(), ["current-lead", "draft-lead"], "running it again changes nothing");
});
