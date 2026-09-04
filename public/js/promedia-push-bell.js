(function () {
  "use strict";

  if (window.__PROMEDIA_PUSH_BELL__) return;
  window.__PROMEDIA_PUSH_BELL__ = true;

  var NEWS_ORIGIN = "https://news.promedia.report";
  var STYLE_ID = "pm-push-bell-style";
  var ROOT_ID = "pm-push-bell";
  var DISMISSED_KEY = "promedia.push.dismissed.v1";
  var SUBSCRIBED_KEY = "promedia.push.subscribed.v1";
  var PAGEVIEWS_KEY = "promedia.push.pageviews.v1";
  var DISMISS_TTL = 7 * 24 * 60 * 60 * 1000;
  var DEFAULT_DELAY = 75000;

  function hasParam(name) {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.has(name) || window.location.hash.indexOf(name) !== -1;
    } catch (err) {
      return false;
    }
  }

  function isEnglishPage() {
    var lang = (document.documentElement.getAttribute("lang") || "").toLowerCase();
    return lang.indexOf("en") === 0 ||
      window.location.pathname === "/en" ||
      window.location.pathname.indexOf("/en/") === 0 ||
      /(?:[?&])lang=en(?:&|$)/.test(window.location.search);
  }

  function copy() {
    return isEnglishPage()
      ? {
          open: "Open updates subscription",
          title: "Get ProMedia updates",
          body: "Subscribe to important news, statements, research and ProMedia projects.",
          subscribe: "Subscribe",
          later: "Later",
          unavailableTitle: "Subscription opens in News",
          unavailableBody: "This page cannot register notifications directly yet. Open ProMedia News to turn them on.",
          openNews: "Open News",
          active: "Subscription is active. Thank you.",
          denied: "Notifications are blocked in this browser.",
          error: "Could not enable notifications. Please try again later."
        }
      : {
          open: "Відкрити підписку на оновлення",
          title: "Отримуйте оновлення ПроМедіа",
          body: "Підпишіться на важливі новини, заяви, дослідження та проєкти ПроМедіа.",
          subscribe: "Підписатися",
          later: "Пізніше",
          unavailableTitle: "Підписка відкриється в Новинах",
          unavailableBody: "Ця сторінка поки не може напряму реєструвати сповіщення. Відкрийте новинний розділ, щоб увімкнути їх.",
          openNews: "Відкрити Новини",
          active: "Підписка активна. Дякуємо.",
          denied: "Сповіщення заблоковані у цьому браузері.",
          error: "Не вдалося увімкнути сповіщення. Спробуйте пізніше."
        };
  }

  function localStorageGet(key) {
    try { return window.localStorage.getItem(key); }
    catch (err) { return null; }
  }

  function localStorageSet(key, value) {
    try { window.localStorage.setItem(key, value); }
    catch (err) {}
  }

  function localStorageRemove(key) {
    try { window.localStorage.removeItem(key); }
    catch (err) {}
  }

  function sessionNumber(key) {
    try {
      var next = (parseInt(window.sessionStorage.getItem(key) || "0", 10) || 0) + 1;
      window.sessionStorage.setItem(key, String(next));
      return next;
    } catch (err) {
      return 1;
    }
  }

  function isDismissed() {
    var raw = parseInt(localStorageGet(DISMISSED_KEY) || "0", 10) || 0;
    if (!raw) return false;
    if (Date.now() - raw < DISMISS_TTL) return true;
    localStorageRemove(DISMISSED_KEY);
    return false;
  }

  function canUsePush() {
    return window.isSecureContext &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window &&
      typeof window.fetch === "function";
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      ".pm-push-bell { position: fixed; left: 18px; bottom: 18px; z-index: 2147481200; font-family: Montserrat, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #15142f; }",
      ".pm-push-bell[hidden] { display: none !important; }",
      ".pm-push-bell-button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-width: 44px; min-height: 44px; padding: 10px 14px; border: 1.5px solid rgba(13, 12, 92, .16); border-radius: 999px; background: #0d0c5c; color: #fff; box-shadow: 0 16px 34px rgba(13, 12, 92, .22); cursor: pointer; font: inherit; font-size: 12px; font-weight: 800; line-height: 1; }",
      ".pm-push-bell-button svg { width: 18px; height: 18px; flex: 0 0 auto; }",
      ".pm-push-bell-button:hover { background: #201e78; }",
      ".pm-push-panel { position: absolute; left: 0; bottom: 58px; width: min(330px, calc(100vw - 36px)); padding: 18px; border: 1.5px solid rgba(13, 12, 92, .12); border-radius: 18px; background: #fff; box-shadow: 0 24px 52px rgba(13, 12, 92, .24); transform: translateY(8px); opacity: 0; pointer-events: none; transition: opacity .18s ease, transform .18s ease; }",
      ".pm-push-bell.is-open .pm-push-panel { transform: translateY(0); opacity: 1; pointer-events: auto; }",
      ".pm-push-panel h2 { margin: 0; color: #0d0c5c; font-size: 17px; line-height: 1.25; letter-spacing: 0; }",
      ".pm-push-panel p { margin: 8px 0 14px; color: #6f7087; font-size: 12.5px; line-height: 1.5; }",
      ".pm-push-actions { display: flex; flex-wrap: wrap; gap: 8px; }",
      ".pm-push-actions button, .pm-push-actions a { appearance: none; display: inline-flex; align-items: center; justify-content: center; min-height: 36px; padding: 9px 14px; border: 1.5px solid #e7e7ef; border-radius: 999px; background: #fff; color: #15142f; cursor: pointer; font: inherit; font-size: 12px; font-weight: 800; text-decoration: none; }",
      ".pm-push-actions .pm-push-primary { border-color: #0d0c5c; background: #0d0c5c; color: #fff; }",
      ".pm-push-status { min-height: 18px; margin-top: 10px; color: #6f7087; font-size: 11.5px; line-height: 1.4; }",
      "@media (max-width: 520px) { .pm-push-bell { left: 12px; bottom: 12px; } .pm-push-bell-button span { display: none; } .pm-push-panel { bottom: 54px; } }"
    ].join("\n");
    document.head.appendChild(style);
  }

  function bellIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M18 8.5a6 6 0 0 0-12 0c0 6-2 7-2 7h16s-2-1-2-7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  }

  async function hasLocalServiceWorker() {
    try {
      var response = await fetch("/promedia-push-sw.js", { cache: "no-store" });
      return response.ok;
    } catch (err) {
      return false;
    }
  }

  function urlBase64ToUint8Array(value) {
    var padding = "=".repeat((4 - value.length % 4) % 4);
    var base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
    var rawData = window.atob(base64);
    var output = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; i += 1) output[i] = rawData.charCodeAt(i);
    return output;
  }

  async function registerSubscription(statusEl) {
    var t = copy();
    var permission = await Notification.requestPermission();
    if (permission !== "granted") {
      statusEl.textContent = t.denied;
      return;
    }

    var keyData = await fetch(NEWS_ORIGIN + "/api/push/public-key", { mode: "cors", cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });
    if (!keyData.publicKey || !keyData.enabled) throw new Error("push_not_ready");

    var registration = await navigator.serviceWorker.register("/promedia-push-sw.js");
    var subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey)
      });
    }

    await fetch(NEWS_ORIGIN + "/api/push/subscribe", {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: subscription.toJSON ? subscription.toJSON() : subscription,
        lang: isEnglishPage() ? "en" : "uk",
        origin: window.location.origin
      })
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });

    localStorageSet(SUBSCRIBED_KEY, String(Date.now()));
    statusEl.textContent = t.active;
  }

  function render(localServiceWorker) {
    if (document.getElementById(ROOT_ID)) return;
    injectStyles();
    var t = copy();
    var root = document.createElement("div");
    root.id = ROOT_ID;
    root.className = "pm-push-bell";
    root.innerHTML =
      '<button class="pm-push-bell-button" type="button" aria-expanded="false" aria-label="' + t.open + '">' +
        bellIcon() + '<span>' + (isEnglishPage() ? "Updates" : "Оновлення") + '</span>' +
      '</button>' +
      '<div class="pm-push-panel" role="dialog" aria-live="polite">' +
        '<h2>' + (localServiceWorker ? t.title : t.unavailableTitle) + '</h2>' +
        '<p>' + (localServiceWorker ? t.body : t.unavailableBody) + '</p>' +
        '<div class="pm-push-actions">' +
          (localServiceWorker
            ? '<button class="pm-push-primary" type="button" data-push-subscribe>' + t.subscribe + '</button>'
            : '<a class="pm-push-primary" href="' + NEWS_ORIGIN + '/?subscribe=1' + (isEnglishPage() ? '&lang=en' : '') + '">' + t.openNews + '</a>') +
          '<button type="button" data-push-dismiss>' + t.later + '</button>' +
        '</div>' +
        '<div class="pm-push-status" data-push-status></div>' +
      '</div>';
    document.body.appendChild(root);

    var button = root.querySelector(".pm-push-bell-button");
    var subscribeButton = root.querySelector("[data-push-subscribe]");
    var dismissButton = root.querySelector("[data-push-dismiss]");
    var statusEl = root.querySelector("[data-push-status]");

    button.addEventListener("click", function () {
      var open = !root.classList.contains("is-open");
      root.classList.toggle("is-open", open);
      button.setAttribute("aria-expanded", open ? "true" : "false");
    });
    dismissButton.addEventListener("click", function () {
      localStorageSet(DISMISSED_KEY, String(Date.now()));
      root.hidden = true;
    });
    if (subscribeButton) {
      subscribeButton.addEventListener("click", function () {
        subscribeButton.disabled = true;
        registerSubscription(statusEl).then(function () {
          window.setTimeout(function () { root.hidden = true; }, 2500);
        }).catch(function () {
          statusEl.textContent = t.error;
          subscribeButton.disabled = false;
        });
      });
    }

    if (hasParam("subscribe") || hasParam("promedia_push_preview")) {
      root.classList.add("is-open");
      button.setAttribute("aria-expanded", "true");
    }
  }

  function start() {
    if (!canUsePush()) return;
    var immediate = hasParam("subscribe") || hasParam("promedia_push_preview");
    if (!immediate && (isDismissed() || localStorageGet(SUBSCRIBED_KEY))) return;
    var pageviews = sessionNumber(PAGEVIEWS_KEY);
    var delay = immediate ? 500 : (pageviews >= 2 ? 12000 : DEFAULT_DELAY);
    window.setTimeout(function () {
      hasLocalServiceWorker().then(function (localServiceWorker) {
        render(localServiceWorker || window.location.hostname === "news.promedia.report");
      });
    }, delay);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
