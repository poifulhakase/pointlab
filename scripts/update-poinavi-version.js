/**
 * poinavi/map.html の script.js キャッシュバスターを更新
 * sync-and-push.bat から呼び出し（cwd が DEST である必要あり）
 */
import fs from 'fs';
import path from 'path';

const deployVersion = Math.floor(Date.now() / 1000);
const mapPath = path.join(process.cwd(), 'poinavi', 'map.html');

if (!fs.existsSync(mapPath)) {
  console.warn('poinavi/map.html が見つかりません');
  process.exit(1);
}

let content = fs.readFileSync(mapPath, 'utf8');
const updated = content.replace(/(script\.js)(\?v=\d+)?/g, `$1?v=${deployVersion}`);

if (updated !== content) {
  fs.writeFileSync(mapPath, updated, 'utf8');
}

console.log(`poinavi script.js: ?v=${deployVersion}`);
