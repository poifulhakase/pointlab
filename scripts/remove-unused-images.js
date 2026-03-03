/**
 * pointlab/images 内の未使用画像を検出して削除
 * 使い方: node scripts/remove-unused-images.js [--dry-run]
 *   --dry-run: 削除せず一覧表示のみ
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pointlabRoot = path.join(__dirname, '..');
const imagesDir = path.join(pointlabRoot, 'images');
const dryRun = process.argv.includes('--dry-run');

// HTML/CSS/JS から参照される画像名を収集
function collectReferencedImages() {
  const refs = new Set();

  function scanFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      // ./images/XXX.png, images/XXX.jpg などを抽出
      const matches = content.matchAll(/(?:\.\/)?images\/([^"')\s]+?)(?:\?[^"')]*)?(?:["'\s)]|$)/g);
      for (const m of matches) {
        let name = m[1].trim();
        if (name) refs.add(decodeURIComponent(name));
      }
      // pointlab.vercel.app/images/ 形式
      const absMatches = content.matchAll(/pointlab\.vercel\.app\/images\/([^"')\s]+?)(?:\.png|\.jpg|\.jpeg|\.webp)/gi);
      for (const m of absMatches) refs.add(m[1]);
    } catch {}
  }

  const htmlDir = pointlabRoot;
  const articlesDir = path.join(pointlabRoot, 'articles');
  for (const f of fs.readdirSync(htmlDir).filter(n => n.endsWith('.html'))) {
    scanFile(path.join(htmlDir, f));
  }
  if (fs.existsSync(articlesDir)) {
    for (const f of fs.readdirSync(articlesDir).filter(n => n.endsWith('.html'))) {
      scanFile(path.join(articlesDir, f));
    }
  }

  return refs;
}

// 参照名とファイル名のマッチ（大文字小文字・拡張子の違いを許容）
function isReferenced(fileName, refs) {
  const base = path.basename(fileName);
  const nameNoExt = path.basename(fileName, path.extname(fileName));
  for (const r of refs) {
    const rBase = path.basename(r);
    const rNoExt = rBase.replace(/\.(png|jpg|jpeg|webp|avif)$/i, '');
    if (base === rBase || nameNoExt === rNoExt) return true;
  }
  return false;
}

function main() {
  if (!fs.existsSync(imagesDir)) {
    console.log('images フォルダがありません。');
    return;
  }

  const refs = collectReferencedImages();
  const files = fs.readdirSync(imagesDir).filter(f =>
    /\.(png|jpg|jpeg|webp|avif)$/i.test(f)
  );

  const unused = files.filter(f => !isReferenced(f, refs));

  if (unused.length === 0) {
    console.log('未使用の画像はありません。');
    return;
  }

  console.log(`未使用画像（${unused.length}件）:`);
  unused.forEach(f => {
    const p = path.join(imagesDir, f);
    const size = (fs.statSync(p).size / 1024).toFixed(1);
    console.log(`  ${f} (${size}KB)`);
  });

  if (!dryRun) {
    console.log('\n削除します...');
    for (const f of unused) {
      fs.unlinkSync(path.join(imagesDir, f));
      console.log(`  削除: ${f}`);
    }
    console.log('完了。');
  } else {
    console.log('\n--dry-run のため削除しません。削除するには引数なしで実行: node scripts/remove-unused-images.js');
  }
}

main();
