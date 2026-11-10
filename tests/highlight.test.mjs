import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const markdown = await import("data:text/javascript;base64," + Buffer.from(read("src/lib/markdown.js")).toString("base64"));
const admin = read("public/admin/admin.js");
const editorSource = admin.slice(admin.indexOf("  function normalizeUrl("), admin.indexOf("  function commandButton("));
const editor = new Function("escapeHtml", "Node", editorSource + "; return {markdownToEditorHtml, editorHtmlToMarkdown};")(
  markdown.escapeHtml, { TEXT_NODE: 3, ELEMENT_NODE: 1 }
);
const text = (value) => ({nodeType: 3, nodeValue: value});
const element = (tag, children, attributes = {}) => ({
  nodeType: 1, tagName: tag.toUpperCase(), childNodes: children, dataset: {},
  getAttribute: (name) => attributes[name] || null
});

test("Highlights render in quotes, headings and all three article languages", () => {
  for (const phrase of ["Жодна бізнес-модель не працює", "No business model works", "İç bir biznes modeli işlemey"]) {
    const md = "## ==" + phrase + "==\n\n> ==**" + phrase + "**==";
    assert.match(markdown.markdownToHtml(md), /<h2><mark>/);
    assert.match(markdown.markdownToHtml(md), /<blockquote><p><mark><strong>/);
    assert.match(editor.markdownToEditorHtml(md), /background-color: #ffe66d/);
    assert.equal(markdown.markdownToPlainText(md), phrase + " " + phrase);
  }
});

test("Highlighted links retain URL syntax and escape untrusted HTML", () => {
  const md = '==[**Джерело**](https://example.org/?token=a==b==c&n=1)== та ==<script>alert(1)</script>==';
  const html = markdown.markdownToHtml(md);
  assert.match(html, /<mark><a href="https:\/\/example.org\/\?token=a==b==c&amp;n=1"/);
  assert.match(html, /<strong>Джерело<\/strong><\/a><\/mark>/);
  assert.doesNotMatch(html, /<script/);
  assert.match(html, /<mark>&lt;script&gt;/);
  assert.doesNotMatch(markdown.markdownToHtml("==[Bad](javascript:alert)=="), /href=/);
  const image = '![==literal alt==](https://example.org/image?token=a==b==c)';
  assert.match(markdown.markdownToHtml(image), /alt="==literal alt=="/);
  assert.doesNotMatch(markdown.markdownToHtml(image), /<mark>/);
});

test("Saving a browser highlight preserves spaces, bold, links and quote structure", () => {
  const surface = {childNodes: [element("blockquote", [element("p", [
    text("До "), element("span", [
      text("слова "), element("strong", [text("жовтим")]), text(" і "),
      element("a", [text("джерело")], {href: "https://example.org/"})
    ], {style: "background-color: rgb(255, 230, 109);"}), text(" після.")
  ])])]};
  const md = editor.editorHtmlToMarkdown(surface);
  assert.equal(md, "> До ==слова **жовтим** і [джерело](https://example.org/)== після.");
  assert.match(markdown.markdownToHtml(md), /<blockquote><p>До <mark>слова <strong>жовтим<\/strong> і <a /);
  assert.match(editor.markdownToEditorHtml(md), /background-color: #ffe66d/);
});

test("Removing a highlight leaves the text and other formatting intact", () => {
  const surface = {childNodes: [element("p", [
    text("До "), element("span", [element("strong", [text("важлива фраза")])], {style: "background-color: transparent;"}), text(" після.")
  ])]};
  assert.equal(editor.editorHtmlToMarkdown(surface), "До **важлива фраза** після.");
  const pastedMark = {childNodes: [element("p", [element("mark", [text(" ключова фраза ")])])]};
  assert.equal(editor.editorHtmlToMarkdown(pastedMark), "== ключова фраза ==");
});
