#!/usr/bin/env node
// 「SQに向かう数日（直前の仕込み）」にエッジがあるか（R&D）。終値ベース（数日保有なので正しい）。
// 規律: 「上がった」でなく「無条件の同日数リターン(ドリフト)を上回るか」で判定。
// 使い方: node scripts/analyze-sq-approach.mjs

const P2 = Math.floor(Date.now() / 1000), P1 = P2 - 21 * 365 * 24 * 3600
async function fetchSym(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?period1=${P1}&period2=${P2}&interval=1d`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) })
  const j = await res.json(); const r = j?.chart?.result?.[0]; if (!r) throw new Error('no result')
  const ts = r.timestamp, cl = r.indicators.quote[0].close
  const rows = []
  for (let i = 0; i < ts.length; i++) if (cl[i] != null) rows.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: cl[i] })
  return rows
}
const r2 = v => v == null ? null : Math.round(v * 100) / 100
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null
function secondFriday(y, m) { let c = 0; for (let d = 1; d <= 21; d++) { if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 5) { c++; if (c === 2) return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}` } } return null }

async function main() {
  console.log('[fetch] ^N225 20年...')
  const rows = await fetchSym('^N225')
  const dates = rows.map(r => r.date)
  const idxOnOrBefore = t => { let lo = 0, hi = dates.length - 1, a = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (dates[m] <= t) { a = m; lo = m + 1 } else hi = m - 1 } return a }
  // 直前N日のリターン: idx-N → idx
  const back = (idx, N) => (idx - N >= 0) ? (rows[idx].close - rows[idx - N].close) / rows[idx - N].close * 100 : null

  const sqs = []
  for (let y = 2005; y <= 2026; y++) for (let m = 1; m <= 12; m++) {
    const sf = secondFriday(y, m); if (!sf) continue
    const idx = idxOnOrBefore(sf); if (idx < 11 || idx > rows.length - 2) continue
    sqs.push({ y, m, idx, major: [3, 6, 9, 12].includes(m) })
  }

  // 無条件ベースライン: 全日の 直前N日リターン
  const baseline = N => {
    const all = []
    for (let i = N; i < rows.length; i++) all.push(back(i, N))
    const v = all.filter(x => x != null)
    return { avg: r2(mean(v)), up: Math.round(v.filter(x => x > 0).length / v.length * 100) }
  }

  console.log('\n========== SQに向かう数日（直前N日）vs 無条件ベースライン ==========')
  for (const N of [3, 5, 10]) {
    const bl = baseline(N)
    console.log(`\n  ── 直前${N}日（ベースライン=全日平均 ${bl.avg}% / 上昇率${bl.up}%）──`)
    for (const [lbl, list] of [['全SQ', sqs], ['メジャーSQ', sqs.filter(s => s.major)], ['ミニSQ', sqs.filter(s => !s.major)]]) {
      const v = list.map(s => back(s.idx, N)).filter(x => x != null)
      const up = Math.round(v.filter(x => x > 0).length / v.length * 100)
      const edge = r2(mean(v) - bl.avg)
      console.log(`    ${lbl.padEnd(10)} n=${String(v.length).padStart(3)}  平均${String(r2(mean(v))).padStart(6)}%  上昇率${up}%  ベース差${edge > 0 ? '+' : ''}${edge}pt`)
    }
  }
  console.log('\n※「ベース差」が＋でなければ、単に地のドリフトを見ているだけ＝SQ固有のエッジではない。')
  console.log('※n=メジャー約80/ミニ約160。ベース差が小さく符号もバラつくなら兆候未満。')
}
main().catch(e => { console.error(e); process.exit(1) })
