#!/usr/bin/env node
// 1月効果を現物^N225・20年・ベース比較で検証（R&D）。複数の1月窓＋年末からの持ち越し。
// 使い方: node scripts/analyze-january.mjs

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

async function main() {
  console.log('[fetch] ^N225 20年...')
  const rows = await fetchSym('^N225')
  const dates = rows.map(r => r.date)
  const onOrAfter = t => { for (let i = 0; i < rows.length; i++) if (dates[i] >= t) return i; return -1 }
  const onOrBefore = t => { let a = -1; for (let i = 0; i < rows.length; i++) { if (dates[i] <= t) a = i; else break } return a }

  // 営業日数で見た窓リターンの「無条件ベースライン」(近似: 同程度の営業日数Nの平均)
  const baseDays = N => { const v = []; for (let i = 0; i + N < rows.length; i++) v.push((rows[i + N].close - rows[i].close) / rows[i].close * 100); return { avg: r2(mean(v)), up: Math.round(v.filter(x => x > 0).length / v.length * 100) } }

  // 窓: [ラベル, start(年y), end(年y or y+1), 想定営業日数]
  const windows = [
    ['年明け初動 1/4→1/12', y => onOrAfter(`${y}-01-04`), y => onOrBefore(`${y}-01-12`), 6],
    ['1月前半 1/4→1/20', y => onOrAfter(`${y}-01-04`), y => onOrBefore(`${y}-01-20`), 11],
    ['1月フル 1/4→1/31', y => onOrAfter(`${y}-01-04`), y => onOrBefore(`${y}-01-31`), 19],
    ['損出し→年明け 12/25→1/12', y => onOrAfter(`${y - 1}-12-25`), y => onOrBefore(`${y}-01-12`), 11],
  ]
  console.log('\n========== 1月効果（複数窓）vs 無条件ベースライン ==========')
  for (const [lbl, fS, fE, days] of windows) {
    const bl = baseDays(days)
    const v = []
    for (let y = 2006; y <= 2026; y++) { const s = fS(y), e = fE(y); if (s >= 0 && e > s) v.push((rows[e].close - rows[s].close) / rows[s].close * 100) }
    const up = Math.round(v.filter(x => x > 0).length / v.length * 100)
    const edge = r2(mean(v) - bl.avg)
    console.log(`  ${lbl.padEnd(24)} 平均${String(r2(mean(v))).padStart(6)}% 上昇率${up}%  (ベース≈${days}日 ${bl.avg}%/${bl.up}%・差${edge>0?'+':''}${edge}pt)  n=${v.length}`)
  }
  console.log('\n※学術的1月効果は小型株現象。日経225(大型)では出にくい。ベース差＋でなければエッジ無し。n=20。')
}
main().catch(e => { console.error(e); process.exit(1) })
