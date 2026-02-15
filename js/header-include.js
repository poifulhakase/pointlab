/**
 * 共通ヘッダーを挿入するスクリプト
 * body に data-header-base でベースパスを指定可能（例: data-header-base="../"）
 * 指定しない場合は pathname から自動検出（/articles/ 配下なら ../）
 */
(function () {
  var pathname = window.location.pathname || '';
  var base = pathname.indexOf('/articles/') !== -1 ? '../' : './';
  var bodyBase = document.body && document.body.getAttribute('data-header-base');
  if (bodyBase !== null) base = bodyBase;

  var lang = (document.documentElement.getAttribute('lang') || 'ja').toLowerCase();
  var isEn = lang.startsWith('en');
  var isZh = lang.startsWith('zh');

  var homeUrl = base + 'index.html';
  var profileLabel = 'プロフィール';
  var settingsUrl = base + 'settings.html';
  var settingsLabel = '設定';
  var contactUrl = base + 'contact.html';
  var contactLabel = 'お問い合わせ';
  var logoAlt = 'ぽいんとらぼ';

  if (isEn) {
    homeUrl = base + 'index-en.html';
    profileLabel = 'Profile';
    settingsUrl = base + 'settings-en.html';
    settingsLabel = 'Settings';
    contactLabel = 'Contact';
    logoAlt = 'PointLab';
  } else if (isZh) {
    homeUrl = base + 'index-zh.html';
    profileLabel = '個人簡介';
    settingsUrl = base + 'settings-zh.html';
    settingsLabel = '設定';
    contactLabel = '聯絡我們';
    logoAlt = 'PointLab';
  }

  var profileIcon = '<svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  var settingsIcon = '<svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
  var contactIcon = '<svg class="nav-icon" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>';

  var html = '<header class="site-header">' +
    '<div class="site-header__inner">' +
    '<a href="' + homeUrl + '" class="site-logo"><img src="' + base + 'logo.svg" alt="' + logoAlt + '" /></a>' +
    '<nav><ul class="nav-list nav-list--icons">' +
    '<li><a href="https://note.com/pointlab/n/n9f6f5df2d619" target="_blank" rel="noopener noreferrer" class="nav-list__icon-link" aria-label="' + profileLabel + '">' + profileIcon + '<span class="nav-list__label">' + profileLabel + '</span></a></li>' +
    '<li><a href="' + settingsUrl + '" class="nav-list__icon-link" aria-label="' + settingsLabel + '">' + settingsIcon + '<span class="nav-list__label">' + settingsLabel + '</span></a></li>' +
    '<li><a href="' + contactUrl + '" class="nav-list__icon-link" aria-label="' + contactLabel + '">' + contactIcon + '<span class="nav-list__label">' + contactLabel + '</span></a></li>' +
    '</ul></nav></div></header>';

  var root = document.getElementById('site-header-root');
  if (root) {
    root.outerHTML = html;
  }

  if (pathname.indexOf('/articles/') !== -1) {
    var s = document.createElement('script');
    s.src = '../js/article-scrollbar.js';
    s.defer = true;
    document.head.appendChild(s);
  }
})();
