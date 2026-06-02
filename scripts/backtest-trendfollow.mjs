#!/usr/bin/env node
// 本格的トレンドフォロー(ブレイクアウト/長期MAクロス)を日経単体で検証（R&D）
// 問い: ちゃんとしたTF(ドンチャン・50/200クロス・長期保有・両方向)なら日経で勝てるか。
// Yahoo ^N225 日次20年。2倍・コスト片道0.04%。B&Hと比較。
// 使い方: node scripts/backtest-trendfollow.mjs

const P2 = Math.floor(Date.now() / 1000), P1 = P2 - 21 * 365 * 24 * 3600
async function fetchDaily() {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EN225?period1=${P1}&period2=${P2}&interval=1d`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }, signal: AbortSignal.timeout(30000) })
  const j = await res.json(); const r = j.chart.result[0]
  const ts = r.timestamp, cl = r.indicators.quote[0].close
  const rows = []
  for (let i = 0; i < ts.length; i++) if (cl[i] != null) rows.push({ close: cl[i] })
  const ma = (i, w) => { if (i < w - 1) return null; let s = 0; for (let k = 0; k < w; k++) s += rows[i - k].close; return s / w }
  for (let i = 0; i < rows.length; i++) { rows[i].ma50 = ma(i, 50); rows[i].ma200 = ma(i, 200) }
  return rows
}
const r2 = v => Math.round(v * 100) / 100

async function main() {
  console.log('[fetch] Yahoo ^N225 日次20年...')
  const rows = await fetchDaily()
  const n = rows.length, yrs = n / 245
  console.log(`  → ${n}営業日 ≈ ${r2(yrs)}年`)
  const LEV = 2, COST = 0.0004
  const dret = i => (rows[i].close - rows[i - 1].close) / rows[i - 1].close

  // 日次ポジション(+1 long / -1 short / 0 flat)からCAGR/DD/取引数
  function evalPos(posOf, start) {
    let eq = 1, peak = 1, maxDD = 0, trades = 0, daysIn = 0, prev = 0
    for (let i = start; i < n; i++) {
      const p = posOf(i - 1)              // 前日の状態で今日動く
      eq *= (1 + LEV * p * dret(i))
      if (p !== 0) daysIn++
      const pNow = posOf(i)
      if (pNow !== prev) { eq *= (1 - COST); if (pNow !== 0) trades++ ; prev = pNow }
      peak = Math.max(peak, eq); maxDD = Math.min(maxDD, eq / peak - 1)
    }
    return { cagr: r2((Math.pow(eq, 1 / yrs) - 1) * 100), maxDD: r2(maxDD * 100), total: r2((eq - 1) * 100), perYear: r2(trades / yrs), expo: Math.round(daysIn / (n - start) * 100) }
  }

  // ドンチャン: 過去Nの高値ブレイクで在庫。状態を前日から引き継ぐ実装。
  function donchian(N, exitN, allowShort) {
    const state = new Array(n).fill(0)
    let s = 0
    for (let i = N; i < n; i++) {
      let hi = -Infinity, lo = Infinity
      for (let k = 1; k <= N; k++) { hi = Math.max(hi, rows[i - k].close); lo = Math.min(lo, rows[i - k].close) }
      let exHi = -Infinity, exLo = Infinity
      for (let k = 1; k <= exitN; k++) { exHi = Math.max(exHi, rows[i - k].close); exLo = Math.min(exLo, rows[i - k].close) }
      const c = rows[i].close
      if (s <= 0 && c > hi) s = 1
      else if (s >= 0 && c < lo) s = allowShort ? -1 : 0
      else if (s === 1 && c < exLo) s = 0
      else if (s === -1 && c > exHi) s = 0
      state[i] = s
    }
    return i => state[i] ?? 0
  }

  // 50/200 クロス
  function cross(allowShort) {
    return i => {
      if (rows[i].ma50 == null || rows[i].ma200 == null) return 0
      if (rows[i].ma50 > rows[i].ma200) return 1
      return allowShort ? -1 : 0
    }
  }

  // ベンチ
  console.log('\n========== ベンチマーク（2倍）==========')
  console.log('  日経B&H(1倍) ', evalPos(() => 0.5, 1))   // 0.5*2=1倍相当
  console.log('  2倍常時ロング ', evalPos(() => 1, 1))

  console.log('\n========== ドンチャン・ブレイクアウト（2倍）==========')
  for (const [N, ex] of [[20, 10], [50, 25], [100, 50]]) {
    console.log(`  ${N}日Brk/${ex}日Exit ロングのみ`, evalPos(donchian(N, ex, false), N + 1))
    console.log(`  ${N}日Brk/${ex}日Exit ロング/ショート`, evalPos(donchian(N, ex, true), N + 1))
  }

  console.log('\n========== 50/200 MAクロス（2倍）==========')
  console.log('  ロングのみ ', evalPos(cross(false), 200))
  console.log('  ロング/ショート ', evalPos(cross(true), 200))

  console.log('\n※2倍日次・コスト片道0.04%。日経“単体”。TFの本領は多数の無相関市場への分散にある点に注意。')
}
main().catch(e => { console.error(e); process.exit(1) })
