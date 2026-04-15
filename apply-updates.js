// Node.js script to apply language switcher and English content updates
const fs = require('fs');
const path = require('path');

const BASE = __dirname;
const ARTICLES_DIR = path.join(BASE, 'articles');
const TRANSLATIONS = require(path.join(BASE, '_en-translations.json'));

function getNoteIds() {
  const ids = new Set();
  for (const f of fs.readdirSync(ARTICLES_DIR)) {
    const m = f.match(/^note-(n[a-f0-9]+)(-en)?\.html$/);
    if (m && !f.includes('-en'))
      ids.add(m[1]);
  }
  return [...ids].sort();
}

function addScript(content) {
  if (content.includes('language-switcher.js')) return content;
  return content.replace(
    /<link rel="stylesheet" href="\.\.\/css\/article\.css" \/>/,
    '$&\n    <script src="../js/language-switcher.js" defer></script>'
  ).replace(
    /<link rel="stylesheet" href="\.\.\/css\/base\.css" \/><link rel="stylesheet" href="\.\.\/css\/article\.css" \/>/,
    '$&<script src="../js/language-switcher.js" defer></script>'
  );
}

function addLangSwitcherJa(content, id) {
  if (content.includes('lang-switcher')) return content;
  const old = /<aside class="layout-sidebar">\s*<div class="sidebar-section">\s*<h3 class="sidebar-section__title">記事一覧<\/h3>\s*<ul class="sidebar-list">\s*<li><a href="\.\.\/index\.html">全記事を見る<\/a><\/li>\s*<\/ul>\s*<\/div>\s*<\/aside>/s;
  const mini = content.includes('<aside class="layout-sidebar"><div class="sidebar-section">');
  const oldStr = mini
    ? '<aside class="layout-sidebar"><div class="sidebar-section"><h3 class="sidebar-section__title">記事一覧</h3><ul class="sidebar-list"><li><a href="../">全記事を見る</a></li></ul></div></aside>'
    : `      <aside class="layout-sidebar">
        <div class="sidebar-section">
          <h3 class="sidebar-section__title">記事一覧</h3>
          <ul class="sidebar-list">
            <li><a href="../">全記事を見る</a></li>
          </ul>
        </div>
      </aside>`;
  const newStr = mini
    ? `<aside class="layout-sidebar"><div class="sidebar-section"><h3 class="sidebar-section__title">記事一覧</h3><ul class="sidebar-list"><li><a href="../">全記事を見る</a></li></ul></div><div class="sidebar-section"><h3 class="sidebar-section__title">言語</h3><div class="lang-switcher" data-lang="ja"><a href="note-${id}.html" class="lang-switcher__tag" data-lang="ja" aria-current="page">日本語</a><a href="note-${id}-en.html" class="lang-switcher__tag" data-lang="en">English</a></div></div></aside>`
    : `      <aside class="layout-sidebar">
        <div class="sidebar-section">
          <h3 class="sidebar-section__title">記事一覧</h3>
          <ul class="sidebar-list">
            <li><a href="../">全記事を見る</a></li>
          </ul>
        </div>
        <div class="sidebar-section">
          <h3 class="sidebar-section__title">言語</h3>
          <div class="lang-switcher" data-lang="ja">
            <a href="note-${id}.html" class="lang-switcher__tag" data-lang="ja" aria-current="page">日本語</a>
            <a href="note-${id}-en.html" class="lang-switcher__tag" data-lang="en">English</a>
          </div>
        </div>
      </aside>`;
  return content.replace(oldStr, newStr);
}

function addLangSwitcherEn(content, id) {
  if (content.includes('lang-switcher')) return content;
  const mini = content.includes('<aside class="layout-sidebar"><div class="sidebar-section"><h3 class="sidebar-section__title">Articles</h3>');
  const oldStr = mini
    ? '<aside class="layout-sidebar"><div class="sidebar-section"><h3 class="sidebar-section__title">Articles</h3><ul class="sidebar-list"><li><a href="../">View all</a></li></ul></div></aside>'
    : `      <aside class="layout-sidebar">
        <div class="sidebar-section">
          <h3 class="sidebar-section__title">Articles</h3>
          <ul class="sidebar-list">
            <li><a href="../">View all</a></li>
          </ul>
        </div>
      </aside>`;
  const newStr = mini
    ? `<aside class="layout-sidebar"><div class="sidebar-section"><h3 class="sidebar-section__title">Articles</h3><ul class="sidebar-list"><li><a href="../index-en.html">View all</a></li></ul></div><div class="sidebar-section"><h3 class="sidebar-section__title">Language</h3><div class="lang-switcher" data-lang="en"><a href="note-${id}.html" class="lang-switcher__tag" data-lang="ja">日本語</a><a href="note-${id}-en.html" class="lang-switcher__tag" data-lang="en" aria-current="page">English</a></div></div></aside>`
    : `      <aside class="layout-sidebar">
        <div class="sidebar-section">
          <h3 class="sidebar-section__title">Articles</h3>
          <ul class="sidebar-list">
            <li><a href="../index-en.html">View all</a></li>
          </ul>
        </div>
        <div class="sidebar-section">
          <h3 class="sidebar-section__title">Language</h3>
          <div class="lang-switcher" data-lang="en">
            <a href="note-${id}.html" class="lang-switcher__tag" data-lang="ja">日本語</a>
            <a href="note-${id}-en.html" class="lang-switcher__tag" data-lang="en" aria-current="page">English</a>
          </div>
        </div>
      </aside>`;
  return content.replace(oldStr, newStr);
}

function updateEnArticle(content, id) {
  const t = TRANSLATIONS.articles[id];
  if (!t) return content;
  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  content = content.replace(/<title>[^<]*<\/title>/, `<title>${esc(t.title)}｜PointLab</title>`);
  content = content.replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${esc(t.excerpt)}"`);
  content = content.replace(/<p class="article-header__meta">[^<]*<\/p>/, `<p class="article-header__meta">${t.meta}</p>`);
  content = content.replace(/<h1 class="article-header__title">[^<]*<\/h1>/, `<h1 class="article-header__title">${esc(t.title)}</h1>`);
  content = content.replace(/<p style="color:var\(--color-text-muted\);font-size:0\.9rem;">[^<]*<\/p>/, `<p style="color:var(--color-text-muted);font-size:0.9rem;">${esc(t.excerpt)}</p>`);
  content = content.replace(/<a href="\.\.\/index\.html" class="site-logo">PointLab<\/a>/, '<a href="../index-en.html" class="site-logo"><img src="../logo.svg" alt="PointLab" /></a>');
  content = content.replace(/<li><a href="\.\.\/index\.html">Articles<\/a><\/li>/, '<li><a href="../index-en.html">Articles</a></li>');
  return content;
}

// Main
const ids = getNoteIds();
for (const id of ids) {
  const jaPath = path.join(ARTICLES_DIR, `note-${id}.html`);
  const enPath = path.join(ARTICLES_DIR, `note-${id}-en.html`);
  if (fs.existsSync(jaPath)) {
    let c = fs.readFileSync(jaPath, 'utf8');
    c = addScript(c);
    c = addLangSwitcherJa(c, id);
    fs.writeFileSync(jaPath, c);
  }
  if (fs.existsSync(enPath)) {
    let c = fs.readFileSync(enPath, 'utf8');
    c = addScript(c);
    c = addLangSwitcherEn(c, id);
    c = updateEnArticle(c, id);
    fs.writeFileSync(enPath, c);
  }
}

// TradingView
for (const [name, lang] of [['tradingview-ja','ja'],['tradingview-en','en']]) {
  const p = path.join(ARTICLES_DIR, `${name}.html`);
  if (!fs.existsSync(p)) continue;
  let c = fs.readFileSync(p, 'utf8');
  if (!c.includes('language-switcher.js'))
    c = c.replace(/<link rel="stylesheet" href="\.\.\/css\/article\.css" \/>/, '$&\n    <script src="../js/language-switcher.js" defer></script>');
  if (!c.includes('lang-switcher')) {
    const h = lang === 'ja' ? '言語' : 'Language';
    const ja = lang === 'ja' ? ' aria-current="page"' : '';
    const en = lang === 'en' ? ' aria-current="page"' : '';
    const block = lang === 'ja'
      ? `            <li><a href="./tradingview-en.html">TradingView Free vs Paid (EN)</a></li>
          </ul>
        </div>
        <div class="sidebar-section">
          <h3 class="sidebar-section__title">${h}</h3>
          <div class="lang-switcher" data-lang="${lang}">
            <a href="tradingview-ja.html" class="lang-switcher__tag" data-lang="ja"${ja}>日本語</a>
            <a href="tradingview-en.html" class="lang-switcher__tag" data-lang="en"${en}>English</a>
          </div>
        </div>
      </aside>`
      : `            <li><a href="./tradingview-ja.html">TradingView無料版 vs 有料版 (JA)</a></li>
          </ul>
        </div>
        <div class="sidebar-section">
          <h3 class="sidebar-section__title">${h}</h3>
          <div class="lang-switcher" data-lang="${lang}">
            <a href="tradingview-ja.html" class="lang-switcher__tag" data-lang="ja"${ja}>日本語</a>
            <a href="tradingview-en.html" class="lang-switcher__tag" data-lang="en"${en}>English</a>
          </div>
        </div>
      </aside>`;
    const old = lang === 'ja'
      ? `            <li><a href="./tradingview-en.html">TradingView Free vs Paid (EN)</a></li>
          </ul>
        </div>
      </aside>`
      : `            <li><a href="./tradingview-ja.html">TradingView無料版 vs 有料版 (JA)</a></li>
          </ul>
        </div>
      </aside>`;
    c = c.replace(old, block);
  }
  fs.writeFileSync(p, c);
}

console.log('Updated', ids.length, 'note pairs + TradingView');
