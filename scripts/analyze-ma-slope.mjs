#!/usr/bin/env node
// MAの「傾き」だけでタイミング判断できるかの検証（R&D・コミット対象外想定）
// Yahoo ^N225 日次20年。MA(25/75/200)の傾き符号で
//   ①ロング/ノーポジ（傾き+の時だけ保有）  ②ロング/ショート（傾き-で売り）
// の成績を B&H と比較。さらに傾き符号→翌日/先20日リターンのエッジを測る。
// 使い方: node scripts/analyze-ma-slope.mjs

const P2 = Math.floor(Date.now() / 1000)
const P1 = P2 - 21 * 365 * 24 * 3600

async function fetchDaily() {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EN225?period1=${P1}&period2=${P2}&interval=1d`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }, signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const j = await res.json()
  const r = j?.chart?.result?.[0]
  const ts = r.timestamp ?? [], cl = r.indicators?.quote?.[0]?.close ?? []
  const rows = []
  for (let i = 0; i < ts.length; i++) if (cl[i] != null) rows.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: cl[i] })
  return rows
}
const r2 = v => v == null ? null : Math.round(v * 100) / 100
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null
const sma = (rows, i, n) => { if (i < n - 1) return null; let s = 0; for (let k = 0; k < n; k++) s += rows[i - k].close; return s / n }
const cum = a => a.reduce((acc, r) => acc * (1 + r / 100), 1)

async function main() {
  console.log('[fetch] Yahoo ^N225 日次20年...')
  const rows = await fetchDaily()
  const yrs = rows.length / 245
  console.log(`  → ${rows.length}営業日 (${rows[0].date} 〜 ${rows[rows.length - 1].date}) ≈ ${r2(yrs)}年`)

  for (const n of [25, 75, 200]) for (let i = 0; i < rows.length; i++) rows[i]['ma' + n] = sma(rows, i, n)
  const next1 = i => (i + 1 < rows.length) ? (rows[i + 1].close - rows[i].close) / rows[i].close * 100 : null
  const fwd = (i, k) => (i + k < rows.length) ? (rows[i + k].close - rows[i].close) / rows[i].close * 100 : null

  for (const maP of [25, 75, 200]) {
    for (const look of [10, 20]) {
      const longFlat = [], longShort = [], bh = []
      const upR = [], dnR = [], f20up = [], f20dn = []
      let flips = 0, lastSign = 0
      for (let i = 0; i < rows.length - 1; i++) {
        const ma = rows[i]['ma' + maP], maPrev = (i - look >= 0) ? rows[i - look]['ma' + maP] : null
        if (ma == null || maPrev == null) continue
        const slope = (ma - maPrev) / maPrev * 100
        const ret = next1(i); if (ret == null) continue
        const sign = slope > 0 ? 1 : -1
        if (sign !== lastSign && lastSign !== 0) flips++
        lastSign = sign
        bh.push(ret)
        longFlat.push(sign > 0 ? ret : 0)
        longShort.push(sign > 0 ? ret : -ret)
        if (sign > 0) { upR.push(ret); const e = fwd(i, 20); if (e != null) f20up.push(e) }
        else          { dnR.push(ret); const e = fwd(i, 20); if (e != null) f20dn.push(e) }
      }
      const cagr = arr => r2((Math.pow(cum(arr), 1 / yrs) - 1) * 100)
      const inMkt = Math.round(upR.length / bh.length * 100)
      const upHit = f20up.length ? Math.round(f20up.filter(v => v > 0).length / f20up.length * 100) : 0
      const dnHit = f20dn.length ? Math.round(f20dn.filter(v => v > 0).length / f20dn.length * 100) : 0
      console.log(`\n========== MA${maP} 傾き(${look}日) ==========`)
      console.log(`  B&H        CAGR ${cagr(bh)}%   (累積 ${r2((cum(bh)-1)*100)}%)`)
      console.log(`  傾き+で保有 CAGR ${cagr(longFlat)}%   (累積 ${r2((cum(longFlat)-1)*100)}%)  市場滞在 ${inMkt}%  切替 ${r2(flips/yrs)}回/年`)
      console.log(`  傾き+買/-売 CAGR ${cagr(longShort)}%   (累積 ${r2((cum(longShort)-1)*100)}%)`)
      console.log(`  傾き+ 平均翌日 ${r2(mean(upR))}% / 傾き- 平均翌日 ${r2(mean(dnR))}%   ← 差がエッジ`)
      console.log(`  傾き+ 先20日上昇率 ${upHit}% / 傾き- 先20日上昇率 ${dnHit}%`)
    }
  }
}
main().catch(e => { console.error(e); process.exit(1) })
