#!/usr/bin/env node
// firebase-messaging-sw.js をesbuildでバンドルしてプロジェクトルートに出力する
import { build } from 'esbuild'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

await build({
  entryPoints: [join(ROOT, 'src/firebase-messaging-sw.ts')],
  bundle: true,
  outfile: join(ROOT, 'firebase-messaging-sw.js'),
  format: 'iife',
  target: 'es2020',
  platform: 'browser',
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  minify: true,
})

console.log('✓ firebase-messaging-sw.js built')
