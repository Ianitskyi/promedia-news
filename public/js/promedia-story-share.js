// Кнопка Instagram: готує картинку для сторіз (1080×1920) з фото й заголовком новини,
// копіює посилання й відкриває меню «Поширити» з картинкою (на телефоні там є Instagram → «Історія»).
// На комп'ютері картинка завантажується, бо Instagram не приймає сторіз із сайтів.
(function () {
  var W = 1080, H = 1920;
  var lang = (document.documentElement.lang || "uk").slice(0, 3);
  var T = {
    uk: { preparing: "Готуємо картинку для сторіз…", shared: "Посилання скопійовано. У сторіз додайте наліпку «Посилання» і вставте його.", downloaded: "Картинку для сторіз завантажено, посилання скопійовано. Перекиньте картинку на телефон і додайте наліпку «Посилання».", failed: "Не вдалося підготувати картинку. Посилання скопійовано.", again: "Картинка готова — натисніть кнопку Instagram ще раз.", brand: "Новини ПроМедіа", read: "Читайте на сайті" },
    en: { preparing: "Preparing a story image…", shared: "Link copied. In your story, add a “Link” sticker and paste it.", downloaded: "Story image downloaded and link copied. Send the image to your phone and add a “Link” sticker.", failed: "Could not prepare the image. The link is copied.", again: "The image is ready — tap the Instagram button again.", brand: "ProMedia News", read: "Read on the website" },
    crh: { preparing: "Hikâye içün resim azırlana…", shared: "Bağlantı kopiyalandı. Hikâyede «Bağlantı» etiketini qoşıp, onı yapıştırıñız.", downloaded: "Hikâye resimi yüklendi, bağlantı kopiyalandı. Resimni telefonğa yollap, «Bağlantı» etiketini qoşıñız.", failed: "Resimni azırlap olmadı. Bağlantı kopiyalandı.", again: "Resim azır — Instagram dögmesine bir daa basıñız.", brand: "ProMedia haberleri", read: "Saytta oquñız" }
  }[lang] || null;
  if (!T) T = { preparing: "…", shared: "", downloaded: "", failed: "", brand: "ProMedia", read: "" };

  function loadImage(src) {
    return new Promise(function (resolve) {
      if (!src) return resolve(null);
      var img = new Image();
      if (new URL(src, location.href).origin !== location.origin) img.crossOrigin = "anonymous";
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  function wrap(ctx, text, maxWidth, maxLines) {
    var words = String(text).split(/\s+/), lines = [], line = "";
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line); line = words[i];
        if (lines.length === maxLines) break;
      } else line = test;
    }
    if (lines.length < maxLines && line) lines.push(line);
    else if (i < words.length) lines[maxLines - 1] = lines[maxLines - 1].replace(/[\s,.:;—-]*$/, "") + "…";
    return lines;
  }

  // Макет сторіз: спершу заголовок (там, куди падає погляд), під ним — посилання на сайт
  // (бренд згадуємо один раз), нижче — фото на всю ширину, що виринає з фону через градієнт.
  // Лише фірмовий Montserrat, без засічок. Верхні ~250 px лишаємо вільними під інтерфейс Instagram.
  function draw(title, img, focus) {
    var c = document.createElement("canvas");
    c.width = W; c.height = H;
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#0d0c5c";
    ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = "top";

    var x = 80, maxW = W - 2 * x, y = 250;

    // Заголовок
    var size = 96, lines;
    do {
      ctx.font = "800 " + size + "px Montserrat, Arial, sans-serif";
      lines = wrap(ctx, title, maxW, 6);
      if (lines.length <= 4 || size <= 64) break;
      size -= 6;
    } while (true);
    ctx.fillStyle = "#ffffff";
    lines.forEach(function (l) { ctx.fillText(l, x, y); y += Math.round(size * 1.16); });

    // Акцентна лінія і посилання на сайт
    y += 28;
    ctx.fillStyle = "#ffac33";
    ctx.fillRect(x, y, 120, 10);
    y += 44;
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "600 38px Montserrat, Arial, sans-serif";
    ctx.fillText(T.read + " · news.promedia.report", x, y);
    y += 38;

    // Фото на всю ширину до низу, верхній край розчиняється у фоні
    if (img) {
      var top = Math.max(y + 20, 760), photoH = H - top;
      var scale = Math.max(W / img.naturalWidth, photoH / img.naturalHeight);
      var dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, top, W, photoH); ctx.clip();
      // Широкі обкладинки (16:9 і ширші — часто банери з текстом і логотипом) обрізання
      // «рубало» з боків (25.11.2026). Якщо в кадр влізло б менше 58% ширини, показуємо
      // зображення повністю на всю ширину, а порожнє місце довкола заповнюємо тією самою
      // картинкою, розмитою й притемненою у фірмовий синій.
      if (W / dw < 0.58) {
        try { ctx.filter = "blur(36px) brightness(0.55)"; } catch (e) {}
        ctx.drawImage(img, W / 2 - dw / 2, top + photoH / 2 - dh / 2, dw, dh);
        try { ctx.filter = "none"; } catch (e) {}
        ctx.fillStyle = "rgba(13,12,92,0.35)";
        ctx.fillRect(0, top, W, photoH);
        var fw = W, fh = img.naturalHeight * (W / img.naturalWidth);
        var fTop = top + 180 + Math.max(0, (photoH - 180 - fh) * 0.45);
        ctx.drawImage(img, 0, fTop, fw, fh);
        ctx.restore();
        var gw = ctx.createLinearGradient(0, top, 0, top + 180);
        gw.addColorStop(0, "rgba(13,12,92,1)");
        gw.addColorStop(1, "rgba(13,12,92,0)");
        ctx.fillStyle = gw;
        ctx.fillRect(0, top, W, 180);
        return c;
      }
      // Точка фокусу (з адмінки; інакше верхня третина — на портретах там обличчя)
      // стає в центрі видимої частини фото, нижче градієнта, а не під ним.
      var f = String(focus || "").split(" ").map(Number);
      var fx = isFinite(f[0]) && f.length === 2 ? f[0] / 100 : 0.5;
      var fy = isFinite(f[1]) && f.length === 2 ? f[1] / 100 : 0.3;
      var visibleTop = top + 180;
      var dx = Math.min(0, Math.max(W - dw, W / 2 - fx * dw));
      var dy = Math.min(top, Math.max(H - dh, visibleTop + (H - visibleTop) * 0.4 - fy * dh));
      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.restore();
      // Короткий перехід (180 px): довший затіняв голови на портретах (19.11.2026).
      var g = ctx.createLinearGradient(0, top, 0, top + 180);
      g.addColorStop(0, "rgba(13,12,92,1)");
      g.addColorStop(1, "rgba(13,12,92,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, top, W, 180);
    }
    return c;
  }

  function toFile(canvas) {
    return new Promise(function (resolve) {
      try {
        canvas.toBlob(function (blob) {
          resolve(blob ? new File([blob], "promedia-story.png", { type: "image/png" }) : null);
        }, "image/png");
      } catch (e) { resolve(null); } // «забруднене» полотно (чуже фото без CORS)
    });
  }

  function prepare(button) {
    if (button._storyFile) return button._storyFile;
    var title = button.dataset.shareTitle || document.title;
    var fonts = document.fonts && document.fonts.load
      ? Promise.all(["800 96px Montserrat", "600 38px Montserrat"].map(function (f) { return document.fonts.load(f); })).catch(function () {})
      : Promise.resolve();
    button._storyFile = fonts.then(function () { return loadImage(button.dataset.shareCover); })
      .then(function (img) {
        return toFile(draw(title, img, button.dataset.shareFocus)).then(function (file) { return file || (img ? toFile(draw(title, null)) : null); });
      });
    return button._storyFile;
  }

  function copy(url) {
    try { return navigator.clipboard.writeText(url).then(function () { return true; }, function () { return false; }); }
    catch (e) { return Promise.resolve(false); }
  }

  function init() {
    document.querySelectorAll("[data-share-instagram]").forEach(function (button) {
      var status = button.closest(".article-share").querySelector("[data-share-status]");
      var ready = null;
      // Готуємо картинку заздалегідь: на iPhone меню «Поширити» можна відкрити лише одразу після дотику.
      var warm = function () { prepare(button).then(function (f) { ready = f; }); };
      if ("requestIdleCallback" in window) requestIdleCallback(warm, { timeout: 3000 }); else setTimeout(warm, 1500);

      button.addEventListener("click", function () {
        var url = button.dataset.shareUrl || location.href;
        var copied = copy(url);
        status.textContent = "";
        var canShareFile = ready && navigator.canShare && navigator.canShare({ files: [ready] });
        if (canShareFile) {
          navigator.share({ files: [ready], title: button.dataset.shareTitle || document.title })
            .then(function () { status.textContent = T.shared; })
            .catch(function (e) { if (e && e.name !== "AbortError") status.textContent = T.shared; });
          return;
        }
        status.textContent = T.preparing;
        prepare(button).then(function (file) {
          return copied.then(function () {
            if (!file) { status.textContent = T.failed; return; }
            ready = file;
            if (navigator.canShare && navigator.canShare({ files: [file] })) { status.textContent = T.again; return; }
            var a = document.createElement("a");
            a.href = URL.createObjectURL(file);
            a.download = "promedia-story.png";
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
            status.textContent = T.downloaded;
          });
        });
      });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

// Кліки на кнопку «Додати в Google» (бажані джерела) → подія GA4 з місцем кнопки,
// щоб порівнювати, яке розміщення працює краще.
(function () {
  "use strict";
  document.addEventListener("click", function (event) {
    var link = event.target && event.target.closest ? event.target.closest("[data-google-source]") : null;
    if (!link || !window.ProMediaAnalytics || typeof window.ProMediaAnalytics.track !== "function") return;
    window.ProMediaAnalytics.track("google_preferred_source_click", { placement: link.getAttribute("data-google-source") });
  });

  // LinkedIn на Android: застосунок LinkedIn перехоплює посилання share-offsite і показує помилку.
  // Тому відкриваємо саме застосунок LinkedIn із готовим текстом (заголовок + посилання) через intent;
  // якщо застосунку немає, Chrome відкриє звичайне вікно LinkedIn (browser_fallback_url).
  // На iPhone і комп'ютері лишається share-offsite.
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[data-share-native]");
    if (!a || !/Android/i.test(navigator.userAgent)) return;
    e.preventDefault();
    var text = a.dataset.shareTitle + " " + a.dataset.shareUrl;
    location.href = "intent:#Intent;action=android.intent.action.SEND;type=text/plain;package=com.linkedin.android;" +
      "S.android.intent.extra.TEXT=" + encodeURIComponent(text) + ";" +
      "S.browser_fallback_url=" + encodeURIComponent(a.href) + ";end";
  });
})();
