/**
 * 画像圧縮スクリプト（SEO・表示速度改善用）
 * JPEG: quality 82、最大幅 1200px
 * PNG: compressionLevel 9、最大幅 1200px
 * Poikatsu_3min_Recipe_*.png: JPEG変換＋最大幅640px（カード用、軽量化優先）
 * カード用PNG（Side_Biz等）: 最大幅640px＋PNG圧縮
 * 荒くならない程度に軽量化
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = path.join(__dirname, '..', 'images');
const MAX_WIDTH = 1200;
const THUMB_MAX_WIDTH = 640; // カードサムネイル用（表示320px程度）
const JPEG_QUALITY = 82;
const PNG_COMPRESSION = 9;
const PNG_TO_JPEG_PATTERN = /^Poikatsu_3min_Recipe_.*\.png$/i; // 写真風PNG→JPEG変換対象
const CARD_THUMB_PNG = /^(Side_Biz_Encyclopedia_Delegate|Pointlab_thumbnail)\.png$/i; // カード用PNG→640px圧縮

async function main() {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch (e) {
    console.log('sharp をインストール中...');
    execSync('npm install sharp --save-dev', { stdio: 'inherit', cwd: path.join(__dirname, '..', '..') });
    sharp = (await import('sharp')).default;
  }

  if (!fs.existsSync(IMAGES_DIR)) {
    console.log('images フォルダがありません。スキップします。');
    return;
  }

  const files = fs.readdirSync(IMAGES_DIR).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
  if (files.length === 0) {
    console.log('圧縮対象の画像がありません。');
    return;
  }

  console.log(`画像圧縮中 (${files.length}件)...`);
  let totalSaved = 0;

  for (const file of files) {
    const inputPath = path.join(IMAGES_DIR, file);
    const ext = path.extname(file).toLowerCase();
    const baseName = path.basename(file, ext);
    let beforeSize, afterSize;
    const isThumbPng = ext === '.png' && PNG_TO_JPEG_PATTERN.test(file);
    const isCardThumbPng = ext === '.png' && CARD_THUMB_PNG.test(file);

    try {
      beforeSize = fs.statSync(inputPath).size;
      const pipeline = sharp(inputPath);
      const meta = await pipeline.metadata();
      const maxW = (isThumbPng || isCardThumbPng) ? THUMB_MAX_WIDTH : MAX_WIDTH;
      const needResize = meta.width && meta.width > maxW;

      if (ext === '.jpg' || ext === '.jpeg') {
        await pipeline
          .resize(needResize ? maxW : null, null, { withoutEnlargement: true })
          .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
          .toFile(inputPath + '.tmp');
      } else if (isThumbPng) {
        const jpgPath = path.join(IMAGES_DIR, baseName + '.jpg');
        await sharp(inputPath)
          .resize(needResize ? maxW : null, null, { withoutEnlargement: true })
          .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
          .toFile(jpgPath);
        afterSize = fs.statSync(jpgPath).size;
        if (afterSize < beforeSize) {
          fs.unlinkSync(inputPath);
          const saved = beforeSize - afterSize;
          totalSaved += saved;
          const pct = ((1 - afterSize / beforeSize) * 100).toFixed(1);
          console.log(`  ${file} → ${baseName}.jpg: ${(beforeSize/1024).toFixed(0)}KB → ${(afterSize/1024).toFixed(0)}KB (-${pct}%)`);
        } else {
          fs.unlinkSync(jpgPath);
        }
        continue;
      } else {
        await pipeline
          .resize(needResize ? maxW : null, null, { withoutEnlargement: true })
          .png({ compressionLevel: PNG_COMPRESSION })
          .toFile(inputPath + '.tmp');
      }

      afterSize = fs.statSync(inputPath + '.tmp').size;
      if (afterSize < beforeSize) {
        fs.renameSync(inputPath + '.tmp', inputPath);
        const saved = beforeSize - afterSize;
        totalSaved += saved;
        const pct = ((1 - afterSize / beforeSize) * 100).toFixed(1);
        console.log(`  ${file}: ${(beforeSize/1024).toFixed(0)}KB → ${(afterSize/1024).toFixed(0)}KB (-${pct}%)`);
      } else {
        fs.unlinkSync(inputPath + '.tmp');
      }
    } catch (err) {
      if (fs.existsSync(inputPath + '.tmp')) fs.unlinkSync(inputPath + '.tmp');
      console.warn(`  ${file}: スキップ (${err.message})`);
    }
  }

  if (totalSaved > 0) {
    console.log(`\n合計 ${(totalSaved/1024).toFixed(0)}KB 削減しました。`);
  } else {
    console.log('圧縮効果がなかったか、既に最適化済みです。');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
