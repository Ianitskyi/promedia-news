(function () {
  "use strict";

  var NEWS_ORIGIN = "https://news.promedia.report";
  var DEFAULT_URL = NEWS_ORIGIN + "/";
  var CYRILLIC_NEARBY_LANGS = ["uk", "ru", "pl", "bg", "be"];

  function preferredLang() {
    var languages = [];
    try {
      languages = self.navigator.languages && self.navigator.languages.length
        ? self.navigator.languages
        : [self.navigator.language || ""];
    } catch (err) {
      languages = [];
    }
    return languages.some(function (lang) {
      var code = String(lang || "").toLowerCase().split("-")[0];
      return CYRILLIC_NEARBY_LANGS.indexOf(code) !== -1;
    }) ? "uk" : "en";
  }

  function fallbackMessage(lang) {
    return lang === "en"
      ? { title: "ProMedia update", body: "New materials from ProMedia are available.", url: DEFAULT_URL }
      : { title: "Оновлення ПроМедіа", body: "На сайті ПроМедіа з’явилися нові матеріали.", url: DEFAULT_URL };
  }

  async function latestMessage() {
    var lang = preferredLang();
    try {
      var response = await fetch(NEWS_ORIGIN + "/api/push/latest?lang=" + encodeURIComponent(lang), {
        cache: "no-store",
        mode: "cors"
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      var data = await response.json();
      return data.item || fallbackMessage(lang);
    } catch (err) {
      return fallbackMessage(lang);
    }
  }

  self.addEventListener("push", function (event) {
    event.waitUntil((async function () {
      var message = await latestMessage();
      await self.registration.showNotification(message.title, {
        body: message.body,
        icon: NEWS_ORIGIN + "/img/og-share.png",
        badge: NEWS_ORIGIN + "/favicon.svg",
        tag: "promedia-update",
        renotify: false,
        data: { url: message.url || DEFAULT_URL }
      });
    })());
  });

  self.addEventListener("notificationclick", function (event) {
    event.notification.close();
    var targetUrl = event.notification && event.notification.data && event.notification.data.url
      ? event.notification.data.url
      : DEFAULT_URL;
    event.waitUntil(self.clients.openWindow(targetUrl));
  });
})();
