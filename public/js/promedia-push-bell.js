// Дзвіночок push-сповіщень вимкнено 18.11.2026 — замість нього колись буде поштова розсилка.
// Файл лишається порожнім, бо старі закешовані сторінки ще можуть його підключати.
// Попередня версія — в історії git (до коміту «Прибрано дзвіночок push-сповіщень»).
(function () {
  window.__PROMEDIA_PUSH_BELL__ = true;
  document.querySelectorAll(".pm-push-bell, [data-pm-push-bell]").forEach(function (el) { el.remove(); });
})();
