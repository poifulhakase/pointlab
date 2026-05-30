#!/usr/bin/env node
/**
 * インストール後に表示されるアプリアイコンのロゴを 1.1倍に拡大する。
 * 各 PNG を 110% にリサイズ → 中央を元サイズにクロップ（=見た目1.1倍ズーム）。
 * キャンバス寸法（192/512/180）は manifest 整合のため維持する。
 * 対象: icon-192 / icon-512 / icon-512-maskable / apple-touch-icon。
 * 一度だけ実行すること（再実行するとさらに拡大される）。git 管理下なので revert 可能。
 */
const path = require('path')
const sharp = require('sharp')

const root = path.join(__dirname, '..', 'public')
const FACTOR = 1.1
const targets = ['icon-192.png', 'icon-512.png', 'icon-512-maskable.png', 'apple-touch-icon.png']

async function zoom(file) {
  const full = path.join(root, file)
  const orig = await sharp(full).toBuffer()
  const meta = await sharp(orig).metadata()
  const w = meta.width, h = meta.height
  const bw = Math.round(w * FACTOR), bh = Math.round(h * FACTOR)
  const big = await sharp(orig).resize(bw, bh, { fit: 'fill' }).toBuffer()
  const left = Math.round((bw - w) / 2), top = Math.round((bh - h) / 2)
  await sharp(big).extract({ left, top, width: w, height: h }).png().toFile(full)
  console.log(`zoomed x${FACTOR}: ${file} (${w}x${h})`)
}

Promise.all(targets.map(zoom))
  .then(() => console.log('done'))
  .catch(e => { console.error(e); process.exit(1) })
