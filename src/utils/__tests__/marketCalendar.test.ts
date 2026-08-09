import { describe, it, expect } from 'vitest'
// 型は marketCalendar.d.mts で解決される
import { closedLabel, nextBusinessDay, upcomingBusinessDays, toYmd, parseYmd } from '../marketCalendar.mjs'

// 🔴 疑似トレードは「営業日か」で走る／走らないを決める。
//    ここが崩れると祝日に発注したり、営業日を丸ごと飛ばしたりする。

describe('closedLabel', () => {
  it('土日はその旨を返す', () => {
    expect(closedLabel(new Date(2026, 7, 8))).toBe('土曜')   // 2026-08-08 土
    expect(closedLabel(new Date(2026, 7, 9))).toBe('日曜')   // 2026-08-09 日
  })

  it('祝日は「祝日」を返す', () => {
    expect(closedLabel(new Date(2026, 7, 11))).toBe('祝日')  // 山の日
  })

  it('年末年始は専用のラベルを返す', () => {
    expect(closedLabel(new Date(2026, 11, 31))).toBe('年末休場')
    expect(closedLabel(new Date(2027, 0, 4))).toBe(null)     // 1/4 は営業日
  })

  it('平常の営業日は null', () => {
    expect(closedLabel(new Date(2026, 7, 12))).toBe(null)    // 水
  })
})

describe('nextBusinessDay', () => {
  it('金曜の翌営業日は月曜', () => {
    expect(toYmd(nextBusinessDay(parseYmd('2026-08-07')))).toBe('2026-08-10')
  })

  it('祝日を飛ばす（8/11 山の日）', () => {
    expect(toYmd(nextBusinessDay(parseYmd('2026-08-10')))).toBe('2026-08-12')
  })
})

describe('upcomingBusinessDays', () => {
  it('当日を含めず、休場を飛ばして n 日ぶん返す', () => {
    const days = upcomingBusinessDays(parseYmd('2026-08-07'), 3).map(toYmd)
    expect(days).toEqual(['2026-08-10', '2026-08-12', '2026-08-13'])
  })
})
