/**
 * Add theme init script to all article HTML files.
 * Run from pointlab/pointlab: node scripts/add-theme-to-articles.js
 */
const fs = require('fs');
const path = require('path');

const THEME_SCRIPT = '<script>(function(){var t=localStorage.getItem(\'pointlab_theme\');var s=window.matchMedia&&window.matchMedia(\'(prefers-color-scheme:dark)\').matches?\'dark\':\'light\';document.documentElement.setAttribute(\'data-theme\',t===\'dark\'||t===\'light\'?t:s);})();</script>';

const articlesDir = path.join(__dirname, '..', 'articles');
const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.html'));

let updated = 0;
for (const file of files) {
  const filePath = path.join(articlesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('pointlab_theme')) continue;
  const before = content;
  // Pattern 1: <meta charset.../><meta name="viewport".../>
  content = content.replace(
    /(<meta charset="[^"]*" \/><meta name="viewport" content="[^"]*" \/>)/,
    '$1\n    ' + THEME_SCRIPT
  );
  // Pattern 2: separate lines
  if (!content.includes('pointlab_theme')) {
    content = content.replace(
      /(<meta name="viewport" content="[^"]*" \/>)\s*\n/,
      '$1\n    ' + THEME_SCRIPT + '\n'
    );
  }
  if (content === before) continue;
  fs.writeFileSync(filePath, content);
  updated++;
  console.log('Updated:', file);
}
console.log('Done. Updated', updated, 'files.');
