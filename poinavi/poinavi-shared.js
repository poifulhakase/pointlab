/**
 * ぽいナビ 共通ユーティリティ
 * テーマ・HTMLエスケープ等を各ページで共有
 */
(function () {
  "use strict";
  var THEME_KEY = "poinavi_theme";

  window.PoinaviShared = {
    /** 保存されたテーマを取得 */
    getTheme: function () {
      return localStorage.getItem(THEME_KEY) || "light";
    },
    /** テーマを保存して適用 */
    setTheme: function (theme) {
      localStorage.setItem(THEME_KEY, theme);
      this.applyTheme(theme);
    },
    /** HTMLにテーマクラスを適用 */
    applyTheme: function (theme) {
      var c = theme === "dark" ? "dark-mode" : "light-mode";
      document.documentElement.className = c;
      document.body.className = c;
    },
    /** 保存済みテーマを適用（初回レンダリング用） */
    initTheme: function () {
      this.applyTheme(this.getTheme());
    },
    /** HTMLエスケープ（XSS対策） */
    escapeHtml: function (text) {
      if (!text) return "";
      var div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    },
  };
})();
