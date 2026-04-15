/**
 * 設定モーダル（ハカセAI風）
 * index / index-en / index-zh / disclaimer / privacy / contact / service 等で使用
 */
(function () {
  var STORAGE_KEY = 'pointlab_theme';

  function getModal() {
    return document.getElementById('pointlab-settings-modal');
  }

  function openModal() {
    var modal = getModal();
    if (modal) {
      modal.classList.remove('hidden');
      history.pushState({ modal: 'settings' }, '');
    }
  }

  function closeModal() {
    var modal = getModal();
    if (modal && !modal.classList.contains('hidden')) {
      modal.classList.add('hidden');
    }
  }

  function getEffectiveTheme() {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      var systemPref = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      if (theme === systemPref) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, theme);
      }
    } catch (e) {}
    updateThemeButton(theme);
  }

  function updateThemeButton(theme) {
    var btn = document.getElementById('pointlabThemeToggle');
    var icon = document.querySelector('.pointlab-settings-modal__theme-icon');
    var text = document.querySelector('.pointlab-settings-modal__theme-text');
    if (!btn || !icon || !text) return;

    var lang = (document.documentElement.getAttribute('lang') || 'ja').toLowerCase();
    var isEn = lang.startsWith('en');
    var isZh = lang.startsWith('zh');

    if (theme === 'dark') {
      icon.textContent = '🌙';
      text.textContent = isEn ? 'Dark Mode' : isZh ? '深色模式' : 'ダークモード';
    } else {
      icon.textContent = '☀️';
      text.textContent = isEn ? 'Light Mode' : isZh ? '淺色模式' : 'ライトモード';
    }
  }

  function init() {
    var modal = getModal();
    if (!modal) return;

    var closeBtn = document.getElementById('pointlabSettingsModalClose');
    var overlay = modal.querySelector('.pointlab-settings-modal__overlay');
    var themeBtn = document.getElementById('pointlabThemeToggle');

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (overlay) overlay.addEventListener('click', closeModal);

    if (themeBtn) {
      var theme = getEffectiveTheme();
      updateThemeButton(theme);
      themeBtn.addEventListener('click', function () {
        var current = document.documentElement.getAttribute('data-theme') || getEffectiveTheme();
        var next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
      });
    }

    // 言語リンク：モーダルを開いたまま遷移（?open=settings で遷移後もモーダル表示）
    modal.querySelectorAll('.pointlab-settings-modal__lang-link').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var href = link.getAttribute('href');
        if (href && !link.hasAttribute('aria-current')) {
          e.preventDefault();
          var sep = href.indexOf('?') >= 0 ? '&' : '?';
          window.location.href = href + sep + 'open=settings';
        }
      });
    });

    // ページ読み込み時に ?open=settings があればモーダルを開く
    if (window.location.search.indexOf('open=settings') >= 0) {
      openModal();
      var url = window.location.pathname + window.location.hash;
      history.replaceState(null, '', url);
    }

    // ヘッダーの設定ボタンでモーダルオープン（イベント委譲で確実に）
    document.addEventListener('click', function (e) {
      if (e.target.closest('#header-settings-trigger')) {
        e.preventDefault();
        e.stopPropagation();
        openModal();
      }
    });

    window.addEventListener('popstate', function () {
      closeModal();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
