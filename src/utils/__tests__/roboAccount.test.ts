import { describe, it, expect } from 'vitest'
import {
  emptyAccount, equityOf, openPosition, closePosition,
  applyDecision, applyStop, recomputeStats, pushEquity, INITIAL_CASH,
// @ts-expect-error — .mjs に型定義は無い（tevCore.mjs と同じ扱い）
} from '../../../scripts/roboAccount.mjs'

const PRICES: Record<string, number> = { '1321': 40000, '1570': 30000, '1571': 1000, '1357': 200 }
const priceOf = (s: string) => PRICES[s] ?? null
const atrOf = () => 600

const openDecision = (symbol: string, qty = 10) => ({
  action: 'open', symbol, qty, confidence_pct: 60,
  reason: 'テスト', counter: 'テスト', user_note: '',
})

describe('emptyAccount', () => {
  it('元本100万円で空の口座ができる', () => {
    const a = emptyAccount()
    expect(a.cash).toBe(INITIAL_CASH)
    expect(a.position).toBe(null)
    expect(a.trades).toEqual([])
    expect(a.universe).toEqual(['1321.T', '1570.T', '1571.T', '1357.T'])
  })
})

describe('openPosition', () => {
  it('資金が減り、建玉と約定履歴ができる', () => {
    const a = openPosition({
      account: emptyAccount(), symbol: '1570', qty: 10, price: 30000,
      atr20: 600, vix: 15, date: '2026-08-10', execDate: '2026-08-11',
    })
    expect(a.position.symbol).toBe('1570')
    expect(a.position.qty).toBe(10)
    expect(a.cash).toBeLessThan(INITIAL_CASH)
    expect(a.trades).toHaveLength(1)
    expect(a.trades[0].side).toBe('buy')
  })

  it('🔴 建てた瞬間に損切り値が確定して記録される', () => {
    const a = openPosition({
      account: emptyAccount(), symbol: '1570', qty: 10, price: 30000,
      atr20: 600, vix: 15, date: '2026-08-10', execDate: '2026-08-11',
    })
    expect(a.position.stop_price).toBe(28800)   // 30000 - 600*2.0
    expect(a.trades[0].stop_price).toBe(28800)
    expect(a.trades[0].stop_rule).toBe('atr20x2.0')
  })

  it('🔴 資金を超える qty は機械的に切り詰められる', () => {
    const a = openPosition({
      account: emptyAccount(), symbol: '1570', qty: 9999, price: 30000,
      atr20: 600, vix: 15, date: '2026-08-10', execDate: '2026-08-11',
    })
    expect(a.position.qty).toBeLessThanOrEqual(33)
    expect(a.cash).toBeGreaterThanOrEqual(0)
  })

  it('買えない条件では建玉を作らない', () => {
    const a0 = emptyAccount()
    expect(openPosition({ account: a0, symbol: 'none', qty: 10, price: 30000 }).position).toBe(null)
    expect(openPosition({ account: a0, symbol: '1570', qty: 10, price: null }).position).toBe(null)
  })

  it('理由と反証が約定履歴に残る', () => {
    const a = openPosition({
      account: emptyAccount(), symbol: '1570', qty: 10, price: 30000, atr20: 600, vix: 15,
      date: '2026-08-10', execDate: '2026-08-11',
      decision: { confidence_pct: 70, reason: '上昇トレンド', counter: '25日線割れ' },
    })
    expect(a.trades[0].reason).toBe('上昇トレンド')
    expect(a.trades[0].counter).toBe('25日線割れ')
  })
})

describe('closePosition', () => {
  const held = openPosition({
    account: emptyAccount(), symbol: '1570', qty: 10, price: 30000,
    atr20: 600, vix: 15, date: '2026-08-10', execDate: '2026-08-11',
  })

  it('建玉が消え、損益が記録される', () => {
    const a = closePosition({ account: held, price: 33000, date: '2026-08-20', execDate: '2026-08-21', reason: 'signal' })
    expect(a.position).toBe(null)
    expect(a.trades).toHaveLength(2)
    expect(a.trades[1].pnl).toBeGreaterThan(0)
  })

  it('値下がりしていれば損益はマイナス', () => {
    const a = closePosition({ account: held, price: 27000, date: '2026-08-20', execDate: '2026-08-21', reason: 'stop' })
    expect(a.trades[1].pnl).toBeLessThan(0)
    expect(a.trades[1].exit_reason).toBe('stop')
  })

  it('建玉が無ければ何も起きない', () => {
    const a = closePosition({ account: emptyAccount(), price: 30000, date: 'x', execDate: 'y' })
    expect(a.trades).toHaveLength(0)
  })
})

describe('applyDecision', () => {
  const args = { priceOf, atrOf, vix: 15, date: '2026-08-10', execDate: '2026-08-11' }

  it('hold なら何も起きない', () => {
    const r = applyDecision({ account: emptyAccount(), decision: { action: 'hold', symbol: 'none', qty: 0 }, ...args })
    expect(r.actions).toEqual(['hold'])
    expect(r.account.position).toBe(null)
  })

  it('open で建玉ができる', () => {
    const r = applyDecision({ account: emptyAccount(), decision: openDecision('1570'), ...args })
    expect(r.actions).toContain('open')
    expect(r.account.position.symbol).toBe('1570')
  })

  it('🔴 逆方向を建てるときは「決済→新規」に分解される（同時保有を作らない）', () => {
    const bull = applyDecision({ account: emptyAccount(), decision: openDecision('1570'), ...args }).account
    const r = applyDecision({ account: bull, decision: openDecision('1357'), ...args })
    expect(r.actions).toContain('close(reverse)')
    expect(r.actions).toContain('open')
    expect(r.account.position.symbol).toBe('1357')
    expect(r.account.trades.filter((t: { side: string }) => t.side === 'sell')).toHaveLength(1)
  })

  it('🔴 同方向でも倍率が違えば入れ替える（1倍→2倍）', () => {
    const b1 = applyDecision({ account: emptyAccount(), decision: openDecision('1321'), ...args }).account
    const r = applyDecision({ account: b1, decision: openDecision('1570'), ...args })
    expect(r.actions).toContain('close(switch)')
    expect(r.account.position.symbol).toBe('1570')
  })

  it('同じ銘柄を既に持っていれば増し玉しない', () => {
    const held = applyDecision({ account: emptyAccount(), decision: openDecision('1570'), ...args }).account
    const r = applyDecision({ account: held, decision: openDecision('1570'), ...args })
    expect(r.actions).toEqual(['already-held'])
    expect(r.account.trades).toHaveLength(1)
  })

  it('close で手仕舞いされる', () => {
    const held = applyDecision({ account: emptyAccount(), decision: openDecision('1570'), ...args }).account
    const r = applyDecision({ account: held, decision: { action: 'close', symbol: '1570', qty: 0 }, ...args })
    expect(r.actions).toEqual(['close'])
    expect(r.account.position).toBe(null)
  })
})

describe('applyStop', () => {
  const held = openPosition({
    account: emptyAccount(), symbol: '1570', qty: 10, price: 30000,
    atr20: 600, vix: 15, date: '2026-08-10', execDate: '2026-08-11',
  })

  it('損切り値を割ったら決済される', () => {
    const r = applyStop({ account: held, priceOf: () => 28000, date: 'x', execDate: 'y' })
    expect(r.hit).toBe(true)
    expect(r.account.position).toBe(null)
    expect(r.account.trades[1].exit_reason).toBe('stop')
  })

  it('損切り値より上なら何も起きない', () => {
    const r = applyStop({ account: held, priceOf: () => 29000, date: 'x', execDate: 'y' })
    expect(r.hit).toBe(false)
    expect(r.account.position).not.toBe(null)
  })

  it('建玉が無ければ何も起きない', () => {
    expect(applyStop({ account: emptyAccount(), priceOf: () => 1, date: 'x', execDate: 'y' }).hit).toBe(false)
  })
})

describe('equityOf / pushEquity / recomputeStats', () => {
  it('評価額は現金＋建玉の時価', () => {
    const a = openPosition({
      account: emptyAccount(), symbol: '1570', qty: 10, price: 30000,
      atr20: 600, vix: 15, date: 'x', execDate: 'y',
    })
    const eq = equityOf(a, () => 31000)
    expect(eq).toBeGreaterThan(a.cash)
    expect(eq).toBeCloseTo(a.cash + 10 * 31000, 0)
  })

  it('同じ日付は二重に積まない', () => {
    let a = pushEquity(emptyAccount(), '2026-08-10', 1000000)
    a = pushEquity(a, '2026-08-10', 999999)
    expect(a.equity_curve).toHaveLength(1)
  })

  it('成績は約定履歴から計算し直す', () => {
    let a = openPosition({
      account: emptyAccount(), symbol: '1570', qty: 10, price: 30000,
      atr20: 600, vix: 15, date: 'd1', execDate: 'e1',
    })
    a = closePosition({ account: a, price: 33000, date: 'd2', execDate: 'e2', reason: 'signal' })
    a = pushEquity(a, '2026-08-10', 1000000)
    a = pushEquity(a, '2026-08-11', 900000)
    const s = recomputeStats(a).stats
    expect(s.closed_trades).toBe(1)
    expect(s.win_rate).toBe(1)
    expect(s.expectancy).toBeGreaterThan(0)
    expect(s.max_drawdown_pct).toBeLessThan(0)
  })
})
