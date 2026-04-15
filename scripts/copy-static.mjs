#!/usr/bin/env node
// ビルド後に元のぽいんとらぼウェブサイトの静的ファイルを dist/ にコピーする

import { cpSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DIST = join(ROOT, 'dist')

mkdirSync(DIST, { recursive: true })

// 元のぽいんとらぼ index.html を static-root-index.html からコピー
const staticRootIndex = join(ROOT, 'static-root-index.html')
if (existsSync(staticRootIndex)) {
  cpSync(staticRootIndex, join(DIST, 'index.html'))
  console.log('✓ index.html (original) restored')
} else {
  console.warn('⚠ static-root-index.html が見つかりません')
}

// コピーする静的ディレクトリ一覧
const dirs = ['css', 'js', 'images', 'articles', 'admin', 'poinavi', 'api']
for (const dir of dirs) {
  const src = join(ROOT, dir)
  if (existsSync(src)) {
    cpSync(src, join(DIST, dir), { recursive: true })
    console.log(`✓ ${dir}/ コピー完了`)
  }
}

// コピーするルートファイル一覧
const files = [
  'index-en.html', 'apple-touch-icon.png', 'DEVELOPMENT.md',
  '_en-translations.json', '_note-articles.json', '_note-articles-content.json',
  'apply-updates.js', 'hakase_full_check.png',
]
for (const file of files) {
  const src = join(ROOT, file)
  if (existsSync(src)) {
    cpSync(src, join(DIST, file))
    console.log(`✓ ${file} コピー完了`)
  }
}

console.log('\n✓ 静的ファイルのコピー完了')
