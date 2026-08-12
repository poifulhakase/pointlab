import { describe, it, expect } from 'vitest'
// @ts-expect-error — .mjs に型定義は無い
import { shortSellFromRow, SHORT_SELL_COLS } from '../../../scripts/shortSell.mjs'

/**
 * 空売り比率の列（2026-08-12 の修正）。
 *
 * 🔴 それまで col[11] を空売り比率として読んでいたが、これは別の指標だった。
 *    正しくは **col[22]（価格規制なし）＋ col[24]（価格規制あり）**。
 *    下の数字は外部の公表値と突き合わせて**ズレ0.00ポイント**で一致することを確認した実データ。
 */
function row(unrestricted: number, restricted: number, other11 = 30) {
  const r: unknown[] = new Array(35).fill(null)
  r[0] = 1786287600000
  r[11] = other11                              // 🔴 これを拾ってはいけない
  r[SHORT_SELL_COLS.unrestricted] = unrestricted
  r[SHORT_SELL_COLS.restricted] = restricted
  return r
}

describe('shortSellFromRow', () => {
  it('価格規制なし＋ありの合計を返す（実データで検証した組み合わせ）', () => {
    // 2026-08-10: 33.6 + 7.5 = 41.1／2026-08-03: 34.1 + 11.3 = 45.4
    expect(shortSellFromRow(row(33.6, 7.5)).total).toBe(41.1)
    expect(shortSellFromRow(row(34.1, 11.3)).total).toBe(45.4)
  })

  it('内訳も残す（どちらが増えたのかを後から見るため）', () => {
    const v = shortSellFromRow(row(29.2, 7.9))
    expect(v).toEqual({ total: 37.1, unrestricted: 29.2, restricted: 7.9 })
  })

  it('🔴 col[11] は使わない（別の指標で、7〜16ポイント低い値が入っている）', () => {
    // col[11] に 24.99 が入っていても、合計は col[22]+col[24] から作る
    expect(shortSellFromRow(row(33.6, 7.5, 24.99)).total).toBe(41.1)
  })

  it('数字が入っていない日は null（その日を飛ばす）', () => {
    expect(shortSellFromRow(row(33.6, null as unknown as number))).toBeNull()
    expect(shortSellFromRow(null as unknown as unknown[])).toBeNull()
  })

  it('🔴 検算：ありえない水準は弾く（列がずれた合図）', () => {
    // 空売り比率は実測でおおむね30〜55%。1桁や90%超は列を取り違えている
    expect(shortSellFromRow(row(3, 2))).toBeNull()
    expect(shortSellFromRow(row(70, 20))).toBeNull()
  })
})
