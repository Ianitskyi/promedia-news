/* Shared ProMedia cover editor. Crops are non-destructive focal points per layout. */
(function () {
  "use strict";
  var formats = [
    { id: "desktop", label: "💻 Десктоп · 16:9", ratio: 16 / 9 },
    { id: "mobile", label: "📱 Мобільний · 4:5", ratio: 4 / 5 },
    { id: "social", label: "🔗 Соцмережі · 1.91:1", ratio: 1.91 },
    { id: "feed", label: "📰 Картка · 3:2", ratio: 3 / 2 }
  ];
  // Пошук облич: вбудований FaceDetector браузера, інакше MediaPipe (завантажується лише за потреби).
  var VISION = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
  var MODEL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
  var mediapipe = null;
  function mediapipeDetector() {
    if (!mediapipe) {
      mediapipe = import(VISION + "/vision_bundle.mjs").then(function (vision) {
        return vision.FilesetResolver.forVisionTasks(VISION + "/wasm").then(function (files) {
          return vision.FaceDetector.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL }, runningMode: "IMAGE", minDetectionConfidence: 0.5 });
        });
      });
      mediapipe.catch(function () { mediapipe = null; });
    }
    return mediapipe;
  }
  function union(boxes) {
    if (!boxes.length) return null;
    // Кілька облич — беремо всі достатньо великі (не менше третини найбільшого) і центр їхньої рамки.
    var maxArea = Math.max.apply(null, boxes.map(function (b) { return b.w * b.h; }));
    var big = boxes.filter(function (b) { return b.w * b.h >= maxArea / 3; });
    var x0 = Math.min.apply(null, big.map(function (b) { return b.x; })), y0 = Math.min.apply(null, big.map(function (b) { return b.y; }));
    var x1 = Math.max.apply(null, big.map(function (b) { return b.x + b.w; })), y1 = Math.max.apply(null, big.map(function (b) { return b.y + b.h; }));
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }
  function detectFaces(img) {
    var native = typeof window.FaceDetector === "function"
      ? new window.FaceDetector({ fastMode: false, maxDetectedFaces: 10 }).detect(img).then(function (faces) {
          if (!faces.length) throw new Error("try mediapipe");
          return faces.map(function (f) { var r = f.boundingBox; return { x: r.x, y: r.y, w: r.width, h: r.height }; });
        })
      : Promise.reject(new Error("no native detector"));
    return native.catch(function () {
      return mediapipeDetector().then(function (detector) {
        return detector.detect(img).detections.map(function (d) { var r = d.boundingBox; return { x: r.originX, y: r.originY, w: r.width, h: r.height }; });
      });
    }).then(union);
  }
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
    if (value && typeof value.alt === "string") result.alt = value.alt.slice(0, 500);
    if (value && value.fit === "contain") result.fit = "contain";
    if (value && value.hideMobile === true) result.hideMobile = true;
    // Готова картинка для соцмереж (scripts/social-covers.mjs) переживає збереження з адмінки.
    if (value && value.og && typeof value.og === "object" && typeof value.og.signature === "string") result.og = value.og;
    return result;
  }
  function make(elementId, imageInputId, hiddenId, options) {
    var host = document.getElementById(elementId);
    var urlInput = document.getElementById(imageInputId);
    var field = document.getElementById(hiddenId);
    if (!host || !urlInput || !field) return null;
    var state = normalize(field.value), active = "desktop", url = urlInput.value || "", initialized = false;
    host.innerHTML = '<div class="cover-editor-tabs" role="group" aria-label="Формат кадрування"></div>' +
      '<div class="cover-editor-stage"><img alt="Попередній перегляд обкладинки" draggable="false" /><div class="cover-editor-target" aria-hidden="true">+</div></div>' +
      '<div class="cover-editor-controls"><label>Позиція X <input class="cover-x" type="range" min="0" max="100" step="1" /></label>' +
      '<label>Позиція Y <input class="cover-y" type="range" min="0" max="100" step="1" /></label></div>' +
      '<div class="cover-editor-actions"><button type="button" class="admin-btn secondary cover-center">Центрувати</button>' +
      '<button type="button" class="admin-btn secondary cover-all">Застосувати позицію до всіх форматів</button></div>' +
      '<p class="admin-hint">Перетягніть фото в межах перегляду або скористайтеся повзунками. Оригінал зберігається без змін. Після завантаження фото адмінка сама знаходить обличчя; картинка для соцмереж робиться автоматично за кадром «Соцмережі».</p>';
    var metadata = document.createElement("div");
    metadata.className = "cover-editor-metadata";
    metadata.innerHTML = '<label>Опис зображення (alt)<input type="text" class="cover-alt" maxlength="500" /></label>' +
      '<label><input type="checkbox" class="cover-fit" /> Показувати обкладинку повністю без обрізання</label>';
    host.appendChild(metadata);
    var altInput = metadata.querySelector(".cover-alt"), fitInput = metadata.querySelector(".cover-fit");
    altInput.value = state.alt || ""; fitInput.checked = state.fit === "contain";
    altInput.addEventListener("input", function () { state.alt = altInput.value; draw(); });
    fitInput.addEventListener("change", function () { state.fit = fitInput.checked ? "contain" : "cover"; draw(); });
    var tabs = host.querySelector(".cover-editor-tabs"), stage = host.querySelector(".cover-editor-stage"), img = stage.querySelector("img"), target = stage.querySelector(".cover-editor-target");
    var xInput = host.querySelector(".cover-x"), yInput = host.querySelector(".cover-y");
    formats.forEach(function (f) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = f.label; b.className = "cover-editor-tab";
      b.addEventListener("click", function () { active = f.id; draw(); });
      b.dataset.format = f.id; tabs.appendChild(b);
    });
    function draw() {
      var f = formats.find(function (item) { return item.id === active; }), p = state[active];
      stage.style.aspectRatio = String(f.ratio);
      stage.style.maxWidth = f.ratio < 1 ? "408px" : "700px";
      if (img.getAttribute("src") !== (url || "")) img.setAttribute("src", url || "");
      img.style.objectFit = state.fit === "contain" ? "contain" : "cover";
      img.style.objectPosition = p.x + "% " + p.y + "%";
      stage.style.setProperty("--cover-editor-x", p.x + "%");
      stage.style.setProperty("--cover-editor-y", p.y + "%");
      target.setAttribute("aria-label", "Фокус: " + p.x + "% по горизонталі, " + p.y + "% по вертикалі");
      stage.style.display = url ? "" : "none";
      xInput.value = p.x; yInput.value = p.y;
      Array.prototype.forEach.call(tabs.children, function (b) { b.setAttribute("aria-pressed", b.dataset.format === active ? "true" : "false"); });
      field.value = JSON.stringify(state);
      if (initialized && options && typeof options.onChange === "function") options.onChange(normalize(state));
    }
    function change() { state[active] = { x: Number(xInput.value), y: Number(yInput.value) }; draw(); }
    xInput.addEventListener("input", change); yInput.addEventListener("input", change);
    xInput.addEventListener("change", change); yInput.addEventListener("change", change);
    // A cached image can finish loading after the first draw. Redraw then so
    // the focal position is also applied to the final, rendered image.
    img.addEventListener("load", draw);
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
    var autoButton = document.createElement("button");
    autoButton.type = "button"; autoButton.className = "admin-btn secondary";
    autoButton.textContent = "Авто: знайти обличчя";
    var status = document.createElement("span"); status.className = "admin-hint"; status.setAttribute("role", "status");
    host.querySelector(".cover-editor-actions").appendChild(autoButton);
    host.querySelector(".cover-editor-actions").appendChild(status);
    function isDefault() {
      return formats.every(function (f) { return state[f.id].x === 50 && state[f.id].y === 50; });
    }
    var autoRun = 0;
    function autoFocus(reason) {
      if (!url) return;
      var run = ++autoRun;
      autoButton.disabled = true; status.textContent = "Шукаю обличчя на фото…";
      var loaded = img.complete && img.naturalWidth && img.getAttribute("src") === url ? Promise.resolve()
        : new Promise(function (resolve, reject) { img.addEventListener("load", resolve, { once: true }); img.addEventListener("error", reject, { once: true }); });
      loaded.then(function () { return detectFaces(img); }).then(function (box) {
        if (run !== autoRun) return;
        var point;
        if (box) {
          point = { x: Math.round(box.cx / img.naturalWidth * 100), y: Math.round(box.cy / img.naturalHeight * 100) };
          status.textContent = "Кадр виставлено за обличчям — для сайту, головної, сторіз і соцмереж. Можна підправити вручну.";
        } else {
          // Без облич: на вертикальних фото тримаємо верхню третину, на горизонтальних — центр.
          point = { x: 50, y: img.naturalHeight > img.naturalWidth ? 30 : 50 };
          status.textContent = "Облич не знайдено — кадр за замовчуванням. Можна підправити вручну.";
        }
        formats.forEach(function (f) { state[f.id] = { x: point.x, y: point.y }; });
        draw();
      }).catch(function () {
        if (run === autoRun && reason === "button") status.textContent = "Автопошук недоступний для цього фото. Скористайтеся ручним кадруванням.";
        else if (run === autoRun) status.textContent = "";
      }).then(function () { if (run === autoRun) autoButton.disabled = false; });
    }
    autoButton.addEventListener("click", function () { autoFocus("button"); });
    host.querySelector(".cover-center").addEventListener("click", function () { state[active] = { x: 50, y: 50 }; draw(); });
    host.querySelector(".cover-all").addEventListener("click", function () {
      var point = state[active]; formats.forEach(function (f) { state[f.id] = { x: point.x, y: point.y }; }); draw();
    });
    draw();
    initialized = true;
    // Стара обкладинка, яку ніхто не кадрував (усі формати по центру), — кадруємо автоматично.
    if (url && isDefault()) autoFocus("open");
    return {
      // Нове фото: одразу шукаємо обличчя й виставляємо кадр для всіх форматів.
      setImage: function (next) { var changed = (next || "") !== url; url = next || ""; draw(); if (changed && url) autoFocus("upload"); },
      getValue: function () { return normalize(field.value); },
      setValue: function (value) {
        state = normalize(value);
        altInput.value = state.alt || "";
        fitInput.checked = state.fit === "contain";
        draw();
      }
    };
  }
  window.ProMediaCoverEditor = { create: make, normalize: normalize };
})();
