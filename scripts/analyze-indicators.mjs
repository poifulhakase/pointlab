#!/usr/bin/env node
// テクニカル指標をまとめて測って決着をつける（R&D・2026-08-11）
//
// 🔴 なぜ一度にやるか＝1つずつ足すと「次はRSIはどうか」が延々続く。
//    定番を横並びで測り、**効かないものをまとめて捨てる**ほうが早い。
//
// 🔴 期待は低い。MACD もボリンジャーも RSI も**価格から作った変数**で、
//    すでに渡している移動平均乖離・高安・レンジ内位置と強く相関する。
//    今日 TOPIX が相関0.95で無効だったのと同じ構造になりやすい。
//    それでも測れば「駄目」と確定できるので、推測で持ち続けるより良い。
//
// 🔴 採否の基準（先に決めておく。数字を見てから動かさない）:
//      ① 全期間で |t| >= 2
//      ② 前半・後半で**符号が一致**（片方だけならただの偶然）
//      この2つを満たしたものだけ、次の段階（実際のバックテスト）へ進める。
//
// 🔴 結果（26年）＝**8指標とも不合格**。しかも落ち方が同じだった。
//    この先20日の t（全期間 / 前半 / 後半）:
//      MACDヒストグラム  -2.39 / +0.28 / -3.35     MACD本体   +0.82 / +3.21 / -3.38
//      RSI(14)          +0.20 / +2.75 / -3.86     %B(20,2)  -1.07 / +2.16 / -4.48
//      ストキャス %K     -1.24 / +1.23 / -4.42     25日線乖離 -1.01 / +1.91 / -4.16
//    🔴 6つ全部が**前半と後半で符号が反転**。2000-2013は逆張りが効き、2013-以降は順張りが効く。
//       オシレーター系はこの地合いの違いをそのまま浴びるので、どちらか一方でしか効かない。
//    🔴 全部が同じ動き方なのは、**MACDもRSIもボリンジャーもストキャスも、結局「25日線乖離」を
//       別の式で書いているだけ**だから。対照に並べた25日線乖離が同じ挙動を示したのが証拠。
//    🔵 テクニカル指標群はこれで決着。個別に足していく価値はない。
//
// 使い方: node scripts/analyze-indicators.mjs

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }

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
      low: q.low[i] ?? q.close[i], close: q.close[i], volume: q.volume?.[i] ?? null,
    })
  })
  return out
}

// ── 指標 ──────────────────────────────────────────────────────────────────
const ema = (arr, n) => {
  const k = 2 / (n + 1)
  const out = new Array(arr.length).fill(null)
  let prev = null
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] == null) continue
    prev = prev == null ? arr[i] : arr[i] * k + prev * (1 - k)
    out[i] = prev
  }
  return out
}
const smaArr = (arr, n) => {
  const out = new Array(arr.length).fill(null)
  let s = 0
  for (let i = 0; i < arr.length; i++) {
    s += arr[i]
    if (i >= n) s -= arr[i - n]
    if (i >= n - 1) out[i] = s / n
  }
  return out
}

function build(rows) {
  const c = rows.map(r => r.close)
  const e12 = ema(c, 12), e26 = ema(c, 26)
  const macd = c.map((_, i) => (e12[i] != null && e26[i] != null ? e12[i] - e26[i] : null))
  const signal = ema(macd.map(v => v ?? 0), 9)
  const hist = macd.map((v, i) => (v != null ? v - signal[i] : null))

  // RSI(14)
  const rsi = new Array(rows.length).fill(null)
  let ag = 0, al = 0
  for (let i = 1; i < rows.length; i++) {
    const d = c[i] - c[i - 1]
    const g = Math.max(0, d), l = Math.max(0, -d)
    if (i <= 14) { ag += g / 14; al += l / 14; if (i === 14) rsi[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al) }
    else { ag = (ag * 13 + g) / 14; al = (al * 13 + l) / 14; rsi[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al) }
  }

  // ボリンジャー %B（20,2）
  const ma20 = smaArr(c, 20)
  const pctB = new Array(rows.length).fill(null)
  for (let i = 19; i < rows.length; i++) {
    const w = c.slice(i - 19, i + 1)
    const s = sd(w)
    if (!s) continue
    const up = ma20[i] + 2 * s, lo = ma20[i] - 2 * s
    pctB[i] = (c[i] - lo) / (up - lo)
  }

  // ストキャスティクス %K(14)
  const stoch = new Array(rows.length).fill(null)
  for (let i = 13; i < rows.length; i++) {
    let hi = -Infinity, lo = Infinity
    for (let k = 0; k < 14; k++) { hi = Math.max(hi, rows[i - k].high); lo = Math.min(lo, rows[i - k].low) }
    if (hi > lo) stoch[i] = ((c[i] - lo) / (hi - lo)) * 100
  }

  // 出来高比（20日平均比）
  const vol = rows.map(r => r.volume ?? null)
  const hasVol = vol.filter(v => v != null && v > 0).length > rows.length * 0.5
  const vma = hasVol ? smaArr(vol.map(v => v ?? 0), 20) : null
  const volRatio = hasVol ? vol.map((v, i) => (v != null && vma[i] ? v / vma[i] : null)) : new Array(rows.length).fill(null)

  return { hist, macd, rsi, pctB, stoch, volRatio, hasVol, ma20 }
}

/** 3等分して高−低の差と t 値を返す */
function tstat(pairs) {
  const v = pairs.filter(p => p.x != null && p.y != null && Number.isFinite(p.x))
  if (v.length < 300) return null
  const s = [...v].sort((a, b) => a.x - b.x)
  const c = Math.floor(s.length / 3)
  const lo = s.slice(0, c).map(p => p.y), hi = s.slice(s.length - c).map(p => p.y)
  const diff = mean(hi) - mean(lo)
  const err = Math.sqrt(se(lo) ** 2 + se(hi) ** 2)
  return { diff, t: err ? diff / err : 0, n: v.length }
}

async function main() {
  const rows = await fetchDaily('%5EN225', 26)
  const ind = build(rows)
  console.log(`日経225 ${rows[0].date} 〜 ${rows[rows.length - 1].date}（${rows.length}営業日）`)
  console.log(`出来高: ${ind.hasVol ? 'あり' : '🔴 取れないので出来高系は測れない'}\n`)

  const half = Math.floor(rows.length / 2)
  const FEATURES = [
    ['MACDヒストグラム', i => ind.hist[i]],
    ['MACDヒストグラムの変化', i => (ind.hist[i] != null && ind.hist[i - 1] != null ? ind.hist[i] - ind.hist[i - 1] : null)],
    ['MACD本体', i => ind.macd[i]],
    ['RSI(14)', i => ind.rsi[i]],
    ['ボリンジャー %B(20,2)', i => ind.pctB[i]],
    ['ストキャス %K(14)', i => ind.stoch[i]],
    ['出来高比(20日平均比)', i => ind.volRatio[i]],
    ['（対照）25日線乖離', i => (ind.ma20[i] ? (rows[i].close - ind.ma20[i]) / ind.ma20[i] : null)],
  ]

  for (const h of [5, 20]) {
    console.log(`── この先${h}日のリターン ──`)
    console.log('  指標                        全期間の差      t      前半t    後半t    判定')
    for (const [label, get] of FEATURES) {
      const mk = (a, b) => {
        const p = []
        for (let i = Math.max(a, 30); i < b - h; i++) p.push({ x: get(i), y: rows[i + h].close / rows[i].close - 1 })
        return tstat(p)
      }
      const all = mk(0, rows.length)
      if (!all) { console.log(`  ${(label + ' '.repeat(26)).slice(0, 26)}測れず`); continue }
      const f = mk(0, half), s = mk(half, rows.length)
      const sameSign = f && s && Math.sign(f.t) === Math.sign(s.t)
      const pass = Math.abs(all.t) >= 2 && sameSign
      console.log(`  ${(label + ' '.repeat(26)).slice(0, 26)}${((all.diff * 100).toFixed(2) + '%').padStart(8)}  ${all.t.toFixed(2).padStart(7)}  ${(f ? f.t.toFixed(2) : '—').padStart(7)}  ${(s ? s.t.toFixed(2) : '—').padStart(7)}   ${pass ? '🔵 候補' : '←'}`)
    }
    console.log('')
  }

  console.log('🔴 判定は「全期間 |t|>=2 かつ 前後半で符号が一致」。基準は測る前に決めてある。')
  console.log('🔴 候補が出ても、次は必ず実際のバックテストで確かめること。')
  console.log('   今日の抵抗線の検証では、日次 t=-3.52 が出たのにバックテストでは全部悪化した')
  console.log('   （ドンチャンは高値の近くでしか発火しないので、抵抗を避けるとエントリーが消える）。')
}

main().catch(e => { console.error(e); process.exit(1) })
