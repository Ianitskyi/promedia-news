import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const source = readFileSync(new URL("../src/routes/public.js", import.meta.url), "utf8")
  .replace(/^import .*?;\s*/gm, "").replace(/export /g, "");
const { PRACTICE_TOPICS } = await import("../src/lib/render.js");
const route = new Function("renderHomepage", "ukrainianTypographyReplacer", "PRACTICE_TOPICS", source + "; return handlePublicRoute;")(
  ({ articles }) => `<html>${articles.length}</html>`, (_key, value) => value, PRACTICE_TOPICS
);
const longTag = "журналістські розслідування";
const article = {
  id: 1, slug: "test", title: "Новина", title_en: "News", title_crh: "Haber",
  excerpt: "Опис", excerpt_en: "Description", excerpt_crh: "Tarif",
  cover_image_url: "", cover_image_url_en: "", cover_image_url_crh: "", cover_crop_data_crh: "{}", cover_crop_data: "{}", cover_crop_data_en: "{}",
  tags: JSON.stringify(["автоматизація", longTag, 'Тег "із лапками" та % _']), related_media_ids: JSON.stringify(["long-media-id-".repeat(8)]),
  is_important: 0, card_style: "auto", published_at: "2026-11-05", status: "published", deleted_at: null
};
const sqlite = `
import sqlite3, json, sys
p=json.loads(sys.argv[1]); row=p['article']; db=sqlite3.connect(':memory:'); db.row_factory=sqlite3.Row
db.setlimit(sqlite3.SQLITE_LIMIT_LIKE_PATTERN_LENGTH,50)
db.execute('CREATE TABLE article_views(article_id INTEGER PRIMARY KEY,ga4_views INTEGER,synced_at TEXT)')
db.execute('CREATE TABLE articles ('+','.join('"'+c+'"' for c in row)+')')
db.execute('INSERT INTO articles VALUES ('+','.join('?' for _ in row)+')',list(row.values()))
print(json.dumps([dict(r) for r in db.execute(p['sql'],p['values'])]))
`;
function db() {
  return {prepare(sql) { return {bind(...values) { return {async all() {
    return {results: JSON.parse(execFileSync("python3", ["-c", sqlite, JSON.stringify({article, sql, values})], {encoding:"utf8"}))};
  }}; }}; }};
}
async function request(path) {
  const url = new URL(path, "https://news.promedia.report");
  return route(new Request(url), {DB: db()}, url);
}

test("Long Cyrillic tags work in public API and all three language pages under D1 limits", async () => {
  assert.ok(Buffer.byteLength('%"' + longTag + '"%') > 50);
  const query = "?tag=" + encodeURIComponent(longTag);
  const api = await request("/api/articles" + query);
  assert.equal(api.status, 200);
  assert.equal((await api.json()).items.length, 1);
  for (const prefix of ["", "/en", "/crh"]) assert.equal((await request(prefix + "/" + query)).status, 200);
});

test("Tag filters use exact values including quotes and wildcard characters", async () => {
  for (const [tag, count] of [['Тег "із лапками" та % _', 1], ["розслідування", 0], ["_", 0]]) {
    const response = await request("/api/articles?tag=" + encodeURIComponent(tag));
    assert.equal((await response.json()).items.length, count);
  }
});

test("Long media identifiers use the same safe array membership filter", async () => {
  const response = await request("/api/articles?mediaId=" + encodeURIComponent("long-media-id-".repeat(8)));
  assert.equal((await response.json()).items.length, 1);
});

test("Practical topic filters work in each language and exclude unrelated topics", async () => {
  for (const prefix of ["", "/en", "/crh"]) {
    assert.equal(await (await request(prefix + "/?topic=technology")).text(), "<html>1</html>");
    assert.equal(await (await request(prefix + "/?topic=money")).text(), "<html>0</html>");
  }
});
