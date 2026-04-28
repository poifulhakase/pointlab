/**
 * 配当権利関連日の自動計算
 *
 * 権利確定日  : 各月の最終営業日（主要月: 3・6・9・12月）
 * 権利付最終日: 権利確定日の 2営業日前（この日までに買えば配当取得可能）
 * 権利落ち日  : 権利確定日の 1営業日前（権利付最終日の翌営業日）
 */

// 主要権利確定月（0始まり）
const MAJOR_MONTHS = [2, 5, 8, 11] // 3月・6月・9月・12月

// ---- 祝日判定（固定祝日 + ハッピーマンデー） ----
function nthMonday(year: number, month: number, n: number): Date {
  const d = new Date(year, month, 1)
  const first = d.getDay() // 1日の曜日
  const offset = (1 - first + 7) % 7 // 最初の月曜まで
  d.setDate(1 + offset + (n - 1) * 7)
  return d
}

function isJapaneseHoliday(date: Date): boolean {
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

  // 振替休日（日曜が祝日なら翌月曜）
  const prev = new Date(date)
  prev.setDate(d - 1)
  if (date.getDay() === 1 && isJapaneseHoliday(prev)) return true

  // ハッピーマンデー
  if (m === 1  && date.getTime() === nthMonday(y, 0, 2).getTime()) return true  // 成人の日
  if (m === 7  && date.getTime() === nthMonday(y, 6, 3).getTime()) return true  // 海の日
  if (m === 9  && date.getTime() === nthMonday(y, 8, 3).getTime()) return true  // 敬老の日
  if (m === 10 && date.getTime() === nthMonday(y, 9, 2).getTime()) return true  // スポーツの日

  // 春分・秋分（近似）
  const shunbun = Math.floor(20.8431 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4))
  const shubun  = Math.floor(23.2488 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4))
  if (m === 3 && d === shunbun) return true
  if (m === 9 && d === shubun)  return true

  return false
}

function isNonTrading(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6 || isJapaneseHoliday(date)
}

function addBusinessDays(date: Date, delta: number): Date {
  const d = new Date(date)
  const sign = delta > 0 ? 1 : -1
  let rem = Math.abs(delta)
  while (rem > 0) {
    d.setDate(d.getDate() + sign)
    if (!isNonTrading(d)) rem--
  }
  return d
}

function lastBusinessDay(year: number, month: number): Date {
  const d = new Date(year, month + 1, 0) // 月末
  while (isNonTrading(d)) d.setDate(d.getDate() - 1)
  return d
}

// ---- 公開型 ----

export type MarkerType = 'saishu' | 'ochi' | 'kakutei'

export type DividendDateSet = {
  kakutei:  Date   // 権利確定日
  saishu:   Date   // 権利付最終日
  ochi:     Date   // 権利落ち日
  month:    number // 確定月 (1始まり)
}

/** 指定年の主要権利関連日を返す */
export function getDividendDates(year: number): DividendDateSet[] {
  return MAJOR_MONTHS.map(mi => {
    const kakutei = lastBusinessDay(year, mi)
    const saishu  = addBusinessDays(kakutei, -2)
    const ochi    = addBusinessDays(kakutei, -1)
    return { kakutei, saishu, ochi, month: mi + 1 }
  })
}

/** ある日付に付くマーカー種別の配列を返す（複数月が重なる場合も考慮） */
export function getMarkersForDate(date: Date, sets: DividendDateSet[]): MarkerType[] {
  const key = (d: Date) => d.toDateString()
  const dk = key(date)
  const result: MarkerType[] = []
  for (const s of sets) {
    if (key(s.saishu)  === dk) result.push('saishu')
    if (key(s.ochi)    === dk) result.push('ochi')
    if (key(s.kakutei) === dk) result.push('kakutei')
  }
  return result
}

// ---- 表示設定 ----

export const MARKER_META: Record<MarkerType, { label: string; desc: string; short: string; color: string; bg: string }> = {
  saishu:  { label: '権利付最終日', desc: 'この日までに買えば配当取得', short: '権付', color: '#67e8f9', bg: 'rgba(103,232,249,0.15)' },
  ochi:    { label: '権利落ち日',   desc: 'この日から権利なしで取引',   short: '権落', color: '#67e8f9', bg: 'rgba(103,232,249,0.15)' },
  kakutei: { label: '権利確定日',   desc: '株主として名簿に確定',       short: '権確', color: '#67e8f9', bg: 'rgba(103,232,249,0.15)' },
}
