(function () {
  "use strict";

  var NEWS_ORIGIN = "https://news.promedia.report";
  var API_URL = NEWS_ORIGIN + "/api/articles?important=1&limit=3";

  function isEnglishPage() {
    return document.documentElement.lang.toLowerCase().indexOf("en") === 0 ||
      window.location.pathname === "/en" || window.location.pathname.indexOf("/en/") === 0;
  }

  function absoluteNewsUrl(path) {
    try { return new URL(path, NEWS_ORIGIN).href; }
    catch (err) { return NEWS_ORIGIN; }
  }

  function articleUrl(item, isEnglish) {
    var url = absoluteNewsUrl(item.url || ("/article/" + item.slug));
    if (isEnglish) url += (url.indexOf("?") === -1 ? "?" : "&") + "lang=en";
    return url;
  }

  function formatDate(value, isEnglish) {
    var date = new Date(value);
    if (isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(isEnglish ? "en-GB" : "uk-UA", {
      day: "2-digit", month: "2-digit", year: "numeric"
    }).format(date);
  }

  function createCard(item, isEnglish) {
    var title = isEnglish ? (item.titleEn || item.title) : item.title;
    var card = document.createElement("a");
    card.className = "pm-featured-news-card";
    card.href = articleUrl(item, isEnglish);
    card.dataset.newsSource = "news.promedia.report";

    var media = document.createElement("div");
    media.className = "pm-featured-news-media";
    var image = document.createElement("img");
    image.src = absoluteNewsUrl(item.coverImageUrl || "/img/og-share.png");
    image.alt = title || "";
    image.loading = "lazy";
    media.appendChild(image);

    var body = document.createElement("div");
    body.className = "pm-featured-news-body";
    var date = document.createElement("span");
    date.className = "pm-featured-news-date";
    date.textContent = formatDate(item.publishedAt, isEnglish);
    var heading = document.createElement("h3");
    heading.textContent = title || "";
    body.appendChild(date);
    body.appendChild(heading);

    card.appendChild(media);
    card.appendChild(body);
    return card;
  }

  function normalizeUrl(value) {
    try {
      var url = new URL(value, window.location.origin);
      url.search = "";
      url.hash = "";
      return url.href.replace(/\/$/, "");
    } catch (err) {
      return value;
    }
  }

  function init() {
    loadLanguageSuggest();
    loadMemorialPopup();

    var grid = document.querySelector(".pm-featured-news-grid");
    if (!grid || typeof window.fetch !== "function") return;

    var isEnglish = isEnglishPage();
    var allNewsLink = document.querySelector(".pm-featured-news-all");
    if (allNewsLink) allNewsLink.href = NEWS_ORIGIN + (isEnglish ? "/?lang=en" : "/");

    var existingCards = Array.prototype.slice.call(
      grid.querySelectorAll(".pm-featured-news-card")
    );

    window.fetch(API_URL, { mode: "cors", credentials: "omit" })
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(function (data) {
        var items = Array.isArray(data.items) ? data.items : [];
        if (!items.length) return;

        var used = {};
        var cards = [];
        items.forEach(function (item) {
          var card = createCard(item, isEnglish);
          var key = normalizeUrl(card.href);
          if (!used[key]) {
            used[key] = true;
            cards.push(card);
          }
        });
        existingCards.forEach(function (card) {
          var key = normalizeUrl(card.href);
          if (!used[key]) {
            used[key] = true;
            cards.push(card);
          }
        });

        grid.replaceChildren.apply(grid, cards.slice(0, 3));
      })
      .catch(function () {
        // Якщо API тимчасово недоступний, залишаємо чинний серверний добір.
      });
  }

  function loadMemorialPopup() {
    if (document.querySelector('script[data-promedia-memorial-popup]')) return;
    var script = document.createElement("script");
    script.src = NEWS_ORIGIN + "/js/promedia-memorial-popup.js";
    script.defer = true;
    script.dataset.promediaMemorialPopup = "true";
    document.head.appendChild(script);
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
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
