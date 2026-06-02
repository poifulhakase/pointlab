#!/usr/bin/env node
// MAベースのトレンドゲート/トレンド追随の検証（R&D・コミット対象外想定）
// Yahoo ^N225 日次20年で:
//   ① MAレジーム分類（200日上下・25日/75日の並び＋傾き）が局面をどう分けるか
//   ② 単純MAトレンド追随に値幅エッジがあるか（200日上=ロング保有のリターン）
//   ③ MAクロス/傾きシグナルの単体成績（往復ビンタ込み）
//   ④ 緩衝帯やデュアルMAで往復がどれだけ減るか
// 使い方: node scripts/analyze-ma-trend-gate.mjs

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

async function main() {
  console.log('[fetch] Yahoo ^N225 日次20年...')
  const rows = await fetchDaily()
  console.log(`  → ${rows.length}営業日 (${rows[0].date} 〜 ${rows[rows.length - 1].date})`)

  for (let i = 0; i < rows.length; i++) {
    rows[i].ma25  = sma(rows, i, 25)
    rows[i].ma75  = sma(rows, i, 75)
    rows[i].ma200 = sma(rows, i, 200)
    if (i >= 200 + 20) rows[i].ma200slope = (rows[i].ma200 - rows[i - 20].ma200) / rows[i - 20].ma200 * 100
  }
  const fwd = (i, n) => (i + n < rows.length) ? (rows[i + n].close - rows[i].close) / rows[i].close * 100 : null
  const next1 = i => (i + 1 < rows.length) ? (rows[i + 1].close - rows[i].close) / rows[i].close * 100 : null

  const valid = rows.filter(r => r.ma200 != null && r.ma200slope != null)

  // ── ① レジーム分類（価格 vs 200日 & 200日傾き）＝ 翌日リターンと分布 ──
  console.log('\n========== ① MAレジーム別・翌日リターン（年率の素地）==========')
  const regimes = {
    '上昇(>200日 & 傾き+)':  r => r.close > r.ma200 && r.ma200slope > 0,
    '上だが傾き-(失速)':     r => r.close > r.ma200 && r.ma200slope <= 0,
    '下だが傾き+(回復)':     r => r.close < r.ma200 && r.ma200slope > 0,
    '下落(<200日 & 傾き-)':  r => r.close < r.ma200 && r.ma200slope <= 0,
  }
  console.log('レジーム                 日数   平均翌日%   翌日上昇率   先20日中央%')
  for (const [label, test] of Object.entries(regimes)) {
    const idx = []
    for (let i = 0; i < rows.length; i++) if (valid.includes(rows[i]) && test(rows[i])) idx.push(i)
    const d1 = [], f20 = []; let up = 0
    for (const i of idx) { const a = next1(i); if (a != null) { d1.push(a); if (a > 0) up++ } const e = fwd(i, 20); if (e != null) f20.push(e) }
    const med20 = f20.length ? [...f20].sort((a, b) => a - b)[Math.floor(f20.length / 2)] : null
    console.log(`${label.padEnd(22)} ${String(idx.length).padStart(5)}  ${String(r2(mean(d1))).padStart(8)}  ${String(d1.length?Math.round(up/d1.length*100):0).padStart(8)}%  ${String(r2(med20)).padStart(9)}`)
  }

  // ── ② 単純トレンド追随: 「200日線の上だけロング保有」vs 常時ロング ──
  console.log('\n========== ② トレンド追随の値幅エッジ（200日線フィルター）==========')
  const dailyRets = [], inTrendRets = [], aboveFlags = []
  for (let i = 0; i < rows.length - 1; i++) {
    if (rows[i].ma200 == null) continue
    const ret = next1(i); if (ret == null) continue
    dailyRets.push(ret)
    const above = rows[i].close > rows[i].ma200
    aboveFlags.push(above)
    inTrendRets.push(above ? ret : 0)   // 200日上の時だけ保有・それ以外ノーポジ
  }
  const cum = a => a.reduce((acc, r) => acc * (1 + r / 100), 1)
  const yrs = (rows.length) / 245
  const buyHold = cum(dailyRets), trendOnly = cum(inTrendRets)
  const aboveDays = aboveFlags.filter(Boolean).length
  console.log(`  バイ&ホールド   : 累積 ${r2((buyHold-1)*100)}%  (${r2(yrs)}年 / CAGR ${r2((Math.pow(buyHold,1/yrs)-1)*100)}%)`)
  console.log(`  200日上のみ保有 : 累積 ${r2((trendOnly-1)*100)}%  (CAGR ${r2((Math.pow(trendOnly,1/yrs)-1)*100)}%)  市場滞在 ${Math.round(aboveDays/aboveFlags.length*100)}%`)
  // 上の時/下の時の平均翌日リターン
  const upRets = [], dnRets = []
  for (let k = 0; k < aboveFlags.length; k++) (aboveFlags[k] ? upRets : dnRets).push(dailyRets[k])
  console.log(`  → 200日上の平均翌日 ${r2(mean(upRets))}% / 200日下の平均翌日 ${r2(mean(dnRets))}%  （差がエッジ）`)

  // ── ③ 25/75デュアルMAクロスの往復回数（whipsaw） ──
  console.log('\n========== ③ デュアルMA(25/75)クロスの往復頻度 ==========')
  for (const buf of [0, 0.5, 1.0, 2.0]) {
    let state = 0, flips = 0   // 1=上, -1=下
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].ma25 == null || rows[i].ma75 == null) continue
      const sep = (rows[i].ma25 - rows[i].ma75) / rows[i].ma75 * 100
      let ns = state
      if (sep > buf) ns = 1
      else if (sep < -buf) ns = -1
      if (ns !== state && ns !== 0) { if (state !== 0) flips++; state = ns }
    }
    console.log(`  緩衝帯 ±${buf}% : 切替 ${flips}回 (約 ${r2(flips / yrs)}回/年)`)
  }

  // ── ④ 200日傾きの符号が、先20日の方向をどれだけ当てるか ──
  console.log('\n========== ④ 200日線の傾き符号 → 先20日方向の的中 ==========')
  for (const [lbl, test] of [['傾き+', r => r.ma200slope > 0], ['傾き-', r => r.ma200slope <= 0]]) {
    const idx = []; for (let i = 0; i < rows.length; i++) if (valid.includes(rows[i]) && test(rows[i])) idx.push(i)
    let up = 0, n = 0; const rs = []
    for (const i of idx) { const e = fwd(i, 20); if (e != null) { rs.push(e); n++; if (e > 0) up++ } }
    console.log(`  ${lbl}: n=${n}  先20日上昇率=${n?Math.round(up/n*100):0}%  平均=${r2(mean(rs))}%`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
