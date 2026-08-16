import { describe, it, expect } from 'vitest'
import {
  median, retOver, linkToIndex, momentum, stance,
// @ts-expect-error — .mjs に型定義は無い（roboOutcome.mjs と同じ扱い）
} from '../poiroboStockCalc.mjs'

/**
 * 中長期モメンタム銘柄の計算。
 * 🔴 いちばん壊れやすいのは **日付の突き合わせ**（片方が休みの日を無視して並べると全部ズレる）。
 *    連動（β・相関）はそこが狂うと平気で嘘の数字になるので、穴あきデータで固定する。
 */

/** 日付つきの日足を作る（土日は作らない＝営業日っぽく並べる） */
function bars(closes: number[], skip: string[] = []) {
  const out: { date: string; close: number; high: number; low: number; sma200?: number | null; sma200slope?: number | null }[] = []
  let day = 1
  for (const c of closes) {
    let date = ''
    do {
      date = `2026-01-${String(day).padStart(2, '0')}`
      day++
    } while (skip.includes(date))
    out.push({ date, close: c, high: c, low: c })
  }
  return out
}

describe('中長期モメンタム銘柄の計算', () => {
  it('中央値は外れ値に引きずられない', () => {
    expect(median([1, 2, 3, 4, 100])).toBe(3)
    expect(median([2, 4])).toBe(3)
    expect(median([])).toBeNull()
  })

  it('n営業日前からの騰落率', () => {
    const rows = bars([100, 110, 121])
    expect(retOver(rows, 1)).toBe(10)
    expect(retOver(rows, 2)).toBe(21)
    // 足りないときは黙って null（0% にしない）
    expect(retOver(rows, 9)).toBeNull()
  })

  it('βと相関は日付で突き合わせて計算する', () => {
    // 指数の日次リターン（ばらつきが無いと β は決まらないので、わざと振れさせる）
    const rets = [1, -0.6, 1.8, 0.4, -1.2, 2.1, -0.3, 0.9, -1.5, 1.1, 0.2, -0.8, 1.4, -0.4]
    const build = (mult: number) => {
      const closes = [100]
      for (const r of rets) closes.push(closes[closes.length - 1] * (1 + (r * mult) / 100))
      return closes
    }
    const idx = bars(build(1))
    const stock = bars(build(2))          // 指数の2倍動く銘柄
    const link = linkToIndex(stock, idx, 20)
    expect(link.n).toBeGreaterThan(9)
    expect(link.beta).toBeCloseTo(2, 1)
    expect(link.corr).toBeCloseTo(1, 1)
  })

  it('日付が合わない日は捨てる（ズラして数えない）', () => {
    const rets = [1, -0.6, 1.8, 0.4, -1.2, 2.1, -0.3, 0.9, -1.5, 1.1, 0.2, -0.8, 1.4, -0.4]
    /** 日付ごとのリターンから日足を作る（skipDates の日は**その日ごと存在しない**） */
    const build = (mult: number, skipDates: string[] = []) => {
      const out: { date: string; close: number; high: number; low: number }[] = []
      let close = 100
      out.push({ date: '2026-01-01', close, high: close, low: close })
      rets.forEach((r, i) => {
        const date = `2026-01-${String(i + 2).padStart(2, '0')}`
        close = close * (1 + (r * mult) / 100)
        if (skipDates.includes(date)) return          // 🔴 その日は無かったことにする
        out.push({ date, close, high: close, low: close })
      })
      return out
    }
    const idx = build(1)
    // 🔴 銘柄側だけ 2026-01-05 が無い（売買停止・システム障害などで日足が欠ける）
    const stock = build(2, ['2026-01-05'])
    const link = linkToIndex(stock, idx, 20)
    // 日付で突き合わせているので、欠けた日を飛ばしても他の日の β は 2 のまま
    expect(link.beta).toBeCloseTo(2, 0)
    expect(link.n).toBeLessThan(rets.length)
  })

  it('データが少なすぎるときは β を出さない（0にしない）', () => {
    const link = linkToIndex(bars([100, 101]), bars([100, 101]), 60)
    expect(link.beta).toBeNull()
    expect(link.corr).toBeNull()
  })

  it('姿勢は200日線とその向きで決まる', () => {
    expect(stance(null).key).toBe('unknown')
    expect(stance({ above_ma200: false, ma200_up: false }).key).toBe('below')
    expect(stance({ above_ma200: true, ma200_up: false }).key).toBe('flat')
    expect(stance({ above_ma200: true, ma200_up: true }).key).toBe('trend')
    // 日経より強く、52週高値の近くなら leading
    expect(stance({
      above_ma200: true, ma200_up: true,
      ret_vs_index: { m12: 12 }, from_52w_high_pct: -3,
    }).key).toBe('leading')
  })

  it('12-1モメンタムは直近1ヶ月を除いて測る', () => {
    // 260本：最後の21本だけ急落させる。12ヶ月はマイナスでも 12-1 はプラスのまま
    const closes = Array.from({ length: 260 }, (_, i) => 100 + i)      // 100 → 359
    for (let i = 260 - 21; i < 260; i++) closes[i] = 50                // 直近1ヶ月を叩き落とす
    const rows = bars(closes)
    const m = momentum(rows, rows)
    expect(m.ret.m12).toBeLessThan(0)
    expect(m.ret_12_1).toBeGreaterThan(0)
  })
})
