/**
 * 共通ヘッダーを挿入するスクリプト
 * body に data-header-base でベースパスを指定可能（例: data-header-base="../"）
 * 指定しない場合は pathname から自動検出（/articles/ 配下なら ../）
 */
(function () {
  var script = document.currentScript;
  var base = '../';
  if (script && script.src) {
    base = script.src.includes('/articles/') ? '../' : './';
  }
  var bodyBase = document.body && document.body.getAttribute('data-header-base');
  if (bodyBase !== null) base = bodyBase;

  var lang = (document.documentElement.getAttribute('lang') || 'ja').toLowerCase();
  var isEn = lang.startsWith('en');
  var isZh = lang.startsWith('zh');

  var homeUrl = base;
  var homeLabel = 'ホーム';
  var profileLabel = 'プロフィール';
  var settingsUrl = base + 'settings.html';
  var settingsLabel = '設定';
  var contactUrl = base + 'contact.html';
  var contactLabel = 'お問い合わせ';
  var logoAlt = 'ぽいんとらぼ';

  if (isEn) {
    homeUrl = base + (base === '../' ? 'index-en.html' : 'index-en.html');
    homeLabel = 'Home';
    profileLabel = 'Profile';
    settingsUrl = base + 'settings-en.html';
    settingsLabel = 'Settings';
    contactLabel = 'Contact';
    logoAlt = 'PointLab';
  } else if (isZh) {
    homeUrl = base + 'index-zh.html';
    homeLabel = '首頁';
    profileLabel = '個人簡介';
    settingsUrl = base + 'settings-zh.html';
    settingsLabel = '設定';
    contactLabel = '聯絡我們';
    logoAlt = 'PointLab';
  }

  var html = '<header class="site-header">' +
    '<div class="site-header__inner">' +
    '<a href="' + homeUrl + '" class="site-logo"><img src="' + base + 'logo.svg" alt="' + logoAlt + '" /></a>' +
    '<nav><ul class="nav-list">' +
    '<li><a href="' + homeUrl + '">' + homeLabel + '</a></li>' +
    '<li><a href="https://note.com/pointlab/n/n9f6f5df2d619" target="_blank" rel="noopener noreferrer">' + profileLabel + '</a></li>' +
    '<li><a href="' + settingsUrl + '">' + settingsLabel + '</a></li>' +
    '<li><a href="' + contactUrl + '">' + contactLabel + '</a></li>' +
    '</ul></nav></div></header>';

  var root = document.getElementById('site-header-root');
  if (root) {
    root.outerHTML = html;
  }
})();
