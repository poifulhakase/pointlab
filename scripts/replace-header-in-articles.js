/**
 * Replace inline header with header-include in article HTML files.
 * Run from pointlab/pointlab: node scripts/replace-header-in-articles.js
 */
const fs = require('fs');
const path = require('path');

const articlesDir = path.join(__dirname, '..', 'articles');
const files = fs.readdirSync(articlesDir).filter(f => f.startsWith('note-') && f.endsWith('.html'));

const headerPattern = /<header class="site-header">[\s\S]*?<\/header>\s*/;
const replacement = '<div id="site-header-root"></div>\n    <script src="../js/header-include.js"></script>';

let updated = 0;
for (const file of files) {
  const filePath = path.join(articlesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('site-header-root')) continue;
  const newContent = content.replace(headerPattern, replacement);
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent);
    updated++;
    console.log('Updated:', file);
  }
}
console.log('Done. Updated', updated, 'files.');
