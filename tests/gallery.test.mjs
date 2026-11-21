import test from "node:test";
import assert from "node:assert/strict";
import { markdownToHtml } from "../src/lib/markdown.js";

test("two or more photos in a row become one gallery, each with its own caption", () => {
  const html = markdownToHtml([
    "Абзац.",
    "",
    "![Перше](/img/news/a.jpg)",
    "*Перший підпис. Фото: Instagram.*",
    "",
    "![Друге](https://example.org/b.jpg)",
    "*Другий підпис.*",
    "",
    "Наступний абзац."
  ].join("\n"));
  assert.equal((html.match(/class="article-gallery"/g) || []).length, 1);
  assert.match(html, /data-count="2"/);
  assert.match(html, /data-index="1"[^]*Перший підпис[^]*data-index="2"[^]*Другий підпис/);
  assert.match(html, /<p>Наступний абзац\.<\/p>/);
});

test("a single photo stays a plain figure", () => {
  const html = markdownToHtml("![Одне](/img/news/a.jpg)\n*Підпис*\n\nТекст.");
  assert.doesNotMatch(html, /article-gallery/);
  assert.match(html, /<figure class="article-figure"><img src="\/img\/news\/a\.jpg"/);
});

test("photos separated by text are not grouped", () => {
  const html = markdownToHtml("![A](/img/news/a.jpg)\n\nТекст між ними.\n\n![B](/img/news/b.jpg)");
  assert.doesNotMatch(html, /article-gallery/);
  assert.equal((html.match(/<figure/g) || []).length, 2);
});

test("same-site /img/ paths render as images; other relative paths do not", () => {
  assert.match(markdownToHtml("![A](/img/news/a.jpg)"), /<img src="\/img\/news\/a\.jpg"/);
  assert.doesNotMatch(markdownToHtml("![A](javascript:alert(1))"), /<img/);
});

test("admin-style markdown (caption as its own paragraph) still forms a gallery with captions", () => {
  const html = markdownToHtml([
    "![A](https://news.promedia.report/img-storage/a.jpg)", "", "*Підпис А*", "",
    "![B](https://news.promedia.report/img-storage/b.jpg)", "", "*Підпис Б*", "", "Текст."
  ].join("\n"));
  assert.equal((html.match(/class="article-gallery"/g) || []).length, 1);
  assert.match(html, /<figcaption class="article-caption">Підпис А<\/figcaption>/);
  assert.match(html, /<figcaption class="article-caption">Підпис Б<\/figcaption>/);
  assert.doesNotMatch(html, /<p><em>Підпис/);
});
