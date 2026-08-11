#!/usr/bin/env node
// 価格帯別出来高（ボリュームプロファイル）は効くか（R&D・2026-08-11）
//
// 🔵 これを測る理由＝今日「本物」と確認できた唯一の現象と噛み合うため。
//    「60日高値を**何度も試した**ほど、その先20日が悪い」（t=-3.52・パラメータを振っても
//    12通り中10通りが同符号・前後半でも符号一致）。抵抗は実在する。
//    価格帯別出来高は**それを出来高で測る**もの＝大量に売買された価格帯は多くの人の建値で、
//    そこが抵抗や支持になる、という発想。「試した回数」より情報量が多い。
//
// 🔴 日足の OHLCV しか無いので、各日の出来高を高値〜安値に**一様に配分**して積む近似。
//    ザラ場の実際の分布ではない。それでも「どの価格帯に売買が溜まっているか」の形は出る。
//
// 🔴 採否の基準（測る前に決める。数字を見てから動かさない）:
//      ① 全期間で |t| >= 2  ② 前半・後半で符号が一致
//    両方を満たしたものだけ、実際のバックテストへ進める。
//    🔴 今日の抵抗線の検証では日次 t=-3.52 が出たのにバックテストでは全部悪化した
//       （ドンチャンは高値の近くでしか発火しないので、抵抗を避けるとエントリーが消える）。
//       日次で差が出ても、**この戦略で使えるかは別問題**。
//
// 🔵 結果（26年）＝**「いまいる価格帯の厚さ → この先5日」が唯一の合格**。
//    薄い帯にいると +0.43% / 厚い帯だと +0.07%（高−低 t=-3.45）。
//    厚い帯＝多くの人の建値が集中＝上がれば戻り売り・下がれば買い戻しで押し戻される。
//    薄い帯＝素通りできる。教科書どおりの挙動が実データで出た。
//    頑健性も合格＝窓(120/250/500)×刻み(0.25/0.5/1/2%)の**12通り全部が -3.4〜-4.7**。
//    🔴 弱点＝前半(2000-2013) t=-0.38 でほぼゼロ、後半(2013-) t=-4.77。
//       符号は一致するが**実質的に後半だけの現象**。20日先で見ると前後半で反転する。
//    → 次は実際のバックテストで確かめる（日次で差が出ても使えるとは限らない）。
//
// 使い方: node scripts/analyze-volume-profile.mjs

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }
const WIN = 250        // 何日ぶんの出来高を積むか
const STEP = 0.005     // 価格帯の刻み（0.5%）。桁が3つ違う期間をまたぐので比率で切る
const NEAR = 0.10      // 「上／下」を見る範囲（±10%）

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
      high: q.high[i] ?? q.close[i], low: q.low[i] ?? q.close[i],
      close: q.close[i], volume: q.volume?.[i] ?? 0,
    })
  })
  return out
}

// 価格 → 価格帯の番号（比率で刻む）
const bucketOf = p => Math.round(Math.log(p) / Math.log(1 + STEP))

/**
 * i 日目時点のプロファイル（当日は含めない）から特徴を作る。
 * 🔴 当日を含めると先読みになる。必ず i-1 まで。
 */
function profileFeatures(rows, i) {
  if (i < WIN + 1) return null
  const prof = new Map()
  let total = 0
  for (let k = 1; k <= WIN; k++) {
    const r = rows[i - k]
    if (!r.volume || r.high <= 0 || r.low <= 0) continue
    const b0 = bucketOf(r.low), b1 = bucketOf(r.high)
    const n = Math.max(1, b1 - b0 + 1)
    const per = r.volume / n
    for (let b = b0; b <= b1; b++) { prof.set(b, (prof.get(b) ?? 0) + per); total += per }
  }
  if (total <= 0 || prof.size === 0) return null

  const c = rows[i].close
  const cb = bucketOf(c)
  const upTo = bucketOf(c * (1 + NEAR))
  const dnTo = bucketOf(c * (1 - NEAR))

  let above = 0, below = 0, peak = 0, poc = cb
  for (const [b, v] of prof) {
    if (v > peak) { peak = v; poc = b }
    if (b > cb && b <= upTo) above += v
    if (b < cb && b >= dnTo) below += v
  }
  const atPrice = prof.get(cb) ?? 0
  const pocPrice = Math.pow(1 + STEP, poc)

  return {
    // 🔵 上に出来高が厚い＝多くの人の建値が上にある＝戻り売りが出やすい（抵抗）
    volAbove: above / total,
    // 🔵 下に厚い＝支持
    volBelow: below / total,
    // 上下どちらに偏っているか（1に近いほど上が重い）
    aboveRatio: above + below > 0 ? above / (above + below) : null,
    // 🔵 いまいる価格帯が厚いか（1=最も売買された帯＝HVN／0に近い=LVN＝素通りしやすい）
    atPriceRel: peak > 0 ? atPrice / peak : null,
    // 出来高が最も多い価格帯（POC）までの距離
    distToPOC: (pocPrice - c) / c,
  }
}

function tstat(pairs) {
  const v = pairs.filter(p => p.x != null && p.y != null && Number.isFinite(p.x))
  if (v.length < 300) return null
  const s = [...v].sort((a, b) => a.x - b.x)
  const c = Math.floor(s.length / 3)
  const lo = s.slice(0, c).map(p => p.y), hi = s.slice(s.length - c).map(p => p.y)
  const diff = mean(hi) - mean(lo)
  const err = Math.sqrt(se(lo) ** 2 + se(hi) ** 2)
  return { diff, t: err ? diff / err : 0, n: v.length, loM: mean(lo), hiM: mean(hi) }
}

async function main() {
  const rows = await fetchDaily('%5EN225', 26)
  const hasVol = rows.filter(r => r.volume > 0).length
  console.log(`日経225 ${rows[0].date} 〜 ${rows[rows.length - 1].date}（${rows.length}営業日・出来高あり ${hasVol}日）`)
  console.log(`プロファイル: 過去${WIN}日 / 価格帯の刻み ${(STEP * 100).toFixed(1)}% / 上下を見る範囲 ±${NEAR * 100}%\n`)

  const feats = rows.map((_, i) => profileFeatures(rows, i))
  const half = Math.floor(rows.length / 2)

  const F = [
    ['上に積まれた出来高の割合', f => f.volAbove],
    ['下に積まれた出来高の割合', f => f.volBelow],
    ['上下の偏り（1=上が重い）', f => f.aboveRatio],
    ['いまいる価格帯の厚さ', f => f.atPriceRel],
    ['POCまでの距離', f => f.distToPOC],
  ]

  for (const h of [5, 20]) {
    console.log(`── この先${h}日のリターン ──`)
    console.log('  特徴                        低い側    高い側    高−低      t      前半t    後半t   判定')
    for (const [label, get] of F) {
      const mk = (a, b) => {
        const p = []
        for (let i = Math.max(a, WIN + 1); i < b - h; i++) p.push({ x: feats[i] ? get(feats[i]) : null, y: rows[i + h].close / rows[i].close - 1 })
        return tstat(p)
      }
      const all = mk(0, rows.length)
      if (!all) { console.log(`  ${(label + ' '.repeat(26)).slice(0, 26)}測れず`); continue }
      const f1 = mk(0, half), f2 = mk(half, rows.length)
      const same = f1 && f2 && Math.sign(f1.t) === Math.sign(f2.t)
      const pass = Math.abs(all.t) >= 2 && same
      const p = v => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`
      console.log(`  ${(label + ' '.repeat(26)).slice(0, 26)}${p(all.loM).padStart(8)}  ${p(all.hiM).padStart(8)}  ${p(all.diff).padStart(8)}  ${all.t.toFixed(2).padStart(7)}  ${(f1 ? f1.t.toFixed(2) : '—').padStart(7)}  ${(f2 ? f2.t.toFixed(2) : '—').padStart(6)}  ${pass ? '🔵 候補' : '←'}`)
    }
    console.log('')
  }
  console.log('🔴 候補が出ても、次は実際のバックテストで確かめること（日次の差＝使えるとは限らない）。')
}

main().catch(e => { console.error(e); process.exit(1) })
