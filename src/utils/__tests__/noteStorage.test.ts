import { describe, it, expect, beforeEach } from 'vitest'
import { dateKey, getNote, saveNote, isPendingDelete } from '../noteStorage'

// noteStorage.ts はデフォルトエクスポートがないため named import のみ
// addPendingDelete は非公開なので isPendingDelete のみテスト可能
// (エクスポートされていない内部関数は直接テストしない)

beforeEach(() => {
  localStorage.clear()
})

describe('dateKey', () => {
  it('formats date as YYYY-MM-DD', () => {
    expect(dateKey(new Date(2026, 0, 1))).toBe('2026-01-01')
    expect(dateKey(new Date(2026, 11, 31))).toBe('2026-12-31')
  })

  it('zero-pads month and day', () => {
    expect(dateKey(new Date(2026, 4, 9))).toBe('2026-05-09')
  })
})

describe('getNote', () => {
  it('returns empty note when no data saved', () => {
    const note = getNote(new Date(2026, 0, 1))
    expect(note.title).toBe('')
    expect(note.memo).toBe('')
    expect(note.schedules).toEqual([])
  })
})

describe('saveNote / getNote round-trip', () => {
  it('saves and retrieves note', () => {
    const date = new Date(2026, 4, 29)
    saveNote(date, { title: 'テストノート', memo: 'メモ内容', schedules: [] })
    const note = getNote(date)
    expect(note.title).toBe('テストノート')
    expect(note.memo).toBe('メモ内容')
  })

  it('saves schedule entries', () => {
    const date = new Date(2026, 4, 29)
    const schedule = { id: 'abc', title: 'MTG', startTime: '10:00', endTime: '11:00', alertMinutes: 0 }
    saveNote(date, { title: '', memo: '', schedules: [schedule] })
    const note = getNote(date)
    expect(note.schedules).toHaveLength(1)
    expect(note.schedules![0].title).toBe('MTG')
  })

  it('different dates store independently', () => {
    const d1 = new Date(2026, 4, 29)
    const d2 = new Date(2026, 4, 30)
    saveNote(d1, { title: 'Day1', memo: '', schedules: [] })
    saveNote(d2, { title: 'Day2', memo: '', schedules: [] })
    expect(getNote(d1).title).toBe('Day1')
    expect(getNote(d2).title).toBe('Day2')
  })
})

describe('isPendingDelete', () => {
  it('returns false for unknown key', () => {
    expect(isPendingDelete('2026-01-01')).toBe(false)
  })
})
