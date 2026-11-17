/* BRIEF strip on the news home page (owner, 2026-11-17): a narrow "radio" bar that plays the
   latest BRIEF edition right here. It shares one player with the "Brief" button in the common header
   (window.PMBriefPlayer from promedia-global-shell.js), so the two never play over each other.
   Without JS (or if BRIEF is unreachable) it stays a plain link to brief.promedia.report. */
(function () {
  var strip = document.querySelector("[data-brief-strip]");
  if (!strip) return;
  var btn = strip.querySelector(".brief-strip__play");
  var meta = strip.querySelector(".brief-strip__meta");
  function fmt(s) { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
  function date(d) { var p = String(d || "").split("-"); return p.length === 3 ? p[2] + "." + p[1] : ""; }
  var label = document.createElement("span"); label.className = "brief-strip__long"; label.textContent = "Випуск за ";
  var rest = document.createTextNode("");
  function start(player) {
    player.info().then(function (d) {
      meta.textContent = ""; meta.appendChild(label); meta.appendChild(rest);
      rest.nodeValue = date(d.date) + " · " + fmt(d.duration_sec);
      btn.hidden = false;
      btn.addEventListener("click", function () { player.toggle(); });
      window.addEventListener("pm-brief-state", function (e) {
        var s = e.detail;
        btn.textContent = s.playing ? "❚❚" : "▶";
        btn.setAttribute("aria-label", s.playing ? "Пауза" : "Слухати BRIEF");
        strip.classList.toggle("is-playing", s.playing);
        rest.nodeValue = date(s.date) + " · " + (s.playing || s.time > 0 ? fmt(s.time) + " / " : "") + fmt(s.duration);
      });
    }).catch(function () { /* keep the plain link */ });
  }
  // The common shell script loads with defer from another host; wait for it briefly.
  var tries = 0;
  (function wait() {
    if (window.PMBriefPlayer) return start(window.PMBriefPlayer);
    if (++tries < 50) setTimeout(wait, 100);
  })();
})();
