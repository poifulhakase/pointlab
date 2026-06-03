#!/usr/bin/env node
// 実戦構造の損益＆生存モデル（v5a系を地に足をつけて使用）
//   B = 現物（高配当+株主優待+キャピタルゲイン）＝資本の土台 かつ 代用有価証券（担保）
//   A = 信用取引（Bを代用担保にレバ）＝v5a系スイングシステムで20%を取りに行くエンジン
// 日本株がベスト：①優待は日本固有 ②代用担保で資本が二重に働く（配当も担保も同時）
// 関門：20%を狙う代用レバが、-35%暴落で追証(強制決済)にならず生き残れるか。
// Aの年次挙動はNikkei実データのv5a系から実測（暴落年は trendフィルターで退避＝損失が浅い 性質込み）。
// 使い方: node scripts/model-portfolio-v2.mjs

const P2 = Math.floor(Date.now() / 1000), P1 = P2 - 21 * 365 * 24 * 3600
const r2 = v => Math.round(v * 100) / 100
const pct = n => (n >= 0 ? '+' : '') + r2(n * 100) + '%'
const yen = n => '¥' + Math.round(n).toLocaleString()
const COST = 0.0004

async function fetchDaily() {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EN225?period1=${P1}&period2=${P2}&interval=1d`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }, signal: AbortSignal.timeout(30000) })
  const j = await res.json(); const r = j.chart.result[0]
  const ts = r.timestamp, cl = r.indicators.quote[0].close
  const rows = []
  for (let i = 0; i < ts.length; i++) if (cl[i] != null) rows.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: cl[i] })
  for (let i = 0; i < rows.length; i++) { let s = 0, w = 25; if (i >= w - 1) { for (let k = 0; k < w; k++) s += rows[i - k].close; rows[i].dev25 = (rows[i].close - s / w) / (s / w) * 100 } else rows[i].dev25 = null }
  return rows
}

// v5a系の1倍日次リターン（トレンド+確定下落で濾した押し目+濾した季節性）
function v5aDaily(rows) {
  const n = rows.length
  const trendLong = new Array(n).fill(false), trendBear = new Array(n).fill(false)
  { let s = 0; for (let i = 50; i < n; i++) { let hi = -Infinity, exLo = Infinity; for (let k = 1; k <= 50; k++) hi = Math.max(hi, rows[i - k].close); for (let k = 1; k <= 25; k++) exLo = Math.min(exLo, rows[i - k].close); const cc = rows[i].close; if (s === 0 && cc > hi) s = 1; else if (s === 1 && cc < exLo) s = 0; trendLong[i] = s === 1 } }
  { let s = 0; for (let i = 50; i < n; i++) { let lo = Infinity, exHi = -Infinity; for (let k = 1; k <= 50; k++) lo = Math.min(lo, rows[i - k].close); for (let k = 1; k <= 25; k++) exHi = Math.max(exHi, rows[i - k].close); const cc = rows[i].close; if (s === 0 && cc < lo) s = 1; else if (s === 1 && cc > exHi) s = 0; trendBear[i] = s === 1 } }
  const dip = new Array(n).fill(false); { let until = -1; for (let i = 25; i < n; i++) { if (rows[i].dev25 != null && rows[i].dev25 <= -10 && !trendBear[i]) until = Math.max(until, i + 5); if (i <= until) dip[i] = true } }
  const mmdd = i => rows[i].date.slice(5)
  const season = i => !trendBear[i] && ((mmdd(i) >= '03-15' && mmdd(i) <= '03-27') || (mmdd(i) >= '12-15' && mmdd(i) <= '12-30'))
  const pos = i => trendLong[i] || dip[i] || season(i)
  const out = []; let prev = false
  for (let i = 1; i < n; i++) {
    let ret = pos(i - 1) ? (rows[i].close - rows[i - 1].close) / rows[i - 1].close : 0
    if (pos(i) !== prev) { ret -= COST; prev = pos(i) }
    out.push({ date: rows[i].date, sys: ret, mkt: (rows[i].close - rows[i - 1].close) / rows[i - 1].close })
  }
  return out
}

async function main() {
  console.log('[fetch] Yahoo ^N225 日次20年... A(信用)の年次挙動をv5a系から実測')
  const rows = await fetchDaily()
  const daily = v5aDaily(rows)

  // 年次集計：市場(B&H)と v5a系1倍
  const yr = {}
  for (const d of daily) { const y = d.date.slice(0, 4); (yr[y] ||= { mkt: 1, sys: 1 }); yr[y].mkt *= (1 + d.mkt); yr[y].sys *= (1 + d.sys) }
  const years = Object.keys(yr).sort().filter(y => y >= '2005' && y <= '2025')
  const rec = years.map(y => ({ y, mkt: yr[y].mkt - 1, sys: yr[y].sys - 1 }))

  console.log('\n========== 年次：市場(日経B&H) vs A=v5a系(1倍) ==========')
  for (const r of rec) console.log(`  ${r.y}  市場 ${pct(r.mkt).padStart(7)}   A(1倍) ${pct(r.sys).padStart(7)}`)

  // シナリオ別のA(1倍)平均：暴落年/平年/好年
  const crashYrs = rec.filter(r => r.mkt < -0.12), flatYrs = rec.filter(r => r.mkt >= -0.12 && r.mkt < 0.15), goodYrs = rec.filter(r => r.mkt >= 0.15)
  const avg = a => a.length ? a.reduce((s, r) => s + r.sys, 0) / a.length : 0
  const avgM = a => a.length ? a.reduce((s, r) => s + r.mkt, 0) / a.length : 0
  const worst = rec.reduce((w, r) => r.mkt < w.mkt ? r : w, rec[0])
  const SC = {
    '好年(市場大幅高)': { mkt: avgM(goodYrs), sysA: avg(goodYrs) },
    '平年(レンジ)':    { mkt: avgM(flatYrs), sysA: avg(flatYrs) },
    '暴落年':          { mkt: avgM(crashYrs), sysA: avg(crashYrs) },
  }
  console.log('\n========== シナリオ別 A=v5a系(1倍)の実測平均 ==========')
  for (const [k, v] of Object.entries(SC)) console.log(`  ${k.padEnd(16)} 市場${pct(v.mkt).padStart(7)}  A(1倍)${pct(v.sysA).padStart(7)}`)
  console.log(`  最悪年: ${worst.y} 市場${pct(worst.mkt)} / A(1倍)${pct(worst.sys)} ← 生存チェックに使用`)

  // ── ポートフォリオ・モデル ──
  const E = 10_000_000          // 自己資金＝B現物の評価額（＝代用担保の土台）
  const incomeY = 0.05          // B収入：高配当3.5% + 優待1.5%（暴落年も優待は安定と仮定）
  const betaB = 0.65            // B(高配当/バリュー)の市場感応度
  const kakeme = 0.8            // 代用掛け目
  const kinri = 0.027           // 信用買い金利/年
  const tax = 0.20              // 信用利益への課税
  const maintLine = 0.25        // 追証ライン(維持率)

  // 2倍インバースETFの年次リターン近似（-2×市場 - 年5%の減価ドラッグ）
  const bearRet = mkt => -2 * mkt - 0.05
  // 1年の総合リターン（自己資金E比）。実際の年(mkt,sys)で計算。hedge=ベアに回すE比率
  function yearTotalActual(Lm, hedge, mkt, sys) {
    const Bincome = incomeY
    const Bgain = betaB * mkt
    let trade = Lm * sys - Lm * kinri              // A建玉PL - 金利
    const tradeAT = trade > 0 ? trade * (1 - tax) : trade
    let bearPnl = hedge * bearRet(mkt)
    const bearAT = bearPnl > 0 ? bearPnl * (1 - tax) : bearPnl
    return Bincome + Bgain + tradeAT + bearAT
  }
  // 20年を実際の年系列で複利。CAGRと最悪年・年次ベースの最大DDを返す
  function compound(Lm, hedge) {
    let eq = 1, peak = 1, maxDD = 0, worstYr = 1
    for (const r of rec) {
      const t = yearTotalActual(Lm, hedge, r.mkt, r.sys)
      worstYr = Math.min(worstYr, t)
      eq *= (1 + t); peak = Math.max(peak, eq); maxDD = Math.min(maxDD, eq / peak - 1)
    }
    return { cagr: Math.pow(eq, 1 / rec.length) - 1, worstYr, maxDD }
  }
  // 暴落年トラフでの委託保証金維持率（保守=Aが最悪年いっぱい建玉保持・ベア利益は保証金に加算）
  function maintRate(Lm, hedge) {
    const Btrough = E * (1 + betaB * worst.mkt)
    const bearGain = hedge * E * bearRet(worst.mkt)       // 暴落時のベア利益＝担保に上乗せ
    const jushin = Btrough * kakeme + Math.max(0, bearGain)
    const tategyokuPL = Lm * E * worst.sys
    return (jushin + tategyokuPL) / (Lm * E)
  }

  console.log('\n========== ★ 20年複利の実CAGR（B土台 + A=v5a系レバ + ベアヘッジ）==========')
  console.log(`  前提: B現物${yen(E)}(=担保)・収入${incomeY * 100}%(配当+優待)・βB${betaB}・金利${kinri * 100}%・税${tax * 100}%・追証${maintLine * 100}%・ベア=2倍インバース(年-5%減価)`)
  console.log('  レバLm × ベアヘッジ(E比)        20年CAGR   最悪年    年次最大DD   暴落年維持率')
  for (const Lm of [1.5, 2, 2.5, 3]) {
    for (const hedge of [0, 0.15, 0.30]) {
      const r = compound(Lm, hedge), m = maintRate(Lm, hedge)
      const hit = r.cagr >= 0.20 ? ' ★20%' : ''
      const surv = m >= maintLine ? '✅' : '🔴'
      console.log(`  Lm${Lm} / ベア${(hedge * 100).toString().padStart(2)}%   ${pct(r.cagr).padStart(7)}   ${pct(r.worstYr).padStart(7)}   ${pct(r.maxDD).padStart(7)}    ${(m * 100).toFixed(0)}% ${surv}${hit}`)
    }
  }

  console.log('\n※20年実測の年系列で複利。Aの年次=v5a系実測。B収入/β/掛け目/ベア減価は仮定（調整可）。')
  console.log('※「好年だけ+40%」は当てにならない＝平年(レンジ)が最多でAは平年マイナス。複利CAGRが本当の数字。')
  console.log('※ベアは好年/平年で出血し複利CAGRを下げるが、暴落の最悪年と維持率を改善＝保険。最適点を上表で探す。')
  console.log('※20年イン・サンプル＝将来保証ではない。優待利回り・代用掛け目は銘柄/証券会社で変わる。')
}
main().catch(e => { console.error(e); process.exit(1) })
