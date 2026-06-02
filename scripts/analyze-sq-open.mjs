#!/usr/bin/env node
// SQ/裁定解消を「寄り付き(始値)」で測り直す（R&D・ユーザー指摘＝終値テストは寄りの効きを見逃す）
// SQ値は構成銘柄の“始値”で算出＝裁定解消の売り圧は寄りに出る。終値→終値では捕まえられない。
// 現物^N225のOHLCで: ①SQ当日の寄りギャップ(前日終値→SQ始値) ②寄り→引け(日中) をメジャー/ミニ別に20年。
// 使い方: node scripts/analyze-sq-open.mjs

const P2 = Math.floor(Date.now() / 1000), P1 = P2 - 21 * 365 * 24 * 3600
async function fetchOHLC(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?period1=${P1}&period2=${P2}&interval=1d`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) })
  const j = await res.json(); const r = j?.chart?.result?.[0]; if (!r) throw new Error('no result')
  const ts = r.timestamp, q = r.indicators.quote[0]
  const rows = []
  for (let i = 0; i < ts.length; i++) if (q.close[i] != null && q.open[i] != null) rows.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), open: q.open[i], close: q.close[i] })
  return rows
}
const r2 = v => v == null ? null : Math.round(v * 100) / 100
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null
function secondFriday(y, m) { let c = 0; for (let d = 1; d <= 21; d++) { if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 5) { c++; if (c === 2) return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}` } } return null }

async function main() {
  console.log('[fetch] ^N225 OHLC 20年...')
  const rows = await fetchOHLC('^N225')
  console.log(`  → ${rows.length}本`)
  const dates = rows.map(r => r.date)
  const idxOnOrBefore = t => { let lo = 0, hi = dates.length - 1, a = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (dates[m] <= t) { a = m; lo = m + 1 } else hi = m - 1 } return a }

  const sqs = []
  for (let y = 2005; y <= 2026; y++) for (let m = 1; m <= 12; m++) {
    const sf = secondFriday(y, m); if (!sf) continue
    const idx = idxOnOrBefore(sf); if (idx < 2 || idx > rows.length - 4) continue
    // SQ日は2nd金曜“当日”（idxがその日 or 直前営業日）。SQ算出は当日の寄り。
    sqs.push({ y, m, idx, major: [3, 6, 9, 12].includes(m) })
  }
  console.log(`SQ: 全${sqs.length}(メジャー${sqs.filter(s=>s.major).length}/ミニ${sqs.filter(s=>!s.major).length})`)

  const gapIn = s => (rows[s.idx].open - rows[s.idx - 1].close) / rows[s.idx - 1].close * 100   // 前日終値→SQ始値(寄りギャップ)
  const intraday = s => (rows[s.idx].close - rows[s.idx].open) / rows[s.idx].open * 100          // SQ寄り→引け
  const prevDay = s => (rows[s.idx - 1].close - rows[s.idx - 2].close) / rows[s.idx - 2].close * 100 // SQ前日の動き
  const nextOpen = s => (s.idx + 1 < rows.length) ? (rows[s.idx + 1].open - rows[s.idx].close) / rows[s.idx].close * 100 : null

  const agg = (list, lbl) => {
    const g = list.map(gapIn).filter(v => v != null)
    const intr = list.map(intraday).filter(v => v != null)
    const pv = list.map(prevDay).filter(v => v != null)
    const dn = g.filter(v => v < 0).length
    console.log(`  ${lbl.padEnd(14)} n=${String(list.length).padStart(3)}  寄りギャップ平均${String(r2(mean(g))).padStart(6)}%(下落${Math.round(dn/g.length*100)}%)  寄り→引け平均${String(r2(mean(intr))).padStart(6)}%  SQ前日${String(r2(mean(pv))).padStart(6)}%`)
  }

  console.log('\n========== SQ当日の「寄りギャップ」と「寄り→引け」（終値でなく始値で測る）==========')
  console.log('  裁定解消の売り圧が寄りに出るなら、寄りギャップがマイナスに偏るはず')
  agg(sqs, '全SQ')
  agg(sqs.filter(s => s.major), 'メジャーSQ')
  agg(sqs.filter(s => !s.major), 'ミニSQ')

  console.log('\n========== 参考: 寄りで売られ→引けで戻す（日中反転）が起きるか ==========')
  for (const [lbl, list] of [['メジャーSQ', sqs.filter(s => s.major)]]) {
    const gapNeg = list.filter(s => gapIn(s) < 0)   // 寄りで下げた回
    const reb = gapNeg.map(intraday).filter(v => v != null)
    console.log(`  ${lbl}: 寄りで下げた回(n${gapNeg.length})の その後 寄り→引け 平均${r2(mean(reb))}%（戻し率${reb.length?Math.round(reb.filter(v=>v>0).length/reb.length*100):0}%）`)
  }

  console.log('\n⚠ 日次OHLC(真の寄り付きauction値の近似)。SQ算出値そのものではない。n=メジャー約80/ミニ約160。')
  console.log('⚠ 方向は裁定買い残の傾き次第＝平均だけでは出ない可能性。これは“寄りに効きがあるか”の一次確認。')
}
main().catch(e => { console.error(e); process.exit(1) })
