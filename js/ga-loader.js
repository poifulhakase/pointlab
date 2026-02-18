/**
 * Google Analytics 4 条件付き読み込み
 * localStorage.excludeFromAnalytics === 'true' の場合は計測しない
 */
(function () {
  if (localStorage.getItem('excludeFromAnalytics') === 'true') return;

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=G-ERDSPE9CZM';
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  gtag('js', new Date());
  gtag('config', 'G-ERDSPE9CZM');
})();
