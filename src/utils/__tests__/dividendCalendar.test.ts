import { describe, it, expect } from 'vitest'
import { getDividendDates, getMarkersForDate } from '../dividendCalendar'

describe('getDividendDates', () => {
  it('returns 4 sets (3・6・9・12月)', () => {
    expect(getDividendDates(2026)).toHaveLength(4)
  })

  it('covers months 3, 6, 9, 12', () => {
    const months = getDividendDates(2026).map(d => d.month)
    expect(months).toEqual([3, 6, 9, 12])
  })

  it('kakutei is on a business day (not weekend)', () => {
    for (const set of getDividendDates(2026)) {
      const wd = set.kakutei.getDay()
      expect(wd, `month ${set.month} kakutei should not be weekend`).not.toBe(0)
      expect(wd, `month ${set.month} kakutei should not be weekend`).not.toBe(6)
    }
  })

  it('saishu is before kakutei', () => {
    for (const set of getDividendDates(2026)) {
      expect(set.saishu < set.kakutei, `month ${set.month}: saishu should be before kakutei`).toBe(true)
    }
  })

  it('ochi is before kakutei', () => {
    for (const set of getDividendDates(2026)) {
      expect(set.ochi < set.kakutei, `month ${set.month}: ochi should be before kakutei`).toBe(true)
    }
  })

  it('saishu is before ochi', () => {
    for (const set of getDividendDates(2026)) {
      expect(set.saishu < set.ochi, `month ${set.month}: saishu should be before ochi`).toBe(true)
    }
  })

  it('kakutei is in the correct month', () => {
    const sets = getDividendDates(2026)
    const expectedMonths = [2, 5, 8, 11] // 0始まり
    sets.forEach((set, i) => {
      expect(set.kakutei.getMonth()).toBe(expectedMonths[i])
    })
  })

  it('saishu and ochi are each on a business day', () => {
    for (const set of getDividendDates(2026)) {
      const saWd = set.saishu.getDay()
      const ocWd = set.ochi.getDay()
      expect(saWd).not.toBe(0)
      expect(saWd).not.toBe(6)
      expect(ocWd).not.toBe(0)
      expect(ocWd).not.toBe(6)
    }
  })
})

describe('getMarkersForDate', () => {
  const sets2026 = getDividendDates(2026)

  it('returns saishu marker for saishu date', () => {
    const markers = getMarkersForDate(sets2026[0].saishu, sets2026)
    expect(markers).toContain('saishu')
  })

  it('returns ochi marker for ochi date', () => {
    const markers = getMarkersForDate(sets2026[0].ochi, sets2026)
    expect(markers).toContain('ochi')
  })

  it('returns kakutei marker for kakutei date', () => {
    const markers = getMarkersForDate(sets2026[0].kakutei, sets2026)
    expect(markers).toContain('kakutei')
  })

  it('returns empty array for non-event date', () => {
    const markers = getMarkersForDate(new Date(2026, 0, 5), sets2026)
    expect(markers).toHaveLength(0)
  })

  it('does not mix years', () => {
    const sets2025 = getDividendDates(2025)
    // 2026年のイベント日を2025年データで検索 → ヒットしない
    const markers = getMarkersForDate(sets2026[0].saishu, sets2025)
    // 日付が一致しなければ空
    const saishuDate2026 = sets2026[0].saishu
    const saishuDate2025 = sets2025[0].saishu
    if (saishuDate2026.toDateString() !== saishuDate2025.toDateString()) {
      expect(markers).toHaveLength(0)
    }
  })
})
