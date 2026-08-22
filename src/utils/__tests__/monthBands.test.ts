import { describe, it, expect } from 'vitest'
import { MONTH_BANDS, getMonthBand } from '../monthBands'

/**
 * 🔴 2026-08-22 の運用者指示＝**カレンダー下部の帯は全月とも出さない**。
 *    帯が1つでも復活すると、月表示の下に横帯が現れてカレンダーが1行ぶん狭くなる。
 *    「気づいたら戻っていた」を防ぐためにテストで固定する。
 */
describe('月次イベント帯', () => {
  it('どの月にも帯を出さない', () => {
    for (let m = 1; m <= 12; m++) {
      expect(getMonthBand(m)).toBeNull()
    }
  })

  it('データそのものが空', () => {
    expect(MONTH_BANDS).toHaveLength(0)
  })
})
