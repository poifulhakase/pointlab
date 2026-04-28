import { isMarketClosed } from './marketHolidays'

export type AnomalyType =
  | 'january_effect'
  | 'setsubun_top'
  | 'nisa_day'
  | 'higan_bottom'
  | 'new_fiscal_year'
  | 'sell_in_may'
  | 'investment_day'
  | 'xmas_rally'
  | 'tax_loss_selling'

export type AnomalyEvent = {
  type: AnomalyType
  isStart: boolean
  isEnd: boolean
}

export const ANOMALY_COLOR  = '#fbbf24'
export const ANOMALY_COLOR_LIGHT = '#92400e'
export const ANOMALY_BG     = 'rgba(251,191,36,0.20)'
export const ANOMALY_BG_LIGHT = 'rgba(180,83,9,0.13)'

export const ANOMALY_META: Record<AnomalyType, { label: string; desc: string }> = {
  january_effect: {
    label: '1月効果',
    desc: '年初に株価が上昇しやすいとされる季節性アノマリー。機関投資家の新規資金流入や個人投資家のNISA枠活用が重なり、特に中小型株の上昇が顕著になる傾向がある。（1月第1〜第5営業日が目安）',
  },
  setsubun_top: {
    label: '節分天井',
    desc: '節分（2月3日）前後に株価が一時的な天井をつけやすいとされる経験則。年初の上昇相場の利益確定売りが集中しやすい時期とされる。（節分前後2営業日が目安）',
  },
  nisa_day: {
    label: 'NISAの日',
    desc: '2月13日は「ニー（2）サ（13）」と読めることから「NISAの日」と呼ばれる。前後1営業日に個人投資家のNISA関連の動向が注目されやすい。',
  },
  higan_bottom: {
    label: '彼岸底',
    desc: '3月の春分の日（彼岸）前後に株価が底をつけやすいとされる季節性アノマリー。海外勢が日本の祝日前に持ち高を整理する動きが相場を下押しする傾向があるとされる。（春分の日の前5営業日が目安）',
  },
  new_fiscal_year: {
    label: '新年度入り',
    desc: '4月第1〜3営業日は日本の新年度初め。機関投資家の新規買いや年金マネーの流入が期待される一方、前年度末の調整から一転して上昇しやすいとされる時期。',
  },
  sell_in_may: {
    label: 'セルインメイ',
    desc: '「Sell in May and go away」の格言で知られる季節性アノマリー。5月に入ると欧米機関投資家が夏休み前にポジションを軽くする傾向があるとされる。（5月第1金曜〜第2金曜が目安）',
  },
  investment_day: {
    label: '投資の日',
    desc: '10月4日は「と（10）う（four＝4）し」と読めることから「投資の日」とされる。前後1営業日に金融・投資関連の話題が注目されやすい。',
  },
  xmas_rally: {
    label: "X'masラリー",
    desc: '年末（12月25日〜年内受渡最終日）にかけて株価が上昇しやすいとされるアノマリー。年内最後のポジション調整や翌年相場への期待感から買いが入りやすいとされる。',
  },
  tax_loss_selling: {
    label: '損出し売り',
    desc: '年内に含み損を抱えた銘柄を売却して損失を確定し、税負担を軽減する「損出し」が集中する時期（12月25日〜年内受渡最終日）。売り圧力が高まりやすいが、X\'masラリーと逆方向の需給も発生する。',
  },
}

// ── ビジネス日ユーティリティ（祝日含む） ─────────────────────────────

function isTradingDay(d: Date): boolean {
  return !isMarketClosed(d)
}

function nthTradingDay(year: number, month: number, n: number): Date {
  const d = new Date(year, month, 1)
  let count = 0
  while (count < n) {
    if (isTradingDay(d)) count++
    if (count < n) d.setDate(d.getDate() + 1)
  }
  return new Date(d)
}

function addTradingDays(from: Date, n: number): Date {
  if (n === 0) return new Date(from)
  const d = new Date(from)
  const step = n > 0 ? 1 : -1
  let rem = Math.abs(n)
  while (rem > 0) {
    d.setDate(d.getDate() + step)
    if (isTradingDay(d)) rem--
  }
  return d
}

function nthWeekday(year: number, month: number, wd: number, n: number): Date {
  const d = new Date(year, month, 1)
  let count = 0
  while (true) {
    if (d.getDay() === wd) {
      count++
      if (count === n) return new Date(d)
    }
    d.setDate(d.getDate() + 1)
  }
}

// 春分の日（近年実績 + 推定）
const SPRING_EQUINOX_DAY: Record<number, number> = {
  2020: 20, 2021: 20, 2022: 21, 2023: 21, 2024: 20,
  2025: 20, 2026: 20, 2027: 21, 2028: 20, 2029: 20,
  2030: 20, 2031: 21, 2032: 20, 2033: 20, 2034: 20, 2035: 21,
}

function getSpringEquinox(year: number): Date {
  const day = SPRING_EQUINOX_DAY[year] ?? 20
  return new Date(year, 2, day) // March
}

// 年内受渡最終日: TSE最終売買日（12/30 以前の最終取引日）- 2 営業日
function getYearEndSettlement(year: number): Date {
  let last = new Date(year, 11, 30) // Dec 30 から探索
  while (!isTradingDay(last)) last.setDate(last.getDate() - 1)
  return addTradingDays(last, -2)
}

function dateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export type AnomalyRange = { type: AnomalyType; start: string; end: string }

export function getAnomalyRanges(year: number): AnomalyRange[] {
  const ranges: AnomalyRange[] = []

  // 1月効果: 1月第1〜第5営業日
  ranges.push({
    type: 'january_effect',
    start: dateStr(nthTradingDay(year, 0, 1)),
    end:   dateStr(nthTradingDay(year, 0, 5)),
  })

  // 節分天井: 2月3日 ± 2営業日
  const setsubun = new Date(year, 1, 3)
  ranges.push({
    type: 'setsubun_top',
    start: dateStr(addTradingDays(setsubun, -2)),
    end:   dateStr(addTradingDays(setsubun, 2)),
  })

  // NISAの日: 2月13日 ± 1営業日
  const nisaDay = new Date(year, 1, 13)
  ranges.push({
    type: 'nisa_day',
    start: dateStr(addTradingDays(nisaDay, -1)),
    end:   dateStr(addTradingDays(nisaDay, 1)),
  })

  // 彼岸底: 春分の日 の前5営業日（当日を含む）
  const equinox = getSpringEquinox(year)
  ranges.push({
    type: 'higan_bottom',
    start: dateStr(addTradingDays(equinox, -5)),
    end:   dateStr(equinox),
  })

  // 新年度入り: 4月第1〜第3営業日
  ranges.push({
    type: 'new_fiscal_year',
    start: dateStr(nthTradingDay(year, 3, 1)),
    end:   dateStr(nthTradingDay(year, 3, 3)),
  })

  // セルインメイ: 5月第1金曜〜第2金曜
  ranges.push({
    type: 'sell_in_may',
    start: dateStr(nthWeekday(year, 4, 5, 1)),
    end:   dateStr(nthWeekday(year, 4, 5, 2)),
  })

  // 投資の日: 10月4日 ± 1営業日
  const investDay = new Date(year, 9, 4)
  ranges.push({
    type: 'investment_day',
    start: dateStr(addTradingDays(investDay, -1)),
    end:   dateStr(addTradingDays(investDay, 1)),
  })

  // X'masラリー & 損出し: 12月25日〜年内受渡最終日
  const xmasStart = `${year}-12-25`
  const yearEnd   = dateStr(getYearEndSettlement(year))
  ranges.push({ type: 'xmas_rally',       start: xmasStart, end: yearEnd })
  ranges.push({ type: 'tax_loss_selling', start: xmasStart, end: yearEnd })

  return ranges
}
