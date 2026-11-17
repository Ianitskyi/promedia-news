(function () {
  var lang = window.PP_LANG || "uk";
  var grid = document.getElementById("pp-grid");
  if (!grid) return;
  var cards = Array.prototype.slice.call(grid.querySelectorAll(".pp-card"));
  var search = document.getElementById("pp-search");
  var countEl = document.getElementById("pp-count");
  var emptyEl = document.getElementById("pp-empty");
  var state = { q: "", alpha: lang === "en" ? "lat" : "cyr", letter: "", group: "all" };
  var norm = function (s) { return String(s || "").toLowerCase().replace(/[ʼ’']/g, "'").trim(); };

  function plural(n) {
    if (lang === "en") return n + (n === 1 ? " profile" : " profiles");
    return n + " досьє";
  }

  function sortCards() {
    var key = state.alpha === "lat" ? "sortEn" : "sortUk";
    var collator = new Intl.Collator(state.alpha === "lat" ? "en" : "uk");
    cards.sort(function (a, b) { return collator.compare(a.dataset[key], b.dataset[key]); });
    cards.forEach(function (c) { grid.appendChild(c); });
  }

  function apply() {
    var q = norm(state.q);
    var shown = 0;
    cards.forEach(function (c) {
      var ok = (!q || norm(c.dataset.search).indexOf(q) !== -1)
        && (!state.letter || c.dataset[state.alpha] === state.letter)
        && (state.group === "all" || (state.group === "memorial" ? c.dataset.memorial === "1" : c.dataset.group === state.group));
      c.hidden = !ok;
      if (ok) shown++;
    });
    countEl.textContent = plural(shown);
    emptyEl.hidden = shown !== 0;
    var params = new URLSearchParams();
    if (state.q) params.set("q", state.q);
    if (state.letter) params.set("letter", state.letter);
    if (state.alpha !== (lang === "en" ? "lat" : "cyr")) params.set("abc", state.alpha);
    if (state.group !== "all") params.set("group", state.group);
    var qs = params.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
  }

  function setActive(selector, attr, value) {
    document.querySelectorAll(selector).forEach(function (b) { b.classList.toggle("is-active", b.getAttribute(attr) === value); });
  }

  function setAlpha(alpha) {
    state.alpha = alpha;
    state.letter = "";
    document.querySelectorAll(".pp-alpha").forEach(function (el) {
      el.hidden = el.getAttribute("data-alphabet") !== alpha;
      el.querySelectorAll("[data-letter]").forEach(function (b) { b.classList.toggle("is-active", b.getAttribute("data-letter") === ""); });
    });
    sortCards();
  }

  document.querySelectorAll("[data-alpha]").forEach(function (b) {
    b.addEventListener("click", function () { setAlpha(b.getAttribute("data-alpha")); apply(); });
  });
  document.querySelectorAll(".pp-alpha [data-letter]").forEach(function (b) {
    b.addEventListener("click", function () {
      state.letter = b.getAttribute("data-letter");
      b.parentNode.querySelectorAll("[data-letter]").forEach(function (x) { x.classList.toggle("is-active", x === b); });
      apply();
    });
  });
  document.querySelectorAll("[data-group]").forEach(function (b) {
    if (b.classList.contains("pp-card")) return;
    b.addEventListener("click", function () { state.group = b.getAttribute("data-group"); setActive(".pp-pills [data-group]", "data-group", state.group); document.body.classList.toggle("pp-view-memorial", state.group === "memorial"); apply(); });
  });
  search.addEventListener("input", function () { state.q = search.value; apply(); });

  var p = new URLSearchParams(location.search);
  if (p.get("abc") === "lat" || p.get("abc") === "cyr") setAlpha(p.get("abc"));
  if (p.get("group")) { state.group = p.get("group"); setActive(".pp-pills [data-group]", "data-group", state.group); }
  document.body.classList.toggle("pp-view-memorial", state.group === "memorial");
  if (p.get("letter")) {
    state.letter = p.get("letter");
    var box = document.querySelector('.pp-alpha[data-alphabet="' + state.alpha + '"]');
    if (box) box.querySelectorAll("[data-letter]").forEach(function (x) { x.classList.toggle("is-active", x.getAttribute("data-letter") === state.letter); });
  }
  if (p.get("q")) { state.q = p.get("q"); search.value = state.q; }
  apply();
})();
