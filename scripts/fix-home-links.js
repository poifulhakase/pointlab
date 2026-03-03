const fs = require('fs');
const path = require('path');
const articlesDir = path.join(__dirname, '..', 'articles');
const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.html'));
let count = 0;
for (const file of files) {
  const fp = path.join(articlesDir, file);
  let c = fs.readFileSync(fp, 'utf8');
  if (c.includes('href="../index.html"')) {
    c = c.replace(/href="\.\.\/index\.html"/g, 'href="../"');
    fs.writeFileSync(fp, c);
    count++;
  }
}
console.log('Updated', count, 'files');
