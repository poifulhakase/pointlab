import { describe, it, expect } from 'vitest'
import { getAnomalyRanges, type AnomalyType } from '../anomalyCalendar'

const ALL_TYPES: AnomalyType[] = [
  'january_effect', 'setsubun_top', 'nisa_day', 'higan_bottom',
  'new_fiscal_year', 'sell_in_may', 'investment_day', 'xmas_rally', 'tax_loss_selling',
]

describe('getAnomalyRanges', () => {
  it('returns 9 ranges (one per anomaly type)', () => {
    expect(getAnomalyRanges(2026)).toHaveLength(9)
  })

  it('contains all anomaly types', () => {
    const types = getAnomalyRanges(2026).map(r => r.type)
    for (const t of ALL_TYPES) {
      expect(types).toContain(t)
    }
  })

  it('all start dates are <= end dates', () => {
    for (const range of getAnomalyRanges(2026)) {
      expect(range.start <= range.end, `${range.type}: start(${range.start}) > end(${range.end})`).toBe(true)
    }
  })

  it('january_effect is in January', () => {
    const r = getAnomalyRanges(2026).find(r => r.type === 'january_effect')!
    expect(r.start.startsWith('2026-01')).toBe(true)
    expect(r.end.startsWith('2026-01')).toBe(true)
  })

  it('setsubun_top spans around Feb 3', () => {
    const r = getAnomalyRanges(2026).find(r => r.type === 'setsubun_top')!
    // ± 2営業日なので 1月末〜2月上旬の範囲に収まる
    expect(r.start >= '2026-01-28').toBe(true)
    expect(r.end <= '2026-02-10').toBe(true)
  })

  it('nisa_day spans around Feb 13', () => {
    const r = getAnomalyRanges(2026).find(r => r.type === 'nisa_day')!
    expect(r.start >= '2026-02-10').toBe(true)
    expect(r.end <= '2026-02-17').toBe(true)
  })

  it('higan_bottom ends on or before spring equinox (around Mar 20)', () => {
    const r = getAnomalyRanges(2026).find(r => r.type === 'higan_bottom')!
    expect(r.end <= '2026-03-21').toBe(true)
    expect(r.start >= '2026-03-10').toBe(true)
  })

  it('new_fiscal_year is in April', () => {
    const r = getAnomalyRanges(2026).find(r => r.type === 'new_fiscal_year')!
    expect(r.start.startsWith('2026-04')).toBe(true)
    expect(r.end.startsWith('2026-04')).toBe(true)
  })

  it('sell_in_may is in May', () => {
    const r = getAnomalyRanges(2026).find(r => r.type === 'sell_in_may')!
    expect(r.start.startsWith('2026-05')).toBe(true)
    expect(r.end.startsWith('2026-05')).toBe(true)
  })

  it('investment_day spans around Oct 4', () => {
    const r = getAnomalyRanges(2026).find(r => r.type === 'investment_day')!
    expect(r.start >= '2026-09-30').toBe(true)
    expect(r.end <= '2026-10-10').toBe(true)
  })

  it('xmas_rally and tax_loss_selling share the same range', () => {
    const xmas = getAnomalyRanges(2026).find(r => r.type === 'xmas_rally')!
    const taxLoss = getAnomalyRanges(2026).find(r => r.type === 'tax_loss_selling')!
    expect(xmas.start).toBe(taxLoss.start)
    expect(xmas.end).toBe(taxLoss.end)
  })

  it('xmas_rally starts on Dec 25', () => {
    const r = getAnomalyRanges(2026).find(r => r.type === 'xmas_rally')!
    expect(r.start).toBe('2026-12-25')
  })

  it('ranges are consistent across multiple years', () => {
    for (const year of [2024, 2025, 2026]) {
      const ranges = getAnomalyRanges(year)
      expect(ranges).toHaveLength(9)
      for (const r of ranges) {
        expect(r.start.startsWith(String(year))).toBe(true)
        expect(r.end.startsWith(String(year))).toBe(true)
      }
    }
  })
})
