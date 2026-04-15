/**
 * ブラウザ言語に基づく初回リダイレクト
 * 不明な場合は日本語。ユーザーが言語切替で選択した場合はlocalStorageを優先。
 */
(function() {
  var STORAGE_KEY = 'pointlab_lang';
  var path = window.location.pathname;

  if (path !== '/' && path !== '/index.html' && !/\/index\.html$/.test(path)) return;
  if (path.indexOf('index-en') !== -1 || path.indexOf('index-zh') !== -1) return;

  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'zh') { window.location.replace('/index-zh.html'); return; }
    if (saved === 'en') { window.location.replace('/index-en.html'); return; }
    if (saved === 'ja') return;

    var lang = 'ja';
    var nav = navigator;
    var pref = (nav.languages && nav.languages[0]) || nav.language || '';

    if (pref) {
      var p = pref.toLowerCase();
      if (p.indexOf('zh') === 0) lang = 'zh';
      else if (p.indexOf('en') === 0) lang = 'en';
    }

    if (lang === 'zh') { window.location.replace('/index-zh.html'); }
    else if (lang === 'en') { window.location.replace('/index-en.html'); }
  } catch (e) {}
})();
