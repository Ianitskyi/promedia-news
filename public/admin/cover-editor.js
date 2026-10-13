/* Shared ProMedia cover editor. Crops are non-destructive focal points per layout. */
(function () {
  "use strict";
  var formats = [
    { id: "desktop", label: "💻 Десктоп · 16:9", ratio: 16 / 9 },
    { id: "mobile", label: "📱 Мобільний · 4:5", ratio: 4 / 5 },
    { id: "social", label: "🔗 Соцмережі · 1.91:1", ratio: 1.91 },
    { id: "feed", label: "📰 Картка · 3:2", ratio: 3 / 2 }
  ];
  function initial() { var result = {}; formats.forEach(function (f) { result[f.id] = { x: 50, y: 50 }; }); return result; }
  function normalize(value) {
    var result = initial();
    if (typeof value === "string") { try { value = JSON.parse(value); } catch (_) { value = null; } }
    formats.forEach(function (f) {
      if (!value || !value[f.id]) return;
      ["x", "y"].forEach(function (axis) {
        var n = Number(value[f.id][axis]);
        if (Number.isFinite(n)) result[f.id][axis] = Math.max(0, Math.min(100, n));
      });
    });
    return result;
  }
  function make(elementId, imageInputId, hiddenId, options) {
    var host = document.getElementById(elementId);
    var urlInput = document.getElementById(imageInputId);
    var field = document.getElementById(hiddenId);
    if (!host || !urlInput || !field) return null;
    var state = normalize(field.value), active = "desktop", url = urlInput.value || "";
    host.innerHTML = '<div class="cover-editor-tabs" role="group" aria-label="Формат кадрування"></div>' +
      '<div class="cover-editor-stage"><img alt="Попередній перегляд обкладинки" draggable="false" /><div class="cover-editor-target" aria-hidden="true">+</div></div>' +
      '<div class="cover-editor-controls"><label>Позиція X <input class="cover-x" type="range" min="0" max="100" step="1" /></label>' +
      '<label>Позиція Y <input class="cover-y" type="range" min="0" max="100" step="1" /></label></div>' +
      '<div class="cover-editor-actions"><button type="button" class="admin-btn secondary cover-center">Центрувати</button>' +
      '<button type="button" class="admin-btn secondary cover-all">Застосувати позицію до всіх форматів</button></div>' +
      '<p class="admin-hint">Перетягніть фото в межах перегляду або скористайтеся повзунками. Оригінал зберігається без змін.</p>';
    var tabs = host.querySelector(".cover-editor-tabs"), stage = host.querySelector(".cover-editor-stage"), img = stage.querySelector("img");
    var xInput = host.querySelector(".cover-x"), yInput = host.querySelector(".cover-y");
    formats.forEach(function (f) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = f.label; b.className = "cover-editor-tab";
      b.addEventListener("click", function () { active = f.id; draw(); });
      b.dataset.format = f.id; tabs.appendChild(b);
    });
    function draw() {
      var f = formats.find(function (item) { return item.id === active; }), p = state[active];
      stage.style.aspectRatio = String(f.ratio); img.src = url || "";
      img.style.objectPosition = p.x + "% " + p.y + "%";
      stage.style.display = url ? "" : "none";
      xInput.value = p.x; yInput.value = p.y;
      Array.prototype.forEach.call(tabs.children, function (b) { b.setAttribute("aria-pressed", b.dataset.format === active ? "true" : "false"); });
      field.value = JSON.stringify(state);
    }
    function change() { state[active] = { x: Number(xInput.value), y: Number(yInput.value) }; draw(); }
    xInput.addEventListener("input", change); yInput.addEventListener("input", change);
    stage.addEventListener("pointerdown", function (event) {
      if (!url) return;
      var startX = event.clientX, startY = event.clientY, initialX = state[active].x, initialY = state[active].y;
      stage.setPointerCapture(event.pointerId);
      function move(e) {
        var rect = stage.getBoundingClientRect();
        state[active].x = Math.max(0, Math.min(100, initialX - (e.clientX - startX) / rect.width * 100));
        state[active].y = Math.max(0, Math.min(100, initialY - (e.clientY - startY) / rect.height * 100));
        draw();
      }
      function done() { stage.removeEventListener("pointermove", move); stage.removeEventListener("pointerup", done); stage.removeEventListener("pointercancel", done); }
      stage.addEventListener("pointermove", move); stage.addEventListener("pointerup", done); stage.addEventListener("pointercancel", done);
    });
    host.querySelector(".cover-center").addEventListener("click", function () { state[active] = { x: 50, y: 50 }; draw(); });
    host.querySelector(".cover-all").addEventListener("click", function () {
      var point = state[active]; formats.forEach(function (f) { state[f.id] = { x: point.x, y: point.y }; }); draw();
    });
    draw();
    return {
      setImage: function (next) { url = next || ""; draw(); },
      getValue: function () { return normalize(field.value); }
    };
  }
  window.ProMediaCoverEditor = { create: make, normalize: normalize };
})();