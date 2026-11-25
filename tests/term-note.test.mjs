import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const markdown = await import("data:text/javascript;base64," + Buffer.from(read("src/lib/markdown.js")).toString("base64"));

test("Word notes render as accessible tooltips and stay escaped", () => {
  const html = markdown.markdownToHtml("Країна {{Буркіна-Фасо::Держава в <b>Західній</b> Африці}} тут.");
  assert.match(html, /<span class="term-note" tabindex="0"><span class="term-note__word">Буркіна-Фасо<\/span><span class="term-note__text" role="note">Держава в &lt;b&gt;Західній&lt;\/b&gt; Африці<\/span><\/span>/);
  assert.doesNotMatch(html, /<b>/);
});

test("Word notes are dropped from plain text, keeping the word", () => {
  assert.equal(markdown.markdownToPlainText("У {{Буркіна-Фасо::довідка}} видали ордери."), "У Буркіна-Фасо видали ордери.");
});
