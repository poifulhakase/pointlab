const fs = require('fs');
const path = require('path');
const articlesDir = path.join(__dirname, '..', 'articles');
const files = fs.readdirSync(articlesDir).filter((f) => f.endsWith('.html'));

const SIDEBAR_REGEX = /<aside class="layout-sidebar">[\s\S]*?<\/aside>\s*/g;
const OLD_HEADER_REGEX = /<header class="site-header">[\s\S]*?<\/header>\s*/;
const NEW_HEADER = '<div id="site-header-root"></div>\n    <script src="../js/header-include.js"></script>\n    ';

let updated = 0;
for (const file of files) {
  const filepath = path.join(articlesDir, file);
  let content = fs.readFileSync(filepath, 'utf8');
  let changed = false;

  if (OLD_HEADER_REGEX.test(content)) {
    content = content.replace(OLD_HEADER_REGEX, NEW_HEADER);
    changed = true;
  }
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
