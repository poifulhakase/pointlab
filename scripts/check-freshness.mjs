#!/usr/bin/env node
// データ鮮度チェック — 「静かに古くなる」を検知する。
//
// 🔴 なぜ要るか（2026-07-31 に作った理由）
//   `fetch-jpx.mjs` は取得失敗を catch して警告だけ出し、既存ファイルを残して次へ進む。
//   そのため **CI は success のまま、データだけが古くなる**。実際 `topix.json` は
//   2026-07-13 を最後に CI で一度も更新されず、2週間気づかれなかった。
//   それまでの鮮度チェックは futures_daily と investor の**2ファイルしか見ていなかった**
//   ため、topix が止まっても誰にも通知されなかった。
//
// 🔴 並び順に依存しない
//   ファイルによって新しい順（margin/investor 等）と古い順（topix/vix_daily/usdjpy 等）が
//   混在している（過去に「VIXが3月の値を最新として表示」という取り違えの原因になった）。
//   ここでは全行を走査して**最大の日付**を採るので、並び順が変わっても壊れない。
//
// 使い方:
//   node scripts/check-freshness.mjs          … 古いものがあれば exit 1
//   node scripts/check-freshness.mjs --warn   … 表示するだけ（常に exit 0）

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data')

/**
 * 許容遅れ（暦日）。祝日・連休・公表の遅れを見込んで営業日より余裕を持たせる。
 * 🔴 ここに載っていないファイルは「チェック対象外」＝新しいデータを足したらここにも足すこと。
 */
const EXPECT = [
  // ── 日次で更新されるもの ──
  { file: 'futures_daily.json',   maxAgeDays: 5,  label: '先物 建玉/取引高/PCR' },
  { file: 'nk_futures_price.json', maxAgeDays: 5, label: '日経先物 価格' },
  { file: 'usdjpy.json',          maxAgeDays: 5,  label: 'ドル円' },
  { file: 'vix_daily.json',       maxAgeDays: 5,  label: 'VIX（日次）' },
  { file: 'nas100_daily.json',    maxAgeDays: 5,  label: 'NASDAQ100（日次）' },
  { file: 'topix.json',           maxAgeDays: 5,  label: 'TOPIX（NT倍率の分母）' },
  // 🔴 ファイル名は daily だが、中身の行間隔は**週次**（7/24, 7/17, 7/10 …）。日次扱いすると誤検知する。
  { file: 'arbitrage_daily.json', maxAgeDays: 12, label: '裁定残（日次ファイル・実際は週次）' },

  // ── 週次で公表されるもの（JPX/日経は翌週にずれ込むため広めに） ──
  { file: 'margin.json',          maxAgeDays: 12, label: '信用残・評価損益率' },
  { file: 'investor.json',        maxAgeDays: 12, label: '投資主体別売買' },
  { file: 'advance_decline.json', maxAgeDays: 10, label: '騰落レシオ' },
  { file: 'short_sell.json',      maxAgeDays: 10, label: '空売り比率' },
  { file: 'arbitrage.json',       maxAgeDays: 12, label: '裁定残（週次）' },
  // 🔴 これだけ出どころが JPX の**月次統計**（SIF_D_YYYYMM.xlsx・翌月上旬公表）。
  //    行そのものは週次だが、7月分が載るのは8月上旬なので、月末は1ヶ月遅れが正常。
  //    12日などにすると毎月「古い」と鳴り続ける（＝オオカミ少年になる）。
  { file: 'futures_oi.json',      maxAgeDays: 45, label: '先物 建玉（月次公表・1ヶ月遅れが正常）' },
  { file: 'vix.json',             maxAgeDays: 12, label: 'VIX（週次）' },
  { file: 'cot_nikkei.json',      maxAgeDays: 14, label: 'COT（CFTC・金曜公表）' },

  // futures_participants.json は手動更新（add-participants.mjs）なので対象外。
]

/** 日付らしき値を Date に変換（"2026/07/30" と "2026-07-30" の両方が来る）。 */
function toDate(v) {
  if (typeof v !== 'string') return null
  const m = v.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (!m) return null
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
}

/**
 * ファイル内の最大日付を返す（並び順に依存しない）。
 * @returns {{latest: string|null, rows: number}}
 */
export function latestDateIn(json) {
  const rows = Array.isArray(json) ? json : (json?.data ?? [])
  if (!Array.isArray(rows) || rows.length === 0) return { latest: null, rows: 0 }

  let best = null
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue
    for (const [k, v] of Object.entries(r)) {
      if (!/date|time|week/i.test(k)) continue
      const d = toDate(v)
      if (d && (!best || d > best.d)) best = { d, s: String(v).slice(0, 10) }
    }
  }
  return { latest: best?.s ?? null, rows: rows.length }
}

/** 日数差（暦日）。 */
export function ageInDays(latest, now = new Date()) {
  const d = toDate(latest)
  if (!d) return Infinity
  return Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - d.getTime()) / 86400000)
}

const warnOnly = process.argv.includes('--warn')
const stale = []
const ok = []

for (const spec of EXPECT) {
  const path = join(DATA_DIR, spec.file)
  if (!existsSync(path)) {
    stale.push({ ...spec, reason: 'ファイルが無い', latest: '-', age: '-' })
    continue
  }
  let json
  try {
    json = JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    stale.push({ ...spec, reason: '読めない: ' + e.message, latest: '-', age: '-' })
    continue
  }

  const { latest, rows } = latestDateIn(json)
  if (!latest) {
    stale.push({ ...spec, reason: '日付が取れない（0件かもしれない）', latest: '-', age: '-', rows })
    continue
  }
  const age = ageInDays(latest)
  if (age > spec.maxAgeDays) {
    stale.push({ ...spec, reason: `${age}日前で止まっている（許容${spec.maxAgeDays}日）`, latest, age, rows })
  } else {
    ok.push({ ...spec, latest, age, rows })
  }
}

console.log('=== データ鮮度チェック ===')
for (const o of ok) {
  console.log(`  ✓ ${o.label.padEnd(24)} 最新 ${o.latest}（${o.age}日前・${o.rows}件）`)
}
for (const s of stale) {
  console.log(`  ⚠ ${s.label.padEnd(24)} ${s.reason}${s.latest !== '-' ? `／最新 ${s.latest}` : ''}`)
}

if (stale.length === 0) {
  console.log(`\n全 ${ok.length} ファイルが最新です。`)
  process.exit(0)
}

console.log(`\n🔴 ${stale.length} ファイルが古い、または取得できていません。`)
console.log('   取得元がブロックされていないか、パーサが壊れていないかを確認してください。')
process.exit(warnOnly ? 0 : 1)
