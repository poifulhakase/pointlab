#!/usr/bin/env node
// 建てるタイミングを「翌日の寄り」から「当日の大引け」に早めると何が変わるか（R&D・2026-08-11）
//
// 🔴 きっかけ＝日経のリターンは**オーバーナイト（引け→寄り）に集中している**と実測で分かった。
//    26年・1倍で CAGR: オーバーナイト +11.07% / 日中(寄り→引け) −4.90% / 買い持ち +5.62%。
//    日中は方向のないノイズにリスクだけ晒す時間帯だった。
//    今の作りは「D-1の終値で判断 → D日の寄りで執行」なので、**建てる初日のオーバーナイトを1回逃している**。
//
// 🔵 案（ユーザー）＝後場のうちに建てて翌日を取る。売買回数を増やさずに実現するには
//    「判断と執行を同じ日の引けにまとめる」＝**引成（MOC）で建てる**形になる。
//
// 🔴 先読みに注意。C案（保守）は先読みゼロ。B案は 15:00 に判断して引成を出す想定で、
//    終値そのもので判断したことにしているため**30分ぶんの先読み**が入る。差はここを割り引いて読む。
//
// 使い方: node scripts/analyze-entry-timing.mjs [倍率]

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

/**
 * 建玉の推移を、約定価格を指定して回す。
 * @param sideAt  i 日目の「その時点で持っている向き」を返す
 * @param priceAt i 日目の約定価格（乗り換えが起きた日に使う）
 * @param markAt  i 日目の評価に使う価格
 */
function run(rows, sideAt, priceAt, markAt) {
  let cash = CAPITAL, qty = 0, side = null
  const curve = []
  let trades = 0
  for (let i = 1; i < rows.length; i++) {
    const want = sideAt(i)
    if (want !== side) {
      const px = priceAt(i)
      if (px != null && px > 0) {
        if (qty !== 0) { cash += qty * px * (1 - COST); qty = 0; trades++ }
        if (want) { const dir = want === 'bull' ? 1 : -1; qty = (cash * LEV * dir) / px; cash -= qty * px * (1 + COST * Math.sign(Math.abs(qty))); trades++ }
        side = want
      }
    }
    const m = markAt(i)
    curve.push({ d: rows[i].date, e: Math.max(0, cash + qty * (m ?? 0)) })
  }
  let peak = -Infinity, dd = 0
  for (const c of curve) { peak = Math.max(peak, c.e); dd = Math.min(dd, c.e / peak - 1) }
  const yrs = (new Date(curve[curve.length - 1].d) - new Date(curve[0].d)) / (365.25 * 864e5)
  const fin = curve[curve.length - 1].e
  return { cagr: (fin / CAPITAL) ** (1 / yrs) - 1, dd, fin, trades }
}

async function main() {
  const rows = await fetchDaily('%5EN225', 26)
  const nk = computeIndicators(rows)
  const tl = baselineTimeline(nk)
  console.log(`日経225 ${rows[0].date} 〜 ${rows[rows.length - 1].date}（${rows.length}営業日）／ 倍率 ${LEV}倍\n`)

  const close = i => rows[i].close
  const open = i => rows[i].open

  // A) 現行 — D-1 の終値で判断 → D 日の寄りで執行
  const A = run(rows, i => tl[i - 1].side, open, close)
  // B) 後場（15:00 判断 → 引成）— D の終値で判断 → D の終値で執行。🔴 30分ぶんの先読みあり
  const B = run(rows, i => tl[i].side, close, close)
  // C) 後場（保守）— D-1 の終値で判断 → D の終値で執行。先読みゼロだが1日待つ
  const C = run(rows, i => tl[i - 1].side, close, close)

  console.log('  やり方                                       CAGR      最大DD     売買回数   最終資産')
  const line = (l, r) => `  ${(l + ' '.repeat(42)).slice(0, 42)}${pc(r.cagr).padStart(8)}  ${pc(r.dd).padStart(8)}  ${String(r.trades).padStart(7)}   ${yen(r.fin)}`
  console.log(line('A) 現行：前日終値で判断 → 翌日の寄りで執行', A))
  console.log(line('B) 後場：当日15:00判断 → 引成で執行 🔴先読みあり', B))
  console.log(line('C) 後場：前日終値で判断 → 当日の引けで執行', C))

  console.log(`\n  B − A = ${pc(B.cagr - A.cagr)}   （🔴 30分ぶんの先読みを含むので割り引いて読む）`)
  console.log(`  C − A = ${pc(C.cagr - A.cagr)}   （先読みゼロ。判断から執行まで丸1日待つ形）`)
  console.log('\n  🔵 A と C の差は「寄りで建てるか、引けで建てるか」だけ。ここが純粋なタイミングの効果。')
  console.log('  🔴 売買回数がほぼ同じであることを確認すること。増えているならコストで食われる。')
}

main().catch(e => { console.error(e); process.exit(1) })
