import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const markdown = await import("data:text/javascript;base64," + Buffer.from(read("src/lib/markdown.js")).toString("base64"));
const admin = read("public/admin/admin.js");
const editorSource = admin.slice(admin.indexOf("  function normalizeUrl("), admin.indexOf("  function commandButton("));
const editor = new Function("escapeHtml", "Node", editorSource + "; return {markdownToEditorHtml, inlineNodeToMarkdown};")(
  markdown.escapeHtml, { TEXT_NODE: 3, ELEMENT_NODE: 1 }
);

test("Glossary term renders as a button with a hidden note", () => {
  const html = markdown.markdownToHtml("Допомога [[ЗСУ|**Збройні сили** України]] сьогодні.");
  assert.match(html, /<span class="term"><button type="button" class="term-word" aria-expanded="false">ЗСУ<\/button>/);
  assert.match(html, /<span class="term-note" role="tooltip"><strong>Збройні сили<\/strong> України<\/span><\/span>/);
});

test("Glossary note escapes HTML and does not break links or tables", () => {
  const html = markdown.markdownToHtml('[[XSS|<script>alert(1)</script>]] і [лінк](https://example.org)');
  assert.doesNotMatch(html, /<script/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<a href="https:\/\/example.org"/);
  const table = markdown.markdownToHtml("| A | B |\n|---|---|\n| [[ОТГ\\|об'єднана громада]] | 2 |");
  assert.match(table, /<td><span class="term">.*ОТГ.*об&#39;єднана громада/);
});

test("Plain text and excerpts keep only the term", () => {
  assert.equal(markdown.markdownToPlainText("Про [[ЗСУ|Збройні сили України]] тут"), "Про ЗСУ тут");
});

test("Admin editor round-trips glossary terms", () => {
  const html = editor.markdownToEditorHtml("Текст [[НСЖУ|Національна спілка журналістів України]].");
  assert.match(html, /<span class="admin-term" data-term-note="Національна спілка журналістів України"/);
  const node = {
    nodeType: 1, tagName: "SPAN", dataset: {},
    childNodes: [{ nodeType: 3, nodeValue: "НСЖУ" }],
    getAttribute: (name) => (name === "data-term-note" ? "Національна | спілка [журналістів]" : null)
  };
  assert.equal(editor.inlineNodeToMarkdown(node), "[[НСЖУ|Національна спілка журналістів]]");
});
