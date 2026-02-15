/**
 * 言語切り替え：選択ハイライト + クリック時にlocalStorage保存
 */
(function () {
  var STORAGE_KEY = 'pointlab_lang';

  function getPreferredLang() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return saved;
    } catch (e) {}
    if (navigator.languages && navigator.languages.length) {
      var p = navigator.languages[0].toLowerCase();
      if (p.indexOf('zh') === 0) return 'zh';
      return p.indexOf('ja') === 0 ? 'ja' : 'en';
    }
    var l = (navigator.language || '').toLowerCase();
    if (l.indexOf('zh') === 0) return 'zh';
    return l.indexOf('ja') === 0 ? 'ja' : 'en';
  }

  function init() {
    var preferred = getPreferredLang();
    document.querySelectorAll('.lang-switcher').forEach(function (sw) {
      sw.querySelectorAll('.lang-switcher__tag').forEach(function (tag) {
        var lang = tag.getAttribute('data-lang');
        tag.classList.toggle('is-selected', lang === preferred);
        tag.addEventListener('click', function (e) {
          try { localStorage.setItem(STORAGE_KEY, lang); } catch (err) {}
        });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
