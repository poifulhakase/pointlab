#!/usr/bin/env node
// SQ（第2金曜）前後の値動きの癖を検証（R&D）。月次=高頻度・標本多（20年で約240回）。
// 問い: SQに向けて上げる/下げる癖はあるか・SQ後に反転するか・メジャー(3/6/9/12)とマイナーで違うか。
// Yahoo ^N225 日次20年。SQ日=各月第2金曜（直前営業日にマップ）。
// 使い方: node scripts/analyze-sq.mjs

const P2 = Math.floor(Date.now() / 1000)
const P1 = P2 - 21 * 365 * 24 * 3600

async function fetchDaily() {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EN225?period1=${P1}&period2=${P2}&interval=1d`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }, signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const j = await res.json()
  const r = j?.chart?.result?.[0]
  const ts = r.timestamp ?? [], cl = r.indicators?.quote?.[0]?.close ?? []
  const rows = []
  for (let i = 0; i < ts.length; i++) if (cl[i] != null) rows.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: cl[i] })
  return rows
}
const r2 = v => v == null ? null : Math.round(v * 100) / 100
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null

// 第2金曜の YYYY-MM-DD を返す
function secondFriday(year, month) {
  let count = 0
  for (let d = 1; d <= 21; d++) {
    const dt = new Date(Date.UTC(year, month - 1, d))
    if (dt.getUTCDay() === 5) { count++; if (count === 2) return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}` }
  }
  return null
}

async function main() {
  console.log('[fetch] Yahoo ^N225 日次20年...')
  const rows = await fetchDaily()
  console.log(`  → ${rows.length}営業日 (${rows[0].date} 〜 ${rows[rows.length - 1].date})`)
  const dates = rows.map(r => r.date)
  const idxOnOrBefore = target => { let lo = 0, hi = dates.length - 1, ans = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (dates[m] <= target) { ans = m; lo = m + 1 } else hi = m - 1 } return ans }
  const ret = (a, b) => (a >= 0 && b >= 0 && a < rows.length && b < rows.length) ? (rows[b].close - rows[a].close) / rows[a].close * 100 : null

  // 全SQ収集
  const sqs = []
  for (let y = 2005; y <= 2026; y++) for (let m = 1; m <= 12; m++) {
    const sf = secondFriday(y, m); if (!sf) continue
    const idx = idxOnOrBefore(sf); if (idx < 6 || idx > rows.length - 7) continue
    const major = [3, 6, 9, 12].includes(m)
    sqs.push({ y, m, idx, major })
  }
  console.log(`SQ件数: 全${sqs.length} (メジャー${sqs.filter(s=>s.major).length} / マイナー${sqs.filter(s=>!s.major).length})`)

  const agg = (list, fn, lbl) => {
    const vals = []
    for (const s of list) { const v = fn(s); if (v != null) vals.push(v) }
    const up = vals.filter(v => v > 0).length
    console.log(`  ${lbl.padEnd(28)} n=${String(vals.length).padStart(3)}  平均=${String(r2(mean(vals))).padStart(6)}%  上昇=${Math.round(up/vals.length*100)}%`)
  }

  const sets = [['全SQ', sqs], ['メジャーSQ(3/6/9/12)', sqs.filter(s => s.major)], ['マイナーSQ', sqs.filter(s => !s.major)]]

  console.log('\n========== ① SQに向けて（直前5日: idx-5→idx）==========')
  for (const [lbl, list] of sets) agg(list, s => ret(s.idx - 5, s.idx), lbl)

  console.log('\n========== ② SQ後（idx→idx+5）＝反転するか ==========')
  for (const [lbl, list] of sets) agg(list, s => ret(s.idx, s.idx + 5), lbl)

  console.log('\n========== ③ SQ後・ショート目線（idx→idx+5 の逆符号）==========')
  for (const [lbl, list] of sets) agg(list, s => -ret(s.idx, s.idx + 5), lbl + '(短)')

  console.log('\n========== ④ 「SQに向けて上げた年」だけ、その後下げるか（反転の条件付き）==========')
  for (const [lbl, list] of sets) {
    const ranUp = list.filter(s => { const p = ret(s.idx - 5, s.idx); return p != null && p > 0 })
    agg(ranUp, s => ret(s.idx, s.idx + 5), lbl + ' 上げ後の5日')
  }

  console.log('\n※直前5日/直後5日は重複なし（SQは月次で十分離れている）。標本は季節性より多く信頼度高め。')
  console.log('※現物指数ベース。SQは先物/オプション清算＝先物・レバETFでも値動きは取れる（手数料別）。')
}
main().catch(e => { console.error(e); process.exit(1) })
