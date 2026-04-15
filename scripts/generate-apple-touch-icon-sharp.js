#!/usr/bin/env node
/**
 * favicon.svg から apple-touch-icon.png (180x180) と icon-192.png を生成
 * sharp 使用版（resvg が動かない環境用）
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const svgPath = path.join(root, 'favicon.svg');

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.error('sharp をインストールしてください: npm i -D sharp');
    process.exit(1);
  }

  const svg = fs.readFileSync(svgPath);
  const sizes = [
    { size: 16, name: 'favicon-16x16.png' },
    { size: 32, name: 'favicon-32x32.png' },
    { size: 180, name: 'apple-touch-icon.png' },
    { size: 192, name: 'icon-192.png' },
  ];

  for (const { size, name } of sizes) {
    await sharp(svg)
      .resize(size, size)
      .png()
      .toFile(path.join(root, name));
    console.log('Generated:', name, '(' + size + 'x' + size + ')');
  }
  // favicon.ico（ブラウザが /favicon.ico を要求するため）
  const fav32 = path.join(root, 'favicon-32x32.png');
  const favIco = path.join(root, 'favicon.ico');
  if (fs.existsSync(fav32)) {
    fs.copyFileSync(fav32, favIco);
    console.log('Generated: favicon.ico (copy of favicon-32x32.png)');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
