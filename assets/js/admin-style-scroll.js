(() => {
  const selector =
    ".admin-style-editor-grid, .admin-style-grid, .admin-cover-style-grid";

  function fitGrid(grid) {
    const cards = Array.from(grid.children);
    if (!cards.length) return;

    const gap = Number.parseFloat(getComputedStyle(grid).rowGap) || 0;
    const rows = new Map();
    cards.forEach((card) => {
      const top = Math.round(card.getBoundingClientRect().top);
      if (!rows.has(top)) rows.set(top, []);
      rows.get(top).push(card);
    });

    const heights = [...rows.keys()]
      .sort((first, second) => first - second)
      .slice(0, 2)
      .map((top) =>
        Math.max(
          ...rows
            .get(top)
            .map((card) => card.getBoundingClientRect().height),
        ),
      );

    if (!heights.length) return;
    const height =
      heights.reduce((total, value) => total + value, 0) +
      gap * Math.max(0, heights.length - 1);
    grid.style.maxHeight = `${Math.ceil(height + 1)}px`;
  }

  function fitAll() {
    document.querySelectorAll(selector).forEach(fitGrid);
  }

  document.addEventListener("DOMContentLoaded", fitAll);
  window.addEventListener("load", fitAll);
  window.addEventListener("resize", () => window.requestAnimationFrame(fitAll));
  document.fonts?.ready.then(fitAll);
})();
