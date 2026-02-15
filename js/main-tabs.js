/**
 * メインタブ切替（記事 / 動画）
 */
(function () {
  var tablist = document.querySelector('.main-tabs');
  if (!tablist) return;

  var tabs = tablist.querySelectorAll('.main-tabs__tab');
  var panels = document.querySelectorAll('.tab-panel');

  function switchTo(tabName) {
    tabs.forEach(function (t) {
      var isActive = t.getAttribute('data-tab') === tabName;
      t.classList.toggle('is-active', isActive);
      t.setAttribute('aria-selected', isActive);
    });
    panels.forEach(function (p) {
      var isMatch = p.id === 'panel-' + tabName;
      p.classList.toggle('is-active', isMatch);
      p.hidden = !isMatch;
    });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      switchTo(tab.getAttribute('data-tab'));
    });
    tab.addEventListener('keydown', function (e) {
      var idx = Array.prototype.indexOf.call(tabs, tab);
      var next;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        next = tabs[idx + 1] || tabs[0];
        next.focus();
        switchTo(next.getAttribute('data-tab'));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        next = tabs[idx - 1] || tabs[tabs.length - 1];
        next.focus();
        switchTo(next.getAttribute('data-tab'));
      }
    });
  });
})();
