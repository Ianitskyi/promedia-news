import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const toModule = (path) => import("data:text/javascript;base64," + Buffer.from(read(path)).toString("base64"));
const markdown = await toModule("src/lib/markdown.js");
const typography = await toModule("src/lib/typography.js");
const { BRANDS } = await toModule("src/data/brands-index.js");
const { loadBrands, brandPatterns, mentionsByBrand, monogram } = await import("../brands-site/build.mjs");
const source = read("src/lib/render.js").replace(/^import .*?;\s*/gm, "").replace(/export /g, "");
const load = (siteUrl) => new Function(
  "markdownToHtml", "markdownToPlainText", "escapeHtml", "normalizeUkrainianQuotes", "normalizeUkrainianTitle", "PEOPLE", "PEOPLE_SITE_URL", "BRANDS", "BRANDS_SITE_URL",
  source + ";return {renderArticlePage};"
)(markdown.markdownToHtml, markdown.markdownToPlainText, markdown.escapeHtml, typography.normalizeUkrainianQuotes, typography.normalizeUkrainianTitle, [], "", BRANDS, siteUrl);

const article = { slug: "t", title: "Новина", title_en: "News", body_md: "Текст", body_md_en: "Text",
  tags: JSON.stringify(["Новини", "Українська правда", "Sözcü TV", "CNN"]) };

test("Brand dossiers load and the news index matches brands/data", () => {
  const brands = loadBrands(new URL("../brands/data/", import.meta.url).pathname);
  const files = readdirSync(new URL("../brands/data/", import.meta.url)).filter(f => f.endsWith(".json")).map(f => f.slice(0, -5)).sort();
  assert.deepEqual(brands.map(b => b.slug).sort(), files);
  assert.deepEqual(BRANDS.map(b => b.slug).sort(), files);
  // Джерело кожного досьє — сайт бренду, Вікіпедія або новина ПроМедіа, де його згадано.
  const archive = JSON.parse(read("archive/published-news.json")).items
    .map(a => [a.slug, { slug: a.slug, title: a.title, date: (a.publishedAt || "").slice(0, 10), text: `${a.title}\n${a.bodyMd || ""}` }]);
  const contentDir = new URL("../content/articles/", import.meta.url);
  const extra = readdirSync(contentDir).filter(f => f.endsWith(".json")).map(f => JSON.parse(readFileSync(new URL(f, contentDir), "utf8")))
    .map(a => [a.slug, { slug: a.slug, title: a.title, date: "", text: `${a.title}\n${a.bodyMd || ""}` }]);
  const mentions = mentionsByBrand(brands, new Map([...archive, ...extra]));
  for (const b of brands) {
    assert.ok(b.sources.length + (b.wiki || []).length + mentions.get(b.slug).length > 0, `${b.slug}: немає джерел`);
    assert.ok(b.summary.en && b.type.en, `${b.slug}: немає англійського опису`);
  }
});

test("Mention patterns respect word boundaries and inflected Ukrainian names", () => {
  const brands = loadBrands(new URL("../brands/data/", import.meta.url).pathname);
  const bySlug = Object.fromEntries(brands.map(b => [b.slug, b]));
  const hit = (slug, text) => brandPatterns(bySlug[slug]).some(re => re.test(text));
  assert.ok(hit("ukrainska-pravda", "як писала «Українська правда»"));
  assert.ok(hit("ukrainska-pravda", "заступник головної редакторки «Української правди»"));
  assert.ok(hit("nv", "головна редакторка видання NV Юлія"));
  assert.ok(!hit("nv", "INVEST NVIDIA"));
  assert.ok(hit("associated-press", "агенція [AP](https://abcnews.com/x)"));
  assert.ok(!hit("associated-press", "APPLE"));
  assert.ok(hit("fakty", "«Факти», УНН"));
  assert.ok(!hit("fakty", "«Факти ICTV»"));
  assert.ok(!hit("bbc", "консорціум на чолі з BBC Media Action"));
  assert.ok(hit("dev-ua", "Про це повідомляє [dev.ua](https://dev.ua/news/x)"));
  assert.ok(!hit("sozcu", "телеканалу Sözcü TV"));
  assert.ok(hit("sozcu", "газети Sözcü та видань"));
});

test("Manual article links are honoured even without a text match", () => {
  const brand = { slug: "x", name: { uk: "Ікс", en: "X" }, match: [], articles: ["a"] };
  const articles = new Map([["a", { slug: "a", title: "A", date: "2026-11-01", text: "без згадки" }], ["b", { slug: "b", title: "B", date: "2026-11-02", text: "Ікс" }]]);
  const m = mentionsByBrand([brand], articles);
  assert.deepEqual(m.get("x").map(a => a.slug), ["a"]);
});

test("Monograms skip articles and keep two letters", () => {
  assert.equal(monogram("The New York Times"), "NY");
  assert.equal(monogram("Reuters"), "RE");
  assert.equal(monogram("BBC"), "BBC");
  assert.equal(monogram("ТСН"), "ТСН");
  assert.equal(monogram("Українська правда"), "УП");
});

test("Brands box stays hidden until the brands site address is set, tags still render Latin names", () => {
  const { renderArticlePage } = load("");
  const en = renderArticlePage({ article, lang: "en", baseUrl: "https://news.promedia.report", relatedMediaNames: [] });
  assert.ok(!en.includes("brands-box"));
  assert.ok(en.includes(">Ukrainska Pravda</a>"));
  assert.ok(en.includes("/en/?tag=" + encodeURIComponent("Українська правда")));
});

test("Brands box lists tagged brands once and skips media already shown from the Atlas", () => {
  const { renderArticlePage } = load("https://brands.promedia.report");
  const dup = { ...article, tags: JSON.stringify(["Українська правда", "УП", "Sözcü TV", "CNN", "Новини"]) };
  const uk = renderArticlePage({ article: dup, lang: "uk", baseUrl: "https://news.promedia.report", relatedMediaNames: [{ name: "CNN", manual: true, website: "https://cnn.com" }] });
  const box = uk.slice(uk.indexOf("brands-box"));
  assert.equal((box.match(/class="people-box-item media-box-item"/g) || []).length, 2);
  assert.ok(uk.includes('href="https://brands.promedia.report/ukrainska-pravda/"'));
  assert.ok(uk.includes("https://brands.promedia.report/logo/sozcu-tv"));
  const en = renderArticlePage({ article: dup, lang: "en", baseUrl: "https://news.promedia.report", relatedMediaNames: [] });
  assert.ok(en.includes('href="https://brands.promedia.report/en/cnn/"'));
  assert.ok(en.includes("Media brands in this story"));
});
