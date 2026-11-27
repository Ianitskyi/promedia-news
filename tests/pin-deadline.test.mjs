import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import {
  kyivDayEndUtc, defaultPinDate, resolvePinUntil, pinUntilDate, isPinActive, pinActiveSql, pinnedAtSelectSql
} from "../src/lib/pinning.js";

test("Pin ends at 00:00 Kyiv time after the chosen day (winter and summer time)", () => {
  // 4 грудня закінчується о 00:00 5 грудня за Києвом = 22:00 UTC 4 грудня.
  assert.equal(kyivDayEndUtc("2026-12-04"), "2026-12-04T22:00:00.000Z");
  // Улітку Київ +3: 15 липня закінчується о 21:00 UTC.
  assert.equal(kyivDayEndUtc("2027-07-15"), "2027-07-15T21:00:00.000Z");
  // День переходу на літній час (28.03.2027): кінець дня вже за +3.
  assert.equal(kyivDayEndUtc("2027-03-28"), "2027-03-28T21:00:00.000Z");
});

test("Without a date the pin lasts 5 days from today (Kyiv date)", () => {
  // 28.11.2026 00:59 за Києвом = 27.11 22:59 UTC — київська дата вже 28-ме.
  const now = new Date("2026-11-27T22:59:00Z");
  assert.equal(defaultPinDate(now), "2026-12-03");
  assert.deepEqual(resolvePinUntil(undefined, now), { until: "2026-12-03T22:00:00.000Z", date: "2026-12-03" });
  assert.deepEqual(resolvePinUntil("", now), { until: "2026-12-03T22:00:00.000Z", date: "2026-12-03" });
});

test("Pin date is validated: past dates and garbage are rejected, today is allowed", () => {
  const now = new Date("2026-11-28T10:00:00Z");
  assert.ok(resolvePinUntil("2026-11-27", now).error);
  assert.ok(resolvePinUntil("2026-02-30", now).error);
  assert.ok(resolvePinUntil("04.12.2026", now).error);
  assert.equal(resolvePinUntil("2026-11-28", now).until, "2026-11-28T22:00:00.000Z");
  assert.equal(resolvePinUntil("2026-12-04", now).date, "2026-12-04");
});

test("Pin is active until the end of its day and shows the right date", () => {
  const row = { pinned_at: "2026-11-23T10:00:00.000Z", pinned_until: "2026-12-04T22:00:00.000Z" };
  assert.equal(pinUntilDate(row), "2026-12-04");
  assert.equal(isPinActive(row, new Date("2026-12-04T21:59:59Z")), true);  // 4 грудня, 23:59:59 Київ
  assert.equal(isPinActive(row, new Date("2026-12-04T22:00:00Z")), false); // 5 грудня, 00:00 Київ
  assert.equal(isPinActive({ pinned_at: null, pinned_until: null }), false);
  // Старий запис без терміну не висить вічно: лише 5 днів від закріплення.
  const legacy = { pinned_at: "2026-11-01T10:00:00.000Z", pinned_until: null };
  assert.equal(isPinActive(legacy, new Date("2026-11-06T09:59:00Z")), true);
  assert.equal(isPinActive(legacy, new Date("2026-11-06T10:01:00Z")), false);
});

test("SQL hides expired pins from the public feed", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE articles (id INTEGER PRIMARY KEY, slug TEXT, status TEXT, pinned_at TEXT, pinned_until TEXT)");
  const insert = db.prepare("INSERT INTO articles (slug, status, pinned_at, pinned_until) VALUES (?, 'published', ?, ?)");
  insert.run("active", "2026-11-23T10:00:00.000Z", "2999-12-31T22:00:00.000Z");
  insert.run("expired", "2026-11-23T10:00:00.000Z", "2020-01-01T22:00:00.000Z");
  insert.run("legacy-old", "2020-01-01T10:00:00.000Z", null);
  insert.run("plain", null, null);
  // Як у src/routes/public.js: pinned_at у SELECT — лише для чинного закріплення, і WHERE по колонках таблиці.
  const rows = db.prepare(`SELECT slug, ${pinnedAtSelectSql()} FROM articles WHERE status = 'published' ORDER BY id`).all();
  assert.deepEqual(rows.map(r => [r.slug, Boolean(r.pinned_at)]), [["active", true], ["expired", false], ["legacy-old", false], ["plain", false]]);
  const pinned = db.prepare(`SELECT slug, ${pinnedAtSelectSql()} FROM articles WHERE ${pinActiveSql()} AND status = 'published'`).all();
  assert.deepEqual(pinned.map(r => r.slug), ["active"]);
});

test("The IWPR workshop news is pinned until the end of 4 December", () => {
  const sql = readFileSync(new URL("../migrations/0036_pin_deadline_iwpr.sql", import.meta.url), "utf8");
  assert.match(sql, /pinned_until = '2026-12-04T22:00:00\.000Z'/);
  assert.match(sql, /pinned_until IS NULL/);
  const json = JSON.parse(readFileSync(new URL("../content/articles/2026-11-23-iwpr-workshop-monitorynh-vidnovlennia-lviv.json", import.meta.url), "utf8"));
  assert.equal(json.pinnedUntil, "2026-12-04");
  const workflow = readFileSync(new URL("../.github/workflows/deploy-worker.yml", import.meta.url), "utf8");
  assert.ok(workflow.indexOf("ensure-article-pinned.mjs") < workflow.indexOf("0036_pin_deadline_iwpr.sql"));
  assert.ok(workflow.indexOf("0036_pin_deadline_iwpr.sql") < workflow.indexOf("wrangler deploy"));
});
