#!/usr/bin/env node
// 権利落ち日に、ユーザーが実際に取引する「ベア2倍(1357)/ブル2倍(1570)」が本当に動くか直接実測（R&D）
// 問い: ベア2倍は権利落ち日に上がる(現物の落ちを2倍で取れる)のか？ それとも先物追従で上がらないのか？
// ^N225(現物)・1357.T(ダブルインバース=ベア2倍)・1570.T(レバ=ブル2倍)を取得。TSE同一カレンダー。
// 使い方: node scripts/analyze-exdiv-etf.mjs

const P2 = Math.floor(Date.now() / 1000), P1 = P2 - 15 * 365 * 24 * 3600
async function fetchSym(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?period1=${P1}&period2=${P2}&interval=1d`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) })
  const j = await res.json(); const r = j?.chart?.result?.[0]
  if (!r) throw new Error(`no result ${sym}`)
  const ts = r.timestamp, cl = r.indicators.quote[0].close
  const m = new Map()
  for (let i = 0; i < ts.length; i++) if (cl[i] != null) m.set(new Date(ts[i] * 1000).toISOString().slice(0, 10), cl[i])
  return m
}
const r2 = v => v == null ? null : Math.round(v * 100) / 100
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null

async function main() {
  console.log('[fetch] ^N225 / 1357.T(ベア2倍) / 1570.T(ブル2倍) 逐次...')
  const cash = await fetchSym('^N225'); await new Promise(r => setTimeout(r, 1500))
  const bear = await fetchSym('1357.T'); await new Promise(r => setTimeout(r, 1500))
  const bull = await fetchSym('1570.T')
  console.log(`  現物${cash.size} / ベア2倍${bear.size} / ブル2倍${bull.size}`)

  const dates = [...cash.keys()].sort()
  // 権利落ち日(近似)= 3月/9月の最終営業日の1営業日前
  const byYM = {}
  dates.forEach((d, i) => { const ym = d.slice(0, 7); (byYM[ym] ||= []).push(i) })
  const exDays = []
  for (let y = 2012; y <= 2026; y++) for (const m of [3, 9]) {
    const ym = `${y}-${String(m).padStart(2, '0')}`; const idxs = byYM[ym]; if (!idxs || idxs.length < 3) continue
    const exI = idxs[idxs.length - 1] - 1; if (exI < 1) continue
    exDays.push({ year: y, month: m, date: dates[exI], prev: dates[exI - 1] })
  }

  // 当日リターン（前日終値→当日終値）を各シリーズで
  const ret = (map, prevD, curD) => { const a = map.get(prevD), b = map.get(curD); return (a != null && b != null) ? (b - a) / a * 100 : null }

  console.log('\n========== 権利落ち日の当日リターン（実測平均）==========')
  console.log('  現物が落ち、ベア2倍が「現物の約−2倍＝プラス」なら“取れる”。ベア2倍も≒0なら“取れない(先物追従)”')
  for (const [label, m] of [['3月末', 3], ['9月末', 9]]) {
    const set = exDays.filter(e => e.month === m && bear.has(e.date) && bear.has(e.prev))
    const cR = set.map(e => ret(cash, e.prev, e.date)).filter(v => v != null)
    const beR = set.map(e => ret(bear, e.prev, e.date)).filter(v => v != null)
    const buR = set.map(e => ret(bull, e.prev, e.date)).filter(v => v != null)
    const expBear = cR.length ? r2(mean(cR) * -2) : null
    console.log(`  ${label}: 現物 ${String(r2(mean(cR))).padStart(6)}%  → 理論ベア2倍 ${String(expBear).padStart(6)}%  ／ 実測ベア2倍(1357) ${String(r2(mean(beR))).padStart(6)}%  ブル2倍(1570) ${String(r2(mean(buR))).padStart(6)}%  (n${beR.length})`)
  }

  console.log('\n========== ベア2倍(1357)を「権利落ち日に持つ」損益（前日終値で買い→当日/翌日終値で売り）==========')
  const hold = (map, prevD, curD, fwdN, allDates) => {
    const entry = map.get(prevD); if (entry == null) return null
    const ci = allDates.indexOf(curD); if (ci < 0 || ci + fwdN >= allDates.length) return null
    const exit = map.get(allDates[ci + fwdN]); return exit != null ? (exit - entry) / entry * 100 : null
  }
  for (const [label, m] of [['3月末', 3], ['9月末', 9], ['両方', 0]]) {
    const set = exDays.filter(e => (m === 0 || e.month === m) && bear.has(e.prev))
    for (const [hl, fn] of [['ex当日まで', 0], ['ex+1日', 1], ['ex+3日', 3]]) {
      const pnl = set.map(e => hold(bear, e.prev, e.date, fn, dates)).filter(v => v != null)
      const win = pnl.filter(v => v > 0).length
      console.log(`  ${label.padEnd(5)} 1357保有 ${hl.padEnd(8)} n=${String(pnl.length).padStart(2)} 平均${String(r2(mean(pnl))).padStart(6)}% 勝率${pnl.length?Math.round(win/pnl.length*100):0}%`)
    }
  }
  console.log('\n⚠ n≈10〜14(3月のみ約10)・権利落ち日は近似。ETFは2014/2012〜＝20年は無い。兆候レベル。')
}
main().catch(e => { console.error(e); process.exit(1) })
