/**
 * 東証（東京証券取引所）の休場日判定
 *
 * 休場条件:
 *   - 土日
 *   - 国民の祝日・振替休日・国民の休日
 *   - 年末年始（12/31・1/2・1/3）
 */

function nthMonday(year: number, month: number, n: number): Date {
  const d = new Date(year, month, 1)
  const first = d.getDay()
  const offset = (1 - first + 7) % 7
  d.setDate(1 + offset + (n - 1) * 7)
  return d
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

/** 固定祝日・ハッピーマンデー・春分秋分のみ（振替・国民の休日は含まない） */
function isBaseHoliday(date: Date): boolean {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()

  // 固定祝日
  const fixed: [number, number][] = [
    [1, 1],   // 元日
    [2, 11],  // 建国記念の日
    [2, 23],  // 天皇誕生日
    [4, 29],  // 昭和の日
    [5, 3],   // 憲法記念日
    [5, 4],   // みどりの日
    [5, 5],   // こどもの日
    [8, 11],  // 山の日
    [11, 3],  // 文化の日
    [11, 23], // 勤労感謝の日
  ]
  if (fixed.some(([fm, fd]) => m === fm && d === fd)) return true

  // ハッピーマンデー
  if (m === 1  && sameDay(date, nthMonday(y, 0, 2))) return true  // 成人の日
  if (m === 7  && sameDay(date, nthMonday(y, 6, 3))) return true  // 海の日
  if (m === 9  && sameDay(date, nthMonday(y, 8, 3))) return true  // 敬老の日
  if (m === 10 && sameDay(date, nthMonday(y, 9, 2))) return true  // スポーツの日

  // 春分の日・秋分の日（近似計算）
  const shunbun = Math.floor(20.8431 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4))
  const shubun  = Math.floor(23.2488 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4))
  if (m === 3 && d === shunbun) return true
  if (m === 9 && d === shubun)  return true

  return false
}

/** 国民の祝日かどうか（振替休日・国民の休日を含む） */
export function isNationalHoliday(date: Date): boolean {
  if (isBaseHoliday(date)) return true

  // 振替休日：日曜が祝日なら翌月曜
  if (date.getDay() === 1) {
    const prev = new Date(date)
    prev.setDate(date.getDate() - 1)
    if (isBaseHoliday(prev)) return true
  }

  // 国民の休日：前後が祝日に挟まれた平日（再帰しないよう isBaseHoliday を使う）
  const day = date.getDay()
  if (day !== 0 && day !== 6) {
    const prev = new Date(date); prev.setDate(date.getDate() - 1)
    const next = new Date(date); next.setDate(date.getDate() + 1)
    if (isBaseHoliday(prev) && isBaseHoliday(next)) return true
  }

  return false
}

/** 東証の年末年始休場日（12/31・1/2・1/3） */
function isYearEndNew(date: Date): boolean {
  const m = date.getMonth() + 1
  const d = date.getDate()
  return (m === 12 && d === 31) || (m === 1 && (d === 2 || d === 3))
}

/** 東証が休場かどうか */
export function isMarketClosed(date: Date): boolean {
  const day = date.getDay()
  if (day === 0 || day === 6) return true
  if (isNationalHoliday(date)) return true
  if (isYearEndNew(date)) return true
  return false
}

/** 休場の理由ラベルを返す（土日は null） */
export function getClosedReason(date: Date): string | null {
  const day = date.getDay()
  if (day === 0 || day === 6) return null
  const m = date.getMonth() + 1
  const d = date.getDate()
  if (m === 12 && d === 31) return '年末休場'
  if (m === 1 && d === 2)   return '年始休場'
  if (m === 1 && d === 3)   return '年始休場'
  if (isNationalHoliday(date)) return '祝日'
  return null
}
