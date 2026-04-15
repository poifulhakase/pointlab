/**
 * 決算シーズン帯
 *
 * 日本株（3月決算が最多）の決算発表集中月:
 *   5月  → 本決算（3月期）
 *   8月  → 第1四半期（3月期）
 *   11月 → 第2四半期（3月期）
 *   2月  → 第3四半期（3月期）
 */

export type EarningsSeason = {
  month: number   // 1始まり
  quarter: string // '本決算' | '1Q' | '2Q' | '3Q'
  color: string
  bg: string
}

export const EARNINGS_SEASONS: EarningsSeason[] = [
  { month: 2,  quarter: '3Q決算',  color: '#38bdf8', bg: 'rgba(56,189,248,0.07)'  },
  { month: 5,  quarter: '本決算',  color: '#fb7185', bg: 'rgba(251,113,133,0.07)' },
  { month: 8,  quarter: '1Q決算',  color: '#4ade80', bg: 'rgba(74,222,128,0.07)'  },
  { month: 11, quarter: '2Q決算',  color: '#fbbf24', bg: 'rgba(251,191,36,0.07)'  },
]

/** 指定月が決算シーズンかどうか */
export function getEarningsSeason(month: number): EarningsSeason | null {
  return EARNINGS_SEASONS.find(s => s.month === month) ?? null
}
