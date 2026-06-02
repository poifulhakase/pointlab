#!/usr/bin/env node
// v3に「メジャーSQ窓」を足したら全部乗せが改善するか（エッジ無し信号を足す影響の検証）
// 使い方: node scripts/backtest-system-v3sq.mjs

const P2 = Math.floor(Date.now() / 1000), P1 = P2 - 21 * 365 * 24 * 3600
async function fetchDaily() {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EN225?period1=${P1}&period2=${P2}&interval=1d`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }, signal: AbortSignal.timeout(30000) })
  const j = await res.json(); const r = j.chart.result[0]
  const ts = r.timestamp, cl = r.indicators.quote[0].close
  const rows = []
  for (let i = 0; i < ts.length; i++) if (cl[i] != null) rows.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: cl[i] })
  const dev = (i, w) => { if (i < w - 1) return null; let s = 0; for (let k = 0; k < w; k++) s += rows[i - k].close; return (rows[i].close - s / w) / (s / w) * 100 }
  for (let i = 0; i < rows.length; i++) rows[i].dev25 = dev(i, 25)
  return rows
}
const r2 = v => Math.round(v * 100) / 100
function secondFriday(y, m) { let c = 0; for (let d = 1; d <= 21; d++) { if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 5) { c++; if (c === 2) return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}` } } return null }

async function main() {
  console.log('[fetch] Yahoo ^N225 日次20年...')
  const rows = await fetchDaily()
  const n = rows.length, yrs = n / 245
  const COST = 0.0004
  const dret = i => (rows[i].close - rows[i - 1].close) / rows[i - 1].close
  const mmdd = i => rows[i].date.slice(5)
  const inSeason = i => (mmdd(i) >= '03-15' && mmdd(i) <= '03-27') || (mmdd(i) >= '12-15' && mmdd(i) <= '12-30')

  // メジャーSQ窓: 3/6/9/12月の第2金曜の前後3営業日をロング
  const sqWin = new Array(n).fill(false)
  const dates = rows.map(r => r.date)
  const idxOf = t => { let lo = 0, hi = n - 1, a = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (dates[m] <= t) { a = m; lo = m + 1 } else hi = m - 1 } return a }
  for (let y = 2005; y <= 2026; y++) for (const m of [3, 6, 9, 12]) {
    const sf = secondFriday(y, m); if (!sf) continue
    const c = idxOf(sf); if (c < 0) continue
    for (let k = -3; k <= 3; k++) if (c + k >= 0 && c + k < n) sqWin[c + k] = true
  }

  // トレンドフィルター(ドンチャン50/25 ロング)
  const trendLong = new Array(n).fill(false)
  { let s = 0; for (let i = 50; i < n; i++) { let hi = -Infinity, exLo = Infinity; for (let k = 1; k <= 50; k++) hi = Math.max(hi, rows[i - k].close); for (let k = 1; k <= 25; k++) exLo = Math.min(exLo, rows[i - k].close); const c = rows[i].close; if (s === 0 && c > hi) s = 1; else if (s === 1 && c < exLo) s = 0; trendLong[i] = s === 1 } }
  const dipPos = new Array(n).fill(false)
  { let until = -1; for (let i = 25; i < n; i++) { if (rows[i].dev25 != null && rows[i].dev25 <= -10) until = Math.max(until, i + 5); if (i <= until) dipPos[i] = true } }

  function evalPos(posOf, lev) {
    let eq = 1, peak = 1, maxDD = 0, prev = false, daysIn = 0
    for (let i = 50; i < n; i++) { if (posOf(i - 1)) { eq *= (1 + lev * dret(i)); daysIn++ } const now = posOf(i); if (now !== prev) { eq *= (1 - COST); prev = now } peak = Math.max(peak, eq); maxDD = Math.min(maxDD, eq / peak - 1) }
    return { cagr: r2((Math.pow(eq, 1 / yrs) - 1) * 100), maxDD: r2(maxDD * 100), expo: Math.round(daysIn / (n - 50) * 100) }
  }
  const fAll = i => trendLong[i] || dipPos[i] || inSeason(i)
  const fAllSQ = i => trendLong[i] || dipPos[i] || inSeason(i) || sqWin[i]

  console.log(`\n  全部乗せ（SQなし）2倍 `, evalPos(fAll, 2))
  console.log(`  全部乗せ＋メジャーSQ窓 2倍`, evalPos(fAllSQ, 2))
  console.log('\n※SQ窓=3/6/9/12月の第2金曜±3営業日をロング。CAGRが上がるか/DDが悪化するかで「足す価値」を判定。')
}
main().catch(e => { console.error(e); process.exit(1) })
