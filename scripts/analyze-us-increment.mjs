#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────
// 米国市場を足すと、価格だけのベースラインを超えるか（2026-08-22）
//
// 🔴 前提（analyze-overnight-us.mjs・2026-08-11 の結論）＝
//    前夜の米国は**寄り付きで織り込まれて終わる**（寄りまで74.7%／寄り→引けは49.8%）。
//    つまり「前夜の米国 → その日の終値 65.1%」は**取りに行けない**数字。
//
// 🔵 だが 2026-08-12 から運用が変わった（15:00判断・引成執行）ので、問いも変わる：
//    **15:00の時点で既知の米国情報は、今日の引け→明日の引けに効くか。**
//    15:00に分かっているのは「今朝06:00に終わった米国セッション」まで。
//    その晩の米国（22:30〜翌06:00）は判断の後なので**使えない**。
//
// 比較の相手は50%ではなく **常にロング＝52.79%**（analyze-price-baseline.mjs）。
//
// 使い方: node scripts/analyze-us-increment.mjs
// ──────────────────────────────────────────────────────────────────────────

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }
const YEARS = 20
const P2 = Math.floor(Date.now() / 1000)
const P1 = P2 - Math.round(YEARS * 366 * 86400)
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100)

async function get(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?period1=${P1}&period2=${P2}&interval=1d`
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60000) })
  const x = (await res.json())?.chart?.result?.[0]
  if (!x) throw new Error('no data: ' + sym)
  if (x.meta?.dataGranularity !== '1d') throw new Error('日足でない: ' + x.meta?.dataGranularity)
  const q = x.indicators.quote[0], m = new Map()
  x.timestamp.forEach((t, i) => {
    if (q.close[i] != null) m.set(new Date(t * 1000).toISOString().slice(0, 10), { o: q.open[i], c: q.close[i], h: q.high[i], l: q.low[i] })
  })
  return m
}

function normCdf(x) {
  const t = 1 / (1 + 0.2316419 * x)
  const d = 0.3989422804014327 * Math.exp(-x * x / 2)
  return 1 - d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
}

const [nk, spx, ndx, vix] = await Promise.all([get('%5EN225'), get('%5EGSPC'), get('%5EIXIC'), get('%5EVIX')])
const days = [...nk.keys()].sort()

/** d（日本の営業日）の15:00時点で既知＝dより前に終値が付いた米国セッションの前日比。 */
function knownUsRet(m, d) {
  const ks = [...m.keys()].filter(k => k < d).sort()
  if (ks.length < 2) return null
  return m.get(ks[ks.length - 1]).c / m.get(ks[ks.length - 2]).c - 1
}
function knownUsLevel(m, d) {
  const ks = [...m.keys()].filter(k => k < d).sort()
  return ks.length ? m.get(ks[ks.length - 1]).c : null
}

// 各日の材料（すべて 15:00 時点で既知）＋ 翌日のリターン
const rows = []
for (let i = 1; i < days.length - 1; i++) {
  const d = days[i], pd = days[i - 1], nd = days[i + 1]
  const us = knownUsRet(spx, d)
  const usn = knownUsRet(ndx, d)
  const v = knownUsLevel(vix, d)
  if (us == null || v == null) continue
  const jp = nk.get(d).c / nk.get(pd).c - 1   // 今日の日本（前日終値比）
  rows.push({
    d, us, usn, vix: v, jp,
    gapUnfilled: us - jp,                      // 🔵 米国が上げたのに日本が付いてこない＝未消化のズレ
    next: (nk.get(nd).c / nk.get(d).c - 1) * 100,
  })
}

const RULES = [
  { key: 'base',        label: '常にロング（基準）',                       f: () => 1 },
  { key: 'us_up',       label: '前夜の米国が上げた日だけロング',            f: (r) => (r.us > 0 ? 1 : 0) },
  { key: 'us_down',     label: '前夜の米国が下げた日だけロング',            f: (r) => (r.us < 0 ? 1 : 0) },
  { key: 'us_follow',   label: '前夜の米国と同じ方向',                     f: (r) => (r.us > 0 ? 1 : -1) },
  { key: 'us_reverse',  label: '前夜の米国と逆',                          f: (r) => (r.us > 0 ? -1 : 1) },
  { key: 'us_crash',    label: '前夜の米国が−1%以下の日だけロング',        f: (r) => (r.us <= -0.01 ? 1 : 0) },
  { key: 'us_surge',    label: '前夜の米国が+1%以上の日だけロング',        f: (r) => (r.us >= 0.01 ? 1 : 0) },
  { key: 'unfilled_up', label: '🔵 米国が上げたのに日本が下げた日だけロング（未消化）', f: (r) => (r.us > 0 && r.jp < 0 ? 1 : 0) },
  { key: 'unfilled_dn', label: '🔵 米国が下げたのに日本が上げた日だけショート（未消化）', f: (r) => (r.us < 0 && r.jp > 0 ? -1 : 0) },
  { key: 'gap_big',     label: '米国と日本のズレが1%以上の日だけ、米国の方向へ',      f: (r) => (Math.abs(r.gapUnfilled) >= 0.01 ? (r.gapUnfilled > 0 ? 1 : -1) : 0) },
  { key: 'vix_low',     label: 'VIXが20未満の日だけロング',                f: (r) => (r.vix < 20 ? 1 : 0) },
  { key: 'vix_high',    label: 'VIXが30以上の日だけロング',                f: (r) => (r.vix >= 30 ? 1 : 0) },
  { key: 'ndx_up',      label: '前夜のナスダックが上げた日だけロング',      f: (r) => (r.usn != null && r.usn > 0 ? 1 : 0) },
]

console.log('════════════════════════════════════════════════════════════')
console.log(' 米国市場を足すと基準を超えるか（15:00判断・引成執行の前提）')
console.log('════════════════════════════════════════════════════════════')
console.log(` 期間 : ${rows[0].d} 〜 ${rows[rows.length - 1].d}（${rows.length}営業日）`)
console.log(' 🔴 使うのは「15:00の時点で既に終わっている米国セッション」だけ')
console.log('')
console.log('規則                                                        回数   出番   勝率   平均   累計    最大DD   p値')
console.log('──────────────────────────────────────────────────────────────────────────────────────────────────')

const out = []
for (const rule of RULES) {
  let n = 0, wins = 0, sum = 0, eq = 1, peak = 1, dd = 0
  for (const r of rows) {
    const pos = rule.f(r)
    if (!pos) continue
    const ret = r.next * pos
    n++; if (ret > 0) wins++; sum += ret
    eq *= 1 + ret / 100; peak = Math.max(peak, eq); dd = Math.min(dd, eq / peak - 1)
  }
  const wr = n ? (wins / n) * 100 : null
  const z = n ? (wins - n / 2) / Math.sqrt(n / 4) : 0
  const p = n ? Math.round(2 * (1 - normCdf(Math.abs(z))) * 1000) / 1000 : null
  const rec = { key: rule.key, label: rule.label, n, coverage: r2(n / rows.length * 100), winRate: r2(wr), avg: r2(n ? sum / n : null), total: r2((eq - 1) * 100), maxDD: r2(dd * 100), p }
  out.push(rec)
  const base = out[0]
  const mark = rec.key === 'base' ? '★' : (rec.winRate > base.winRate ? '＋' : '  ')
  console.log(
    mark + rule.label.slice(0, 40).padEnd(42, '　').slice(0, 42) +
    String(rec.n).padStart(7) + (rec.coverage + '%').padStart(7) +
    (rec.winRate + '%').padStart(8) + (rec.avg + '%').padStart(8) +
    (rec.total + '%').padStart(10) + (rec.maxDD + '%').padStart(9) + String(rec.p).padStart(7))
}
console.log('')
console.log('★＝基準（常にロング）／＋＝基準より勝率が高い')
