/**
 * ぽいらぼ：横スワイプで隣のメニューへ切り替え
 * lab → シールド → シグナル → ぽいらぼ の順
 */
(function() {
  function setupViewTransitionTypes(e) {
    if (e.viewTransition) {
      var dir = sessionStorage.getItem("poiroboSwipeDir");
      if (dir === "slide-forwards" || dir === "slide-backwards") {
        e.viewTransition.types.add(dir);
      } else {
        e.viewTransition.types.add("fade");
      }
    }
  }
  if ("onpageswap" in window) {
    window.addEventListener("pageswap", setupViewTransitionTypes);
    window.addEventListener("pagereveal", setupViewTransitionTypes);
  }

  var PAGES = [
    { path: "lab.html", url: "./lab.html" },
    { path: "shield.html", url: "./shield.html" },
    { path: "signal.html", url: "./signal.html" },
    { path: "index.html", url: "./index.html" }
  ];

  function getCurrentIndex() {
    var path = (window.location.pathname || "").toLowerCase();
    var href = (window.location.href || "").toLowerCase();
    if (path.includes("lab.html") || href.includes("lab.html")) return 0;
    if (path.includes("shield.html") || href.includes("shield.html")) return 1;
    if (path.includes("signal.html") || href.includes("signal.html")) return 2;
    if (path.includes("index.html") || href.includes("/poirobo/") || path.endsWith("/poirobo")) return 3;
    return 3;
  }

  function initSwipeNav() {
    var idx = getCurrentIndex();
    var pages = PAGES;
    var minSwipeDistance = 60;
    var maxVerticalRatio = 0.6;

    var touchStartX = 0;
    var touchStartY = 0;

    function handleTouchStart(e) {
      if (e.touches.length !== 1) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }

    function handleTouchEnd(e) {
      if (e.changedTouches.length !== 1) return;
      var endX = e.changedTouches[0].clientX;
      var endY = e.changedTouches[0].clientY;
      var dx = endX - touchStartX;
      var dy = endY - touchStartY;
      var absDx = Math.abs(dx);
      var absDy = Math.abs(dy);

      if (absDx < minSwipeDistance) return;
      if (absDy > 0 && absDx > 0 && absDy / absDx > maxVerticalRatio) return;

      if (dx > 0) {
        sessionStorage.setItem("poiroboSwipeDir", "slide-backwards");
        var prevIdx = (idx - 1 + pages.length) % pages.length;
        window.location.href = pages[prevIdx].url;
      } else {
        sessionStorage.setItem("poiroboSwipeDir", "slide-forwards");
        var nextIdx = (idx + 1) % pages.length;
        window.location.href = pages[nextIdx].url;
      }
    }

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    document.addEventListener("click", function(e) {
      var a = e.target.closest("a[href]");
      if (a && a.closest(".translate-footer") && !a.classList.contains("translate-footer__btn--active")) {
        var path = (a.getAttribute("href") || "").split("?")[0];
        if (/^(\.\/)?(lab|shield|signal|index)\.html$/.test(path)) {
          sessionStorage.setItem("poiroboSwipeDir", "fade");
        }
      }
    }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSwipeNav);
  } else {
    initSwipeNav();
  }
})();
