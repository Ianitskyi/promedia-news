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

  function draw(title, img) {
    var c = document.createElement("canvas");
    c.width = W; c.height = H;
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#0d0c5c";
    ctx.fillRect(0, 0, W, H);

    var photoH = 1100;
    if (img) {
      var scale = Math.max(W / img.naturalWidth, photoH / img.naturalHeight);
      var dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
      ctx.drawImage(img, (W - dw) / 2, (photoH - dh) / 2, dw, dh);
      var g = ctx.createLinearGradient(0, photoH - 360, 0, photoH);
      g.addColorStop(0, "rgba(13,12,92,0)");
      g.addColorStop(1, "rgba(13,12,92,1)");
      ctx.fillStyle = g;
      ctx.fillRect(0, photoH - 360, W, 360);
    } else {
      photoH = 520;
    }

    var x = 80, y = photoH + 40;
    ctx.fillStyle = "#ffac33";
    ctx.fillRect(x, y, 120, 10);
    ctx.font = "600 34px Montserrat, Arial, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(T.brand.toUpperCase(), x + 150, y - 12);

    var size = 76, lines;
    do {
      ctx.font = "700 " + size + "px 'Playfair Display', Georgia, serif";
      lines = wrap(ctx, title, W - 2 * x, 6);
      if (lines.length <= 5 || size <= 56) break;
      size -= 6;
    } while (true);
    ctx.fillStyle = "#ffffff";
    var ty = y + 70;
    lines.forEach(function (l) { ctx.fillText(l, x, ty); ty += size * 1.2; });

    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "500 36px Montserrat, Arial, sans-serif";
    ctx.fillText(T.read + " · news.promedia.report", x, H - 330);
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
      ? Promise.all([document.fonts.load("700 76px 'Playfair Display'"), document.fonts.load("600 34px Montserrat")]).catch(function () {})
      : Promise.resolve();
    button._storyFile = fonts.then(function () { return loadImage(button.dataset.shareCover); })
      .then(function (img) {
        return toFile(draw(title, img)).then(function (file) { return file || (img ? toFile(draw(title, null)) : null); });
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
