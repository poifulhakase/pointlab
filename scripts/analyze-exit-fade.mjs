#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────
// 「勢いが枯れたら降りる」は、損切りに任せるより良いのか（2026-08-17 追加）
//
// きっかけ（運用者・2026-08-17）＝「上昇のローソク足が短くなっている＝売買圧が弱まっている」
//   → 勢いの衰えを判断材料に足した（`buildMomentumFade`）。
//   → では**降りる規則**そのものを変えるべきか？ を決める材料が無かった。
//   → 「むずかしい」＝**測っていないから決められない**。だから先に測る。
//
// 比べるもの（入り方は同じ・降り方だけ変える）:
//   A案 … 損切り（ATR×倍率）に当たるまで持つ ＝ いまの規則
//   B案 … A案 ＋「勢いが枯れたら手仕舞う」
//          ① 上昇日の実体が3回以上連続で縮小
//          ② 直近3日の上ヒゲ比率が平均50%以上
//          ③ 当日の出来高が平常（20日中央値）以下
//
// 🔴 入り口（いつ買うか）は**対照群の決定論ルール**をそのまま使う。
//    降り方だけを変えて比べないと、どちらの効果か分からなくなる。
// 🔴 LLM の判断は再現できないので、ここで測るのは**規則としての優劣**まで。
//    それでも「利確を増やすと期待値が壊れるのか」は、この比較で見える。
//
// 使い方: node scripts/analyze-exit-fade.mjs
// ──────────────────────────────────────────────────────────────────────────

import { computeIndicators, baselineTimeline, stopPrice } from '../src/utils/robotStrategy.mjs'

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }
const COST = 0.0004
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100)

async function fetchDaily(symbol, years = 21) {
  const p2 = Math.floor(Date.now() / 1000)
  const p1 = p2 - years * 365 * 24 * 3600
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d`
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${symbol}`)
  const r = (await res.json())?.chart?.result?.[0]
  const ts = r?.timestamp ?? []
  const q = r?.indicators?.quote?.[0] ?? {}
  const rows = []
  for (let i = 0; i < ts.length; i++) {
    if (q.close?.[i] == null) continue
    rows.push({
      date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
      open: q.open?.[i] ?? q.close[i],
      high: q.high?.[i] ?? q.close[i],
      low: q.low?.[i] ?? q.close[i],
      close: q.close[i],
      volume: q.volume?.[i] ?? 0,
    })
  }
  return rows
}

/** その日、勢いが枯れているか（`buildMomentumFade` と同じ考え方を過去日にも当てる） */
function fadeAt(rows, i) {
  if (i < 21) return false
  const win = rows.slice(i - 19, i + 1)

  // ① 上昇日の実体が3回以上連続で縮小
  const ups = win.filter((r) => r.close > r.open).map((r) => ((r.close - r.open) / r.open) * 100)
  let streak = 0
  for (let k = ups.length - 1; k > 0; k--) {
    if (ups[k] < ups[k - 1]) streak++
    else break
  }

  // ② 直近3日の上ヒゲ比率
  const wick = rows.slice(i - 2, i + 1).map((r) => {
    const top = Math.max(r.open, r.close)
    const range = r.high - r.low
    return range > 0 ? ((r.high - top) / range) * 100 : 0
  })
  const wickAvg = wick.reduce((a, b) => a + b, 0) / wick.length

  // ③ 出来高が平常以下
  const vols = win.map((r) => r.volume).filter((v) => v > 0).sort((a, b) => a - b)
  const medVol = vols.length ? vols[Math.floor(vols.length / 2)] : null
  const volOk = medVol ? rows[i].volume <= medVol : false

  return streak >= 3 && wickAvg >= 50 && volOk
}

/**
 * 対照群の入り口で建て、降り方だけ変えて回す。
 * @param {'stop'|'fade'} exit  stop=損切りのみ（A案） / fade=勢いでも降りる（B案）
 */
function run(rows, ind, timeline, exit) {
  let cash = 1000000, pos = null
  const trades = []
  const equity = []

  for (let i = 1; i < rows.length; i++) {
    const px = rows[i].close
    // 対照群は日ごとに { side, reason } を返す。side が 'long' の日を「持つべき」とみなす
    //（ベアは今回の比較の対象外＝降り方の違いだけを見たいので、ブル(bull)の建玉に絞る）
    const want = timeline[i]?.side === 'bull'

    // 降りる判定
    if (pos) {
      const stopHit = px <= pos.stop
      const faded = exit === 'fade' && fadeAt(rows, i) && px > pos.entry  // 含み益のときだけ
      const wantOut = !want
      if (stopHit || faded || wantOut) {
        cash += pos.qty * px * (1 - COST)
        trades.push({
          in: pos.date, out: rows[i].date, entry: pos.entry, exit: px,
          pnl: ((px / pos.entry) - 1) * 100,
          why: stopHit ? '損切り' : faded ? '勢い枯れ' : 'ルール解除',
        })
        pos = null
      } else {
        // 損切りは利が乗るほど引き上がる（下げない）
        const s = stopPrice({ entry: px, atr20: ind[i].atr20, vix: null })
        if (s != null && s > pos.stop) pos.stop = s
      }
    }

    // 建てる
    if (!pos && want) {
      const qty = Math.floor(cash / px)
      if (qty > 0) {
        const s = stopPrice({ entry: px, atr20: ind[i].atr20, vix: null })
        cash -= qty * px * (1 + COST)
        pos = { date: rows[i].date, entry: px, qty, stop: s ?? px * 0.9 }
      }
    }
    equity.push(cash + (pos ? pos.qty * px : 0))
  }

  // 成績
  const last = equity[equity.length - 1]
  const years = rows.length / 250
  const cagr = (Math.pow(last / 1000000, 1 / years) - 1) * 100
  let peak = 0, dd = 0
  for (const e of equity) { peak = Math.max(peak, e); dd = Math.min(dd, (e / peak - 1) * 100) }
  const wins = trades.filter((t) => t.pnl > 0)
  const avgWin = wins.length ? wins.reduce((a, b) => a + b.pnl, 0) / wins.length : 0
  const losses = trades.filter((t) => t.pnl <= 0)
  const avgLoss = losses.length ? losses.reduce((a, b) => a + b.pnl, 0) / losses.length : 0

  return {
    equity: Math.round(last), cagr: r2(cagr), maxDd: r2(dd),
    trades: trades.length,
    winRate: trades.length ? r2((wins.length / trades.length) * 100) : null,
    avgWin: r2(avgWin), avgLoss: r2(avgLoss),
    expectancy: trades.length ? r2(trades.reduce((a, b) => a + b.pnl, 0) / trades.length) : null,
    byReason: ['損切り', '勢い枯れ', 'ルール解除'].map((w) => {
      const g = trades.filter((t) => t.why === w)
      return g.length ? `${w} ${g.length}回(平均 ${r2(g.reduce((a, b) => a + b.pnl, 0) / g.length)}%)` : null
    }).filter(Boolean).join(' / '),
  }
}

const rows = await fetchDaily('^N225')
const ind = computeIndicators(rows)
const timeline = baselineTimeline(ind)

console.log(`■ 降り方の比較（日経225・${rows[0].date}〜${rows[rows.length - 1].date}・${rows.length}営業日）`)
console.log('  入り口は対照群の決定論ルールで固定し、**降り方だけ**を変えて比べる\n')

const a = run(rows, ind, timeline, 'stop')
const b = run(rows, ind, timeline, 'fade')

const line = (label, x) => {
  console.log(`  ${label}`)
  console.log(`    最終資産 ${x.equity.toLocaleString()}円 / CAGR ${x.cagr}% / 最大DD ${x.maxDd}%`)
  console.log(`    トレード ${x.trades}回 / 勝率 ${x.winRate}% / 平均利益 ${x.avgWin}% / 平均損失 ${x.avgLoss}% / 期待値 ${x.expectancy}%`)
  console.log(`    内訳: ${x.byReason || 'なし'}`)
}
line('A案（損切りに任せる＝いまの規則）', a)
console.log('')
line('B案（勢いが枯れたら手仕舞う）', b)

console.log('\n■ 差')
console.log(`  CAGR ${r2(b.cagr - a.cagr)}pt / 最大DD ${r2(b.maxDd - a.maxDd)}pt / 期待値 ${r2(b.expectancy - a.expectancy)}pt / 勝率 ${r2(b.winRate - a.winRate)}pt`)
console.log('\n🔵 これは規則の比較であって、売買の推奨ではありません。')
