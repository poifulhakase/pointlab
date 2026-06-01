import { describe, it, expect } from 'vitest'
import { getMacroEventsForDate, type MacroFilter } from '../macroCalendar'

const ALL: MacroFilter = { us: true, jp: true }
const US_ONLY: MacroFilter = { us: true, jp: false }
const JP_ONLY: MacroFilter = { us: false, jp: true }
const NONE: MacroFilter = { us: false, jp: false }

describe('getMacroEventsForDate', () => {
  it('returns FOMC for 2026-01-28', () => {
    const events = getMacroEventsForDate(new Date(2026, 0, 28), ALL)
    expect(events.map(e => e.type)).toContain('fomc')
  })

  it('returns BOJ for 2026-01-23', () => {
    const events = getMacroEventsForDate(new Date(2026, 0, 23), ALL)
    expect(events.map(e => e.type)).toContain('boj')
  })

  it('returns NFP for 2026-02-06', () => {
    const events = getMacroEventsForDate(new Date(2026, 1, 6), ALL)
    expect(events.map(e => e.type)).toContain('nfp')
  })

  it('returns CPI for 2026-01-14', () => {
    const events = getMacroEventsForDate(new Date(2026, 0, 14), ALL)
    expect(events.map(e => e.type)).toContain('cpi')
  })

  it('returns ADP for 2026-02-04 (NFPの2営業日前・水曜)', () => {
    const events = getMacroEventsForDate(new Date(2026, 1, 4), ALL)
    expect(events.map(e => e.type)).toContain('adp')
  })

  it('returns ISM for 2026-02-02 (2月第1営業日)', () => {
    const events = getMacroEventsForDate(new Date(2026, 1, 2), ALL)
    expect(events.map(e => e.type)).toContain('ism')
  })

  it('no longer returns GDP (旧2026-01-29 は無イベント化)', () => {
    const events = getMacroEventsForDate(new Date(2026, 0, 29), ALL)
    expect(events.map(e => e.type)).not.toContain('gdp')
    expect(events).toHaveLength(0)
  })

  it('returns empty array for non-event day', () => {
    const events = getMacroEventsForDate(new Date(2026, 0, 20), ALL)
    expect(events).toHaveLength(0)
  })

  it('filters out US events when us=false', () => {
    const events = getMacroEventsForDate(new Date(2026, 0, 28), JP_ONLY)
    const types = events.map(e => e.type)
    expect(types).not.toContain('fomc')
    expect(types).not.toContain('nfp')
  })

  it('filters out JP events when jp=false', () => {
    const events = getMacroEventsForDate(new Date(2026, 0, 23), US_ONLY)
    const types = events.map(e => e.type)
    expect(types).not.toContain('boj')
    expect(types).not.toContain('tankan')
  })

  it('returns empty array when both filters off', () => {
    const events = getMacroEventsForDate(new Date(2026, 0, 28), NONE)
    expect(events).toHaveLength(0)
  })

  it('returns tankan for 2026-04-01', () => {
    const events = getMacroEventsForDate(new Date(2026, 3, 1), ALL)
    expect(events.map(e => e.type)).toContain('tankan')
  })
})
