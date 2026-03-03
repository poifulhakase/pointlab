/**
 * 記事ページ一括更新：ヘッダーをアイコン化、右サイドバー削除
 * node scripts/update-article-pages.js
 */
const fs = require('fs');
const path = require('path');

const articlesDir = path.join(__dirname, '..', 'articles');
const files = fs.readdirSync(articlesDir).filter((f) => f.endsWith('.html'));

const OLD_HEADER_REGEX = /<header class="site-header"><div class="site-header__inner">[\s\S]*?<\/div><\/header>/;
const NEW_HEADER = `    <div id="site-header-root"></div>
    <script src="../js/header-include.js"></script>`;

const SIDEBAR_REGEX = /<aside class="layout-sidebar">[\s\S]*?<\/aside>\s*/g;

let updated = 0;
for (const file of files) {
  const filepath = path.join(articlesDir, file);
  let content = fs.readFileSync(filepath, 'utf8');

  let changed = false;

  // 1. 古いヘッダーを header-include に差し替え
  if (OLD_HEADER_REGEX.test(content)) {
    content = content.replace(OLD_HEADER_REGEX, NEW_HEADER);
    changed = true;
  }

  // 2. 右サイドバー（記事一覧・言語）を削除
  if (content.includes('layout-sidebar')) {
    content = content.replace(SIDEBAR_REGEX, '');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filepath, content);
    updated++;
    console.log('Updated:', file);
  }
}

console.log('Done. Updated', updated, 'files.');
