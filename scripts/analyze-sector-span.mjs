#!/usr/bin/env node
// 「型との一致度」の1位が、どれくらいの期間そのままでいるかを実測する。
//
// 使い方: node scripts/analyze-sector-span.mjs
//
// 🔴 なぜ要るか（2026-08-07）
//   セクター画面の円環は「直近1か月の並びが最も近い型」を出しているが、
//   これが**どれくらい安定しているのか**を誰も測っていなかった。
//   教科書では1局面あたり1年強（内閣府の景気基準日付で1循環4〜5年）とされるので、
//   同じ感覚で読まれると誤解を生む。
//
// 🔵 実測結果（2011-08〜2026-08・3,689営業日）
//   1位が続いた期間 = 中央値 2営業日 / 平均 0.2か月 / 入れ替わり 740回
//   1か月以上続いたのは 37回だけ（平均1.3か月・最長2.8か月）
//   ＝ 円環の1位は**ほぼ毎日入れ替わる**。腰の据わった局面判定ではない。
//   この結果は画面のヘルプにも明記してある。指標を変えたら測り直すこと。

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)', 'Accept': 'application/json' }

/** 局面 → TOPIX-17 の業種コード（src/utils/sectorRotation.ts の PHASES と揃えること） */
const PHASES = {
  financial:          { label: '金融相場',   sectors: [9, 10, 16, 17] },
  performance:        { label: '業績相場',   sectors: [3, 4, 6, 7, 8, 12] },
  reverseFinancial:   { label: '逆金融相場', sectors: [2, 13, 15] },
  reversePerformance: { label: '逆業績相場', sectors: [1, 5, 11, 14] },
}

/** 騰落率を測る営業日数（画面と同じ「直近1か月」＝21営業日） */
const BACK  = 21
/** ETFコードは 1617 + (n-1) で17業種に一対一 */
const ETF_BASE = 1617

async function loadSeries() {
  const series = {}
  for (let n = 1; n <= 17; n++) {
    const etf = ETF_BASE + n - 1
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${etf}.T?interval=1d&range=15y&events=div,split`
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) })
    const json = await res.json()
    const r = json?.chart?.result?.[0]
    if (!r) throw new Error(`${etf}: レスポンスが不正`)
    const ts  = r.timestamp ?? []
    const cl  = r.indicators.quote[0].close
    // 🔴 分配金の権利落ちを混ぜないよう調整後終値を使う（画面側と同じ）
    const adj = r.indicators.adjclose?.[0]?.adjclose
    const m = new Map()
    for (let i = 0; i < ts.length; i++) {
      const v = adj?.[i] ?? cl[i]
      if (v == null || isNaN(v)) continue
      m.set(new Date(ts[i] * 1000).toISOString().slice(0, 10), v)
    }
    series[n] = m
  }
  return series
}

/** その日の各局面の一致度（src の phaseFits と同じ計算） */
function fitScores(series, dates, i) {
  const perf = []
  for (let n = 1; n <= 17; n++) {
    const a = series[n].get(dates[i])
    const b = series[n].get(dates[i - BACK])
    perf.push({ n, v: (a - b) / b })
  }
  perf.sort((x, y) => y.v - x.v)
  const rank = new Map(perf.map((p, idx) => [p.n, idx + 1]))
  const N = 17
  const out = {}
  for (const [id, ph] of Object.entries(PHASES)) {
    const rs = ph.sectors.map(cd => rank.get(cd))
    const k  = rs.length
    const mean  = rs.reduce((s, v) => s + v, 0) / k
    const best  = (k + 1) / 2
    const worst = N - (k - 1) / 2
    out[id] = (worst - mean) / (worst - best) * 100
  }
  return out
}

const avg = a => a.reduce((s, v) => s + v, 0) / a.length
const med = a => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)] }

async function main() {
  console.log('=== 一致度1位の持続期間を実測 ===')
  const series = await loadSeries()

  // 🔵 全17業種が揃う日だけを使う（1本でも欠けると順位がずれる）
  const dates = [...series[1].keys()]
    .filter(d => Object.values(series).every(m => m.has(d)))
    .sort()
  console.log(`共通営業日 ${dates.length}日（${dates[0]} → ${dates.at(-1)}）`)

  const tops = []
  for (let i = BACK; i < dates.length; i++) {
    const s = fitScores(series, dates, i)
    tops.push({ d: dates[i], t: Object.entries(s).sort((a, b) => b[1] - a[1])[0][0] })
  }

  // 1位が同じ局面で続いた区間（run）に畳む
  const runs = []
  let cur = { t: tops[0].t, from: tops[0].d, n: 1 }
  for (let i = 1; i < tops.length; i++) {
    if (tops[i].t === cur.t) cur.n++
    else { runs.push({ ...cur, to: tops[i - 1].d }); cur = { t: tops[i].t, from: tops[i].d, n: 1 } }
  }
  runs.push({ ...cur, to: tops.at(-1).d })

  const lens = runs.map(r => r.n)
  console.log(`\n区間数 ${runs.length} / 平均 ${avg(lens).toFixed(1)}営業日（${(avg(lens) / 21).toFixed(1)}か月） / 中央値 ${med(lens)}営業日`)
  for (const [id, ph] of Object.entries(PHASES)) {
    const rs = runs.filter(r => r.t === id).map(r => r.n)
    if (!rs.length) continue
    console.log(`  ${ph.label.padEnd(6)} ${String(rs.length).padStart(3)}回 平均${(avg(rs) / 21).toFixed(1)}か月 中央${(med(rs) / 21).toFixed(1)}か月 最長${(Math.max(...rs) / 21).toFixed(1)}か月`)
  }
  const solid = runs.filter(r => r.n >= 21).map(r => r.n)
  console.log(`\n1か月以上続いた区間: ${solid.length}回 / 平均 ${(avg(solid) / 21).toFixed(1)}か月 / 最長 ${(Math.max(...solid) / 21).toFixed(1)}か月`)
}

main().catch(e => { console.error(e); process.exit(1) })
