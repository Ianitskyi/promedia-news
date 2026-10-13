import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const markdownSource = read("src/lib/markdown.js");
const markdown = await import("data:text/javascript;base64," + Buffer.from(markdownSource).toString("base64"));

test("YouTube watch, short, shorts and live links render restricted embeds", () => {
  const urls = [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/live/dQw4w9WgXcQ"
  ];
  for (const url of urls) {
    const html = markdown.markdownToHtml("[youtube](" + url + ")");
    assert.match(html, /<iframe/);
    assert.match(html, /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
    assert.doesNotMatch(html, /<script/);
  }
});

test("Arbitrary HTML and malicious embed hosts are not executed", () => {
  const html = markdown.markdownToHtml('<script>alert(1)</script>\n\n[youtube](https://evil.example/watch?v=dQw4w9WgXcQ)');
  assert.doesNotMatch(html, /<script/);
  assert.doesNotMatch(html, /<iframe/);
  assert.match(html, /&lt;script&gt;/);
});

test("Video shortcodes are excluded from article descriptions", () => {
  assert.equal(markdown.markdownToPlainText("Початок\n\n[youtube](https://youtu.be/dQw4w9WgXcQ)\n\nКінець"), "Початок Кінець");
});

test("Cover editor stores and clamps independent positions", () => {
  const window = {};
  runInNewContext(read("public/admin/cover-editor.js"), { window });
  const normalize = window.ProMediaCoverEditor.normalize;
  const result = normalize({ desktop: { x: -10, y: 120 }, mobile: { x: 35, y: 80 }, social: { x: 40, y: 60 } });
  assert.deepEqual(JSON.parse(JSON.stringify(result.desktop)), { x: 0, y: 100 });
  assert.deepEqual(JSON.parse(JSON.stringify(result.mobile)), { x: 35, y: 80 });
  assert.deepEqual(JSON.parse(JSON.stringify(result.feed)), { x: 50, y: 50 });
});

test("News and projects save crop fields and migrations declare columns", () => {
  const migration = read("migrations/0012_cover_crop_positions.sql");
  for (const column of ["cover_crop_data", "cover_crop_data_en", "cover_image_url_en"]) assert.ok(migration.includes(column));
  assert.match(read("src/routes/admin.js"), /cover_crop_data_en/);
  assert.match(read("src/routes/projectsAdmin.js"), /cover_crop_data_en/);
  assert.match(read("src/lib/render.js"), /cover_crop_data/);
  assert.match(read("src/lib/projectRender.js"), /cover_crop_data/);
});

test("New article and project INSERT statements match column and argument counts", () => {
  for (const [path, table] of [["src/routes/admin.js","articles"], ["src/routes/projectsAdmin.js","projects"]]) {
    const source = read(path);
    const start = source.indexOf("INSERT INTO " + table);
    const segment = source.slice(start, source.indexOf(".run();", start));
    const columnList = segment.match(/INSERT INTO \w+\s*\(([^)]+)\)/)[1];
    const placeholders = segment.match(/VALUES\s*\(([^)]+)\)/)[1];
    const columns = columnList.split(",").length;
    const explicitLiterals = (placeholders.match(/'[^']*'/g) || []).length;
    const params = (placeholders.match(/\?/g) || []).length;
    assert.equal(columns, params + explicitLiterals, table + " INSERT columns and values");
  }
});
