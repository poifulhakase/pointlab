// ローカルで試すときだけ使う秘密の読み込み口。
//
// 🔴 鍵をコマンドラインに書かせないための仕掛け。
//    コマンドに直接書くとシェル履歴と画面（＝作業ログ）に残る。
//    リポジトリ直下の `.env.local` に置けば、`.gitignore` の `.env*.local` で除外される。
//
// 使い方（ローカルのみ）:
//   stock-calendar/.env.local に1行:
//     ANTHROPIC_API_KEY=sk-ant-...
//
// 🔵 GitHub Actions では `.env.local` が無いので何もしない（Secrets が process.env に入る）。
//    既に環境変数がある場合は上書きしない（本番の値を壊さない）。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** `.env.local` があれば読み込む。戻り値は読み込んだキー名の配列（**値は返さない**） */
export function loadLocalEnv(file = '.env.local') {
  const p = path.join(ROOT, file)
  if (!fs.existsSync(p)) return []

  const loaded = []
  for (const raw of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    // 前後のクォートだけ外す（値の中身は触らない）
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[key]) continue   // 既にあるものは上書きしない
    process.env[key] = value
    loaded.push(key)
  }
  return loaded
}
