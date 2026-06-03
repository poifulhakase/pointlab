#!/usr/bin/env node
// 頻度問題：短い時間軸の乖離（5日/10日MA）を“確定下落でない時だけ”撃つと、
//          v5a（本線・CAGR10.2%/DD-38%）に頻度とリターンを安全に足せるか。
// 背景: 第15で「MA5/10を素朴に足すと CAGR9→0.5%/DD-75% に崩壊（底投げ）」と判明。
//       但しそれはv4の濾し(確定下落中は撃たない)を知る前。今回はゲート付きで再評価。
// 測るもの: ①各短期ディップの生エッジ(勝率/期待値/年回数・ゲート有無) ②v5aに足した時のCAGR/DD
// 使い方: node scripts/analyze-frequency-edges.mjs

const P2 = Math.floor(Date.now() / 1000), P1 = P2 - 21 * 365 * 24 * 3600
async function fetchDaily() {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EN225?period1=${P1}&period2=${P2}&interval=1d`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }, signal: AbortSignal.timeout(30000) })
  const j = await res.json(); const r = j.chart.result[0]
  const ts = r.timestamp, cl = r.indicators.quote[0].close
  const rows = []
  for (let i = 0; i < ts.length; i++) if (cl[i] != null) rows.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: cl[i] })
  const sma = (i, w) => { if (i < w - 1) return null; let s = 0; for (let k = 0; k < w; k++) s += rows[i - k].close; return s / w }
  const dev = (i, w) => { const m = sma(i, w); return m == null ? null : (rows[i].close - m) / m * 100 }
  for (let i = 0; i < rows.length; i++) {
    rows[i].dev5 = dev(i, 5); rows[i].dev10 = dev(i, 10); rows[i].dev25 = dev(i, 25)
    rows[i].sma200 = sma(i, 200)
  }
  return rows
}
const r2 = v => Math.round(v * 100) / 100

async function main() {
  console.log('[fetch] Yahoo ^N225 日次20年...')
  const rows = await fetchDaily()
  const n = rows.length, yrs = n / 245
  console.log(`  → ${n}営業日 ≈ ${r2(yrs)}年`)
  const COST = 0.0004
  const dret = i => (rows[i].close - rows[i - 1].close) / rows[i - 1].close
  const mmdd = i => rows[i].date.slice(5)
  const inSeason = i => (mmdd(i) >= '03-15' && mmdd(i) <= '03-27') || (mmdd(i) >= '12-15' && mmdd(i) <= '12-30')

  // ドンチャン50/25 ロング状態 と ベア状態（確定下落）
  const trendLong = new Array(n).fill(false), trendBear = new Array(n).fill(false)
  { let s = 0
    for (let i = 50; i < n; i++) {
      let hi = -Infinity, exLo = Infinity
      for (let k = 1; k <= 50; k++) hi = Math.max(hi, rows[i - k].close)
      for (let k = 1; k <= 25; k++) exLo = Math.min(exLo, rows[i - k].close)
      const cc = rows[i].close
      if (s === 0 && cc > hi) s = 1; else if (s === 1 && cc < exLo) s = 0
      trendLong[i] = s === 1
    }
  }
  { let s = 0
    for (let i = 50; i < n; i++) {
      let lo = Infinity, exHi = -Infinity
      for (let k = 1; k <= 50; k++) lo = Math.min(lo, rows[i - k].close)
      for (let k = 1; k <= 25; k++) exHi = Math.max(exHi, rows[i - k].close)
      const cc = rows[i].close
      if (s === 0 && cc < lo) s = 1; else if (s === 1 && cc > exHi) s = 0
      trendBear[i] = s === 1
    }
  }
  const gNotBear = i => !trendBear[i]

  // ── ① 生エッジ測定：トリガー(乖離≤閾値)の翌日から hold 日の単純フォワードリターン ──
  function rawEdge(field, thr, hold, gate) {
    let cnt = 0, win = 0, sum = 0
    for (let i = 25; i < n - hold; i++) {
      const v = rows[i][field]
      if (v == null || v > thr) continue
      if (gate && !gate(i)) continue
      // i の翌日寄り≈終値で入り、hold 日後の終値で出る簡易計算（終値→終値）
      const ret = (rows[i + hold].close - rows[i].close) / rows[i].close * 100
      cnt++; if (ret > 0) win++; sum += ret
    }
    return { n: cnt, perYear: r2(cnt / yrs), win: cnt ? Math.round(win / cnt * 100) : 0, avg: cnt ? r2(sum / cnt) : 0 }
  }

  console.log('\n========== ① 生エッジ（乖離トリガー→5日後の終値リターン）==========')
  console.log('  [ゲート無し]                                 n      回/年  勝率   平均5日')
  for (const [f, thr] of [['dev5', -3], ['dev5', -5], ['dev10', -5], ['dev10', -7], ['dev25', -7], ['dev25', -10]]) {
    const e = rawEdge(f, thr, 5, null)
    console.log(`    ${f} ≤ ${String(thr).padStart(3)}%   ${String(e.n).padStart(5)}  ${String(e.perYear).padStart(6)}  ${String(e.win).padStart(3)}%  ${String(e.avg).padStart(6)}%`)
  }
  console.log('  [ゲート有り＝確定下落でない時だけ]            n      回/年  勝率   平均5日')
  for (const [f, thr] of [['dev5', -3], ['dev5', -5], ['dev10', -5], ['dev10', -7], ['dev25', -7], ['dev25', -10]]) {
    const e = rawEdge(f, thr, 5, gNotBear)
    console.log(`    ${f} ≤ ${String(thr).padStart(3)}%   ${String(e.n).padStart(5)}  ${String(e.perYear).padStart(6)}  ${String(e.win).padStart(3)}%  ${String(e.avg).padStart(6)}%`)
  }

  // ── ② システムへの寄与：v5a に短期ディップ(ゲート付)を OR で足す ──
  function makeDip(field, thr, hold, gate) {
    const pos = new Array(n).fill(false); let until = -1
    for (let i = 25; i < n; i++) {
      if (rows[i][field] != null && rows[i][field] <= thr && (!gate || gate(i))) until = Math.max(until, i + hold)
      if (i <= until) pos[i] = true
    }
    return pos
  }
  const season = new Array(n).fill(false); for (let i = 0; i < n; i++) season[i] = inSeason(i) && gNotBear(i)
  const dip25 = makeDip('dev25', -10, 5, gNotBear)   // v5aの押し目

  function evalPos(posOf, lev, start) {
    let eq = 1, peak = 1, maxDD = 0, prev = false, daysIn = 0, trades = 0
    for (let i = start; i < n; i++) {
      if (posOf(i - 1)) { eq *= (1 + lev * dret(i)); daysIn++ }
      const now = posOf(i)
      if (now !== prev) { eq *= (1 - COST); if (now) trades++; prev = now }
      peak = Math.max(peak, eq); maxDD = Math.min(maxDD, eq / peak - 1)
    }
    return { cagr: r2((Math.pow(eq, 1 / yrs) - 1) * 100), maxDD: r2(maxDD * 100), expo: Math.round(daysIn / (n - start) * 100), perYear: r2(trades / yrs) }
  }
  const fmt = r => `CAGR ${String(r.cagr).padStart(6)}%  DD ${String(r.maxDD).padStart(7)}%  滞在${String(r.expo).padStart(3)}%  ${String(r.perYear).padStart(5)}回/年`

  const v5aBase = i => trendLong[i] || dip25[i] || season[i]
  console.log('\n========== ② v5a に短期ディップを足す（OR・全部ゲート付・2倍）==========')
  console.log('  v5a（基準・本線）            ', fmt(evalPos(v5aBase, 2, 200)))
  for (const [f, thr, hold] of [['dev10', -5, 5], ['dev10', -7, 5], ['dev5', -3, 3], ['dev5', -5, 3], ['dev5', -3, 5]]) {
    const d = makeDip(f, thr, hold, gNotBear)
    const sys = i => trendLong[i] || dip25[i] || season[i] || d[i]
    console.log(`  + ${f}≤${String(thr).padStart(3)}% (${hold}日保有) `.padEnd(30), fmt(evalPos(sys, 2, 200)))
  }

  // 参考: 全部入り（dev10-5 と dev5-3 を両方足す）
  {
    const a = makeDip('dev10', -5, 5, gNotBear), b = makeDip('dev5', -3, 3, gNotBear)
    const sys = i => trendLong[i] || dip25[i] || season[i] || a[i] || b[i]
    console.log('  + dev10≤-5 & dev5≤-3 両方       ', fmt(evalPos(sys, 2, 200)))
  }

  // ── ③ 20%への地図：システム×レバレッジ（どのDDで20%が現れるか）──
  // 頻度エッジ(dev10≤-5)を足した改良系、安全系(v5a)、許容DDを上げた系(ungated全部乗せ+短期)を比較
  const dip10g = makeDip('dev10', -5, 5, gNotBear)
  const sysSafe = i => trendLong[i] || dip25[i] || season[i]                       // v5a
  const sysFreq = i => trendLong[i] || dip25[i] || season[i] || dip10g[i]          // v5a+頻度
  // 許容DD系：ディップを濾さない（暴落にも買い向かう＝DD深いがリターン高い）＋短期も足す
  const dip25u = makeDip('dev25', -10, 5, null), dip10u = makeDip('dev10', -5, 5, null), seasonU = new Array(n).fill(false)
  for (let i = 0; i < n; i++) seasonU[i] = inSeason(i)
  const sysAggr = i => trendLong[i] || dip25u[i] || dip10u[i] || seasonU[i]
  console.log('\n========== ③ 20%への地図（システム×レバ・2倍/2.5倍/3倍）==========')
  for (const [label, sys] of [['安全系 v5a            ', sysSafe], ['頻度系 v5a+dev10≤-5   ', sysFreq], ['許容DD系 濾し無し+短期 ', sysAggr]]) {
    console.log(`  ${label}`)
    for (const lev of [2, 2.5, 3]) {
      const r = evalPos(sys, lev, 200)
      const hit = r.cagr >= 20 ? ' ★20%到達' : ''
      console.log(`     ${lev}倍  ${fmt(r)}${hit}`)
    }
  }

  console.log('\n※ロングのみ・コスト片道0.04%・20年イン・サンプル。基準=v5a(本線)に足してCAGRが上がりDDが-40%圏を保てるかを見る。')
  console.log('※閾値/保有日数は数点のみ提示＝最適化しない（過学習回避）。生エッジで勝率>55%かつ平均>0が足す価値の最低条件。')
}
main().catch(e => { console.error(e); process.exit(1) })
