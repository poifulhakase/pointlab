/**
 * デプロイ前チェック：必須ファイルの存在確認
 * 404 を防ぐため、画像・JSが揃っているか検証
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const required = {
  js: ['language-switcher.js', 'mobile-nav.js', 'scrollbar-on-scroll.js', 'article-scrollbar.js', 'two-row-scroll.js'],
  imagesMin: 20  // サムネイル約25種類のため、最低20件で不足を検知
};

let ok = true;
const missing = [];

// JS チェック
const jsDir = path.join(ROOT, 'js');
if (!fs.existsSync(jsDir)) {
  missing.push('js/ フォルダがありません');
  ok = false;
} else {
  for (const f of required.js) {
    if (!fs.existsSync(path.join(jsDir, f))) {
      missing.push('js/' + f);
      ok = false;
    }
  }
}

// 画像チェック
const imgDir = path.join(ROOT, 'images');
let imgCount = 0;
if (fs.existsSync(imgDir)) {
  imgCount = fs.readdirSync(imgDir).filter(f => /\.(jpg|jpeg|png)$/i.test(f)).length;
}
if (imgCount < required.imagesMin) {
  missing.push(`images/ に画像が ${imgCount}件 です（${required.imagesMin}件以上必要）`);
  ok = false;
}

// 副業サムネ
const sideBizImg = path.join(imgDir, 'Side_Biz_Encyclopedia_Delegate.png');
if (!fs.existsSync(sideBizImg)) {
  missing.push('images/Side_Biz_Encyclopedia_Delegate.png を images/ に入れてください');
  ok = false;
}

if (!ok) {
  console.error('\n=== デプロイ中止：以下の問題があります ===');
  missing.forEach(m => console.error('  -', m));
  console.error('\n対処: 画像を images/ に入れて deploy-now.bat を再実行\n');
  process.exit(1);
}

console.log('OK: 必須ファイル揃っています（JS:', required.js.length, '件 / 画像:', imgCount, '件）');
