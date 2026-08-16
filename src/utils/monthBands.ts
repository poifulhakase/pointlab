// カレンダー下部の「月次イベント帯」。
//
// 🔴 **決算関連は載せない**（2026-08-16 ユーザー指示で全削除）。
//    「1Q決算ピーク」「本決算ピーク」「中間決算ピーク」「3Q決算ピーク」
//    「1Q決算発表（中旬まで）」を消し、8月は帯そのものが無くなった。
//    ここに載せるのは**日付が決まっている指数イベント**（入替・レビュー・浮動株比率）だけ。
// 🔴 帯が無い月は**枠ごと出さない**（旧実装は visibility:hidden で高さを確保していた）。
//    空の帯を残すとカレンダーが1行ぶん狭いままになるため、詰めて表示する。
//
// 🔵 旧ファイル名は `earningsSeason.ts`。決算を扱わなくなったので改名した。

export type BandItem = {
  label: string
  url?: string
}

export type MonthBand = {
  month: number
  items: BandItem[]
}

export const MONTH_BANDS: MonthBand[] = [
  { month: 1,  items: [{ label: 'TOPIX 浮動株比率見直し（末日）', url: 'https://www.jpx.co.jp/markets/indices/revisions-indices/03.html' }] },
  { month: 3,  items: [{ label: '日経平均 春の定期入替発表（上旬）', url: 'https://indexes.nikkei.co.jp/nkave/newsroom' }] },
  { month: 4,  items: [{ label: '日経平均 入替実施（第1営業日）', url: 'https://indexes.nikkei.co.jp/nkave/newsroom' }] },
  { month: 5,  items: [{ label: 'MSCI 定期レビュー発表（中旬）', url: 'https://www.msci.com/index-review' }] },
  { month: 7,  items: [{ label: 'TOPIX 浮動株比率見直し（末日）', url: 'https://www.jpx.co.jp/markets/indices/revisions-indices/03.html' }] },
  { month: 9,  items: [{ label: '日経平均 秋の定期入替発表（上旬）', url: 'https://indexes.nikkei.co.jp/nkave/newsroom' }] },
  { month: 10, items: [{ label: '日経平均 入替実施（第1営業日）／ TOPIX定期入替', url: 'https://indexes.nikkei.co.jp/nkave/newsroom' }] },
  { month: 11, items: [{ label: 'MSCI 定期レビュー発表（中旬）', url: 'https://www.msci.com/index-review' }] },
]

export function getMonthBand(month: number): MonthBand | null {
  return MONTH_BANDS.find(b => b.month === month) ?? null
}
