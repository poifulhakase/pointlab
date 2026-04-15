/**
 * ホーム（トップ）ページのURL末尾に / を付与
 * /index.html で表示されている場合は / に正規化
 */
(function () {
  var path = window.location.pathname;
  if (path === "/index.html" || path.endsWith("/index.html")) {
    var base = path.replace(/\/index\.html$/, "") || "/";
    var newPath = base.endsWith("/") ? base : base + "/";
    var url = window.location.origin + newPath + window.location.search + window.location.hash;
    window.history.replaceState(null, "", url);
  }
})();
