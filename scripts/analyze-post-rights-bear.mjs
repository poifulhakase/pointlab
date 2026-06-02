#!/usr/bin/env node
// 「権利確定の上げ → 後半に下げる(ピーク後のショート余地)」を現物^N225・20年でベア目線検証（R&D）
// ETF12年の交絡(期間バイアス・2倍複利)を外し、現物の素のリターンで測る。
// ピーク基準 = 3月の権利付最終日(=月末2営業日前あたり)。そこからの先1/3/5日リターンを見る。
// ベア目線＝下げれば勝ち。配当落ちの機械的下落は「ピーク翌日(=権利落ち日)」に現物に出る点も併記。
// 使い方: node scripts/analyze-post-rights-bear.mjs

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
const DIV = { 3: 0.55, 9: 0.45 }  // 現物-先物ギャップ実測ベースの配当落ち近似(機械分を除く時に使用)

async function main() {
  console.log('[fetch] ^N225 現物20年...')
  const rows = await fetchSym('^N225')
  console.log(`  → ${rows.length}本`)
  const dates = rows.map(r => r.date)
  const byYM = {}; dates.forEach((d, i) => { const ym = d.slice(0, 7); (byYM[ym] ||= []).push(i) })
  const fwd = (i, n) => (i + n < rows.length) ? (rows[i + n].close - rows[i].close) / rows[i].close * 100 : null

  // ピーク基準日 = 3月/9月の「権利付最終日」近似 = 月末最終営業日の2営業日前
  // （その翌営業日が権利落ち日。ピーク=権利付最終日に置き、そこから売る想定）
  const peaks = []
  for (let y = 2005; y <= 2026; y++) for (const m of [3, 9]) {
    const ym = `${y}-${String(m).padStart(2, '0')}`; const idxs = byYM[ym]; if (!idxs || idxs.length < 4) continue
    const peakI = idxs[idxs.length - 1] - 2  // 月末2営業日前 ≈ 権利付最終日
    if (peakI < 1 || peakI > rows.length - 7) continue
    peaks.push({ year: y, month: m, idx: peakI })
  }
  console.log(`ピーク基準(権利付最終日近似): ${peaks.length}件 (3月${peaks.filter(p=>p.month===3).length}/9月${peaks.filter(p=>p.month===9).length})`)

  // ベア目線：ピークから先N日の「見かけリターン」と「配当落ち分を除いた実質リターン」
  // 見かけ：機械的下落を含む＝ベアに有利に見える / 実質：機械分を足し戻す＝真の方向
  const grp = (arr, label) => {
    for (const N of [1, 3, 5]) {
      const app = arr.map(p => fwd(p.idx, N)).filter(v => v != null)              // 見かけ
      const real = arr.map(p => { const r = fwd(p.idx, N); return r == null ? null : r + DIV[p.month] }).filter(v => v != null) // 機械分を足し戻し
      const bearWinApp = app.filter(v => v < 0).length      // ベア勝ち=下げ(見かけ)
      const bearWinReal = real.filter(v => v < 0).length    // ベア勝ち=実質も下げ
      console.log(`  ${label} 先${N}日: 見かけ平均${String(r2(mean(app))).padStart(6)}%(下落率${Math.round(bearWinApp/app.length*100)}%) ／ 実質平均${String(r2(mean(real))).padStart(6)}%(下落率${Math.round(bearWinReal/real.length*100)}%)  n=${app.length}`)
    }
  }
  console.log('\n========== ピーク(権利付最終日近似)からのベア目線リターン ==========')
  console.log('  見かけ=機械的配当落ちを含む(ベアに有利に見える) / 実質=配当分を足し戻した真の方向')
  console.log('  ベア視点なので「下落率が高い・平均がマイナス」ほどショート有利')
  grp(peaks, '全体')
  grp(peaks.filter(p => p.month === 3), '3月のみ')
  grp(peaks.filter(p => p.month === 9), '9月のみ')

  console.log('\n========== 参考：権利確定への上げ(15日前→ピーク)はあったか（ブル確認）==========')
  for (const [lbl, set] of [['全体', peaks], ['3月', peaks.filter(p => p.month === 3)]]) {
    const runup = set.map(p => p.idx - 10 >= 0 ? (rows[p.idx].close - rows[p.idx - 10].close) / rows[p.idx - 10].close * 100 : null).filter(v => v != null)
    console.log(`  ${lbl}: ピーク前10日リターン 平均${r2(mean(runup))}%（上昇率${Math.round(runup.filter(v=>v>0).length/runup.length*100)}%）n=${runup.length}`)
  }

  console.log('\n⚠ n≈42(3月21)・ピーク日/配当落ち近似。見かけの下げは“配当の機械分”を含む＝実質で見ること。')
}
main().catch(e => { console.error(e); process.exit(1) })
