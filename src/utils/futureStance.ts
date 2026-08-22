import type { PoiroboStock } from './poiroboStocks'
import type { MarketStance } from './marketStance'

/**
 * Future（第4次産業革命）の「結論」を組み立てる（純粋関数・2026-08-22 新設）。
 *
 * 🔴 ブンセキと同じ方針＝**予測は書かない**。書くのは**いまの位置**だけ。
 *    2026-08-22 の検証で、価格・形・需給のいずれも方向を当てられないと確認したため。
 * 🔴 この画面は**数ヶ月〜年単位で見る前提**なので、結論も日々の値動きではなく
 *    「200日線に対してどこにいるか」「高値からどれだけ離れたか」で言う。
 * 🔵 銘柄ごとの見立て（poiroboStockThesis）は人が書くもので、ここでは触らない。
 */
export function buildFutureStance(stocks: PoiroboStock[]): MarketStance | null {
  const rows = stocks.filter(s => s.close != null)
  if (rows.length === 0) return null

  const below = rows.filter(s => s.dev200_pct != null && s.dev200_pct < 0)
  const above = rows.length - below.length

  const headline = below.length === 0
    ? `${rows.length}社すべてが200日線の上にいます`
    : below.length === rows.length
      ? `${rows.length}社すべてが200日線の下にいます`
      : `${rows.length}社のうち ${below.length}社が200日線の下にいます`

  const lines: MarketStance['lines'] = []

  // 位置（200日線との距離）
  const devs = rows.map(s => s.dev200_pct).filter((v): v is number => v != null)
  if (devs.length) {
    const avg = devs.reduce((a, b) => a + b, 0) / devs.length
    lines.push({
      label: '位置',
      text: `200日線からの距離は平均 ${avg >= 0 ? '+' : ''}${avg.toFixed(1)}%（上 ${above}社 ／ 下 ${below.length}社）`,
    })
  }

  // 高値からの距離（この画面は年単位で見るので、こちらが主）
  const fromHigh = rows.map(s => s.momentum?.from_52w_high_pct).filter((v): v is number => v != null)
  if (fromHigh.length) {
    const worst = rows.reduce((a, b) =>
      (b.momentum?.from_52w_high_pct ?? 0) < (a.momentum?.from_52w_high_pct ?? 0) ? b : a)
    lines.push({
      label: '高値',
      text: `52週高値からの距離は平均 ${(fromHigh.reduce((a, b) => a + b, 0) / fromHigh.length).toFixed(1)}%`
        + `（いちばん離れているのは ${worst.name} ${worst.momentum?.from_52w_high_pct?.toFixed(1)}%）`,
    })
  }

  // 値動きの向き（事実だけ。「だから買い」とは書かない）
  const m3 = rows.map(s => s.momentum?.ret?.m3).filter((v): v is number => v != null)
  if (m3.length) {
    const up = m3.filter(v => v > 0).length
    lines.push({ label: '3ヶ月', text: `上げているのは ${up}社 ／ 下げているのは ${m3.length - up}社` })
  }

  const cautions = [
    'この画面は数ヶ月〜年単位で見る前提で、途中の上下は判定材料にしていません',
    '🔴 観測だけで、ロボ口座の判断や売買対象には入れていません',
    'これはいまの位置の記述で、この先どちらへ動くかは示していません',
  ]

  return { headline, lines, cautions, asOf: rows[0].date ?? null }
}
