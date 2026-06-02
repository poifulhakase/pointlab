#!/usr/bin/env node
// システムv4「押し目買いをトレンドフィルターで濾す」: −極限買いを“確定下落トレンドでない時だけ”発動（AND）。
// 狙い: 全部乗せ(v3)のDD−62%の主因＝ディップがトレンド無視で暴落＝落ちるナイフに買い向かうこと。
//       これをゲートで止め、CAGR17%級を保ったままDDを−40%圏へ。「買える押し目 vs 落ちるナイフ」の実装。
// 問い: どのゲート定義が、ディップのエッジ(売られすぎ反発)を殺さずにDDだけ削れるか。
// 使い方: node scripts/backtest-system-v4.mjs

const P2 = Math.floor(Date.now() / 1000), P1 = P2 - 21 * 365 * 24 * 3600
async function fetchDaily() {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EN225?period1=${P1}&period2=${P2}&interval=1d`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }, signal: AbortSignal.timeout(30000) })
  const j = await res.json(); const r = j.chart.result[0]
  const ts = r.timestamp, cl = r.indicators.quote[0].close
  const rows = []
  for (let i = 0; i < ts.length; i++) if (cl[i] != null) rows.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: cl[i] })
  const sma = (i, w) => { if (i < w - 1) return null; let s = 0; for (let k = 0; k < w; k++) s += rows[i - k].close; return s / w }
  for (let i = 0; i < rows.length; i++) {
    const m25 = sma(i, 25); rows[i].dev25 = m25 == null ? null : (rows[i].close - m25) / m25 * 100
    rows[i].sma75 = sma(i, 75)
    rows[i].sma200 = sma(i, 200)
  }
  // 200日MAの傾き（20営業日前との比）
  for (let i = 0; i < rows.length; i++) {
    rows[i].sma200slope = (rows[i].sma200 != null && i >= 20 && rows[i - 20].sma200 != null)
      ? (rows[i].sma200 - rows[i - 20].sma200) : null
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

  // ── ドンチャン50/25 ロング状態（トレンドフィルター・v3と同一）──
  const trendLong = new Array(n).fill(false)
  { let s = 0
    for (let i = 50; i < n; i++) {
      let hi = -Infinity, exLo = Infinity
      for (let k = 1; k <= 50; k++) hi = Math.max(hi, rows[i - k].close)
      for (let k = 1; k <= 25; k++) exLo = Math.min(exLo, rows[i - k].close)
      const c = rows[i].close
      if (s === 0 && c > hi) s = 1
      else if (s === 1 && c < exLo) s = 0
      trendLong[i] = s === 1
    }
  }
  // ── ドンチャン50/25 ベア状態（確定下落トレンド・上の鏡像）──
  // 50日安値割れで下落入り、25日高値超えで解除。「確定下落」の機械的定義。
  const trendBear = new Array(n).fill(false)
  { let s = 0
    for (let i = 50; i < n; i++) {
      let lo = Infinity, exHi = -Infinity
      for (let k = 1; k <= 50; k++) lo = Math.min(lo, rows[i - k].close)
      for (let k = 1; k <= 25; k++) exHi = Math.max(exHi, rows[i - k].close)
      const c = rows[i].close
      if (s === 0 && c < lo) s = 1
      else if (s === 1 && c > exHi) s = 0
      trendBear[i] = s === 1
    }
  }

  // ── −極限買いの在庫フラグ生成（トリガーバーでゲート判定→通れば5日保有）──
  // gate(i)=true のときだけ dev25<=-10 のトリガーを有効化する
  function makeDip(gate) {
    const pos = new Array(n).fill(false)
    let until = -1
    for (let i = 25; i < n; i++) {
      if (rows[i].dev25 != null && rows[i].dev25 <= -10 && gate(i)) until = Math.max(until, i + 5)
      if (i <= until) pos[i] = true
    }
    return pos
  }

  // ゲート定義（「確定下落トレンドでない」の候補）
  const gAlways = () => true                                   // ゲート無し＝v3のディップ
  const gNotBear = i => !trendBear[i]                          // ドンチャン確定下落でない
  const gMa200 = i => rows[i].sma200 != null && rows[i].close > rows[i].sma200   // 200日MAより上
  const gSlope = i => rows[i].sma200slope != null && rows[i].sma200slope >= 0    // 200日MAが上向き
  const gMa75 = i => rows[i].sma75 != null && rows[i].close > rows[i].sma75      // 75日MAより上

  const dipRaw = makeDip(gAlways)
  const dipNotBear = makeDip(gNotBear)
  const dipMa200 = makeDip(gMa200)
  const dipSlope = makeDip(gSlope)
  const dipMa75 = makeDip(gMa75)

  const season = new Array(n).fill(false)
  for (let i = 0; i < n; i++) season[i] = inSeason(i)

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

  // ── ベンチマーク ──
  console.log('\n========== ベンチマーク ==========')
  console.log('  日経B&H 1倍      ', fmt(evalPos(() => true, 1, 200)))
  console.log('  日経B&H 2倍(常時) ', fmt(evalPos(() => true, 2, 200)))

  // ── ディップ単体: ゲート有無でDD/頻度がどう変わるか（2倍）──
  console.log('\n========== −極限買い単体：ゲート比較（2倍）==========')
  console.log('  ゲート無し(v3)         ', fmt(evalPos(i => dipRaw[i], 2, 200)))
  console.log('  ×確定下落でない(Donchian)', fmt(evalPos(i => dipNotBear[i], 2, 200)))
  console.log('  ×200日MAより上        ', fmt(evalPos(i => dipMa200[i], 2, 200)))
  console.log('  ×200日MA上向き        ', fmt(evalPos(i => dipSlope[i], 2, 200)))
  console.log('  ×75日MAより上         ', fmt(evalPos(i => dipMa75[i], 2, 200)))

  // ── 全部乗せ（OR: トレンド + 濾したディップ + 季節性）2倍 ──
  const all = dipFlag => i => trendLong[i] || dipFlag[i] || season[i]
  console.log('\n========== 全部乗せ（トレンド+ディップ+季節性・OR・ロングのみ・2倍）==========')
  console.log('  v3: ディップ濾し無し       ', fmt(evalPos(all(dipRaw), 2, 200)))
  console.log('  v4a: ×確定下落でない        ', fmt(evalPos(all(dipNotBear), 2, 200)))
  console.log('  v4b: ×200日MAより上        ', fmt(evalPos(all(dipMa200), 2, 200)))
  console.log('  v4c: ×200日MA上向き        ', fmt(evalPos(all(dipSlope), 2, 200)))
  console.log('  v4d: ×75日MAより上         ', fmt(evalPos(all(dipMa75), 2, 200)))

  // ── 勝ち候補のレバ違い（最後にコンソールで一番DD/CAGRバランスの良い案を手で選ぶ）──
  // ── v5: 季節性レッグも同じトレンドフィルターで濾す（確定下落中は季節買いも止める）──
  // 発見: -10ディップはほぼ全て確定下落中＝ゲートで激減。残DDの主因は季節性が暴落期(2008/12等)にも発火。
  const seasonG = gate => { const a = new Array(n).fill(false); for (let i = 0; i < n; i++) a[i] = season[i] && gate(i); return a }
  const seasonNotBear = seasonG(gNotBear)
  const seasonSlope = seasonG(gSlope)
  const allBoth = (dipFlag, seaFlag) => i => trendLong[i] || dipFlag[i] || seaFlag[i]
  console.log('\n========== v5: ディップ＋季節性の両方を濾す（OR・ロングのみ・2倍）==========')
  console.log('  v5a: ×確定下落でない(両方)   ', fmt(evalPos(allBoth(dipNotBear, seasonNotBear), 2, 200)))
  console.log('  v5c: ×200日MA上向き(両方)    ', fmt(evalPos(allBoth(dipSlope, seasonSlope), 2, 200)))
  console.log('  v5a 1倍 ', fmt(evalPos(allBoth(dipNotBear, seasonNotBear), 1, 200)))
  console.log('  v5a 3倍 ', fmt(evalPos(allBoth(dipNotBear, seasonNotBear), 3, 200)))

  console.log('\n========== 参考: 各v4案のレバ違い（1倍 / 2倍 / 3倍）==========')
  for (const [label, flag] of [['v4a 確定下落でない', dipNotBear], ['v4b 200MA上', dipMa200], ['v4c 200MA上向き', dipSlope], ['v4d 75MA上', dipMa75]]) {
    console.log(`  ${label}`)
    console.log('     1倍 ', fmt(evalPos(all(flag), 1, 200)))
    console.log('     2倍 ', fmt(evalPos(all(flag), 2, 200)))
    console.log('     3倍 ', fmt(evalPos(all(flag), 3, 200)))
  }

  console.log('\n※ロングのみ・コスト片道0.04%・20年イン・サンプル。目標=CAGR17%級を保ちつつDDを−40%圏へ。')
  console.log('※ゲートはトリガーバー(dev25<=-10)時点で判定。落ちるナイフ(確定下落中の-10)を撃たず、押し目(上/レンジでの-10)だけ撃つ。')
}
main().catch(e => { console.error(e); process.exit(1) })
