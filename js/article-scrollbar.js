/**
 * 縦スクロールバー：デフォルト非表示、スクロール時に表示
 * 記事ページ・トップページなど全ページで適用
 */
(function () {
  var SCROLLBAR_HIDE_DELAY = 1500;

  function init() {
    document.documentElement.classList.add('scrollbar-hide-until-scroll');

    var timer = null;
    window.addEventListener(
      'scroll',
      function () {
        document.documentElement.classList.add('is-scrolling');
        if (timer) clearTimeout(timer);
        timer = setTimeout(function () {
          document.documentElement.classList.remove('is-scrolling');
          timer = null;
        }, SCROLLBAR_HIDE_DELAY);
      },
      { passive: true }
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
