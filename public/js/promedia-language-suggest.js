(function () {
  "use strict";

  // Автовибір мови для першого візиту на сайти ПроМедіа.
  //
  // Людина вперше на будь-якому сайті ПроМедіа (немає куки pm_lang на .promedia.report) —
  // відкриваємо версію мовою її браузера/системи:
  //   • мова, яка в нас уже є на цьому сайті (en, de, crh, згодом pl, fr…) — саме вона;
  //   • слов'янські (білоруська, сербська, російська, польська тощо) — українська;
  //   • тюркські (турецька, азербайджанська, казахська, татарська тощо) — кримськотатарська;
  //   • німецькомовні варіанти — німецька;
  //   • усе інше — англійська.
  // Далі кука pm_lang запам'ятовує, що перший візит уже був, і ми нікого не перекидаємо.
  //
  // На promedia.report, news. і projects. це робить сервер (src/lib/autoLanguage.js) ще до
  // показу сторінки — там скрипт лише бачить куку й нічого не робить. Тут — для піддоменів
  // без власного воркера. Таблиці мов у двох файлах мають збігатися.

  if (window.__PROMEDIA_LANGUAGE_SUGGEST__) return;
  window.__PROMEDIA_LANGUAGE_SUGGEST__ = true;

  var LANG_COOKIE = "pm_lang";
  var LEGACY_CHOICE_KEY = "promedia.language.choice.v1";
  var LEGACY_SEEN_KEY = "promedia.language.seen.v1";
  var COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

  var SLAVIC = ["uk", "be", "ru", "pl", "cs", "sk", "sl", "hr", "sr", "bs", "mk", "bg", "sh", "cnr", "rue", "csb", "szl", "hsb", "dsb"];
  var TURKIC = ["crh", "tr", "az", "kk", "ky", "uz", "tk", "tt", "ba", "cv", "ug", "sah", "gag", "krc", "kum", "nog", "alt", "tyv", "kaa", "kjh"];
  var GERMANIC_DE = ["de", "gsw"];

  // Які мови є на кожному сайті (перша — типова, без префікса в адресі).
  // Нова мовна версія з'явилася — допишіть її сюди.
  var ALL = ["uk", "en", "crh", "de"];
  var SITES = {
    "promedia.report": { langs: ALL },
    "news.promedia.report": { langs: ALL },
    "projects.promedia.report": { langs: ALL },
    "about.promedia.report": { langs: ALL },
    "ratings.promedia.report": { langs: ["uk", "en"] },
    "communities.promedia.report": { langs: ["uk", "en"], rootSlash: true },
    "research.promedia.report": { langs: ["uk", "en"], research: true }
  };

  function cookieGet(key) {
    try {
      var parts = document.cookie ? document.cookie.split(";") : [];
      for (var i = 0; i < parts.length; i += 1) {
        var pair = parts[i].trim();
        var eq = pair.indexOf("=");
        var name = eq === -1 ? pair : pair.slice(0, eq);
        if (name === key) return decodeURIComponent(eq === -1 ? "" : pair.slice(eq + 1));
      }
    } catch (err) {}
    return null;
  }

  function isPromediaHost(host) {
    return host === "promedia.report" || host.slice(-16) === ".promedia.report";
  }

  function cookieSet(key, value) {
    try {
      var attrs = "; path=/; max-age=" + COOKIE_MAX_AGE + "; SameSite=Lax";
      if (window.location.protocol === "https:") attrs += "; Secure";
      if (isPromediaHost(window.location.hostname.toLowerCase())) attrs += "; domain=.promedia.report";
      document.cookie = key + "=" + encodeURIComponent(value) + attrs;
    } catch (err) {}
  }

  function storageGet(key) {
    try { return window.localStorage.getItem(key); }
    catch (err) { return null; }
  }

  function deviceLanguage() {
    var languages = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""];
    return String(languages[0] || "").toLowerCase().split(/[-_]/)[0];
  }

  function pickLanguage(code, available) {
    var has = function (lang) { return available.indexOf(lang) !== -1; };
    var fallback = has("en") ? "en" : available[0];
    if (!code) return null;
    if (has(code)) return code;
    if (SLAVIC.indexOf(code) !== -1) return has("uk") ? "uk" : fallback;
    if (TURKIC.indexOf(code) !== -1) return has("crh") ? "crh" : fallback;
    if (GERMANIC_DE.indexOf(code) !== -1) return has("de") ? "de" : fallback;
    return fallback;
  }

  function prefixLanguage(path, available) {
    var m = path.match(/^\/([a-z]{2,3})(?=\/|$)/i);
    var code = m ? m[1].toLowerCase() : "";
    return code && code !== available[0] && available.indexOf(code) !== -1 ? code : available[0];
  }

  function currentLanguage(site) {
    var url = new URL(window.location.href);
    var queryLang = String(url.searchParams.get("lang") || "").toLowerCase();
    if (site.langs.indexOf(queryLang) !== -1) return queryLang;
    var path = url.pathname;
    if (site.research && path.indexOf("/research/") === 0 && /\.html$/i.test(path)) {
      return /-uk\.html$/i.test(path) ? "uk" : "en";
    }
    return prefixLanguage(path, site.langs);
  }

  function targetUrl(site, current, target) {
    var url = new URL(window.location.href);
    url.searchParams.delete("promedia_memorial_preview");
    url.searchParams.delete("lang");
    var path = url.pathname || "/";
    var isRoot = path === "/" || path === "/index.html" || /^\/[a-z]{2,3}\/(index\.html)?$/i.test(path) || /^\/[a-z]{2,3}$/i.test(path);

    if (site.research && path.indexOf("/research/") === 0 && /\.html$/i.test(path)) {
      if (target === "en") url.pathname = path.replace(/-uk\.html$/i, ".html");
      else url.pathname = path.replace(/(-uk)?\.html$/i, "-uk.html");
      return url.href;
    }
    if ((site.rootSlash || site.research) && isRoot) {
      url.pathname = target === site.langs[0] ? "/" : "/" + target + "/";
      return url.href;
    }
    var rest = current === site.langs[0] ? path : path.slice(current.length + 1);
    if (rest.charAt(0) !== "/") rest = "/" + rest;
    url.pathname = target === site.langs[0] ? rest : "/" + target + (rest === "/" ? "/" : rest);
    return url.href;
  }

  function isAdminPath() {
    var path = window.location.pathname.toLowerCase();
    return path.indexOf("/admin") === 0 || path.indexOf("/admins") === 0 || path.indexOf("/api/") === 0;
  }

  function cameFromPromedia() {
    if (!document.referrer) return false;
    try { return isPromediaHost(new URL(document.referrer).hostname.toLowerCase()); }
    catch (err) { return false; }
  }

  function start() {
    if (isAdminPath()) return;
    if (cookieGet(LANG_COOKIE)) return; // уже не перший візит

    var site = SITES[window.location.hostname.toLowerCase()];
    var current = site ? currentLanguage(site) : (String(document.documentElement.lang || "uk").toLowerCase().split("-")[0] || "uk");

    // Людина вже бувала на сайтах ПроМедіа до цього правила — нічого не міняємо.
    var returning = storageGet(LEGACY_CHOICE_KEY) || cookieGet(LEGACY_SEEN_KEY);
    if (!site || returning || navigator.webdriver || cameFromPromedia() || new URL(window.location.href).searchParams.has("lang")) {
      cookieSet(LANG_COOKIE, current);
      return;
    }

    var target = pickLanguage(deviceLanguage(), site.langs);
    if (!target || target === current) {
      cookieSet(LANG_COOKIE, current);
      return;
    }
    var href = targetUrl(site, current, target);
    cookieSet(LANG_COOKIE, target);
    if (href && href !== window.location.href) window.location.replace(href);
  }

  start();
})();
