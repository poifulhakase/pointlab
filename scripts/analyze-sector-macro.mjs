#!/usr/bin/env node
// 金利 × 期待インフレ の向きだけで4局面を決める（業種の騰落率を一切使わない）。
// この方式を **円環の「現在地」として本採用**した（2026-08-08）。その根拠を測るスクリプト。
//
// 使い方: node scripts/analyze-sector-macro.mjs
//
// 🔵 実測結果（2015-07〜2026-08・判定できた1,745日）
//   ── 安定性（カッコ内は「一致度だけ」の旧方式）
//     局面が入れ替わった日   4.1%（21.6%）
//     続いた期間の中央値     8営業日（2営業日）／最長 149営業日=7.1か月（2.8か月）
//     循環の順番どおりの遷移 41.7%（35.6%・偶然33.3%）
//     ＝ 「ほぼ毎日入れ替わる」問題が構造的に解消した。
//   ── 🔴 業種の裏づけは4局面中2つだけ（その後1か月の対TOPIX超過・教科書の業種 − それ以外）
//     逆金融相場 +0.92 ✓ ／ 金融相場 +0.32 ✓ ／ 業績相場 -0.58 ✗ ／ 逆業績相場 -0.83 ✗
//     業績相場(11%)と逆業績相場(8%)は該当日が少なく、教科書と逆に出ている。
//     🔴 だから **現在地の表示にだけ使う。「この局面だからこの業種が上がる」とは書かない。**
//
// 🔴 閾値（RATE_TH / INFL_TH）を変えたら測り直し、sectorRotation.ts の
//    MACRO_RATE_THRESHOLD / MACRO_INFL_THRESHOLD も合わせること。
//
//   金利↓ インフレ↓ = 金融相場   / 金利↑ インフレ↓ = 業績相場
//   金利↑ インフレ↑ = 逆金融相場 / 金利↓ インフレ↑ = 逆業績相場
//   （Merrill の Investment Clock と同じ並び。この順に一周する）
//
// 🔴 決定的な検証点＝各局面で、教科書が「強い」とする業種が実際に強かったか。
//    ここが出なければ、きれいな枠組みでも中身が無い。

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)', 'Accept': 'application/json' }
const PHASES = {
  financial:          { label: '金融相場',   sectors: [9, 10, 16, 17] },
  performance:        { label: '業績相場',   sectors: [3, 4, 6, 7, 8, 12] },
  reverseFinancial:   { label: '逆金融相場', sectors: [2, 13, 15] },
  reversePerformance: { label: '逆業績相場', sectors: [1, 5, 11, 14] },
}
const ORDER = ['financial', 'performance', 'reverseFinancial', 'reversePerformance']
const LBL = ['食品','エネルギー資源','建設・資材','素材・化学','医薬品','自動車・輸送機','鉄鋼・非鉄',
  '機械','電機・精密','情報通信・サービスその他','電力・ガス','運輸・物流','商社・卸売','小売',
  '銀行','金融（除く銀行）','不動産']

const WIN = 63           // 金利・インフレの方向を測る窓（約3か月）
const FWD = 21           // その後どうだったかを測る期間（約1か月）
const RATE_TH = 0.10     // 「動いた」とみなす幅（%ポイント）。0なら微差でも向きを決めてしまう
const INFL_TH = 0.05
const ETF_BASE = 1617

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

/** FRED の CSV（APIキー不要）。欠損は "." で入っている */
async function loadFred(id) {
  const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`, { headers: UA, signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`FRED ${id}: HTTP ${res.status}`)
  const m = new Map()
  for (const line of (await res.text()).trim().split('\n').slice(1)) {
    const [d, v] = line.split(',')
    const n = Number(v)
    if (!v || v === '.' || isNaN(n)) continue
    m.set(d, n)
  }
  return m
}

const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN
const med  = a => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)] }

const rate  = await loadYahoo('^TNX', false)
const infl  = await loadFred('T10YIE')
const bench = await loadYahoo('1306.T')
const sec = {}
for (let n = 1; n <= 17; n++) sec[n] = await loadYahoo(`${ETF_BASE + n - 1}.T`)

const dates = [...bench.keys()]
  .filter(d => rate.has(d) && infl.has(d) && Object.values(sec).every(m => m.has(d)))
  .sort()
console.log(`共通営業日 ${dates.length}日（${dates[0]} → ${dates.at(-1)}）`)
console.log(`方向の窓=${WIN}日(約3か月) / 判定幅 金利±${RATE_TH} インフレ±${INFL_TH}%ポイント\n`)

const marks = []
for (let i = WIN; i < dates.length; i++) {
  const dr = rate.get(dates[i]) - rate.get(dates[i - WIN])
  const di = infl.get(dates[i]) - infl.get(dates[i - WIN])
  if (Math.abs(dr) < RATE_TH || Math.abs(di) < INFL_TH) continue   // どちらかが横ばいの日は判定しない
  const id = dr > 0 ? (di > 0 ? 'reverseFinancial' : 'performance')
                    : (di > 0 ? 'reversePerformance' : 'financial')
  marks.push({ d: dates[i], i, id })
}
console.log(`判定できた日: ${marks.length}日（横ばいで判定しなかった日は除外）\n`)

// ── 安定性と循環 ─────────────────────────────────────
let changed = 0, fwd = 0, other = 0
const runs = []; let cur = 1
for (let k = 1; k < marks.length; k++) {
  if (marks[k].id === marks[k - 1].id) { cur++; continue }
  runs.push(cur); cur = 1; changed++
  const f = ORDER.indexOf(marks[k - 1].id), t = ORDER.indexOf(marks[k].id)
  if ((f + 1) % 4 === t) fwd++; else other++
}
runs.push(cur)
console.log('=== 安定性（比較: 一致度だけの方式は 入れ替わり21.6% / 中央値2営業日 / 循環35.6%）===')
console.log(`  局面が入れ替わった日   : ${changed}日 / ${marks.length - 1}日 = ${(changed / (marks.length - 1) * 100).toFixed(1)}%`)
console.log(`  同じ局面が続いた中央値 : ${med(runs)}営業日（${(med(runs) / 21).toFixed(1)}か月）／ 最長 ${Math.max(...runs)}営業日（${(Math.max(...runs) / 21).toFixed(1)}か月）`)
console.log(`  循環の順番どおりの遷移 : ${fwd}/${fwd + other} = ${(fwd / (fwd + other) * 100).toFixed(1)}%（偶然なら33.3%）`)
const cnt = {}
for (const m of marks) cnt[m.id] = (cnt[m.id] ?? 0) + 1
console.log(`  局面の内訳             : ${ORDER.map(id => `${PHASES[id].label} ${((cnt[id] ?? 0) / marks.length * 100).toFixed(0)}%`).join(' / ')}\n`)

// ── 🔴 本題：各局面で教科書の業種が実際に強かったか ──────────
const bySector = {}
for (const id of ORDER) bySector[id] = {}
for (const m of marks) {
  if (m.i + FWD >= dates.length) continue
  for (let n = 1; n <= 17; n++) {
    const sf = sec[n].get(dates[m.i + FWD]) / sec[n].get(dates[m.i])
    const bf = bench.get(dates[m.i + FWD]) / bench.get(dates[m.i])
    ;(bySector[m.id][n] ??= []).push((sf - bf) * 100)
  }
}
console.log('=== 🔴 各局面で、教科書が「強い」とする業種は実際に強かったか ===')
console.log('（その後1か月の対TOPIX超過リターン・%）\n')
console.log('局面        教科書の業種  それ以外    差')
for (const id of ORDER) {
  const inSet = PHASES[id].sectors
  const a = [], b = []
  for (let n = 1; n <= 17; n++) {
    const arr = bySector[id][n] ?? []
    if (inSet.includes(n)) a.push(...arr); else b.push(...arr)
  }
  if (!a.length) { console.log(`${PHASES[id].label.padEnd(12)}（該当日なし）`); continue }
  const diff = mean(a) - mean(b)
  console.log(`${PHASES[id].label.padEnd(11)}${mean(a).toFixed(2).padStart(8)}% ${mean(b).toFixed(2).padStart(8)}% ${diff.toFixed(2).padStart(7)} ${diff > 0 ? '✓ 教科書どおり' : '✗ 逆'}`)
}

console.log('\n=== 各局面で実際に強かった業種 上位3（対TOPIX超過・その後1か月）===')
for (const id of ORDER) {
  const arr = []
  for (let n = 1; n <= 17; n++) {
    const v = mean(bySector[id][n] ?? [])
    if (!isNaN(v)) arr.push({ n, v, book: PHASES[id].sectors.includes(n) })
  }
  arr.sort((a, b) => b.v - a.v)
  const top = arr.slice(0, 3).map(x => `${LBL[x.n - 1]}${x.book ? '★' : ''} ${x.v > 0 ? '+' : ''}${x.v.toFixed(1)}%`).join(' / ')
  console.log(`  ${PHASES[id].label.padEnd(8)} ${top}`)
}
console.log('  ★ = 教科書がその局面で強いとしている業種')
