#!/usr/bin/env node
// ボラティリティは予測できるか／サイズ調整に使うと効くか（R&D・2026-08-11）
//
// 🔴 なぜこれを測るか＝方向を当てる道は今日ほぼ全部塞がった。
//    価格+需給+乖離を総合しても的中率 52.8%（何もしないと 52.2%）。
//    日中足も15通り全滅。前夜の米国は寄りで織り込まれて終わり、寄りで執行する我々には取れない。
//
// 🔵 残る筋は「方向ではなく**値幅**を使う」こと。値幅（ボラ）は方向と違って
//    固まって出る（大きく動いた翌日はまた大きく動く）と言われている。まずそれを確かめ、
//    次に「ボラが高い日はサイズを落とす」と何が変わるかを測る。
//
// 🔴 比べ方に注意。ボラ調整は平均的な建玉が小さくなるので、素で比べると必ずリターンが下がる。
//    正しい問いは「**同じドローダウンに揃えたとき、どちらが多く増えるか**」。
//    そこで倍率を振って DD を揃えてから比較する。
//
// 🔴 結果（26年・6,361営業日）＝**入れない**と結論した。
//    ① ボラは予測できる（直近20日 → 先5日の相関 0.518／方向は -0.041）。理論は正しい。
//    ② しかし DD をそろえて比べると全部負けた（-1.19% 〜 -2.53%）。
//    ③ 理由は2つ:
//       🔵 すでに内蔵されていた。ルールが持っている日の平均ボラ 17.9% / 持たない日 23.8%。
//          ドンチャン＋確定下落フィルターが結果的に高ボラを避けている。上から重ねると二重になる。
//       🔴 建玉を持てている高ボラの日が**いちばん儲かっている**（+10.4bp／低ボラ +5.5bp）。
//          そこを削るのは、いちばん良い場面のサイズを落とす行為。87回のうち5回で利益の9割を
//          稼ぐ戦略なので、そこを削ると期待値の源泉が消える。
//
// 使い方: node scripts/analyze-vol-targeting.mjs

import { computeIndicators, baselineTimeline } from '../src/utils/robotStrategy.mjs'

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }
const COST = 0.0004
const CAPITAL = 1_000_000

const pc = v => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`

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
      open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i],
    })
  })
  return out
}

const mean = a => a.reduce((s, v) => s + v, 0) / a.length
const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) }
const corr = (x, y) => {
  const mx = mean(x), my = mean(y)
  let n = 0, dx = 0, dy = 0
  for (let i = 0; i < x.length; i++) { n += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2 }
  return n / Math.sqrt(dx * dy)
}

function stats(curve) {
  let peak = -Infinity, dd = 0
  for (const e of curve) { peak = Math.max(peak, e); dd = Math.min(dd, e / peak - 1) }
  return { fin: curve[curve.length - 1], dd }
}

async function main() {
  const rows = await fetchDaily('%5EN225', 26)
  const nk = computeIndicators(rows)
  const tl = baselineTimeline(nk)
  const yrs = (new Date(rows[rows.length - 1].date) - new Date(rows[0].date)) / (365.25 * 864e5)
  console.log(`日経225 ${rows[0].date} 〜 ${rows[rows.length - 1].date}（${rows.length}営業日・${yrs.toFixed(1)}年）\n`)

  // 日次リターンと、直近20日の実現ボラ（年率）
  const ret = [null]
  for (let i = 1; i < rows.length; i++) ret.push(rows[i].close / rows[i - 1].close - 1)
  const rv = new Array(rows.length).fill(null)
  for (let i = 20; i < rows.length; i++) rv[i] = sd(ret.slice(i - 19, i + 1)) * Math.sqrt(252)

  // ── ① ボラは予測できるか ──
  console.log('── ① ボラは予測できるか ──')
  for (const h of [1, 5, 20]) {
    const x = [], y = []
    for (let i = 20; i + h < rows.length; i++) {
      if (rv[i] == null) continue
      const fwd = sd(ret.slice(i + 1, i + 1 + h + 1).filter(v => v != null)) * Math.sqrt(252)
      if (!Number.isFinite(fwd)) continue
      x.push(rv[i]); y.push(fwd)
    }
    console.log(`  直近20日のボラ → この先${String(h).padStart(2)}日のボラ   相関 ${corr(x, y).toFixed(3)}   (n=${x.length})`)
  }
  // 比較: 方向のほうは？
  {
    const x = [], y = []
    for (let i = 1; i < rows.length - 1; i++) { x.push(ret[i]); y.push(ret[i + 1]) }
    console.log(`  （比較）今日のリターン → 明日のリターン        相関 ${corr(x, y).toFixed(3)}   (n=${x.length})`)
  }
  console.log('  🔵 方向はほぼゼロ相関なのに、値幅は強く続く。ここが「予測できる部分」。\n')

  // ── ② ボラでサイズを調整する ──
  // exposure = clamp(目標ボラ / 直近ボラ, 0, cap) × 倍率
  const run = (L, { volTarget = null, cap = 2.0 } = {}) => {
    let e = CAPITAL, prev = null
    const curve = []
    for (let i = 1; i < rows.length; i++) {
      const s = tl[i - 1].side
      let scale = 1
      if (volTarget != null) {
        const v = rv[i - 1]
        scale = v == null || v <= 0 ? 1 : Math.min(cap, volTarget / v)
      }
      const pos = (s === 'bull' ? L : s === 'bear' ? -L : 0) * scale
      if (s !== prev) e *= (1 - COST)
      prev = s
      e = Math.max(0, e * (1 + pos * ret[i]))
      curve.push(e)
    }
    const st = stats(curve)
    return { cagr: (st.fin / CAPITAL) ** (1 / yrs) - 1, dd: st.dd, fin: st.fin }
  }

  console.log('── ② 素の比較（倍率をそろえた場合）──')
  console.log('  やり方                        CAGR      最大DD     最終資産')
  const fixed2 = run(2)
  console.log(`  固定サイズ（現行・2倍）        ${pc(fixed2.cagr).padStart(8)}   ${pc(fixed2.dd).padStart(8)}   ${Math.round(fixed2.fin).toLocaleString()}円`)
  for (const vt of [0.15, 0.20, 0.25]) {
    const r = run(2, { volTarget: vt })
    console.log(`  ボラ目標 ${(vt * 100).toFixed(0)}%（2倍・上限2x）  ${pc(r.cagr).padStart(8)}   ${pc(r.dd).padStart(8)}   ${Math.round(r.fin).toLocaleString()}円`)
  }
  console.log('  🔴 素で比べると平均の建玉が小さくなるぶん不利に見える。DD をそろえないと意味がない。\n')

  // ── ③ DD をそろえて比べる ──
  // 固定サイズ2倍の DD に、ボラ調整側の倍率を上げて合わせる
  const targetDD = fixed2.dd
  console.log('── ③ 同じドローダウンにそろえて比べる ──')
  console.log(`  基準 = 固定サイズ2倍（DD ${pc(targetDD)}・CAGR ${pc(fixed2.cagr)}）`)
  for (const vt of [0.15, 0.20, 0.25]) {
    let lo = 0.5, hi = 12, best = null
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2
      const r = run(mid, { volTarget: vt })
      if (r.dd < targetDD) hi = mid; else { lo = mid; best = { L: mid, ...r } }
    }
    if (!best) { console.log(`  ボラ目標 ${(vt * 100).toFixed(0)}%: そろえられず`); continue }
    const gain = best.cagr - fixed2.cagr
    console.log(`  ボラ目標 ${(vt * 100).toFixed(0)}%  →  倍率 ${best.L.toFixed(2)}x   CAGR ${pc(best.cagr).padStart(8)}   DD ${pc(best.dd).padStart(8)}   ${Math.round(best.fin).toLocaleString()}円   差 ${pc(gain)}`)
  }
  console.log('\n  🔴 差が誤差程度なら入れない。入れると仕組みが1つ増え、壊れる箇所も1つ増える。')
}

main().catch(e => { console.error(e); process.exit(1) })
