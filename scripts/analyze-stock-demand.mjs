#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────
// ストック需給（信用残）は基準を超えるか（2026-08-22）
//
// 🔴 きっかけ（運用者・2026-08-22）＝「信用残が貯まっている状態かは、価格では判断できない」。
//    フロー（今週いくら売買したか）は価格に即時に反映されるが、
//    **ストック（残高）は将来の反対売買の予約**であって、価格には書かれていない。
//
// 🔵 アプリの margin.json は52週しか持っていないが、**取得元（JPX過去推移表）には24年ある**
//    （1,220週・2002-08〜）。ここでは元データを直接取りに行く。
//
// 合格条件（2026-08-22 に確立・米国市場の検証で3回間違えかけた反省から）:
//   ① 同じ最大DDに揃えて、常にロング（基準）を超えること
//   ② 閾値を振っても崩れないこと（崖でなく平地）
//   ③ 期間を前後半に割っても、両方で基準を超えること
//
// 🔴 公表の遅れを必ず入れる。信用残は週末締めで翌週火曜の公表なので、
//    **その週末+7日たってから使えるものとして扱う**（先読みの禁止）。
//
// 使い方: node scripts/analyze-stock-demand.mjs
// ──────────────────────────────────────────────────────────────────────────

import XLSXmod from 'xlsx'
const XLSX = XLSXmod.default || XLSXmod

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }
const JPX = 'https://www.jpx.co.jp'
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100)
const serial = (d) => new Date(Date.UTC(1899, 11, 30) + d * 86400000).toISOString().slice(0, 10)
const addDays = (iso, n) => new Date(new Date(iso + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10)

// ── 信用残（週次・24年） ─────────────────────────────────
async function fetchMarginHistory() {
  const html = await (await fetch(JPX + '/markets/statistics-equities/margin/06.html', { headers: UA })).text()
  const m = /href="(\/markets\/statistics-equities\/margin\/[^"]*\.xls[x]?)"/.exec(html)
  if (!m) throw new Error('過去推移表のリンクが見つかりません')
  const buf = await (await fetch(JPX + m[1], { headers: UA })).arrayBuffer()
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames.find(n => n.includes('信用')) ?? wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' })
  const out = []
  for (const row of rows) {
    if (typeof row[0] !== 'number' || row[0] < 30000) continue
    const shortBal = typeof row[2] === 'number' ? row[2] : 0
    const longBal = typeof row[4] === 'number' ? row[4] : 0
    if (shortBal <= 0 && longBal <= 0) continue
    out.push({ date: serial(row[0]), longBal, shortBal, ratio: shortBal > 0 ? longBal / shortBal : null })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

async function fetchNikkei(years) {
  const p2 = Math.floor(Date.now() / 1000), p1 = p2 - Math.round(years * 366 * 86400)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EN225?interval=1d&period1=${p1}&period2=${p2}`
  const x = (await (await fetch(url, { headers: UA, signal: AbortSignal.timeout(60000) })).json())?.chart?.result?.[0]
  if (x.meta?.dataGranularity !== '1d') throw new Error('日足でない')
  const q = x.indicators.quote[0], rows = []
  x.timestamp.forEach((t, i) => { if (q.close[i] != null) rows.push({ date: new Date(t * 1000).toISOString().slice(0, 10), c: q.close[i] }) })
  return rows
}

const [margin, nk] = await Promise.all([fetchMarginHistory(), fetchNikkei(24)])
console.log(`信用残 ${margin.length}週（${margin[0].date} 〜 ${margin[margin.length - 1].date}）／日経 ${nk.length}営業日`)

// 🔴 公表の遅れ＝週末+7日。各週のデータに「使えるようになる日」を持たせる
const avail = margin.map(w => ({ ...w, from: addDays(w.date, 7) }))

// 週次の特徴量（すべて過去52週だけで作る＝後知恵にしない）
for (let i = 0; i < avail.length; i++) {
  const past = avail.slice(Math.max(0, i - 51), i + 1)
  const rank = (arr, v) => arr.filter(x => x <= v).length / arr.length * 100
  avail[i].longPct = rank(past.map(x => x.longBal), avail[i].longBal)
  avail[i].ratioPct = rank(past.map(x => x.ratio ?? 0), avail[i].ratio ?? 0)
  avail[i].long4w = i >= 4 ? (avail[i].longBal / avail[i - 4].longBal - 1) * 100 : null
  avail[i].short4w = i >= 4 ? (avail[i].shortBal / avail[i - 4].shortBal - 1) * 100 : null
}

// 日次へ前方補完（その日の時点で「公表済みの最新週」を使う）
const rows = []
let wi = 0
for (let i = 1; i < nk.length - 1; i++) {
  const d = nk[i].date
  while (wi + 1 < avail.length && avail[wi + 1].from <= d) wi++
  const w = avail[wi]
  if (!w || w.from > d || w.long4w == null) continue
  rows.push({ d, w, next: (nk[i + 1].c / nk[i].c - 1) * 100 })
}
console.log(`突き合わせ ${rows.length}営業日（${rows[0].d} 〜 ${rows[rows.length - 1].d}）`)
console.log('')

const RULES = [
  { key: 'base', label: '常にロング（基準）', f: () => 1 },
  { key: 'long_low', label: '買残の水準が低い（52週で下位30%）ときだけロング', f: (r) => (r.w.longPct <= 30 ? 1 : 0) },
  { key: 'long_high', label: '買残の水準が高い（上位30%）ときだけロング', f: (r) => (r.w.longPct >= 70 ? 1 : 0) },
  { key: 'long_up', label: '買残が4週で+5%以上（積み上がり）ならショート', f: (r) => (r.w.long4w >= 5 ? -1 : 0) },
  { key: 'long_dn', label: '買残が4週で−5%以下（投げが出た）ならロング', f: (r) => (r.w.long4w <= -5 ? 1 : 0) },
  { key: 'ratio_low', label: '信用倍率が低い（売り方が多い＝踏み上げ余地）ときロング', f: (r) => (r.w.ratioPct <= 30 ? 1 : 0) },
  { key: 'ratio_hi', label: '信用倍率が高いときだけロング', f: (r) => (r.w.ratioPct >= 70 ? 1 : 0) },
  { key: 'short_up', label: '売残が4週で+5%以上（売り方が増えた）ならロング', f: (r) => (r.w.short4w >= 5 ? 1 : 0) },
]

function run(rule, lev, data = rows) {
  let eq = 1, peak = 1, dd = 0, n = 0, wins = 0
  for (const r of data) {
    const pos = rule.f(r)
    const ret = (pos ? r.next * pos : 0) * lev
    if (pos) { n++; if (ret > 0) wins++ }
    eq *= 1 + ret / 100
    if (eq <= 0) return { eq: 0, dd: -1, n, wins }
    peak = Math.max(peak, eq); dd = Math.min(dd, eq / peak - 1)
  }
  return { eq, dd, n, wins }
}
function levForDD(rule, target, data = rows) {
  let lo = 0.05, hi = 8
  for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; if (run(rule, mid, data).dd < target) hi = mid; else lo = mid }
  return (lo + hi) / 2
}

const years = rows.length / 252
const TARGET = run(RULES[0], 1).dd
const baseCagr = (Math.pow(run(RULES[0], 1).eq, 1 / years) - 1) * 100
console.log(`揃える先 : 最大DD ${r2(TARGET * 100)}%（常にロング）／約${r2(years)}年`)
console.log('')
console.log('規則                                                       出番   勝率    素の累計   倍率   揃えた後   CAGR')
console.log('─────────────────────────────────────────────────────────────────────────────────────────────────')
for (const rule of RULES) {
  const raw = run(rule, 1)
  const lev = levForDD(rule, TARGET)
  const adj = run(rule, lev)
  const cagr = (Math.pow(adj.eq, 1 / years) - 1) * 100
  console.log(
    (rule.key === 'base' ? '★' : '  ') + rule.label.slice(0, 40).padEnd(42, '　').slice(0, 42) +
    (r2(raw.n / rows.length * 100) + '%').padStart(7) +
    (r2(raw.n ? raw.wins / raw.n * 100 : null) + '%').padStart(8) +
    (r2((raw.eq - 1) * 100) + '%').padStart(11) +
    (r2(lev) + '倍').padStart(9) +
    (r2((adj.eq - 1) * 100) + '%').padStart(11) +
    (r2(cagr) + '%').padStart(8) + (cagr > baseCagr && rule.key !== 'base' ? '  ＋' : ''))
}

// ── ② 閾値の感度 ───────────────────────────────────────
console.log('')
console.log('── 閾値の感度（買残の4週変化・ショート側）────────────')
for (const th of [3, 4, 5, 6, 8, 10]) {
  const rule = { f: (r) => (r.w.long4w >= th ? -1 : 0) }
  const lev = levForDD(rule, TARGET), adj = run(rule, lev), raw = run(rule, 1)
  console.log(`  +${th}%以上`.padEnd(12) + ('出番' + r2(raw.n / rows.length * 100) + '%').padStart(11) +
    ('  CAGR ' + r2((Math.pow(adj.eq, 1 / years) - 1) * 100) + '%').padStart(15))
}
console.log('')
console.log('── 閾値の感度（買残の水準・下位◯%でロング）────────────')
for (const th of [20, 25, 30, 35, 40, 50]) {
  const rule = { f: (r) => (r.w.longPct <= th ? 1 : 0) }
  const lev = levForDD(rule, TARGET), adj = run(rule, lev), raw = run(rule, 1)
  console.log(`  下位${th}%`.padEnd(12) + ('出番' + r2(raw.n / rows.length * 100) + '%').padStart(11) +
    ('  CAGR ' + r2((Math.pow(adj.eq, 1 / years) - 1) * 100) + '%').padStart(15))
}

// ── ③ 期間を割る ───────────────────────────────────────
console.log('')
console.log('── 期間を前後半に割る ──────────────────────────────')
const half = Math.floor(rows.length / 2)
for (const [name, part] of [['前半', rows.slice(0, half)], ['後半', rows.slice(half)]]) {
  const t = run(RULES[0], 1, part).dd
  const y = part.length / 252
  const bc = (Math.pow(run(RULES[0], 1, part).eq, 1 / y) - 1) * 100
  console.log(`【${name}】${part[0].d} 〜 ${part[part.length - 1].d}（DD ${r2(t * 100)}%・基準CAGR ${r2(bc)}%）`)
  for (const rule of RULES) {
    if (rule.key === 'base') continue
    const lev = levForDD(rule, t, part), adj = run(rule, lev, part)
    const c = (Math.pow(adj.eq, 1 / y) - 1) * 100
    console.log('   ' + rule.label.slice(0, 30).padEnd(32, '　').slice(0, 32) +
      ('CAGR ' + r2(c) + '%').padStart(14) + (c > bc ? '  ＋' : ''))
  }
}
