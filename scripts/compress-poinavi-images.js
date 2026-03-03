/**
 * 研究所（poinavi）画像の軽量化
 * 荒くならない程度に圧縮
 * 背景: WebP変換(quality 88)＋最大幅1600px
 * 博士: PNG圧縮＋最大辺800px
 * 実行: node scripts/compress-poinavi-images.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POINAVI_DIR = path.join(__dirname, '..', 'poinavi');

const BG_MAX_WIDTH = 1600;
const HAKASE_MAX = 800;
const PNG_COMPRESSION = 9;
const WEBP_QUALITY = 88;

const BG_FILES = ['lab-bg.png', 'lab-bg-light.png'];
const HAKASE_FILES = ['hakase.png', 'hakase-default.png'];

async function main() {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch (e) {
    console.log('sharp をインストールしてください: npm install sharp');
    process.exit(1);
  }

  if (!fs.existsSync(POINAVI_DIR)) {
    console.log('poinavi フォルダが見つかりません');
    return;
  }

  console.log('研究所画像の軽量化中...');
  let totalSaved = 0;

  for (const file of BG_FILES) {
    const inputPath = path.join(POINAVI_DIR, file);
    if (!fs.existsSync(inputPath)) continue;
    try {
      const beforeSize = fs.statSync(inputPath).size;
      const meta = await sharp(inputPath).metadata();
      const needResize = meta.width && meta.width > BG_MAX_WIDTH;
      let pipeline = sharp(inputPath);
      if (needResize) pipeline = pipeline.resize(BG_MAX_WIDTH, null, { withoutEnlargement: true });
      const webpPath = inputPath.replace(/\.png$/, '.webp');
      await pipeline.webp({ quality: WEBP_QUALITY }).toFile(webpPath);
      const afterSize = fs.statSync(webpPath).size;
      const saved = beforeSize - afterSize;
      if (saved > 0) {
        totalSaved += saved;
        const pct = ((1 - afterSize / beforeSize) * 100).toFixed(1);
        console.log(`  ${file} → .webp: ${(beforeSize/1024).toFixed(0)}KB → ${(afterSize/1024).toFixed(0)}KB (-${pct}%)`);
      }
    } catch (err) {
      console.warn(`  ${file}: ${err.message}`);
    }
  }

  for (const file of HAKASE_FILES) {
    const inputPath = path.join(POINAVI_DIR, file);
    if (!fs.existsSync(inputPath)) continue;
    try {
      const beforeSize = fs.statSync(inputPath).size;
      const meta = await sharp(inputPath).metadata();
      const needResize = (meta.width || 0) > HAKASE_MAX || (meta.height || 0) > HAKASE_MAX;
      let pipeline = sharp(inputPath);
      if (needResize) pipeline = pipeline.resize(HAKASE_MAX, HAKASE_MAX, { fit: 'inside', withoutEnlargement: true });
      await pipeline.png({ compressionLevel: PNG_COMPRESSION }).toFile(inputPath + '.tmp');
      const afterSize = fs.statSync(inputPath + '.tmp').size;
      if (afterSize < beforeSize) {
        fs.renameSync(inputPath + '.tmp', inputPath);
        totalSaved += beforeSize - afterSize;
        const pct = ((1 - afterSize / beforeSize) * 100).toFixed(1);
        console.log(`  ${file}: ${(beforeSize/1024).toFixed(0)}KB → ${(afterSize/1024).toFixed(0)}KB (-${pct}%)`);
      } else {
        fs.unlinkSync(inputPath + '.tmp');
      }
    } catch (err) {
      if (fs.existsSync(inputPath + '.tmp')) fs.unlinkSync(inputPath + '.tmp');
      console.warn(`  ${file}: ${err.message}`);
    }
  }

  if (totalSaved > 0) {
    console.log(`\n合計 ${(totalSaved/1024).toFixed(0)}KB 削減`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
