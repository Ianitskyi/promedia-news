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


test("Public article renders UA/EN image positions and mobile focal point", () => {
  const source = read("src/lib/render.js").replace(/^import .*?;\s*/m, "").replace(/export /g, "");
  const render = new Function("markdownToHtml", "markdownToPlainText", "escapeHtml", source + "; return renderArticlePage;")(
    markdown.markdownToHtml, markdown.markdownToPlainText, markdown.escapeHtml
  );
  const article = {
    slug: "test", title: "Тест", title_en: "Test", excerpt: "Опис", excerpt_en: "Description",
    body_md: "Текст", body_md_en: "Text", tags: "[]", cover_image_url: "/img/uk.jpg",
    cover_image_url_en: "/img/en.jpg",
    cover_crop_data: JSON.stringify({ desktop: {x: 35, y: 40}, mobile: {x: 65, y: 80} }),
    cover_crop_data_en: JSON.stringify({ desktop: {x: 15, y: 20}, mobile: {x: 45, y: 55} })
  };
  const ua = render({ article, lang: "uk", baseUrl: "https://news.promedia.report", relatedMediaNames: [] });
  const en = render({ article, lang: "en", baseUrl: "https://news.promedia.report", relatedMediaNames: [] });
  assert.match(ua, /--cover-desktop-position:35% 40%;--cover-mobile-position:65% 80%/);
  assert.match(en, /--cover-desktop-position:15% 20%;--cover-mobile-position:45% 55%/);
  assert.match(en, /src="\/img\/en.jpg"/);
  assert.doesNotMatch(ua, /--cover-desktop-position:15% 20%/);
});

test("Public project page supports an independent English photo", () => {
  const source = read("src/lib/projectRender.js").replace(/^import .*?;\s*/m, "").replace(/export /g, "");
  const render = new Function("markdownToHtml", "markdownToPlainText", source + "; return renderProjectPage;")(
    markdown.markdownToHtml, markdown.markdownToPlainText
  );
  const project = {
    slug: "project", title: "Проєкт", title_en: "Project",
    excerpt: "Опис", excerpt_en: "Description", body_md: "Text", body_md_en: "Text",
    cover_image_url: "/img/projects/uk.jpg", cover_image_url_en: "/img/projects/en.jpg",
    cover_crop_data: JSON.stringify({ desktop: { x: 60, y: 40}, mobile: { x: 55, y: 70 } }),
    cover_crop_data_en: JSON.stringify({ desktop: { x: 10, y: 20}, mobile: { x: 25, y: 35 } }),
    tags: "[]"
  };
  const ua = render({project,lang:"uk",baseUrl:"https://projects.promedia.report"});
  const en = render({project,lang:"en",baseUrl:"https://projects.promedia.report"});
  assert.match(ua, /--cover-desktop-position:60% 40%;--cover-mobile-position:55% 70%/);
  assert.match(en, /--cover-desktop-position:10% 20%;--cover-mobile-position:25% 35%/);
  assert.match(en, /en\.jpg/);
});
