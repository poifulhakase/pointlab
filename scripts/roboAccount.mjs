// ──────────────────────────────────────────────────────────────────────────
// ぽいロボ 疑似トレード: ロボ口座の状態管理（純粋な計算だけ。IO はしない）
//
// 🔴 約定履歴（trades）は追記のみ。過去行を書き換える関数はここに置かない。
// 🔴 建玉があるのに逆方向を建てようとしたら「決済 → 新規」の2約定に分解する
//    （ドテン。LLM に2ステップ書かせず、コード側で保証する）。
// ──────────────────────────────────────────────────────────────────────────

import { bySymbol, stopPrice, clampQty } from '../src/utils/robotStrategy.mjs'

export const INITIAL_CASH = 1000000

export function emptyAccount({ logicVersion = 'robo-v1-llm', decider = null } = {}) {
  return {
    generated_at: null,
    logic_version: logicVersion,
    decider,
    universe: ['1321.T', '1570.T', '1571.T', '1357.T'],
    initial_cash: INITIAL_CASH,
    cash: INITIAL_CASH,
    trades: [],
    position: null,
    equity_curve: [],
    stats: { closed_trades: 0, win_rate: null, expectancy: null, max_drawdown_pct: null, stop_then_reversed: 0 },
    baseline: null,
  }
}

/** その日の評価額（現金＋建玉の時価） */
export function equityOf(account, priceOf) {
  const p = account.position
  if (!p || !p.qty) return account.cash
  const px = priceOf(p.symbol)
  return account.cash + (px != null ? p.qty * px : 0)
}

/**
 * 決済する。返り値は新しい account（非破壊）。
 * @param {object} p { account, price, date, execDate, reason }
 */
export function closePosition({ account, price, date, execDate, reason, cost = 0.0004 }) {
  const pos = account.position
  if (!pos || !pos.qty || price == null) return account

  const proceeds = pos.qty * price * (1 - cost)
  const pnl = (price - pos.avg_price) * pos.qty
  const trade = {
    id: `${date}-close`,
    decided_on: date,
    executed_on: execDate,
    side: 'sell',
    symbol: pos.symbol,
    qty: pos.qty,
    price,
    entry_price: pos.avg_price,
    pnl: Math.round(pnl),
    exit_reason: reason,
    stop_price: pos.stop_price ?? null,
  }
  return {
    ...account,
    cash: account.cash + proceeds,
    position: null,
    trades: [...account.trades, trade],
  }
}

/**
 * 新規建てする。返り値は新しい account（非破壊）。
 * 🔴 qty は資金でクリップする（LLM に上限を破らせない）。
 */
export function openPosition({ account, symbol, qty, price, atr20, vix, date, execDate, decision, cost = 0.0004 }) {
  if (!symbol || symbol === 'none' || price == null || price <= 0) return account
  const capped = clampQty({ qty, cash: account.cash * (1 - cost), price })
  if (capped <= 0) return account

  const s = stopPrice({ entry: price, atr20, vix })
  const spend = capped * price * (1 + cost)
  const trade = {
    id: `${date}-open`,
    decided_on: date,
    executed_on: execDate,
    side: 'buy',
    symbol,
    qty: capped,
    price,
    confidence_pct: decision?.confidence_pct ?? null,
    reason: decision?.reason ?? null,
    counter: decision?.counter ?? null,
    stop_price: s?.price ?? null,
    stop_rule: s?.rule ?? null,
  }
  return {
    ...account,
    cash: account.cash - spend,
    position: { symbol, qty: capped, avg_price: price, stop_price: s?.price ?? null, stop_rule: s?.rule ?? null, opened_on: execDate },
    trades: [...account.trades, trade],
  }
}

/**
 * 判断を口座に適用する。
 * 🔴 ここがドテンの分解を担う。逆方向の open は「決済 → 新規」になる。
 *
 * @returns {{ account, actions: string[] }}
 */
export function applyDecision({ account, decision, priceOf, atrOf, vix, date, execDate }) {
  const actions = []
  let acc = account
  const d = decision ?? {}

  // ① 手仕舞い
  if (d.action === 'close' && acc.position) {
    const px = priceOf(acc.position.symbol)
    acc = closePosition({ account: acc, price: px, date, execDate, reason: 'signal' })
    actions.push('close')
    return { account: acc, actions }
  }

  // ② 新規建て
  if (d.action === 'open' && d.symbol && d.symbol !== 'none') {
    const wantSide = bySymbol(d.symbol)?.side ?? null
    const heldSide = acc.position ? bySymbol(acc.position.symbol)?.side ?? null : null

    // 同じ銘柄を既に持っているなら何もしない（増し玉はしない）
    if (acc.position && acc.position.symbol === d.symbol) {
      actions.push('already-held')
      return { account: acc, actions }
    }
    // 🔴 別銘柄を持っているなら、先に決済（方向が同じでも倍率が違えば入れ替える）
    if (acc.position) {
      const px = priceOf(acc.position.symbol)
      acc = closePosition({ account: acc, price: px, date, execDate, reason: heldSide !== wantSide ? 'reverse' : 'switch' })
      actions.push(heldSide !== wantSide ? 'close(reverse)' : 'close(switch)')
    }
    acc = openPosition({
      account: acc, symbol: d.symbol, qty: d.qty,
      price: priceOf(d.symbol), atr20: atrOf(d.symbol), vix, date, execDate, decision: d,
    })
    if (acc.position) actions.push('open')
    return { account: acc, actions }
  }

  actions.push('hold')
  return { account: acc, actions }
}

/** 損切りに触れていれば決済する */
export function applyStop({ account, priceOf, date, execDate }) {
  const pos = account.position
  if (!pos || !pos.stop_price) return { account, hit: false }
  const close = priceOf(pos.symbol)
  if (close == null || close > pos.stop_price) return { account, hit: false }
  return {
    account: closePosition({ account, price: close, date, execDate, reason: 'stop' }),
    hit: true,
  }
}

/** 成績を再計算する（trades から導出。保存された値は信用しない） */
export function recomputeStats(account) {
  const closed = account.trades.filter(t => t.side === 'sell')
  const n = closed.length
  const wins = closed.filter(t => (t.pnl ?? 0) > 0).length
  const total = closed.reduce((s, t) => s + (t.pnl ?? 0), 0)

  let peak = -Infinity, maxDD = 0
  for (const p of account.equity_curve) {
    peak = Math.max(peak, p.equity)
    if (peak > 0) maxDD = Math.min(maxDD, p.equity / peak - 1)
  }

  return {
    ...account,
    stats: {
      ...account.stats,
      closed_trades: n,
      win_rate: n ? Math.round((wins / n) * 100) / 100 : null,
      expectancy: n ? Math.round(total / n) : null,
      max_drawdown_pct: account.equity_curve.length ? Math.round(maxDD * 10000) / 100 : null,
    },
  }
}

/** 日次の評価額を1点追加する（同じ日付は上書きせず、既にあれば追加しない） */
export function pushEquity(account, date, equity) {
  if (account.equity_curve.some(p => p.date === date)) return account
  return { ...account, equity_curve: [...account.equity_curve, { date, equity: Math.round(equity) }] }
}
