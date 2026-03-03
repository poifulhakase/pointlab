/**
 * デプロイ前に副業画像のURLにキャッシュバスティング ?v= を付与
 * vercel.json の immutable キャッシュで更新が本番に反映されない問題を解消
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const imgPath = path.join(ROOT, 'images', 'Side_Biz_Encyclopedia_Delegate.png');

// poinavi/script.js の ?v= をデプロイごとに更新（先に実行・画像がなくても動く）
const deployVersion = Math.floor(Date.now() / 1000);
const poinaviMap = path.join(ROOT, 'poinavi', 'map.html');
if (fs.existsSync(poinaviMap)) {
  let mapContent = fs.readFileSync(poinaviMap, 'utf8');
  const newMap = mapContent.replace(/(script\.js)(\?v=\d+)?/g, `$1?v=${deployVersion}`);
  if (newMap !== mapContent) {
    fs.writeFileSync(poinaviMap, newMap, 'utf8');
    console.log(`poinavi script.js: ?v=${deployVersion}`);
  }
}

if (!fs.existsSync(imgPath)) {
  console.warn('副業画像が見つかりません。スキップします。');
  process.exit(0);
}

const stat = fs.statSync(imgPath);
const version = Math.floor(stat.mtimeMs / 1000);

const htmlFiles = ['index.html', 'index-en.html', 'index-zh.html'];
const imgPattern = /(\.\/images\/Side_Biz_Encyclopedia_Delegate\.png)(\?v=\d+)?/g;
const replacement = `./images/Side_Biz_Encyclopedia_Delegate.png?v=${version}`;

let updated = 0;
for (const file of htmlFiles) {
  const filePath = path.join(ROOT, file);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf8');
  const newContent = content.replace(imgPattern, replacement);
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    updated++;
  }
}

if (updated > 0) {
  console.log(`キャッシュバスティング適用: ?v=${version} (${updated} ファイル)`);
}
