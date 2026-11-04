import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const importSource = (source) => import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const typographySource = read("src/lib/typography.js");
const { normalizeUkrainianQuotes: quotes, normalizeUkrainianFields: fields, ukrainianTypographyReplacer: replacer } = await importSource(typographySource);
const markdown = await importSource(read("src/lib/markdown.js"));

test("Ukrainian quotation styles, nesting and repeated normalization", () => {
  for (const text of ['ГО “ПроМедіа”', 'ГО "ПроМедіа"', 'ГО „ПроМедіа“', 'ГО «ПроМедіа»']) {
    assert.equal(quotes(text), 'ГО «ПроМедіа»');
  }
  for (const text of ['«Він сказав: “Починаємо”»', '“Він сказав: «Починаємо»”', '"Він сказав: "Починаємо""']) {
    const result = quotes(text);
    assert.equal(result, '«Він сказав: “Починаємо”»');
    assert.equal(quotes(result), result);
  }
});

test("Only prose quote pairs change; apostrophes, inches, code and link targets survive", () => {
  const original = 'Марʼян, п’ять, комп\'ютер, 15". “Тест”\n\n[“Назва”](https://example.org/?q="test") `const x = "x"`\n\n```js\nconst x = "x";\n```\n\n<div title="test">';
  const expected = 'Марʼян, п’ять, комп\'ютер, 15". «Тест»\n\n[«Назва»](https://example.org/?q="test") `const x = "x"`\n\n```js\nconst x = "x";\n```\n\n<div title="test">';
  assert.equal(quotes(original), expected);
  assert.equal(quotes('Незавершена “цитата'), 'Незавершена “цитата');
  assert.equal(quotes('*"Професійні діалоги"*\n\n## **"Не вдягати біле пальто"**'), '*«Професійні діалоги»*\n\n## **«Не вдягати біле пальто»**');
  assert.equal(quotes(null), null);
});

test("Public API and admin fields keep translations and non-editorial data", () => {
  const record = { title:'ГО “ПроМедіа”', excerpt:'Про "освіту"', bodyMd:'[“Рейтинг”](https://example.org/?q="test")', titleEn:'“ProMedia”', titleCrh:'“ProMedia”', coverImageUrl:'https://example.org/a"b', coverCropData:{x:50}, status:'published', partner:'ГО “Партнер”' };
  const normalized = fields(record);
  assert.equal(normalized.title, 'ГО «ПроМедіа»');
  assert.equal(normalized.partner, 'ГО «Партнер»');
  assert.equal(normalized.bodyMd, '[«Рейтинг»](https://example.org/?q="test")');
  for (const key of ['titleEn','titleCrh','coverImageUrl','status']) assert.equal(normalized[key],record[key]);
  assert.equal(normalized.coverCropData, record.coverCropData);
  assert.equal(JSON.parse(JSON.stringify({items:[record]},replacer)).items[0].title, normalized.title);
});

function renderFunctions(path, names) {
  const source = read(path).replace(/^import .*?;\s*/gm, '').replace(/export /g, '');
  return new Function('markdownToHtml','markdownToPlainText','escapeHtml','normalizeUkrainianQuotes',source + '; return {'+names.join(',')+'};')(
    markdown.markdownToHtml, markdown.markdownToPlainText, markdown.escapeHtml, quotes
  );
}

test("Old news has the same quotes in title, body, card and sharing metadata", () => {
  const {renderArticlePage,renderHomepage} = renderFunctions('src/lib/render.js',['renderArticlePage','renderHomepage']);
  const article = {slug:'test',title:'ГО “ПроМедіа”',excerpt:'Про "освіту"',body_md:'“Пряма цитата”\n\n[“Рейтинг”](https://example.org/)',tags:'[]',title_en:'“ProMedia”',body_md_en:'“English quote”',excerpt_en:'English'};
  const page = renderArticlePage({article,lang:'uk',baseUrl:'https://news.promedia.report',relatedMediaNames:[]});
  assert.match(page, /<h1>ГО «ПроМедіа»<\/h1>/);
  assert.match(page, /property="og:title" content="ГО «ПроМедіа» — Новини ПроМедіа"/);
  assert.match(page, /«Пряма цитата»/);
  assert.match(page, /href="https:\/\/example.org\/"[^>]*>«Рейтинг»<\/a>/);
  assert.match(renderHomepage({articles:[article],lang:'uk',baseUrl:'https://news.promedia.report'}), /ГО «ПроМедіа»/);
  const en = renderArticlePage({article,lang:'en',baseUrl:'https://news.promedia.report',relatedMediaNames:[]});
  assert.match(en, /<h1>“ProMedia”<\/h1>/);
  assert.match(en, /“English quote”/);
});

test("Project descriptions and partners follow the same Ukrainian style", () => {
  const {renderProjectPage} = renderFunctions('src/lib/projectRender.js',['renderProjectPage']);
  const project={slug:'test',title:'Проєкт “Тест”',body_md:'“Опис”',work_md:'Робота "команди"',results_md:'“Результат”',partner:'ГО “ПроМедіа”',tags:'[]'};
  const page=renderProjectPage({project,lang:'uk',baseUrl:'https://projects.promedia.report'});
  for(const value of ['Проєкт «Тест»','«Опис»','Робота «команди»','«Результат»','ГО «ПроМедіа»']) assert.ok(page.includes(value),value);
});
