/**
 * 画像読み込み失敗時にプレースホルダーを表示
 * article-card__thumb のローカル画像（./images/）に適用
 */
(function () {
  var placeholder = "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22320%22 height=%22200%22%3E%3Crect fill=%22%23f3f4f6%22 width=%22320%22 height=%22200%22/%3E%3Ctext fill=%22%239ca3af%22 x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-size=%2214%22%3E%E7%94%BB%E5%83%8F%3C/text%3E%3C/svg%3E";
  function addFallback(img) {
    if (img.dataset.fallbackAdded) return;
    if (!img.getAttribute("decoding")) img.decoding = "async";
    img.onerror = function () {
      this.src = placeholder;
      this.onerror = null;
    };
    img.dataset.fallbackAdded = "1";
    if (!img.complete || img.naturalWidth === 0) {
      var src = img.src;
      img.src = "";
      img.src = src;
    }
  }
  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("img.article-card__thumb[src*='images/']").forEach(addFallback);
  });
})();
