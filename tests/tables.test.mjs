import test from "node:test";
import assert from "node:assert/strict";
import { markdownToHtml } from "../src/lib/markdown.js";

test("renders a pipe table with a header and numeric values", () => {
  const html = markdownToHtml([
    "## Рейтинг",
    "",
    "| Сайт | Відвідування |",
    "| --- | ---: |",
    "| Yahoo Finance | 145,7 млн |",
    "| USA Today | 125,4 млн |",
    "",
    "Джерело: Press Gazette."
  ].join("\n"));
  assert.match(html, /<table><thead><tr><th>Сайт<\/th><th>Відвідування<\/th><\/tr><\/thead>/);
  assert.match(html, /<td>Yahoo Finance<\/td><td>145,7 млн<\/td>/);
  assert.match(html, /<p>Джерело: Press Gazette\.<\/p>/);
});

test("escapes HTML and script-like input in table cells", () => {
  const html = markdownToHtml("| Label | Value |\n| --- | --- |\n| <script>alert(1)</script> | 10 |");
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test("does not confuse ordinary text separated by a pipe with a table", () => {
  const html = markdownToHtml("This | that\nStill a paragraph");
  assert.doesNotMatch(html, /<table>/);
});
