#!/usr/bin/env node
// ロボ口座に「どれくらい期待していいか」を過去データで出す（R&D・2026-08-11）
//
// 🔴 これは願望ではなく実測を置くための道具。会話のたびに数字を作り直すと、
//    そのときどきで違うことを言ってしまう。ここを唯一の出どころにする。
//
// 出すもの:
//   ① 対照群ルール vs 買い持ち（インデックス／2倍）の比較
//   ② 倍率を上げたときの CAGR・月次平均・最大DD（🔴 平均は上がるのに複利は落ちる点）
//   ③ 月ごと・年ごとの実際のばらつき（平均だけ見ると必ず読み違える）
//
// 使い方: node scripts/analyze-expectation.mjs [元本(円)] [倍率]
//   例) node scripts/analyze-expectation.mjs 5000000 2

import { computeIndicators, baselineTimeline } from '../src/utils/robotStrategy.mjs'

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }
const CAPITAL = Number(process.argv[2]) || 1_000_000
const LEV = Number(process.argv[3]) || 2
const COST = 0.0004   // 建て替え1回あたり

const yen = v => `${Math.round(v).toLocaleString()}円`
const man = v => `${v >= 0 ? '+' : ''}${Math.round(v / 1e4)}万円`
const pc = v => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`

async function daily(symbol, years) {
  const p2 = Math.floor(Date.now() / 1000)
  const p1 = p2 - years * 365 * 24 * 3600
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${p1}&period2=${p2}&interval=1d`,
    { headers: UA, signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`${symbol}: HTTP ${res.status}`)
  const r = (await res.json())?.chart?.result?.[0]
  const q = r.indicators.quote[0]
  const out = []
  r.timestamp.forEach((t, i) => {
    if (q.close[i] == null) return
    out.push({
      date: new Date(t * 1000).toISOString().slice(0, 10),
      open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i],
    })
  })
  return out
}

/** 資産曲線から CAGR・最大DD・水面下の最長期間を出す */
function stats(curve, capital) {
  let peak = -Infinity, dd = 0, peakDate = null, longest = 0, from = null, to = null
  for (const c of curve) {
    if (c.e >= peak) {
      if (peakDate) {
        const days = (new Date(c.d) - new Date(peakDate)) / 864e5
        if (days > longest) { longest = days; from = peakDate; to = c.d }
      }
      peak = c.e; peakDate = c.d
    }
    dd = Math.min(dd, c.e / peak - 1)
  }
  const yrs = (new Date(curve[curve.length - 1].d) - new Date(curve[0].d)) / (365.25 * 864e5)
  const fin = curve[curve.length - 1].e
  return { cagr: (fin / capital) ** (1 / yrs) - 1, dd, fin, yrs, longest, from, to }
}

/** ルールを倍率 L で回す。side が null の日は持たない */
function runRule(rows, tl, L, capital) {
  let e = capital, prev = null
  const curve = []
  for (let i = 1; i < rows.length; i++) {
    const dr = rows[i].close / rows[i - 1].close - 1
    const s = tl[i - 1].side
    const pos = s === 'bull' ? L : s === 'bear' ? -L : 0
    if (s !== prev) e *= (1 - COST)
    prev = s
    e = Math.max(0, e * (1 + pos * dr))
    curve.push({ d: rows[i].date, e })
  }
  return curve
}

/** 買い持ち（倍率 L の日次リバランス。L=1 なら現物と同じ） */
function runHold(rows, L, capital) {
  let e = capital
  const curve = []
  for (let i = 1; i < rows.length; i++) {
    e = Math.max(0, e * (1 + L * (rows[i].close / rows[i - 1].close - 1)))
    curve.push({ d: rows[i].date, e })
  }
  return curve
}

const line = (label, s, capital) =>
  `  ${(label + ' '.repeat(24)).slice(0, 24)} CAGR ${(s.cagr * 100).toFixed(2).padStart(6)}%   最大DD ${(s.dd * 100).toFixed(1).padStart(6)}%   ${yen(capital)}→ ${yen(s.fin)}`

async function main() {
  console.log(`元本 ${yen(CAPITAL)} ／ 倍率 ${LEV}倍\n`)
  const rows = await daily('%5EN225', 26)
  const nk = computeIndicators(rows)
  const tl = baselineTimeline(nk)
  console.log(`日経225 ${rows[0].date} 〜 ${rows[rows.length - 1].date}（${rows.length}営業日）\n`)

  // ── ① 比較 ──
  console.log('── ① ルール vs 買い持ち ──')
  console.log(line(`ルール（${LEV}倍）`, stats(runRule(rows, tl, LEV, CAPITAL), CAPITAL), CAPITAL))
  console.log(line(`${LEV}倍 買い持ち`, stats(runHold(rows, LEV, CAPITAL), CAPITAL), CAPITAL))
  console.log(line('日経225 買い持ち', stats(runHold(rows, 1, CAPITAL), CAPITAL), CAPITAL))
  console.log('  🔴 実物ETF（1570=2012年上場 / 1357=2014年）が無い期間は合成2倍で代用している。')
  console.log('  🔴 下げ相場を含むかで結論が反転する。2014年以降だけ見ると、ルールは指数に負ける。\n')

  // ── ② 倍率 ──
  console.log('── ② 倍率を上げるとどうなるか ──')
  console.log('  倍率      CAGR    月次平均    最大DD      最終資産')
  for (const L of [1, 2, 3, 4, 5, 6]) {
    const curve = runRule(rows, tl, L, CAPITAL)
    const s = stats(curve, CAPITAL)
    const mon = {}
    for (const c of curve) mon[c.d.slice(0, 7)] = c.e
    const ms = Object.keys(mon).sort()
    const mr = ms.slice(1).map((m, i) => mon[m] / mon[ms[i]] - 1)
    const avgM = mr.reduce((a, b) => a + b, 0) / mr.length
    console.log(`  ${(L + '倍').padEnd(6)}${((s.cagr * 100).toFixed(2) + '%').padStart(8)}${((avgM * 100).toFixed(2) + '%').padStart(11)}${((s.dd * 100).toFixed(1) + '%').padStart(11)}   ${yen(s.fin)}`)
  }
  console.log('  🔴 月次平均は上がり続けるのに、CAGR と最終資産は途中から落ちる。')
  console.log('     深い谷を通ると、平均が高くても複利が折れるため。「月◯%」を目標にしてはいけない。\n')

  // ── ③ ばらつき ──
  const curve = runRule(rows, tl, LEV, CAPITAL)
  const s = stats(curve, CAPITAL)
  const mon = {}, yr = {}
  for (const c of curve) { mon[c.d.slice(0, 7)] = c.e; yr[c.d.slice(0, 4)] = c.e }

  const ms = Object.keys(mon).sort()
  const mr = ms.slice(1).map((m, i) => mon[m] / mon[ms[i]] - 1).sort((a, b) => a - b)
  const Q = p => mr[Math.floor(p * (mr.length - 1))]
  console.log('── ③ 実際のばらつき ──')
  console.log(`  月次: 中央値 ${pc(Q(0.5))}   下位10% ${pc(Q(0.1))}   上位10% ${pc(Q(0.9))}   （n=${mr.length}）`)
  console.log(`        ±0.5%以内の月 ${mr.filter(v => Math.abs(v) < 0.005).length}/${mr.length}`)

  const ys = Object.keys(yr).sort()
  const yrRet = ys.slice(1).map((y, i) => ({ y, r: yr[y] / yr[ys[i]] - 1 }))
  console.log(`  年次: マイナスの年 ${yrRet.filter(o => o.r < 0).length}/${yrRet.length}`)
  const sortedY = yrRet.map(o => o.r).sort((a, b) => a - b)
  console.log(`        中央値 ${pc(sortedY[Math.floor(sortedY.length / 2)])}（${man(sortedY[Math.floor(sortedY.length / 2)] * CAPITAL)}）   平均 ${pc(sortedY.reduce((a, b) => a + b, 0) / sortedY.length)}`)
  for (const o of yrRet) console.log(`        ${o.y}  ${pc(o.r).padStart(7)}  ${man(o.r * CAPITAL).padStart(9)}`)

  console.log(`\n  🔴 水面下が一番長かった期間: ${Math.round(s.longest)}日 ≒ ${(s.longest / 365).toFixed(1)}年（${s.from} 〜 ${s.to}）`)
  console.log(`  🔴 最大DD ${pc(s.dd)} ＝ ${yen(CAPITAL)} なら ${man(s.dd * CAPITAL)}。この谷を握れるかが結果を分ける。`)
  console.log('  🔵 平均ではなく中央値を見ること。半分以上の月は何も起きず、少数の大きな月が全体を作っている。')
  console.log('  🔵 これは「毎年入ってくる収入」ではない。引き出すと複利が止まり、この結果にはならない。')
}

main().catch(e => { console.error(e); process.exit(1) })
