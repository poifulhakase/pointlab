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

// アンバー統一色（決算帯・アノマリー帯と同系）
const AMBER = '#fbbf24'
const AMBER_BG = 'rgba(251,191,36,0.22)'

export const MONTH_BANDS: MonthBand[] = [
  {
    month: 1,
    items: [
      { label: 'TOPIX 浮動株比率見直し（末日）', url: 'https://www.jpx.co.jp/markets/indices/revisions-indices/03.html' },
      { label: '3Q決算ピーク' },
    ],
    color: AMBER, bg: AMBER_BG,
  },
  {
    month: 3,
    items: [
      { label: '日経平均 春の定期入替発表（上旬）', url: 'https://indexes.nikkei.co.jp/nkave/newsroom' },
    ],
    color: AMBER, bg: AMBER_BG,
  },
  {
    month: 4,
    items: [
      { label: '日経平均 入替実施（第1営業日）', url: 'https://indexes.nikkei.co.jp/nkave/newsroom' },
    ],
    color: AMBER, bg: AMBER_BG,
  },
  {
    month: 5,
    items: [
      { label: 'MSCI 定期レビュー発表（中旬）', url: 'https://www.msci.com/index-review' },
      { label: '本決算ピーク' },
    ],
    color: AMBER, bg: AMBER_BG,
  },
  {
    month: 7,
    items: [
      { label: 'TOPIX 浮動株比率見直し（末日）', url: 'https://www.jpx.co.jp/markets/indices/revisions-indices/03.html' },
      { label: '1Q決算ピーク' },
    ],
    color: AMBER, bg: AMBER_BG,
  },
  {
    month: 8,
    items: [
      { label: '1Q決算発表（中旬まで）', url: 'https://www.jpx.co.jp/listing/event-schedules/financial-announcement/index.html' },
    ],
    color: AMBER, bg: AMBER_BG,
  },
  {
    month: 9,
    items: [
      { label: '日経平均 秋の定期入替発表（上旬）', url: 'https://indexes.nikkei.co.jp/nkave/newsroom' },
    ],
    color: AMBER, bg: AMBER_BG,
  },
  {
    month: 10,
    items: [
      { label: '日経平均 入替実施（第1営業日）／ TOPIX定期入替', url: 'https://indexes.nikkei.co.jp/nkave/newsroom' },
      { label: '中間決算ピーク' },
    ],
    color: AMBER, bg: AMBER_BG,
  },
  {
    month: 11,
    items: [
      { label: 'MSCI 定期レビュー発表（中旬）', url: 'https://www.msci.com/index-review' },
    ],
    color: AMBER, bg: AMBER_BG,
  },
]

export function getMonthBand(month: number): MonthBand | null {
  return MONTH_BANDS.find(b => b.month === month) ?? null
}
