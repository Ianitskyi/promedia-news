// Довідки до слів у тексті: [[термін|пояснення]] → натиснути слово — з'являється пояснення.
// Розмітку робить src/lib/markdown.js. Без цього скрипта пояснення відкривається
// при фокусі (CSS :focus-within). Скрипт додає відкриття/закриття натиском,
// Esc, клік поза підказкою і розміщення в межах екрана.
(function () {
  var open = null;

  function place(term) {
    var word = term.querySelector(".term-word");
    var note = term.querySelector(".term-note");
    if (!word || !note) return;
    var rects = word.getClientRects();
    var r = rects.length ? rects[0] : word.getBoundingClientRect();
    var margin = 12, gap = 8;
    var vw = document.documentElement.clientWidth;
    var vh = window.innerHeight;
    note.style.left = "0px"; note.style.top = "0px";
    var w = note.offsetWidth, h = note.offsetHeight;
    var left = Math.min(Math.max(margin, r.left), Math.max(margin, vw - w - margin));
    var top = r.bottom + gap;
    if (top + h > vh - margin && r.top - gap - h > margin) top = r.top - gap - h;
    note.style.left = Math.round(left) + "px";
    note.style.top = Math.round(top) + "px";
  }

  function close() {
    if (!open) return;
    open.classList.remove("is-open");
    var word = open.querySelector(".term-word");
    if (word) word.setAttribute("aria-expanded", "false");
    open = null;
  }

  function show(term) {
    if (open === term) { close(); return; }
    close();
    open = term;
    term.classList.add("is-open");
    term.querySelector(".term-word").setAttribute("aria-expanded", "true");
    place(term);
  }

  function init() {
    var terms = document.querySelectorAll(".term");
    if (!terms.length) return;
    document.documentElement.classList.add("terms-ready");
    Array.prototype.forEach.call(terms, function (term, i) {
      var word = term.querySelector(".term-word");
      var note = term.querySelector(".term-note");
      if (!word || !note) return;
      note.id = note.id || "term-note-" + (i + 1);
      word.setAttribute("aria-controls", note.id);
    });
    document.addEventListener("click", function (event) {
      var word = event.target.closest && event.target.closest(".term-word");
      if (word) { event.preventDefault(); show(word.closest(".term")); return; }
      if (open && !open.contains(event.target)) close();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && open) {
        var word = open.querySelector(".term-word");
        close();
        if (word) word.focus();
      }
    });
    window.addEventListener("resize", function () { if (open) place(open); });
    window.addEventListener("scroll", function () { if (open) place(open); }, { passive: true });
    document.addEventListener("scroll", function () { if (open) place(open); }, { capture: true, passive: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
