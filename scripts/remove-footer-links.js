const fs = require('fs');
const path = require('path');
const articlesDir = path.join(__dirname, '..', 'articles');
const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.html'));
const pattern = /<a href="https:\/\/note\.com\/pointlab"[^>]*>note<\/a><a href="https:\/\/jp\.pinterest\.com\/pointlab\/"[^>]*>Pinterest<\/a><a href="https:\/\/medium\.com\/@pointlab"[^>]*>Medium<\/a>/g;
let count = 0;
for (const file of files) {
  const fp = path.join(articlesDir, file);
  const c = fs.readFileSync(fp, 'utf8');
  const newC = c.replace(pattern, '');
  if (newC !== c) {
    fs.writeFileSync(fp, newC);
    count++;
  }
}
console.log('Updated', count, 'files');
