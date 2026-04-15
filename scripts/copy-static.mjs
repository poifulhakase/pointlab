#!/usr/bin/env node
// ビルド後に元のぽいんとらぼウェブサイトの静的ファイルを dist/ にコピーする

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'fs'
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
  // ロゴ・favicon・マニフェスト（元サイトのヘッダーが参照）
  'logo.svg', 'favicon.svg', 'favicon-16x16.png', 'favicon-32x32.png', 'manifest.json',
]
for (const file of files) {
  const src = join(ROOT, file)
  if (existsSync(src)) {
    cpSync(src, join(DIST, file))
    console.log(`✓ ${file} コピー完了`)
  }
}

// 旧サービスワーカー（スコープ /）の kill switch
// 以前 stock-calendar が / に配置されていた際に登録された SW を無効化する
writeFileSync(join(DIST, 'sw.js'), [
  '// Kill switch: unregister old root-scope service worker',
  'self.addEventListener("install", () => self.skipWaiting());',
  'self.addEventListener("activate", event => {',
  '  event.waitUntil(',
  '    self.registration.unregister().then(() =>',
  '      self.clients.matchAll({ type: "window", includeUncontrolled: true })',
  '    ).then(clients => clients.forEach(c => c.navigate(c.url)))',
  '  );',
  '});',
].join('\n'))
console.log('✓ sw.js (kill switch) 生成完了')

console.log('\n✓ 静的ファイルのコピー完了')
