/**
 * 横スワイプで隣のメニューへ切り替え
 * 明確に横方向にスライドした場合のみ発火
 */
(function() {
  const PAGES = [
    { path: "lab.html", url: "./lab.html" },
    { path: "index.html", url: "./index.html" },
    { path: "", url: "./index.html" },
    { path: "translate.html", url: "./translate.html" },
    { path: "map.html", url: "./map.html" }
  ];

  function getCurrentPageIndex() {
    const path = window.location.pathname || "";
    const href = window.location.href || "";
    for (let i = 0; i < PAGES.length; i++) {
      const p = PAGES[i];
      if (path.endsWith(p.path) || href.includes(p.path || "index.html")) {
        return p.path === "" ? 1 : i < 2 && p.path === "index.html" ? 1 : i;
      }
    }
    if (path.endsWith("/") || path.endsWith("/poinavi") || path.endsWith("/poinavi/")) {
      return 1;
    }
    return -1;
  }

  function getOrderedPages() {
    return [
      { url: "./lab.html" },
      { url: "./index.html" },
      { url: "./translate.html" },
      { url: "./map.html" }
    ];
  }

  function getCurrentIndex() {
    const path = (window.location.pathname || "").toLowerCase();
    const ordered = ["lab.html", "index.html", "translate.html", "map.html"];
    for (let i = 0; i < ordered.length; i++) {
      if (path.endsWith(ordered[i]) || (ordered[i] === "index.html" && (path.endsWith("/") || path === "" || path.endsWith("poinavi")))) {
        return i;
      }
    }
    if (path.includes("index") || path.endsWith("/")) return 1;
    return -1;
  }

  function initSwipeNav() {
    const idx = getCurrentIndex();
    if (idx < 0) return;

    const pages = getOrderedPages();
    const minSwipeDistance = 80;
    const maxVerticalRatio = 0.5;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartedOnMap = false;

    function handleTouchStart(e) {
      if (e.touches.length !== 1) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      var mapContainer = document.querySelector(".map-container");
      touchStartedOnMap = mapContainer && mapContainer.contains(e.target);
    }

    function handleTouchEnd(e) {
      if (e.changedTouches.length !== 1) return;
      if (touchStartedOnMap) return;
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const dx = endX - touchStartX;
      const dy = endY - touchStartY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      if (absDx < minSwipeDistance) return;
      if (absDy > 0 && absDx > 0 && absDy / absDx > maxVerticalRatio) return;

      if (dx > 0) {
        const prevIdx = (idx - 1 + pages.length) % pages.length;
        window.location.href = pages[prevIdx].url + (prevIdx === 1 ? "?from=nav" : "");
      } else {
        const nextIdx = (idx + 1) % pages.length;
        window.location.href = pages[nextIdx].url + (nextIdx === 1 ? "?from=nav" : "");
      }
    }

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSwipeNav);
  } else {
    initSwipeNav();
  }
})();
