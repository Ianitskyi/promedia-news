// Галерея фото в тексті новини: стрілки, лічильник «1 / 3» і гортання клавіатурою.
// Розмітку робить src/lib/markdown.js (кілька фото поспіль → .article-gallery).
// Без цього скрипта галерея все одно гортається свайпом (CSS scroll-snap).
(function () {
  var LABELS = {
    uk: { prev: "Попереднє фото", next: "Наступне фото", gallery: "Галерея фото" },
    en: { prev: "Previous photo", next: "Next photo", gallery: "Photo gallery" },
    crh: { prev: "Evelki fotoresim", next: "Soñraki fotoresim", gallery: "Fotoresim galereyası" }
  };
  var lang = (document.documentElement.lang || "uk").slice(0, 3).replace(/[^a-z]/g, "");
  var t = LABELS[lang] || LABELS.uk;

  function setup(gallery) {
    var track = gallery.querySelector(".article-gallery-track");
    var slides = gallery.querySelectorAll(".article-gallery-slide");
    if (!track || slides.length < 2) return;
    gallery.setAttribute("role", "region");
    gallery.setAttribute("aria-label", t.gallery);

    var nav = document.createElement("div");
    nav.className = "article-gallery-nav";
    nav.innerHTML =
      '<button type="button" class="article-gallery-btn" data-dir="-1" aria-label="' + t.prev + '">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>' +
      '<span class="article-gallery-count" aria-live="polite"></span>' +
      '<button type="button" class="article-gallery-btn" data-dir="1" aria-label="' + t.next + '">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>';
    gallery.appendChild(nav);
    gallery.classList.add("article-gallery--ready");

    var count = nav.querySelector(".article-gallery-count");
    var buttons = nav.querySelectorAll(".article-gallery-btn");
    var current = 0;

    function update() {
      var i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      current = Math.max(0, Math.min(slides.length - 1, i));
      count.textContent = (current + 1) + " / " + slides.length;
      buttons[0].disabled = current === 0;
      buttons[1].disabled = current === slides.length - 1;
    }
    function go(i) {
      i = Math.max(0, Math.min(slides.length - 1, i));
      track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" });
    }
    buttons[0].addEventListener("click", function () { go(current - 1); });
    buttons[1].addEventListener("click", function () { go(current + 1); });
    track.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); go(current - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); go(current + 1); }
    });
    var timer;
    track.addEventListener("scroll", function () { clearTimeout(timer); timer = setTimeout(update, 60); }, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  function init() {
    var galleries = document.querySelectorAll("[data-gallery]");
    for (var i = 0; i < galleries.length; i++) setup(galleries[i]);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
