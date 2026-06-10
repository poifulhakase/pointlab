#!/usr/bin/env node
// エンジン シグナル診断（内部R&D）
// 使い方: node scripts/analyze-engine-signals.mjs
// 目的:   public/data/backtest_results.json の weekly_log を解剖し、
//         「どこで・なぜ負けているか」を地合い・方向・ステータス・トレンド整合で診断する。
//         ★本番ロジックは変更しない。トレンドフィルター等の仮説検証（過学習回避のため独立R&Dと突合）。
//
// 主要所見（2026-06-10・52週/27シグナル時点）:
//   - 期間の日経は +76% の歴史的大相場 → エンジンは逆張りの bear を量産し負けていた
//   - 順張り 56% vs 逆張り 36%。逆行シグナルが最大のドラッグ
//   - 第15-16の20年R&D（トレンドフィルターでDD制御・逆張りは確定下落でのみ）と整合

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA = join(__dirname, '..', 'public', 'data', 'backtest_results.json')

const TREND_LOOKBACK = 8 // 週。当該週close vs N週前closeで地合いを判定

const d = JSON.parse(readFileSync(DATA, 'utf-8'))
const asc = [...d.weekly_log].reverse() // 昇順（古→新）
const closes = asc.map(w => w.nk_close)

function trendAt(i) {
  const j = i - TREND_LOOKBACK
  if (j < 0 || closes[i] == null || closes[j] == null) return null
  return closes[i] > closes[j] ? 'up' : closes[i] < closes[j] ? 'down' : 'flat'
}

const rows = asc.map((w, i) => ({ ...w, trend: trendAt(i) }))
const valid = rows.filter(w => w.signal !== 'neutral' && w.win !== null)

const wr  = a => (a.length ? Math.round(a.filter(x => x.win).length / a.length * 100) : null)
const cnt = a => `${a.filter(x => x.win).length}/${a.length}`
const line = (label, a) => console.log(`  ${label.padEnd(26)} ${cnt(a).padStart(6)}  ${wr(a) ?? '-'}%`)

const first = closes[0], last = closes[closes.length - 1]
console.log('=== エンジン シグナル診断 ===')
console.log(`期間: ${d.data_range.from} 〜 ${d.data_range.to}（${d.weekly_log.length}週）`)
console.log(`地合い: 日経 ${first} → ${last}（${(((last - first) / first) * 100).toFixed(1)}%）`)
console.log(`シグナル週: ${valid.length}（全体勝率 ${wr(valid)}%）`)

console.log('\n--- 方向別 ---')
line('bull', valid.filter(w => w.signal === 'bull'))
line('bear', valid.filter(w => w.signal === 'bear'))

console.log('\n--- ステータス × 方向 ---')
const stKeys = [...new Set(valid.map(w => `${w.status} / ${w.signal}`))]
for (const k of stKeys) line(k, valid.filter(w => `${w.status} / ${w.signal}` === k))

console.log(`\n--- トレンド整合（${TREND_LOOKBACK}週前比）---`)
const withT = valid.filter(w => w.trend && ((w.signal === 'bull' && w.trend === 'up') || (w.signal === 'bear' && w.trend === 'down')))
const cntT  = valid.filter(w => w.trend && ((w.signal === 'bull' && w.trend === 'down') || (w.signal === 'bear' && w.trend === 'up')))
line('順張り（トレンド一致）', withT)
line('逆張り（トレンド逆行）', cntT)

console.log('\n--- 反実仮想（トレンドフィルター）---')
line('採用=順張りのみ', withT)
line('参考: bull のみ採用', valid.filter(w => w.signal === 'bull'))
line('参考: フィルター無し（現状）', valid)

console.log('\n※ n が小さく確定はできないが、逆張りの弱さは20年R&D（トレンドフィルター必須）と整合。')
console.log('※ 当面の正直な含意: 上昇トレンド下では bear を抑制（少なくとも低確信度化）すべき。')
