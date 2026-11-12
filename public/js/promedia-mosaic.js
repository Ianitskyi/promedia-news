(() => {
  const grids = [...document.querySelectorAll(".restored-feed")];
  if (!grids.length) return;
  const desktop = window.matchMedia("(min-width: 861px)");
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
      const gap = 20, columns = 3, lane = (width - gap * (columns - 1)) / columns;
      const heights = Array(columns).fill(0);
      grid.classList.add("mosaic-active");
      // One column per card: varying heights create the mosaic without spanning
      // across shorter neighbours and leaving inaccessible holes underneath.
      cells.forEach(cell => {
        cell.style.width = lane + "px";
        const bestTop = Math.min(...heights);
        const bestColumn = heights.indexOf(bestTop);
        cell.style.transform = "translate(" + bestColumn * (lane + gap) + "px," + bestTop + "px)";
        heights[bestColumn] = bestTop + cell.getBoundingClientRect().height + gap;
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
