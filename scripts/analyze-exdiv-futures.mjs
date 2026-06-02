#!/usr/bin/env node
// 権利落ちを「現物(^N225) vs 先物(NIY=F)」で直接比較（R&D・ユーザー指摘で先物実測）
// ① 権利落ち日の当日リターン平均：現物は機械的に落ちる／先物は落ちないを実証
// ② 先物の権利落ち日リターン符号 → 翌1/3/5日（先物での momentum シグナル検証）
// 使い方: node scripts/analyze-exdiv-futures.mjs

const P2 = Math.floor(Date.now() / 1000), P1 = P2 - 21 * 365 * 24 * 3600
async function fetchSym(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?period1=${P1}&period2=${P2}&interval=1d`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) })
  const j = await res.json(); const r = j?.chart?.result?.[0]
  if (!r) throw new Error(`no result for ${sym}: ${JSON.stringify(j?.chart?.error || j).slice(0,120)}`)
  const ts = r.timestamp, cl = r.indicators.quote[0].close
  const rows = []
  for (let i = 0; i < ts.length; i++) if (cl[i] != null) rows.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: cl[i] })
  return rows
}
const r2 = v => v == null ? null : Math.round(v * 100) / 100
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null

// 配列に対して権利落ち日(近似=3月/9月の最終営業日の1営業日前)の index を返す
function exDayIdxs(rows) {
  const byYM = {}
  for (let k = 0; k < rows.length; k++) { const ym = rows[k].date.slice(0, 7); (byYM[ym] ||= []).push(k) }
  const out = []
  for (let y = 2005; y <= 2026; y++) for (const m of [3, 9]) {
    const ym = `${y}-${String(m).padStart(2, '0')}`
    const idxs = byYM[ym]; if (!idxs || idxs.length < 3) continue
    const exIdx = idxs[idxs.length - 1] - 1
    if (exIdx < 1 || exIdx > rows.length - 6) continue
    out.push({ year: y, month: m, idx: exIdx })
  }
  return out
}

async function main() {
  console.log('[fetch] 現物^N225 と 先物NIY=F ...（逐次）')
  const cash = await fetchSym('^N225')
  await new Promise(r => setTimeout(r, 1500))
  const fut = await fetchSym('NIY=F')
  console.log(`  現物 ${cash.length}本 / 先物 ${fut.length}本`)
  const dret = (rows, i) => i > 0 ? (rows[i].close - rows[i - 1].close) / rows[i - 1].close * 100 : null
  const fwd = (rows, i, n) => (i + n < rows.length) ? (rows[i + n].close - rows[i].close) / rows[i].close * 100 : null

  // ① 権利落ち日の当日リターン平均（現物 vs 先物）
  console.log('\n========== ① 権利落ち日の当日リターン：現物 vs 先物 ==========')
  for (const [label, m] of [['3月末', 3], ['9月末', 9]]) {
    const cashEx = exDayIdxs(cash).filter(e => e.month === m).map(e => dret(cash, e.idx)).filter(v => v != null)
    const futEx  = exDayIdxs(fut ).filter(e => e.month === m).map(e => dret(fut , e.idx)).filter(v => v != null)
    console.log(`  ${label}: 現物 平均${r2(mean(cashEx))}% (n${cashEx.length})  ／  先物 平均${r2(mean(futEx))}% (n${futEx.length})`)
  }
  console.log('  → 現物がマイナス・先物が≒0 なら「機械的下落は現物のみ／先物は織り込み済み」を実証')

  // ② 先物の権利落ち日リターン符号 → 翌日以降（先物での momentum 検証）
  console.log('\n========== ② 先物の権利落ち日リターン符号 → 翌1/3/5日（先物で実測）==========')
  const ex = exDayIdxs(fut).map(e => ({ ...e, d0: dret(fut, e.idx), f1: fwd(fut, e.idx, 1), f3: fwd(fut, e.idx, 3), f5: fwd(fut, e.idx, 5) })).filter(e => e.d0 != null && e.f5 != null)
  const grp = (arr, label) => {
    const f1 = arr.map(x => x.f1).filter(v => v != null), f3 = arr.map(x => x.f3).filter(v => v != null), f5 = arr.map(x => x.f5).filter(v => v != null)
    const up = n => arr.filter(x => x['f' + n] != null && x['f' + n] > 0).length
    console.log(`  ${label.padEnd(28)} n=${String(arr.length).padStart(3)}  先1[${String(r2(mean(f1))).padStart(5)}%,上${Math.round(up(1)/f1.length*100)}%] 先3[${String(r2(mean(f3))).padStart(5)}%,上${Math.round(up(3)/f3.length*100)}%] 先5[${String(r2(mean(f5))).padStart(5)}%,上${Math.round(up(5)/f5.length*100)}%]`)
  }
  grp(ex, '全権利落ち日(先物)')
  grp(ex.filter(e => e.d0 > 0), '先物ex日プラス')
  grp(ex.filter(e => e.d0 <= 0), '先物ex日マイナス')
  const mar = ex.filter(e => e.month === 3)
  grp(mar.filter(e => e.d0 > 0), '3月のみ・先物ex日プラス')
  grp(mar.filter(e => e.d0 <= 0), '3月のみ・先物ex日マイナス')

  console.log('\n⚠ 先物=CME NIY=F(円建て連続)。CME暦でTSEと祝日差あり＝権利落ち日近似に微ズレ。n≈40(3月20)＝兆候レベル。')
}
main().catch(e => { console.error(e); process.exit(1) })
