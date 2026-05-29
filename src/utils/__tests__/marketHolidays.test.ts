import { describe, it, expect } from 'vitest'
import { isMarketClosed, isNationalHoliday, getClosedReason } from '../marketHolidays'

describe('isMarketClosed', () => {
  it('returns true for Saturday', () => {
    expect(isMarketClosed(new Date(2026, 0, 3))).toBe(true) // 土曜
  })

  it('returns true for Sunday', () => {
    expect(isMarketClosed(new Date(2026, 0, 4))).toBe(true) // 日曜
  })

  it('returns false for regular weekday', () => {
    expect(isMarketClosed(new Date(2026, 0, 5))).toBe(false) // 月曜
  })

  it('returns true for Jan 1 (元日)', () => {
    expect(isMarketClosed(new Date(2026, 0, 1))).toBe(true)
  })

  it('returns true for May 3 (憲法記念日)', () => {
    expect(isMarketClosed(new Date(2026, 4, 3))).toBe(true)
  })

  it('returns true for May 4 (みどりの日)', () => {
    expect(isMarketClosed(new Date(2026, 4, 4))).toBe(true)
  })

  it('returns true for May 5 (こどもの日)', () => {
    expect(isMarketClosed(new Date(2026, 4, 5))).toBe(true)
  })

  it('returns true for Dec 31 (年末休場)', () => {
    expect(isMarketClosed(new Date(2026, 11, 31))).toBe(true)
  })

  it('returns true for Jan 2 (年始休場)', () => {
    expect(isMarketClosed(new Date(2026, 0, 2))).toBe(true)
  })

  it('returns true for Jan 3 (年始休場)', () => {
    expect(isMarketClosed(new Date(2026, 0, 3))).toBe(true)
  })

  it('returns true for Nov 3 (文化の日)', () => {
    expect(isMarketClosed(new Date(2026, 10, 3))).toBe(true)
  })
})

describe('isNationalHoliday', () => {
  it('returns true for fixed holidays', () => {
    expect(isNationalHoliday(new Date(2026, 0, 1))).toBe(true)   // 元日
    expect(isNationalHoliday(new Date(2026, 1, 11))).toBe(true)  // 建国記念日
    expect(isNationalHoliday(new Date(2026, 1, 23))).toBe(true)  // 天皇誕生日
    expect(isNationalHoliday(new Date(2026, 3, 29))).toBe(true)  // 昭和の日
  })

  it('returns false for regular weekday', () => {
    expect(isNationalHoliday(new Date(2026, 0, 5))).toBe(false)
    expect(isNationalHoliday(new Date(2026, 5, 1))).toBe(false)
  })

  it('returns false for Saturday (isMarketClosed handles weekends separately)', () => {
    expect(isNationalHoliday(new Date(2026, 0, 3))).toBe(false)
  })

  it('handles 成人の日 (2nd Monday of January)', () => {
    // 2026年1月12日（月）= 第2月曜
    expect(isNationalHoliday(new Date(2026, 0, 12))).toBe(true)
  })
})

describe('getClosedReason', () => {
  it('returns null for weekday non-holiday', () => {
    expect(getClosedReason(new Date(2026, 0, 5))).toBeNull()
  })

  it('returns null for Saturday/Sunday', () => {
    expect(getClosedReason(new Date(2026, 0, 3))).toBeNull() // 土曜
    expect(getClosedReason(new Date(2026, 0, 4))).toBeNull() // 日曜
  })

  it('returns "年末休場" for Dec 31', () => {
    expect(getClosedReason(new Date(2026, 11, 31))).toBe('年末休場')
  })

  it('returns "年始休場" for Jan 2 and Jan 3 when they fall on weekdays', () => {
    // 2025: Jan 2=木, Jan 3=金 → 平日なので理由ラベルが返る
    expect(getClosedReason(new Date(2025, 0, 2))).toBe('年始休場')
    expect(getClosedReason(new Date(2025, 0, 3))).toBe('年始休場')
  })

  it('returns "祝日" for national holidays that fall on weekdays', () => {
    // 2024: 5月3日=金（憲法記念日）、2026: 2月11日=水（建国記念日）
    expect(getClosedReason(new Date(2024, 4, 3))).toBe('祝日') // 憲法記念日
    expect(getClosedReason(new Date(2026, 1, 11))).toBe('祝日') // 建国記念日
  })
})
