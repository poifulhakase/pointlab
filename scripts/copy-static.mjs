#!/usr/bin/env node
// ビルド後に元のぽいんとらぼウェブサイトの静的ファイルを dist/ にコピーする

import { cpSync, existsSync, mkdirSync } from 'fs'
import { execSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DIST = join(ROOT, 'dist')

mkdirSync(DIST, { recursive: true })

// git 履歴から元の index.html を取得（最初のマージコミット前の状態）
try {
  const html = execSync('git show c84bf4e:index.html', { cwd: ROOT }).toString()
  import('fs').then(fs => fs.writeFileSync(join(DIST, 'index.html'), html))
  console.log('✓ index.html (original) restored')
} catch (e) {
  console.warn('⚠ index.html の復元に失敗:', e.message)
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
