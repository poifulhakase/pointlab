#!/usr/bin/env node
// イベントドリブン（3月配当：権利確定への上昇／権利落ちの下落）の季節性検証（R&D）
// Yahoo ^N225（現物指数）日次20年。年ごとに3月後半の窓リターンを集計。
// 問い: 「権利確定に向けたブル」「権利落ちのベア」は20年で再現性があるか・大きさは。
// ⚠ 重要: 現物指数は権利落ちで配当分だけ機械的に下落するが、先物は予め織り込む。
//   レバETF(日経レバ等)は現物の日次%に連動＝現物の落ちは反映される。先物単体トレードでは別。
// 使い方: node scripts/analyze-event-seasonal.mjs

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
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }

async function main() {
  console.log('[fetch] Yahoo ^N225 日次20年...')
  const rows = await fetchDaily()
  console.log(`  → ${rows.length}営業日 (${rows[0].date} 〜 ${rows[rows.length - 1].date})`)

  // 年→その年の行リスト
  const byYear = {}
  for (const r of rows) { const y = r.date.slice(0, 4); (byYear[y] ||= []).push(r) }
  // 指定 MM-DD 以前(以下)で最後の営業日の close
  const closeOnOrBefore = (yr, mmdd) => {
    const list = byYear[yr]; if (!list) return null
    const target = `${yr}-${mmdd}`
    let best = null
    for (const r of list) { if (r.date <= target) best = r; else break }
    return best ? best.close : null
  }
  // 指定 MM-DD 以降で最初の営業日の close
  const closeOnOrAfter = (yr, mmdd) => {
    const list = byYear[yr]; if (!list) return null
    const target = `${yr}-${mmdd}`
    for (const r of list) if (r.date >= target) return r.close
    return null
  }

  // 窓: [ラベル, start取得関数, end取得関数, 方向]（dirは表示用＝ブル期待かベア期待か）
  const windows = [
    ['A 権利確定への上昇 3/15→3/27', y => closeOnOrAfter(y, '03-15'), y => closeOnOrBefore(y, '03-27'), 'bull'],
    ['B 権利落ち跨ぎ      3/27→4/03', y => closeOnOrBefore(y, '03-27'), y => closeOnOrAfter(y, '04-03'), 'bear'],
    ['C 配当再投資の初動  4/01→4/10', y => closeOnOrAfter(y, '04-01'), y => closeOnOrBefore(y, '04-10'), 'bull'],
    ['D 3月後半フル      3/15→3/31', y => closeOnOrAfter(y, '03-15'), y => closeOnOrBefore(y, '03-31'), 'bull'],
    ['E 権利落ち単日近辺  3/27→3/31', y => closeOnOrBefore(y, '03-27'), y => closeOnOrAfter(y, '03-31'), 'bear'],
    // 年またぎ（タックスロスセリング→年明け上昇／1月効果）。endは翌年。
    ['F 損出し→年明け    12/22→翌1/12', y => closeOnOrAfter(y, '12-22'), y => closeOnOrBefore(String(+y + 1), '01-12'), 'bull'],
    ['G 年末ラリー       12/15→12/30', y => closeOnOrAfter(y, '12-15'), y => closeOnOrBefore(y, '12-30'), 'bull'],
    ['H 年明け初動       翌1/04→翌1/12', y => closeOnOrAfter(String(+y + 1), '01-04'), y => closeOnOrBefore(String(+y + 1), '01-12'), 'bull'],
  ]

  const years = Object.keys(byYear).filter(y => +y >= 2006 && +y <= 2025).sort()

  for (const [label, fStart, fEnd, dir] of windows) {
    const rets = []
    const detail = []
    for (const y of years) {
      const s = fStart(y), e = fEnd(y)
      if (s == null || e == null) continue
      const ret = (e - s) / s * 100
      rets.push(ret); detail.push(`${y}:${r2(ret)}`)
    }
    const pnl = dir === 'bear' ? rets.map(r => -r) : rets   // ベア窓はショート損益で見る
    const up = pnl.filter(v => v > 0).length
    console.log(`\n【${label}】 (${dir === 'bull' ? 'ロング目線' : 'ショート目線'})`)
    console.log(`  n=${pnl.length}年  平均=${r2(mean(pnl))}%  中央=${r2(median(pnl))}%  勝(順行)=${up}/${pnl.length} (${Math.round(up/pnl.length*100)}%)  最良=${r2(Math.max(...pnl))}  最悪=${r2(Math.min(...pnl))}`)
    console.log(`  年別(素のリターン%): ${detail.join('  ')}`)
  }

  console.log('\n※n=20（年1回）＝統計的信頼は低い。再現性の“傾向”を見るもの。')
  console.log('※現物指数ベース。権利落ちの機械的下落を含む＝先物単体では織り込み済みで取れない。')
  console.log('※レバETFは現物日次%連動なので現物の動きが反映される（手数料・1日リバランス減価は別途）。')
}
main().catch(e => { console.error(e); process.exit(1) })
