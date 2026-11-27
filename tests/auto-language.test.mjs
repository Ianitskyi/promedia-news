import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { primaryLanguage, pickLanguage, autoLanguageTarget, autoLanguageRedirect, withLanguageCookie, pathForLanguage } from "../src/lib/autoLanguage.js";

const LANGS = ["uk", "en", "crh", "de"];
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36";

function req(path, headers = {}, host = "news.promedia.report") {
  const url = new URL(path, `https://${host}`);
  return [new Request(url, { headers: { "User-Agent": CHROME, ...headers } }), url];
}

test("Мова браузера → мовна версія", () => {
  const cases = {
    uk: "uk", be: "uk", sr: "uk", ru: "uk", pl: "uk", cs: "uk", bg: "uk", hr: "uk",
    en: "en", fr: "en", es: "en", ja: "en", ka: "en",
    de: "de", gsw: "de",
    crh: "crh", tr: "crh", az: "crh", kk: "crh", tt: "crh", uz: "crh"
  };
  for (const [code, expected] of Object.entries(cases)) assert.equal(pickLanguage(code, LANGS), expected, code);
});

test("Нова мова на сайті відкривається нею в першу чергу", () => {
  assert.equal(pickLanguage("pl", [...LANGS, "pl"]), "pl");
  assert.equal(pickLanguage("fr", [...LANGS, "fr"]), "fr");
  assert.equal(pickLanguage("de", ["uk", "en"]), "en");
  assert.equal(pickLanguage("tr", ["uk", "en"]), "en");
});

test("Основна мова з Accept-Language", () => {
  assert.equal(primaryLanguage("de-AT,de;q=0.9,en;q=0.8"), "de");
  assert.equal(primaryLanguage("en;q=0.5, sr-Latn-RS"), "sr");
  assert.equal(primaryLanguage("*"), "");
  assert.equal(primaryLanguage(""), "");
});

test("Перший візит перенаправляє зі збереженням шляху й параметрів", () => {
  const [r, url] = req("/article/abc?utm_source=fb", { "Accept-Language": "en-US,en;q=0.9" });
  const target = autoLanguageTarget(r, url, LANGS);
  assert.equal(target, "en");
  const res = autoLanguageRedirect(url, LANGS, target);
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("Location"), "https://news.promedia.report/en/article/abc?utm_source=fb");
  assert.match(res.headers.get("Set-Cookie"), /pm_lang=en;.*Domain=\.promedia\.report/);

  const [r2, url2] = req("/en/", { "Accept-Language": "tr-TR" });
  assert.equal(autoLanguageRedirect(url2, LANGS, autoLanguageTarget(r2, url2, LANGS)).headers.get("Location"), "https://news.promedia.report/crh/");
  const [r3, url3] = req("/de/article/x", { "Accept-Language": "be" });
  assert.equal(autoLanguageRedirect(url3, LANGS, autoLanguageTarget(r3, url3, LANGS)).headers.get("Location"), "https://news.promedia.report/article/x");
  const [r4, url4] = req("/", { "Accept-Language": "de-CH" });
  assert.equal(autoLanguageRedirect(url4, LANGS, autoLanguageTarget(r4, url4, LANGS)).headers.get("Location"), "https://news.promedia.report/de/");
  assert.equal(pathForLanguage("/support/", LANGS, "en"), "/en/support/");
});

test("Не перенаправляємо: повторний візит, боти, перехід із сайту, ?lang, API, та сама мова", () => {
  const al = { "Accept-Language": "en" };
  const none = (path, headers) => { const [r, u] = req(path, { ...al, ...headers }); return autoLanguageTarget(r, u, LANGS); };
  assert.equal(none("/", { Cookie: "a=1; pm_lang=uk" }), null);
  assert.equal(none("/", { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" }), null);
  assert.equal(none("/", { "User-Agent": "facebookexternalhit/1.1" }), null);
  assert.equal(none("/", { "User-Agent": "TelegramBot (like TwitterBot)" }), null);
  assert.equal(none("/", { Referer: "https://promedia.report/en/" }), null);
  assert.equal(none("/?lang=uk"), null);
  assert.equal(none("/api/articles"), null);
  assert.equal(none("/sitemap.xml"), null);
  assert.equal(none("/admin"), null);
  assert.equal(none("/en/article/x"), null);
  const [r, u] = req("/", { "User-Agent": CHROME });
  assert.equal(autoLanguageTarget(r, u, LANGS), null); // без Accept-Language
});

test("Кука pm_lang ставиться на HTML-сторінку першого візиту", async () => {
  const [r, u] = req("/crh/article/x");
  const res = withLanguageCookie(r, u, new Response("<html>", { headers: { "Content-Type": "text/html; charset=utf-8" } }), LANGS);
  assert.match(res.headers.get("Set-Cookie"), /^pm_lang=crh;/);
  const [r2, u2] = req("/", { Cookie: "pm_lang=en" });
  const res2 = withLanguageCookie(r2, u2, new Response("<html>", { headers: { "Content-Type": "text/html" } }), LANGS);
  assert.equal(res2.headers.get("Set-Cookie"), null);
});

function runClient(href, { language = "en-US", cookie = "", referrer = "" } = {}) {
  const src = readFileSync(new URL("../public/js/promedia-language-suggest.js", import.meta.url), "utf8");
  const jar = [];
  const location = { href, protocol: "https:", hostname: new URL(href).hostname, pathname: new URL(href).pathname, replaced: null, replace(u) { this.replaced = u; } };
  const ctx = {
    URL, console,
    navigator: { languages: [language], language },
    document: { referrer, documentElement: { lang: "uk" }, get cookie() { return cookie; }, set cookie(v) { jar.push(v); } },
    localStorage: { getItem: () => null },
    location
  };
  ctx.window = { location, localStorage: ctx.localStorage };
  vm.runInNewContext(src, ctx);
  return { to: location.replaced, cookies: jar };
}

test("Клієнтський скрипт для піддоменів без воркера", () => {
  assert.equal(runClient("https://about.promedia.report/", { language: "de-DE" }).to, "https://about.promedia.report/de/");
  assert.equal(runClient("https://about.promedia.report/en/", { language: "kk-KZ" }).to, "https://about.promedia.report/crh/");
  assert.equal(runClient("https://about.promedia.report/en/", { language: "sr-RS" }).to, "https://about.promedia.report/");
  assert.equal(runClient("https://ratings.promedia.report/", { language: "tr" }).to, "https://ratings.promedia.report/en/");
  assert.equal(runClient("https://research.promedia.report/research/x-uk.html", { language: "fr" }).to, "https://research.promedia.report/research/x.html");
  assert.equal(runClient("https://about.promedia.report/", { language: "en", cookie: "pm_lang=uk" }).to, null);
  assert.equal(runClient("https://about.promedia.report/", { language: "en", referrer: "https://news.promedia.report/" }).to, null);
  const same = runClient("https://about.promedia.report/", { language: "uk-UA" });
  assert.equal(same.to, null);
  assert.match(same.cookies[0], /^pm_lang=uk;.*domain=\.promedia\.report/);
});
