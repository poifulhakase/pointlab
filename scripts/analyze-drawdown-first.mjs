#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────
// ドローダウンを浅くする道はあるか（2026-08-22・運用者の判断で目的を変更）
//
// 🔴 目的の変更＝「常にロングより増やす」ではなく
//    **「同じくらい増えればよいので、DDを浅くする」**（運用者・2026-08-22）。
//
// 🔵 なぜ物差しが変わるか＝前の物差し（同じDDに揃えて比べる）は**レバレッジをかけられる前提**。
//    実際に使うのは現物ETF（1321=1倍・1570=2倍）で、2.11倍のような中途半端な倍率は取れない。
//    そこでここでは**すべて1倍のまま**評価し、CAGR・最大DD・Calmar比（CAGR÷DD）で比べる。
//
// 🔴 今日ここまで試していなかった形＝**「下では建てない（ショートせず現金）」**。
//    午前の検証は「200日線の下ならショート」でしか測っておらず、
//    DDを削る目的なら**現金に逃げる**方が素直だった。
//
// 合格条件:
//   ① CAGR が基準の8割以上を保つ
//   ② 最大DD が基準より明確に浅い
//   ③ 期間を前後半に割っても両方で成立
//
// 使い方: node scripts/analyze-drawdown-first.mjs
// ──────────────────────────────────────────────────────────────────────────

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }
const NIKKEI_UA = { 'User-Agent': UA['User-Agent'], 'Referer': 'https://nikkei225jp.com/data/sinyou.php' }
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100)
const addDays = (iso, n) => new Date(new Date(iso + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10)

async function yahoo(sym, years) {
  const p2 = Math.floor(Date.now() / 1000), p1 = p2 - Math.round(years * 366 * 86400)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&period1=${p1}&period2=${p2}`
  const x = (await (await fetch(url, { headers: UA, signal: AbortSignal.timeout(60000) })).json())?.chart?.result?.[0]
  if (!x) throw new Error('no data ' + sym)
  if (x.meta?.dataGranularity !== '1d') throw new Error('日足でない: ' + sym)
  const q = x.indicators.quote[0], m = new Map()
  x.timestamp.forEach((t, i) => { if (q.close[i] != null) m.set(new Date(t * 1000).toISOString().slice(0, 10), q.close[i]) })
  return m
}

async function fetchEvalRatio() {
  const t = await (await fetch('https://nikkei225jp.com/_data/_nfsWEB/DAY/dailyweek2.json', { headers: NIKKEI_UA, signal: AbortSignal.timeout(30000) })).text()
  const m = t.match(/var DAILY\s*=\s*(\[[\s\S]*?\])\s*;/)
  let s = m[1]
  for (let i = 0; i < 3; i++) s = s.replace(/,(\s*),/g, ',null,')
  s = s.replace(/,\s*\]/g, ']')
  const out = []
  for (const r of JSON.parse(s)) {
    if (typeof r[0] !== 'number' || typeof r[7] !== 'number') continue
    out.push({ date: new Date(r[0]).toISOString().slice(0, 10), ev: r[7] })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

const [nk, vix, spx, ev] = await Promise.all([yahoo('%5EN225', 18), yahoo('%5EVIX', 18), yahoo('%5EGSPC', 18), fetchEvalRatio()])
const days = [...nk.keys()].sort()
const closes = days.map(d => nk.get(d))
const sma = (n, i) => (i + 1 < n ? null : closes.slice(i + 1 - n, i + 1).reduce((s, v) => s + v, 0) / n)
const lastBefore = (m, d) => { const ks = [...m.keys()].filter(k => k < d).sort(); return ks.length ? ks[ks.length - 1] : null }

// 🔴 評価損益率は週末締め・翌週火曜公表 → +7日たってから使う
const avail = ev.map(w => ({ ...w, from: addDays(w.date, 7) }))

const rows = []
let wi = 0
for (let i = 200; i < days.length - 1; i++) {
  const d = days[i]
  while (wi + 1 < avail.length && avail[wi + 1].from <= d) wi++
  const w = avail[wi]
  const kv = lastBefore(vix, d)
  const usKeys = [...spx.keys()].filter(k => k < d).sort()
  if (!w || w.from > d || !kv || usKeys.length < 2) continue
  rows.push({
    d,
    ma25: sma(25, i), ma200: sma(200, i), c: closes[i],
    vix: vix.get(kv),
    us: spx.get(usKeys[usKeys.length - 1]) / spx.get(usKeys[usKeys.length - 2]) - 1,
    ev: w.ev,
    next: (closes[i + 1] / closes[i] - 1) * 100,
  })
}

const RULES = [
  { key: 'base', label: '常にロング（基準）', f: () => 1 },
  { key: 'ma200_cash', label: '🔵 200日線の上ならロング／下は現金', f: (r) => (r.c > r.ma200 ? 1 : 0) },
  { key: 'ma25_cash', label: '25日線の上ならロング／下は現金', f: (r) => (r.c > r.ma25 ? 1 : 0) },
  { key: 'ma200_short', label: '200日線の上ならロング／下はショート', f: (r) => (r.c > r.ma200 ? 1 : -1) },
  { key: 'vix_cash', label: 'VIX<20 ならロング／以上は現金', f: (r) => (r.vix < 20 ? 1 : 0) },
  { key: 'vix25_cash', label: 'VIX<25 ならロング／以上は現金', f: (r) => (r.vix < 25 ? 1 : 0) },
  { key: 'ev_cash', label: '評価損益率が−5%以上（楽観）なら現金', f: (r) => (r.ev >= -5 ? 0 : 1) },
  { key: 'ma200_vix', label: '🔵 200日線の上 かつ VIX<25 ならロング／他は現金', f: (r) => (r.c > r.ma200 && r.vix < 25 ? 1 : 0) },
  { key: 'ma200_ev', label: '200日線の上 かつ 評価損益率−5%未満ならロング', f: (r) => (r.c > r.ma200 && r.ev < -5 ? 1 : 0) },
  { key: 'ma200_us', label: '200日線の上 かつ 前夜の米国が下げた日だけロング', f: (r) => (r.c > r.ma200 && r.us < 0 ? 1 : 0) },
]

function run(rule, data = rows) {
  let eq = 1, peak = 1, dd = 0, n = 0, wins = 0, under = 0, maxUnder = 0
  for (const r of data) {
    const pos = rule.f(r)
    const ret = pos ? r.next * pos : 0
    if (pos) { n++; if (ret > 0) wins++ }
    eq *= 1 + ret / 100
    if (eq >= peak) { peak = eq; under = 0 } else { under++; maxUnder = Math.max(maxUnder, under) }
    dd = Math.min(dd, eq / peak - 1)
  }
  const y = data.length / 252
  return {
    eq, dd, n, wins,
    cagr: (Math.pow(eq, 1 / y) - 1) * 100,
    calmar: dd < 0 ? ((Math.pow(eq, 1 / y) - 1) * 100) / Math.abs(dd * 100) : null,
    maxUnderYears: maxUnder / 252,
  }
}

const years = rows.length / 252
const base = run(RULES[0])
console.log('════════════════════════════════════════════════════════════')
console.log(' DDを浅くする道はあるか（すべて1倍・レバレッジなし）')
console.log('════════════════════════════════════════════════════════════')
console.log(` 期間 : ${rows[0].d} 〜 ${rows[rows.length - 1].d}（${rows.length}営業日・約${r2(years)}年）`)
console.log(` 基準 : CAGR ${r2(base.cagr)}% ／ 最大DD ${r2(base.dd * 100)}% ／ Calmar ${r2(base.calmar)}`)
console.log(' 🔵 現金の日は金利ゼロ。売買コストも入れていない')
console.log('')
console.log('規則                                                     出番    CAGR    最大DD   Calmar  含み損期間')
console.log('──────────────────────────────────────────────────────────────────────────────────────────────')
for (const rule of RULES) {
  const s = run(rule)
  const ok = s.cagr >= base.cagr * 0.8 && s.dd > base.dd
  console.log(
    (rule.key === 'base' ? '★' : (ok ? '＋' : '  ')) + rule.label.slice(0, 38).padEnd(40, '　').slice(0, 40) +
    (r2(s.n / rows.length * 100) + '%').padStart(7) +
    (r2(s.cagr) + '%').padStart(9) +
    (r2(s.dd * 100) + '%').padStart(10) +
    r2(s.calmar).toString().padStart(8) +
    (r2(s.maxUnderYears) + '年').padStart(9))
}
console.log('')
console.log('＋＝CAGRが基準の8割以上を保ったまま、最大DDが基準より浅いもの')
console.log('「含み損期間」＝高値を更新できずに沈んでいた最長の期間')

console.log('')
console.log('── 期間を前後半に割る ──────────────────────────────')
const half = Math.floor(rows.length / 2)
for (const [name, part] of [['前半', rows.slice(0, half)], ['後半', rows.slice(half)]]) {
  const b = run(RULES[0], part)
  console.log(`【${name}】${part[0].d} 〜 ${part[part.length - 1].d}　基準 CAGR ${r2(b.cagr)}% / DD ${r2(b.dd * 100)}% / Calmar ${r2(b.calmar)}`)
  for (const rule of RULES) {
    if (rule.key === 'base') continue
    const s = run(rule, part)
    const ok = s.cagr >= b.cagr * 0.8 && s.dd > b.dd
    console.log('   ' + (ok ? '＋' : '  ') + rule.label.slice(0, 32).padEnd(34, '　').slice(0, 34) +
      ('CAGR ' + r2(s.cagr) + '%').padStart(13) + ('DD ' + r2(s.dd * 100) + '%').padStart(12) +
      ('Calmar ' + r2(s.calmar)).padStart(13))
  }
}
