#!/usr/bin/env node
// 日銀政策決定会合の「その後」の実測（R&D・コミット対象外想定）
//
// 問い: 会合を **下落局面で迎えたとき**、その後の日経はどう動いたか。
//   ・会合当日（結果は昼に出る）／翌日／5日後／20日後のリターン
//   ・事前の25日線乖離（プラス＝上昇局面／マイナス＝下落局面）で層別
//
// 会合日は src/utils/macroCalendar.ts の BOJ_DATES をそのまま読む（二重管理しない）。
// 使い方: node scripts/analyze-boj-days.mjs

import { readFileSync } from 'node:fs'

const P2 = Math.floor(Date.now() / 1000)
const P1 = P2 - 21 * 365 * 24 * 3600

async function fetchDaily(symbol = '%5EN225') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${P1}&period2=${P2}&interval=1d`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }, signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const j = await res.json()
  const r = j?.chart?.result?.[0]
  const ts = r.timestamp ?? [], cl = r.indicators?.quote?.[0]?.close ?? []
  const rows = []
  for (let i = 0; i < ts.length; i++) if (cl[i] != null) rows.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: cl[i] })
  return rows
}

/** macroCalendar.ts の BOJ_DATES を読む（月は0始まり）。 */
function bojDates() {
  const src = readFileSync(new URL('../src/utils/macroCalendar.ts', import.meta.url), 'utf8')
  const block = src.match(/const BOJ_DATES[\s\S]*?\n\]/)?.[0] ?? ''
  return [...block.matchAll(/\[(\d{4}),\s*(\d{1,2}),\s*(\d{1,2})\]/g)]
    .map(m => `${m[1]}-${String(+m[2] + 1).padStart(2, '0')}-${String(+m[3]).padStart(2, '0')}`)
}

const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.floor(s.length / 2)] * 10) / 10 }
const winRate = a => a.length ? Math.round(a.filter(v => v > 0).length / a.length * 100) : null

const rows = await fetchDaily()
const idx = new Map(rows.map((r, i) => [r.date, i]))

// 25日線乖離
for (let i = 24; i < rows.length; i++) {
  let s = 0
  for (let k = i - 24; k <= i; k++) s += rows[k].close
  rows[i].dev = (rows[i].close / (s / 25) - 1) * 100
}

const hits = []
for (const d of bojDates()) {
  let i = idx.get(d)
  if (i == null) { // 休場ならその翌営業日
    i = rows.findIndex(r => r.date > d)
    if (i < 0) continue
  }
  const prev = rows[i - 1]
  if (!prev?.dev || i + 20 >= rows.length) continue
  const at = c => (rows[i + c].close / rows[i].close - 1) * 100
  hits.push({
    date: rows[i].date,
    devBefore: Math.round(prev.dev * 10) / 10,
    d0: (rows[i].close / prev.close - 1) * 100,
    d1: at(1), d5: at(5), d20: at(20),
  })
}

const show = (name, arr) => {
  if (!arr.length) { console.log(`  ${name}: 該当なし`); return }
  console.log(`  ${name.padEnd(26)} n=${String(arr.length).padStart(2)}  当日 ${median(arr.map(h => h.d0))}% / 翌日 ${median(arr.map(h => h.d1))}% / 5日 ${median(arr.map(h => h.d5))}% / 20日 ${median(arr.map(h => h.d20))}%  （20日後の勝率 ${winRate(arr.map(h => h.d20))}%）`)
}

console.log(`\n===== 日銀政策決定会合 後の日経平均（${hits[0].date}〜${hits[hits.length - 1].date}・${hits.length}回） =====`)
console.log('  ※ 数字は中央値。会合結果は昼に出るため「当日」は結果を含む\n')
show('全体', hits)
show('上昇局面で迎えた (乖離≥0)', hits.filter(h => h.devBefore >= 0))
show('下落局面で迎えた (乖離<0)', hits.filter(h => h.devBefore < 0))
show('深い下落で迎えた (乖離≤-5%)', hits.filter(h => h.devBefore <= -5))

console.log('\n  --- 「深い下落で迎えた会合」の個別 ---')
for (const h of hits.filter(h => h.devBefore <= -5)) {
  const f = v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
  console.log(`  ${h.date}  事前乖離 ${h.devBefore}%  当日 ${f(h.d0)} / 翌日 ${f(h.d1)} / 5日 ${f(h.d5)} / 20日 ${f(h.d20)}`)
}
