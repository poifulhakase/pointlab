import { describe, it, expect } from 'vitest'
import { buildMarketStance, percentile, rankWord } from '../marketStance'

/**
 * 🔴 ここで守りたいのは**書かないこと**。
 *    2026-08-22 の検証で否定された読み（下ヒゲ＝買い／買残の積み上がり＝売り）や、
 *    そもそも当てられないと分かった「上がる／下がる」を、結論に混ぜないこと。
 *    表示が壊れても気づけるが、**主張が混ざったことには気づけない**のでテストで固定する。
 */

const week = (date: string, ratio: number, evalRatio: number | null = null) =>
  ({ date, label: '', longBal: 1000, shortBal: 1000 / ratio, ratio, evalRatio })

const day = (date: string, close: number, high = close + 10, low = close - 10) =>
  ({ date, open: close, high, low, close, volume: null, prev_close: null, change: null, change_pct: null, ma25_dev: null })

/** 信用倍率が右肩上がり＝最新がいちばん高い、を作る */
const margins = (latest: number) => {
  const rows = [week('2026/08/14', latest, -8)]
  for (let i = 1; i < 30; i++) rows.push(week(`2026/0${1 + (i % 8)}/0${1 + (i % 9)}`, 1 + i * 0.1))
  return rows
}
const prices = () => Array.from({ length: 30 }, (_, i) => day(`2026-08-${String(30 - i).padStart(2, '0')}`, 40000 - i * 50))

describe('percentile / rankWord', () => {
  it('標本が少なすぎるときは黙る（無理に順位を出さない）', () => {
    expect(percentile([1, 2, 3], 2)).toBeNull()
  })

  it('位置を0〜100で返す', () => {
    const xs = Array.from({ length: 100 }, (_, i) => i)
    expect(percentile(xs, 99)).toBe(100)
    expect(percentile(xs, 0)).toBe(1)
  })

  // 🔵 「高い＝良い」とは言わない（良し悪しの判断を混ぜない）
  it('分位の言い方に良し悪しを入れない', () => {
    for (const p of [0, 15, 50, 80, 95]) {
      const w = rankWord(p)
      expect(w).not.toMatch(/良|悪|買い時|売り時|チャンス/)
    }
  })
})

describe('結論の組み立て', () => {
  const base = { arbitrage: [], shortSell: [], advanceDecline: [], price: prices() }

  it('材料が無ければ null（空の枠を出さない）', () => {
    expect(buildMarketStance({ ...base, margin: [], price: [] })).toBeNull()
  })

  it('信用倍率が高いときは「買い方に偏っている」と言い切る', () => {
    const s = buildMarketStance({ ...base, margin: margins(99) })!
    expect(s.headline).toContain('買い方に偏っています')
    expect(s.headline).toMatch(/過去1年/)
  })

  it('信用倍率が低いときは「売り方が多い」と言い切る', () => {
    const s = buildMarketStance({ ...base, margin: margins(0.01) })!
    expect(s.headline).toContain('売り方が多い')
  })

  // 🔴 いちばん大事な行。方向を当てにいく文言を出さない
  it('結論に「上がる／下がる」を書かない', () => {
    for (const r of [99, 2, 1.5]) {
      const s = buildMarketStance({ ...base, margin: margins(r) })!
      const all = [s.headline, ...s.lines.map(l => l.text), ...s.cautions].join(' ')
      expect(all).not.toMatch(/上がる|下がる|反発|買い時|売り時|狙|期待できる/)
    }
  })

  // 🔴 2026-08-22 に否定された読みを復活させない
  it('下ヒゲを「だから反発」と書かず、事実として出すだけ', () => {
    const s = buildMarketStance({ ...base, margin: margins(5) })!
    const shape = s.lines.find(l => l.label === '形')
    expect(shape).toBeDefined()
    expect(shape!.text).not.toMatch(/セリクラ|反発|底/)
  })

  it('予測ではないという断りが必ず入る', () => {
    const s = buildMarketStance({ ...base, margin: margins(5) })!
    expect(s.cautions.some(t => t.includes('どちらへ動くかは示していません'))).toBe(true)
  })

  it('価格と形の行が出る', () => {
    const s = buildMarketStance({ ...base, margin: margins(5) })!
    expect(s.lines.map(l => l.label)).toEqual(expect.arrayContaining(['価格', '形']))
  })
})
