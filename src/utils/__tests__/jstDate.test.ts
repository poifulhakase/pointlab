import { describe, it, expect } from 'vitest'
import { jstTodayKey, jstTimestamp, dateKey } from '../jstDate'

describe('jstDate', () => {
  it('jstTodayKey returns YYYY-MM-DD', () => {
    expect(jstTodayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('jstTimestamp returns "YYYY-MM-DD HH:MM:SS"', () => {
    expect(jstTimestamp()).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })

  it('jstTimestamp date part matches jstTodayKey', () => {
    expect(jstTimestamp().slice(0, 10)).toBe(jstTodayKey())
  })

  it('dateKey zero-pads month/day from a Date', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05')   // 1月5日
    expect(dateKey(new Date(2026, 11, 31))).toBe('2026-12-31') // 12月31日
  })
})
