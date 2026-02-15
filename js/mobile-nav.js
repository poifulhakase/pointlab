/**
 * モバイル：ハンバーガーメニュー
 * 横幅が狭いときはナビを折りたたみ、ボタンで開閉する
 * オーバーレイ付きドロワー、開閉アニメーション対応
 */
(function () {
  var BREAKPOINT = 700;

  function isMobile() {
    return window.innerWidth <= BREAKPOINT;
  }

  function init() {
    var header = document.querySelector('.site-header');
    if (!header) return;

    var inner = header.querySelector('.site-header__inner');
    var nav = header.querySelector('nav');
    if (!inner || !nav) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-toggle';
    btn.setAttribute('aria-label', 'メニューを開く');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span></span><span></span><span></span>';

    inner.insertBefore(btn, nav);
    header.classList.add('has-mobile-nav');

    var overlay = document.createElement('div');
    overlay.className = 'mobile-menu-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);

    function getScrollbarWidth() {
      return window.innerWidth - document.documentElement.clientWidth;
    }

    function setOpen(open) {
      header.classList.toggle('is-menu-open', open);
      overlay.classList.toggle('is-visible', open);
      overlay.setAttribute('aria-hidden', open ? 'false' : 'true');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
      document.body.classList.toggle('is-mobile-menu-open', open);
      if (open) {
        var sb = getScrollbarWidth();
        document.body.style.paddingRight = sb > 0 ? sb + 'px' : '';
      } else {
        document.body.style.paddingRight = '';
      }
    }

    function updateLayout() {
      if (isMobile()) {
        btn.style.display = '';
        setOpen(false);
      } else {
        btn.style.display = 'none';
        setOpen(false);
      }
    }

    btn.addEventListener('click', function () {
      setOpen(!header.classList.contains('is-menu-open'));
    });

    overlay.addEventListener('click', function () {
      setOpen(false);
    });

    nav.addEventListener('click', function (e) {
      if (isMobile() && e.target.closest('a')) {
        setOpen(false);
      }
    });

    window.addEventListener('resize', updateLayout);
    updateLayout();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
