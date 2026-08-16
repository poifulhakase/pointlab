import { describe, it, expect } from 'vitest'
import {
  sideOfDecision, computeOutcome, calibrationBins, summarize, HORIZONS,
// @ts-expect-error — .mjs に型定義は無い（roboAccount.mjs と同じ扱い）
} from '../roboOutcome.mjs'

/** 100 から始めて、渡した終値をそのまま並べた日足を作る */
const barsOf = (closes: number[], from = 1) =>
  closes.map((c, i) => ({
    date: `2026-08-${String(from + i).padStart(2, '0')}`,
    open: c, high: c, low: c, close: c,
  }))

const open = (symbol: string, confidence_pct = 60) => ({
  action: 'open', symbol, qty: 10, confidence_pct, reason: 'テスト', counter: 'テスト', user_note: '',
})
const hold = { action: 'hold', symbol: 'none', qty: 0, confidence_pct: 40, reason: 'テスト', counter: 'テスト', user_note: '' }

describe('sideOfDecision', () => {
  it('ブル銘柄は bull、ベア銘柄は bear', () => {
    expect(sideOfDecision(open('1321'))).toBe('bull')
    expect(sideOfDecision(open('1570'))).toBe('bull')
    expect(sideOfDecision(open('1571'))).toBe('bear')
    expect(sideOfDecision(open('1357'))).toBe('bear')
  })

  it('hold・close・不明な銘柄は方向を持たない', () => {
    expect(sideOfDecision(hold)).toBe(null)
    expect(sideOfDecision({ action: 'close', symbol: '1321' })).toBe(null)
    expect(sideOfDecision(open('9999'))).toBe(null)
    expect(sideOfDecision(null)).toBe(null)
  })
})

describe('computeOutcome', () => {
  // 判断日 8/03（終値100）→ 1日後 101（+1%）→ 5日後 105（+5%）
  const bars = barsOf([98, 99, 100, 101, 102, 103, 104, 105], 1)

  it('起点は判断した日の終値（引成の約定基準）', () => {
    const o = computeOutcome({ decision: open('1321'), date: '2026-08-03', bars })
    expect(o.entry_close).toBe(100)
    expect(o.entry_date).toBe('2026-08-03')
    expect(o.next_open).toBe(101)   // 寄り基準で測り直したいとき用
  })

  it('ブルは上げれば当たり、5日後まで埋まれば complete', () => {
    const o = computeOutcome({ decision: open('1321'), date: '2026-08-03', bars })
    expect(o.side).toBe('bull')
    expect(o.horizons['1d'].ret_pct).toBe(1)
    expect(o.horizons['1d'].edge_pct).toBe(1)
    expect(o.horizons['1d'].hit).toBe(true)
    expect(o.horizons['5d'].ret_pct).toBe(5)
    expect(o.horizons['5d'].hit).toBe(true)
    expect(o.complete).toBe(true)
  })

  it('ベアは同じ上げで外れになる（edge の符号が反転する）', () => {
    const o = computeOutcome({ decision: open('1357'), date: '2026-08-03', bars })
    expect(o.side).toBe('bear')
    expect(o.horizons['5d'].ret_pct).toBe(5)
    expect(o.horizons['5d'].edge_pct).toBe(-5)
    expect(o.horizons['5d'].hit).toBe(false)
  })

  it('hold は当否を付けない（何もしなかった日を勝率に混ぜない）', () => {
    const o = computeOutcome({ decision: hold, date: '2026-08-03', bars })
    expect(o.side).toBe(null)
    expect(o.horizons['5d'].ret_pct).toBe(5)   // 相場の動きは記録する
    expect(o.horizons['5d'].hit).toBe(null)    // が、勝ち負けは付けない
    expect(o.horizons['5d'].edge_pct).toBe(null)
  })

  it('動きがゼロの日は勝ちにしない', () => {
    const flat = barsOf([100, 100, 100, 100, 100, 100, 100], 1)
    const o = computeOutcome({ decision: open('1321'), date: '2026-08-01', bars: flat })
    expect(o.horizons['5d'].ret_pct).toBe(0)
    expect(o.horizons['5d'].hit).toBe(false)
  })

  it('先の足がまだ無いぶんは null のまま complete:false（次の実行で埋まる）', () => {
    const short = barsOf([100, 101], 1)
    const o = computeOutcome({ decision: open('1321'), date: '2026-08-01', bars: short })
    expect(o.horizons['1d'].hit).toBe(true)
    expect(o.horizons['5d'].hit).toBe(null)
    expect(o.horizons['5d'].date).toBe(null)
    expect(o.complete).toBe(false)
  })

  it('起点の足が無い・材料が無い日は測らない（null を返す）', () => {
    expect(computeOutcome({ decision: open('1321'), date: '2026-09-99', bars })).toBe(null)
    expect(computeOutcome({ decision: open('1321'), date: '2026-08-03', bars: [] })).toBe(null)
    expect(computeOutcome({ decision: open('1321'), date: null, bars })).toBe(null)
  })

  it('日足の並びが逆でも同じ結果になる', () => {
    const asc = computeOutcome({ decision: open('1321'), date: '2026-08-03', bars })
    const desc = computeOutcome({ decision: open('1321'), date: '2026-08-03', bars: [...bars].reverse() })
    expect(desc).toEqual(asc)
  })
})

describe('calibrationBins', () => {
  const bars = barsOf([100, 101, 102, 103, 104, 105, 106], 1)
  const down = barsOf([100, 99, 98, 97, 96, 95, 94], 1)

  // 確信度80%で2回ブル、うち1回は下げ相場＝実勝率50%（＝自信過剰30ポイント）
  const rows = [
    computeOutcome({ decision: open('1321', 80), date: '2026-08-01', bars }),
    computeOutcome({ decision: open('1321', 80), date: '2026-08-01', bars: down }),
    computeOutcome({ decision: open('1321', 55), date: '2026-08-01', bars }),
  ]

  it('帯ごとに「言った確率 vs 実勝率」を出す', () => {
    const bins = calibrationBins(rows, { horizon: 5 })
    const b80 = bins.find((b: { range: string }) => b.range === '80-89%')
    expect(b80.n).toBe(2)
    expect(b80.wins).toBe(1)
    expect(b80.avg_confidence).toBe(80)
    expect(b80.win_rate_pct).toBe(50)
    expect(b80.gap).toBe(-30)          // 負＝自信過剰
    expect(bins.find((b: { range: string }) => b.range === '50-59%').n).toBe(1)
  })

  it('該当が無い帯は出さない／hold は数に入れない', () => {
    const bins = calibrationBins([...rows, computeOutcome({ decision: hold, date: '2026-08-01', bars })], { horizon: 5 })
    expect(bins.map((b: { range: string }) => b.range)).toEqual(['50-59%', '80-89%'])
    expect(bins.reduce((s: number, b: { n: number }) => s + b.n, 0)).toBe(3)
  })

  it('先の足が埋まっていないぶんは採点しない', () => {
    const short = computeOutcome({ decision: open('1321', 80), date: '2026-08-01', bars: barsOf([100, 101], 1) })
    expect(calibrationBins([short], { horizon: 5 })).toEqual([])
    expect(calibrationBins([short], { horizon: 1 })[0].n).toBe(1)
  })
})

describe('summarize', () => {
  const up = barsOf([100, 101, 102, 103, 104, 105, 106], 1)
  const down = barsOf([100, 99, 98, 97, 96, 95, 94], 1)
  const rows = [
    computeOutcome({ decision: open('1321', 70), date: '2026-08-01', bars: up }),   // ブル・当たり
    computeOutcome({ decision: open('1357', 60), date: '2026-08-01', bars: up }),   // ベア・外れ
    computeOutcome({ decision: open('1357', 60), date: '2026-08-01', bars: down }), // ベア・当たり
    computeOutcome({ decision: hold, date: '2026-08-01', bars: up }),               // hold
  ]

  it('方向ありと hold を分けて数える', () => {
    const s = summarize(rows)
    expect(s.logs).toBe(4)
    expect(s.directional).toBe(3)
    expect(s.hold).toBe(1)
  })

  it('horizon ごとに勝率・平均損益・ブル/ベア別を出す', () => {
    const s = summarize(rows).by_horizon['5d']
    expect(s.n).toBe(3)
    expect(s.wins).toBe(2)
    expect(s.win_rate_pct).toBe(66.67)
    expect(s.avg_edge_pct).toBe(1.67)   // (+5 −5 +5) / 3 = 1.666…
    expect(s.bull).toEqual({ n: 1, win_rate_pct: 100 })
    expect(s.bear).toEqual({ n: 2, win_rate_pct: 50 })
  })

  it('材料が無くても落ちない', () => {
    const s = summarize([])
    expect(s.logs).toBe(0)
    expect(s.by_horizon['5d'].win_rate_pct).toBe(null)
    expect(Object.keys(s.by_horizon)).toEqual(HORIZONS.map((h: number) => `${h}d`))
  })
})
