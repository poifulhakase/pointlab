import { describe, it, expect } from 'vitest'
import { getSqDates, getSqMarkersForDate, type SqDate } from '../sqCalendar'

describe('getSqDates', () => {
  it('returns 12 entries per year', () => {
    expect(getSqDates(2024)).toHaveLength(12)
  })

  it('major SQ months are Mar/Jun/Sep/Dec', () => {
    const dates = getSqDates(2024)
    const majorMonths = dates.filter(d => d.type === 'major').map(d => d.month)
    expect(majorMonths).toEqual([3, 6, 9, 12])
  })

  it('non-major months are mini SQ', () => {
    const dates = getSqDates(2024)
    const miniMonths = dates.filter(d => d.type === 'mini').map(d => d.month)
    expect(miniMonths).toEqual([1, 2, 4, 5, 7, 8, 10, 11])
  })

  it('all SQ dates fall on Friday (getDay === 5)', () => {
    const dates = getSqDates(2024)
    for (const sq of dates) {
      expect(sq.date.getDay(), `month ${sq.month} should be Friday`).toBe(5)
    }
  })

  it('Jan 2024 2nd Friday is Jan 12', () => {
    const jan = getSqDates(2024).find(d => d.month === 1)!
    expect(jan.date.getDate()).toBe(12)
  })

  it('Mar 2024 major SQ is Mar 8', () => {
    const mar = getSqDates(2024).find(d => d.month === 3)!
    expect(mar.date.getDate()).toBe(8)
    expect(mar.type).toBe('major')
  })

  it('Jun 2024 major SQ is Jun 14', () => {
    const jun = getSqDates(2024).find(d => d.month === 6)!
    expect(jun.date.getDate()).toBe(14)
  })
})

describe('getSqMarkersForDate', () => {
  const sqDates2024: SqDate[] = getSqDates(2024)

  it('returns sq-major for Mar 8 2024', () => {
    const markers = getSqMarkersForDate(new Date(2024, 2, 8), sqDates2024)
    expect(markers).toContain('sq-major')
  })

  it('returns sq-mini for Jan 12 2024', () => {
    const markers = getSqMarkersForDate(new Date(2024, 0, 12), sqDates2024)
    expect(markers).toContain('sq-mini')
  })

  it('returns empty array for non-SQ day', () => {
    const markers = getSqMarkersForDate(new Date(2024, 0, 15), sqDates2024)
    expect(markers).toHaveLength(0)
  })

  it('does not mix years', () => {
    const markers = getSqMarkersForDate(new Date(2025, 2, 8), sqDates2024)
    expect(markers).toHaveLength(0)
  })
})
