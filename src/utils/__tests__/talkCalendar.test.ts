import { describe, expect, it } from 'vitest'
import { dateLabel, groupByDate, monthCells, normalizeDraft, type TalkEvent } from '../talkCalendar'
// @ts-expect-error api/ は素の JS（型定義を持たない）
import { parseEventJson } from '../../../api/_talkNotify.js'

const ev = (p: Partial<TalkEvent>): TalkEvent => ({
  id: 'x', date: '2026-10-31', time: '', title: 't', place: '', url: '', memo: '', by: 'ひろ', at: 0, ...p,
})

describe('カレンダー', () => {
  it('月のマス目は日曜はじまり・42マス・前後の月は inMonth=false', () => {
    const c = monthCells(2026, 9) // 2026年10月（1日は木曜）
    expect(c).toHaveLength(42)
    expect(c[0]).toEqual({ key: '2026-09-27', day: 27, inMonth: false })
    expect(c[4]).toEqual({ key: '2026-10-01', day: 1, inMonth: true })
    expect(c.filter(x => x.inMonth)).toHaveLength(31)
  })

  it('日付ごとにまとめ、時刻順（時刻なしが先頭）', () => {
    const m = groupByDate([ev({ id: 'a', time: '19:30' }), ev({ id: 'b', time: '' }), ev({ id: 'c', time: '12:00' })])
    expect(m.get('2026-10-31')!.map(e => e.id)).toEqual(['b', 'c', 'a'])
  })

  it('日付の表示', () => {
    expect(dateLabel('2026-10-31')).toBe('10月31日(土)')
  })

  it('保存できる形に整える（日付と用件が無ければ null・URLは http(s) だけ）', () => {
    const base = { date: '2026-10-31', time: '9:05', title: ' ディナー ', place: '', url: 'javascript:x', memo: '' }
    expect(normalizeDraft(base)).toEqual({ ...base, time: '09:05', title: 'ディナー', url: '' })
    expect(normalizeDraft({ ...base, title: ' ' })).toBeNull()
    expect(normalizeDraft({ ...base, date: '10/31' })).toBeNull()
    expect(normalizeDraft({ ...base, time: '25:00' })!.time).toBe('')
  })
})

describe('予定の読み取り（a=event）', () => {
  it('前後に文章があってもJSONを拾う', () => {
    const r = parseEventJson('はい\n{"date":"2026-10-31","time":"19:30","title":"ディナー","place":"〇〇","url":"https://a.jp","memo":"2名"}')
    expect(r).toEqual({ date: '2026-10-31', time: '19:30', title: 'ディナー', place: '〇〇', url: 'https://a.jp', memo: '2名' })
  })

  it('形の悪い値は空にする', () => {
    const r = parseEventJson('{"date":"10月31日","time":"夜","title":"映画","url":"a.jp"}')
    expect(r).toEqual({ date: '', time: '', title: '映画', place: '', url: '', memo: '' })
    expect(parseEventJson('読めません').title).toBe('')
    expect(parseEventJson('{壊れ}').title).toBe('')
  })
})
