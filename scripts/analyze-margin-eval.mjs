#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────
// 信用評価損益率は基準を超えるか（2026-08-22・運用者の指摘から）
//
// 🔴 運用者の指摘＝「信用評価損益率とかも判断材料になるよね」。
//    買残・売残が**量**なのに対し、評価損益率は**痛み**（追証・投げの引き金）そのもの。
//    量では「あと何%下げたら投げが出るか」は分からない。ここが違う。
//
// データ＝nikkei225jp.com dailyweek2.json（週次・873週・2009-06〜）。
// 🔴 配列に穴（",,"）が入ることがあるので必ず補ってからパースする（2026-06 の教訓）。
// 🔴 公表の遅れ＝週末締め・翌週火曜公表なので **+7日たってから使える**ものとして扱う。
//
// 合格条件（2026-08-22 確立）:
//   ① 同じ最大DDに揃えて、常にロング（基準）を超えること
//   ② 閾値を振っても崩れないこと
//   ③ 期間を前後半に割っても、両方で基準を超えること
//
// 使い方: node scripts/analyze-margin-eval.mjs
// ──────────────────────────────────────────────────────────────────────────

const UA = {
  'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)',
  'Referer': 'https://nikkei225jp.com/data/sinyou.php',
}
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100)
const addDays = (iso, n) => new Date(new Date(iso + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10)

async function fetchEvalRatio() {
  const t = await (await fetch('https://nikkei225jp.com/_data/_nfsWEB/DAY/dailyweek2.json', { headers: UA, signal: AbortSignal.timeout(30000) })).text()
  const m = t.match(/var DAILY\s*=\s*(\[[\s\S]*?\])\s*;/)
  if (!m) throw new Error('DAILY が見つかりません')
  // 🔴 配列の穴を null で埋めてからパースする
  let s = m[1]
  for (let i = 0; i < 3; i++) s = s.replace(/,(\s*),/g, ',null,')
  s = s.replace(/,\s*\]/g, ']')
  const rows = JSON.parse(s)
  const out = []
  for (const r of rows) {
    if (typeof r[0] !== 'number' || typeof r[7] !== 'number') continue
    out.push({ date: new Date(r[0]).toISOString().slice(0, 10), ev: r[7] })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

async function fetchNikkei(years) {
  const p2 = Math.floor(Date.now() / 1000), p1 = p2 - Math.round(years * 366 * 86400)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EN225?interval=1d&period1=${p1}&period2=${p2}`
  const x = (await (await fetch(url, { headers: { 'User-Agent': UA['User-Agent'] }, signal: AbortSignal.timeout(60000) })).json())?.chart?.result?.[0]
  if (x.meta?.dataGranularity !== '1d') throw new Error('日足でない')
  const q = x.indicators.quote[0], rows = []
  x.timestamp.forEach((t, i) => { if (q.close[i] != null) rows.push({ date: new Date(t * 1000).toISOString().slice(0, 10), c: q.close[i] }) })
  return rows
}

const [ev, nk] = await Promise.all([fetchEvalRatio(), fetchNikkei(18)])
console.log(`信用評価損益率 ${ev.length}週（${ev[0].date} 〜 ${ev[ev.length - 1].date}）／日経 ${nk.length}営業日`)

const avail = ev.map(w => ({ ...w, from: addDays(w.date, 7) }))
for (let i = 0; i < avail.length; i++) {
  const past = avail.slice(Math.max(0, i - 51), i + 1).map(x => x.ev)
  avail[i].pct = past.filter(x => x <= avail[i].ev).length / past.length * 100  // 52週内の位置
  avail[i].chg4 = i >= 4 ? avail[i].ev - avail[i - 4].ev : null                 // 4週での変化（%ポイント）
}

const rows = []
let wi = 0
for (let i = 1; i < nk.length - 1; i++) {
  const d = nk[i].date
  while (wi + 1 < avail.length && avail[wi + 1].from <= d) wi++
  const w = avail[wi]
  if (!w || w.from > d || w.chg4 == null) continue
  rows.push({ d, w, next: (nk[i + 1].c / nk[i].c - 1) * 100 })
}
console.log(`突き合わせ ${rows.length}営業日（${rows[0].d} 〜 ${rows[rows.length - 1].d}）`)
console.log('')

const RULES = [
  { key: 'base', label: '常にロング（基準）', f: () => 1 },
  { key: 'deep', label: '評価損益率が−20%以下（投げが出た）ならロング', f: (r) => (r.w.ev <= -20 ? 1 : 0) },
  { key: 'deep15', label: '評価損益率が−15%以下ならロング', f: (r) => (r.w.ev <= -15 ? 1 : 0) },
  { key: 'shallow', label: '評価損益率が−5%以上（含み損が浅い＝楽観）ならショート', f: (r) => (r.w.ev >= -5 ? -1 : 0) },
  { key: 'shallow_flat', label: '評価損益率が−5%以上の日は建てない（他はロング）', f: (r) => (r.w.ev >= -5 ? 0 : 1) },
  { key: 'pct_low', label: '52週で下位30%（相対的に痛んでいる）ならロング', f: (r) => (r.w.pct <= 30 ? 1 : 0) },
  { key: 'pct_high', label: '52週で上位30%（相対的に楽）ならロング', f: (r) => (r.w.pct >= 70 ? 1 : 0) },
  { key: 'worse', label: '4週で3ポイント以上悪化したらロング', f: (r) => (r.w.chg4 <= -3 ? 1 : 0) },
  { key: 'better', label: '4週で3ポイント以上改善したらロング', f: (r) => (r.w.chg4 >= 3 ? 1 : 0) },
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
console.log(`揃える先 : 最大DD ${r2(TARGET * 100)}%（常にロング）／約${r2(years)}年・基準CAGR ${r2(baseCagr)}%`)
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

console.log('')
console.log('── 閾値の感度（この水準以下ならロング）──────────────')
for (const th of [-25, -22, -20, -18, -15, -12, -10]) {
  const rule = { f: (r) => (r.w.ev <= th ? 1 : 0) }
  const lev = levForDD(rule, TARGET), adj = run(rule, lev), raw = run(rule, 1)
  const c = (Math.pow(adj.eq, 1 / years) - 1) * 100
  console.log(`  ${th}%以下`.padEnd(12) + ('出番' + r2(raw.n / rows.length * 100) + '%').padStart(11) +
    ('  CAGR ' + r2(c) + '%').padStart(15) + (c > baseCagr ? '  ＋' : ''))
}

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
