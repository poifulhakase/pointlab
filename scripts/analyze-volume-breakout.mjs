#!/usr/bin/env node
// 出来高は効くか（R&D・2026-08-11）
//
// 🔴 出来高比（20日平均比）そのものは既に落ちている（先5日 t=0.55 / 先20日 t=-1.73・前後半で反転）。
//    ここで測るのは**使い方**のほう。とくに「**ブレイクに出来高が伴っているか**」。
//
// 🔵 これが本命な理由は2つ:
//    ① この戦略の稼ぎ頭は**ドンチャン＝高値ブレイク**（押し目は26年で24回しか発火せず CAGR 1.20%）。
//       「出来高なきブレイクはダマシ」は、まさにその瞬間を選り分ける使い方。
//    ② **保有を寸断しない**。ブレイクの瞬間だけを見るので、価格帯別出来高が失敗した理由
//       （日ごとに切り替わって建玉が細切れになる）に当たらない。
//
// 🔴 採否の基準（測る前に決める）: 全期間 |t| >= 2 かつ 前後半で符号が一致、
//    さらに**実際のバックテストで DD をそろえて改善**すること。
//    日次で差が出ても使えない例を今日2件見ている（抵抗線・価格帯別出来高）。
//
// 使い方: node scripts/analyze-volume-breakout.mjs

import { computeIndicators, baselineTimeline } from '../src/utils/robotStrategy.mjs'

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }
const COST = 0.0004
const CAPITAL = 1_000_000
const LEV = 2

const mean = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null)
const sd = a => { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) }
const se = a => (a.length < 2 ? null : sd(a) / Math.sqrt(a.length))
const pc = v => (v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`)

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
      high: q.high[i] ?? q.close[i], low: q.low[i] ?? q.close[i],
      close: q.close[i], volume: q.volume?.[i] ?? 0,
    })
  })
  return out
}

/** 出来高の n 日平均比。0 の日は前後で埋めない（推測で埋めない） */
function volRatio(rows, n) {
  const out = new Array(rows.length).fill(null)
  let s = 0, c = 0
  for (let i = 0; i < rows.length; i++) {
    s += rows[i].volume; c++
    if (i >= n) { s -= rows[i - n].volume; c-- }
    if (i >= n && s > 0 && rows[i].volume > 0) out[i] = rows[i].volume / (s / c)
  }
  return out
}

function tstat(vals, base) {
  if (vals.length < 8) return null
  const diff = mean(vals) - base
  return { n: vals.length, m: mean(vals), diff, t: se(vals) ? diff / se(vals) : 0 }
}

async function main() {
  const rows = await fetchDaily('%5EN225', 26)
  const nk = computeIndicators(rows)
  const tl = baselineTimeline(nk)
  console.log(`日経225 ${rows[0].date} 〜 ${rows[rows.length - 1].date}（${rows.length}営業日）\n`)

  const vr20 = volRatio(rows, 20)
  const half = Math.floor(rows.length / 2)

  // ── ① ブレイク当日の出来高で、建玉の結果が変わるか ──
  // ドンチャンで入った建玉を取り出し、入った日の出来高比で分ける
  const trades = []
  let cur = null
  for (let i = 1; i < rows.length; i++) {
    const s = tl[i].side, prev = tl[i - 1].side
    if (s !== prev) {
      if (cur) { cur.exit = i; cur.ret = (cur.side === 'bull' ? 1 : -1) * (rows[i].close / rows[cur.entry].close - 1); trades.push(cur); cur = null }
      if (s) cur = { side: s, entry: i, reason: tl[i].reason ?? '' }
    }
  }
  const don = trades.filter(t => t.side === 'bull' && t.reason.includes('ドンチャン') && vr20[t.entry] != null)
  console.log(`── ① ブレイク当日の出来高で建玉の結果が変わるか（ドンチャン ${don.length}回）──`)
  const allRet = don.map(t => t.ret)
  console.log(`  全体 平均 ${pc(mean(allRet))}  勝率 ${(don.filter(t => t.ret > 0).length / don.length * 100).toFixed(1)}%`)
  for (const thr of [0.9, 1.0, 1.1, 1.2, 1.3]) {
    const withVol = don.filter(t => vr20[t.entry] >= thr).map(t => t.ret)
    const without = don.filter(t => vr20[t.entry] < thr).map(t => t.ret)
    if (withVol.length < 5 || without.length < 5) continue
    const diff = mean(withVol) - mean(without)
    const err = Math.sqrt(se(withVol) ** 2 + se(without) ** 2)
    console.log(`  出来高比 ${thr.toFixed(1)} 以上   ${pc(mean(withVol)).padStart(8)}(n=${String(withVol.length).padStart(2)})   未満 ${pc(mean(without)).padStart(8)}(n=${String(without.length).padStart(2)})   差 ${pc(diff).padStart(8)}  t=${(err ? diff / err : 0).toFixed(2)}`)
  }

  // ── ② 出来高の他の使い方（日次・n が大きいので当たりを付けやすい）──
  console.log('\n── ② 出来高の他の使い方（日次）──')
  const obv = new Array(rows.length).fill(0)
  for (let i = 1; i < rows.length; i++) {
    obv[i] = obv[i - 1] + (rows[i].close > rows[i - 1].close ? rows[i].volume : rows[i].close < rows[i - 1].close ? -rows[i].volume : 0)
  }
  const F = [
    ['出来高比(20日平均比)', i => vr20[i]],
    ['出来高の急増(3日平均/60日平均)', i => {
      if (i < 60) return null
      let a = 0, b = 0
      for (let k = 0; k < 3; k++) a += rows[i - k].volume
      for (let k = 0; k < 60; k++) b += rows[i - k].volume
      return b > 0 ? (a / 3) / (b / 60) : null
    }],
    ['OBVの20日変化', i => (i >= 20 && obv[i - 20] !== 0 ? (obv[i] - obv[i - 20]) / Math.abs(obv[i - 20]) : null)],
    ['値幅あたりの出来高', i => {
      const r = (rows[i].high - rows[i].low) / rows[i].close
      return r > 0 && vr20[i] != null ? vr20[i] / r : null
    }],
  ]
  console.log('  特徴                            先5日t   前半t   後半t    先20日t  前半t   後半t   判定')
  for (const [label, get] of F) {
    const line = []
    let pass = true
    for (const h of [5, 20]) {
      const mk = (a, b) => {
        const p = []
        for (let i = Math.max(a, 60); i < b - h; i++) {
          const x = get(i)
          if (x == null || !Number.isFinite(x)) continue
          p.push({ x, y: rows[i + h].close / rows[i].close - 1 })
        }
        if (p.length < 300) return null
        p.sort((u, v) => u.x - v.x)
        const c = Math.floor(p.length / 3)
        const lo = p.slice(0, c).map(z => z.y), hi = p.slice(-c).map(z => z.y)
        const err = Math.sqrt(se(lo) ** 2 + se(hi) ** 2)
        return err ? (mean(hi) - mean(lo)) / err : 0
      }
      const all = mk(0, rows.length), f1 = mk(0, half), f2 = mk(half, rows.length)
      line.push(all, f1, f2)
      if (!(Math.abs(all ?? 0) >= 2 && f1 != null && f2 != null && Math.sign(f1) === Math.sign(f2))) pass = pass && false
    }
    console.log(`  ${(label + ' '.repeat(30)).slice(0, 30)}${line.map(v => (v == null ? '—' : v.toFixed(2)).padStart(7)).join(' ')}   ${pass ? '🔵 候補' : '←'}`)
  }

  // ── ③ 実際のバックテスト ──
  console.log('\n── ③ 実際に濾してみる（出来高を伴わないブレイクは建てない）──')
  const isDon = i => tl[i].side === 'bull' && (tl[i].reason ?? '').includes('ドンチャン')
  const run = (sideAt, L) => {
    let cash = CAPITAL, qty = 0, side = null, trades2 = 0
    const curve = []
    for (let i = 60; i < rows.length; i++) {
      const want = sideAt(i)
      if (want !== side) {
        const px = rows[i].close
        if (qty !== 0) { cash += qty * px * (1 - COST); qty = 0; trades2++ }
        if (want) { const d = want === 'bull' ? 1 : -1; qty = (cash * L * d) / px; cash -= qty * px + Math.abs(qty * px) * COST; trades2++ }
        side = want
      }
      curve.push(Math.max(0, cash + qty * rows[i].close))
    }
    let peak = -Infinity, dd = 0
    for (const e of curve) { peak = Math.max(peak, e); dd = Math.min(dd, e / peak - 1) }
    const yrs = (new Date(rows[rows.length - 1].date) - new Date(rows[60].date)) / (365.25 * 864e5)
    return { cagr: (curve[curve.length - 1] / CAPITAL) ** (1 / yrs) - 1, dd, trades: trades2 }
  }
  const base = run(i => tl[i].side, LEV)
  console.log(`  現行                              CAGR ${pc(base.cagr).padStart(8)}  DD ${pc(base.dd).padStart(8)}  回数 ${base.trades}`)
  for (const thr of [0.9, 1.0, 1.1, 1.2, 1.3]) {
    // 🔴 「入る瞬間だけ」濾す。入った後は出来高を見ない（見ると保有が寸断される）。
    let held = false
    const f = (i) => {
      const s = tl[i].side
      if (s !== 'bull') { held = false; return s }
      if (!held) {
        if (isDon(i) && (vr20[i] ?? 0) < thr) return null
        held = true
      }
      return s
    }
    const r = run(f, LEV)
    let lo = 0.3, hi = 12, best = null
    for (let n = 0; n < 40; n++) {
      const m = (lo + hi) / 2
      held = false
      const x = run(f, m)
      if (x.dd < base.dd) hi = m; else { lo = m; best = { L: m, ...x } }
    }
    console.log(`  出来高比 ${thr.toFixed(1)} 未満は建てない        CAGR ${pc(r.cagr).padStart(8)}  DD ${pc(r.dd).padStart(8)}  回数 ${String(r.trades).padStart(4)}   DDそろえ後の差 ${best ? pc(best.cagr - base.cagr) : '—'}`)
  }
  console.log('\n  🔴 売買回数が跳ね上がっていないか必ず見ること。増えていれば保有を寸断している。')
}

main().catch(e => { console.error(e); process.exit(1) })
