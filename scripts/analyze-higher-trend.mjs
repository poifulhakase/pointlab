#!/usr/bin/env node
// 上位トレンドで濾すと成績は上がるか（R&D・2026-08-11）
//
// 🔴 いまの対照群ルールが見ているのは**ドンチャン50/25と25日線乖離だけ**で、
//    200日線も週足も**一切見ていない**。上位トレンドは AI に数値として渡してはいるが、
//    仕組みでは効いていない（LLM が読んでどうするか任せ）。そこを測る。
//
// 🔴 期待しすぎないこと。20年R&Dの結論は「**トレンド追随は不可・弱さを買う**」で、
//    押し目買い（−10%乖離）が本線に採用された経緯がある。上位トレンドで濾すと
//    **その押し目が消える**可能性がある。①上積み ②押し目を殺して悪化 のどちらもあり得る。
//
// 🔴 比べ方＝CAGR だけ見ない。濾せば建玉が減るので DD も下がる。
//    「DD あたりどれだけ増えたか」も並べて、**同じ DD にそろえたとき**の CAGR も出す。
//
// 🔴 結果（26年・6,361営業日）＝**入れない**と結論した。
//    ① ブル全体を上位トレンドで濾すと4通りとも悪化（DDそろえ後 −1.33% 〜 −4.76%）。
//       🔴 濾したのに**DDが深くなった**＝落としたトレードが勝ち筋だった。
//    ② トリガー別に切り分けると、効くのは「ドンチャンだけ 200日線の上で採る」で +0.44%。
//       しかし頑健性が無かった:
//         移動平均の長さ  50日 −3.59% / 75日 −0.48% / 100日 −2.06% / 150日 −0.82%
//                       200日 +0.44% / 250日 −1.97% / 300日 −1.07%
//         → 7通りのうち200日だけがプラス。隣が両方マイナス＝**カーブフィッティング**。
//         期間を割ると符号が反転  前半(2000-2013) +1.35% / 後半(2013-2026) −0.70%
//
// 🔵 副産物として構造が分かった＝**稼ぎ頭はドンチャン**。押し目は26年で**24回しか発火せず**
//    CAGR 1.20%。「弱さを買う」という古い方針は、いまのルールでは実質的に機能していない。
//
// 使い方: node scripts/analyze-higher-trend.mjs [倍率]

import { computeIndicators, baselineTimeline } from '../src/utils/robotStrategy.mjs'

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }
const COST = 0.0004
const CAPITAL = 1_000_000
const LEV = Number(process.argv[2]) || 2

const pc = v => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`
const yen = v => `${Math.round(v).toLocaleString()}円`

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
    if (q.close[i] == null || q.open[i] == null) return
    out.push({
      date: new Date(t * 1000).toISOString().slice(0, 10),
      open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i],
    })
  })
  return out
}

/** 日足を週足に畳んで、週足ドンチャン（20週高値超え＝上昇）を日次に展開する */
function weeklyDonchian(rows, win = 20) {
  const wk = []
  let cur = null
  for (const r of rows) {
    const d = new Date(r.date)
    const key = `${d.getUTCFullYear()}-W${Math.floor((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 1))) / (7 * 864e5))}`
    if (!cur || cur.key !== key) { cur = { key, close: r.close, dates: [r.date] }; wk.push(cur) }
    else { cur.close = r.close; cur.dates.push(r.date) }
  }
  // 週足でのドンチャン状態
  const state = new Map()
  let on = false
  for (let i = 0; i < wk.length; i++) {
    if (i >= win) {
      const past = wk.slice(i - win, i).map(w => w.close)
      const hi = Math.max(...past), lo = Math.min(...past)
      if (!on && wk[i].close > hi) on = true
      else if (on && wk[i].close < lo) on = false
    }
    // 🔴 その週の判定は**その週が終わってから**でないと使えない。翌週の日付に効かせる。
    const next = wk[i + 1]
    if (next) for (const d of next.dates) state.set(d, on)
  }
  return state
}

function run(rows, sideAt) {
  let cash = CAPITAL, qty = 0, side = null
  const curve = []
  let trades = 0
  for (let i = 1; i < rows.length; i++) {
    const want = sideAt(i)
    if (want !== side) {
      const px = rows[i].close
      if (qty !== 0) { cash += qty * px * (1 - COST); qty = 0; trades++ }
      if (want) { const dir = want === 'bull' ? 1 : -1; qty = (cash * LEV * dir) / px; cash -= qty * px + Math.abs(qty * px) * COST; trades++ }
      side = want
    }
    curve.push({ d: rows[i].date, e: Math.max(0, cash + qty * rows[i].close) })
  }
  let peak = -Infinity, dd = 0
  for (const c of curve) { peak = Math.max(peak, c.e); dd = Math.min(dd, c.e / peak - 1) }
  const yrs = (new Date(curve[curve.length - 1].d) - new Date(curve[0].d)) / (365.25 * 864e5)
  const fin = curve[curve.length - 1].e
  return { cagr: (fin / CAPITAL) ** (1 / yrs) - 1, dd, fin, trades, yrs }
}

async function main() {
  const rows = await fetchDaily('%5EN225', 26)
  const nk = computeIndicators(rows)
  const tl = baselineTimeline(nk)
  const wk = weeklyDonchian(rows)
  console.log(`日経225 ${rows[0].date} 〜 ${rows[rows.length - 1].date}（${rows.length}営業日）／ 倍率 ${LEV}倍`)
  console.log('🔴 執行は「当日の引け」で統一（2026-08-11 の運用に合わせる）\n')

  const above200 = i => nk[i].sma200 != null && rows[i].close > nk[i].sma200
  const slope200 = i => (nk[i].sma200slope ?? 0) > 0
  const weekUp = i => wk.get(rows[i].date) === true

  // 🔴 ブルのトリガーは3つある（ドンチャン／押し目／季節性）。まとめて濾すと
  //    どれが効いたか分からない。reason で切り分ける。
  const trigger = i => {
    if (tl[i].side === 'bear') return 'bear'
    const r = tl[i].reason ?? ''
    if (r.includes('ドンチャン')) return 'donchian'
    if (r.includes('押し目')) return 'dip'
    if (r.includes('季節性')) return 'season'
    return null
  }

  const base = i => tl[i].side
  const gateAll = (ok) => (i) => (tl[i].side === 'bull' && !ok(i) ? null : tl[i].side)
  const gateOne = (which, ok) => (i) => (trigger(i) === which && !ok(i) ? null : tl[i].side)
  const onlyTrigger = (...ks) => (i) => (ks.includes(trigger(i)) ? tl[i].side : null)

  const matchDD = (f, targetDD) => {
    let lo = 0.3, hi = 12, best = null
    for (let n = 0; n < 40; n++) {
      const mid = (lo + hi) / 2
      const r = runWithLev(rows, f, mid)
      if (r.dd < targetDD) hi = mid; else { lo = mid; best = { L: mid, ...r } }
    }
    return best
  }

  const show = (label, r) => {
    const eff = Math.abs(r.dd) > 0 ? r.cagr / Math.abs(r.dd) : 0
    console.log(`  ${(label + ' '.repeat(38)).slice(0, 38)}${pc(r.cagr).padStart(8)}  ${pc(r.dd).padStart(8)}  ${eff.toFixed(2).padStart(7)}  ${String(r.trades).padStart(7)}   ${yen(r.fin)}`)
  }

  // ── ① ブル全体を濾す ──
  console.log('── ① ブル全体を上位トレンドで濾す ──')
  console.log('  条件                                     CAGR      最大DD    CAGR/DD  売買回数   最終資産')
  const baseR = run(rows, base)
  show('現行（上位トレンドを見ない）', baseR)
  const all = [
    ['200日線の上でのみブル', gateAll(above200)],
    ['200日線が上向きのときのみブル', gateAll(slope200)],
    ['週足ドンチャン20が上昇中のみブル', gateAll(weekUp)],
    ['200日線の上 かつ 上向き', gateAll(i => above200(i) && slope200(i))],
  ]
  for (const [l, f] of all) show(l, run(rows, f))
  console.log(`\n  同じDD（${pc(baseR.dd)}）にそろえたら`)
  for (const [l, f] of all) {
    const b = matchDD(f, baseR.dd)
    if (b) console.log(`    ${(l + ' '.repeat(34)).slice(0, 34)}倍率 ${b.L.toFixed(2)}x  CAGR ${pc(b.cagr).padStart(8)}  差 ${pc(b.cagr - baseR.cagr)}`)
  }
  console.log('  🔴 濾したのに DD が深くなる＝落としたトレードが勝ち筋だった、ということ。\n')

  // ── ② トリガー別に切り分ける ──
  console.log('── ② どのトリガーを濾すと効くか ──')
  console.log('  条件                                     CAGR      最大DD    CAGR/DD  売買回数   最終資産')
  const each = [
    ['押し目だけ 200日線の上で採る', gateOne('dip', above200)],
    ['ドンチャンだけ 200日線の上で採る', gateOne('donchian', above200)],
    ['押し目トリガーのみ（他を捨てる）', onlyTrigger('dip', 'bear')],
    ['ドンチャンのみ（他を捨てる）', onlyTrigger('donchian', 'bear')],
  ]
  for (const [l, f] of each) show(l, run(rows, f))
  console.log('  🔴 押し目を濾しても数字が動かないなら、押し目はほとんど発火していない。')
  console.log('     売買回数と「押し目トリガーのみ」の行で確かめること。\n')

  // ── ③ 頑健性（ここで落ちるものが多い）──
  console.log('── ③ 頑健性: 移動平均の長さを振る（ドンチャンだけ濾す・DDそろえ後の差）──')
  const smaN = (n) => {
    const a = new Array(rows.length).fill(null)
    let s = 0
    for (let i = 0; i < rows.length; i++) {
      s += rows[i].close
      if (i >= n) s -= rows[i - n].close
      if (i >= n - 1) a[i] = s / n
    }
    return a
  }
  for (const n of [50, 75, 100, 150, 200, 250, 300]) {
    const ma = smaN(n)
    const f = gateOne('donchian', i => ma[i] != null && rows[i].close > ma[i])
    const b = matchDD(f, baseR.dd)
    if (b) console.log(`  ${String(n).padStart(3)}日線   CAGR ${pc(b.cagr).padStart(8)}   差 ${pc(b.cagr - baseR.cagr)}`)
  }
  console.log('  🔴 隣の長さでも同じ方向に出るか。1つだけプラスならカーブフィッティング。\n')

  console.log('── ④ 頑健性: 期間を前後半に割る（200日線・素の比較）──')
  const half = Math.floor(rows.length / 2)
  const sub = (f, a, b, L) => {
    let cash = CAPITAL, qty = 0, side = null
    const curve = []
    for (let i = a; i < b; i++) {
      const want = f(i)
      if (want !== side) {
        const px = rows[i].close
        if (qty !== 0) { cash += qty * px * (1 - COST); qty = 0 }
        if (want) { const dir = want === 'bull' ? 1 : -1; qty = (cash * L * dir) / px; cash -= qty * px + Math.abs(qty * px) * COST }
        side = want
      }
      curve.push(Math.max(0, cash + qty * rows[i].close))
    }
    let peak = -Infinity, dd = 0
    for (const e of curve) { peak = Math.max(peak, e); dd = Math.min(dd, e / peak - 1) }
    const yrs = (new Date(rows[b - 1].date) - new Date(rows[a].date)) / (365.25 * 864e5)
    return { cagr: (curve[curve.length - 1] / CAPITAL) ** (1 / yrs) - 1, dd }
  }
  const donGate = gateOne('donchian', above200)
  for (const [lbl, a, b] of [['前半', 1, half], ['後半', half, rows.length]]) {
    const s0 = sub(base, a, b, LEV)
    const s1 = sub(donGate, a, b, LEV)
    console.log(`  ${lbl} ${rows[a].date}〜${rows[b - 1].date}`)
    console.log(`    現行        CAGR ${pc(s0.cagr).padStart(8)}  DD ${pc(s0.dd).padStart(8)}`)
    console.log(`    200日線濾し CAGR ${pc(s1.cagr).padStart(8)}  DD ${pc(s1.dd).padStart(8)}   差 ${pc(s1.cagr - s0.cagr)}`)
  }
  console.log('  🔴 前後で符号が反転するなら、通しの差は前半の残りかす。')
}

function runWithLev(rows, sideAt, L) {
  let cash = CAPITAL, qty = 0, side = null
  const curve = []
  for (let i = 1; i < rows.length; i++) {
    const want = sideAt(i)
    if (want !== side) {
      const px = rows[i].close
      if (qty !== 0) { cash += qty * px * (1 - COST); qty = 0 }
      if (want) { const dir = want === 'bull' ? 1 : -1; qty = (cash * L * dir) / px; cash -= qty * px + Math.abs(qty * px) * COST }
      side = want
    }
    curve.push({ d: rows[i].date, e: Math.max(0, cash + qty * rows[i].close) })
  }
  let peak = -Infinity, dd = 0
  for (const c of curve) { peak = Math.max(peak, c.e); dd = Math.min(dd, c.e / peak - 1) }
  const yrs = (new Date(curve[curve.length - 1].d) - new Date(curve[0].d)) / (365.25 * 864e5)
  const fin = curve[curve.length - 1].e
  return { cagr: (fin / CAPITAL) ** (1 / yrs) - 1, dd, fin }
}

main().catch(e => { console.error(e); process.exit(1) })
