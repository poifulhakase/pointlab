#!/usr/bin/env node
// アンカー方式：裏づけが取れた2局面だけを直接判定し、残り2つは背理法＋循環の順序で割り出す。
// **この方式を本採用した**（2026-08-08・ユーザー提案「逆金融相場ではない＝逆業績相場」）。
//
// 使い方: node scripts/analyze-sector-anchor.mjs
//
// 🔵 3方式の比較（2015-07〜2026-08・判定できた1,745日）
//   ┌──────────────┬──────────┬──────────┬──────────────────┐
//   │              │ 記憶なし │ 前進のみ │ アンカー＋背理法 │
//   ├──────────────┼──────────┼──────────┼──────────────────┤
//   │ 入れ替わり   │   4.1%   │   1.3%   │      4.1%        │
//   │ 中央値       │ 8営業日  │ 31営業日 │    8営業日       │
//   │ 循環どおり   │  41.7%   │ 100%(※) │     73.6%        │
//   │ 詰まり       │  なし    │ あり(※2)│     なし         │
//   │ 業種の裏づけ │   2/4    │   2/4    │      3/4         │
//   └──────────────┴──────────┴──────────┴──────────────────┘
//   ※  前進のみの100%は**定義上の当たり前**（前にしか進まないので）＝情報ではない。
//      アンカー方式の73.6%はアンカーが自由に飛べる中での数字＝実質的な情報。
//   ※2 前進のみは金融相場に52%居座る（次の証拠が出ないと動けないため）。
//
// 🔵 業種の裏づけ（その後1か月の対TOPIX超過・教科書の業種 − それ以外）
//     金融相場(アンカー)   +0.32 ✓   逆金融相場(アンカー) +0.92 ✓
//     業績相場(導出)       -0.17 ✗   逆業績相場(導出)     +0.04 ✓（記憶なしでは -0.83 だった）
//   🔴 逆業績相場は「もう間違ってはいない」水準であって「合っている証拠」ではない（ほぼゼロ）。
//   🔴 業績相場は依然マイナスで該当日も5%と少ない。**ここが最も弱い**。
//   ＝ 現在地の表示にだけ使い、「この局面だからこの業種が上がる」とは書かない方針は維持する。
//
//   アンカー（金利とインフレが同じ方向＝金融政策が効いている局面）
//     金利↓ × インフレ↓ = 金融相場
//     金利↑ × インフレ↑ = 逆金融相場
//   移行期（方向が食い違う＝どちらのアンカーでもない）
//     直前のアンカーが金融相場   → 業績相場
//     直前のアンカーが逆金融相場 → 逆業績相場
//
// 🔵 詰まらない（アンカーの象限が出れば必ず復帰する）のが「前進のみ」との違い。

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)', 'Accept': 'application/json' }
const PHASES = {
  financial:          { label: '金融相場',   sectors: [9, 10, 16, 17] },
  performance:        { label: '業績相場',   sectors: [3, 4, 6, 7, 8, 12] },
  reverseFinancial:   { label: '逆金融相場', sectors: [2, 13, 15] },
  reversePerformance: { label: '逆業績相場', sectors: [1, 5, 11, 14] },
}
const ORDER = ['financial', 'performance', 'reverseFinancial', 'reversePerformance']
const NEXT = { financial: 'performance', performance: 'reverseFinancial', reverseFinancial: 'reversePerformance', reversePerformance: 'financial' }
/** アンカーの次に来る移行期 */
const AFTER = { financial: 'performance', reverseFinancial: 'reversePerformance' }

const WIN = 63, FWD = 21, RATE_TH = 0.10, INFL_TH = 0.05, ETF_BASE = 1617, BACK_FIT = 21

async function loadYahoo(sym, guard = true) {
  const ev = sym.startsWith('^') ? '' : '&events=div,split'
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=15y${ev}`
  let r = null
  for (let a = 1; a <= 4 && !r; a++) {
    try {
      const j = await (await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) })).json()
      r = j?.chart?.result?.[0] ?? null
      if (!r) throw new Error('result なし')
    } catch (e) { if (a === 4) throw new Error(`${sym}: ${e.message}`); await new Promise(s => setTimeout(s, 1500 * a)) }
  }
  const ts = r.timestamp ?? [], cl = r.indicators.quote[0].close ?? []
  const adj = r.indicators.adjclose?.[0]?.adjclose
  const raw = []
  for (let i = 0; i < ts.length; i++) {
    const v = adj?.[i] ?? cl[i]
    raw.push({ d: new Date(ts[i] * 1000).toISOString().slice(0, 10), v: (v == null || isNaN(v) || v <= 0) ? null : v })
  }
  const m = new Map()
  for (let i = 0; i < raw.length; i++) {
    if (raw[i].v == null) continue
    if (guard) {
      const w = []
      for (let k = Math.max(0, i - 10); k <= Math.min(raw.length - 1, i + 10); k++) if (k !== i && raw[k].v != null) w.push(raw[k].v)
      if (w.length >= 5) { w.sort((a, b) => a - b); if (Math.abs(raw[i].v / w[Math.floor(w.length / 2)] - 1) > 0.35) continue }
    }
    m.set(raw[i].d, raw[i].v)
  }
  return m
}
async function loadFred(id) {
  const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`, { headers: UA, signal: AbortSignal.timeout(30000) })
  const m = new Map()
  for (const line of (await res.text()).trim().split('\n').slice(1)) {
    const [d, v] = line.split(','); const n = Number(v)
    if (!v || v === '.' || isNaN(n) || n <= 0) continue
    m.set(d, n)
  }
  return m
}
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN
const med  = a => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)] }

const rate = await loadYahoo('^TNX', false)
const infl = await loadFred('T10YIE')
const bench = await loadYahoo('1306.T')
const sec = {}
for (let n = 1; n <= 17; n++) sec[n] = await loadYahoo(`${ETF_BASE + n - 1}.T`)

const dates = [...bench.keys()].filter(d => rate.has(d) && infl.has(d) && Object.values(sec).every(m => m.has(d))).sort()
console.log(`共通営業日 ${dates.length}日（${dates[0]} → ${dates.at(-1)}）\n`)

function fitTop(i) {
  const perf = []
  for (let n = 1; n <= 17; n++) perf.push({ n, v: (sec[n].get(dates[i]) - sec[n].get(dates[i - BACK_FIT])) / sec[n].get(dates[i - BACK_FIT]) })
  perf.sort((x, y) => y.v - x.v)
  const rank = new Map(perf.map((p, idx) => [p.n, idx + 1]))
  let best = null
  for (const [id, ph] of Object.entries(PHASES)) {
    const rs = ph.sectors.map(cd => rank.get(cd)), k = rs.length, N = 17
    const m = rs.reduce((s, v) => s + v, 0) / k
    const bst = (k + 1) / 2, wst = N - (k - 1) / 2
    const score = (wst - m) / (wst - bst) * 100
    if (!best || score > best.score) best = { id, score }
  }
  return best
}

const rows = []
let fwdState = null, lastAnchor = null
for (let i = WIN; i < dates.length; i++) {
  const dr = rate.get(dates[i]) - rate.get(dates[i - WIN])
  const di = infl.get(dates[i]) - infl.get(dates[i - WIN])
  let quad = null
  if (Math.abs(dr) >= RATE_TH && Math.abs(di) >= INFL_TH) {
    quad = dr > 0 ? (di > 0 ? 'reverseFinancial' : 'performance')
                  : (di > 0 ? 'reversePerformance' : 'financial')
  }
  if (quad) {
    if (fwdState == null) fwdState = quad
    else if (quad === NEXT[fwdState]) fwdState = quad
    if (AFTER[quad]) lastAnchor = quad          // アンカーに来たら更新
  }
  const anchor = quad == null ? null
    : (AFTER[quad] ? quad : (lastAnchor ? AFTER[lastAnchor] : quad))
  rows.push({ i, d: dates[i], quad, fwd: fwdState, anchor, fit: fitTop(i) })
}
const valid = rows.filter(r => r.quad && r.fwd && r.anchor)
console.log(`判定できた日: ${valid.length}日\n`)

function stats(key, name) {
  let changed = 0, f = 0, o = 0
  const runs = []; let cur = 1
  for (let k = 1; k < valid.length; k++) {
    if (valid[k][key] === valid[k - 1][key]) { cur++; continue }
    runs.push(cur); cur = 1; changed++
    const a = ORDER.indexOf(valid[k - 1][key]), b = ORDER.indexOf(valid[k][key])
    if ((a + 1) % 4 === b) f++; else o++
  }
  runs.push(cur)
  const cnt = {}
  for (const x of valid) cnt[x[key]] = (cnt[x[key]] ?? 0) + 1
  console.log(`── ${name} ──`)
  console.log(`  入れ替わった日     : ${(changed / (valid.length - 1) * 100).toFixed(1)}%`)
  console.log(`  続いた期間の中央値 : ${med(runs)}営業日（${(med(runs) / 21).toFixed(1)}か月）／最長 ${(Math.max(...runs) / 21).toFixed(1)}か月`)
  console.log(`  循環の順番どおり   : ${f}/${f + o} = ${((f / (f + o)) * 100).toFixed(1)}%`)
  console.log(`  内訳               : ${ORDER.map(id => `${PHASES[id].label} ${((cnt[id] ?? 0) / valid.length * 100).toFixed(0)}%`).join(' / ')}`)
  console.log()
}
stats('quad',   '記憶なし（いまの実装）')
stats('fwd',    '前進のみ')
stats('anchor', 'アンカー＋背理法（提案）')

function backing(key, name) {
  const by = {}
  for (const id of ORDER) by[id] = { a: [], b: [] }
  for (const r of valid) {
    if (r.i + FWD >= dates.length) continue
    const id = r[key], inSet = PHASES[id].sectors
    for (let n = 1; n <= 17; n++) {
      const sf = sec[n].get(dates[r.i + FWD]) / sec[n].get(dates[r.i])
      const bf = bench.get(dates[r.i + FWD]) / bench.get(dates[r.i])
      ;(inSet.includes(n) ? by[id].a : by[id].b).push((sf - bf) * 100)
    }
  }
  console.log(`── ${name} ──`)
  for (const id of ORDER) {
    const { a, b } = by[id]
    if (!a.length) { console.log(`  ${PHASES[id].label.padEnd(10)}（該当日なし）`); continue }
    const diff = mean(a) - mean(b)
    console.log(`  ${PHASES[id].label.padEnd(9)}${mean(a).toFixed(2).padStart(8)}% ${mean(b).toFixed(2).padStart(8)}% ${diff.toFixed(2).padStart(7)} ${diff > 0 ? '✓' : '✗'}`)
  }
  console.log()
}
console.log('=== 🔴 各局面で、教科書の業種が実際に強かったか（その後1か月・対TOPIX超過）===')
console.log('   局面        教科書の業種  それ以外    差\n')
backing('quad',   '記憶なし')
backing('fwd',    '前進のみ')
backing('anchor', 'アンカー＋背理法')

const last = rows.at(-1)
console.log(`直近（${last.d}）:`)
console.log(`  記憶なし        = ${PHASES[last.quad]?.label ?? '判定なし'}`)
console.log(`  前進のみ        = ${PHASES[last.fwd]?.label}`)
console.log(`  アンカー＋背理法 = ${PHASES[last.anchor]?.label}`)
console.log(`  一致度1位       = ${PHASES[last.fit.id].label}（${last.fit.score.toFixed(1)}）`)
