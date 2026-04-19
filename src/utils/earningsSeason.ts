export type BandItem = {
  label: string
  url?: string
}

export type MonthBand = {
  month: number
  items: BandItem[]
  color: string
  bg: string
}

export const MONTH_BANDS: MonthBand[] = [
  {
    month: 1,
    items: [
      { label: 'TOPIX 浮動株比率見直し（末日）', url: 'https://www.jpx.co.jp/markets/indices/line-up/01.html' },
      { label: '3Q決算ピーク' },
    ],
    color: '#38bdf8', bg: 'rgba(56,189,248,0.07)',
  },
  {
    month: 3,
    items: [
      { label: '日経平均 春の定期入替発表（上旬）', url: 'https://indexes.nikkei.co.jp/nkave/archives/news' },
    ],
    color: '#fbbf24', bg: 'rgba(251,191,36,0.07)',
  },
  {
    month: 4,
    items: [
      { label: '日経平均 入替実施（第1営業日）', url: 'https://indexes.nikkei.co.jp/nkave/archives/news' },
    ],
    color: '#fbbf24', bg: 'rgba(251,191,36,0.07)',
  },
  {
    month: 5,
    items: [
      { label: 'MSCI 定期レビュー発表（中旬）', url: 'https://www.msci.com/index-review' },
      { label: '本決算ピーク' },
    ],
    color: '#fb7185', bg: 'rgba(251,113,133,0.07)',
  },
  {
    month: 7,
    items: [
      { label: 'TOPIX 浮動株比率見直し（末日）', url: 'https://www.jpx.co.jp/markets/indices/line-up/01.html' },
      { label: '1Q決算ピーク' },
    ],
    color: '#4ade80', bg: 'rgba(74,222,128,0.07)',
  },
  {
    month: 8,
    items: [
      { label: '1Q決算発表（中旬まで）', url: 'https://www.jpx.co.jp/listing/event-schedules/financial-announcements/index.html' },
    ],
    color: '#4ade80', bg: 'rgba(74,222,128,0.07)',
  },
  {
    month: 9,
    items: [
      { label: '日経平均 秋の定期入替発表（上旬）', url: 'https://indexes.nikkei.co.jp/nkave/archives/news' },
    ],
    color: '#fbbf24', bg: 'rgba(251,191,36,0.07)',
  },
  {
    month: 10,
    items: [
      { label: '日経平均 入替実施（第1営業日）／ TOPIX定期入替', url: 'https://indexes.nikkei.co.jp/nkave/archives/news' },
      { label: '中間決算ピーク' },
    ],
    color: '#fb923c', bg: 'rgba(251,146,60,0.07)',
  },
  {
    month: 11,
    items: [
      { label: 'MSCI 定期レビュー発表（中旬）', url: 'https://www.msci.com/index-review' },
    ],
    color: '#a78bfa', bg: 'rgba(167,139,250,0.07)',
  },
]

export function getMonthBand(month: number): MonthBand | null {
  return MONTH_BANDS.find(b => b.month === month) ?? null
}
