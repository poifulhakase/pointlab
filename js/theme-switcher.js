/**
 * テーマ切替（ライト / ダークモード）
 * 設定ページのUIと全ページでの適用を担当
 */
(function () {
  var STORAGE_KEY = 'pointlab_theme';

  function getStoredTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function getSystemPreference() {
    if (typeof window.matchMedia !== 'function') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function getEffectiveTheme() {
    var stored = getStoredTheme();
    if (stored === 'dark' || stored === 'light') return stored;
    return getSystemPreference();
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      if (theme === getSystemPreference()) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, theme);
      }
    } catch (e) {}
  }

  function initSwitcher() {
    var container = document.querySelector('.theme-switcher');
    if (!container) return;

    var effective = getEffectiveTheme();
    container.querySelectorAll('.theme-switcher__btn').forEach(function (btn) {
      var isActive = btn.getAttribute('data-theme') === effective;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive);

      btn.addEventListener('click', function () {
        var theme = btn.getAttribute('data-theme');
        applyTheme(theme);
        container.querySelectorAll('.theme-switcher__btn').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
          b.setAttribute('aria-pressed', b === btn);
        });
      });
    });
  }

  function initEarly() {
    document.documentElement.setAttribute('data-theme', getEffectiveTheme());
  }

  initEarly();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSwitcher);
  } else {
    initSwitcher();
  }
})();
