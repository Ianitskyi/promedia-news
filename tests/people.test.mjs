import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const markdown = await import("data:text/javascript;base64," + Buffer.from(read("src/lib/markdown.js")).toString("base64"));
const typography = await import("data:text/javascript;base64," + Buffer.from(read("src/lib/typography.js")).toString("base64"));
const { PEOPLE } = await import("data:text/javascript;base64," + Buffer.from(read("src/data/people-index.js")).toString("base64"));
const source = read("src/lib/render.js").replace(/^import .*?;\s*/gm, "").replace(/export /g, "");
const load = (siteUrl) => new Function(
  "markdownToHtml", "markdownToPlainText", "escapeHtml", "normalizeUkrainianQuotes", "normalizeUkrainianTitle", "PEOPLE", "PEOPLE_SITE_URL",
  source + ";return {renderArticlePage};"
)(markdown.markdownToHtml, markdown.markdownToPlainText, markdown.escapeHtml, typography.normalizeUkrainianQuotes, typography.normalizeUkrainianTitle, PEOPLE, siteUrl);

const article = { slug: "t", title: "Новина", title_en: "News", body_md: "Текст", body_md_en: "Text",
  tags: JSON.stringify(["Статті", "Анна Бабінець", "Ольга Руденко"]) };

test("Person tags render Latin names in other languages and keep the Ukrainian filter value", () => {
  const { renderArticlePage } = load("");
  const en = renderArticlePage({ article, lang: "en", baseUrl: "https://news.promedia.report", relatedMediaNames: [] });
  assert.ok(en.includes(">Anna Babinets</a>"));
  assert.ok(en.includes("/en/?tag=" + encodeURIComponent("Анна Бабінець")));
  const uk = renderArticlePage({ article, lang: "uk", baseUrl: "https://news.promedia.report", relatedMediaNames: [] });
  assert.ok(uk.includes(">Анна Бабінець</a>"));
});

test("People box stays hidden until the people site address is set", () => {
  const { renderArticlePage } = load("");
  const uk = renderArticlePage({ article, lang: "uk", baseUrl: "https://news.promedia.report", relatedMediaNames: [] });
  assert.ok(!uk.includes("people-box"));
});

test("People box lists every tagged person once with a dossier link", () => {
  const { renderArticlePage } = load("https://people.promedia.report");
  const dup = { ...article, tags: JSON.stringify(["Анна Бабінець", "Анна Бабинець", "Ольга Руденко", "Новини"]) };
  const uk = renderArticlePage({ article: dup, lang: "uk", baseUrl: "https://news.promedia.report", relatedMediaNames: [] });
  assert.equal((uk.match(/class="people-box-item"/g) || []).length, 2);
  assert.ok(uk.includes('href="https://people.promedia.report/anna-babinets/"'));
  assert.ok(uk.includes("https://people.promedia.report/photo/olha-rudenko"));
  const en = renderArticlePage({ article: dup, lang: "en", baseUrl: "https://news.promedia.report", relatedMediaNames: [] });
  assert.ok(en.includes('href="https://people.promedia.report/en/olha-rudenko/"'));
  assert.ok(en.includes("Olga Rudenko"));
});

test("News index matches people/data and article mapping uses known people", async () => {
  const { readdirSync } = await import("node:fs");
  const slugs = readdirSync(new URL("../people/data/", import.meta.url)).filter(f => f.endsWith(".json")).map(f => f.slice(0, -5)).sort();
  assert.deepEqual(PEOPLE.map(p => p.slug).sort(), slugs);
  const mapping = JSON.parse(read("people/article-people.json"));
  for (const list of Object.values(mapping)) for (const slug of list) assert.ok(slugs.includes(slug), slug);
});
