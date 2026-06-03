#!/usr/bin/env node
// 複数市場で「エッジの本数（独立した収益の流れ）」を増やせるか。
// 日経225・TOPIX・S&P500 に同じコアシステム(トレンド+確定下落で濾した押し目)を適用し、
//   ①日次リターン相関 ②各単体 ③束ねた時 ④同じDD予算(-40%)まで再レバした時のCAGR を測る。
// 問い: TOPIXは日経と相関が高すぎて分散効果が薄いのでは？ S&Pなら効くのでは？ をデータで確認。
// 使い方: node scripts/analyze-multi-market.mjs

const P2 = Math.floor(Date.now() / 1000), P1 = P2 - 21 * 365 * 24 * 3600
const r2 = v => Math.round(v * 100) / 100
const COST = 0.0004

async function fetchOne(symbols) {
  for (const sym of symbols) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?period1=${P1}&period2=${P2}&interval=1d`
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }, signal: AbortSignal.timeout(30000) })
      const j = await res.json(); const r = j.chart?.result?.[0]
      if (!r) continue
      const ts = r.timestamp, q = r.indicators.quote[0].close, adj = r.indicators.adjclose?.[0]?.adjclose
      const cl = adj || q   // 調整後終値（分割・配当補正）を優先＝ETFの分割アーティファクト回避
      const rows = []
      for (let i = 0; i < ts.length; i++) if (cl[i] != null) rows.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: cl[i] })
      if (rows.length > 1000) { console.log(`  ✓ ${sym}: ${rows.length}営業日`); return rows }
    } catch { /* try next */ }
  }
  throw new Error(`fetch failed: ${symbols.join('/')}`)
}

// コアシステム(トレンド+確定下落で濾した押し目25日, 任意でJP季節性)の日次リターン系列(1倍)を生成
function stratDaily(rows, useSeason) {
  const n = rows.length
  const sma = (i, w) => { if (i < w - 1) return null; let s = 0; for (let k = 0; k < w; k++) s += rows[i - k].close; return s / w }
  for (let i = 0; i < n; i++) { const m = sma(i, 25); rows[i].dev25 = m == null ? null : (rows[i].close - m) / m * 100 }
  const trendLong = new Array(n).fill(false), trendBear = new Array(n).fill(false)
  { let s = 0; for (let i = 50; i < n; i++) { let hi = -Infinity, exLo = Infinity; for (let k = 1; k <= 50; k++) hi = Math.max(hi, rows[i - k].close); for (let k = 1; k <= 25; k++) exLo = Math.min(exLo, rows[i - k].close); const cc = rows[i].close; if (s === 0 && cc > hi) s = 1; else if (s === 1 && cc < exLo) s = 0; trendLong[i] = s === 1 } }
  { let s = 0; for (let i = 50; i < n; i++) { let lo = Infinity, exHi = -Infinity; for (let k = 1; k <= 50; k++) lo = Math.min(lo, rows[i - k].close); for (let k = 1; k <= 25; k++) exHi = Math.max(exHi, rows[i - k].close); const cc = rows[i].close; if (s === 0 && cc < lo) s = 1; else if (s === 1 && cc > exHi) s = 0; trendBear[i] = s === 1 } }
  const dip = new Array(n).fill(false); { let until = -1; for (let i = 25; i < n; i++) { if (rows[i].dev25 != null && rows[i].dev25 <= -10 && !trendBear[i]) until = Math.max(until, i + 5); if (i <= until) dip[i] = true } }
  const mmdd = i => rows[i].date.slice(5)
  const season = i => useSeason && !trendBear[i] && ((mmdd(i) >= '03-15' && mmdd(i) <= '03-27') || (mmdd(i) >= '12-15' && mmdd(i) <= '12-30'))
  const pos = i => trendLong[i] || dip[i] || season(i)
  // 日次1倍リターン(date->ret)。建玉は前日posで当日リターンを取る。遷移日にコスト。
  const map = new Map(); let prev = false
  for (let i = 1; i < n; i++) {
    const raw = (rows[i].close - rows[i - 1].close) / rows[i - 1].close
    const clean = Math.abs(raw) > 0.35 ? 0 : raw   // 指数の単日±35%超＝分割/データエラー→無効化
    let ret = pos(i - 1) ? clean : 0
    if (pos(i) !== prev) { ret -= COST; prev = pos(i) }
    map.set(rows[i].date, ret)
  }
  return map
}

function pearson(a, b) {
  const dates = [...a.keys()].filter(d => b.has(d))
  const xs = dates.map(d => a.get(d)), ys = dates.map(d => b.get(d))
  const n = xs.length, mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy }
  return sxy / Math.sqrt(sxx * syy)
}

// 複数の日次リターンmapを等加重で束ね、レバLを掛けた時の CAGR/maxDD
function blendMetrics(maps, lev) {
  const allDates = new Set(); for (const m of maps) for (const d of m.keys()) allDates.add(d)
  const dates = [...allDates].sort()
  const yrs = (new Date(dates[dates.length - 1]) - new Date(dates[0])) / (365.25 * 864e5)
  let eq = 1, peak = 1, maxDD = 0
  for (const d of dates) {
    let sum = 0; for (const m of maps) sum += (m.get(d) ?? 0)
    const blended = sum / maps.length
    eq *= (1 + lev * blended)
    peak = Math.max(peak, eq); maxDD = Math.min(maxDD, eq / peak - 1)
  }
  return { cagr: r2((Math.pow(eq, 1 / yrs) - 1) * 100), maxDD: r2(maxDD * 100) }
}

// maxDDが目標(例-40%)になるレバLをBinary search（DDはLに単調悪化）
function levForDD(maps, targetDD) {
  let lo = 0.5, hi = 8
  for (let it = 0; it < 40; it++) { const mid = (lo + hi) / 2; const dd = blendMetrics(maps, mid).maxDD; if (dd < targetDD) hi = mid; else lo = mid }
  const L = (lo + hi) / 2; const m = blendMetrics(maps, L)
  return { lev: r2(L), cagr: m.cagr, maxDD: m.maxDD }
}

async function main() {
  console.log('[fetch] Yahoo 日次20年（日経225 / TOPIX / S&P500）...')
  const nk = await fetchOne(['^N225'])
  const tpx = await fetchOne(['1306.T'])  // TOPIX連動ETF（指数^TPXはYahoo欠損）。adjcloseで分割補正＝配当込みTRになる点に注意
  const sp = await fetchOne(['^GSPC'])

  const sNk = stratDaily(nk, true)    // 日経：JP季節性あり
  const sTpx = stratDaily(tpx, true)  // TOPIX：JP季節性あり
  const sSp = stratDaily(sp, false)   // S&P：JP季節性なし（権利確定は日本固有）

  // 参考：原資産(B&H)の日次リターン相関も見る
  const rawDaily = rows => { const m = new Map(); for (let i = 1; i < rows.length; i++) { const r = (rows[i].close - rows[i - 1].close) / rows[i - 1].close; m.set(rows[i].date, Math.abs(r) > 0.35 ? 0 : r) } return m }
  const bNk = rawDaily(nk), bTpx = rawDaily(tpx), bSp = rawDaily(sp)

  console.log('\n========== ① 日次リターン相関（原資産 B&H）==========')
  console.log(`  日経 × TOPIX : ${r2(pearson(bNk, bTpx))}`)
  console.log(`  日経 × S&P500: ${r2(pearson(bNk, bSp))}`)
  console.log(`  TOPIX× S&P500: ${r2(pearson(bTpx, bSp))}`)
  console.log('  （戦略リターンの相関）')
  console.log(`  日経戦略 × TOPIX戦略 : ${r2(pearson(sNk, sTpx))}`)
  console.log(`  日経戦略 × S&P戦略   : ${r2(pearson(sNk, sSp))}`)

  const fmt = m => `CAGR ${String(m.cagr).padStart(6)}%  DD ${String(m.maxDD).padStart(7)}%`
  console.log('\n========== ② 各単体（コア=トレンド+濾し押し目[+JP季節性]・2倍）==========')
  console.log('  日経225 ', fmt(blendMetrics([sNk], 2)))
  console.log('  TOPIX   ', fmt(blendMetrics([sTpx], 2)))
  console.log('  S&P500  ', fmt(blendMetrics([sSp], 2)))

  console.log('\n========== ③ 束ねる（等加重・合計2倍）==========')
  console.log('  日経のみ        ', fmt(blendMetrics([sNk], 2)))
  console.log('  日経+TOPIX      ', fmt(blendMetrics([sNk, sTpx], 2)))
  console.log('  日経+S&P        ', fmt(blendMetrics([sNk, sSp], 2)))
  console.log('  日経+TOPIX+S&P  ', fmt(blendMetrics([sNk, sTpx, sSp], 2)))

  console.log('\n========== ④ 同じDD予算(-40%)まで再レバした時のCAGR（★20%が出るか）==========')
  const show = (label, maps) => { const r = levForDD(maps, -40); const hit = r.cagr >= 20 ? ' ★20%到達' : ''; console.log(`  ${label.padEnd(16)} レバ${String(r.lev).padStart(4)}倍 → ${fmt(r)}${hit}`) }
  show('日経のみ', [sNk])
  show('日経+TOPIX', [sNk, sTpx])
  show('日経+S&P', [sNk, sSp])
  show('日経+TOPIX+S&P', [sNk, sTpx, sSp])

  console.log('\n※ロングのみ・コスト片道0.04%・20年イン・サンプル。等加重=資本を均等配分。④はDD-40%予算を使い切るレバに調整したCAGR。')
  console.log('※相関が低いほど束ねた時にDDが下がり、再レバでCAGRを伸ばせる＝20%への本筋。S&Pは円換算/時差を簡略化（現地通貨・日付和集合）。')
}
main().catch(e => { console.error(e); process.exit(1) })
