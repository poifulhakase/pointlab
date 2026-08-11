import { describe, it, expect } from 'vitest'
import {
  emptyAccount, equityOf, openPosition, closePosition,
  applyDecision, detectStopHit, queueOrder, applyPending, applyTrail, recomputeStats, pushEquity,
  syncWithReal, describeChange, validateRealPosition, INITIAL_CASH,
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

describe('detectStopHit（判定するだけ・決済はしない）', () => {
  const held = openPosition({
    account: emptyAccount(), symbol: '1570', qty: 10, price: 30000,
    atr20: 600, vix: 15, date: '2026-08-10', execDate: '2026-08-11',
  })

  it('損切り値を割ったら true', () => {
    expect(detectStopHit({ account: held, priceOf: () => 28000 })).toBe(true)
  })

  it('損切り値より上なら false', () => {
    expect(detectStopHit({ account: held, priceOf: () => 29000 })).toBe(false)
  })

  it('建玉が無ければ false', () => {
    expect(detectStopHit({ account: emptyAccount(), priceOf: () => 1 })).toBe(false)
  })
})

// ── 保留注文（2026-08-11 追加）──
// 🔴 08:30 の判断は前営業日の**終値**を見て下すが、実際に買えるのは 09:00 の**寄値**。
//    実測で 1570 の窓（前日終値→寄値）は平均 2.08%・上位10%で 4.82% ある。
//    終値で約定したことにすると、口座の成績が実物と別のものになる。
describe('保留注文を寄値で約定させる', () => {
  const openDay = (symbol: string, qty = 10) => ({
    action: 'open', symbol, qty, confidence_pct: 60, reason: 'テスト', counter: 'テスト', user_note: '',
  })

  it('積んだ時点では約定していない', () => {
    const a = queueOrder({ account: emptyAccount(), decision: openDay('1570'), decidedOn: '2026-08-10' })
    expect(a.position).toBe(null)
    expect(a.trades.length).toBe(0)
    expect(a.pending.decision.symbol).toBe('1570')
  })

  it('🔴 約定価格は終値ではなく寄値になる', () => {
    const a = queueOrder({ account: emptyAccount(), decision: openDay('1570'), plannedStop: 28000, decidedOn: '2026-08-10' })
    // 判断時の終値は 30000（PRICES）。翌朝の寄値は 31000 で飛んでいる
    const r = applyPending({ account: a, openOf: () => 31000, atrOf: () => 600, vix: 15, date: '2026-08-11' })
    expect(r.account.position.avg_price).toBe(31000)
    expect(r.account.trades[0].price).toBe(31000)
  })

  it('🔴 窓ガード＝寄値が損切り値の向こう側なら建てない', () => {
    const a = queueOrder({ account: emptyAccount(), decision: openDay('1570'), plannedStop: 28000, decidedOn: '2026-08-10' })
    const r = applyPending({ account: a, openOf: () => 27500, atrOf: () => 600, vix: 15, date: '2026-08-11' })
    expect(r.gapSkipped).toBe(true)
    expect(r.account.position).toBe(null)
    expect(r.account.trades.length).toBe(0)
    expect(r.account.pending).toBe(null)   // 持ち越さない。翌日また判断する
  })

  it('損切りに触れていた建玉は、寄値で手仕舞われる', () => {
    const held = openPosition({
      account: emptyAccount(), symbol: '1570', qty: 10, price: 30000,
      atr20: 600, vix: 15, date: '2026-08-10', execDate: '2026-08-10',
    })
    const a = queueOrder({ account: held, decision: { action: 'hold' }, stopExit: true, decidedOn: '2026-08-11' })
    // 終値で損切りに触れ、翌朝さらに窓を開けて下に飛んだ
    const r = applyPending({ account: a, openOf: () => 27000, atrOf: () => 600, vix: 15, date: '2026-08-12' })
    expect(r.account.position).toBe(null)
    const t = r.account.trades[1]
    expect(t.exit_reason).toBe('stop')
    expect(t.price).toBe(27000)          // 🔴 損切り値(28800)ではなく、実際に降りられた寄値
  })

  it('保留が無ければ何も起きない', () => {
    const r = applyPending({ account: emptyAccount(), openOf: () => 1, atrOf: () => 1, vix: 15, date: 'x' })
    expect(r.actions).toEqual([])
    expect(r.account.trades.length).toBe(0)
  })
})

describe('describeChange（前回からの変化を人が読める形に）', () => {
  const pos = (symbol: string, qty: number) => ({ symbol, qty })

  it('どちらも保有なしなら「変化なし」', () => {
    const r = describeChange(null, null)
    expect(r.matched).toBe(true)
    expect(r.kind).toBe('none')
  })

  it('同じ銘柄・同じ数量なら一致', () => {
    const r = describeChange(pos('1570', 30), pos('1570', 30))
    expect(r.matched).toBe(true)
    expect(r.kind).toBe('same')
  })

  it('🔴 買い増しは「+◯口」と分かる', () => {
    const r = describeChange(pos('1570', 30), pos('1570', 50))
    expect(r.kind).toBe('increased')
    expect(r.delta).toBe(20)
    expect(r.note).toContain('買い増し')
    expect(r.note).toContain('+20口')
  })

  it('🔴 減らしたら「−◯口」と分かる', () => {
    const r = describeChange(pos('1570', 50), pos('1570', 20))
    expect(r.kind).toBe('decreased')
    expect(r.delta).toBe(-30)
    expect(r.note).toContain('減らした')
  })

  it('🔴 全部手仕舞いが分かる', () => {
    const r = describeChange(pos('1570', 30), null)
    expect(r.kind).toBe('closed')
    expect(r.note).toContain('全部手仕舞い')
  })

  it('🔴 新規で建てたことが分かる（ベアを新規で買った等）', () => {
    const r = describeChange(null, pos('1357', 50))
    expect(r.kind).toBe('opened')
    expect(r.note).toContain('新規')
    expect(r.note).toContain('ベア2倍')
  })

  it('🔴 乗り換え（ブル→ベア）が分かる', () => {
    const r = describeChange(pos('1570', 30), pos('1357', 50))
    expect(r.kind).toBe('switched')
    expect(r.note).toContain('ブル2倍')
    expect(r.note).toContain('ベア2倍')
    expect(r.note).toContain('乗り換え')
  })
})

describe('validateRealPosition（AIの自己申告に頼らない機械チェック）', () => {
  it('妥当な読み取りは通る', () => {
    const issues = validateRealPosition({
      positions: [{ symbol: '1570', qty: 30, avg_price: 30500 }],
      priceOf, cash: INITIAL_CASH,
    })
    expect(issues).toEqual([])
  })

  it('🔴 桁の読み違いを弾く（30,000円を3,000円と読んだ）', () => {
    const issues = validateRealPosition({
      positions: [{ symbol: '1570', qty: 30, avg_price: 3000 }],
      priceOf, cash: INITIAL_CASH,
    })
    expect(issues.length).toBeGreaterThan(0)
    expect(issues[0]).toContain('桁')
  })

  it('🔴 元本に対して大きすぎる数量を弾く', () => {
    const issues = validateRealPosition({
      positions: [{ symbol: '1570', qty: 9999, avg_price: 30000 }],
      priceOf, cash: INITIAL_CASH,
    })
    expect(issues.some((i: string) => i.includes('大きすぎる'))).toBe(true)
  })

  it('対象外の銘柄（個別株）は見ない', () => {
    const issues = validateRealPosition({
      positions: [{ symbol: '7203', qty: 100, avg_price: 2500 }],
      priceOf, cash: INITIAL_CASH,
    })
    expect(issues).toEqual([])
  })
})

describe('syncWithReal（実保有への同期）', () => {
  const held = openPosition({
    account: emptyAccount(), symbol: '1570', qty: 10, price: 30000,
    atr20: 600, vix: 15, date: '2026-08-10', execDate: '2026-08-11',
  })
  const real = (list: { symbol: string; qty: number; avg_price: number }[]) => ({ positions: list })

  it('一致していれば口座は変わらない', () => {
    const r = syncWithReal({
      account: held, realPosition: real([{ symbol: '1570', qty: 10, avg_price: 30000 }]),
      priceOf, date: '2026-08-12', sourceFileId: 'f1',
    })
    expect(r.diff.matched).toBe(true)
    expect(r.account.position.qty).toBe(10)
  })

  it('🔴 実際には手仕舞っていたら、口座も保有なしに合わせる', () => {
    const r = syncWithReal({
      account: held, realPosition: real([]), priceOf, date: '2026-08-12', sourceFileId: 'f1',
    })
    expect(r.account.position).toBe(null)
    expect(r.diff.kind).toBe('closed')
  })

  it('🔴 実際には別の銘柄を持っていたら乗り換えとして合わせる', () => {
    const r = syncWithReal({
      account: held, realPosition: real([{ symbol: '1357', qty: 50, avg_price: 200 }]),
      priceOf, date: '2026-08-12', sourceFileId: 'f1',
    })
    expect(r.account.position.symbol).toBe('1357')
    expect(r.account.position.qty).toBe(50)
    expect(r.diff.kind).toBe('switched')
  })

  it('🔴 差分は必ず divergences に残る（同期しても記録は消さない）', () => {
    const r = syncWithReal({
      account: held, realPosition: real([]), priceOf, date: '2026-08-12', sourceFileId: 'f1',
    })
    expect(r.account.divergences).toHaveLength(1)
    expect(r.account.divergences[0].source_file_id).toBe('f1')
  })

  it('🔴 対象銘柄を2つ以上持っていたら同期しない（勝手に選ばない）', () => {
    const r = syncWithReal({
      account: held,
      realPosition: real([
        { symbol: '1570', qty: 10, avg_price: 30000 },
        { symbol: '1357', qty: 50, avg_price: 200 },
      ]),
      priceOf, date: '2026-08-12', sourceFileId: 'f1',
    })
    expect(r.diff.skipped).toBe(true)
    expect(r.account.position.symbol).toBe('1570')   // 元のまま
    expect(r.account.divergences).toHaveLength(1)
  })

  it('対象外の銘柄（個別株）は無視され、口座に写らない', () => {
    const r = syncWithReal({
      account: emptyAccount(),
      realPosition: real([{ symbol: '7203', qty: 100, avg_price: 2500 }]),
      priceOf, date: '2026-08-12', sourceFileId: 'f1',
    })
    expect(r.account.position).toBe(null)
    expect(r.diff.matched).toBe(true)
  })

  it('同期した画像の file_id を記録する（二重同期の防止に使う）', () => {
    const r = syncWithReal({
      account: held, realPosition: real([]), priceOf, date: '2026-08-12', sourceFileId: 'f9',
    })
    expect(r.account.last_synced_file_id).toBe('f9')
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

  it('🔴 同期由来の約定は成績に入れない（AIの判断ではないため／誤読が成績を汚さない）', () => {
    let a = openPosition({
      account: emptyAccount(), symbol: '1570', qty: 10, price: 30000,
      atr20: 600, vix: 15, date: 'd1', execDate: 'e1',
    })
    // 実保有に合わせて手仕舞い（同期由来）
    a = syncWithReal({ account: a, realPosition: { positions: [] }, priceOf, date: 'd2', sourceFileId: 'f1' }).account
    const s = recomputeStats(a).stats
    expect(a.trades.some((t: { exit_reason?: string }) => t.exit_reason === 'sync')).toBe(true)
    expect(s.closed_trades).toBe(0)   // 同期の決済は数えない
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

describe('applyTrail', () => {
  const acct = (stop: number | null) => ({
    ...emptyAccount(),
    position: { symbol: '1570', qty: 10, avg_price: 30000, stop_price: stop, stop_rule: 'atr20x2.0', opened_on: '2026-08-01' },
  })

  it('含み益が伸びたぶんだけ損切りを引き上げる', () => {
    // 現値 30000・ATR 600・VIX 15 → 30000 - 2.0 x 600 = 28800
    const r = applyTrail({ account: acct(27000), priceOf, atrOf, vix: 15 })
    expect(r.raised).toBe(true)
    expect(r.account.position.stop_price).toBe(28800)
    expect(r.account.position.stop_rule).toContain('trail')
  })

  it('🔴 損切りは下がらない', () => {
    const r = applyTrail({ account: acct(29500), priceOf, atrOf, vix: 15 })
    expect(r.raised).toBe(false)
    expect(r.account.position.stop_price).toBe(29500)
  })

  it('建玉が無ければ何もしない', () => {
    const r = applyTrail({ account: emptyAccount(), priceOf, atrOf, vix: 15 })
    expect(r.raised).toBe(false)
    expect(r.account.position).toBe(null)
  })

  it('🔴 引き上げても約定は増えない（利確はしない）', () => {
    const r = applyTrail({ account: acct(27000), priceOf, atrOf, vix: 15 })
    expect(r.account.trades.length).toBe(0)
    expect(r.account.position.qty).toBe(10)
  })
})
