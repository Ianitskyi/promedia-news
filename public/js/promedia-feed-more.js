// Мобільна стрічка news.promedia.report: на першому екрані 20 новин (10 угорі + 10 у стрічці),
// далі кнопка «Показати ще» — по 20, а коли завантажені новини скінчаться, догружаємо старіші з API.
(() => {
  if (!window.matchMedia("(max-width: 620px)").matches) return;
  const grid = document.querySelector(".restored-feed");
  if (!grid) return;
  const lang = (document.documentElement.lang || "uk").toLowerCase().startsWith("en") ? "en"
    : (document.documentElement.lang || "").toLowerCase().startsWith("crh") ? "crh" : "uk";
  const prefix = lang === "uk" ? "" : "/" + lang;
  const LABEL = { uk: "Показати ще", en: "Show more", crh: "Daa köster" }[lang];
  const FIRST = 10, STEP = 20;
  const feedCells = () => [...grid.querySelectorAll(".mosaic-cell")].filter(c =>
    !c.classList.contains("mosaic-cell--promo") && !c.classList.contains("mosaic-cell--mobile-listed") && !c.hasAttribute("data-promo-repeat"));
  feedCells().forEach((c, i) => { if (i >= FIRST) c.classList.add("mosaic-cell--later"); });

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "feed-more";
  btn.textContent = LABEL;
  grid.after(btn);

  const fmt = (v) => {
    const d = new Date(v);
    return isNaN(d) ? "" : new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "uk-UA", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Kyiv" }).format(d);
  };
  const esc = (v) => String(v || "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  let loading = false;

  btn.addEventListener("click", async () => {
    const hidden = feedCells().filter(c => c.classList.contains("mosaic-cell--later"));
    if (hidden.length) {
      hidden.slice(0, STEP).forEach(c => c.classList.remove("mosaic-cell--later"));
      return;
    }
    // «Топ» і тематичні добірки — фіксований список без догрузки з API.
    const q = new URLSearchParams(location.search);
    if (q.get("sort") || q.get("topic")) { btn.remove(); return; }
    if (loading) return;
    loading = true;
    const cells = feedCells();
    const last = cells[cells.length - 1]?.dataset.published;
    const params = new URLSearchParams({ limit: String(STEP) });
    if (last) params.set("before", last);
    const tag = new URLSearchParams(location.search).get("tag");
    if (tag) params.set("tag", tag);
    try {
      const res = await fetch("/api/articles?" + params, { cache: "no-store" });
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];
      const shown = new Set([...document.querySelectorAll("a[href*='/article/']")].map(a => a.getAttribute("href").split("/article/")[1]));
      for (const item of items) {
        if (shown.has(item.slug)) continue;
        const title = (lang === "en" && item.titleEn) || (lang === "crh" && item.titleCrh) || item.title;
        const cell = document.createElement("div");
        cell.className = "mosaic-cell";
        cell.dataset.published = item.publishedAt || "";
        cell.innerHTML = `<article class="article-card article-card--text${item.isImportant ? " article-card--important" : ""}"><div class="article-card-body"><h3><a href="${prefix}/article/${esc(item.slug)}">${esc(title)}</a></h3><div class="article-meta"><p class="article-date">${esc(fmt(item.publishedAt))}</p></div></div></article>`;
        grid.appendChild(cell);
      }
      if (items.length < STEP) btn.remove();
    } catch {
      // Мережа недоступна — кнопка лишається, можна спробувати ще раз.
    } finally {
      loading = false;
    }
  });
})();
