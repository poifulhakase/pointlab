/**
 * 既存の note 記事に zh-Hant hreflang を追加
 * node scripts/add-zh-hreflang.js
 */
const fs = require('fs');
const path = require('path');

const articlesDir = path.join(__dirname, '..', 'articles');
const files = fs.readdirSync(articlesDir).filter(f => f.startsWith('note-') && f.endsWith('.html'));

const enPattern = /<link rel="alternate" hreflang="en" href="https:\/\/pointlab\.vercel\.app\/articles\/note-([a-z0-9]+)-en\.html" \/>/;

let count = 0;
for (const f of files) {
  const fp = path.join(articlesDir, f);
  let content = fs.readFileSync(fp, 'utf8');

  if (content.includes('hreflang="zh-Hant"')) continue;

  const match = content.match(enPattern);
  if (match) {
    const id = match[1];
    const zhLine = `    <link rel="alternate" hreflang="zh-Hant" href="https://pointlab.vercel.app/articles/note-${id}-en.html" />`;
    content = content.replace(enPattern, match[0] + '\n' + zhLine);
    fs.writeFileSync(fp, content);
    count++;
  }
}

console.log(`Updated ${count} article files with zh-Hant hreflang`);
