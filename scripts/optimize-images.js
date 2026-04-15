#!/usr/bin/env node
/**
 * 画像の軽量化: WebP変換、圧縮、srcset/picture 対応
 * 実行: npm install sharp --save-dev && node scripts/optimize-images.js
 * 前提: pointlab/images/ に PNG/JPEG が配置されていること
 */
const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, '..', 'images');
const THUMB_WIDTH = 320;
const QUALITY = 80;

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.log('sharp がインストールされていません。実行: npm install sharp --save-dev');
    process.exit(1);
  }

  if (!fs.existsSync(IMAGES_DIR)) {
    console.log('images フォルダが見つかりません');
    return;
  }

  const files = fs.readdirSync(IMAGES_DIR).filter(f => 
    /\.(png|jpe?g)$/i.test(f) && !f.endsWith('.webp')
  );

  if (files.length === 0) {
    console.log('最適化対象の画像がありません');
    return;
  }

  for (const f of files) {
    const src = path.join(IMAGES_DIR, f);
    const base = f.replace(/\.(png|jpe?g)$/i, '');
    const webpPath = path.join(IMAGES_DIR, `${base}.webp`);

    try {
      await sharp(src)
        .resize(THUMB_WIDTH, null, { withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toFile(webpPath);
      const orig = fs.statSync(src).size;
      const opt = fs.statSync(webpPath).size;
      console.log(`  ${f} → ${base}.webp (${(opt/1024).toFixed(1)}KB, -${((1-opt/orig)*100).toFixed(0)}%)`);
    } catch (err) {
      console.warn(`  ${f}: ${err.message}`);
    }
  }
  console.log(`${files.length} 件の WebP を生成しました。HTML で picture 要素を使うと軽量化されます。`);
}

main();
