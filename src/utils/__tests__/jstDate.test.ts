import { describe, it, expect } from 'vitest'
import { jstTodayKey, jstTimestamp } from '../jstDate'

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
})
