#!/usr/bin/env node
// レジスタンス／サポートは効くか（R&D・2026-08-11）
//
// 🔴 この戦略の稼ぎ頭は**ドンチャン＝高値を抜けたら乗る**トリガーだと分かった
//    （押し目は26年で24回しか発火せず CAGR 1.20%）。
//    ドンチャンは本質的に「レジスタンス突破に乗る」ものなので、
//    抵抗線の概念は**すでに戦略の中心にある**。
//    → 測るべきは「抵抗線を見るか」ではなく「**どの抵抗線が効くか**」。
//
// 🔵 人がチャートで見ている「強い抵抗線」は数値にできる:
//      ・直近高値／長期高値までの距離（＝抵抗の近さ）
//      ・その水準を過去に**何回試したか**（＝抵抗の強さ）
//      ・サポート側も同じ
//
// 🔴 小標本に注意。対照群のトレードは26年で87回しかない。
//    そこで**日次（n≈6,000）で当たりを付けてから、トレード単位で確かめる**。
//    日次で出ない差がトレード単位で出たら、それはただの偶然。
//
// 使い方: node scripts/analyze-resistance.mjs

import { computeIndicators, baselineTimeline } from '../src/utils/robotStrategy.mjs'

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }

const pc = v => (v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`)
const mean = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null)
const sd = a => { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) }
const se = a => (a.length < 2 ? null : sd(a) / Math.sqrt(a.length))

async function fetchDaily(symbol, years) {
  const p2 = Math.floor(Date.now() / 1000)
  const p1 = p2 - years * 365 * 24 * 3600
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${p1}&period2=${p2}&interval=1d`,
    { headers: UA, signal: AbortSignal.timeout(30000) })
  const r = (await res.json())?.chart?.result?.[0]
  const q = r.indicators.quote[0]
  const out = []
  r.timestamp.forEach((t, i) => {
    if (q.close[i] == null) return
    out.push({
      date: new Date(t * 1000).toISOString().slice(0, 10),
      open: q.open[i] ?? q.close[i], high: q.high[i] ?? q.close[i],
      low: q.low[i] ?? q.close[i], close: q.close[i],
    })
  })
  return out
}

/** 過去 win 本の高値／安値（当日は含めない） */
function extremes(rows, i, win) {
  let hi = -Infinity, lo = Infinity
  for (let k = 1; k <= win && i - k >= 0; k++) {
    hi = Math.max(hi, rows[i - k].high)
    lo = Math.min(lo, rows[i - k].low)
  }
  return { hi: hi === -Infinity ? null : hi, lo: lo === Infinity ? null : lo }
}

/**
 * その水準を過去 win 本で**何回試したか**（＝抵抗／支持の強さ）。
 * 🔴 「触れた日数」ではなく「**触れた回数（かたまり）**」で数える。
 *    3日続けて触れたのは1回の試し。日数で数えると、ただ長く張り付いた水準が強く見える。
 */
function touches(rows, i, level, win, tolPct = 0.005) {
  if (level == null) return 0
  const tol = level * tolPct
  let n = 0, inTouch = false
  for (let k = win; k >= 1; k--) {
    const j = i - k
    if (j < 0) continue
    const near = rows[j].high >= level - tol && rows[j].low <= level + tol
    if (near && !inTouch) n++
    inTouch = near
  }
  return n
}

/** 帯ごとに先のリターンを比べる */
function buckets(label, pairs, targetName) {
  const v = pairs.filter(p => p.x != null && p.y != null)
  if (v.length < 60) { console.log(`  ${label}: 件数不足 (${v.length})`); return }
  const s = [...v].sort((a, b) => a.x - b.x)
  const cut = Math.floor(s.length / 3)
  const gs = [['低', s.slice(0, cut)], ['中', s.slice(cut, s.length - cut)], ['高', s.slice(s.length - cut)]]
  const all = v.map(p => p.y)
  console.log(`  ${label} → ${targetName}   [全体 ${pc(mean(all))} / 勝率 ${(v.filter(p => p.y > 0).length / v.length * 100).toFixed(1)}% / n=${v.length}]`)
  for (const [n, g] of gs) {
    const ys = g.map(p => p.y)
    console.log(`      ${n}  ${pc(mean(ys))} ±${pc(se(ys))}   勝率 ${(g.filter(p => p.y > 0).length / g.length * 100).toFixed(1)}%   n=${g.length}`)
  }
  const lo = gs[0][1].map(p => p.y), hi = gs[2][1].map(p => p.y)
  const diff = mean(hi) - mean(lo)
  const err = Math.sqrt(se(lo) ** 2 + se(hi) ** 2)
  const t = err ? diff / err : 0
  console.log(`      高−低 ${pc(diff)}（誤差 ±${pc(err)} / t=${t.toFixed(2)}）${Math.abs(t) >= 2 ? '  🔵 差あり' : '  ← 誤差の範囲'}`)
}

async function main() {
  const rows = await fetchDaily('%5EN225', 26)
  const nk = computeIndicators(rows)
  const tl = baselineTimeline(nk)
  console.log(`日経225 ${rows[0].date} 〜 ${rows[rows.length - 1].date}（${rows.length}営業日）\n`)

  // 各日の抵抗／支持の特徴
  const feat = rows.map((r, i) => {
    if (i < 260) return null
    const e60 = extremes(rows, i, 60)
    const e250 = extremes(rows, i, 250)
    let allHi = -Infinity
    for (let k = 1; k <= i; k++) allHi = Math.max(allHi, rows[i - k].high)
    return {
      // 抵抗までの距離（＋なら上にまだ余地がある＝抵抗が遠い）
      toHigh60: e60.hi ? (e60.hi - r.close) / r.close : null,
      toHigh250: e250.hi ? (e250.hi - r.close) / r.close : null,
      toAllHigh: allHi > -Infinity ? (allHi - r.close) / r.close : null,
      // 支持までの距離（＋なら下に余裕がある）
      toLow60: e60.lo ? (r.close - e60.lo) / r.close : null,
      // 60日高値を過去250本で何回試したか（＝抵抗の強さ）
      testedHigh: touches(rows, i, e60.hi, 250),
      testedLow: touches(rows, i, e60.lo, 250),
    }
  })

  const fwd = (i, n) => (i + n < rows.length ? rows[i + n].close / rows[i].close - 1 : null)

  // ── ① 日次で当たりを付ける ──
  console.log('── ① 日次（n≈6,000）で当たりを付ける ──')
  const F = [
    ['60日高値までの距離', f => f.toHigh60],
    ['250日高値までの距離', f => f.toHigh250],
    ['全期間高値までの距離', f => f.toAllHigh],
    ['60日安値までの距離', f => f.toLow60],
    ['60日高値を試した回数', f => f.testedHigh],
    ['60日安値を試した回数', f => f.testedLow],
  ]
  for (const n of [5, 20]) {
    console.log(`\n  【この先${n}日のリターン】`)
    for (const [label, get] of F) {
      buckets(label, rows.map((_, i) => ({ x: feat[i] ? get(feat[i]) : null, y: fwd(i, n) })), `${n}日後`)
    }
  }

  // ── ② トレード単位で確かめる ──
  // ドンチャンで入った建玉だけを取り出し、入った日の特徴と結果を突き合わせる
  console.log('\n── ② ドンチャンで入った建玉（n は小さい。①で差が出たものだけ見る）──')
  const trades = []
  let cur = null
  for (let i = 1; i < rows.length; i++) {
    const s = tl[i].side
    const prev = tl[i - 1].side
    if (s !== prev) {
      if (cur) { cur.exit = i; cur.ret = (cur.side === 'bull' ? 1 : -1) * (rows[i].close / rows[cur.entry].close - 1); trades.push(cur); cur = null }
      if (s) cur = { side: s, entry: i, reason: tl[i].reason ?? '' }
    }
  }
  const don = trades.filter(t => t.side === 'bull' && t.reason.includes('ドンチャン') && feat[t.entry])
  console.log(`  ドンチャンの建玉 ${don.length}回（全 ${trades.length}回中）`)
  for (const [label, get] of F) {
    buckets(label, don.map(t => ({ x: get(feat[t.entry]), y: t.ret })), '建玉の損益')
  }

  console.log('\n  🔴 ①で誤差の範囲だったものが②で差に見えても、それは偶然。n が20〜30しかない。')
  console.log('  🔴 t が 2 未満なら入れない。入れる前に必ず頑健性（期間分割・パラメータ振り）を見ること。')
}

main().catch(e => { console.error(e); process.exit(1) })
