(function (root) {
  "use strict";

  // Only these public projects can be advertised. Vacancies are intentionally absent.
  var projects = {
    atlas: { host: "atlas.promedia.report", copy: {
      uk: ["АТЛАС МЕДІА", "Хто стоїть за українськими медіа?", "Досліджуйте медіа та їхніх власників в одному інструменті.", "Відкрити Атлас"],
      en: ["MEDIA ATLAS", "Who owns Ukrainian media?", "Explore media outlets and their owners in one tool.", "Explore the Atlas"],
      crh: ["MEDİYA ATLASI", "Ukrayina mediyasınıñ saipleri kim?", "Mediya ve olarnıñ saiplerini bir alette tedqiq etiñiz.", "Atlasnı aç"]
    } },
    communities: { host: "communities.promedia.report", copy: {
      uk: ["КАРТА СПІЛЬНОТ", "Дізнайтеся, як медіа об’єднують людей", "Знайдіть українські медійні спільноти на інтерактивній карті.", "Відкрити карту"],
      en: ["MEDIA COMMUNITIES", "Discover how media bring people together", "Find Ukrainian media communities on an interactive map.", "Explore the map"],
      crh: ["MEDİYA CEMAATLARI", "Mediya insanlarnı nasıl birleştire?", "İnteraktiv haritada Ukrayina mediya cemaatlerini tapıñız.", "Haritanı aç"]
    } },
    ratings: { host: "ratings.promedia.report", copy: {
      uk: ["РЕЙТИНГ ЖУРФАКІВ", "Де навчатися журналістики?", "Порівнюйте журналістські освітні програми українських університетів.", "Переглянути рейтинг"],
      en: ["JOURNALISM SCHOOLS", "Where to study journalism?", "Compare journalism programmes at Ukrainian universities.", "Explore the ranking"],
      crh: ["FAKÜLTELER REYTİNGİ", "Jurnalistikanı qayda ögrenmeli?", "Ukrayina universitetleriniñ jurnalistika programmlarını deñeştiriñiz.", "Reytingni aç"]
    } },
    research: { host: "research.promedia.report", copy: {
      uk: ["ДОСЛІДЖЕННЯ ПРОМЕДІА", "Рішення для медіа починаються з даних", "Читайте дослідження ПроМедіа про медіа та їхні аудиторії.", "До досліджень"],
      en: ["PROMEDIA RESEARCH", "Media decisions start with evidence", "Explore ProMedia research on media and their audiences.", "Explore research"],
      crh: ["PROMEDIA TEDQİQATLARI", "Mediya qararları malümatlardan başlana", "Mediya ve olarnıñ auditoriyaları aqqında ProMedia tedqiqatlarını oquñız.", "Tedqiqatlarnı aç"]
    } },
    projects: { host: "projects.promedia.report", copy: {
      uk: ["ПРОЄКТИ ПРОМЕДІА", "Познайомтеся з іншими проєктами ПроМедіа", "Інструменти, дослідження та навчання для медіа й громадських організацій.", "Переглянути проєкти"],
      en: ["PROMEDIA PROJECTS", "Discover more ProMedia projects", "Tools, research and training for media and civil society organisations.", "Explore projects"],
      crh: ["PROMEDIA LEYHALARI", "ProMedia'nıñ diger leyhalarını tanıñız", "Mediya ve cemiyet teşkilâtları içün aletler, tedqiqatlar ve talim.", "Leyhalarnı aç"]
    } }
  };

  var placements = {
    "promedia.report": ["atlas", "communities", "research"],
    "projects.promedia.report": ["atlas", "communities"],
    "atlas.promedia.report": ["research", "communities"],
    "communities.promedia.report": ["research", "atlas"],
    "ratings.promedia.report": ["atlas", "communities"],
    "research.promedia.report": ["communities", "atlas"],
    "guide.promedia.report": ["communities", "research"],
    "jobs.promedia.report": ["ratings", "atlas"],
    "events.promedia.report": ["communities", "projects"],
    "brief.promedia.report": ["research", "atlas"],
    "santa.promedia.report": ["projects"]
  };

  function choosePromo(host, language, pathname) {
    host = host.replace(/^www\./, "");
    var path = (pathname || "/").replace(/^\/(en|crh)(?=\/|$)/, "");
    if (/\/(admin|api|auth|login|signin|sign-in|dashboard|manage|register|registration|check-in|checkin)(?:\/|$)/i.test(path)) return null;
    var candidates = placements[host] || [];
    var id = candidates.find(function (key) { return projects[key] && projects[key].host !== host; });
    if (!id) return null;
    var project = projects[id];
    var lang = project.copy[language] ? language : "uk";
    return { id: id, host: host, lang: lang, href: "https://" + project.host + (lang === "uk" ? "/" : "/" + lang + "/"), copy: project.copy[lang] };
  }

  // Exposed for reuse when switching the slot to another ad provider.
  root.ProMediaNetworkPromo = { choosePromo: choosePromo, refresh: refresh };
  var doc = root.document;
  if (!doc) return;
  var slot, activePromo, visibilityObserver, viewTimer, scheduled = false;
  var viewed = new Set();

  function language() {
    var prefix = root.location.pathname.split("/").filter(Boolean)[0];
    if (prefix === "en" || prefix === "crh") return prefix;
    var htmlLang = (doc.documentElement.lang || "uk").toLowerCase();
    return htmlLang.indexOf("en") === 0 ? "en" : htmlLang.indexOf("crh") === 0 ? "crh" : "uk";
  }

  function allowed(promo) {
    if (!promo) return false;
    if (promo.host === "santa.promedia.report") {
      var home = doc.getElementById("home");
      if (!home || home.hidden) return false;
    }
    // Keep registration, login and account forms clear of advertising.
    if (promo.host === "events.promedia.report" && doc.querySelector('form input[type="email"], input[type="password"]')) return false;
    return true;
  }

  function analytics(name, promo) {
    if (typeof root.gtag !== "function") return;
    root.gtag("event", name, { promo_id: promo.id, source_host: promo.host, placement: "network-footer", language: promo.lang });
  }

  function watchVisibility(promo) {
    if (visibilityObserver) visibilityObserver.disconnect();
    root.clearTimeout(viewTimer);
    if (!root.IntersectionObserver) return;
    var key = promo.host + ":" + promo.lang + ":" + promo.id;
    visibilityObserver = new root.IntersectionObserver(function (entries) {
      root.clearTimeout(viewTimer);
      if (!entries[0].isIntersecting || entries[0].intersectionRatio < .5 || viewed.has(key)) return;
      viewTimer = root.setTimeout(function () {
        if (doc.hidden || slot.hidden) return;
        viewed.add(key);
        analytics("internal_promo_view", promo);
        visibilityObserver.disconnect();
      }, 1000);
    }, { threshold: [.5] });
    visibilityObserver.observe(slot);
  }

  function render(promo) {
    slot.replaceChildren();
    slot.dataset.adSlot = "network-footer";
    slot.dataset.adProvider = "internal";
    slot.dataset.promoId = promo.id;
    slot.className = "pm-network-promo" + (promo.host === "brief.promedia.report" ? " pm-network-promo--compact" : "");
    var link = doc.createElement("a"); link.className = "pm-network-card"; link.href = promo.href;
    var copy = doc.createElement("div"); copy.className = "pm-network-copy";
    var label = doc.createElement("span"); label.className = "pm-network-label";
    label.textContent = { uk: "Проєкт ПроМедіа", en: "A ProMedia project", crh: "ProMedia leyhası" }[promo.lang];
    slot.setAttribute("aria-label", label.textContent);
    var brand = doc.createElement("p"); brand.className = "pm-network-brand"; brand.textContent = promo.copy[0];
    var title = doc.createElement("h2"); title.textContent = promo.copy[1];
    var description = doc.createElement("p"); description.className = "pm-network-description"; description.textContent = promo.copy[2];
    copy.append(label, brand, title, description);
    var action = doc.createElement("span"); action.className = "pm-network-action"; action.textContent = promo.copy[3] + " ↗";
    link.append(copy, action); slot.append(link);
    link.addEventListener("click", function () { analytics("internal_promo_click", promo); });
    activePromo = promo;
    watchVisibility(promo);
  }

  function refresh() {
    scheduled = false;
    if (!doc || !doc.body) return;
    var promo = choosePromo(root.location.hostname, language(), root.location.pathname);
    if (!allowed(promo)) {
      if (slot && !slot.hidden) slot.hidden = true;
      return;
    }
    var footer = doc.querySelector("promedia-global-footer") || doc.querySelector("footer");
    var briefMain = promo.host === "brief.promedia.report" && doc.querySelector("main.app");
    if (!footer && !briefMain) return;
    if (!slot) {
      slot = doc.getElementById("pm-network-footer-promo") || doc.createElement("aside");
      slot.id = "pm-network-footer-promo";
    }
    if (slot.hidden) slot.hidden = false;
    if (!activePromo || activePromo.id !== promo.id || activePromo.lang !== promo.lang) render(promo);
    if (footer && footer.previousElementSibling !== slot) footer.before(slot);
    else if (!footer && briefMain.nextElementSibling !== slot) briefMain.after(slot);
  }

  var style = doc.createElement("style"); style.id = "pm-network-promo-style";
  style.textContent = `
.pm-network-promo{display:block;box-sizing:border-box;width:min(1120px,calc(100% - 40px));margin:40px auto;font-family:Montserrat,Arial,sans-serif;clear:both}
.pm-network-promo[hidden]{display:none!important}
.pm-network-promo .pm-network-card{box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:32px;min-height:220px;padding:30px 36px;border:1px solid #29276e;border-radius:18px;background:#0d0c5c;color:#fff;text-decoration:none;box-shadow:none}
.pm-network-promo .pm-network-copy{min-width:0;max-width:740px;text-align:left}
.pm-network-promo .pm-network-label{display:block;color:#d6d5ed;font-size:10px;font-weight:600;letter-spacing:.05em;margin:0 0 15px;text-transform:uppercase}
.pm-network-promo .pm-network-brand{margin:0 0 8px;color:#ffac33;font-size:12px;font-weight:800;letter-spacing:.09em;line-height:1.4}
.pm-network-promo .pm-network-card h2{margin:0 0 10px;color:#fff;font-family:Montserrat,Arial,sans-serif;font-size:clamp(23px,2.5vw,30px);line-height:1.25;font-weight:800;letter-spacing:-.025em}
.pm-network-promo .pm-network-description{margin:0;color:#e4e3f3;font-size:14px;line-height:1.6}
.pm-network-promo .pm-network-action{display:block;flex-shrink:0;padding:13px 20px;border-radius:999px;background:#ffac33;color:#0d0c5c;font-size:13px;line-height:1.4;font-weight:800;text-align:center;white-space:nowrap}
.pm-network-promo .pm-network-card:hover .pm-network-action{background:#ffc46b}
.pm-network-promo .pm-network-card:focus-visible{outline:3px solid #ffac33;outline-offset:4px}
.pm-network-promo--compact{max-width:444px;margin-bottom:110px}
@media(max-width:700px){.pm-network-promo{margin:28px auto}.pm-network-promo .pm-network-card{min-height:0;flex-direction:column;align-items:flex-start;gap:22px;padding:25px 24px}.pm-network-promo .pm-network-action{white-space:normal}.pm-network-promo--compact{margin-bottom:110px}}
`;
  if (!doc.getElementById(style.id)) doc.head.appendChild(style);

  function scheduleRefresh() {
    if (!scheduled) { scheduled = true; root.setTimeout(refresh, 0); }
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", refresh, { once: true });
  else refresh();
  if (root.MutationObserver && doc.body) new root.MutationObserver(function (records) {
    var relevant = records.some(function (record) {
      if (record.type === "attributes") return record.target.id === "home";
      return Array.from(record.addedNodes).concat(Array.from(record.removedNodes)).some(function (node) {
        return node.nodeType === 1 && (node.id === "pm-network-footer-promo" || node.matches("main,footer,promedia-global-footer,form") || node.querySelector("footer,promedia-global-footer,form"));
      });
    });
    if (relevant) scheduleRefresh();
  }).observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
  root.addEventListener("popstate", refresh);
  root.addEventListener("hashchange", refresh);
})(typeof window !== "undefined" ? window : this);
