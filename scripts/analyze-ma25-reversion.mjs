#!/usr/bin/env node
// 25日線乖離率の「限界→反転」仮説の実測（R&D・コミット対象外想定）
// Yahoo ^N225 日次20年 → 各日の25日線乖離率を計算 → 乖離バケット別に
//   ①分布 ②先5/10/20営業日の価格リターン ③乖離の解消経路(価格下落 vs MA追いつき)
//   ④トレンド/レンジ層別
// 使い方: node scripts/analyze-ma25-reversion.mjs

const PERIOD2 = Math.floor(Date.now() / 1000)
const PERIOD1 = PERIOD2 - 21 * 365 * 24 * 3600   // 約21年前

async function fetchDaily() {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EN225?period1=${PERIOD1}&period2=${PERIOD2}&interval=1d`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' },
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const j = await res.json()
  const r = j?.chart?.result?.[0]
  const ts = r.timestamp ?? []
  const cl = r.indicators?.quote?.[0]?.close ?? []
  const rows = []
  for (let i = 0; i < ts.length; i++) {
    if (cl[i] == null) continue
    rows.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: cl[i] })
  }
  return rows
}

const pct = (arr, p) => {
  if (!arr.length) return null
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))]
}
const median = arr => pct(arr, 50)
const mean = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null
const r2 = v => v == null ? null : Math.round(v * 100) / 100

async function main() {
  console.log('[fetch] Yahoo ^N225 日次20年...')
  const rows = await fetchDaily()
  console.log(`  → ${rows.length}営業日 (${rows[0].date} 〜 ${rows[rows.length - 1].date})`)

  // 25日SMA・乖離率・60日過去リターン（レジーム文脈）を付与
  for (let i = 0; i < rows.length; i++) {
    if (i >= 24) {
      let s = 0
      for (let k = 0; k < 25; k++) s += rows[i - k].close
      rows[i].sma25 = s / 25
      rows[i].dev = (rows[i].close - rows[i].sma25) / rows[i].sma25 * 100
    }
    if (i >= 60) rows[i].ret60 = (rows[i].close - rows[i - 60].close) / rows[i - 60].close * 100
  }

  const valid = rows.filter(r => r.dev != null)
  const devs = valid.map(r => r.dev)
  console.log('\n========== ① 25日線乖離率 分布（20年・%）==========')
  console.log(`n=${devs.length}`)
  console.log(`min=${r2(Math.min(...devs))}  p1=${r2(pct(devs,1))}  p5=${r2(pct(devs,5))}  p50=${r2(median(devs))}  p95=${r2(pct(devs,95))}  p99=${r2(pct(devs,99))}  max=${r2(Math.max(...devs))}`)

  // レジーム文脈（過去60日リターン・ルックアヘッドなし）
  const regimeOf = r => r.ret60 == null ? 'na' : r.ret60 >= 5 ? 'uptrend' : r.ret60 <= -5 ? 'downtrend' : 'range'

  // 先N営業日の価格リターン
  const fwd = (i, n) => (i + n < rows.length) ? (rows[i + n].close - rows[i].close) / rows[i].close * 100 : null

  // 乖離バケット（上側の限界仮説が主眼だが下側も併記）
  const buckets = [
    { label: 'dev >= +11%', test: d => d >= 11 },
    { label: '+9% .. +11%', test: d => d >= 9 && d < 11 },
    { label: '+7% .. +9%',  test: d => d >= 7 && d < 9 },
    { label: '+5% .. +7%',  test: d => d >= 5 && d < 7 },
    { label: '-5% .. +5%',  test: d => d > -5 && d < 5 },
    { label: '-7% .. -5%',  test: d => d > -7 && d <= -5 },
    { label: '-10% .. -7%', test: d => d > -10 && d <= -7 },
    { label: 'dev <= -10%',  test: d => d <= -10 },
  ]

  console.log('\n========== ② 乖離バケット別・先行リターン（中央値%）と下落確率 ==========')
  console.log('バケット          n     fwd5中  fwd10中 fwd20中  P(10日後安い) 上昇時平均 下落時平均')
  for (const b of buckets) {
    const idx = []
    for (let i = 0; i < rows.length; i++) if (rows[i].dev != null && b.test(rows[i].dev)) idx.push(i)
    const f5 = [], f10 = [], f20 = []
    let declN = 0, declD = 0, ups = [], downs = []
    for (const i of idx) {
      const a = fwd(i, 5), c = fwd(i, 10), e = fwd(i, 20)
      if (a != null) f5.push(a)
      if (c != null) { f10.push(c); declD++; if (c < 0) { declN++; downs.push(c) } else ups.push(c) }
      if (e != null) f20.push(e)
    }
    const pDecl = declD ? Math.round(declN / declD * 100) : null
    console.log(
      `${b.label.padEnd(16)} ${String(idx.length).padStart(5)}  ` +
      `${String(r2(median(f5))).padStart(7)} ${String(r2(median(f10))).padStart(7)} ${String(r2(median(f20))).padStart(7)}  ` +
      `${String(pDecl).padStart(11)}% ${String(r2(mean(ups))).padStart(9)} ${String(r2(mean(downs))).padStart(10)}`
    )
  }

  console.log('\n========== ③ 乖離の解消経路（dev>=+7% 起点・先10営業日）==========')
  console.log('「乖離が縮んだ時、価格が下げたのか／MAが追いついたのか」')
  for (const thr of [7, 9, 11]) {
    const idx = []
    for (let i = 0; i < rows.length; i++) if (rows[i].dev != null && rows[i].dev >= thr) idx.push(i)
    let shrinkPriceLed = 0, shrinkMaLed = 0, noShrink = 0, total = 0
    const priceRets = [], maRets = []
    for (const i of idx) {
      if (i + 10 >= rows.length || rows[i + 10].dev == null) continue
      total++
      const devChange = rows[i + 10].dev - rows[i].dev   // 負なら乖離縮小
      const priceRet  = (rows[i + 10].close - rows[i].close) / rows[i].close * 100
      const maRet     = (rows[i + 10].sma25 - rows[i].sma25) / rows[i].sma25 * 100
      priceRets.push(priceRet); maRets.push(maRet)
      if (devChange < -1) {   // 乖離が1pt超縮小＝「反転/正常化」とみなす
        if (priceRet < 0) shrinkPriceLed++   // 価格が下げて縮小＝値幅が取れた
        else shrinkMaLed++                   // 価格は下げず（MA追いつき主導）＝値幅取れず
      } else noShrink++
    }
    console.log(
      `\n[dev>=+${thr}%] n=${total}  ` +
      `乖離縮小=${shrinkPriceLed + shrinkMaLed}(${Math.round((shrinkPriceLed+shrinkMaLed)/total*100)}%) ` +
      `／非縮小=${noShrink}(${Math.round(noShrink/total*100)}%)`
    )
    const shrinkTot = shrinkPriceLed + shrinkMaLed
    console.log(
      `   縮小の内訳: 価格下落主導=${shrinkPriceLed}(${shrinkTot?Math.round(shrinkPriceLed/shrinkTot*100):0}%) ` +
      `／MA追いつき主導=${shrinkMaLed}(${shrinkTot?Math.round(shrinkMaLed/shrinkTot*100):0}%)`
    )
    console.log(`   先10日 平均: 価格リターン=${r2(mean(priceRets))}% / 25日線変化=${r2(mean(maRets))}%`)
  }

  console.log('\n========== ④ レジーム層別（過去60日リターンで文脈分類）==========')
  console.log('同じ高乖離(+7%以上)でも、トレンド/レンジで先10日の下落確率は変わるか')
  for (const reg of ['uptrend', 'range', 'downtrend']) {
    const idx = []
    for (let i = 0; i < rows.length; i++) if (rows[i].dev != null && rows[i].dev >= 7 && regimeOf(rows[i]) === reg) idx.push(i)
    const f10 = []
    let declN = 0
    for (const i of idx) { const c = fwd(i, 10); if (c != null) { f10.push(c); if (c < 0) declN++ } }
    const pDecl = f10.length ? Math.round(declN / f10.length * 100) : null
    console.log(`  ${reg.padEnd(9)} n=${String(idx.length).padStart(4)}  fwd10中央=${String(r2(median(f10))).padStart(6)}%  P(10日後安い)=${pDecl}%`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
