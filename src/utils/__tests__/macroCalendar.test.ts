import { describe, it, expect } from 'vitest'
import { getMacroEventsForDate, getInterventionDates, type MacroFilter } from '../macroCalendar'

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

/**
 * 為替介入・日銀の結果は「予定」ではなく**起きたことの記録**。
 * ここが壊れると、後から「介入だけの時／金利差が動いた時」を分けて測れなくなる。
 */
describe('実績（介入・日銀の結果）', () => {
  it('介入した日にだけ intervention が出る', () => {
    const hit = getMacroEventsForDate(new Date(2026, 6, 31), ALL)
    expect(hit.map(e => e.type)).toContain('intervention')

    // 介入していない日には出ない（予定日リストを持たないので当然だが、取り違え防止に固定する）
    const miss = getMacroEventsForDate(new Date(2026, 6, 29), ALL)
    expect(miss.map(e => e.type)).not.toContain('intervention')
  })

  it('介入は日本側のイベント＝jp=false では出ない', () => {
    const events = getMacroEventsForDate(new Date(2026, 6, 31), US_ONLY)
    expect(events.map(e => e.type)).not.toContain('intervention')
  })

  it('単独と協調を区別して持つ', () => {
    const solo = getMacroEventsForDate(new Date(2026, 6, 30), ALL).find(e => e.type === 'intervention')
    const joint = getMacroEventsForDate(new Date(2026, 6, 31), ALL).find(e => e.type === 'intervention')

    expect(solo?.detail?.headline).toBe('単独')
    expect(joint?.detail?.headline).toContain('日米協調')
  })

  it('2022年・2024年の実績も引ける（標本を貯める目的）', () => {
    expect(getMacroEventsForDate(new Date(2022, 8, 22), ALL).map(e => e.type)).toContain('intervention')
    expect(getMacroEventsForDate(new Date(2024, 6, 11), ALL).map(e => e.type)).toContain('intervention')
  })

  it('日銀は結果が分かっている回だけ detail が付く', () => {
    const known = getMacroEventsForDate(new Date(2026, 6, 31), ALL).find(e => e.type === 'boj')
    expect(known?.detail?.headline).toBe('据え置き')

    // 🔴 未記録の回に detail は付けない（空欄＝未記録であって「据え置き」ではない）
    const unknown = getMacroEventsForDate(new Date(2026, 0, 23), ALL).find(e => e.type === 'boj')
    expect(unknown).toBeDefined()
    expect(unknown?.detail).toBeUndefined()
  })

  it('介入日は古い順で取り出せる（R&Dスクリプト用）', () => {
    const dates = getInterventionDates()
    expect(dates[0]).toBe('2022-09-22')
    expect(dates).toContain('2026-07-31')
    expect([...dates].sort()).toEqual(dates)
  })

  // ── ジャクソンホール会議（2026-08-22 追加・ユーザー要望「大事なやつはカレンダーに入れたい」）──
  //
  // 🔴 日程は規則から計算できない（連銀の発表待ち）。2025年は8/21〜23、2026年は1週後ろの8/27〜29。
  //    「毎年同じ週」だと思って計算式にすると年をまたいだ瞬間に外れるので、日付を直に持つ。
  describe('ジャクソンホール会議', () => {
    it('3日間とも印が出る（2026年＝8/27〜29）', () => {
      for (const d of [27, 28, 29]) {
        expect(getMacroEventsForDate(new Date(2026, 7, d), ALL).map(e => e.type)).toContain('jacksonhole')
      }
    })

    it('前後の日には出ない', () => {
      expect(getMacroEventsForDate(new Date(2026, 7, 26), ALL).map(e => e.type)).not.toContain('jacksonhole')
      expect(getMacroEventsForDate(new Date(2026, 7, 30), ALL).map(e => e.type)).not.toContain('jacksonhole')
    })

    it('過去の回も引ける（2025＝8/21〜23／2024＝8/22〜24）', () => {
      expect(getMacroEventsForDate(new Date(2025, 7, 22), ALL).map(e => e.type)).toContain('jacksonhole')
      expect(getMacroEventsForDate(new Date(2024, 7, 23), ALL).map(e => e.type)).toContain('jacksonhole')
    })

    it('米国のイベントなので、日本だけの表示では出ない', () => {
      const jpOnly = getMacroEventsForDate(new Date(2026, 7, 28), { us: false, jp: true })
      expect(jpOnly.map(e => e.type)).not.toContain('jacksonhole')
    })
  })
})
