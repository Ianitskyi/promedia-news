/*
 * ProMedia shared analytics — one GA4 tag for every *.promedia.report site.
 *
 * Connect on any page with a single line (no inline gtag snippet needed):
 *   <script async src="https://news.promedia.report/js/promedia-analytics.js"></script>
 *
 * What it does:
 * - loads GA4 only on promedia.report and its subdomains (never on localhost,
 *   127.0.0.1, *.workers.dev, previews or www); `?ga_debug=1` enables DebugView
 *   anywhere for testing;
 * - shares the GA cookie across subdomains (cookie_domain: auto);
 * - adds site_section, content_type, content_language and, for articles,
 *   author / publish_date to every event;
 * - never sends private links: ticket/invite/feedback/kiosk tokens and other random
 *   ids in the path become ":token", the query keeps only utm_* and search terms,
 *   the #fragment is dropped (page_location and page_referrer);
 * - sends page_view itself, also for in-app navigation (history.pushState) —
 *   the stream's "page changes based on browser history" setting is off;
 * - shows a one-time notice with an opt-out; the choice is stored in a cookie
 *   on .promedia.report and applies to all subdomains;
 * - exposes window.ProMediaAnalytics { optOut, optIn, isEnabled, track }.
 *
 * Never put personal data (email, phone, names of private persons) into events.
 */
(function (root) {
  "use strict";

  var MEASUREMENT_ID = "G-D8TM22QR9R";
  var DOMAIN = "promedia.report";
  var CHOICE_COOKIE = "pm_analytics";
  var NOTICE_COOKIE = "pm_analytics_notice";
  var DEBUG_KEY = "pm_ga_debug";
  var YEAR = 365 * 24 * 60 * 60;

  var SECTIONS = {
    "promedia.report": "main",
    "news.promedia.report": "news",
    "projects.promedia.report": "projects",
    "atlas.promedia.report": "atlas",
    "ratings.promedia.report": "ratings",
    "communities.promedia.report": "communities",
    "jobs.promedia.report": "jobs",
    "research.promedia.report": "research",
    "events.promedia.report": "events",
    "santa.promedia.report": "santa",
    "brief.promedia.report": "brief",
    "people.promedia.report": "people"
  };
  var CONTENT_TYPES = ["article", "tool", "project", "vacancy", "event", "profile", "page"];
  var TOOL_SECTIONS = ["atlas", "ratings", "communities"];

  var TEXT = {
    uk: {
      label: "Повідомлення про аналітику",
      body: "Ми використовуємо Google Analytics, щоб розуміти, які матеріали корисні читачам. Ви можете вимкнути аналітику на всіх сайтах ПроМедіа.",
      ok: "Добре",
      off: "Вимкнути аналітику",
      more: "Детальніше",
      offDone: "Аналітику вимкнено на всіх сайтах ПроМедіа."
    },
    en: {
      label: "Analytics notice",
      body: "We use Google Analytics to understand which materials are useful to readers. You can turn analytics off on all ProMedia sites.",
      ok: "OK",
      off: "Turn off analytics",
      more: "Learn more",
      offDone: "Analytics is turned off on all ProMedia sites."
    },
    // Machine draft: needs review by a native speaker per docs/CRIMEAN_TATAR_TRANSLATION_RULES.md
    crh: {
      label: "Analitika aqqında bildirim",
      body: "Biz oquyıcılarğa qaysı materiallar faydalı olğanını añlamaq içün Google Analytics qullanamız. Analitikanı bütün ProMedia saytlarında söndürip olasıñız.",
      ok: "Yahşı",
      off: "Analitikanı söndürmek",
      more: "Tafsilât",
      offDone: "Analitika bütün ProMedia saytlarında söndürildi."
    }
  };

  // ---------- pure helpers (exported for tests) ----------

  function normalizeHost(host) {
    return String(host || "").toLowerCase().replace(/\.$/, "");
  }

  function isProductionHost(host) {
    host = normalizeHost(host);
    if (host === "www." + DOMAIN) return false;
    return host === DOMAIN || host.slice(-(DOMAIN.length + 1)) === "." + DOMAIN;
  }

  function siteSection(host) {
    host = normalizeHost(host);
    if (SECTIONS[host]) return SECTIONS[host];
    if (isProductionHost(host)) return host.slice(0, -(DOMAIN.length + 1)).split(".").pop();
    return "other";
  }

  function contentLanguage(pathname, htmlLang) {
    var first = String(pathname || "/").split("/").filter(Boolean)[0];
    if (first === "en" || first === "crh") return first;
    var lang = String(htmlLang || "").toLowerCase();
    if (lang.indexOf("crh") === 0) return "crh";
    if (lang.indexOf("en") === 0) return "en";
    return "uk";
  }

  function contentType(section, pathname, hints) {
    hints = hints || {};
    if (hints.declared && CONTENT_TYPES.indexOf(hints.declared) !== -1) return hints.declared;
    var path = String(pathname || "/").replace(/^\/(en|crh)(?=\/|$)/, "") || "/";
    if (section === "news" && /^\/article\//.test(path)) return "article";
    if (section === "projects" && /^\/project\//.test(path)) return "project";
    if (section === "main" && /^\/projects\/(?!category\/)[^/]+/.test(path)) return "project";
    if (section === "jobs" && /^\/vacanc(y|ies)\b/.test(path)) return "vacancy";
    if (section === "events" && /^\/(event|events)\/[^/]+/.test(path)) return "event";
    if (section === "people" && /^\/[^/]+\/?$/.test(path)) return "profile";
    if (section === "research" && /^\/(research|membership-guide\/handbook)\//.test(path)) return "article";
    if (hints.ogType === "article") return "article";
    if (TOOL_SECTIONS.indexOf(section) !== -1) return "tool";
    return "page";
  }

  function readCookie(cookieString, name) {
    var parts = String(cookieString || "").split(";");
    for (var i = 0; i < parts.length; i++) {
      var pair = parts[i].split("=");
      if (pair[0].trim() === name) return decodeURIComponent(pair.slice(1).join("=").trim());
    }
    return null;
  }

  function pageContext(loc, doc) {
    var meta = function (selector) {
      var el = doc && doc.querySelector ? doc.querySelector(selector) : null;
      return el ? (el.getAttribute("content") || "").trim() : "";
    };
    var section = siteSection(loc.hostname);
    var type = contentType(section, loc.pathname, {
      declared: meta('meta[name="promedia:content-type"]'),
      ogType: meta('meta[property="og:type"]')
    });
    var params = {
      site_section: section,
      content_type: type,
      content_language: contentLanguage(loc.pathname, doc && doc.documentElement ? doc.documentElement.lang : "")
    };
    if (type === "article") {
      var author = meta('meta[property="article:author"]') || meta('meta[name="author"]');
      var published = meta('meta[property="article:published_time"]');
      if (author && !/^https?:/i.test(author)) params.author = author.slice(0, 100);
      if (/^\d{4}-\d{2}-\d{2}/.test(published)) params.publish_date = published.slice(0, 10);
    }
    return params;
  }


  // ---------- private-link protection ----------
  // A path segment right after one of these is a secret (QR ticket, invitation,
  // feedback link, kiosk/event id) and is never sent to Google Analytics.
  var TOKEN_ROUTES = ["t", "ticket", "tickets", "feedback", "invite", "invitation", "token", "confirm", "verify", "reset-password", "unsubscribe", "kiosk", "checkin"];
  var KEEP_PARAMS = /^(utm_(source|medium|campaign|term|content|id)|q|s|search|query)$/;

  function looksLikeToken(segment) {
    segment = String(segment || "");
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)) return true;
    if (/^[0-9a-f]{24,}$/i.test(segment)) return true;
    // Random base64url tokens mix cases and digits; readable slugs are lowercase.
    return segment.length >= 20 && /^[A-Za-z0-9_-]+$/.test(segment) &&
      /[A-Z]/.test(segment) && /[a-z]/.test(segment) && /[0-9]/.test(segment);
  }

  function sanitizePath(pathname) {
    var parts = String(pathname || "/").split("/");
    for (var i = 1; i < parts.length; i++) {
      if (!parts[i]) continue;
      var prev = (parts[i - 1] || "").toLowerCase();
      if (TOKEN_ROUTES.indexOf(prev) !== -1 || looksLikeToken(parts[i])) parts[i] = ":token";
    }
    return parts.join("/") || "/";
  }

  function sanitizeUrl(href) {
    var URLCtor = root.URL;
    if (!href || typeof URLCtor !== "function") return "";
    var url;
    try { url = new URLCtor(String(href)); } catch (e) { return ""; }
    var kept = [];
    url.searchParams.forEach(function (value, key) {
      if (KEEP_PARAMS.test(key) && !looksLikeToken(value)) kept.push(encodeURIComponent(key) + "=" + encodeURIComponent(value));
    });
    return url.protocol + "//" + url.host + sanitizePath(url.pathname) + (kept.length ? "?" + kept.join("&") : "");
  }

  // Referrers from ProMedia sites are cleaned the same way; other sites keep only their origin and path.
  function sanitizeReferrer(referrer) {
    if (!referrer) return "";
    var URLCtor = root.URL;
    if (typeof URLCtor !== "function") return "";
    try {
      var url = new URLCtor(String(referrer));
      if (isProductionHost(url.hostname)) return sanitizeUrl(referrer);
      return url.protocol + "//" + url.host + url.pathname;
    } catch (e) { return ""; }
  }

  var api = {
    MEASUREMENT_ID: MEASUREMENT_ID,
    isProductionHost: isProductionHost,
    siteSection: siteSection,
    contentLanguage: contentLanguage,
    contentType: contentType,
    readCookie: readCookie,
    pageContext: pageContext,
    looksLikeToken: looksLikeToken,
    sanitizePath: sanitizePath,
    sanitizeUrl: sanitizeUrl,
    sanitizeReferrer: sanitizeReferrer
  };

  // ---------- browser runtime ----------

  var doc = root.document;
  var loc = root.location;
  if (!doc || !loc) {
    root.ProMediaAnalytics = api;
    return;
  }
  if (root.ProMediaAnalytics && root.ProMediaAnalytics.started) return;

  var host = normalizeHost(loc.hostname);
  var production = isProductionHost(host);
  var debug = false;
  try {
    var q = new URLSearchParams(loc.search).get("ga_debug");
    if (q === "1") root.sessionStorage.setItem(DEBUG_KEY, "1");
    if (q === "0") root.sessionStorage.removeItem(DEBUG_KEY);
    debug = root.sessionStorage.getItem(DEBUG_KEY) === "1";
  } catch (e) {
    debug = /[?&]ga_debug=1\b/.test(loc.search || "");
  }

  root.dataLayer = root.dataLayer || [];
  if (typeof root.gtag !== "function") {
    root.gtag = function () { root.dataLayer.push(arguments); };
  }

  var lang = contentLanguage(loc.pathname, doc.documentElement ? doc.documentElement.lang : "");
  var t = TEXT[lang] || TEXT.uk;
  var loaded = false;

  function setCookie(name, value, maxAge) {
    var domain = production ? "; Domain=" + DOMAIN : "";
    doc.cookie = name + "=" + encodeURIComponent(value) + "; Max-Age=" + maxAge + "; Path=/" + domain + "; SameSite=Lax; Secure";
  }

  function choice() {
    return readCookie(doc.cookie, CHOICE_COOKIE);
  }

  function removeGaCookies() {
    var suffix = MEASUREMENT_ID.replace(/^G-/, "");
    ["_ga", "_ga_" + suffix].forEach(function (name) {
      doc.cookie = name + "=; Max-Age=0; Path=/";
      doc.cookie = name + "=; Max-Age=0; Path=/; Domain=" + DOMAIN;
      doc.cookie = name + "=; Max-Age=0; Path=/; Domain=." + DOMAIN;
    });
  }

  function assign(target, source) {
    for (var key in source) target[key] = source[key];
    return target;
  }

  var lastLocation = "";

  function sendPageView(referrer) {
    var params = pageContext(loc, doc);
    var location = sanitizeUrl(loc.href);
    lastLocation = location;
    root.gtag("set", assign({ page_location: location, page_referrer: referrer }, params));
    root.gtag("event", "page_view", assign({ page_location: location, page_referrer: referrer, page_title: doc.title }, params));
  }

  // In-app navigation (Next.js and other single-page apps): one cleaned page_view per new address.
  function watchHistory() {
    var history = root.history;
    function changed() {
      root.setTimeout(function () {
        if (!loaded || !isEnabled()) return;
        var next = sanitizeUrl(loc.href);
        if (!next || next === lastLocation) return;
        sendPageView(lastLocation);
      }, 150);
    }
    ["pushState", "replaceState"].forEach(function (method) {
      var original = history && history[method];
      if (typeof original !== "function") return;
      history[method] = function () {
        var result = original.apply(this, arguments);
        changed();
        return result;
      };
    });
    if (root.addEventListener) root.addEventListener("popstate", changed);
  }

  function load() {
    if (loaded) return;
    loaded = true;
    root["ga-disable-" + MEASUREMENT_ID] = false;
    var params = pageContext(loc, doc);
    root.gtag("js", new Date());
    var config = {
      cookie_domain: "auto",
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    };
    assign(config, params);
    if (debug) config.debug_mode = true;
    root.gtag("config", MEASUREMENT_ID, config);
    sendPageView(sanitizeReferrer(doc.referrer));
    watchHistory();
    var script = doc.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + MEASUREMENT_ID;
    (doc.head || doc.documentElement).appendChild(script);
  }


  function optOut() {
    setCookie(CHOICE_COOKIE, "denied", YEAR);
    setCookie(NOTICE_COOKIE, "1", YEAR);
    root["ga-disable-" + MEASUREMENT_ID] = true;
    removeGaCookies();
    syncToggles();
  }

  function optIn() {
    setCookie(CHOICE_COOKIE, "granted", YEAR);
    setCookie(NOTICE_COOKIE, "1", YEAR);
    if (production || debug) load();
    syncToggles();
  }

  function isEnabled() {
    return choice() !== "denied";
  }

  function track(name, params) {
    if (!isEnabled()) return;
    root.gtag("event", name, params || {});
  }

  // Any element with data-pm-analytics-toggle becomes an on/off switch
  // (used by the global footer in promedia-global-shell.js).
  function syncToggles() {
    var on = isEnabled();
    var nodes = doc.querySelectorAll("[data-pm-analytics-toggle]");
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].setAttribute("aria-pressed", String(on));
      var label = on ? nodes[i].getAttribute("data-label-on") : nodes[i].getAttribute("data-label-off");
      if (label) nodes[i].textContent = label;
    }
  }

  doc.addEventListener("click", function (event) {
    var el = event.target && event.target.closest ? event.target.closest("[data-pm-analytics-toggle]") : null;
    if (!el) return;
    event.preventDefault();
    if (isEnabled()) optOut(); else optIn();
  });

  function showNotice() {
    if (!doc.body || doc.getElementById("pm-analytics-notice")) return;
    var style = doc.createElement("style");
    style.textContent =
      "#pm-analytics-notice{position:fixed;left:16px;bottom:16px;z-index:2147481500;max-width:min(420px,calc(100vw - 32px));box-sizing:border-box;padding:14px 16px;background:#fff;color:#0d0c5c;border:1px solid rgba(13,12,92,.15);border-radius:10px;box-shadow:0 8px 28px rgba(13,12,92,.16);font:14px/1.45 Montserrat,Arial,sans-serif}" +
      "#pm-analytics-notice p{margin:0 0 10px}" +
      "#pm-analytics-notice a{color:inherit}" +
      "#pm-analytics-notice .pm-an-actions{display:flex;flex-wrap:wrap;gap:8px}" +
      "#pm-analytics-notice button{font:inherit;cursor:pointer;border-radius:6px;padding:7px 14px;border:1px solid #0d0c5c;background:#0d0c5c;color:#fff}" +
      "#pm-analytics-notice button.pm-an-secondary{background:transparent;color:#0d0c5c}";
    var box = doc.createElement("div");
    box.id = "pm-analytics-notice";
    box.setAttribute("role", "region");
    box.setAttribute("aria-label", t.label);
    var privacy = "https://" + DOMAIN + (lang === "uk" ? "" : "/" + lang) + "/privacy-policy/";
    var p = doc.createElement("p");
    p.textContent = t.body + " ";
    var more = doc.createElement("a");
    more.href = privacy;
    more.textContent = t.more;
    p.appendChild(more);
    var actions = doc.createElement("div");
    actions.className = "pm-an-actions";
    var ok = doc.createElement("button");
    ok.type = "button";
    ok.textContent = t.ok;
    var off = doc.createElement("button");
    off.type = "button";
    off.className = "pm-an-secondary";
    off.textContent = t.off;
    ok.onclick = function () {
      setCookie(NOTICE_COOKIE, "1", YEAR);
      box.remove();
    };
    off.onclick = function () {
      optOut();
      p.textContent = t.offDone;
      actions.remove();
      root.setTimeout(function () { box.remove(); }, 2500);
    };
    actions.appendChild(ok);
    actions.appendChild(off);
    box.appendChild(p);
    box.appendChild(actions);
    doc.head.appendChild(style);
    doc.body.appendChild(box);
  }

  api.started = true;
  api.optOut = optOut;
  api.optIn = optIn;
  api.isEnabled = isEnabled;
  api.track = track;
  root.ProMediaAnalytics = api;

  if (!production && !debug) return; // localhost, 127.0.0.1, *.workers.dev, www, previews

  if (!isEnabled()) {
    root["ga-disable-" + MEASUREMENT_ID] = true;
  } else {
    load();
  }

  // Other network popups (language suggestion, memorial overlay) come first:
  // the notice waits until none of them is visible, so they never overlap.
  var OTHER_POPUPS = "#pm-language-suggest:not([hidden]), #pm-memorial-overlay:not([hidden])";
  function showNoticeWhenClear(attempt) {
    if (readCookie(doc.cookie, NOTICE_COOKIE) || !isEnabled()) return;
    if (doc.querySelector(OTHER_POPUPS)) {
      if (attempt < 120) root.setTimeout(function () { showNoticeWhenClear(attempt + 1); }, 1000);
      return;
    }
    showNotice();
  }

  function onReady() {
    syncToggles();
    if (!readCookie(doc.cookie, NOTICE_COOKIE) && isEnabled()) root.setTimeout(function () { showNoticeWhenClear(0); }, 1500);
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", onReady);
  else onReady();
})(typeof window !== "undefined" ? window : this);
