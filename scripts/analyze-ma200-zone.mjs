#!/usr/bin/env node
// 「反転（底）は200日線の“付近”で起きるのか」を過去データで確かめる。2026-08-17 追加。
//
// きっかけ（ユーザー・2026-08-17）＝「200日線付近って反転の兆しありそう」。
// 🔴 最初に測ったのは**タッチした日に買ったら**どうなるかで、これは的外れだった。
//    ユーザーの意図は「**タッチした付近で**反転する（直前かもしれないし2週間後かもしれない）」。
//    そこで測り方を変えた＝**底そのものがどこで出来ているか**を数える。
//
// 使い方:
//   node scripts/analyze-ma200-zone.mjs                 # ファナック・ハーモニック・日経平均
//   node scripts/analyze-ma200-zone.mjs 6857 8035       # 銘柄コードを指定（.T は自動で付く）
//   node scripts/analyze-ma200-zone.mjs --ma=120 6954   # 線の長さを変える（120日≒6ヶ月/250日≒1年）
//
// 出すもの:
//   A. スイング安値（前後20営業日でいちばん安い日）が、200日線から何%の位置にあったか。
//      **全営業日の分布と比べた「偏り」**で見る。1.0倍＝ただの通過点、2倍＝底になりやすい場所。
//   B. 200日線の±3%圏に入った局面ごとに、その前後で付けた底からの戻り。
//
// 🔴 これは**観測**であって売買の推奨ではない（アプリ全体の方針）。
// 🔵 出どころは Yahoo Finance の日足。分割・配当の影響は調整済みの終値を使う。
// 🔴 **底の判定は「安値」で行う**（2026-08-17 ユーザー指摘で修正）。終値だけで見ていたため、
//    2026-08-03 のファナック（安値5,808＝線の-8.2%まで突っ込んで終値6,114＝-3.3%まで戻した下ヒゲ）を
//    「大きく突っ込んでいない」と誤読した。**下ヒゲで底を付ける形を取りこぼす**。

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36' }

const args = process.argv.slice(2)
const maArg = args.find((a) => a.startsWith('--ma='))
const N = maArg ? Number(maArg.slice(5)) : 200
const codes = args.filter((a) => !a.startsWith('--'))

/** 前後この日数でいちばん安ければ「底」とみなす */
const SWING = 20

const BUCKETS = [
  ['線より下 -10%超', (v) => v <= -10],
  ['-10〜-5%', (v) => v > -10 && v <= -5],
  ['-5〜-3%', (v) => v > -5 && v <= -3],
  ['🎯 ±3%（線の圏内）', (v) => v > -3 && v < 3],
  ['+3〜+5%', (v) => v >= 3 && v < 5],
  ['+5〜+10%', (v) => v >= 5 && v < 10],
  ['線より上 +10%超', (v) => v >= 10],
]

async function daily(symbol, range = '10y') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=1d&events=div,split`
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const r = (await res.json())?.chart?.result?.[0]
  const ts = r?.timestamp ?? []
  const q = r?.indicators?.quote?.[0] ?? {}
  const adj = r?.indicators?.adjclose?.[0]?.adjclose
  const rows = []
  for (let i = 0; i < ts.length; i++) {
    const c = adj?.[i] ?? q.close?.[i]
    if (c == null) continue
    // 🔵 調整後終値を使うときは、安値・高値も同じ比率で調整する（分割をまたいでも形が崩れない）
    const k = q.close?.[i] ? c / q.close[i] : 1
    rows.push({
      d: new Date(ts[i] * 1000).toISOString().slice(0, 10),
      c,
      l: (q.low?.[i] ?? q.close?.[i] ?? c) * k,
      h: (q.high?.[i] ?? q.close?.[i] ?? c) * k,
    })
  }
  if (rows.length < N + SWING * 2) throw new Error(`本数が足りない（${rows.length}本）`)
  return rows
}

function analyze(rows, name) {
  // 移動平均（合計を持ち回して1回で作る）
  const ma = []
  let sum = 0
  for (let i = 0; i < rows.length; i++) {
    sum += rows[i].c
    if (i >= N) sum -= rows[i - N].c
    ma[i] = i >= N - 1 ? sum / N : null
  }
  const dev = rows.map((r, i) => (ma[i] ? ((r.c - ma[i]) / ma[i]) * 100 : null))
  // 🔴 底は**安値**で判定する（下ヒゲで底を付ける形を取りこぼさないため）
  const devLow = rows.map((r, i) => (ma[i] ? ((r.l - ma[i]) / ma[i]) * 100 : null))

  // ── A. 底はどこで出来たか ──
  const lows = []
  for (let i = N + SWING; i < rows.length - SWING; i++) {
    let isLow = true
    for (let k = i - SWING; k <= i + SWING; k++) {
      if (rows[k].l < rows[i].l) { isLow = false; break }
    }
    if (isLow && devLow[i] != null) lows.push({ d: rows[i].d, dev: devLow[i] })
  }
  const all = dev.slice(N).filter((v) => v != null)

  console.log(`\n############ ${name}（${rows[0].d}〜${rows[rows.length - 1].d}／${N}日線） ############`)
  console.log(`\n■ A. 底（前後${SWING}日でいちばん安い日）はどこで出来たか　※底 ${lows.length}回 / 全 ${all.length}営業日`)
  console.log('  線からの位置              底の出現   その位置の日数   偏り')
  for (const [label, test] of BUCKETS) {
    const lp = (lows.filter((l) => test(l.dev)).length / lows.length) * 100
    const ap = (all.filter((v) => test(v)).length / all.length) * 100
    const ratio = ap > 0 ? lp / ap : null
    console.log(
      `  ${label.padEnd(20)} ${lp.toFixed(1).padStart(6)}%   ${ap.toFixed(1).padStart(7)}%   ` +
      `${ratio == null ? '—' : ratio.toFixed(2) + '倍'}${ratio != null && ratio >= 1.3 ? ' ←集中' : ''}`,
    )
  }

  // ── B. 線の圏内に入った局面の「底からの戻り」 ──
  const episodes = []
  let inZone = false
  for (let i = N; i < rows.length; i++) {
    const near = dev[i] != null && Math.abs(dev[i]) <= 3
    if (near && !inZone) { episodes.push({ start: i }); inZone = true }
    if (!near && inZone) { episodes[episodes.length - 1].end = i - 1; inZone = false }
  }
  if (inZone && episodes.length) episodes[episodes.length - 1].end = rows.length - 1

  const details = []
  for (const e of episodes) {
    const from = Math.max(N, e.start - 10)
    const to = Math.min(rows.length - 1, (e.end ?? e.start) + 10)   // 圏内＋前後10日を「その局面」とみなす
    let lowI = from
    for (let k = from; k <= to; k++) if (rows[k].l < rows[lowI].l) lowI = k
    details.push({
      zone: rows[e.start].d,
      low: rows[lowI].d,
      lowDev: devLow[lowI],
      // 🔵 戻りは「その日の安値 → N日後の終値」。実際に拾えた最良の値からの戻りを見る
      r20: lowI + 20 < rows.length ? (rows[lowI + 20].c / rows[lowI].l - 1) * 100 : null,
      r60: lowI + 60 < rows.length ? (rows[lowI + 60].c / rows[lowI].l - 1) * 100 : null,
    })
  }
  const arr20 = details.map((x) => x.r20).filter((x) => x != null)
  const arr60 = details.map((x) => x.r60).filter((x) => x != null)
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
  const win = arr20.length ? (arr20.filter((x) => x > 0).length / arr20.length) * 100 : 0
  const lowDevAvg = avg(details.map((x) => x.lowDev).filter((x) => x != null))

  console.log(`\n■ B. 線の±3%圏に入った局面 ${episodes.length}回。その前後で付けた底からの戻り`)
  console.log(`  底から20日後 平均 ${avg(arr20).toFixed(1)}%（上昇した割合 ${win.toFixed(0)}%）`)
  console.log(`  底から60日後 平均 ${avg(arr60).toFixed(1)}%`)
  console.log(`  🔴 底の位置は平均で線の ${lowDevAvg.toFixed(1)}%（＝どこまで突っ込んでから反転しているか）`)
  console.log('  直近5局面（圏入り → 底の日／線からの位置 → 20日後 → 60日後）:')
  const p = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`)
  for (const x of details.slice(-5)) {
    console.log(`    ${x.zone} → ${x.low}（${x.lowDev.toFixed(1)}%） → ${p(x.r20)} → ${p(x.r60)}`)
  }
}

const targets = codes.length
  ? codes.map((c) => [/^\^/.test(c) ? c : `${c}.T`, c])
  : [['6954.T', 'ファナック'], ['6324.T', 'ハーモニック'], ['^N225', '日経平均']]

for (const [sym, name] of targets) {
  try {
    analyze(await daily(sym), name)
  } catch (e) {
    console.log(`\n${name}: 取得できず（${e.message}）`)
  }
}

console.log('\n🔵 観測であって売買の推奨ではありません。')
