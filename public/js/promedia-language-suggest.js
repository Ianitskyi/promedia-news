(function () {
  "use strict";

  if (window.__PROMEDIA_LANGUAGE_SUGGEST__) return;
  window.__PROMEDIA_LANGUAGE_SUGGEST__ = true;

  var STYLE_ID = "pm-language-suggest-style";
  var PROMPT_ID = "pm-language-suggest";
  var CHOICE_KEY = "promedia.language.choice.v1";
  var DISMISSED_KEY = "promedia.language.dismissed.v1";
  var LOCAL_LANGUAGE_CODES = ["uk", "ru", "pl", "bg", "be"];
  var SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

  function storageGet(key) {
    try { return window.localStorage.getItem(key); }
    catch (err) { return null; }
  }

  function storageSet(key, value) {
    try { window.localStorage.setItem(key, value); }
    catch (err) {}
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch];
    });
  }

  function primaryDeviceLanguage() {
    var languages = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""];
    return String(languages[0] || "").toLowerCase();
  }

  function preferredLanguage() {
    var primary = primaryDeviceLanguage();
    var code = primary.split("-")[0];
    return LOCAL_LANGUAGE_CODES.indexOf(code) === -1 ? "en" : "uk";
  }

  function currentLanguage() {
    var params = new URLSearchParams(window.location.search);
    var queryLang = String(params.get("lang") || "").toLowerCase();
    if (queryLang === "en") return "en";
    if (queryLang === "uk") return "uk";

    var path = window.location.pathname.toLowerCase();
    if (path === "/en" || path.indexOf("/en/") === 0) return "en";

    var htmlLang = String(document.documentElement.getAttribute("lang") || "").toLowerCase();
    if (htmlLang.indexOf("en") === 0) return "en";
    return "uk";
  }

  function isAdminPath() {
    var path = window.location.pathname.toLowerCase();
    return path.indexOf("/admin") === 0 || path.indexOf("/admins") === 0 || path.indexOf("/api/") === 0;
  }

  function cleanSearch(url) {
    url.searchParams.delete("promedia_memorial_preview");
    return url;
  }

  function withQueryLanguage(targetLang) {
    var url = cleanSearch(new URL(window.location.href));
    if (targetLang === "en") url.searchParams.set("lang", "en");
    else url.searchParams.set("lang", "uk");
    return url.href;
  }

  function withPathPrefixLanguage(targetLang) {
    var url = cleanSearch(new URL(window.location.href));
    var path = url.pathname || "/";
    if (targetLang === "en") {
      if (path === "/") url.pathname = "/en";
      else if (path !== "/en" && path.indexOf("/en/") !== 0) url.pathname = "/en" + path;
    } else {
      if (path === "/en") url.pathname = "/";
      else if (path.indexOf("/en/") === 0) url.pathname = path.slice(3) || "/";
    }
    url.searchParams.delete("lang");
    return url.href;
  }

  function researchLanguageUrl(targetLang) {
    var url = cleanSearch(new URL(window.location.href));
    var path = url.pathname || "/";
    if (path === "/" || path === "/index.html" || path === "/en/" || path === "/en/index.html") {
      url.pathname = targetLang === "en" ? "/en/" : "/";
      url.searchParams.delete("lang");
      return url.href;
    }
    if (path.indexOf("/research/") === 0 && /\.html$/i.test(path)) {
      if (targetLang === "en" && /-uk\.html$/i.test(path)) {
        url.pathname = path.replace(/-uk\.html$/i, ".html");
        return url.href;
      }
      if (targetLang === "uk" && !/-uk\.html$/i.test(path)) {
        url.pathname = path.replace(/\.html$/i, "-uk.html");
        return url.href;
      }
    }
    return null;
  }

  function communitiesLanguageUrl(targetLang) {
    var url = cleanSearch(new URL(window.location.href));
    var path = url.pathname || "/";
    if (path === "/" || path === "/index.html" || path === "/en/" || path === "/en/index.html") {
      url.pathname = targetLang === "en" ? "/en/" : "/";
      url.searchParams.delete("lang");
      return url.href;
    }
    return withQueryLanguage(targetLang);
  }

  function targetLanguageUrl(targetLang) {
    var host = window.location.hostname.toLowerCase();
    if (host === "promedia.report") return withPathPrefixLanguage(targetLang);
    if (host === "news.promedia.report") return withQueryLanguage(targetLang);
    if (host === "ratings.promedia.report") return withQueryLanguage(targetLang);
    if (host === "communities.promedia.report") return communitiesLanguageUrl(targetLang);
    if (host === "research.promedia.report") return researchLanguageUrl(targetLang);
    return null;
  }

  function dismissedRecently(targetLang) {
    var raw = storageGet(DISMISSED_KEY);
    if (!raw) return false;
    try {
      var item = JSON.parse(raw);
      return item.target === targetLang && item.until && Date.now() < item.until;
    } catch (err) {
      return false;
    }
  }

  function rememberDismissal(targetLang) {
    storageSet(DISMISSED_KEY, JSON.stringify({ target: targetLang, until: Date.now() + SNOOZE_MS }));
  }

  function strings(targetLang) {
    return targetLang === "en"
      ? {
          title: "Switch to English?",
          body: "Your device language suggests that the English version may be more convenient.",
          primary: "Open English",
          secondary: "Stay here",
          close: "Close language suggestion"
        }
      : {
          title: "Перейти українською?",
          body: "За мовними налаштуваннями пристрою українська версія може бути зручнішою.",
          primary: "Відкрити українську",
          secondary: "Залишитися тут",
          close: "Закрити мовну пропозицію"
        };
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      ".pm-language-suggest { position: fixed; right: 18px; bottom: 18px; z-index: 2147482000; width: min(390px, calc(100vw - 36px)); padding: 18px; border: 1px solid rgba(13, 12, 92, .12); border-radius: 18px; background: #fff; color: #15142f; box-shadow: 0 18px 48px rgba(13, 12, 92, .20); font-family: Montserrat, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }",
      ".pm-language-suggest[hidden] { display: none !important; }",
      ".pm-language-suggest__close { position: absolute; top: 8px; right: 9px; width: 30px; height: 30px; border: 0; border-radius: 999px; background: transparent; color: #0d0c5c; cursor: pointer; font-size: 22px; line-height: 1; }",
      ".pm-language-suggest__close:hover { background: #fff2dd; }",
      ".pm-language-suggest__mark { width: 42px; height: 3px; margin: 0 0 12px; border-radius: 999px; background: #ffac33; }",
      ".pm-language-suggest h2 { margin: 0 34px 6px 0; color: #0d0c5c; font-size: 21px; font-weight: 800; line-height: 1.2; letter-spacing: 0; }",
      ".pm-language-suggest p { margin: 0; color: #5f6078; font-size: 13px; font-weight: 500; line-height: 1.5; letter-spacing: 0; }",
      ".pm-language-suggest__actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }",
      ".pm-language-suggest__primary, .pm-language-suggest__secondary { display: inline-flex; align-items: center; justify-content: center; min-height: 38px; padding: 9px 15px; border-radius: 999px; cursor: pointer; font: inherit; font-size: 12px; font-weight: 800; text-decoration: none; }",
      ".pm-language-suggest__primary { border: 1.5px solid #0d0c5c; background: #0d0c5c; color: #fff; }",
      ".pm-language-suggest__primary:hover { background: #201e78; }",
      ".pm-language-suggest__secondary { border: 1.5px solid #e7e7ef; background: #fff; color: #0d0c5c; }",
      ".pm-language-suggest__secondary:hover { border-color: #0d0c5c; }",
      "@media (max-width: 520px) { .pm-language-suggest { right: 12px; bottom: 12px; width: calc(100vw - 24px); border-radius: 16px; } }"
    ].join("\n");
    document.head.appendChild(style);
  }

  function renderPrompt(targetLang, targetUrl) {
    var t = strings(targetLang);
    injectStyles();
    var prompt = document.createElement("section");
    prompt.id = PROMPT_ID;
    prompt.className = "pm-language-suggest";
    prompt.setAttribute("aria-label", t.title);
    prompt.setAttribute("role", "dialog");
    prompt.innerHTML =
      '<button class="pm-language-suggest__close" type="button" aria-label="' + escapeHtml(t.close) + '">&times;</button>' +
      '<div class="pm-language-suggest__mark" aria-hidden="true"></div>' +
      '<h2>' + escapeHtml(t.title) + '</h2>' +
      '<p>' + escapeHtml(t.body) + '</p>' +
      '<div class="pm-language-suggest__actions">' +
        '<a class="pm-language-suggest__primary" href="' + escapeHtml(targetUrl) + '">' + escapeHtml(t.primary) + '</a>' +
        '<button class="pm-language-suggest__secondary" type="button">' + escapeHtml(t.secondary) + '</button>' +
      '</div>';
    document.body.appendChild(prompt);

    prompt.querySelector(".pm-language-suggest__primary").addEventListener("click", function () {
      storageSet(CHOICE_KEY, targetLang);
    });
    prompt.querySelector(".pm-language-suggest__secondary").addEventListener("click", function () {
      storageSet(CHOICE_KEY, currentLanguage());
      prompt.hidden = true;
    });
    prompt.querySelector(".pm-language-suggest__close").addEventListener("click", function () {
      rememberDismissal(targetLang);
      prompt.hidden = true;
    });
  }

  function start() {
    if (isAdminPath() || document.getElementById(PROMPT_ID)) return;
    if (storageGet(CHOICE_KEY)) return;
    var targetLang = preferredLanguage();
    if (targetLang === currentLanguage()) return;
    if (dismissedRecently(targetLang)) return;
    var targetUrl = targetLanguageUrl(targetLang);
    if (!targetUrl || targetUrl === window.location.href) return;
    renderPrompt(targetLang, targetUrl);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
