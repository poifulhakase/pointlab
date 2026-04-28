/**
 * SQ（特別清算指数）算出日の計算
 *
 * メジャーSQ: 3・6・9・12月の第2金曜日（日経225先物・オプション）
 * ミニSQ    : 毎月第2金曜日（日経225ミニ先物）
 */

/** 指定年月の第2金曜日を返す（month: 0始まり） */
function secondFriday(year: number, month: number): Date {
  const d = new Date(year, month, 1)
  const first = d.getDay() // 1日の曜日
  // 最初の金曜日までのオフセット
  const offset = (5 - first + 7) % 7
  d.setDate(1 + offset + 7) // +7 で第2金曜
  return d
}

export type SqType = 'major' | 'mini'

export type SqDate = {
  date: Date
  type: SqType
  month: number // 1始まり
}

const MAJOR_MONTHS = [2, 5, 8, 11] // 3・6・9・12月（0始まり）

/** 指定年のSQ算出日を全て返す */
export function getSqDates(year: number): SqDate[] {
  const result: SqDate[] = []
  for (let m = 0; m < 12; m++) {
    const date = secondFriday(year, m)
    const isMajor = MAJOR_MONTHS.includes(m)
    result.push({ date, type: isMajor ? 'major' : 'mini', month: m + 1 })
  }
  return result
}

export type SqMarker = 'sq-major' | 'sq-mini'

/** ある日付のSQマーカーを返す */
export function getSqMarkersForDate(date: Date, sqDates: SqDate[]): SqMarker[] {
  const dk = date.toDateString()
  const result: SqMarker[] = []
  for (const sq of sqDates) {
    if (sq.date.toDateString() === dk) {
      result.push(sq.type === 'major' ? 'sq-major' : 'sq-mini')
    }
  }
  return result
}

export const SQ_META: Record<SqMarker, { label: string; short: string; desc: string; color: string; bg: string }> = {
  'sq-major': {
    label: 'メジャーSQ',
    short: 'SQ',
    desc: '日経225先物・オプション特別清算指数算出日',
    color: '#67e8f9',
    bg: 'rgba(103,232,249,0.15)',
  },
  'sq-mini': {
    label: 'ミニSQ',
    short: 'ミニSQ',
    desc: '日経225ミニ先物特別清算指数算出日',
    color: '#67e8f9',
    bg: 'rgba(103,232,249,0.15)',
  },
}
