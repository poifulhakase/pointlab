#!/usr/bin/env node
// システムv2: ①頻度を増やす(MA5/10/25の押し目を統合) ②損切の効果を測る(平均回帰での罠検証)
// トレード単位シミュ。ロングのみ・2倍(日次)・コスト片道0.04%。
// 使い方: node scripts/backtest-system-v2.mjs

const P2 = Math.floor(Date.now() / 1000), P1 = P2 - 21 * 365 * 24 * 3600
async function fetchDaily() {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EN225?period1=${P1}&period2=${P2}&interval=1d`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }, signal: AbortSignal.timeout(30000) })
  const j = await res.json(); const r = j.chart.result[0]
  const ts = r.timestamp, cl = r.indicators.quote[0].close
  const rows = []
  for (let i = 0; i < ts.length; i++) if (cl[i] != null) rows.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: cl[i] })
  const dev = (i, win) => { if (i < win - 1) return null; let s = 0; for (let k = 0; k < win; k++) s += rows[i - k].close; return (rows[i].close - s / win) / (s / win) * 100 }
  for (let i = 0; i < rows.length; i++) { rows[i].dev5 = dev(i, 5); rows[i].dev10 = dev(i, 10); rows[i].dev25 = dev(i, 25) }
  return rows
}
const r2 = v => Math.round(v * 100) / 100

async function main() {
  console.log('[fetch] Yahoo ^N225 日次20年...')
  const rows = await fetchDaily()
  const n = rows.length, yrs = n / 245
  console.log(`  → ${n}営業日 ≈ ${r2(yrs)}年`)
  const LEV = 2, COST = 0.0004  // 片道0.04%
  const dret = i => (rows[i].close - rows[i - 1].close) / rows[i - 1].close
  const mmdd = i => rows[i].date.slice(5)
  const inSeason = i => (mmdd(i) >= '03-15' && mmdd(i) <= '03-27') || (mmdd(i) >= '12-15' && mmdd(i) <= '12-30')

  // signalSet: どの押し目を使うか / holdN / stopPct(0=損切なし)
  function run({ useMTF, holdN, stopPct }) {
    // エントリー判定（その日の終値で・flat時のみ）
    const dipSignal = i => {
      if (rows[i].dev25 != null && rows[i].dev25 <= -10) return true
      if (useMTF && rows[i].dev10 != null && rows[i].dev10 <= -3.74) return true
      if (useMTF && rows[i].dev5 != null && rows[i].dev5 <= -2.45) return true
      return false
    }
    let eq = 1, peak = 1, maxDD = 0
    let inPos = false, entryPx = 0, exitDay = -1, stopExits = 0, trades = 0, daysIn = 0
    for (let i = 25; i < n; i++) {
      // 1) 保有していれば今日の2x変動を反映
      if (inPos) { eq *= (1 + LEV * dret(i)); daysIn++ }
      peak = Math.max(peak, eq); maxDD = Math.min(maxDD, eq / peak - 1)
      // 2) 終値で出口判定
      if (inPos) {
        const lossFromEntry = rows[i].close / entryPx - 1
        const seasonExit = exitDay === -2 && !inSeason(i)        // 季節性は窓を出たら終了
        const timeExit = exitDay >= 0 && i >= exitDay
        const stopExit = stopPct > 0 && lossFromEntry <= -stopPct
        if (stopExit) { stopExits++ }
        if (seasonExit || timeExit || stopExit) { inPos = false; eq *= (1 - COST) }
      }
      // 3) flatなら新規エントリー判定（季節性優先で窓内は入る）
      if (!inPos) {
        if (inSeason(i)) { inPos = true; entryPx = rows[i].close; exitDay = -2; eq *= (1 - COST); trades++ }
        else if (dipSignal(i)) { inPos = true; entryPx = rows[i].close; exitDay = i + holdN; eq *= (1 - COST); trades++ }
      }
    }
    const cagr = Math.pow(eq, 1 / yrs) - 1
    return { cagr: r2(cagr * 100), maxDD: r2(maxDD * 100), total: r2((eq - 1) * 100), trades, perYear: r2(trades / yrs), expo: Math.round(daysIn / (n - 25) * 100), stopExits }
  }

  const show = (lbl, p) => { const s = run(p); console.log(`  ${lbl.padEnd(40)} CAGR ${String(s.cagr).padStart(6)}%  最大DD ${String(s.maxDD).padStart(7)}%  滞在 ${String(s.expo).padStart(3)}%  建玉 ${String(s.perYear).padStart(5)}/年  損切発動 ${s.stopExits}`) }

  console.log('\n========== ① 頻度を足す（MA25のみ → MA5/10/25統合）損切なし ==========')
  show('MA25のみ・5日保有', { useMTF: false, holdN: 5, stopPct: 0 })
  show('MA5/10/25統合・5日保有', { useMTF: true, holdN: 5, stopPct: 0 })
  show('MA5/10/25統合・3日保有', { useMTF: true, holdN: 3, stopPct: 0 })
  show('MA5/10/25統合・10日保有', { useMTF: true, holdN: 10, stopPct: 0 })

  console.log('\n========== ② 損切を入れる（MA5/10/25統合・5日保有・損切水準を変える）==========')
  console.log('  ※損切=エントリーから原資産が指定%下落で手仕舞い。平均回帰だと底で投げる罠を検証')
  show('損切なし', { useMTF: true, holdN: 5, stopPct: 0 })
  show('損切 -5%', { useMTF: true, holdN: 5, stopPct: 0.05 })
  show('損切 -8%', { useMTF: true, holdN: 5, stopPct: 0.08 })
  show('損切 -12%', { useMTF: true, holdN: 5, stopPct: 0.12 })

  console.log('\n※2倍日次・コスト片道0.04%。ロングのみ。損切%は原資産ベース(口座へは2倍で効く)。')
}
main().catch(e => { console.error(e); process.exit(1) })
