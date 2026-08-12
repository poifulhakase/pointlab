// 空売り比率の取り出し（nikkei225jp.com daily2year.json の1行から）。
//
// 🔴 2026-08-12 修正：ずっと **col[11]（別の指標）** を空売り比率として読んでいた。
//    実際の空売り比率は東証の定義どおり
//      **col[22]（価格規制なし）＋ col[24]（価格規制あり）**
//    で、11日ぶんを外部の公表値と突き合わせて**ズレ0.00ポイント**で一致することを確認済み。
//    誤った値は正しい値より 7〜16 ポイント低く、画面にもエンジンのプロンプトにも流れていた。
//
// 🔴 **列は範囲で自動検出しない**。col[11] も 16〜71 の範囲に収まる「それらしい数字」だったため、
//    自動検出では気づけなかった。列番号を固定し、下の検算で守る。

/** 列の位置（daily2year.json）。 */
export const SHORT_SELL_COLS = { unrestricted: 22, restricted: 24 }

/**
 * 1行から空売り比率を取り出す（純粋関数・テスト対象）。
 *
 * @returns {{ total:number, unrestricted:number, restricted:number } | null}
 *   取れない・値が怪しいときは null（その日を飛ばす）
 */
export function shortSellFromRow(row) {
  if (!Array.isArray(row)) return null
  const unrestricted = row[SHORT_SELL_COLS.unrestricted]
  const restricted   = row[SHORT_SELL_COLS.restricted]
  if (typeof unrestricted !== 'number' || typeof restricted !== 'number') return null
  if (!(unrestricted >= 0) || !(restricted >= 0)) return null

  const total = Math.round((unrestricted + restricted) * 100) / 100
  // 🔵 検算：東証の空売り比率は実測でおおむね 30〜55%。ここを大きく外れたら列がずれた合図。
  //    「0〜100に収まるか」だけだと、別の列を拾っても通ってしまう（今回の反省）。
  if (total < 10 || total > 80) return null

  return {
    total,
    unrestricted: Math.round(unrestricted * 100) / 100,
    restricted:   Math.round(restricted * 100) / 100,
  }
}
