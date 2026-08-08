#!/usr/bin/env node
// 金利（米10年債利回り）の変化と、17業種の対TOPIX超過リターンの関係を測る。
//
// 使い方: node scripts/analyze-sector-rate.mjs
//
// 🔴 src/utils/sectorRotation.ts の RATE_SENSITIVITY はこのスクリプトの出力（A の相関列）。
//    指標や期間を変えたら測り直して、あちらの表を更新すること。
//
// 🔵 実測結果（2015-07〜2026-08・2,624営業日／2026-08-08）
//   A) 同時点＝はっきり出た。金利が3か月で±0.25%ポイント動いた局面の対TOPIX超過リターン平均:
//        銀行         金利↑ +7.34% / 金利↓ -3.57%（差10.91・相関 0.484）
//        エネルギー資源 金利↑ +6.73% / 金利↓ -4.87%（差11.60・相関 0.465）
//        食品         金利↑ -3.52% / 金利↓ +1.34%（差-4.86・相関 -0.303）
//      ＝ 教科書どおり。金利は業種株価の外側にあるので、循環していない情報が入る。
//   B) 予測＝弱い。重なりを除いた独立サンプル(各40件・有意の目安 |r|>0.316)で
//      3か月先の相関が閾値を超えたのは 運輸・物流0.540 / 食品0.395 / 電力・ガス0.350 の3件だが、
//      17業種を同時に検定しているため多重検定の補正(閾値≈0.45)をかけると残るのは1件だけ。
//      🔴 「17回引いて1回当たった」と区別がつかない＝**予測には使わない**。
//      🔵 ただし符号の並び（ディフェンシブ＋／景気敏感−）は一貫しており、示唆はある。
//
// 測るのは2つ。
//   A) 同時点 … 同じ3か月のあいだに金利が動いたとき、その業種は相対的に強かったか（＝記述）
//   B) 予測   … 過去3か月の金利変化から、次の1か月/3か月の相対リターンが当てられるか（＝予測）
//
// 🔵 A が出るのは自然（教科書どおりなら出る）。本当の関心は B。

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)', 'Accept': 'application/json' }
const ETF_BASE = 1617, BENCH = '1306.T', RATE = '^TNX'
const WIN = 63              // 金利変化と同時点リターンを測る窓（約3か月）
const FWD = [21, 63]        // 先行きを測る期間
const THRESH = 0.25         // 「金利が動いた」とみなす幅（%ポイント）

const LBL = ['食品','エネルギー資源','建設・資材','素材・化学','医薬品','自動車・輸送機','鉄鋼・非鉄',
  '機械','電機・精密','情報通信・サービスその他','電力・ガス','運輸・物流','商社・卸売','小売',
  '銀行','金融（除く銀行）','不動産']

async function load(sym, guard = true) {
  // 🔵 指数(^TNX)に events=div,split を付けると弾かれることがあるので、株式系だけに付ける。
  //    レート制限も踏むので数回リトライする。
  const ev = sym.startsWith('^') ? '' : '&events=div,split'
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=15y${ev}`
  let r = null
  for (let attempt = 1; attempt <= 4 && !r; attempt++) {
    try {
      const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) })
      const j = await res.json()
      r = j?.chart?.result?.[0] ?? null
      if (!r) throw new Error(`HTTP ${res.status} / ${JSON.stringify(j).slice(0, 120)}`)
    } catch (e) {
      if (attempt === 4) throw new Error(`${sym}: ${e.message}`)
      await new Promise(s => setTimeout(s, 1500 * attempt))
    }
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
    if (guard) {   // fetch-jpx.mjs の dropAnomalies と同じ判定
      const w = []
      for (let k = Math.max(0, i - 10); k <= Math.min(raw.length - 1, i + 10); k++) if (k !== i && raw[k].v != null) w.push(raw[k].v)
      if (w.length >= 5) { w.sort((a, b) => a - b); if (Math.abs(raw[i].v / w[Math.floor(w.length / 2)] - 1) > 0.35) continue }
    }
    m.set(raw[i].d, raw[i].v)
  }
  return m
}

const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN
function corr(x, y) {
  const mx = mean(x), my = mean(y)
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < x.length; i++) { const a = x[i] - mx, b = y[i] - my; sxy += a * b; sxx += a * a; syy += b * b }
  return sxy / Math.sqrt(sxx * syy)
}

const rate = await load(RATE, false)   // 利回りは価格でないのでスパイク判定をかけない
const bench = await load(BENCH)
const sec = {}
for (let n = 1; n <= 17; n++) sec[n] = await load(`${ETF_BASE + n - 1}.T`)

const dates = [...bench.keys()]
  .filter(d => rate.has(d) && Object.values(sec).every(m => m.has(d)))
  .sort()
console.log(`共通営業日 ${dates.length}日（${dates[0]} → ${dates.at(-1)}）`)
console.log(`金利=${RATE} / 窓=${WIN}営業日 / 「動いた」判定=±${THRESH}%ポイント\n`)

const rows = []
for (let n = 1; n <= 17; n++) {
  const dR = [], exNow = [], exF = { 21: [], 63: [] }
  const up = [], down = []
  for (let i = WIN; i < dates.length; i++) {
    const r0 = rate.get(dates[i - WIN]), r1 = rate.get(dates[i])
    const s0 = sec[n].get(dates[i - WIN]), s1 = sec[n].get(dates[i])
    const b0 = bench.get(dates[i - WIN]), b1 = bench.get(dates[i])
    const dr = r1 - r0
    const ex = ((s1 / s0) - (b1 / b0)) * 100
    dR.push(dr); exNow.push(ex)
    if (dr >= THRESH) up.push(ex); else if (dr <= -THRESH) down.push(ex)
    for (const h of FWD) {
      if (i + h >= dates.length) continue
      const sf = sec[n].get(dates[i + h]) / sec[n].get(dates[i])
      const bf = bench.get(dates[i + h]) / bench.get(dates[i])
      exF[h].push({ dr, ex: (sf - bf) * 100 })
    }
  }
  rows.push({
    n, label: LBL[n - 1],
    cNow: corr(dR, exNow),
    up: mean(up), down: mean(down), diff: mean(up) - mean(down),
    c21: corr(exF[21].map(o => o.dr), exF[21].map(o => o.ex)),
    c63: corr(exF[63].map(o => o.dr), exF[63].map(o => o.ex)),
    nUp: up.length, nDown: down.length,
  })
}

console.log('=== A) 同時点：金利が動いた3か月に、その業種は相対的にどうだったか ===')
console.log('（金利上昇期／低下期それぞれの、3か月の対TOPIX超過リターンの平均）\n')
console.log('業種                 金利↑期   金利↓期    差      相関')
for (const r of [...rows].sort((a, b) => b.diff - a.diff)) {
  console.log(`${r.label.padEnd(20)}${r.up.toFixed(2).padStart(7)}% ${r.down.toFixed(2).padStart(7)}% ${r.diff.toFixed(2).padStart(7)} ${r.cNow.toFixed(3).padStart(7)}`)
}
console.log(`\n（金利上昇期 ${rows[0].nUp}日 / 低下期 ${rows[0].nDown}日）`)

console.log('\n=== B) 予測：過去3か月の金利変化 → その後の対TOPIX超過リターンの相関 ===')
console.log('業種                  1か月先   3か月先')
for (const r of [...rows].sort((a, b) => b.c63 - a.c63)) {
  console.log(`${r.label.padEnd(20)}${r.c21.toFixed(3).padStart(8)} ${r.c63.toFixed(3).padStart(9)}`)
}
console.log('\n🔵 相関は -1〜+1。|0.1| を下回るなら実用上ほぼ無関係。')

// ── 重なりを除いた検証（63営業日ごとに1件だけ拾う）───────────────
// 🔴 上の相関は窓が重なった観測を延べで数えているので独立でない。
//    63日おきに間引いて、独立サンプルだけで測り直す。
console.log('\n=== B\') 重なりを除いた予測相関（63営業日おきに1件・独立サンプル）===')
console.log('業種                  1か月先   3か月先   件数')
const indep = []
for (let n = 1; n <= 17; n++) {
  const pick = { 21: { x: [], y: [] }, 63: { x: [], y: [] } }
  for (let i = WIN; i < dates.length; i += WIN) {
    const dr = rate.get(dates[i]) - rate.get(dates[i - WIN])
    for (const h of FWD) {
      if (i + h >= dates.length) continue
      const sf = sec[n].get(dates[i + h]) / sec[n].get(dates[i])
      const bf = bench.get(dates[i + h]) / bench.get(dates[i])
      pick[h].x.push(dr); pick[h].y.push((sf - bf) * 100)
    }
  }
  indep.push({ label: LBL[n - 1], c21: corr(pick[21].x, pick[21].y), c63: corr(pick[63].x, pick[63].y), n: pick[63].x.length })
}
for (const r of indep.sort((a, b) => b.c63 - a.c63)) {
  console.log(`${r.label.padEnd(20)}${r.c21.toFixed(3).padStart(8)} ${r.c63.toFixed(3).padStart(9)}${String(r.n).padStart(7)}`)
}
console.log(`\n🔴 この件数だと、相関が偶然 ±0.3 程度になることは珍しくない（目安: |r| > 2/√n で有意）。`)
