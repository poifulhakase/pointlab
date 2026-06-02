#!/usr/bin/env node
// 権利落ち日の「配当落ちの埋め具合（実質リターン）」が翌日以降を当てるか（R&D）
// 仮説: 実質リターン = 見かけのリターン + 配当落ち分。これがプラス(埋めて余りある=実需強い)なら
//       翌N日ブル / マイナス(埋めきれず実質も売り)なら弱い、を先行指標に使えるか。
// 配当落ち近似: 3月末 ≈ 0.70% / 9月末 ≈ 0.55%（ユーザー提供の実勢値）
// 権利落ち日 = 3月末/9月末の最終営業日の「直前の権利付最終日」の翌営業日 ≈ 月末2営業日前あたり。
//   ここでは簡便に「3月/9月の最終営業日の1営業日前(=権利落ち日相当)」を基準にし感応性も見る。
// 使い方: node scripts/analyze-exdiv-fill.mjs

const P2 = Math.floor(Date.now() / 1000), P1 = P2 - 21 * 365 * 24 * 3600
async function fetchDaily() {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EN225?period1=${P1}&period2=${P2}&interval=1d`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }, signal: AbortSignal.timeout(30000) })
  const j = await res.json(); const r = j.chart.result[0]
  const ts = r.timestamp, cl = r.indicators.quote[0].close
  const rows = []
  for (let i = 0; i < ts.length; i++) if (cl[i] != null) rows.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: cl[i] })
  return rows
}
const r2 = v => v == null ? null : Math.round(v * 100) / 100
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null

async function main() {
  console.log('[fetch] Yahoo ^N225 日次20年...')
  const rows = await fetchDaily()
  console.log(`  → ${rows.length}営業日`)
  const dates = rows.map(r => r.date)
  const idxOnOrBefore = t => { let lo = 0, hi = dates.length - 1, a = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (dates[m] <= t) { a = m; lo = m + 1 } else hi = m - 1 } return a }
  const dayRet = i => i > 0 ? (rows[i].close - rows[i - 1].close) / rows[i - 1].close * 100 : null
  const fwd = (i, n) => (i + n < rows.length) ? (rows[i + n].close - rows[i].close) / rows[i].close * 100 : null

  // 各年の権利落ち日(近似)を特定: 3月/9月の最終営業日の「1営業日前」を権利落ち日とみなす
  // （権利付最終日=月末最終営業日の2営業日前→翌営業日が権利落ち≈月末1営業日前）
  const byYM = {}
  for (let k = 0; k < rows.length; k++) { const ym = rows[k].date.slice(0, 7); (byYM[ym] ||= []).push(k) }
  const exDays = []  // { year, month(3/9), idx, div }
  for (let y = 2005; y <= 2026; y++) for (const [m, div] of [[3, 0.70], [9, 0.55]]) {
    const ym = `${y}-${String(m).padStart(2, '0')}`
    const idxs = byYM[ym]; if (!idxs || idxs.length < 3) continue
    const lastIdx = idxs[idxs.length - 1]            // 月末最終営業日
    const exIdx = lastIdx - 1                          // その1営業日前 ≈ 権利落ち日
    if (exIdx < 1 || exIdx > rows.length - 6) continue
    exDays.push({ year: y, month: m, idx: exIdx, div })
  }
  console.log(`権利落ち日(近似): ${exDays.length}件 (3月${exDays.filter(e=>e.month===3).length}/9月${exDays.filter(e=>e.month===9).length})`)

  // 実質リターン = 見かけの当日リターン + 配当落ち分
  // 仮説検証: 実質>0 群 と 実質<=0 群で、先1/3/5日リターンに差が出るか
  const enriched = exDays.map(e => {
    const apparent = dayRet(e.idx)
    const real = apparent == null ? null : apparent + e.div   // 配当落ち分を足し戻す
    return { ...e, apparent, real, f1: fwd(e.idx, 1), f3: fwd(e.idx, 3), f5: fwd(e.idx, 5) }
  }).filter(e => e.real != null && e.f5 != null)

  const grp = (arr, label) => {
    const f1 = arr.map(x => x.f1).filter(v => v != null)
    const f3 = arr.map(x => x.f3).filter(v => v != null)
    const f5 = arr.map(x => x.f5).filter(v => v != null)
    const up = n => arr.filter(x => x['f' + n] != null && x['f' + n] > 0).length
    console.log(`  ${label.padEnd(34)} n=${String(arr.length).padStart(3)}  先1日[${String(r2(mean(f1))).padStart(5)}%,上${Math.round(up(1)/f1.length*100)}%] 先3日[${String(r2(mean(f3))).padStart(5)}%,上${Math.round(up(3)/f3.length*100)}%] 先5日[${String(r2(mean(f5))).padStart(5)}%,上${Math.round(up(5)/f5.length*100)}%]`)
  }

  console.log('\n========== 仮説: 実質リターン(見かけ+配当落ち)で層別 → 翌日以降 ==========')
  console.log('  ※実質>0=配当落ちを埋めて余りある(実需強い) / 実質<=0=埋めきれず実質も売り')
  grp(enriched, '全権利落ち日')
  grp(enriched.filter(e => e.real > 0), '実質プラス（埋めて余りある）')
  grp(enriched.filter(e => e.real <= 0), '実質マイナス（埋めきれず）')

  console.log('\n========== 参考: 見かけのリターン符号で層別（読み替えをしない素朴版）==========')
  grp(enriched.filter(e => e.apparent > 0), '見かけプラス')
  grp(enriched.filter(e => e.apparent <= 0), '見かけマイナス')

  console.log('\n========== 3月のみ（配当落ち大）==========')
  const mar = enriched.filter(e => e.month === 3)
  grp(mar.filter(e => e.real > 0), '3月・実質プラス')
  grp(mar.filter(e => e.real <= 0), '3月・実質マイナス')

  console.log('\n⚠ n≈40(3月のみ20)・配当落ちは固定近似(3月0.70/9月0.55)・権利落ち日も近似。兆候レベル。')
}
main().catch(e => { console.error(e); process.exit(1) })
