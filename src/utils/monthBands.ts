// カレンダー下部の「月次イベント帯」。
//
// 🔴 **2026-08-22：全month削除（運用者の指示）。いまはどの月にも帯を出さない。**
//    2026-08-16 に決算関連を消した時点で「帯が無い月は枠ごと出さない」形にしてあり、
//    残っていた指数イベント（入替・レビュー・浮動株比率）もこの日に全部落とした。
//    → `MONTH_BANDS` が空なので `getMonthBand()` は常に null を返し、
//      各ビューの `{band && ...}` が丸ごと描画されない＝**帯のエリアごと消える**。
//
// 🔵 描画側（MonthView / WeekView / DayView）のコードは残してある。
//    復活させたくなったら、この配列に足すだけで元に戻る。
//
// 🔴 復活させるときの決まり（2026-08-16）＝**決算関連は載せない**。
//    「1Q決算ピーク」等は日付が動くうえ銘柄ごとに違うので、カレンダーに置く意味が薄い。
//    載せてよいのは**日付が決まっている指数イベント**だけ。
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

/** 🔴 空。2026-08-22 に全月ぶんを削除した（上のコメント参照）。 */
export const MONTH_BANDS: MonthBand[] = []

export function getMonthBand(month: number): MonthBand | null {
  return MONTH_BANDS.find(b => b.month === month) ?? null
}
