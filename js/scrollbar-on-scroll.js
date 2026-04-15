/**
 * 横スクロールセクション：スクロールバーは非表示、スクロール時に表示
 */
(function () {
  var SCROLLBAR_HIDE_DELAY = 1500;

  function init() {
    var scrollContainers = document.querySelectorAll(
      '.article-carousel, .article-grid, .article-grid-row'
    );

    scrollContainers.forEach(function (el) {
      var timer = null;
      el.addEventListener(
        'scroll',
        function () {
          el.classList.add('is-scrolling');
          if (timer) clearTimeout(timer);
          timer = setTimeout(function () {
            el.classList.remove('is-scrolling');
            timer = null;
          }, SCROLLBAR_HIDE_DELAY);
        },
        { passive: true }
      );
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
