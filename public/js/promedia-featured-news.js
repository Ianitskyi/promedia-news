(function () {
  "use strict";

  var NEWS_ORIGIN = "https://news.promedia.report";
  // Головна новина (card_style "hero", інакше найсвіжіша) + п'ять наступних заголовків.
  var API_URL = NEWS_ORIGIN + "/api/articles?limit=12";
  var LIST_SIZE = 5;
  var retryCount = 0;
  var maxRetries = 3;

  // "en", "crh" (кримськотатарська латинкою) або "uk".
  function pageLang() {
    var htmlLang = document.documentElement.lang.toLowerCase();
    var path = window.location.pathname;
    if (htmlLang.indexOf("crh") === 0 || path === "/crh" || path.indexOf("/crh/") === 0) return "crh";
    if (htmlLang.indexOf("en") === 0 || path === "/en" || path.indexOf("/en/") === 0) return "en";
    return "uk";
  }

  function absoluteNewsUrl(path) {
    try { return new URL(path, NEWS_ORIGIN).href; }
    catch (err) { return NEWS_ORIGIN; }
  }

  // Мова — перший сегмент шляху: /en/article/<slug>, /crh/article/<slug>.
  function articleUrl(item, lang) {
    var url = new URL(absoluteNewsUrl(item.url || ("/article/" + item.slug)));
    if (lang !== "uk") url.pathname = "/" + lang + url.pathname;
    return url.href;
  }

  function formatDate(value, lang) {
    var date = new Date(value);
    if (isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "uk-UA", {
      day: "2-digit", month: "2-digit", year: "numeric"
    }).format(date);
  }

  var RUBRICS = {
    "Прес-реліз": { uk: "Прес-реліз", en: "Press release", crh: "Basın bildirisi" },
    "Анонс": { uk: "Анонс", en: "Announcement", crh: "İlân" },
    "Новини": { uk: "Новини", en: "News", crh: "Haberler" },
    "Статті": { uk: "Статті", en: "Articles", crh: "Maqaleler" },
    "Заяви": { uk: "Заяви", en: "Statements", crh: "Beyanatlar" }
  };

  function localized(item, field, lang) {
    var suffix = lang === "en" ? "En" : lang === "crh" ? "Crh" : "";
    return (suffix && item[field + suffix]) || item[field] || "";
  }

  function rubric(item, lang) {
    var tags = Array.isArray(item.tags) ? item.tags : [];
    // A press release is labelled as such even if it also carries a regular rubric.
    if (tags.indexOf("Прес-реліз") !== -1) return { key: "Прес-реліз", label: RUBRICS["Прес-реліз"][lang] || "Прес-реліз" };
    if (tags.indexOf("Анонс") !== -1) return { key: "Анонс", label: RUBRICS["Анонс"][lang] || "Анонс" };
    for (var i = 0; i < tags.length; i += 1) {
      if (RUBRICS[tags[i]]) return { key: tags[i], label: RUBRICS[tags[i]][lang] || tags[i] };
    }
    return null;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function metaLine(item, lang) {
    var line = el("p", "pm-news-lead-meta");
    var r = rubric(item, lang);
    if (r) {
      line.appendChild(el("span", "pm-news-lead-rubric" + (r.key === "Прес-реліз" ? " pm-news-lead-rubric--press" : r.key === "Анонс" ? " pm-news-lead-rubric--announce" : r.key === "Новини" ? "" : " pm-news-lead-rubric--alt"), r.label));
      line.appendChild(document.createTextNode(" · "));
    }
    line.appendChild(document.createTextNode(formatDate(item.publishedAt, lang)));
    return line;
  }

  function injectStyles() {
    if (document.getElementById("pm-news-lead-styles")) return;
    var font = document.createElement("link");
    font.rel = "stylesheet";
    font.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap";
    document.head.appendChild(font);
    var style = document.createElement("style");
    style.id = "pm-news-lead-styles";
    style.textContent = [
      ".pm-featured-news-grid.pm-news-lead-active{display:block!important;grid-template-columns:none!important}",
      ".pm-news-lead{display:flex;flex-wrap:wrap;gap:40px;align-items:flex-start;color:#15142f;text-align:left}",
      ".pm-news-lead-main{flex:999 1 520px;min-width:0;display:flex;flex-direction:column;gap:14px}",
      ".pm-news-lead-media{display:block}",
      ".pm-news-lead-media img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px}",
      ".pm-news-lead-title{margin:0;font-family:'Playfair Display',Georgia,serif;font-size:clamp(22px,2.2vw,30px);line-height:1.18;font-weight:700}",
      ".pm-news-lead-title a,.pm-news-lead-item a{color:#0d0c5c;text-decoration:none}",
      ".pm-news-lead-title a:hover,.pm-news-lead-item a:hover{color:#b36a00}",
      ".pm-news-lead-excerpt{margin:0;font-size:16px;line-height:1.6;color:#44435e;max-width:720px}",
      ".pm-news-lead-meta{margin:0;font-size:12px;color:#6b6a85}",
      ".pm-news-lead-rubric{font-weight:700;color:#b36a00}",
      ".pm-news-lead-rubric--alt{color:#0d0c5c}",
      ".pm-news-lead-rubric--press{color:#b3261e}",
      ".pm-news-lead-rubric--announce{color:#1e7b34}",
      ".pm-news-lead-side{flex:1 1 300px;min-width:0;background:#fff;border:1px solid #e7e7ef;border-radius:12px;padding:20px 24px;box-sizing:border-box}",
      ".pm-news-lead-side-title{margin:0;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0d0c5c;padding-bottom:12px;border-bottom:3px solid #ffac33}",
      ".pm-news-lead-list{list-style:none;margin:0;padding:0}",
      ".pm-news-lead-item{padding:14px 0;border-bottom:1px solid #e7e7ef;display:flex;flex-direction:column;gap:6px}",
      ".pm-news-lead-item:first-child{padding-top:0}",
      ".pm-news-lead-item:last-child{border-bottom:0}",
      ".pm-news-lead-item a{font-family:'Playfair Display',Georgia,serif;font-size:16px;line-height:1.3;font-weight:700}",
      "@media (max-width:620px){.pm-news-lead{gap:24px}.pm-news-lead-excerpt{font-size:15px}.pm-news-lead-side{padding:16px 20px}}"
    ].join("\n");
    document.head.appendChild(style);
  }

  function renderLead(items, lang) {
    var heroes = items.filter(function (item) { return item.cardStyle === "hero"; });
    var hero = heroes.length ? heroes.reduce(function (latest, item) {
      return (item.publishedAt || "") > (latest.publishedAt || "") ? item : latest;
    }) : items[0];
    var rest = items.filter(function (item) { return item.slug !== hero.slug; }).slice(0, LIST_SIZE);

    var wrap = el("div", "pm-news-lead");
    var main = el("article", "pm-news-lead-main");
    var href = articleUrl(hero, lang);
    var title = localized(hero, "title", lang);
    var cover = localized(hero, "coverImageUrl", lang);
    if (cover) {
      var media = el("a", "pm-news-lead-media");
      media.href = href;
      var img = document.createElement("img");
      img.src = absoluteNewsUrl(cover);
      img.alt = hero.coverAlt || title;
      img.loading = "lazy";
      media.appendChild(img);
      main.appendChild(media);
    }
    main.appendChild(metaLine(hero, lang));
    var h = el("h3", "pm-news-lead-title");
    var link = el("a", "", title);
    link.href = href;
    h.appendChild(link);
    main.appendChild(h);
    var excerpt = localized(hero, "excerpt", lang);
    if (excerpt) main.appendChild(el("p", "pm-news-lead-excerpt", excerpt));
    wrap.appendChild(main);

    if (rest.length) {
      var side = el("aside", "pm-news-lead-side");
      side.setAttribute("aria-label", lang === "en" ? "Latest" : lang === "crh" ? "Soñki" : "Останні");
      var list = el("ol", "pm-news-lead-list");
      rest.forEach(function (item) {
        var li = el("li", "pm-news-lead-item");
        li.appendChild(metaLine(item, lang));
        var a = el("a", "", localized(item, "title", lang));
        a.href = articleUrl(item, lang);
        li.appendChild(a);
        list.appendChild(li);
      });
      side.appendChild(list);
      wrap.appendChild(side);
    }
    return wrap;
  }

  function init() {
    loadLanguageSuggest();
    loadMemorialPopup();
    loadPushBell();

    var grid = document.querySelector(".pm-featured-news-grid");
    if (!grid) {
      if (retryCount < maxRetries) {
        retryCount += 1;
        window.setTimeout(init, 700);
      }
      return;
    }
    if (typeof window.fetch !== "function" || grid.dataset.pmFeaturedNewsLoading === "true") return;
    grid.dataset.pmFeaturedNewsLoading = "true";

    var lang = pageLang();
    var allNewsLink = document.querySelector(".pm-featured-news-all");
    if (allNewsLink) allNewsLink.href = NEWS_ORIGIN + (lang === "uk" ? "/" : "/" + lang + "/");

    window.fetch(API_URL, { mode: "cors", credentials: "omit", cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(function (data) {
        var items = Array.isArray(data.items) ? data.items : [];
        if (!items.length) return;

        injectStyles();
        grid.classList.add("pm-news-lead-active");
        grid.replaceChildren(renderLead(items, lang));
        grid.dataset.pmFeaturedNewsStatus = "updated";
      })
      .catch(function () {
        // Якщо API тимчасово недоступний, залишаємо чинний серверний добір.
        grid.dataset.pmFeaturedNewsStatus = "fallback";
        if (retryCount < maxRetries) {
          retryCount += 1;
          window.setTimeout(function () {
            grid.dataset.pmFeaturedNewsLoading = "";
            init();
          }, 1200);
        }
      })
      .finally(function () {
        grid.dataset.pmFeaturedNewsLoading = "";
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

  function loadPushBell() {
    if (window.__PROMEDIA_PUSH_BELL__ || document.querySelector('script[data-promedia-push-bell]')) return;
    var script = document.createElement("script");
    script.src = NEWS_ORIGIN + "/js/promedia-push-bell.js";
    script.defer = true;
    script.dataset.promediaPushBell = "true";
    document.head.appendChild(script);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  window.addEventListener("load", init, { once: true });
})();
