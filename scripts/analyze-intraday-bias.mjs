#!/usr/bin/env node
// 上位足のバイアスは、その日の「寄り→引け」に効くか（R&D・2026-08-13）
//
// 🔴 なぜ測るか＝「ぽいロボでデイトレもできないか」という構想への答えを、感想ではなく数字で出すため。
//    ぽいロボの中核（TEV＝需給の物理）は**週次公表のデータ**で動くので、日中の時間軸では使えない。
//    ただしフラクタル構造の考え方に立てば、**上位足の地合い**は下位足の売買に効くはずで、
//    それなら「ぽいロボがデイトレする」のではなく「**デイトレの地合いフィルターになる**」形が成立する。
//
// 🔴 測るのは「上位足が上と言った日は、寄り→引けが上がりやすいか」だけ。
//    ここに差が無いなら、フィルターとしても価値が無いので構想は捨てる。
//
// 🔵 材料は**いま持っている日足（始値・終値）だけ**。分足も証券APIも要らない。
//    コスト0で、いまの検証（30トレードのGo/No-Go）も止めない。
//
// 使い方: node scripts/analyze-intraday-bias.mjs

import { computeIndicators, baselineTimeline } from '../src/utils/robotStrategy.mjs'

const UA = { 'User-Agent': 'Mozilla/5.0 (poirobo research)' }

async function fetchDaily(symbol, years = 21) {
  const p2 = Math.floor(Date.now() / 1000)
  const p1 = p2 - years * 365 * 24 * 3600
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d`
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const r = (await res.json())?.chart?.result?.[0]
  const ts = r.timestamp ?? []
  const q = r.indicators?.quote?.[0] ?? {}
  const rows = []
  for (let i = 0; i < ts.length; i++) {
    if (q.close?.[i] == null || q.open?.[i] == null) continue
    // 🔴 Yahoo は出来高の薄い日に 0 を返すことがある。0 で割ると平均が Infinity になり、
    //    「数字は出ているのに壊れている」状態になる（2026-08-13 に 1321 で踏んだ）。
    if (!(q.close[i] > 0) || !(q.open[i] > 0)) continue
    rows.push({
      date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
      open: q.open[i], high: q.high?.[i] ?? q.close[i], low: q.low?.[i] ?? q.close[i], close: q.close[i],
    })
  }
  return rows
}

/** 平均・勝率・t値（0との差）。t が 2 未満は誤差の範囲として扱う。 */
function stat(xs) {
  const n = xs.length
  if (!n) return { n: 0 }
  const mean = xs.reduce((s, x) => s + x, 0) / n
  const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, n - 1))
  const se = sd / Math.sqrt(n)
  return { n, mean, se, t: se ? mean / se : 0, win: xs.filter((x) => x > 0).length / n * 100 }
}

function show(label, xs) {
  const s = stat(xs)
  if (!s.n) return console.log(`  ${label.padEnd(28)} n=0`)
  const sig = Math.abs(s.t) >= 2 ? '  ← 有意' : '  ← 誤差の範囲'
  console.log(`  ${label.padEnd(28)} n=${String(s.n).padStart(5)}  平均 ${s.mean >= 0 ? '+' : ''}${s.mean.toFixed(3)}%  勝率 ${s.win.toFixed(1)}%  t=${s.t.toFixed(2)}${sig}`)
}

const main = async () => {
  console.log('=== 上位足のバイアスは「寄り→引け」に効くか ===')
  console.log('🔴 デイトレそのものの検証ではない。「その日の方向に賭けてよいか」だけを見る。\n')

  const raw = await fetchDaily('^N225')
  const rows = computeIndicators(raw)
  const timeline = baselineTimeline(rows)
  console.log(`日経225 日足 ${rows.length}営業日（${rows[0].date} 〜 ${rows[rows.length - 1].date}）\n`)

  // その日の寄り→引け（%）。前日終値ではなく**始値から**測る＝デイトレの取り分。
  const o2c = rows.map((r) => (r.close - r.open) / r.open * 100)

  console.log('■ 基準（全営業日）')
  show('全日', o2c)

  // 🔴🔴 未来を見ないこと。**その日の寄りで賭ける**のだから、条件に使ってよいのは
  //    「前営業日の終値までに確定した情報」と「当日の寄り値」だけ。
  //    最初に書いたとき当日の終値から作った指標を条件にしてしまい、
  //    「前日が+1%超 → 勝率93.7%」というあり得ない数字が出た（2026-08-13）。
  //    当日の終値を条件にすれば、当日の寄り→引けが当たるのは当たり前。
  const idx = rows.map((_, i) => i).filter((i) => i >= 26)

  console.log('\n■ 対照群（決定論ルール）の地合い別 ※前営業日の終値で決まった側')
  for (const [label, want] of [['ブル日', 'bull'], ['ベア日', 'bear'], ['ノーポジ日', null]]) {
    show(label, idx.filter((i) => (timeline[i - 1]?.side ?? null) === want).map((i) => o2c[i]))
  }

  console.log('\n■ 25日線との位置（上位足の代理）※前営業日の終値時点')
  const dev = rows.map((r) => r.dev25)
  show('25日線の上（+2%超）', idx.filter((i) => dev[i - 1] != null && dev[i - 1] > 2).map((i) => o2c[i]))
  show('25日線の近く（±2%）', idx.filter((i) => dev[i - 1] != null && Math.abs(dev[i - 1]) <= 2).map((i) => o2c[i]))
  show('25日線の下（−2%超）', idx.filter((i) => dev[i - 1] != null && dev[i - 1] < -2).map((i) => o2c[i]))

  console.log('\n■ 前日の値動き別（上位足の勢い）※前営業日の終値 vs その前日')
  const prevRet = rows.map((r, i) => i < 2 ? null : (rows[i - 1].close - rows[i - 2].close) / rows[i - 2].close * 100)
  show('前日が+1%超', idx.filter((i) => prevRet[i] != null && prevRet[i] > 1).map((i) => o2c[i]))
  show('前日が−1%超', idx.filter((i) => prevRet[i] != null && prevRet[i] < -1).map((i) => o2c[i]))

  // 🔵 ギャップは**寄りの時点で分かる**ので、条件に使ってよい情報。
  const gap = rows.map((r, i) => i === 0 ? null : (r.open - rows[i - 1].close) / rows[i - 1].close * 100)
  console.log('\n■ 寄りギャップ別（寄りの時点で判明）')
  show('ギャップアップ+0.5%超', idx.filter((i) => gap[i] != null && gap[i] > 0.5).map((i) => o2c[i]))
  show('ギャップダウン−0.5%超', idx.filter((i) => gap[i] != null && gap[i] < -0.5).map((i) => o2c[i]))

  // ── 日中のパターン分類（寄り天・寄り底など）─────────────────────────────
  // 🔵 「いくつかの型に分かれるはず」という感覚を、日足のOHLCで数えられる形にする。
  // 🔴 これは**その日が終わってから分かる分類**（結果の分類であって予測ではない）。
  //    使い道は「どの型が何%あるか」を知り、寄りの時点の情報で当てられるかを次に測ること。
  const dayType = (r) => {
    const range = r.high - r.low
    if (range <= 0) return 'その他'
    const upPos = (r.open - r.low) / range    // 寄りが安値からどの位置か（1=高値寄り）
    const clPos = (r.close - r.low) / range   // 引けの位置
    const body = (r.close - r.open) / r.open * 100
    if (upPos >= 0.7 && clPos <= 0.35 && body < -0.2) return '寄り天（寄って下げる）'
    if (upPos <= 0.3 && clPos >= 0.65 && body > 0.2) return '寄り底（寄って上げる）'
    if (clPos >= 0.8 && body > 0.2) return '一本調子の上げ（高値引け）'
    if (clPos <= 0.2 && body < -0.2) return '一本調子の下げ（安値引け）'
    if (Math.abs(body) < 0.2) return 'もみ合い（寄り＝引け付近）'
    return 'その他'
  }
  const types = new Map()
  for (const i of idx) {
    const t = dayType(rows[i])
    if (!types.has(t)) types.set(t, [])
    types.get(t).push(i)
  }
  console.log('\n■ 日中のパターン分類（20年・その日が終わってから分かる型）')
  const total = idx.length
  for (const [t, list] of [...types.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const share = (list.length / total * 100).toFixed(1)
    const mean = list.reduce((s, i) => s + o2c[i], 0) / list.length
    console.log(`  ${t.padEnd(26)} ${String(list.length).padStart(5)}日（${share.padStart(4)}%）  寄→引 平均 ${mean >= 0 ? '+' : ''}${mean.toFixed(2)}%`)
  }

  // 寄りの時点の情報（ギャップ）で「寄り天」を当てられるか
  console.log('\n■ 「寄り天」は寄りの時点で読めるか（ギャップ別の出現率）')
  const yoriten = new Set(types.get('寄り天（寄って下げる）') ?? [])
  const base = yoriten.size / total * 100
  console.log(`  全日の寄り天率 … ${base.toFixed(1)}%`)
  for (const [label, sel] of [
    ['ギャップアップ+0.5%超', (i) => gap[i] != null && gap[i] > 0.5],
    ['ギャップアップ+1.0%超', (i) => gap[i] != null && gap[i] > 1.0],
    ['ギャップダウン−0.5%超', (i) => gap[i] != null && gap[i] < -0.5],
  ]) {
    const s = idx.filter(sel)
    const hit = s.filter((i) => yoriten.has(i)).length
    const pct = s.length ? hit / s.length * 100 : 0
    console.log(`  ${label.padEnd(22)} n=${String(s.length).padStart(5)}  寄り天率 ${pct.toFixed(1)}%（全日比 ${(pct - base >= 0 ? '+' : '')}${(pct - base).toFixed(1)}pt）`)
  }

  // ── ギャップ順張りの期間別安定性 ─────────────────────────────────────
  // 🔴 20年の平均で効いても、リーマン(2008)やコロナ(2020)の数ヶ月に集中していれば
  //    「昔は効いた」を掴んでいるだけ。5年ごとに割って、どの区間でも効くかを見る。
  console.log('\n■ ギャップ順張りの期間別（5年ごと）')
  for (const [label, from, to] of [['2005-2010', '2005', '2010'], ['2011-2015', '2011', '2015'], ['2016-2020', '2016', '2020'], ['2021-2026', '2021', '2026']]) {
    const inRange = (i) => rows[i].date >= from && rows[i].date <= to + '-12-31'
    show(`${label} GU買い`, idx.filter((i) => inRange(i) && gap[i] != null && gap[i] > 0.5).map((i) => o2c[i]))
    show(`${label} GD売り`, idx.filter((i) => inRange(i) && gap[i] != null && gap[i] < -0.5).map((i) => -o2c[i]))
  }

  // ── 実際に売買する銘柄（ETF）で測り直す ───────────────────────────────
  // 🔴 いままで測ったのは**日経指数**の始値・終値。実際に売買するのは 1321 で、
  //    始値・終値もNAVからの乖離も別物。指数で良く見えても、ETFで消えることがある。
  //    （ロボ対照群のバックテストでも「指数近似とETF実データの両方で測る」ことを原則にしている）
  console.log('\n■ 🔴 ETF実データ（1321）で測り直す')
  try {
    const etf = await fetchDaily('1321.T', 21)
    console.log(`  1321 ${etf.length}営業日（${etf[0].date} 〜 ${etf[etf.length - 1].date}）`)
    const eo2c = etf.map((r) => (r.close - r.open) / r.open * 100)
    const egap = etf.map((r, i) => i === 0 ? null : (r.open - etf[i - 1].close) / etf[i - 1].close * 100)
    const eidx = etf.map((_, i) => i).filter((i) => i >= 1)
    show('全日', eidx.map((i) => eo2c[i]))
    show('ギャップUP+0.5%超 買い', eidx.filter((i) => egap[i] != null && egap[i] > 0.5).map((i) => eo2c[i]))
    show('ギャップDN−0.5%超 売り', eidx.filter((i) => egap[i] != null && egap[i] < -0.5).map((i) => -eo2c[i]))
  } catch (e) {
    console.log('  取得に失敗:', e.message)
  }

  console.log('\n🔴 t が 2 未満は誤差の範囲。差が出ても、そのまま信じない。')
  console.log('🔵 寄付・引けは板寄せ（単一価格）なので、この戦略はザラ場のスプレッドを払わない。')
  console.log('   松井の一日信用なら手数料・金利も0円（当日中に返済する限り）。')
  console.log('🔴 パターン分類は「結果の型」であって予測ではない。寄りの時点で当てられるかは別の話。')
}

main().catch((e) => { console.error(e); process.exit(1) })
