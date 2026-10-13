import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
  const cover = readFileSync("public/admin/cover-editor.js", "utf8");
  const css = readFileSync("public/css/cover-editor.css", "utf8");
  await page.setContent('<!doctype html><html><body>' +
    '<input id="url" value="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'1200\' height=\'800\'%3E%3Crect width=\'1200\' height=\'800\' fill=\'teal\'/%3E%3C/svg%3E" />' +
    '<input id="crop" value="" /><div id="editor" class="cover-editor"></div></body></html>');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: cover });
  await page.evaluate(() => { window.editor = window.ProMediaCoverEditor.create("editor", "url", "crop"); });
  assert.equal(await page.locator(".cover-editor-tab").count(), 4);
  assert.equal(await page.locator(".cover-editor-stage").evaluate(el => el.style.display), "");
  await page.locator(".cover-x").fill("70");
  await page.locator(".cover-y").fill("30");
  await page.getByText("Мобільний", { exact: false }).click();
  assert.equal(await page.locator(".cover-x").inputValue(), "50");
  await page.locator(".cover-x").fill("20");
  await page.locator(".cover-y").fill("80");
  await page.getByText("Десктоп", { exact: false }).click();
  assert.equal(await page.locator(".cover-x").inputValue(), "70");
  assert.equal(await page.locator(".cover-y").inputValue(), "30");
  await page.getByText("Мобільний", { exact: false }).click();
  assert.equal(await page.locator(".cover-y").inputValue(), "80");
  const point = await page.evaluate(() => window.editor.getValue());
  assert.deepEqual(point.desktop, {x:70,y:30});
  assert.deepEqual(point.mobile, {x:20,y:80});
  const before = await page.locator(".cover-editor-stage").boundingBox();
  assert.ok(before.height > before.width, "Mobile crop preview must be portrait");
  await page.getByRole("button", {name:"Застосувати позицію до всіх форматів"}).click();
  const all = await page.evaluate(() => window.editor.getValue());
  for (const k of ["desktop","mobile","social","feed"]) assert.deepEqual(all[k], {x:20,y:80});
  await page.getByRole("button", {name:"Центрувати"}).click();
  assert.deepEqual((await page.evaluate(() => window.editor.getValue())).mobile, {x:50,y:50});
  const fresh = await page.evaluate(() => window.editor.getValue());
  await page.evaluate(() => window.editor.setValue({mobile:{x:10,y:12},social:{x:80,y:70}}));
  assert.deepEqual((await page.evaluate(() => window.editor.getValue())).social, {x:80,y:70});
  assert.ok(fresh.desktop);
  console.log("Browser crop editor smoke test passed");
} finally { await browser.close(); }
