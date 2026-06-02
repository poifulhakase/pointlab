#!/usr/bin/env node
// 検証済み3エッジを1システムに組んだ損益バックテスト（R&D・関門②）
// エッジ: ①−極限買い(25日線乖離≤-7%/-10%・N日保有) ②権利確定ブル(3/15→3/27) ③年末ラリー(12/15→12/30)
// ロングのみ・基本ブル。2倍(日次2x複利・ボラ減価込み)。コスト往復控除。B&H/2x常時とベンチ比較。
// 使い方: node scripts/backtest-system-v1.mjs
// ⚠ 価格20年・季節性はn=20。最大DDと年トレード数を必ず見る（50%との距離を測る）。

const P2 = Math.floor(Date.now() / 1000), P1 = P2 - 21 * 365 * 24 * 3600
async function fetchDaily() {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EN225?period1=${P1}&period2=${P2}&interval=1d`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }, signal: AbortSignal.timeout(30000) })
  const j = await res.json(); const r = j.chart.result[0]
  const ts = r.timestamp, cl = r.indicators.quote[0].close
  const rows = []
  for (let i = 0; i < ts.length; i++) if (cl[i] != null) rows.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: cl[i] })
  for (let i = 0; i < rows.length; i++) { if (i >= 24) { let s = 0; for (let k = 0; k < 25; k++) s += rows[i - k].close; rows[i].dev = (rows[i].close - s / 25) / (s / 25) * 100 } }
  return rows
}
const r2 = v => Math.round(v * 100) / 100
const secondFridayUnused = 0

// 日次リターン系列から指標
function stats(dailyR, label, yrs) {
  let eq = 1, peak = 1, maxDD = 0
  for (const r of dailyR) { eq *= (1 + r); peak = Math.max(peak, eq); maxDD = Math.min(maxDD, eq / peak - 1) }
  const cagr = Math.pow(eq, 1 / yrs) - 1
  return { label, total: r2((eq - 1) * 100), cagr: r2(cagr * 100), maxDD: r2(maxDD * 100) }
}

async function main() {
  console.log('[fetch] Yahoo ^N225 日次20年...')
  const rows = await fetchDaily()
  const n = rows.length, yrs = n / 245
  console.log(`  → ${n}営業日 ≈ ${r2(yrs)}年 (${rows[0].date}〜${rows[n-1].date})`)
  const COST = 0.0008  // 往復0.08%（エントリー+エグジットで控除）
  const LEV = 2        // 日次2倍

  // 各日の「日経1倍リターン」
  const dret = i => i > 0 ? (rows[i].close - rows[i - 1].close) / rows[i - 1].close : 0

  // ポジション在否ベクトルを作る（在=1, 不在=0）。重複エントリーは在のまま延長。
  // 季節性窓: 月日で in/out
  const mmdd = i => rows[i].date.slice(5)
  const inDateWin = (i, s, e) => mmdd(i) >= s && mmdd(i) <= e

  function buildPositions(devThr, holdN) {
    const pos = new Array(n).fill(0)
    const entries = []   // エントリー記録（コスト計上用の建/落タイミング）
    // ①−極限買い: dev<=devThr でエントリー、holdN営業日保有（保有中の重複シグナルは保有延長）
    let holdUntil = -1
    for (let i = 25; i < n; i++) {
      if (rows[i].dev != null && rows[i].dev <= devThr) {
        if (i > holdUntil) entries.push({ type: 'dip', enter: i })
        holdUntil = Math.max(holdUntil, i + holdN)
      }
      if (i <= holdUntil) pos[i] = 1
    }
    // ②権利確定ブル 3/15→3/27 ③年末ラリー 12/15→12/30
    for (let i = 0; i < n; i++) {
      const inSeason = inDateWin(i, '03-15', '03-27') || inDateWin(i, '12-15', '12-30')
      if (inSeason) pos[i] = 1
    }
    return pos
  }

  // ポジション系列→日次戦略リターン（2倍・コストは建落の日に控除）
  function strategyReturns(pos) {
    const dr = []
    for (let i = 1; i < n; i++) {
      let r = pos[i - 1] ? LEV * dret(i) : 0          // 前日終値で建てた分が今日動く
      // 建て(0→1)・落ち(1→0)の遷移日にコスト
      if (pos[i - 1] !== (pos[i - 2] ?? 0)) r -= COST
      dr.push(r)
    }
    return dr
  }
  function tradeCount(pos) { let c = 0; for (let i = 1; i < n; i++) if (pos[i] && !pos[i - 1]) c++; return c }
  function exposure(pos) { return pos.reduce((a, b) => a + b, 0) / pos.length }

  // ベンチマーク
  const bh = []; for (let i = 1; i < n; i++) bh.push(dret(i))
  const bh2 = bh.map(r => 2 * r)
  console.log('\n========== ベンチマーク ==========')
  console.log(' ', stats(bh, '日経B&H(1倍)', yrs))
  console.log(' ', stats(bh2, '2倍 常時ロング', yrs))

  console.log('\n========== システムv1（−極限買い＋季節性・2倍・コスト込み）==========')
  for (const devThr of [-7, -10]) {
    for (const holdN of [3, 5, 10]) {
      const pos = buildPositions(devThr, holdN)
      const dr = strategyReturns(pos)
      const s = stats(dr, `dev<=${devThr} / ${holdN}日保有`, yrs)
      console.log(`  ${s.label.padEnd(22)} CAGR ${String(s.cagr).padStart(6)}%  最大DD ${String(s.maxDD).padStart(7)}%  累積 ${String(s.total).padStart(8)}%  市場滞在 ${Math.round(exposure(pos)*100)}%  建玉回数 ${tradeCount(pos)}(${r2(tradeCount(pos)/yrs)}/年)`)
    }
  }
  console.log('\n※2倍=日次2倍複利(ボラ減価込み)。コスト往復0.08%。ロングのみ・基本ブル。')
  console.log('※季節性はn=20・価格edgeは20年。最大DDが生存可能かが50%判断の鍵。')
}
main().catch(e => { console.error(e); process.exit(1) })
