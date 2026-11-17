(function () {
  var lang = window.PP_LANG || "uk";
  var grid = document.getElementById("pp-grid");
  if (!grid) return;
  var cards = Array.prototype.slice.call(grid.querySelectorAll(".pp-card"));
  var search = document.getElementById("pp-search");
  var countEl = document.getElementById("pp-count");
  var emptyEl = document.getElementById("pp-empty");
  var letterButtons = Array.prototype.slice.call(document.querySelectorAll(".pp-alpha [data-letter]"));
  var groupButtons = Array.prototype.slice.call(document.querySelectorAll(".pp-pills [data-group]"));
  var state = { q: "", letter: "", group: "all" };
  // Пошук знаходить людину будь-якою мовою: в data-search є і кириличне, і латинське написання.
  var norm = function (s) { return String(s || "").toLowerCase().replace(/[ʼ’']/g, "'").trim(); };

  function countText(n) {
    if (lang === "en") return n + (n === 1 ? " profile" : " profiles");
    if (lang === "crh") return n + " dosye";
    return n + " досьє";
  }

  function apply() {
    var q = norm(state.q);
    var shown = 0;
    cards.forEach(function (c) {
      var ok = (!q || norm(c.dataset.search).indexOf(q) !== -1)
        && (!state.letter || c.dataset.letter === state.letter)
        && (state.group === "all" || c.dataset.memorial === "1");
      c.hidden = !ok;
      if (ok) shown++;
    });
    countEl.textContent = countText(shown);
    emptyEl.hidden = shown !== 0;
    letterButtons.forEach(function (b) { b.classList.toggle("is-active", b.getAttribute("data-letter") === state.letter); });
    groupButtons.forEach(function (b) { b.classList.toggle("is-active", b.getAttribute("data-group") === state.group); });
    document.body.classList.toggle("pp-view-memorial", state.group === "memorial");
    var params = new URLSearchParams();
    if (state.q) params.set("q", state.q);
    if (state.letter) params.set("letter", state.letter);
    if (state.group !== "all") params.set("group", state.group);
    var qs = params.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
  }

  letterButtons.forEach(function (b) {
    b.addEventListener("click", function () { state.letter = b.getAttribute("data-letter"); apply(); });
  });
  groupButtons.forEach(function (b) {
    b.addEventListener("click", function () { state.group = b.getAttribute("data-group"); apply(); });
  });
  search.addEventListener("input", function () { state.q = search.value; apply(); });

  var p = new URLSearchParams(location.search);
  if (p.get("group") === "memorial") state.group = "memorial";
  if (p.get("letter")) state.letter = p.get("letter");
  if (p.get("q")) { state.q = p.get("q"); search.value = state.q; }
  apply();
})();
