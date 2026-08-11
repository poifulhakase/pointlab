// 周期（セクターローテーション）画面のタブの並び順（単一情報源）。
//
// 🔴 **スマホだけのタブ**。PC は3列を横に並べて全部見えているので出さない。
//    スマホは縦積みで、円環→次に来る業種→検索と1本のスクロールに全部載っていたため
//    「銘柄を探す」まで指を延々と動かす必要があった（2026-08-11 ユーザー指示で分割）。
//
// 🔴 並び順はここ1か所で決め、パネルを JSX に書く順もこれに合わせる
//    （`quantTabs.ts` / `engineTabs.ts` と同じ約束。2か所に持つと壊れる）。
//
// 🔵 中身の割り当て：
//    sector = 円環（いまどの局面か）
//    stock  = 業種カード（次に来る業種／いま強い業種）→ 銘柄検索とAI分析
//
// 🔴 **業種カードは stock 側**。業種を押す＝その業種の銘柄を検索する、という
//    つながりがあるため、円環側に置くと押した結果が裏のタブに出てしまう
//    （2026-08-11 ユーザー指摘で sector → stock へ移した）。

export const SECTOR_TABS = ['sector', 'stock'] as const

export type SectorTabKey = typeof SECTOR_TABS[number]

export const SECTOR_LABELS: Record<SectorTabKey, string> = {
  sector: 'セクター',
  stock:  '個別',
}
