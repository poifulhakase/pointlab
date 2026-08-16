#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────
// ぽいロボ 疑似トレード: 判断の答え合わせ（⑤b-A ＋ ⑤b-B）
//
// A. 結果の紐付け … `public/data/robo_logs/*.json` に「その後どうなったか」を追記する
// B. 確信度の答え合わせ … 帯ごとに「言った確率 vs 実勝率」を `robo_calibration.json` に出す
//
// 🔴 **判断のしかたには触らない**。すでに出た判断を後から採点するだけ
//    （30トレードで測っている最中なので、判断器を変えると分母が壊れる）。
// 🔴 ログの `input` / `output` / `shadows` は**書き換えない**。`outcome` を足すだけ。
// 🔵 影の判断（チャートのみ／数値のみ）も同じ物差しで採点する
//    ＝30件貯まったときの3通り比較の材料になる（旧 compare-shadows.mjs 構想はこれに統合）。
//
// 使い方:
//   node scripts/robo-outcome.mjs          … ログへ追記＋ robo_calibration.json を書く
//   node scripts/robo-outcome.mjs --dry    … 画面に出すだけ（書き込みなし）
// ──────────────────────────────────────────────────────────────────────────

import fs from 'node:fs'
import path from 'node:path'

import { fetchDaily, DATA_DIR } from './roboData.mjs'
import { computeOutcome, calibrationBins, summarize, HORIZONS } from '../src/utils/roboOutcome.mjs'

const LOG_DIR = path.join(DATA_DIR, 'robo_logs')
const OUT_PATH = path.join(DATA_DIR, 'robo_calibration.json')

const DRY = process.argv.slice(2).includes('--dry')
const log = (s = '') => console.log(s)

/** 影の3通り。key はログ内の場所、label は画面に出す名前 */
const VARIANTS = [
  { key: 'main', label: '本番（需給＋価格＋チャート）', pick: (j) => j.output },
  { key: 'chart_only', label: '影：チャートのみ', pick: (j) => j.shadows?.chart_only?.decision ?? null },
  { key: 'numbers_only', label: '影：数値のみ', pick: (j) => j.shadows?.numbers_only?.decision ?? null },
]

function readLogs() {
  if (!fs.existsSync(LOG_DIR)) return []
  return fs.readdirSync(LOG_DIR)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .map(f => {
      const p = path.join(LOG_DIR, f)
      try {
        return { file: f, path: p, json: JSON.parse(fs.readFileSync(p, 'utf8')) }
      } catch (e) {
        log(`⚠ ${f} が読めなかった（${e.message}）→ 飛ばす`)
        return null
      }
    })
    .filter(Boolean)
}

function saveJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8')
}

const pct = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}%`)

async function main() {
  log('=== ぽいロボ 判断の答え合わせ ===')
  if (DRY) log('（--dry: 書き込みなし）')

  const logs = readLogs()
  if (!logs.length) {
    log('判断ログがまだ1件も無い（public/data/robo_logs/）→ 何もしない')
    return
  }
  log(`[1] 判断ログ ${logs.length}件（${logs[0].json.date} 〜 ${logs[logs.length - 1].json.date}）`)

  // 🔴 測る物差しは日経225の終値。ETF個別ではなく指数で測る
  //    （1321/1570/1571/1357 は倍率が違うだけで方向は同じ）。
  const bars = await fetchDaily('^N225')
  log(`[2] 日経225の日足 ${bars.length}本（〜${bars[bars.length - 1]?.date}）`)

  const collected = Object.fromEntries(VARIANTS.map(v => [v.key, []]))
  let written = 0
  let pending = 0

  for (const { file, path: p, json } of logs) {
    const outcome = {}
    for (const v of VARIANTS) {
      const decision = v.pick(json)
      if (!decision) continue
      const o = computeOutcome({ decision, date: json.date, bars })
      if (!o) continue
      outcome[v.key] = o
      collected[v.key].push(o)
      if (!o.complete) pending++
    }
    if (!Object.keys(outcome).length) continue

    // 🔵 何度走らせても同じ結果になる（未確定ぶんが埋まったときだけ中身が変わる）
    const next = { ...json, outcome }
    const changed = JSON.stringify(json.outcome ?? null) !== JSON.stringify(outcome)
    if (changed && !DRY) { saveJson(p, next); written++ }
    if (changed && DRY) written++

    const m = outcome.main
    if (m) {
      const h1 = m.horizons['1d']; const h5 = m.horizons['5d']
      log(`  ${json.date} ${m.side ?? 'hold'}${m.symbol && m.symbol !== 'none' ? ` ${m.symbol}` : ''}`
        + ` 確信度${m.confidence_pct ?? '—'}%`
        + ` → 1日 ${pct(h1?.ret_pct)}${h1?.hit == null ? '' : h1.hit ? ' ○' : ' ×'}`
        + ` / 5日 ${pct(h5?.ret_pct)}${h5?.hit == null ? '' : h5.hit ? ' ○' : ' ×'}`
        + `${m.complete ? '' : '（未確定）'}`)
    }
  }
  log(`[3] ログ更新 ${written}件${DRY ? '（--dry のため書いていない）' : ''}／先の足待ち ${pending}件`)

  // ── 集計（⑤b-B） ──
  const variants = {}
  for (const v of VARIANTS) {
    const rows = collected[v.key]
    if (!rows.length) continue
    variants[v.key] = {
      label: v.label,
      summary: summarize(rows),
      calibration: Object.fromEntries(HORIZONS.map(h => [`${h}d`, calibrationBins(rows, { horizon: h })])),
    }
  }

  const result = {
    updatedAt: new Date().toISOString(),
    basis: '判断した日の終値（引成の約定基準）を起点に、日経225の終値で1営業日後・5営業日後を測る',
    caveat: '🔴 これは判断が短期で当たったかの答え合わせであって、建玉の損益ではない（実際は損切り・トレーリングで手仕舞うまで持つ）。30トレード貯まるまで比較しない。',
    horizons: HORIZONS.map(h => `${h}d`),
    variants,
    // 画面や手作業で拾いやすいよう、本番ぶんは1行1判断でも残す
    rows: collected.main.map(o => ({
      date: o.entry_date,
      side: o.side,
      symbol: o.symbol,
      confidence_pct: o.confidence_pct,
      ...Object.fromEntries(HORIZONS.flatMap(h => [
        [`ret_${h}d`, o.horizons[`${h}d`].ret_pct],
        [`hit_${h}d`, o.horizons[`${h}d`].hit],
      ])),
      complete: o.complete,
    })),
  }

  if (!DRY) saveJson(OUT_PATH, result)
  log(`[4] ${DRY ? '（--dry のため書いていない）' : `保存: ${path.relative(process.cwd(), OUT_PATH)}`}`)

  // ── 画面に出す ──
  for (const v of VARIANTS) {
    const x = variants[v.key]
    if (!x) continue
    const s5 = x.summary.by_horizon['5d']
    log('')
    log(`【${x.label}】判断${x.summary.logs}件（方向あり ${x.summary.directional} / hold ${x.summary.hold}）`)
    for (const h of HORIZONS) {
      const s = x.summary.by_horizon[`${h}d`]
      const p = (v) => (v == null ? '—' : `${v}%`)
      log(`  ${h}日後: n=${s.n} 勝率 ${p(s.win_rate_pct)} / 平均確信度 ${p(s.avg_confidence)} / 平均損益 ${pct(s.avg_edge_pct)}`)
    }
    if (s5.n) {
      log('  確信度の答え合わせ（5日後）:')
      for (const b of x.calibration['5d']) {
        log(`    ${b.range.padEnd(8)} n=${String(b.n).padStart(2)}  言った ${b.avg_confidence}%  実際 ${b.win_rate_pct}%  差 ${b.gap > 0 ? '+' : ''}${b.gap}`)
      }
    }
  }

  const n = variants.main?.summary.by_horizon['5d']?.n ?? 0
  log('')
  log(n < 30
    ? `🔵 採点できた判断は ${n}件。**30件貯まるまで比較しない**（途中で乗り換えない）。`
    : '🔴 30件に達した。3通りの比較と Go/No-Go の判断ができる。')
  log('=== 完了 ===')
}

main().catch(e => { console.error(e); process.exit(1) })
