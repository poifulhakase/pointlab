/**
 * モバイル：ハンバーガーメニュー
 * 横幅が狭いときはナビを折りたたみ、ボタンで開閉する
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

    function setOpen(open) {
      header.classList.toggle('is-menu-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
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
