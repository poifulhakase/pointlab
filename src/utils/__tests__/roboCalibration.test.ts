import { describe, it, expect } from 'vitest'
import panelSource from '../../components/RoboAccountPanel.tsx?raw'
import {
  PROVISIONAL_MIN, isProvisional, mainStat, variantList, MAIN_HORIZON,
  type RoboCalibration,
} from '../roboCalibration'

/**
 * 判断の答え合わせを画面に出すときの約束。
 * 🔴 いちばん大事なのは「n が足りないうちは暫定と書く」こと（2026-08-16 ユーザー判断）。
 *    ここが外れると、数件の勝率を実力として読む画面になる。
 */

const cal = (n5: number, extra: Partial<RoboCalibration> = {}): RoboCalibration => ({
  updatedAt: '2026-08-16T00:00:00.000Z',
  basis: '判断した日の終値を起点に測る',
  caveat: '建玉の損益ではない',
  horizons: ['1d', '5d'],
  variants: {
    main: {
      label: '本番（需給＋価格＋チャート）',
      summary: {
        logs: 4, directional: 3, hold: 1,
        by_horizon: {
          '1d': { n: 3, wins: 2, win_rate_pct: 66.67, avg_confidence: 57, avg_edge_pct: 0.5, bull: { n: 3, win_rate_pct: 66.67 }, bear: { n: 0, win_rate_pct: null } },
          '5d': { n: n5, wins: 0, win_rate_pct: null, avg_confidence: null, avg_edge_pct: null, bull: { n: 0, win_rate_pct: null }, bear: { n: 0, win_rate_pct: null } },
        },
      },
      calibration: { '1d': [], '5d': [] },
    },
  },
  rows: [],
  ...extra,
})

describe('判断の答え合わせ（表示側）', () => {
  it('30件に満たないあいだは暫定', () => {
    expect(PROVISIONAL_MIN).toBe(30)
    expect(isProvisional(0)).toBe(true)
    expect(isProvisional(29)).toBe(true)
    expect(isProvisional(30)).toBe(false)
    // 未生成（null / undefined）も暫定として扱う
    expect(isProvisional(null)).toBe(true)
    expect(isProvisional(undefined)).toBe(true)
  })

  it('主に見るのは5営業日後', () => {
    expect(MAIN_HORIZON).toBe('5d')
    expect(mainStat(cal(7))?.n).toBe(7)
    expect(mainStat(cal(7), '1d')?.n).toBe(3)
    expect(mainStat(null)).toBeNull()
  })

  it('影より本番が先に並ぶ', () => {
    const c = cal(0)
    c.variants.chart_only = { ...c.variants.main, label: '影：チャートのみ' }
    c.variants.numbers_only = { ...c.variants.main, label: '影：数値のみ' }
    expect(variantList(c).map(v => v.key)).toEqual(['main', 'chart_only', 'numbers_only'])
    expect(variantList(null)).toEqual([])
  })

  it('画面に「暫定」と「建玉の損益ではない」を書いている', () => {
    // 🔴 文言そのものが仕様（小さい標本を実力として読ませないための断り）
    expect(panelSource).toContain('暫定')
    expect(panelSource).toContain('建玉の損益')
    expect(panelSource).toContain('isProvisional')
  })
})
