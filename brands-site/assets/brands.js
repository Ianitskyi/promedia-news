(function () {
  var lang = window.PP_LANG || "uk";
  var grid = document.getElementById("pp-grid");
  if (!grid) return;
  var cards = Array.prototype.slice.call(grid.querySelectorAll(".pp-card"));
  var search = document.getElementById("pp-search");
  var kindSelect = document.getElementById("bb-kind");
  var countEl = document.getElementById("pp-count");
  var emptyEl = document.getElementById("pp-empty");
  var letterButtons = Array.prototype.slice.call(document.querySelectorAll(".pp-alpha [data-letter]"));
  var groupButtons = Array.prototype.slice.call(document.querySelectorAll(".pp-pills [data-group]"));
  var state = { q: "", letter: "", group: "all", kind: "", expanded: false };
  // Без фільтрів показуємо лише перші картки, далі — промоблок і кнопка «Показати всі».
  var preview = Number(grid.getAttribute("data-preview")) || 5;
  var showAll = document.getElementById("bb-show-all");
  // Пошук знаходить бренд і за кириличною, і за латинською назвою, країною, типом чи доменом сайту.
  var norm = function (s) { return String(s || "").toLowerCase().replace(/[ʼ’']/g, "'").trim(); };

  function plural(n, forms) {
    return forms[(n % 10 === 1 && n % 100 !== 11) ? 0 : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? 1 : 2];
  }
  function countText(n) {
    if (lang === "en") return n + (n === 1 ? " media brand" : " media brands");
    if (lang === "crh") return n + " mediya brendi";
    return n + " " + plural(n, ["медіабренд", "медіабренди", "медіабрендів"]);
  }

  function apply() {
    var q = norm(state.q);
    var filtered = Boolean(q || state.letter || state.group !== "all" || state.kind);
    var collapsed = !filtered && !state.expanded;
    var shown = 0;
    cards.forEach(function (c) {
      var ok = (!q || norm(c.dataset.search).indexOf(q) !== -1)
        && (!state.letter || c.dataset.letter === state.letter)
        && (state.group === "all" || c.dataset.group === state.group)
        && (!state.kind || c.dataset.kind === state.kind);
      if (ok) shown++;
      c.hidden = !ok || (collapsed && shown > preview);
    });
    grid.classList.toggle("is-collapsed", collapsed);
    if (showAll) showAll.hidden = !collapsed || shown <= preview;
    countEl.textContent = countText(shown);
    emptyEl.hidden = shown !== 0;
    letterButtons.forEach(function (b) { b.classList.toggle("is-active", b.getAttribute("data-letter") === state.letter); });
    groupButtons.forEach(function (b) { b.classList.toggle("is-active", b.getAttribute("data-group") === state.group); });
    if (kindSelect) kindSelect.value = state.kind;
    var params = new URLSearchParams();
    if (state.q) params.set("q", state.q);
    if (state.letter) params.set("letter", state.letter);
    if (state.group !== "all") params.set("group", state.group);
    if (state.kind) params.set("kind", state.kind);
    var qs = params.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
  }

  letterButtons.forEach(function (b) {
    b.addEventListener("click", function () { state.letter = b.getAttribute("data-letter"); apply(); });
  });
  groupButtons.forEach(function (b) {
    b.addEventListener("click", function () { state.group = b.getAttribute("data-group"); apply(); });
  });
  if (kindSelect) kindSelect.addEventListener("change", function () { state.kind = kindSelect.value; apply(); });
  if (showAll) showAll.addEventListener("click", function () { state.expanded = true; apply(); });
  search.addEventListener("input", function () { state.q = search.value; apply(); });

  var p = new URLSearchParams(location.search);
  if (p.get("group") === "ua" || p.get("group") === "intl") state.group = p.get("group");
  if (p.get("kind")) state.kind = p.get("kind");
  if (p.get("letter")) state.letter = p.get("letter");
  if (p.get("q")) { state.q = p.get("q"); search.value = state.q; }
  apply();
})();
