#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────
// ロボ口座 対照群バックテスト
//
// 目的: LLM 判断はバックテストできない。だから「決定論ベースライン（対照群）が
//       過去にどれだけの成績だったか」を先に確定させ、Go/No-Go の比較対象を作る。
//       （docs/robo-trade-design.md §5・§2 論点2）
//
// 🔴 レバレッジETFは日次リバランスで横ばい相場では減価する。日経指数×倍率の
//    近似は成績が良く出るので、2本立てで測る:
//      A) 指数近似  … ^N225 × 倍率（20年・長期の性質を見る）
//      B) ETF実データ … 1321/1570/1571/1357 の実際の値動き（上場来・減価込みの実力）
//    A と B の差が「近似で嵩上げされていた分」。
//
// 使い方: node scripts/backtest-robo.mjs
// ──────────────────────────────────────────────────────────────────────────

import {
  UNIVERSE,
  computeIndicators,
  baselineTimeline,
  stopPrice,
  isStopHit,
} from '../src/utils/robotStrategy.mjs'

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }
const COST = 0.0004          // 片道コスト 0.04%
const INITIAL_CASH = 1000000 // 疑似元本100万円（設計書 §0）

const r2 = v => (v == null ? null : Math.round(v * 100) / 100)
const pad = (s, n) => String(s).padStart(n)

// ── データ取得 ────────────────────────────────────────────────────────────

async function fetchDaily(symbol, years = 21) {
  const p2 = Math.floor(Date.now() / 1000)
  const p1 = p2 - years * 365 * 24 * 3600
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d`
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${symbol}`)
  const j = await res.json()
  const r = j?.chart?.result?.[0]
  if (!r) throw new Error(`no result for ${symbol}`)
  const ts = r.timestamp ?? []
  const q = r.indicators?.quote?.[0] ?? {}
  const rows = []
  for (let i = 0; i < ts.length; i++) {
    if (q.close?.[i] == null) continue
    rows.push({
      date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
      open: q.open?.[i] ?? q.close[i],
      high: q.high?.[i] ?? q.close[i],
      low: q.low?.[i] ?? q.close[i],
      close: q.close[i],
    })
  }
  return rows
}

// ── 執行シミュレーション ──────────────────────────────────────────────────
//
// 🔴 判断は「その日の終値」で行い、約定は「翌営業日の始値」。
//    終値で約定したことにすると、実際には取れない価格で記録され成績が良く出る。
//    （設計書 §4「約定価格の決め方」）

/**
 * タイムライン（日次の side）と価格系列から疑似口座を回す。
 * priceOf(side, i) … その日に建てる銘柄の価格系列を返す関数
 */
function simulate({ timeline, priceSeries, vixSeries, startIdx }) {
  let cash = INITIAL_CASH
  let pos = null              // { side, qty, entry, stop, entryIdx }
  const trades = []
  const equityCurve = []
  let peak = INITIAL_CASH
  let maxDD = 0
  let stopThenReversed = 0

  const n = timeline.length

  for (let i = startIdx; i < n - 1; i++) {
    const want = timeline[i].side          // 今日の終値で出た判断
    const execIdx = i + 1                  // 約定は翌営業日の始値
    const vix = vixSeries?.[i] ?? null

    // ① 損切りの確認（保有中のみ・終値ベース）
    if (pos) {
      const series = priceSeries[pos.side]
      const close = series[i]?.close
      if (isStopHit({ close, stopPrice: pos.stop })) {
        const exit = series[execIdx]?.open
        if (exit != null) {
          cash += pos.qty * exit * (1 - COST)
          const pnl = (exit - pos.entry) * pos.qty
          trades.push({ ...pos, exitIdx: execIdx, exit, pnl, exitReason: 'stop' })
          // 損切り後 5営業日で元の方向へ 2%以上動いたか（損切りが近すぎないかの検証）
          const after = series[Math.min(execIdx + 5, n - 1)]?.close
          if (after != null && (after - exit) / exit >= 0.02) stopThenReversed++
          pos = null
        }
      }
    }

    // ② 方向が変わった / 手仕舞い
    if (pos && want !== pos.side) {
      const series = priceSeries[pos.side]
      const exit = series[execIdx]?.open
      if (exit != null) {
        cash += pos.qty * exit * (1 - COST)
        trades.push({ ...pos, exitIdx: execIdx, exit, pnl: (exit - pos.entry) * pos.qty, exitReason: 'signal' })
        pos = null
      }
    }

    // ③ 新規建て
    if (!pos && want) {
      const series = priceSeries[want]
      const entry = series[execIdx]?.open
      const atr = series[i]?.atr20
      if (entry != null && entry > 0 && atr != null) {
        const qty = Math.floor((cash * (1 - COST)) / entry)
        if (qty > 0) {
          const s = stopPrice({ entry, atr20: atr, vix })
          cash -= qty * entry * (1 + COST)
          pos = { side: want, qty, entry, stop: s?.price ?? null, stopRule: s?.rule ?? null, entryIdx: execIdx }
        }
      }
    }

    // ④ 評価額
    let equity = cash
    if (pos) {
      const close = priceSeries[pos.side][i]?.close
      if (close != null) equity += pos.qty * close
    }
    equityCurve.push({ date: timeline[i].date, equity })
    peak = Math.max(peak, equity)
    maxDD = Math.min(maxDD, equity / peak - 1)
  }

  // 最終日に建玉が残っていれば時価で締める
  if (pos) {
    const close = priceSeries[pos.side][n - 1]?.close
    if (close != null) {
      cash += pos.qty * close * (1 - COST)
      trades.push({ ...pos, exitIdx: n - 1, exit: close, pnl: (close - pos.entry) * pos.qty, exitReason: 'eod' })
    }
    pos = null
  }

  const wins = trades.filter(t => t.pnl > 0).length
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0)
  const years = (equityCurve.length || 1) / 245
  const finalEquity = cash

  return {
    trades: trades.length,
    winRate: trades.length ? r2(wins / trades.length) : null,
    expectancy: trades.length ? Math.round(totalPnl / trades.length) : null,
    totalPnlPct: r2((finalEquity / INITIAL_CASH - 1) * 100),
    cagr: r2((Math.pow(finalEquity / INITIAL_CASH, 1 / years) - 1) * 100),
    maxDrawdownPct: r2(maxDD * 100),
    stopThenReversed,
    days: equityCurve.length,
    years: r2(years),
  }
}

// ── 指数近似の合成価格（レバETFを日経×倍率で作る）─────────────────────────
//
// 🔴 これは近似。実際のレバETFは日次リバランスで横ばい相場では減価するので、
//    この系列は実力より良く出る。ETF実データとの差を必ず見ること。

function synthesize(nk, { side, leverage }) {
  const sign = side === 'bull' ? 1 : -1
  const out = [{ date: nk[0].date, open: 10000, high: 10000, low: 10000, close: 10000 }]
  for (let i = 1; i < nk.length; i++) {
    const ret = (nk[i].close - nk[i - 1].close) / nk[i - 1].close
    const prev = out[i - 1].close
    const close = prev * (1 + sign * leverage * ret)
    const openRet = (nk[i].open - nk[i - 1].close) / nk[i - 1].close
    const open = prev * (1 + sign * leverage * openRet)
    const hi = Math.max(open, close) * 1.004
    const lo = Math.min(open, close) * 0.996
    out.push({ date: nk[i].date, open, high: hi, low: lo, close })
  }
  return out
}

// ── 出力 ──────────────────────────────────────────────────────────────────

function report(label, r) {
  console.log(
    `  ${label.padEnd(26)} ` +
    `トレード${pad(r.trades, 4)}件  勝率${pad(r.winRate == null ? '-' : Math.round(r.winRate * 100), 4)}%  ` +
    `期待値${pad(r.expectancy == null ? '-' : r.expectancy.toLocaleString(), 9)}円  ` +
    `累計${pad(r.totalPnlPct, 8)}%  CAGR${pad(r.cagr, 7)}%  DD${pad(r.maxDrawdownPct, 8)}%  ` +
    `損切後逆行${pad(r.stopThenReversed, 3)}回`,
  )
}

async function main() {
  console.log('=== ロボ口座 対照群（決定論ベースライン）バックテスト ===')
  console.log('判断=終値 / 約定=翌営業日始値 / コスト片道0.04% / 元本100万円\n')

  // ── A) 指数近似（20年）──
  console.log('[fetch] ^N225 日次20年...')
  const nkRaw = await fetchDaily('^N225', 21)
  console.log(`  → ${nkRaw.length}営業日`)

  console.log('[fetch] ^VIX 日次20年...')
  let vixRows = []
  try {
    vixRows = await fetchDaily('^VIX', 21)
  } catch (e) {
    console.log(`  ⚠ VIX 取得失敗（${e.message}）→ 損切り倍率は既定の2.5を使う`)
  }
  const vixByDate = new Map(vixRows.map(r => [r.date, r.close]))

  const nk = computeIndicators(nkRaw)
  const timeline = baselineTimeline(nk)
  const vixSeries = nk.map(r => vixByDate.get(r.date) ?? null)

  const synthSeries = {
    bull: computeIndicators(synthesize(nkRaw, UNIVERSE.bull2)),
    bear: computeIndicators(synthesize(nkRaw, UNIVERSE.bear2)),
  }

  console.log('\n========== A) 指数近似（^N225 × 2倍・20年）==========')
  console.log('🔴 レバETFの減価を含まないため、実力より良く出る')
  const resSynth = simulate({ timeline, priceSeries: synthSeries, vixSeries, startIdx: 200 })
  report('対照群（ブル2倍/ベア2倍）', resSynth)

  // 参考: 買い持ちとの比較
  const bh = simulate({
    timeline: timeline.map(t => ({ ...t, side: 'bull' })),
    priceSeries: synthSeries, vixSeries, startIdx: 200,
  })
  report('参考: 日経2倍を持ちっぱなし', bh)

  // ── B) ETF実データ（上場来）──
  console.log('\n========== B) ETF実データ（減価込みの実力）==========')
  const etf = {}
  for (const key of ['bull2', 'bear2']) {
    const u = UNIVERSE[key]
    process.stdout.write(`[fetch] ${u.code} ${u.name}...`)
    try {
      const rows = await fetchDaily(`${u.code}.T`, 21)
      etf[u.side] = computeIndicators(rows)
      console.log(` ${rows.length}営業日（${rows[0].date} 〜）`)
    } catch (e) {
      console.log(` ⚠ 失敗: ${e.message}`)
    }
  }

  if (etf.bull && etf.bear) {
    // 両ETFがそろっている期間だけで測る
    const from = [etf.bull[0].date, etf.bear[0].date].sort().pop()
    const idx = nk.findIndex(r => r.date >= from)
    const startIdx = Math.max(200, idx + 20)

    // ETF系列を日経の日付軸に合わせる（無い日は直前の値を引き継ぐ）
    const align = (src) => {
      const byDate = new Map(src.map(r => [r.date, r]))
      let last = null
      return nk.map(r => {
        const hit = byDate.get(r.date)
        if (hit) last = hit
        return last ?? { open: null, high: null, low: null, close: null, atr20: null }
      })
    }
    const etfSeries = { bull: align(etf.bull), bear: align(etf.bear) }

    console.log(`\n  期間: ${from} 以降（両ETFがそろう区間）`)
    const resEtf = simulate({ timeline, priceSeries: etfSeries, vixSeries, startIdx })
    report('対照群（1570 / 1357）', resEtf)

    // 同じ期間で指数近似も測り、乖離を出す
    const resSynthSame = simulate({ timeline, priceSeries: synthSeries, vixSeries, startIdx })
    report('同期間の指数近似', resSynthSame)

    const gapCagr = r2((resEtf.cagr ?? 0) - (resSynthSame.cagr ?? 0))
    console.log(`\n  🔴 近似との差: CAGR ${gapCagr > 0 ? '+' : ''}${gapCagr}ポイント`)
    console.log('     マイナスなら「指数×倍率の近似が実力を嵩上げしていた」分。')
    console.log('     Go/No-Go の比較対象には B) ETF実データ を使うこと。')
  } else {
    console.log('  ⚠ ETF実データがそろわなかったため、B は測れていない')
  }

  console.log('\n========== 対照群のシグナル内訳（20年）==========')
  const counts = { bull: 0, bear: 0, none: 0 }
  for (let i = 200; i < timeline.length; i++) counts[timeline[i].side ?? 'none']++
  const tot = counts.bull + counts.bear + counts.none
  console.log(`  ブル ${counts.bull}日 (${Math.round(counts.bull / tot * 100)}%)  ` +
    `ベア ${counts.bear}日 (${Math.round(counts.bear / tot * 100)}%)  ` +
    `ノーポジ ${counts.none}日 (${Math.round(counts.none / tot * 100)}%)`)

  console.log('\n※ この数字が LLM 判断の比較対象（Go/No-Go の「対照群を上回る」の基準）になる。')
  console.log('※ ロジックの定義は src/utils/robotStrategy.mjs（単一情報源）。ここでは式を書かない。')
}

main().catch(e => { console.error(e); process.exit(1) })
