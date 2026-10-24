import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const get = (path) => readFileSync(path, "utf8");
const host = "http://promedia.test";
const user = { id: 1, name: "Тестовий редактор", email: "test@example.org", role: "admin" };
const research = [{
  id: "sample-research", year: 2026, date: "2026-10-01",
  title: { uk: "Дослідження", en: "Research", crh: "Tedqiqat" },
  summary: { uk: "Опис", en: "Description", crh: "Tarif" },
  tags: { uk: [], en: [], crh: [] }, authors: { uk: [], en: [], crh: [] },
  languages: { uk: { type: "full", url: "/research/sample-uk.html" }, en: { type: "full", url: "/research/sample.html" }, crh: { type: "full", url: "/research/sample-crh.html" } }
}];
const site = { id: "research", label: "research.promedia.report", liveUrl: "https://research.promedia.report", files: [{ id: "catalog", label: "Каталог досліджень", path: "data/research.json", type: "researchCatalog" }] };

async function setup(browser, path) {
  const page = await browser.newPage();
  const errors = [];
  const writes = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const p = url.pathname;
    if (p === "/api/me") return route.fulfill({ json: {user} });
    if (p === "/api/admin/articles" && request.method() === "GET") return route.fulfill({ json: {items: []} });
    if (p === "/api/admin/projects" && request.method() === "GET") return route.fulfill({ json: {items: []} });
    if (p === "/api/admin/subdomains" && request.method() === "GET") return route.fulfill({ json: { configured: true, items: [site] } });
    if (p === "/api/admin/subdomains/research/files/catalog" && request.method() === "GET")
      return route.fulfill({ json: { configured: true, file: site.files[0], site, sha: "fixture", content: JSON.stringify(research) } });
    if (p === "/api/admin/upload" || p === "/api/admin/projects/upload")
      return route.fulfill({ json: {url: "/img-storage/sample.jpg"} });
    if (request.method() === "POST" || request.method() === "PUT") {
      writes.push({path:p,method:request.method(),body:request.postData()});
      return route.fulfill({ json: {ok:true, id: 1, sha: "updated", commit: {sha:"1234567890",url:"https://github.com/example/commit/1234567890"}} });
    }
    const files = {
      "/admin/": "public/admin/index.html",
      "/admin/projects.html": "public/admin/projects.html",
      "/admin/admin.js": "public/admin/admin.js",
      "/admin/projects.js": "public/admin/projects.js",
      "/admin/cover-editor.js": "public/admin/cover-editor.js",
      "/admin/rich-editor.js": "public/admin/rich-editor.js",
      "/css/style.css": "public/css/style.css",
      "/css/cover-editor.css": "public/css/cover-editor.css",
    };
    if (files[p]) {
      const contentType = p.endsWith(".html") || p.endsWith("/") ? "text/html" : p.endsWith(".css") ? "text/css" : "application/javascript";
      return route.fulfill({ status: 200, contentType, body: get(files[p]) });
    }
    if (p.startsWith("/img-storage/")) return route.fulfill({status:404,body:"fixture image omitted"});
    return route.fulfill({status:404,body:"not part of mocked admin"});
  });
  await page.goto(host + path);
  return {page,errors,writes};
}

const browser = await chromium.launch({headless:true,args:["--no-sandbox"]});
try {
  {
    const {page, errors, writes} = await setup(browser, "/admin/#/new");
    await page.locator("#editor-form").waitFor();
    const trans = page.locator("#editor-form details.admin-translations");
    assert.equal(await trans.count(), 1);
    assert.equal(await trans.getAttribute("open"), null, "Translations must be collapsed by default");
    assert.equal(await trans.locator('[name="titleEn"]').count(), 1);
    assert.equal(await trans.locator('[name="bodyMdCrh"]').count(), 1);
    await page.locator('[name="title"]').fill("Тестове повідомлення");
    await page.locator('[data-rich-editor="bodyMd"] [data-editor-surface]').fill("Тестова українська стаття");
    await page.locator('#cover-url').evaluate(el => {el.value = "/img-storage/cover-uk.jpg";});
    await page.locator("#news-cover-crop .cover-x").evaluate(el => {el.value="65";el.dispatchEvent(new Event("input",{bubbles:true}));});
    await page.locator("#news-cover-crop .cover-y").evaluate(el => {el.value="35";el.dispatchEvent(new Event("input",{bubbles:true}));});
    await page.locator("#editor-form button[type=submit]").click();
    await page.waitForFunction(() => location.hash === "#/dashboard");
    const save = writes.find(x => x.path === "/api/admin/articles");
    assert.ok(save, "New article must be sent to the API");
    const payload = JSON.parse(save.body);
    assert.equal(payload.title, "Тестове повідомлення");
    assert.match(payload.bodyMd, /Тестова українська стаття/);
    assert.deepEqual(payload.coverCropData.desktop, {x:65,y:35});
    assert.deepEqual(errors, [], "No uncaught browser errors");
    console.log("News create + payload + folded translations passed");
    await page.close();
  }
  {
    const {page, errors, writes} = await setup(browser, "/admin/projects.html");
    await page.locator("#new-project").click();
    const trans = page.locator("#project-form details.admin-translations");
    assert.equal(await trans.count(), 1);
    assert.equal(await trans.getAttribute("open"), null);
    assert.equal(await trans.locator('[name="bodyMdEn"]').count(), 1);
    await page.locator('[name="title"]').fill("Тестовий проєкт");
    async function setProjectEditor(name, text) {
      await page.locator('[data-rich-editor="' + name + '"] [data-editor-surface]').evaluate((el, value) => {
        el.textContent = value;
        el.dispatchEvent(new InputEvent("input", {bubbles:true, inputType:"insertText", data:value}));
      }, text);
    }
    await setProjectEditor("bodyMd", "Опис проєкту");
    await setProjectEditor("workMd", "Що ми робили");
    await setProjectEditor("resultsMd", "Результати");
    await page.locator("#project-cover-url-field").evaluate(el => {el.value = "/img-storage/project-uk.jpg";});
    await page.locator("#project-cover-crop .cover-x").evaluate(el => {el.value="75";el.dispatchEvent(new Event("input",{bubbles:true}));});
    await page.locator("#project-form button[type=submit]").click();
    await page.waitForTimeout(100);
    const save = writes.find(x => x.path === "/api/admin/projects");
    assert.ok(save, "New project must be sent to API");
    const payload = JSON.parse(save.body);
    assert.equal(payload.title, "Тестовий проєкт");
    assert.equal(payload.coverCropData.desktop.x, 75);
    assert.match(payload.bodyMd, /Опис проєкту/);
    assert.match(payload.workMd, /Що ми робили/);
    assert.match(payload.resultsMd, /Результати/);
    assert.deepEqual(errors, [], "No uncaught browser errors");
    console.log("Project create + structured payload passed");
    await page.close();
  }
  {
    const {page, errors, writes} = await setup(browser, "/admin/#/subdomains/research/catalog");
    await page.locator(".admin-research-entry").first().waitFor();
    assert.equal(await page.locator(".admin-research-cover-field").count(), 2);
    assert.equal(await page.locator(".admin-research-entry details.admin-translations").count(), 2);
    const image = page.locator("#research-cover-url-uk-0");
    await image.fill("https://news.promedia.report/img-storage/research.jpg");
    const x = page.locator("#research-cover-editor-uk-0 .cover-x");
    await x.evaluate(el => {el.value="60";el.dispatchEvent(new Event("input",{bubbles:true}));});
    await page.locator("#subdomain-save").click();
    await page.locator("#subdomain-result").getByText("Збережено в GitHub", {exact:false}).waitFor();
    const save = writes.find(w => w.path === "/api/admin/subdomains/research/files/catalog" && w.method === "PUT");
    assert.ok(save, "Research catalog must save");
    const payload = JSON.parse(save.body);
    const updated = JSON.parse(payload.content);
    assert.equal(updated[0].coverImageUrl, "https://news.promedia.report/img-storage/research.jpg");
    assert.equal(updated[0].coverCropData.desktop.x, 60);
    assert.deepEqual(errors, [], "No uncaught browser errors");
    console.log("Research cover focal point + GitHub save payload passed");
    await page.close();
  }
} finally {
  await browser.close();
}
