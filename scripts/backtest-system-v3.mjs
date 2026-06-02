#!/usr/bin/env node
// システムv3「全部乗せ」: トレンドフィルター(ロングのみ) + −極限買い + 季節性。ロングのみ・2倍。
// 問い: 検証済みエッジを全部足したら年利50%(CAGR)に届くか。+参考に3倍も。
// 使い方: node scripts/backtest-system-v3.mjs

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

async function main() {
  console.log('[fetch] Yahoo ^N225 日次20年...')
  const rows = await fetchDaily()
  const n = rows.length, yrs = n / 245
  console.log(`  → ${n}営業日 ≈ ${r2(yrs)}年`)
  const COST = 0.0004
  const dret = i => (rows[i].close - rows[i - 1].close) / rows[i - 1].close
  const mmdd = i => rows[i].date.slice(5)
  const inSeason = i => (mmdd(i) >= '03-15' && mmdd(i) <= '03-27') || (mmdd(i) >= '12-15' && mmdd(i) <= '12-30')

  // ドンチャン50/25 ロング状態（トレンドフィルター）
  const trendLong = new Array(n).fill(false)
  { let s = 0
    for (let i = 50; i < n; i++) {
      let hi = -Infinity, lo = Infinity, exLo = Infinity
      for (let k = 1; k <= 50; k++) { hi = Math.max(hi, rows[i - k].close); lo = Math.min(lo, rows[i - k].close) }
      for (let k = 1; k <= 25; k++) exLo = Math.min(exLo, rows[i - k].close)
      const c = rows[i].close
      if (s === 0 && c > hi) s = 1
      else if (s === 1 && c < exLo) s = 0
      trendLong[i] = s === 1
    }
  }

  // −極限買い（dev25<=-10, 5日保有）の在庫フラグ
  const dipPos = new Array(n).fill(false)
  { let until = -1
    for (let i = 25; i < n; i++) { if (rows[i].dev25 != null && rows[i].dev25 <= -10) until = Math.max(until, i + 5); if (i <= until) dipPos[i] = true }
  }

  function evalPos(posOf, lev, start) {
    let eq = 1, peak = 1, maxDD = 0, prev = false, daysIn = 0, trades = 0
    for (let i = start; i < n; i++) {
      if (posOf(i - 1)) { eq *= (1 + lev * dret(i)); daysIn++ }
      const now = posOf(i)
      if (now !== prev) { eq *= (1 - COST); if (now) trades++; prev = now }
      peak = Math.max(peak, eq); maxDD = Math.min(maxDD, eq / peak - 1)
    }
    return { cagr: r2((Math.pow(eq, 1 / yrs) - 1) * 100), maxDD: r2(maxDD * 100), expo: Math.round(daysIn / (n - start) * 100), perYear: r2(trades / yrs) }
  }

  // 各エッジ単体 & 全部乗せ（OR）
  const fTrend = i => trendLong[i]
  const fDip = i => dipPos[i]
  const fSeason = i => inSeason(i)
  const fAll = i => trendLong[i] || dipPos[i] || inSeason(i)
  // ディップとシーズンだけ（トレンド無し＝DDフィルター無し）
  const fDipSeason = i => dipPos[i] || inSeason(i)

  console.log('\n========== 各エッジ単体（2倍）==========')
  console.log('  トレンドフィルター(ロングのみ) ', evalPos(fTrend, 2, 50))
  console.log('  −極限買い(−10/5日)          ', evalPos(fDip, 2, 50))
  console.log('  季節性(権利確定+年末)         ', evalPos(fSeason, 2, 50))

  console.log('\n========== 全部乗せ（OR・ロングのみ）==========')
  console.log('  トレンド+ディップ+季節性 2倍 ', evalPos(fAll, 2, 50))
  console.log('  ディップ+季節性のみ 2倍(TF無) ', evalPos(fDipSeason, 2, 50))

  console.log('\n========== 参考: 全部乗せのレバ違い ==========')
  console.log('  全部乗せ 1倍 ', evalPos(fAll, 1, 50))
  console.log('  全部乗せ 2倍 ', evalPos(fAll, 2, 50))
  console.log('  全部乗せ 3倍 ', evalPos(fAll, 3, 50))

  console.log('\n※ロングのみ・コスト片道0.04%。CAGRが目標50%にどれだけ届くか・DDが生存可能かを見る。')
}
main().catch(e => { console.error(e); process.exit(1) })
