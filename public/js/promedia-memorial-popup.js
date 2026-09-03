(function () {
  "use strict";

  if (window.__PROMEDIA_MEMORIAL_POPUP__) return;
  window.__PROMEDIA_MEMORIAL_POPUP__ = true;

  var STYLE_ID = "pm-memorial-style";
  var OVERLAY_ID = "pm-memorial-overlay";
  var PREVIEW_PARAM = "promedia_memorial_preview";
  var NEWS_ORIGIN = "https://news.promedia.report";
  var forceUntil = hasPreviewFlag() ? Date.now() + 60000 : 0;
  var overlay = null;
  var active = false;
  var inertState = [];

  function hasPreviewFlag() {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.has(PREVIEW_PARAM) || window.location.hash.indexOf(PREVIEW_PARAM) !== -1;
    } catch (err) {
      return false;
    }
  }

  function isEnglishPage() {
    var lang = (document.documentElement.getAttribute("lang") || "").toLowerCase();
    var path = window.location.pathname;
    var search = window.location.search;
    return lang.indexOf("en") === 0 ||
      path === "/en" ||
      path.indexOf("/en/") === 0 ||
      /(?:[?&])lang=en(?:&|$)/.test(search);
  }

  function text() {
    return isEnglishPage()
      ? {
          title: "Honor them!",
          time: "09:00",
          body: "We pause for one minute to remember the names of those who gave their lives in Ukraine’s war of liberation against russia"
        }
      : {
          title: "Вшануй!",
          time: "09:00",
          body: "Зупиняємося на хвилину, щоб згадати імена полеглих у визвольній війні з росією"
        };
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch];
    });
  }

  function shouldShow() {
    if (Date.now() < forceUntil) return true;
    var now = new Date();
    return now.getHours() === 9 && now.getMinutes() === 0;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      "html.pm-memorial-locked, body.pm-memorial-locked { overflow: hidden !important; }",
      ".pm-memorial-overlay { position: fixed; inset: 0; z-index: 2147483000; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(8, 6, 79, .94); color: #fff; pointer-events: auto; font-family: Montserrat, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }",
      ".pm-memorial-overlay[hidden] { display: none !important; }",
      ".pm-memorial-panel { width: min(100%, 680px); padding: clamp(34px, 6vw, 58px) clamp(24px, 6vw, 52px); border: 1px solid rgba(255, 255, 255, .18); border-radius: 22px; background: linear-gradient(180deg, rgba(255, 255, 255, .10), rgba(255, 255, 255, .035)); box-shadow: 0 28px 80px rgba(0, 0, 0, .34); text-align: center; }",
      ".pm-memorial-mark { width: 76px; height: 4px; margin: 0 auto 26px; border-radius: 999px; background: #ffac33; }",
      ".pm-memorial-title { margin: 0; color: #ffac33; font-size: clamp(38px, 7vw, 72px); font-weight: 900; line-height: .95; letter-spacing: 0; }",
      ".pm-memorial-time { margin: 14px 0 0; color: #fff; font-size: clamp(44px, 8vw, 86px); font-weight: 800; line-height: 1; letter-spacing: 0; }",
      ".pm-memorial-body { max-width: 580px; margin: 24px auto 0; color: rgba(255, 255, 255, .90); font-size: clamp(18px, 3vw, 25px); font-weight: 600; line-height: 1.45; letter-spacing: 0; }",
      "@media (max-width: 520px) { .pm-memorial-overlay { padding: 18px; } .pm-memorial-panel { border-radius: 18px; } .pm-memorial-body { line-height: 1.5; } }"
    ].join("\n");
    document.head.appendChild(style);
  }

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.className = "pm-memorial-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "pm-memorial-title");
    overlay.tabIndex = -1;
    overlay.hidden = true;
    overlay.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  function renderOverlay() {
    var t = text();
    ensureOverlay().innerHTML =
      '<div class="pm-memorial-panel">' +
        '<div class="pm-memorial-mark" aria-hidden="true"></div>' +
        '<h2 class="pm-memorial-title" id="pm-memorial-title">' + escapeHtml(t.title) + '</h2>' +
        '<div class="pm-memorial-time">' + escapeHtml(t.time) + '</div>' +
        '<p class="pm-memorial-body">' + escapeHtml(t.body) + '</p>' +
      '</div>';
  }

  function lockPage() {
    inertState = [];
    Array.prototype.forEach.call(document.body.children, function (child) {
      if (child === overlay || child.tagName === "SCRIPT" || child.tagName === "STYLE") return;
      inertState.push({
        element: child,
        inert: child.hasAttribute("inert"),
        ariaHidden: child.getAttribute("aria-hidden")
      });
      child.setAttribute("inert", "");
      child.setAttribute("aria-hidden", "true");
    });
    document.documentElement.classList.add("pm-memorial-locked");
    document.body.classList.add("pm-memorial-locked");
  }

  function unlockPage() {
    inertState.forEach(function (state) {
      if (state.inert) state.element.setAttribute("inert", "");
      else state.element.removeAttribute("inert");
      if (state.ariaHidden === null) state.element.removeAttribute("aria-hidden");
      else state.element.setAttribute("aria-hidden", state.ariaHidden);
    });
    inertState = [];
    document.documentElement.classList.remove("pm-memorial-locked");
    document.body.classList.remove("pm-memorial-locked");
  }

  function blockBackgroundInteraction(event) {
    if (!active || !overlay) return;
    if (overlay.contains(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function installInteractionGuards() {
    [
      "click",
      "mousedown",
      "mouseup",
      "pointerdown",
      "pointerup",
      "touchstart",
      "touchend",
      "keydown",
      "submit"
    ].forEach(function (eventName) {
      document.addEventListener(eventName, blockBackgroundInteraction, true);
    });
  }

  function show() {
    if (!document.body) return;
    injectStyles();
    renderOverlay();
    if (!active) {
      active = true;
      lockPage();
    }
    overlay.hidden = false;
    try {
      overlay.focus({ preventScroll: true });
    } catch (err) {
      overlay.focus();
    }
  }

  function hide() {
    if (!active) return;
    active = false;
    if (overlay) overlay.hidden = true;
    unlockPage();
  }

  function sync() {
    if (shouldShow()) show();
    else hide();
  }

  function start() {
    loadLanguageSuggest();
    installInteractionGuards();
    sync();
    window.setInterval(sync, 1000);
  }

  function loadLanguageSuggest() {
    if (window.__PROMEDIA_LANGUAGE_SUGGEST__ || document.querySelector('script[data-promedia-language-suggest]')) return;
    var script = document.createElement("script");
    script.src = NEWS_ORIGIN + "/js/promedia-language-suggest.js";
    script.defer = true;
    script.dataset.promediaLanguageSuggest = "true";
    document.head.appendChild(script);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
