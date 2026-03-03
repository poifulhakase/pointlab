const fs = require("fs");
const path = require("path");
const articlesDir = path.join(__dirname, "..", "articles");
const files = fs.readdirSync(articlesDir).filter((f) => f.endsWith(".html"));
let count = 0;
for (const file of files) {
  const filePath = path.join(articlesDir, file);
  let content = fs.readFileSync(filePath, "utf8");
  const before = content;
  content = content.replace(
    /<a href="\.\.\/" class="site-logo">ぽいんとらぼ<\/a>/g,
    '<a href="../" class="site-logo"><img src="../logo.svg" alt="ぽいんとらぼ" /></a>'
  );
  content = content.replace(
    /<a href="\.\.\/index-en\.html" class="site-logo">PointLab<\/a>/g,
    '<a href="../index-en.html" class="site-logo"><img src="../logo.svg" alt="PointLab" /></a>'
  );
  if (content !== before) {
    fs.writeFileSync(filePath, content);
    count++;
  }
}
console.log(`Updated ${count} article files. Run from pointlab/pointlab: node scripts/update-logo.js`);
