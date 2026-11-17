/* BRIEF strip on the news home page (owner, 2026-11-17): a narrow "radio" bar that plays the
   latest BRIEF edition right here. Without JS it stays a plain link to brief.promedia.report. */
(function () {
  var strip = document.querySelector("[data-brief-strip]");
  if (!strip) return;
  var BASE = "https://brief.promedia.report/";
  var btn = strip.querySelector(".brief-strip__play");
  var meta = strip.querySelector(".brief-strip__meta");
  var audio = null;
  function fmt(s) { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
  function date(d) { var p = String(d || "").split("-"); return p.length === 3 ? p[2] + "." + p[1] : ""; }
  fetch(BASE + "demo/index.json", { cache: "no-store" })
    .then(function (r) { return r.json(); })
    .then(function (idx) { return fetch(BASE + idx.demos[0].file, { cache: "no-store" }).then(function (r) { return r.json(); }); })
    .then(function (d) {
      if (!d || !d.audio) return;
      audio = new Audio(BASE + d.audio);
      audio.preload = "none";
      var total = d.duration_sec || 0;
      var label = document.createElement("span"); label.className = "brief-strip__long"; label.textContent = "Випуск за ";
      var rest = document.createTextNode("");
      meta.textContent = ""; meta.appendChild(label); meta.appendChild(rest);
      function show(t) { rest.nodeValue = date(d.date) + " · " + t; }
      show(fmt(total));
      btn.hidden = false;
      audio.addEventListener("timeupdate", function () {
        show(fmt(audio.currentTime) + " / " + fmt(audio.duration || total));
      });
      audio.addEventListener("play", function () { btn.textContent = "❚❚"; btn.setAttribute("aria-label", "Пауза"); strip.classList.add("is-playing"); });
      audio.addEventListener("pause", function () { btn.textContent = "▶"; btn.setAttribute("aria-label", "Слухати BRIEF"); strip.classList.remove("is-playing"); });
      audio.addEventListener("ended", function () { audio.currentTime = 0; });
      btn.addEventListener("click", function () { if (audio.paused) audio.play(); else audio.pause(); });
    })
    .catch(function () { /* keep the plain link */ });
})();
