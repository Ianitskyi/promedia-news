import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const markdown = await import("data:text/javascript;base64," + Buffer.from(read("src/lib/markdown.js")).toString("base64"));
const typography = await import("data:text/javascript;base64," + Buffer.from(read("src/lib/typography.js")).toString("base64"));
const source = read("src/lib/render.js").replace(/^import .*?;\s*/gm, "").replace(/export /g, "");
const { renderArticlePage, renderHomepage } = new Function(
  "markdownToHtml", "markdownToPlainText", "escapeHtml", "normalizeUkrainianQuotes", "normalizeUkrainianTitle",
  source + ";return {renderArticlePage, renderHomepage};"
)(markdown.markdownToHtml, markdown.markdownToPlainText, markdown.escapeHtml, typography.normalizeUkrainianQuotes, typography.normalizeUkrainianTitle);

test("Article and feed tags translate despite capitalization, keeping filter identifiers", () => {
  const tags = ["Новини", "Дослідження", "Медіаграмотність", "Штучний інтелект", "Медіаспільноти"];
  const article = { slug: "media-2026", title: "Новина", title_en: "News", title_crh: "Haber",
    body_md: "Текст", body_md_en: "Text", body_md_crh: "Metin", tags: JSON.stringify(tags) };
  const expected = {
    en: ["News", "research", "media literacy", "artificial intelligence", "media communities"],
    crh: ["Haberler", "tedqiqat", "mediya savatlılığı", "suniy zekâ", "mediya cemaatları"]
  };
  for (const [lang, labels] of Object.entries(expected)) {
    const page = renderArticlePage({ article, lang, baseUrl: "https://news.promedia.report", relatedMediaNames: [] });
    const feed = renderHomepage({ articles: [article], lang, baseUrl: "https://news.promedia.report" });
    for (const label of labels) {
      assert.ok(page.includes(">" + label + "</a>"), lang + " article tag " + label);
      assert.ok(feed.includes(">" + label + "</a>"), lang + " feed tag " + label);
    }
    for (const tag of tags) assert.ok(page.includes("/" + lang + "/?tag=" + encodeURIComponent(tag)), "Canonical filter remains intact");
  }
  const ua = renderArticlePage({ article, lang: "uk", baseUrl: "https://news.promedia.report", relatedMediaNames: [] });
  for (const tag of tags) assert.ok(ua.includes(">" + tag + "</a>"));
});

test("Tag translation tolerates whitespace and uppercase, preserving unknown brands", () => {
  const article = { slug: "test", title: "Test", body_md: "Text",
    tags: JSON.stringify(["  ШТУЧНИЙ   ІНТЕЛЕКТ  ", "OpenAI"]) };
  const page = renderArticlePage({ article, lang: "en", baseUrl: "https://news.promedia.report", relatedMediaNames: [] });
  assert.ok(page.includes(">artificial intelligence</a>"));
  assert.ok(page.includes(">OpenAI</a>"));
});
