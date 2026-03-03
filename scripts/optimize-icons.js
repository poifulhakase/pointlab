#!/usr/bin/env node
/**
 * apple-touch-icon.png と icon-192.png を適切なサイズにリサイズ・圧縮
 * 既存ファイルを上書きします
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const files = [
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192.png', size: 192 },
];

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.error('sharp をインストール: npm i -D sharp');
    process.exit(1);
  }

  for (const { name, size } of files) {
    const src = path.join(root, name);
    if (!fs.existsSync(src)) {
      console.log('Skip (not found):', name);
      continue;
    }
    const tmp = path.join(root, name + '.tmp');
    await sharp(src)
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(tmp);
    fs.renameSync(tmp, src);
    console.log('Optimized:', name, '->', size + 'x' + size);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
