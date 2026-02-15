/**
 * ポイ活・株式投資：スマホで2行横スクロールに変換
 * grid-auto-flow の表示崩れを避け、HTML構造を2行に分割
 */
(function () {
  var BREAKPOINT = 768;
  var sections = ["osusume", "poi", "stock"];

  function isMobile() {
    return window.innerWidth <= BREAKPOINT;
  }

  function restructure(grid) {
    if (grid._restructured) return;
    var cards = [].slice.call(grid.querySelectorAll(":scope > .article-card"));
    if (cards.length < 2) return;

    grid._originalHTML = grid.innerHTML;

    var row1 = document.createElement("div");
    row1.className = "article-grid-row";
    var row2 = document.createElement("div");
    row2.className = "article-grid-row";

    cards.forEach(function (card, i) {
      (i % 2 === 0 ? row1 : row2).appendChild(card);
    });

    grid.classList.add("article-grid--2rows");
    grid.innerHTML = "";
    grid.appendChild(row1);
    grid.appendChild(row2);
    grid._restructured = true;
  }

  function restore(grid) {
    if (!grid._originalHTML) return;
    grid.classList.remove("article-grid--2rows");
    grid.innerHTML = grid._originalHTML;
    grid._restructured = false;
  }

  function update() {
    sections.forEach(function (id) {
      var section = document.getElementById(id);
      if (!section) return;
      var grid = section.querySelector(".article-grid");
      if (!grid) return;

      if (isMobile()) {
        restructure(grid);
      } else if (grid._restructured) {
        restore(grid);
      }
    });
  }

  function init() {
    update();
    window.addEventListener("resize", update);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
