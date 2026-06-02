#!/usr/bin/env node
// 追加の季節性検証: 投資の日(10/4)・NISAの日(2/13)・セルインメイ（R&D）。現物^N225・20年・ベース比較。
// 使い方: node scripts/analyze-seasonal-more.mjs

const P2 = Math.floor(Date.now() / 1000), P1 = P2 - 21 * 365 * 24 * 3600
async function fetchSym(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?period1=${P1}&period2=${P2}&interval=1d`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) })
  const j = await res.json(); const r = j?.chart?.result?.[0]; if (!r) throw new Error('no result')
  const ts = r.timestamp, cl = r.indicators.quote[0].close
  const rows = []
  for (let i = 0; i < ts.length; i++) if (cl[i] != null) rows.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: cl[i] })
  return rows
}
const r2 = v => v == null ? null : Math.round(v * 100) / 100
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null

async function main() {
  console.log('[fetch] ^N225 20年...')
  const rows = await fetchSym('^N225')
  const dates = rows.map(r => r.date)
  const onOrAfter = t => { for (let i = 0; i < rows.length; i++) if (dates[i] >= t) return i; return -1 }
  const onOrBefore = t => { let a = -1; for (let i = 0; i < rows.length; i++) { if (dates[i] <= t) a = i; else break } return a }
  const fwd = (i, n) => (i >= 0 && i + n < rows.length) ? (rows[i + n].close - rows[i].close) / rows[i].close * 100 : null

  // ベースライン: 無条件N日リターン
  const baseN = N => { const v = []; for (let i = 0; i + N < rows.length; i++) v.push((rows[i + N].close - rows[i].close) / rows[i].close * 100); return { avg: r2(mean(v)), up: Math.round(v.filter(x => x > 0).length / v.length * 100) } }

  // ① 記念日: その日(近似)から先N日・ロング目線
  const anniv = (mmdd, label) => {
    console.log(`\n── ${label} ──`)
    for (const N of [5, 10, 20]) {
      const bl = baseN(N)
      const v = []
      for (let y = 2005; y <= 2026; y++) { const i = onOrAfter(`${y}-${mmdd}`); const r = fwd(i, N); if (r != null && dates[i].slice(5, 7) === mmdd.slice(0, 2)) v.push(r) }
      const up = Math.round(v.filter(x => x > 0).length / v.length * 100)
      const edge = r2(mean(v) - bl.avg)
      console.log(`  先${N}日: 平均${String(r2(mean(v))).padStart(6)}% 上昇率${up}%  (ベース ${bl.avg}%/${bl.up}%・差${edge>0?'+':''}${edge}pt)  n=${v.length}`)
    }
  }
  console.log('\n========== ① 記念日（語呂合わせ）ロング目線・ベース比較 ==========')
  anniv('10-04', '投資の日 10/4')
  anniv('02-13', 'NISAの日 2/13')

  // ② セルインメイ: 5/1→10/31(夏) と 11/1→翌4/30(冬) の年次リターン
  console.log('\n========== ② セルインメイ（夏5-10月 vs 冬11-4月）==========')
  const summer = [], winter = []
  for (let y = 2005; y <= 2025; y++) {
    const s0 = onOrAfter(`${y}-05-01`), s1 = onOrBefore(`${y}-10-31`)
    if (s0 >= 0 && s1 > s0) summer.push((rows[s1].close - rows[s0].close) / rows[s0].close * 100)
    const w0 = onOrAfter(`${y}-11-01`), w1 = onOrBefore(`${y + 1}-04-30`)
    if (w0 >= 0 && w1 > w0) winter.push((rows[w1].close - rows[w0].close) / rows[w0].close * 100)
  }
  const winRate = a => Math.round(a.filter(x => x > 0).length / a.length * 100)
  console.log(`  夏(5-10月) 平均${r2(mean(summer))}%  上昇率${winRate(summer)}%  n=${summer.length}`)
  console.log(`  冬(11-4月) 平均${r2(mean(winter))}%  上昇率${winRate(winter)}%  n=${winter.length}`)
  console.log(`  → 差(冬-夏)=${r2(mean(winter) - mean(summer))}pt。夏が明確に弱ければセルインメイ成立`)
  console.log('\n  [ベア目線] 夏(5-10月)を空売りした場合:')
  const shortSummer = summer.map(x => -x)
  console.log(`    平均${r2(mean(shortSummer))}%  勝率${winRate(shortSummer)}%  最良${r2(Math.max(...shortSummer))}% 最悪${r2(Math.min(...shortSummer))}%`)
  console.log(`    年別(夏の素リターン%): ${summer.map(r2).join(' ')}`)

  console.log('\n⚠ 記念日 n=20・夏冬 n≈20。ベース差が＋でなければドリフトのみ。ショートは日経の構造的不利に注意。')
}
main().catch(e => { console.error(e); process.exit(1) })
