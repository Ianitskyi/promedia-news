(() => {
  const grids = [...document.querySelectorAll(".restored-feed")];
  if (!grids.length) return;
  const desktop = window.matchMedia("(min-width: 861px)");
  let scheduled = false;
  function layout() {
    scheduled = false;
    for (const grid of grids) {
      for (const repeat of grid.querySelectorAll("[data-promo-repeat]")) repeat.remove();
      const cells = [...grid.children];
      const promo = cells.find(cell => cell.classList.contains("mosaic-cell--promo"));
      const interval = Math.max(600, window.innerHeight * 2);
      const creatives = [promo, ...document.querySelectorAll("[data-mosaic-promo-template]")].filter(Boolean);
      let creativeIndex = 1;
      let lastPromoTop = null;
      function repeatBefore(cell) {
        const creative = creatives[creativeIndex++ % creatives.length];
        const repeat = (creative.content ? creative.content.firstElementChild : creative).cloneNode(true);
        repeat.dataset.promoRepeat = "";
        grid.insertBefore(repeat, cell);
        return repeat;
      }
      if (!desktop.matches) {
        grid.classList.remove("mosaic-active");
        grid.style.removeProperty("height");
        for (const cell of cells) {
          cell.style.removeProperty("width");
          cell.style.removeProperty("transform");
        }
        // Measure natural mobile/tablet positions, including headline-only cards.
        for (const cell of cells) {
          if (cell === promo) {
            lastPromoTop = cell.offsetTop;
          } else if (promo && lastPromoTop !== null && cell.offsetTop - lastPromoTop >= interval) {
            const repeat = repeatBefore(cell);
            lastPromoTop = repeat.offsetTop;
          }
        }
        continue;
      }
      const width = grid.clientWidth;
      if (!width) continue;
      const gap = 20, columns = 3, lane = (width - gap * (columns - 1)) / columns;
      const heights = Array(columns).fill(0);
      grid.classList.add("mosaic-active");
      // One column per card: varying heights create the mosaic without spanning
      // across shorter neighbours and leaving inaccessible holes underneath.
      function place(cell) {
        cell.style.width = lane + "px";
        const bestTop = Math.min(...heights);
        const bestColumn = heights.indexOf(bestTop);
        cell.style.transform = "translate(" + bestColumn * (lane + gap) + "px," + bestTop + "px)";
        heights[bestColumn] = bestTop + cell.getBoundingClientRect().height + gap;
      }
      cells.forEach(cell => {
        const top = Math.min(...heights);
        if (cell !== promo && promo && lastPromoTop !== null && top - lastPromoTop >= interval) {
          lastPromoTop = top;
          place(repeatBefore(cell));
        }
        if (cell === promo) lastPromoTop = Math.min(...heights);
        place(cell);
      });
      grid.style.height = Math.max(0, Math.max(...heights) - gap) + "px";
    }
  }
  function schedule() {
    if (!scheduled) { scheduled = true; requestAnimationFrame(layout); }
  }
  if (window.ResizeObserver) {
    const observer = new ResizeObserver(schedule);
    for (const grid of grids) for (const cell of grid.children) if (cell.firstElementChild) observer.observe(cell.firstElementChild);
  }
  window.addEventListener("resize", schedule, { passive: true });
  desktop.addEventListener("change", schedule);
  for (const grid of grids) for (const img of grid.querySelectorAll("img")) {
    img.addEventListener("load", schedule);
    img.addEventListener("error", schedule);
  }
  if (document.fonts) document.fonts.ready.then(schedule);
  schedule();
})();
