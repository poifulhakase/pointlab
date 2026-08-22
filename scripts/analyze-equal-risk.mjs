#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────
// 同じリスク（最大DD）に揃えたとき、どれがいちばん増えるか（2026-08-22）
//
// 🔴 なぜ揃えるか＝出番を絞るフィルタは、素で比べると**必ず**累計が下がる（建てている
//    時間が短いため）。それで「効かない」と結論すると読み違える。
//    正しい問いは「**同じドローダウンに揃えたとき、どちらが多く増えるか**」。
//    （この比べ方は analyze-vol-targeting.mjs・2026-08-11 で確立したもの）
//
// やり方＝各ルールの日次リターンに一定の倍率をかけ、**最大DDが基準（常にロング）と
//         同じ**になる倍率を二分探索で求めて、そのときの累計・CAGRを比べる。
//
// 🔵 コスト・借入金利・ETFの経費率は入れていない。倍率が高い案ほど実運用では不利になる。
// 🔴 過去のDDに合わせているだけで、将来同じDDに収まる保証はない（後知恵の当てはめ）。
//
// 使い方: node scripts/analyze-equal-risk.mjs
// ──────────────────────────────────────────────────────────────────────────

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }
const YEARS = 20
const P2 = Math.floor(Date.now() / 1000)
const P1 = P2 - Math.round(YEARS * 366 * 86400) - 400 * 86400
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100)

async function get(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?period1=${P1}&period2=${P2}&interval=1d`
  const x = (await (await fetch(url, { headers: UA, signal: AbortSignal.timeout(60000) })).json())?.chart?.result?.[0]
  if (!x) throw new Error('no data: ' + sym)
  if (x.meta?.dataGranularity !== '1d') throw new Error('日足でない: ' + x.meta?.dataGranularity)
  const q = x.indicators.quote[0], m = new Map()
  x.timestamp.forEach((t, i) => {
    if (q.close[i] != null) m.set(new Date(t * 1000).toISOString().slice(0, 10), { o: q.open[i], c: q.close[i], h: q.high[i], l: q.low[i] })
  })
  return m
}

const [nk, spx, vix] = await Promise.all([get('%5EN225'), get('%5EGSPC'), get('%5EVIX')])
const days = [...nk.keys()].sort()
const closes = days.map(d => nk.get(d).c)
const sma = (n, i) => (i + 1 < n ? null : closes.slice(i + 1 - n, i + 1).reduce((s, v) => s + v, 0) / n)
const lastBefore = (m, d) => { const ks = [...m.keys()].filter(k => k < d).sort(); return ks.length ? ks[ks.length - 1] : null }

const rows = []
for (let i = 200; i < days.length - 1; i++) {
  const d = days[i]
  const ku = lastBefore(spx, d), kv = lastBefore(vix, d)
  if (!ku || !kv) continue
  const usKeys = [...spx.keys()].filter(k => k < d).sort()
  if (usKeys.length < 2) continue
  const us = spx.get(usKeys[usKeys.length - 1]).c / spx.get(usKeys[usKeys.length - 2]).c - 1
  const ma25 = sma(25, i), ma200 = sma(200, i)
  rows.push({
    d,
    us, vix: vix.get(kv).c,
    jp: closes[i] / closes[i - 1] - 1,
    dev25: ma25 ? (closes[i] / ma25 - 1) * 100 : null,
    aboveMa200: ma200 ? closes[i] > ma200 : null,
    ret5: (closes[i] / closes[i - 5] - 1) * 100,
    next: (closes[i + 1] / closes[i] - 1) * 100,
  })
}

const RULES = [
  { key: 'base',      label: '常にロング（基準）',                          f: () => 1 },
  { key: 'vix20',     label: 'VIX<20 の日だけロング',                       f: (r) => (r.vix < 20 ? 1 : 0) },
  { key: 'us_down',   label: '前夜の米国が下げた翌日だけロング',             f: (r) => (r.us < 0 ? 1 : 0) },
  { key: 'unfilled',  label: '米国が上げたのに日本が下げた日だけロング',      f: (r) => (r.us > 0 && r.jp < 0 ? 1 : 0) },
  { key: 'rev5',      label: '5日で下げていたらロング／上げていたらショート', f: (r) => (r.ret5 < 0 ? 1 : -1) },
  { key: 'trend_dip', label: '200日線の上×25日線−3%以下でロング',          f: (r) => (r.aboveMa200 && r.dev25 != null && r.dev25 <= -3 ? 1 : 0) },
  { key: 'vix_usdn',  label: '🔵 VIX<20 かつ 米国が下げた翌日だけロング',     f: (r) => (r.vix < 20 && r.us < 0 ? 1 : 0) },
  { key: 'vix_unf',   label: '🔵 VIX<20 かつ 未消化のズレの日だけロング',     f: (r) => (r.vix < 20 && r.us > 0 && r.jp < 0 ? 1 : 0) },
]

function run(rule, lev) {
  let eq = 1, peak = 1, dd = 0, n = 0
  for (const r of rows) {
    const pos = rule.f(r)
    const ret = (pos ? r.next * pos : 0) * lev
    if (pos) n++
    eq *= 1 + ret / 100
    if (eq <= 0) return { eq: 0, dd: -1, n }
    peak = Math.max(peak, eq)
    dd = Math.min(dd, eq / peak - 1)
  }
  return { eq, dd, n }
}

/** 最大DDが target になる倍率を二分探索（倍率が上がるほどDDは深くなる単調性を利用）。 */
function levForDD(rule, target) {
  let lo = 0.05, hi = 8
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2
    if (run(rule, mid).dd < target) hi = mid; else lo = mid
  }
  return (lo + hi) / 2
}

const years = rows.length / 252
const base = run(RULES[0], 1)
const TARGET = base.dd

console.log('════════════════════════════════════════════════════════════')
console.log(' 同じリスクに揃えて比べる（日経225・翌営業日の終値まで）')
console.log('════════════════════════════════════════════════════════════')
console.log(` 期間 : ${rows[0].d} 〜 ${rows[rows.length - 1].d}（${rows.length}営業日・約${r2(years)}年）`)
console.log(` 揃える先 : 最大DD ${r2(TARGET * 100)}%（＝常にロングのDD）`)
console.log(' 🔵 コスト・借入金利は入れていない。倍率が高い案ほど実運用では不利になる')
console.log('')
console.log('規則                                                  出番   素の累計   必要な倍率   揃えた後の累計   CAGR')
console.log('────────────────────────────────────────────────────────────────────────────────────────────────')

for (const rule of RULES) {
  const raw = run(rule, 1)
  const lev = levForDD(rule, TARGET)
  const adj = run(rule, lev)
  const cagr = (Math.pow(adj.eq, 1 / years) - 1) * 100
  const mark = rule.key === 'base' ? '★' : ''
  console.log(
    (mark + rule.label).slice(0, 40).padEnd(42, '　').slice(0, 42) +
    (r2(raw.n / rows.length * 100) + '%').padStart(7) +
    (r2((raw.eq - 1) * 100) + '%').padStart(11) +
    (r2(lev) + '倍').padStart(12) +
    (r2((adj.eq - 1) * 100) + '%').padStart(16) +
    (r2(cagr) + '%').padStart(9)
  )
}
console.log('')
console.log('🔴 「揃えた後の累計」で基準を超えたものだけが、本当に価値のある材料。')

// ── 追加：VIX閾値の感度と、期間を割った検証（2026-08-22） ──────────────
// 🔴 「閾値20」は後知恵で選んだ数字。**崖なら当てはめ・平地なら本物**。
//    さらに前半10年／後半10年に割って、リーマン期を避けているだけでないかを見る。
console.log('')
console.log('── VIX閾値の感度（同じDDに揃えた後の CAGR）─────────────────')
console.log('閾値    出番    揃えた後の累計   CAGR')
for (const th of [14, 16, 18, 20, 22, 25, 30, 40]) {
  const rule = { key: 'v' + th, label: '', f: (r) => (r.vix < th ? 1 : 0) }
  const raw = run(rule, 1)
  const lev = levForDD(rule, TARGET)
  const adj = run(rule, lev)
  const cagr = (Math.pow(adj.eq, 1 / years) - 1) * 100
  console.log(('VIX<' + th).padEnd(8) + (r2(raw.n / rows.length * 100) + '%').padStart(6) +
    (r2((adj.eq - 1) * 100) + '%').padStart(16) + (r2(cagr) + '%').padStart(9) + (cagr > 7.13 ? '  ＋' : ''))
}

console.log('')
console.log('── 期間を半分に割る（リーマン期を避けているだけか）───────────')
const half = Math.floor(rows.length / 2)
const parts = [['前半', rows.slice(0, half)], ['後半', rows.slice(half)]]
const allRows = rows
for (const [name, part] of parts) {
  console.log(`【${name}】${part[0].d} 〜 ${part[part.length - 1].d}`)
  for (const rule of [RULES[0], RULES[1]]) {
    // その期間だけで走らせる（DDの揃え先もその期間の「常にロング」）
    rows.length = 0; rows.push(...part)
    const t = run(RULES[0], 1).dd
    const lev = levForDD(rule, t)
    const adj = run(rule, lev)
    const y = part.length / 252
    console.log('  ' + rule.label.slice(0, 26).padEnd(28, '　').slice(0, 28) +
      ('倍率' + r2(lev)).padStart(9) + ('  CAGR ' + r2((Math.pow(adj.eq, 1 / y) - 1) * 100) + '%').padStart(14) +
      ('  DD ' + r2(t * 100) + '%').padStart(12))
    rows.length = 0; rows.push(...allRows)
  }
}
