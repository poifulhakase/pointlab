#!/usr/bin/env node
/**
 * favicon.svg から apple-touch-icon.png (180x180) と icon-192.png を生成
 * スマホホーム画面ショートカット用アイコン
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const svgPath = path.join(root, 'favicon.svg');

async function main() {
  const svg = fs.readFileSync(svgPath);
  
  // @resvg/resvg-js を使用（なければ sharp で代用を試す）
  let Resvg;
  try {
    const m = await import('@resvg/resvg-js');
    Resvg = m.Resvg;
  } catch (e) {
    console.error('@resvg/resvg-js をインストールしてください: npm i -D @resvg/resvg-js');
    process.exit(1);
  }

  const sizes = [
    { size: 180, name: 'apple-touch-icon.png' },
    { size: 192, name: 'icon-192.png' },
  ];

  for (const { size, name } of sizes) {
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: size },
    });
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();
    const outPath = path.join(root, name);
    fs.writeFileSync(outPath, pngBuffer);
    console.log('Generated:', name, '(' + size + 'x' + size + ')');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
