(() => {
  const grids = [...document.querySelectorAll(".restored-feed")];
  if (!grids.length) return;
  const desktop = window.matchMedia("(min-width: 861px)");
  const pattern = [4, 2, 2, 2, 2, 3, 3, 2, 4];
  let scheduled = false;
  function layout() {
    scheduled = false;
    for (const grid of grids) {
      const cells = [...grid.children];
      if (!desktop.matches) {
        grid.classList.remove("mosaic-active");
        grid.style.removeProperty("height");
        for (const cell of cells) {
          cell.style.removeProperty("width");
          cell.style.removeProperty("transform");
        }
        continue;
      }
      const width = grid.clientWidth;
      if (!width) continue;
      const gap = 20, columns = 6, lane = (width - gap * (columns - 1)) / columns;
      const heights = Array(columns).fill(0);
      grid.classList.add("mosaic-active");
      cells.forEach((cell, index) => {
        const span = cell.classList.contains("mosaic-cell--promo") ? Math.min(columns, Math.ceil((300 + gap) / (lane + gap))) : pattern[index % pattern.length];
        cell.style.width = (lane * span + gap * (span - 1)) + "px";
        let bestColumn = 0, bestTop = Infinity;
        for (let col = 0; col <= columns - span; col++) {
          const top = Math.max(...heights.slice(col, col + span));
          if (top < bestTop) { bestTop = top; bestColumn = col; }
        }
        cell.style.transform = "translate(" + bestColumn * (lane + gap) + "px," + bestTop + "px)";
        const bottom = bestTop + cell.getBoundingClientRect().height + gap;
        for (let col = bestColumn; col < bestColumn + span; col++) heights[col] = bottom;
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
