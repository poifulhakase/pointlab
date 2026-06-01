import { describe, it, expect } from 'vitest'
import { buildExportJson, businessDaysBetween, type EngineExport } from '../engineExport'
import type { InvestorWeekData } from '../jpxInvestorData'
import type { MarginWeekData } from '../jpxMarginData'
import type { VixWeekData, VixDayData } from '../vixData'
import type { AdvanceDeclineWeekData } from '../advanceDeclineData'
import type { ShortSellWeekData } from '../shortSellData'
import type { ArbitrageWeekData, ArbitrageDayData } from '../arbitrageData'
import type { CotNikkeiWeekData } from '../cotNikkeiData'
import type { FuturesDayData } from '../futuresDailyData'
import type { UsdjpyDayData } from '../usdjpyData'
import type { Nas100DayData } from '../nas100Data'
import type { NkFuturesDayData } from '../nkFuturesPriceData'
import type { NtRatioPoint } from '../ntRatioData'
import type { StocksDailyData } from '../stocksDailyData'

// 全引数を空で呼ぶヘルパ（個別に上書きして使う）
function callEmpty(): EngineExport {
  return buildExportJson([], [], [], [], [], [], [], [], [], [], [], [], [], [], null)
}

// 連番週次日付（降順前提のデータも内部でソートされる）
function weekDate(i: number): string {
  const d = new Date(Date.UTC(2026, 0, 5) // 2026-01-05 (月)
  )
  d.setUTCDate(d.getUTCDate() + i * 7)
  return d.toISOString().slice(0, 10)
}
function dayDate(i: number): string {
  const d = new Date(Date.UTC(2026, 4, 1))
  d.setUTCDate(d.getUTCDate() + i)
  return d.toISOString().slice(0, 10)
}

const TOP_LEVEL_KEYS = [
  'generated_at',
  'instant_briefing',
  'flows',
  'positioning',
  'futures',
  'breadth',
  'volatility',
  'price_structure',
  'deviation_score',
  'tev_analysis',
  'events',
  'data_quality',
  'weekly_history',
  'internal_structure',
] as const

describe('buildExportJson — 構造検証', () => {
  it('空入力でも例外を投げず、全トップレベルキーを返す', () => {
    const out = callEmpty()
    for (const k of TOP_LEVEL_KEYS) {
      expect(out, `top-level key: ${k}`).toHaveProperty(k)
    }
  })

  it('generated_at は "YYYY-MM-DD HH:MM:SS" 形式', () => {
    const out = callEmpty()
    expect(out.generated_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })

  it('空入力では weekly_history は空配列・internal_structure は null', () => {
    const out = callEmpty()
    expect(out.weekly_history).toEqual([])
    expect(out.internal_structure).toBeNull()
  })

  it('空入力では価格系・TEV が null セーフ', () => {
    const out = callEmpty()
    expect(out.instant_briefing.nikkei225).toBeNull()
    expect(out.instant_briefing.usdjpy).toBeNull()
    expect(out.tev_analysis.tev).toBeNull()
    expect(out.tev_analysis.tev_for_execution).toBeNull()
    // sanity_ok は tev=null のとき null
    expect(out.tev_analysis.sanity_ok).toBeNull()
  })

  it('net_signal / market_regime は規定の値域に収まる', () => {
    const out = callEmpty()
    expect(['BULL', 'NEUTRAL', 'BEAR']).toContain(out.instant_briefing.net_signal)
    expect(typeof out.instant_briefing.market_regime).toBe('string')
  })

  it('data_quality は tier 集計を持つ', () => {
    const out = callEmpty()
    expect(out.data_quality).toHaveProperty('tier1_daily')
    expect(out.data_quality.tier1_daily).toHaveProperty('total')
    expect(out.data_quality.tier1_daily.total).toBeGreaterThan(0)
  })
})

describe('buildExportJson — 代表データ', () => {
  // 4週分の週次データ
  const N = 4
  const inv: InvestorWeekData[] = Array.from({ length: N }, (_, i) => ({
    date: weekDate(i), label: `w${i}`,
    foreigner: 100_000 * (i + 1), individual: -50_000, trustBank: 20_000, securities: 10_000,
  }))
  const mar: MarginWeekData[] = Array.from({ length: N }, (_, i) => ({
    date: weekDate(i), label: `w${i}`,
    longBal: 4_000_000 + i * 100_000, shortBal: 800_000, ratio: 4.5 + i * 0.1, evalRatio: -8 - i,
  }))
  const vixW: VixWeekData[] = Array.from({ length: N }, (_, i) => ({
    date: weekDate(i), close: 18 + i, change: 0.5, changePct: 2,
  }))
  const ad: AdvanceDeclineWeekData[] = Array.from({ length: N }, (_, i) => ({
    date: weekDate(i), label: `w${i}`, ratio25: 95 + i, advances: 1000, declines: 900,
  }))
  const ss: ShortSellWeekData[] = Array.from({ length: N }, (_, i) => ({
    date: weekDate(i), label: `w${i}`, ratio: 42 + i,
  }))
  const arb: ArbitrageWeekData[] = Array.from({ length: N }, (_, i) => ({
    date: weekDate(i), label: `w${i}`, longBal: 1_000_000 + i * 50_000, shortBal: 300_000,
  }))
  const cot: CotNikkeiWeekData[] = Array.from({ length: N }, (_, i) => ({
    date: weekDate(i), label: `w${i}`, openInterest: 500_000,
    nonCommLong: 200_000, nonCommShort: 150_000, nonCommNet: 50_000,
    commLong: 180_000, commShort: 210_000, commNet: -30_000,
    nonReptLong: 60_000, nonReptShort: 50_000, nonReptNet: 10_000,
  }))

  // 日次データ（30日強あると偏差スコアが計算される）
  const D = 35
  const usdjpy: UsdjpyDayData[] = Array.from({ length: D }, (_, i) => ({
    time: dayDate(i), close: 150 + Math.sin(i) , change: 0.1, changePct: 0.07, ma5: 150, ma5dev: 0.1,
  }))
  const nas100: Nas100DayData[] = Array.from({ length: D }, (_, i) => ({
    time: dayDate(i), close: 20000 + i * 10, changePct: 0.2,
  }))
  const vixDaily: VixDayData[] = Array.from({ length: D }, (_, i) => ({
    time: dayDate(i), close: 18 + Math.cos(i), changePct: -0.5,
  }))
  // futuresDailyData は降順（最新が先頭）
  const futures: FuturesDayData[] = Array.from({ length: D }, (_, i) => ({
    date: dayDate(D - 1 - i).replace(/-/g, '/'),
    volume: 50_000 - i * 100, oi: 600_000 - i * 500, pcr: 0.9 + i * 0.001, close: 39_000 + i,
  }))
  const arbDaily: ArbitrageDayData[] = Array.from({ length: 7 }, (_, i) => ({
    date: dayDate(D - 1 - i), longBal: 1_000_000 - i * 1000, longBalDelta: -1000,
  }))
  // ntData は昇順（最新が末尾）
  const nt: NtRatioPoint[] = Array.from({ length: D }, (_, i) => ({
    time: dayDate(i), nikkei: 39_000 + i * 5, benchmark: 5_000, ratio: 7.8, change: 0.01,
  }))
  // nkFuturesPriceData は降順（最新が先頭）
  const nkPrice: NkFuturesDayData[] = Array.from({ length: 12 }, (_, i) => ({
    date: dayDate(D - 1 - i), open: 39_000, high: 39_200, low: 38_800, close: 39_100,
    volume: 10_000, prev_close: 39_050, change: 50, change_pct: 0.12, ma25_dev: 0.5,
  }))
  const stocks: StocksDailyData = {
    contribution: {
      up: [{ code: '6758', name: 'ソニー', contribution: 30, sector: '電機' }],
      down: [{ code: '9984', name: 'SBG', contribution: -20, sector: '情報' }],
      total: 80,
    },
    sector: {
      up: [{ name: '電機', changePct: 1.2 }],
      down: [{ name: '銀行', changePct: -0.8 }],
      advanceSectorCount: 20, declineSectorCount: 13,
    },
    nkFutures: [],
    updatedAt: '2026-05-30T06:00:00.000Z',
  }

  const out = buildExportJson(
    inv, mar, vixW, nt, ad, ss, arb, cot, arbDaily, usdjpy, futures, nas100, vixDaily, nkPrice, stocks,
  )

  it('weekly_history は EXPORT_WEEKS と週数の小さい方の件数', () => {
    expect(out.weekly_history.length).toBe(N) // 4 < 13
  })

  it('instant_briefing.nikkei225 は最新 nikkei の丸め値', () => {
    const latest = nt[nt.length - 1].nikkei
    expect(out.instant_briefing.nikkei225).toBe(Math.round(latest))
  })

  it('偏差スコアが計算される（35日分のデータあり）', () => {
    expect(out.deviation_score.z_usdjpy).not.toBeNull()
    expect(out.deviation_score.window_days).toBe(30)
  })

  it('internal_structure が stocksData から構築される', () => {
    expect(out.internal_structure).not.toBeNull()
    expect(out.internal_structure?.top_contributors.bullish[0]?.code).toBe('6758')
    expect(out.internal_structure?.sector_performance.advance_sector_count).toBe(20)
  })

  it('flows.foreign.signal は規定値域', () => {
    expect(['BULL', 'NEUTRAL', 'BEAR']).toContain(out.flows.foreign.signal)
  })

  it('futures.recent_10d は最大10件', () => {
    expect(out.futures.recent_10d.length).toBeLessThanOrEqual(10)
  })
})

describe('businessDaysBetween（価格鮮度チェックの営業日数）', () => {
  const D = (s: string) => new Date(s).getTime()

  it('週末を挟む金→月は1営業日（誤発火しない＝閾値2未満）', () => {
    // MA基準=金(米国市場ゲート) vs 先物JST=月。3カレンダー日だが構造的な1営業日。
    expect(businessDaysBetween(D('2026-05-29'), D('2026-06-01'))).toBe(1)
  })

  it('通常の連続営業日（火→水）は1営業日', () => {
    expect(businessDaysBetween(D('2026-05-26'), D('2026-05-27'))).toBe(1)
  })

  it('同日は0営業日', () => {
    expect(businessDaysBetween(D('2026-06-01'), D('2026-06-01'))).toBe(0)
  })

  it('真の陳腐化（水→月の3営業日）は閾値2以上で検出される', () => {
    expect(businessDaysBetween(D('2026-05-27'), D('2026-06-01'))).toBeGreaterThanOrEqual(2)
  })

  it('引数の順序に依存しない（絶対値）', () => {
    expect(businessDaysBetween(D('2026-06-01'), D('2026-05-29')))
      .toBe(businessDaysBetween(D('2026-05-29'), D('2026-06-01')))
  })
})
