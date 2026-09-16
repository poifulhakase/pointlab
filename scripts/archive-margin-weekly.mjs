#!/usr/bin/env node
// 全上場銘柄の信用残（週次）を、JPXが公開しているうちに貯める（2026-09-16 新設）。
//
// 使い方:
//   node scripts/archive-margin-weekly.mjs          # まだ貯めていない週だけ取り込む
//   node scripts/archive-margin-weekly.mjs --force  # 公開中の5週をすべて取り直す
//
// 出力（すべて public/data/margin_weekly/ の下）:
//   {YYYY-MM-DD}.json … その週末の全銘柄。rows[コード4桁] = [制度買残, 一般買残, 制度売残, 一般売残]
//   index.json        … 貯めた週の一覧（古い順）と件数
//   names.json        … コード → 銘柄名（最新の週で上書き）
//
// 🔴 なぜ貯めるのか＝JPXの公開ページには**直近5週しか並ばず、古いPDFは消える**。
//    過去の週を無料で取り直す方法は無い（株探の時系列は有料・2026-09-16 ユーザー判断で使わない）。
//    ロボ口座の画面（信用期日）はこの蓄積を読む。**止まった週はあとから埋められない**。
// 🔵 週のファイルは**一度書いたら変えない**（同じ週を書き直すのは --force のときだけ）。
//    銘柄ごとのファイルにしないのは、毎週4,000ファイルを書き換えて Git の履歴が膨らむのを避けるため。
// 🔵 毎回走らせてよい＝公開ページの一覧を見て、未取得の週が無ければ PDF は開かない（数秒で終わる）。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { listWeeklyPdfs, weekOf, extractFromPdf } from './jpxMarginPdf.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(ROOT, 'public/data/margin_weekly')
const FORCE = process.argv.includes('--force')

/** 1週ぶんに少なくともこれだけ銘柄が無ければ、読み取りに失敗したとみなして書かない。 */
const MIN_ROWS = 1000

fs.mkdirSync(DIR, { recursive: true })

const readJson = (f, fallback) => {
  try { return JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) } catch { return fallback }
}

const pdfs = await listWeeklyPdfs()
const todo = pdfs
  .map((p) => ({ p, w: weekOf(p) }))
  .filter((x) => x.w && (FORCE || !fs.existsSync(path.join(DIR, `${x.w}.json`))))
  .sort((a, b) => a.w.localeCompare(b.w))

console.log(`JPX 公開中 ${pdfs.length}週 / 取り込む ${todo.length}週`)

const names = readJson('names.json', {})
let failed = 0
for (const { p, w } of todo) {
  const t0 = Date.now()
  process.stdout.write(`  ${w} を読み取り中…`)
  try {
    const rows = await extractFromPdf(p, null)
    const out = {}
    let bad = 0
    for (const [sec, r] of Object.entries(rows)) {
      if (!r.consistent) { bad++; continue }          // 制度＋一般＝合計 が合わない行は入れない
      const code = sec.slice(0, 4)
      out[code] = [r.systemLong, r.negotiableLong, r.systemShort, r.negotiableShort]
      if (r.name) names[code] = r.name
    }
    const n = Object.keys(out).length
    if (n < MIN_ROWS) throw new Error(`銘柄が少なすぎる（${n}件）`)
    fs.writeFileSync(path.join(DIR, `${w}.json`), JSON.stringify({ w, rows: out }) + '\n')
    console.log(` ${n}銘柄（検算不一致 ${bad}件は除外）${((Date.now() - t0) / 1000).toFixed(1)}秒`)
  } catch (e) {
    failed++
    console.log(` 失敗: ${e.message}`)
  }
}

const weeks = fs.readdirSync(DIR)
  .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .map((f) => f.slice(0, 10))
  .sort()

fs.writeFileSync(path.join(DIR, 'names.json'), JSON.stringify(names) + '\n')
fs.writeFileSync(path.join(DIR, 'index.json'), JSON.stringify({
  updatedAt: new Date().toISOString(),
  source: 'JPX「銘柄別信用取引週末残高」（週次・全上場銘柄）',
  columns: ['制度買残', '一般買残', '制度売残', '一般売残'],
  weeks,
  // 🔵 鮮度チェック（check-freshness.mjs）が読む形。中身は weeks と同じ
  data: weeks.map((w) => ({ week: w })),
}, null, 1) + '\n')

console.log(`✅ 蓄積 ${weeks.length}週（${weeks[0] ?? '—'} 〜 ${weeks.at(-1) ?? '—'}）`)
process.exit(failed > 0 ? 1 : 0)
