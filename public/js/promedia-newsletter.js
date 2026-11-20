/* ProMedia newsletter signup (owner, 2026-11-20).
 *
 * One form, several placements, chosen per device:
 *  - end of every news story (mobile + desktop) — the main place;
 *  - the /rozsylka/ page on news.promedia.report — linked from the header (desktop only)
 *    and from the footer (everywhere);
 *  - one thin strip after the top stories on news.promedia.report and promedia.report.
 * No pop-ups, no sticky bars.
 *
 * Subscriptions go to ProMedia Events (double opt-in, list managed there).
 * Everything stays hidden until LIST_ID is filled in after the Events launch.
 * Preview before launch: open any ProMedia page with ?pm_newsletter=preview
 * (?pm_newsletter=off to stop). In preview the form does not send anything.
 *
 * Analytics (network GA4, respects "Вимкнути аналітику"):
 *   newsletter_view   {placement} — the form came into view (once per page);
 *   newsletter_signup {placement} — Events accepted the address.
 */
(function () {
  "use strict";
  var ENDPOINT = "https://events.promedia.report/api/newsletters/subscribe";
  var LIST_ID = ""; // ← UUID of the public list in Events; empty = hidden on the sites
  var PAGE_URL = "https://news.promedia.report/rozsylka/";
  var PRIVACY_URL = "https://promedia.report/privacy-policy/";

  var doc = document;
  var lang = (doc.documentElement.lang || "uk").toLowerCase();
  if (lang.indexOf("en") === 0 || lang.indexOf("crh") === 0 || /^\/(en|crh)(\/|$)/.test(location.pathname)) return; // the newsletter is Ukrainian only

  // Preview switch, shared by all *.promedia.report sites for a week.
  var COOKIE = "pm_newsletter_preview";
  var param = new URLSearchParams(location.search).get("pm_newsletter");
  var domain = /(^|\.)promedia\.report$/.test(location.hostname) ? ";domain=.promedia.report" : "";
  if (param === "preview" || param === "off") {
    doc.cookie = COOKIE + "=" + (param === "preview" ? "1" : "") + ";path=/;SameSite=Lax" + domain +
      (location.protocol === "https:" ? ";Secure" : "") + ";max-age=" + (param === "preview" ? 7 * 86400 : 0);
  }
  var preview = param === "preview" || (param !== "off" && new RegExp("(?:^|;\\s*)" + COOKIE + "=1").test(doc.cookie));
  var live = !!LIST_ID;
  if (!live && !preview) return;

  var COPY = {
    kicker: "Розсилка ПроМедіа",
    title: "Головне про медіа та комунікації — раз на тиждень у вашій пошті",
    text: "Найважливіші новини, дослідження й можливості для журналістів і комунікаційників, зібрані редакцією.",
    placeholder: "Ваш email",
    button: "Підписатися",
    note: "Надішлемо лист для підтвердження. Відписатися можна в один клік.",
    privacy: "Політика приватності",
    sending: "Надсилаємо…",
    done: "Майже готово: перевірте пошту й підтвердьте підписку за посиланням у листі.",
    error: "Не вдалося надіслати. Спробуйте ще раз трохи пізніше.",
    preview: "Попередній перегляд: підписка ще не відкрита, адресу не надіслано.",
    nav: "Розсилка",
    footer: "Підписатися на розсилку"
  };

  var css = "" +
    ".pm-nl{box-sizing:border-box;margin:40px 0;padding:24px 26px;background:#f7f5ef;border-left:3px solid #ffac33;color:#0d0c5c;font-family:Montserrat,Arial,sans-serif}" +
    ".pm-nl *{box-sizing:border-box}" +
    ".pm-nl__kicker{margin:0 0 8px;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#b36a00}" +
    ".pm-nl__title{margin:0 0 8px;font-size:21px;line-height:1.25;font-weight:800;color:#0d0c5c}" +
    ".pm-nl__text{margin:0 0 16px;font-size:15px;line-height:1.5;color:#3d3c6e}" +
    ".pm-nl__row{display:flex;gap:8px;max-width:560px}" +
    ".pm-nl__input{flex:1 1 auto;min-width:0;height:46px;padding:0 14px;border:1px solid rgba(13,12,92,.25);border-radius:4px;background:#fff;color:#0d0c5c;font:500 16px Montserrat,Arial,sans-serif}" +
    ".pm-nl__input:focus{outline:2px solid #ffac33;outline-offset:1px;border-color:#0d0c5c}" +
    ".pm-nl__button{flex:0 0 auto;height:46px;padding:0 20px;border:0;border-radius:4px;background:#0d0c5c;color:#fff;font:700 15px Montserrat,Arial,sans-serif;cursor:pointer}" +
    ".pm-nl__button:hover{background:#1f1e7a}.pm-nl__button:disabled{opacity:.6;cursor:default}" +
    ".pm-nl__note{margin:10px 0 0;font-size:12.5px;line-height:1.45;color:#6b6a8f}" +
    ".pm-nl__note a{color:inherit;text-decoration:underline}" +
    ".pm-nl__status{margin:10px 0 0;font-size:14px;font-weight:600;color:#0d0c5c}.pm-nl__status:empty{display:none}" +
    ".pm-nl--done .pm-nl__row,.pm-nl--done .pm-nl__note{display:none}" +
    /* thin strip between the top stories and the rest of the feed */
    ".pm-nl--strip{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,460px);gap:8px 28px;align-items:center;padding:18px 22px;margin:28px 0}" +
    ".pm-nl--strip .pm-nl__text{display:none}.pm-nl--strip .pm-nl__title{font-size:17px;margin:0}.pm-nl--strip .pm-nl__kicker{margin-bottom:4px}" +
    ".pm-nl--strip .pm-nl__form{grid-column:2;grid-row:1/span 2}.pm-nl--strip .pm-nl__note{margin-top:6px;font-size:12px}" +
    /* the /rozsylka/ page */
    ".pm-nl--page{margin:24px 0 0;padding:28px 28px 30px}.pm-nl--page .pm-nl__kicker,.pm-nl--page .pm-nl__title{display:none}" +
    "@media(max-width:760px){.pm-nl{margin:32px 0;padding:20px 18px}.pm-nl__title{font-size:18px}.pm-nl__row{flex-direction:column}.pm-nl__button{width:100%}" +
    ".pm-nl--strip{display:block;margin:24px 0}.pm-nl--strip .pm-nl__title{margin-bottom:12px}}" +
    "@media(min-width:981px){.pm-global-primary a.pm-nl-navlink{color:#b36a00}}";

  function injectStyle() {
    if (doc.getElementById("pm-nl-style")) return;
    var s = doc.createElement("style");
    s.id = "pm-nl-style";
    s.textContent = css;
    doc.head.appendChild(s);
  }

  function track(name, placement) {
    if (/(?:^|;\s*)pm_analytics=denied/.test(doc.cookie || "")) return;
    var params = { placement: placement, site: location.hostname, preview: preview && !live ? 1 : 0 };
    if (window.ProMediaAnalytics && typeof window.ProMediaAnalytics.track === "function") window.ProMediaAnalytics.track(name, params);
    else if (typeof window.gtag === "function") window.gtag("event", name, params);
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }

  var uid = 0;
  function build(slot) {
    var placement = slot.getAttribute("data-pm-newsletter") || "inline";
    var variant = placement === "strip" || placement === "home-strip" ? "strip" : placement === "page" ? "page" : "block";
    var id = "pm-nl-email-" + (++uid);
    var box = doc.createElement("section");
    box.className = "pm-nl pm-nl--" + variant;
    box.setAttribute("aria-label", COPY.kicker);
    box.innerHTML =
      '<p class="pm-nl__kicker">' + esc(COPY.kicker) + "</p>" +
      '<h2 class="pm-nl__title">' + esc(COPY.title) + "</h2>" +
      '<p class="pm-nl__text">' + esc(COPY.text) + "</p>" +
      '<form class="pm-nl__form" novalidate>' +
      '<div class="pm-nl__row"><label class="pm-visually-hidden" for="' + id + '" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Email</label>' +
      '<input class="pm-nl__input" id="' + id + '" type="email" name="email" required maxlength="254" autocomplete="email" inputmode="email" placeholder="' + esc(COPY.placeholder) + '">' +
      '<button class="pm-nl__button" type="submit">' + esc(COPY.button) + "</button></div>" +
      '<p class="pm-nl__note">' + esc(COPY.note) + ' <a href="' + PRIVACY_URL + '">' + esc(COPY.privacy) + "</a></p>" +
      '<p class="pm-nl__status" role="status" aria-live="polite"></p></form>';
    slot.replaceChildren(box);
    slot.hidden = false;

    var form = box.querySelector("form");
    var input = box.querySelector("input");
    var button = box.querySelector("button");
    var status = box.querySelector(".pm-nl__status");
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var email = input.value.trim();
      if (!email || !input.checkValidity()) { input.focus(); input.reportValidity && input.reportValidity(); return; }
      if (!live) { status.textContent = COPY.preview; return; }
      button.disabled = true;
      status.textContent = COPY.sending;
      fetch(ENDPOINT, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId: LIST_ID, email: email })
      }).then(function (r) {
        if (!r.ok) throw new Error("signup " + r.status);
        status.textContent = COPY.done;
        box.classList.add("pm-nl--done");
        track("newsletter_signup", placement);
      }).catch(function () {
        status.textContent = COPY.error;
      }).then(function () { button.disabled = false; });
    });

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries.some(function (e) { return e.isIntersecting; })) { io.disconnect(); track("newsletter_view", placement); }
      }, { threshold: 0.5 });
      io.observe(box);
    }
  }

  // Header (desktop only: on phones the menu is a burger and has no room) and footer links.
  function addLinks() {
    var nav = doc.querySelector(".pm-global-primary");
    if (nav && !nav.querySelector(".pm-nl-navlink")) {
      var a = doc.createElement("a");
      a.className = "pm-nl-navlink";
      a.href = PAGE_URL;
      a.textContent = COPY.nav;
      nav.appendChild(a);
    }
    var foot = doc.querySelector(".pm-global-footer-nav");
    if (foot && !foot.querySelector(".pm-nl-footlink")) {
      var f = doc.createElement("a");
      f.className = "pm-nl-footlink";
      f.href = PAGE_URL;
      f.textContent = COPY.footer;
      foot.insertBefore(f, foot.firstChild);
    }
  }

  // promedia.report homepage: a strip right after the top-stories block.
  function addHomeStrip() {
    if (["promedia.report", "www.promedia.report"].indexOf(location.hostname) < 0) return;
    var section = doc.querySelector(".section-featured-news");
    if (!section || doc.querySelector('[data-pm-newsletter="home-strip"]')) return;
    var wrap = doc.createElement("div");
    wrap.className = "container";
    var slot = doc.createElement("div");
    slot.setAttribute("data-pm-newsletter", "home-strip");
    wrap.appendChild(slot);
    section.appendChild(wrap);
  }

  function run() {
    injectStyle();
    addLinks();
    addHomeStrip();
    var slots = doc.querySelectorAll("[data-pm-newsletter]");
    for (var i = 0; i < slots.length; i++) if (!slots[i].querySelector(".pm-nl")) build(slots[i]);
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", run, { once: true });
  else run();
  // The shared header/footer and the homepage news block render asynchronously.
  setTimeout(run, 1200);
  window.addEventListener("load", run, { once: true });
})();
