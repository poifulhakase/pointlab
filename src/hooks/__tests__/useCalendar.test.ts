import { describe, it, expect } from 'vitest'
import { stepDate } from '../useCalendar'

describe('stepDate — 月ナビゲーション', () => {
  it('5/31 から月送りで7月を飛ばさず6月になる（回帰）', () => {
    const may31 = new Date(2026, 4, 31) // 2026-05-31
    const next  = stepDate(may31, 'month', 1)
    expect(next.getFullYear()).toBe(2026)
    expect(next.getMonth()).toBe(5) // 6月（0-indexed）
  })

  it('1/31 から月送りで2月になる（うるう年でも3月を飛ばさない）', () => {
    const jan31 = new Date(2026, 0, 31)
    const next  = stepDate(jan31, 'month', 1)
    expect(next.getMonth()).toBe(1) // 2月
  })

  it('3/31 から月戻しで2月になる', () => {
    const mar31 = new Date(2026, 2, 31)
    const prev  = stepDate(mar31, 'month', -1)
    expect(prev.getMonth()).toBe(1) // 2月
  })

  it('12月から月送りで翌年1月になる', () => {
    const dec = new Date(2026, 11, 15)
    const next = stepDate(dec, 'month', 1)
    expect(next.getFullYear()).toBe(2027)
    expect(next.getMonth()).toBe(0)
  })

  it('week は7日単位で進む', () => {
    const d = new Date(2026, 4, 10)
    const next = stepDate(d, 'week', 1)
    expect(next.getDate()).toBe(17)
  })

  it('day は1日単位で進む（月末跨ぎ正常）', () => {
    const d = new Date(2026, 4, 31)
    const next = stepDate(d, 'day', 1)
    expect(next.getMonth()).toBe(5) // 6月
    expect(next.getDate()).toBe(1)
  })
})
