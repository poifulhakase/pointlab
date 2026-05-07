import { useState, useEffect, useCallback, useMemo } from 'react'
import type React from 'react'
import type { User } from 'firebase/auth'
import { themeVars } from '../utils/themeVars'
import { fetchInvestorData, type InvestorWeekData } from '../utils/jpxInvestorData'
import { fetchMarginData, type MarginWeekData } from '../utils/jpxMarginData'
import { fetchVixData, type VixWeekData } from '../utils/vixData'
import { fetchNhkNews, type NhkNewsItem } from '../utils/nhkNews'
import { getMacroEventsForDate, MACRO_META } from '../utils/macroCalendar'
import { getSqDates, getSqMarkersForDate, SQ_META } from '../utils/sqCalendar'
import { fetchAdvanceDeclineData, type AdvanceDeclineWeekData } from '../utils/advanceDeclineData'
import { fetchShortSellData, type ShortSellWeekData } from '../utils/shortSellData'
import { fetchArbitrageData, fetchArbitrageDailyData, type ArbitrageWeekData, type ArbitrageDayData } from '../utils/arbitrageData'
import { fetchFuturesParticipantsData, computeMicroVectors, type FuturesParticipantDayData } from '../utils/futuresParticipantsData'
import { fetchFuturesDailyData, type FuturesDayData } from '../utils/futuresDailyData'
import { fetchUsdjpyData, type UsdjpyDayData } from '../utils/usdjpyData'
import { VixPanel } from './VixPanel'
import { NtRatioPanel } from './NtRatioPanel'
import { MicroQuantView, QuantMemoPanel } from './MicroQuantView'
import { DeltaModal, type DeltaModalType } from './DeltaModal'
import { MarketDailyPanel } from './MarketDailyPanel'
import type { NtRatioPoint } from '../utils/ntRatioData'

type QuantTabKey = 'kankyou' | 'genbutsu' | 'micro'
type Props = {
  theme: 'dark' | 'light'
  isMobile: boolean
  user: User | null
  quantTab: QuantTabKey
  onQuantTabChange: (t: QuantTabKey) => void
  settingsOpen: boolean
  onCloseSettings: () => void
}

// ── 投資主体別 列定義 ──────────────────────────────
const INVESTOR_COLS: { key: keyof InvestorWeekData; label: string; sub: string }[] = [
  { key: 'foreigner',  label: '外国人',   sub: '海外勢' },
  { key: 'individual', label: '個人',     sub: '国内個人' },
  { key: 'trustBank',  label: '信託銀行', sub: '年金等' },
  { key: 'securities', label: '証券自己', sub: '自己売買' },
]

// ── フォーマット ───────────────────────────────────
function fmtOku(val: number): string {
  const rounded = Math.round(val)
  if (rounded === 0) return '0'
  const sign = val > 0 ? '+' : '−'
  return `${sign}${Math.abs(rounded).toLocaleString()}`
}

function fmtHyakuman(val: number): string {
  if (val === 0) return '—'
  return Math.round(Math.abs(val)).toLocaleString()
}

function fmtRatio(val: number): string {
  if (val === 0) return '—'
  return val.toFixed(2)
}

function valueBg(val: number, theme: 'dark' | 'light'): string {
  if (Math.round(val) === 0) return 'transparent'
  if (val > 0) return theme === 'dark' ? 'rgba(96,200,140,0.18)' : 'rgba(22,130,80,0.12)'
  return theme === 'dark' ? 'rgba(255,120,100,0.18)' : 'rgba(200,50,30,0.12)'
}

function valueTextColor(val: number, theme: 'dark' | 'light'): string {
  if (Math.round(val) === 0) return 'var(--text-dim)'
  if (val > 0) return theme === 'dark' ? 'rgba(96,200,140,0.95)' : 'rgba(22,130,80,0.95)'
  return theme === 'dark' ? 'rgba(255,120,100,0.95)' : 'rgba(200,50,30,0.95)'
}

function ratioBg(val: number, theme: 'dark' | 'light'): string {
  if (val === 0) return 'transparent'
  if (val >= 6)   return theme === 'dark' ? 'rgba(255,120,100,0.22)' : 'rgba(200,50,30,0.15)'
  if (val >= 4)   return theme === 'dark' ? 'rgba(255,120,100,0.11)' : 'rgba(200,50,30,0.08)'
  if (val <= 1.5) return theme === 'dark' ? 'rgba(96,200,140,0.22)'  : 'rgba(22,130,80,0.15)'
  if (val <= 2.5) return theme === 'dark' ? 'rgba(96,200,140,0.11)'  : 'rgba(22,130,80,0.08)'
  return 'transparent'
}

function ratioTextColor(val: number, theme: 'dark' | 'light'): string {
  if (val === 0) return 'var(--text-dim)'
  if (val >= 6)   return theme === 'dark' ? 'rgba(255,120,100,0.95)' : 'rgba(200,50,30,0.95)'
  if (val >= 4)   return theme === 'dark' ? 'rgba(255,120,100,0.80)' : 'rgba(200,50,30,0.80)'
  if (val <= 1.5) return theme === 'dark' ? 'rgba(96,200,140,0.95)'  : 'rgba(22,130,80,0.95)'
  if (val <= 2.5) return theme === 'dark' ? 'rgba(96,200,140,0.80)'  : 'rgba(22,130,80,0.80)'
  return 'var(--text)'
}

function evalRatioColor(val: number, theme: 'dark' | 'light'): string {
  if (val > -3)  return theme === 'dark' ? 'rgba(96,200,140,0.95)'  : 'rgba(22,130,80,0.95)'
  if (val < -15) return theme === 'dark' ? 'rgba(255,120,100,0.95)' : 'rgba(200,50,30,0.95)'
  if (val < -10) return theme === 'dark' ? 'rgba(255,160,120,0.85)' : 'rgba(200,80,50,0.85)'
  return 'var(--text)'
}
function evalRatioBg(val: number, theme: 'dark' | 'light'): string {
  if (val > -3)  return theme === 'dark' ? 'rgba(96,200,140,0.20)'  : 'rgba(22,130,80,0.13)'
  if (val < -15) return theme === 'dark' ? 'rgba(255,120,100,0.20)' : 'rgba(200,50,30,0.13)'
  if (val < -10) return theme === 'dark' ? 'rgba(255,120,100,0.10)' : 'rgba(200,50,30,0.07)'
  return 'transparent'
}

function quartiles(vals: number[]): [number, number] {
  const sorted = [...vals].filter(v => v > 0).sort((a, b) => a - b)
  if (sorted.length < 4) return [0, Infinity]
  return [sorted[Math.floor(sorted.length * 0.25)], sorted[Math.floor(sorted.length * 0.75)]]
}
function balBg(val: number, q1: number, q3: number, inverse: boolean, theme: 'dark' | 'light'): string {
  const greenBg = theme === 'dark' ? 'rgba(96,200,140,0.18)' : 'rgba(22,130,80,0.12)'
  const redBg   = theme === 'dark' ? 'rgba(255,120,100,0.18)' : 'rgba(200,50,30,0.12)'
  if (val >= q3) return inverse ? redBg : greenBg
  if (val <= q1) return inverse ? greenBg : redBg
  return 'transparent'
}
function balTextColor(val: number, q1: number, q3: number, inverse: boolean, theme: 'dark' | 'light'): string {
  const greenTxt = theme === 'dark' ? 'rgba(96,200,140,0.95)' : 'rgba(22,130,80,0.95)'
  const redTxt   = theme === 'dark' ? 'rgba(255,120,100,0.95)' : 'rgba(200,50,30,0.95)'
  if (val >= q3) return inverse ? redTxt : greenTxt
  if (val <= q1) return inverse ? greenTxt : redTxt
  return 'var(--text)'
}

// 空売り比率の色: 高いほど赤（売り圧力大）/ 低いほど緑
function shortSellBg(val: number, theme: 'dark' | 'light'): string {
  if (val >= 50) return theme === 'dark' ? 'rgba(255,120,100,0.22)' : 'rgba(200,50,30,0.15)'
  if (val >= 46) return theme === 'dark' ? 'rgba(255,120,100,0.11)' : 'rgba(200,50,30,0.08)'
  if (val <= 38) return theme === 'dark' ? 'rgba(96,200,140,0.22)'  : 'rgba(22,130,80,0.15)'
  if (val <= 42) return theme === 'dark' ? 'rgba(96,200,140,0.11)'  : 'rgba(22,130,80,0.08)'
  return 'transparent'
}
function shortSellTextColor(val: number, theme: 'dark' | 'light'): string {
  if (val >= 50) return theme === 'dark' ? 'rgba(255,120,100,0.95)' : 'rgba(200,50,30,0.95)'
  if (val >= 46) return theme === 'dark' ? 'rgba(255,120,100,0.80)' : 'rgba(200,50,30,0.80)'
  if (val <= 38) return theme === 'dark' ? 'rgba(96,200,140,0.95)'  : 'rgba(22,130,80,0.95)'
  if (val <= 42) return theme === 'dark' ? 'rgba(96,200,140,0.80)'  : 'rgba(22,130,80,0.80)'
  return 'var(--text)'
}

// 騰落レシオの色: 120超=過熱（赤）/ 70未満=売られすぎ（緑）
function adRatioBg(val: number, theme: 'dark' | 'light'): string {
  if (val >= 120) return theme === 'dark' ? 'rgba(255,120,100,0.22)' : 'rgba(200,50,30,0.15)'
  if (val >= 110) return theme === 'dark' ? 'rgba(255,120,100,0.11)' : 'rgba(200,50,30,0.08)'
  if (val <= 70)  return theme === 'dark' ? 'rgba(96,200,140,0.22)'  : 'rgba(22,130,80,0.15)'
  if (val <= 80)  return theme === 'dark' ? 'rgba(96,200,140,0.11)'  : 'rgba(22,130,80,0.08)'
  return 'transparent'
}
function adRatioTextColor(val: number, theme: 'dark' | 'light'): string {
  if (val >= 120) return theme === 'dark' ? 'rgba(255,120,100,0.95)' : 'rgba(200,50,30,0.95)'
  if (val >= 110) return theme === 'dark' ? 'rgba(255,120,100,0.80)' : 'rgba(200,50,30,0.80)'
  if (val <= 70)  return theme === 'dark' ? 'rgba(96,200,140,0.95)'  : 'rgba(22,130,80,0.95)'
  if (val <= 80)  return theme === 'dark' ? 'rgba(96,200,140,0.80)'  : 'rgba(22,130,80,0.80)'
  return 'var(--text)'
}

// 裁定買い残の色: 多いほど赤（売り圧力大）/ 少ないほど緑（quartile基準）
function arbBg(val: number, q1: number, q3: number, theme: 'dark' | 'light'): string {
  return balBg(val, q1, q3, true, theme)
}
function arbTextColor(val: number, q1: number, q3: number, theme: 'dark' | 'light'): string {
  return balTextColor(val, q1, q3, true, theme)
}

function withYear(label: string, date: string): string {
  const year = parseInt(date.slice(0, 4))
  return year !== new Date().getFullYear() ? `${year}/${label}` : label
}

// ── 3指標統合テーブル ─────────────────────────────
type CombinedRow = {
  date: string
  label: string
  shortSell: number | null
  adRatio: number | null
  arbLongBal: number | null
  arbShortBal: number | null
  arbShortBalDelta: number | null
}

function buildCombinedRows(
  ssData: ShortSellWeekData[],
  adData: AdvanceDeclineWeekData[],
  arbData: ArbitrageWeekData[],
): CombinedRow[] {
  const ssMap  = new Map(ssData.map(d => [d.date, d]))
  const adMap  = new Map(adData.map(d => [d.date, d]))
  const arbMap = new Map(arbData.map(d => [d.date, d]))
  const allDates = new Set([...ssMap.keys(), ...adMap.keys(), ...arbMap.keys()])
  const arbSorted = [...arbData].sort((a, b) => b.date.localeCompare(a.date))
  const arbIdxMap = new Map(arbSorted.map((d, i) => [d.date, i]))
  return Array.from(allDates)
    .sort((a, b) => b.localeCompare(a))
    .map(date => {
      const ss  = ssMap.get(date)
      const ad  = adMap.get(date)
      const arb = arbMap.get(date)
      const arbShortBal = arb ? (arb.shortBal > 0 ? arb.shortBal : null) : null
      let arbShortBalDelta: number | null = null
      if (arb && arb.shortBal > 0) {
        const idx = arbIdxMap.get(date)
        if (idx !== undefined && idx + 1 < arbSorted.length) {
          const prev = arbSorted[idx + 1]
          if (prev.shortBal > 0) arbShortBalDelta = arb.shortBal - prev.shortBal
        }
      }
      return {
        date,
        label: (ss ?? ad ?? arb)?.label ?? '',
        shortSell:   ss  ? ss.ratio    : null,
        adRatio:     ad  ? ad.ratio25  : null,
        arbLongBal:  arb ? arb.longBal  : null,
        arbShortBal,
        arbShortBalDelta,
      }
    })
}

// ── エクスポート用データ構築 ──────────────────────
function toDate(s: string) { return (s ?? '').replace(/\//g, '-') }
const r2 = (n: number) => Math.round(n * 100) / 100

function getUpcomingEvents(days = 28): { date: string; day: string; events: string[] }[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土']
  const sqDates = [
    ...getSqDates(today.getFullYear()),
    ...getSqDates(today.getFullYear() + 1),
  ]
  const result: { date: string; day: string; events: string[] }[] = []
  for (let i = 0; i <= days; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const events: string[] = []
    for (const e of getMacroEventsForDate(d, { us: true, jp: true })) {
      events.push(MACRO_META[e.type].label)
    }
    for (const sq of getSqMarkersForDate(d, sqDates)) {
      events.push(SQ_META[sq].label)
    }
    if (events.length > 0) {
      result.push({
        date: d.toISOString().slice(0, 10),
        day:  DAYS_JA[d.getDay()],
        events,
      })
    }
  }
  return result
}

const EXPORT_WEEKS = 12

function findNtForDate(ntMap: Map<string, NtRatioPoint>, weekDate: string): NtRatioPoint | undefined {
  if (ntMap.has(weekDate)) return ntMap.get(weekDate)
  const base = new Date(weekDate)
  for (let delta = 1; delta <= 3; delta++) {
    for (const sign of [1, -1]) {
      const d = new Date(base)
      d.setDate(base.getDate() + sign * delta)
      const key = d.toISOString().slice(0, 10)
      if (ntMap.has(key)) return ntMap.get(key)
    }
  }
  return undefined
}

function findVixForDate(vixMap: Map<string, VixWeekData>, date: string): VixWeekData | undefined {
  if (vixMap.has(date)) return vixMap.get(date)
  const base = new Date(date)
  for (let d = 1; d <= 5; d++) {
    for (const s of [1, -1]) {
      const t = new Date(base); t.setDate(base.getDate() + s * d)
      const k = t.toISOString().slice(0, 10)
      if (vixMap.has(k)) return vixMap.get(k)
    }
  }
  return undefined
}

function buildExportJson(
  invData: InvestorWeekData[],
  marData: MarginWeekData[],
  vixData: VixWeekData[],
  newsData: NhkNewsItem[],
  ntData: NtRatioPoint[],
  adData: AdvanceDeclineWeekData[],
  ssData: ShortSellWeekData[],
  arbData: ArbitrageWeekData[],
  participantsData: FuturesParticipantDayData[],
  arbDailyData: ArbitrageDayData[],
  usdjpyData: UsdjpyDayData[],
  futuresDailyData: FuturesDayData[],
) {
  const invMap = new Map(invData.map(d => [toDate(d.date), d]))
  const marMap = new Map(marData.map(d => [toDate(d.date), d]))
  const vixMap = new Map(vixData.map(d => [toDate(d.date), d]))
  const ntMap  = new Map(ntData.map(d => [d.time, d]))
  const adMap  = new Map(adData.map(d => [toDate(d.date), d]))
  const ssMap  = new Map(ssData.map(d => [toDate(d.date), d]))
  const arbMap = new Map(arbData.map(d => [toDate(d.date), d]))

  const allDates = new Set([...invMap.keys(), ...marMap.keys(), ...vixMap.keys(), ...adMap.keys(), ...ssMap.keys(), ...arbMap.keys()])

  const sortedDates = Array.from(allDates).sort((a, b) => b.localeCompare(a)).slice(0, EXPORT_WEEKS)

  const rows = sortedDates
    .map((date, i) => {
      const inv     = invMap.get(date)
      const invPrev = i < sortedDates.length - 1 ? invMap.get(sortedDates[i + 1]) : undefined
      const mar     = marMap.get(date)
      const marPrev = i < sortedDates.length - 1 ? marMap.get(sortedDates[i + 1]) : undefined
      const vix     = findVixForDate(vixMap, date)
      const nt      = findNtForDate(ntMap, date)
      const ad      = adMap.get(date)
      const adPrev  = i < sortedDates.length - 1 ? adMap.get(sortedDates[i + 1])  : undefined
      const ss      = ssMap.get(date)
      const ssPrev  = i < sortedDates.length - 1 ? ssMap.get(sortedDates[i + 1])  : undefined
      const arb     = arbMap.get(date)
      const arbPrev = i < sortedDates.length - 1 ? arbMap.get(sortedDates[i + 1]) : undefined
      return {
        date,
        vix: { value: vix?.close ?? 0, change: vix?.change ?? 0, change_pct: vix?.changePct ?? null },
        ns_ratio: nt ? {
          value:  r2(nt.ratio),
          nikkei: Math.round(nt.nikkei),
          sp500:  r2(nt.sp500),
          change: nt.change != null ? r2(nt.change) : null,
        } : null,
        flows: {
          foreign:     r2(inv?.foreigner  ?? 0),
          institution: r2((inv?.trustBank ?? 0) + (inv?.securities ?? 0)),
          trust_bank:  inv?.trustBank  != null ? r2(inv.trustBank)  : null,
          securities:  inv?.securities != null ? r2(inv.securities) : null,
          retail:      r2(inv?.individual ?? 0),
        },
        credit_ratio:               mar?.ratio ?? 0,
        credit_eval_ratio:          mar?.evalRatio ?? null,
        advance_decline_ratio:      ad?.ratio25 ?? null,
        short_sell_ratio:           ss?.ratio ?? null,
        arbitrage_long_bal_trillion:  arb ? r2(arb.longBal / 1000000) : null,
        arbitrage_short_bal_trillion: arb && arb.shortBal > 0 ? r2(arb.shortBal / 1000000) : null,
        delta: {
          foreign_flows_delta:     inv && invPrev
            ? r2(inv.foreigner - invPrev.foreigner) : null,
          credit_long_pct:         mar && marPrev && marPrev.longBal > 0
            ? r2((mar.longBal - marPrev.longBal) / marPrev.longBal * 100) : null,
          credit_eval_ratio_pp:    mar?.evalRatio != null && marPrev?.evalRatio != null
            ? r2(mar.evalRatio - marPrev.evalRatio) : null,
          arbitrage_long_100m:     arb && arbPrev
            ? Math.round((arb.longBal - arbPrev.longBal) / 100) : null,
          arbitrage_short_100m:    arb && arbPrev && arb.shortBal > 0 && arbPrev.shortBal > 0
            ? Math.round((arb.shortBal - arbPrev.shortBal) / 100) : null,
          short_sell_pp:           ss && ssPrev
            ? r2(ss.ratio - ssPrev.ratio) : null,
          advance_decline_pp:      ad && adPrev
            ? r2(ad.ratio25 - adPrev.ratio25) : null,
          vix_pct:                 vix?.changePct ?? null,
          ns_ratio_change:         nt?.change ?? null,
        },
      }
    })
    .filter(r => r.vix.value !== 0 || r.flows.foreign !== 0 || r.credit_ratio !== 0 || r.advance_decline_ratio !== null || r.short_sell_ratio !== null)

  // ミクロ需給ベクター
  const mv = computeMicroVectors(participantsData)
  const micro_supply_demand = mv && participantsData.length > 0 ? {
    data_as_of: participantsData[0].date,
    frequency: '週次',
    lag_note: 'JPX毎週公表',
    vectors: {
      trend_vector: {
        label: 'スマートマネー', sectors: ['外国人(code60)', '信託銀行(code23)'],
        net_lots: mv.trend.netLots, direction: mv.trend.direction, week_over_week: mv.trend.dayOverDay,
      },
      gravity_vector: {
        label: '機関投資家フロー', sectors: ['生命保険(code11)', '投資信託(code31)'],
        net_lots: mv.gravity.netLots, direction: mv.gravity.direction, week_over_week: mv.gravity.dayOverDay,
      },
      noise_filter: {
        label: '個人/証券', sectors: ['個人(code51)', '証券会社(code41)'],
        net_lots: mv.noise.netLots, direction: mv.noise.direction, week_over_week: mv.noise.dayOverDay,
      },
    },
    sell_pressure_score: mv.sellPressureScore,
    score_percentile:    mv.scorePercentile,
    score_top_pct:       100 - mv.scorePercentile,
    score_median:        mv.scoreMedian,
    score_history_weeks: mv.historyDays,
    alert_level: mv.alertLevel,
    recent: participantsData.slice(0, 5).map(d => ({
      date: d.date, foreign: d.foreign, trustBank: d.trustBank, lifeIns: d.lifeIns,
      invTrust: d.invTrust, individual: d.individual, securities: d.securities,
    })),
  } : null

  // 直近VIXサマリー（AIがdata配列を掘らずに即参照できるよう最新値をトップレベルに展開）
  const vixSorted = [...vixData].sort((a, b) => toDate(b.date).localeCompare(toDate(a.date)))
  const vix_latest = vixSorted[0] ? {
    date:              toDate(vixSorted[0].date),
    close:             vixSorted[0].close,
    weekly_change_pt:  vixSorted[0].change,
    weekly_change_pct: vixSorted[0].changePct,
  } : null

  // 日経225現在値（ntDataはascending順・最新が末尾）
  const nk = ntData.length > 0 ? ntData[ntData.length - 1] : null
  const nk1w = ntData.length > 5  ? ntData[ntData.length - 6]  : null
  const nk1m = ntData.length > 21 ? ntData[ntData.length - 22] : null
  const nikkei225_latest = nk ? {
    date:         nk.time,
    close:        Math.round(nk.nikkei),
    change_1w_pt:  nk1w ? Math.round(nk.nikkei - nk1w.nikkei) : null,
    change_1w_pct: nk1w ? r2((nk.nikkei - nk1w.nikkei) / nk1w.nikkei * 100) : null,
    change_1m_pct: nk1m ? r2((nk.nikkei - nk1m.nikkei) / nk1m.nikkei * 100) : null,
  } : null

  // ドル円最新値
  const fx = usdjpyData.length > 0 ? usdjpyData[usdjpyData.length - 1] : null
  const usdjpy_latest = fx ? {
    date:        fx.time,
    close:       fx.close,
    change:      fx.change,
    change_pct:  fx.changePct,
    ma5:         fx.ma5,
    ma5_dev_pct: fx.ma5dev,
  } : null

  // 裁定日次（直近7件）
  const arbitrage_daily_recent = arbDailyData.slice(0, 7).map(d => ({
    date: d.date, longBal: d.longBal, delta: d.longBalDelta,
  }))

  // 各指標の時間軸を明示（AIが時間軸のズレを誤解しないように）
  const data_freshness = {
    note: '各指標は公表タイミングが異なります。週次指標と日次指標を混同しないでください。',
    nikkei225:          { data_as_of: nk?.time ?? null,                        frequency: '日次', lag_note: 'Yahoo Finance・約15分遅延' },
    usdjpy:             { data_as_of: fx?.time ?? null,                        frequency: '日次', lag_note: 'Yahoo Finance・約15分遅延' },
    vix:                { data_as_of: vix_latest?.date ?? null,                frequency: '週次', lag_note: '週末終値ベース' },
    futures_hand:       { data_as_of: participantsData[0]?.date ?? null,       frequency: '日次', lag_note: 'JPX翌営業日公表' },
    investor_flows:     { data_as_of: toDate(invData[0]?.date ?? '') || null,  frequency: '週次', lag_note: '約1週間遅延' },
    credit_ratio:       { data_as_of: toDate(marData[0]?.date ?? '') || null,  frequency: '週次', lag_note: '約1週間遅延' },
    short_sell_ratio:   { data_as_of: toDate(ssData[0]?.date  ?? '') || null,  frequency: '週次', lag_note: '約1週間遅延' },
    advance_decline:    { data_as_of: toDate(adData[0]?.date  ?? '') || null,  frequency: '週次', lag_note: '約1週間遅延' },
    arbitrage_balance:  { data_as_of: toDate(arbData[0]?.date ?? '') || null,  frequency: '週次', lag_note: '約1週間遅延' },
    arbitrage_daily:    { data_as_of: arbDailyData[0]?.date ?? null,           frequency: '日次', lag_note: 'nikkei225jp.com' },
    futures_oi:         { data_as_of: futuresDailyData[0]?.date ?? null,        frequency: '日次', lag_note: 'JPX日報PDF・毎営業日16:31更新' },
    pcr:                { data_as_of: futuresDailyData.find(d => d.pcr != null)?.date ?? null, frequency: '日次', lag_note: 'オプション引け後更新・先物OIと数時間ズレあり' },
  }

  return {
    meta: { market: 'JP', index: 'Nikkei225', type: 'swing' },
    data_freshness,
    upcoming_events: getUpcomingEvents(28),
    recent_news: newsData.map(n => ({ title: n.title, pubDate: n.pubDate, description: n.description })),
    vix_latest,
    nikkei225_latest,
    usdjpy_latest,
    arbitrage_daily_recent,
    futures_oi_recent: futuresDailyData.slice(0, 20).map((d, i) => {
      const prev = futuresDailyData[i + 1]
      const oi_delta      = prev ? d.oi - prev.oi : null
      const oi_delta_pct  = prev && prev.oi > 0 ? r2((d.oi - prev.oi) / prev.oi * 100) : null
      const vol_delta     = prev ? d.volume - prev.volume : null
      const vol_delta_pct = prev && prev.volume > 0 ? r2((d.volume - prev.volume) / prev.volume * 100) : null
      const pcr_delta     = d.pcr != null && prev?.pcr != null ? r2(d.pcr - prev.pcr) : null
      return { date: d.date, oi: d.oi, oi_delta, oi_delta_pct, volume: d.volume, vol_delta, vol_delta_pct, pcr: d.pcr ?? null, pcr_delta }
    }),
    micro_supply_demand,
    data: rows,
  }
}

// ── AI 分析プロンプトテンプレート ─────────────────
const AI_PROMPT_TEMPLATE = `# 🛡️ 役割定義
あなたは「シニア・クオンツ・ストラテジスト」です。
不完全なデータから市場の**「物理的レジーム遷移」**と**「清算エネルギー」**を推定せよ。
「断定」を避け、常に「推定誤差」と「相関の鮮度」を考慮し、2〜14日の清算シナリオを構築すること。

# 🚥 Layer 0：Event & Dominant Constraint（動的相関）
1. **Dominant Constraint Ranking**:
   - 【FX / Rate / Equity】の順位付け。
   - **Rolling Correlation**: 直近5日と20日の相関変化から、支配勢力の「交代」を検知せよ。
2. **Theta Pressure**: SQまでの残日数による時間減衰（Charm）の強制力。

# 🌀 ステージ1：市場状態（Regime）と遷移トリガー
現在のRegimeを特定し、次のフェーズへの**「遷移スイッチ」**が入っているか判定せよ。

- 【Compression】→ トリガー：Gamma Flip突破 ＋ Signed Delta急増
- 【Ignition】→ トリガー：乖離率の急拡大 ＋ Proxy Gammaの崩壊
- 【Expansion】→ トリガー：Liquidity Voidへの突入
- 【Exhaustion】→ トリガー：OI急減 ＋ IV低下 ＋ Volume Divergence

# 🔴 解析レイヤー：流動性と清算の多重検証
### Layer 1：Constraint & Theta Pressure
- 支配要因からの乖離限界と、時間経過（Theta）による強制ヘッジ圧力を算出。

### Layer 2：Liquidity Topology（真空と受容）
- **Vacuum Zone**: Gamma Density Gradientの急減エリア。
- **Acceptance Zone**: 過去の出来高が厚く、清算が収束しやすい「居心地の良い価格帯」。

### Layer 3：Liquidation Evidence & Confidence
- **Signed Delta**: 清算の性質（投げ/利確）を判定。
- **Confidence Score**: 入力データの鮮度と不透明度から、解析の「推定誤差」を算出せよ。

# 💡 出力形式（Markdownコードブロック内）

■ 市場レジーム分析
・現在のRegime：【状態】 ＋ 【次フェーズへの遷移期待度 %】
・支配的拘束(L0)：【FX / Rate / Equity】（Rolling Correlationによる変化を明記）
- Dealer Regime：【Stabilizing % / Destabilizing %】
- Theta Pressure：(SQ接近による時間的圧力の強さ)

■ 戦略バイアス：【強気 / 弱気 / 転換警戒】
・確信度：[XX%] ＋ (推定誤差：±X%：データの不透明性による)

■ 物理的シミュレーション
・遷移トリガー監視：(どの数値が動けばフェーズが変わるか)
・最速走行ルート：(真空地帯から受容帯への物理的パス)
・清算の証明(L3)：(Signed Deltaによる実弾の符号判定)

■ 磁場マップ（Physical Targets）
・Upper Barrier (Density High): [価格]
・Liquidity Void (Vacuum Zone): [価格帯]
・Acceptance Zone (Target): [価格帯]
・Lower Barrier (Density High): [価格]

■ 戦術指示（Liquidation Scenario）
・メインシナリオ：(「支配要因の変化がどの遷移トリガーを引き、どの受容帯へ清算を運ぶか」)
・目標価格：[価格] (清算エネルギーの収束点)
・撤退条件：(相関の崩壊、または遷移トリガーの消滅)

# 入力データ（JSON）
`

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const el = Object.assign(document.createElement('textarea'), {
        value: text, style: 'position:fixed;opacity:0',
      })
      document.body.appendChild(el)
      el.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(el)
      return ok
    } catch { return false }
  }
}

// ── 設定モーダル ──────────────────────────────────
function QuantSettingsModal({
  isOpen, onClose, onPromptCopy, copyStatus,
}: {
  isOpen: boolean
  onClose: () => void
  onPromptCopy: () => void
  copyStatus: '' | 'prompt'
}) {
  useEffect(() => {
    if (!isOpen) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [isOpen, onClose])

  return (
    <>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)',
        opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none',
        transition: 'opacity 0.18s',
      }} onClick={onClose} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', zIndex: 601,
        transform: isOpen ? 'translate(-50%,-50%) scale(1)' : 'translate(-50%,-50%) scale(0.96)',
        opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none',
        transition: 'opacity 0.18s, transform 0.18s cubic-bezier(0.4,0,0.2,1)',
        width: 'min(440px, calc(100vw - 32px))',
        background: 'var(--modal-bg)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)',
        borderRadius: 18, border: '1px solid var(--glass-border)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.40)', overflow: 'hidden',
      }} onClick={e => e.stopPropagation()}>
        <div style={ms.header}>
          <div style={ms.headerTitle}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 8V4H8"/>
              <rect width="16" height="12" x="4" y="8" rx="2"/>
              <path d="M2 14h2"/><path d="M20 14h2"/>
              <path d="M15 13v2"/><path d="M9 13v2"/>
            </svg>
            ぽいロボエンジン
          </div>
          <button style={ms.closeBtn} onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div style={ms.body}>
          <div style={ms.section}>
            <div style={ms.sectionTitle}>クオンツ分析用プロンプト</div>
            <p style={ms.desc}>AIチャットにそのまま貼り付けて使用できます。</p>
            <button style={{ ...ms.actionBtn, ...ms.actionBtnAccent }} onClick={onPromptCopy}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              {copyStatus === 'prompt' ? 'コピーしました！' : 'プロンプト＋データをコピー'}
            </button>
          </div>

          {/* AI チャットへのリンク */}
          <div style={ms.section}>
            <div style={ms.sectionTitle}>AI チャットで開く</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>

              {/* Gemini */}
              <a
                href="https://gemini.google.com/app"
                target="_blank"
                rel="noopener noreferrer"
                style={ms.aiCard}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  window.open('https://gemini.google.com/app', '_blank', 'noopener,noreferrer')
                }}
              >
                <div style={{ ...ms.aiLogo, background: 'linear-gradient(135deg,#4285f4,#34a853,#fbbc04,#ea4335)', padding: 0, overflow: 'hidden' }}>
                  {/* Gemini star logo */}
                  <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
                    <path d="M14 2 C14 2 15.6 9.4 20 14 C15.6 18.6 14 26 14 26 C14 26 12.4 18.6 8 14 C12.4 9.4 14 2 14 2Z" fill="white"/>
                    <path d="M2 14 C2 14 9.4 12.4 14 8 C18.6 12.4 26 14 26 14 C26 14 18.6 15.6 14 20 C9.4 15.6 2 14 2 14Z" fill="white" opacity="0.85"/>
                  </svg>
                </div>
                <div style={ms.aiInfo}>
                  <div style={ms.aiName}>Gemini</div>
                  <div style={ms.aiDesc}>思考モード推奨</div>
                </div>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--text-dim)', flexShrink: 0 }}>
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>

              {/* Claude */}
              <a
                href="https://claude.ai/projects"
                target="_blank"
                rel="noopener noreferrer"
                style={ms.aiCard}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  window.open('https://claude.ai/projects', '_blank', 'noopener,noreferrer')
                }}
              >
                <div style={{ ...ms.aiLogo, background: '#d97757' }}>
                  {/* Claude logo mark */}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M12 3 C8 3 5 6 5 10 C5 12.5 6.2 14.7 8 16 L7 21 L12 18.5 L17 21 L16 16 C17.8 14.7 19 12.5 19 10 C19 6 16 3 12 3Z" fill="white" opacity="0.95"/>
                  </svg>
                </div>
                <div style={ms.aiInfo}>
                  <div style={ms.aiName}>Claude</div>
                  <div style={ms.aiDesc}>Projects で管理</div>
                </div>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--text-dim)', flexShrink: 0 }}>
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>

              {/* ChatGPT */}
              <a
                href="https://chatgpt.com/"
                target="_blank"
                rel="noopener noreferrer"
                style={ms.aiCard}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  window.open('https://chatgpt.com/', '_blank', 'noopener,noreferrer')
                }}
              >
                <div style={{ ...ms.aiLogo, background: '#10a37f' }}>
                  {/* ChatGPT logo mark */}
                  <svg width="20" height="20" viewBox="0 0 41 41" fill="none">
                    <path d="M37.532 16.87a9.963 9.963 0 0 0-.856-8.184 10.078 10.078 0 0 0-10.855-4.835A9.964 9.964 0 0 0 18.306.5a10.079 10.079 0 0 0-9.614 6.977 9.967 9.967 0 0 0-6.664 4.834 10.08 10.08 0 0 0 1.24 11.817 9.965 9.965 0 0 0 .856 8.185 10.079 10.079 0 0 0 10.855 4.835 9.965 9.965 0 0 0 7.516 3.35 10.078 10.078 0 0 0 9.617-6.981 9.967 9.967 0 0 0 6.663-4.834 10.079 10.079 0 0 0-1.243-11.813zM22.498 37.886a7.474 7.474 0 0 1-4.799-1.735c.061-.033.168-.091.237-.134l7.964-4.6a1.294 1.294 0 0 0 .655-1.134V19.054l3.366 1.944a.12.12 0 0 1 .066.092v9.299a7.505 7.505 0 0 1-7.49 7.496zM6.392 31.006a7.471 7.471 0 0 1-.894-5.023c.06.036.162.099.237.141l7.964 4.6a1.297 1.297 0 0 0 1.308 0l9.724-5.614v3.888a.12.12 0 0 1-.048.103l-8.051 4.649a7.504 7.504 0 0 1-10.24-2.744zM4.297 13.62A7.469 7.469 0 0 1 8.2 10.333c0 .068-.004.19-.004.274v9.201a1.294 1.294 0 0 0 .654 1.132l9.723 5.614-3.366 1.944a.12.12 0 0 1-.114.012L7.044 23.86a7.504 7.504 0 0 1-2.747-10.24zm27.658 6.437l-9.724-5.615 3.367-1.943a.121.121 0 0 1 .114-.012l8.048 4.648a7.498 7.498 0 0 1-1.158 13.528v-9.476a1.293 1.293 0 0 0-.647-1.13zm3.35-5.043c-.059-.037-.162-.099-.236-.141l-7.965-4.6a1.298 1.298 0 0 0-1.308 0l-9.723 5.614v-3.888a.12.12 0 0 1 .048-.103l8.05-4.645a7.497 7.497 0 0 1 11.135 7.763zm-21.063 6.929l-3.367-1.944a.12.12 0 0 1-.065-.092v-9.299a7.497 7.497 0 0 1 12.293-5.756 6.94 6.94 0 0 0-.236.134l-7.965 4.6a1.294 1.294 0 0 0-.654 1.132l-.006 11.225zm1.829-3.943l4.33-2.501 4.332 2.498v4.996l-4.331 2.5-4.331-2.5V18z" fill="white"/>
                  </svg>
                </div>
                <div style={ms.aiInfo}>
                  <div style={ms.aiName}>ChatGPT</div>
                  <div style={ms.aiDesc}>o3推奨</div>
                </div>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--text-dim)', flexShrink: 0 }}>
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>

            </div>
          </div>
        </div>
      </div>
    </>
  )
}

const ms: Record<string, React.CSSProperties> = {
  header:          { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-dim)' },
  headerTitle:     { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--text)' },
  closeBtn:        { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, color: 'var(--text-sub)', cursor: 'pointer' },
  body:            { padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 18 },
  section:         { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionTitle:    { fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: 'var(--text-dim)' },
  desc:            { fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.6, margin: 0 },
  promptPreview:   { fontSize: 11, lineHeight: 1.7, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border-dim)' },
  actionBtn:       { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 600, color: 'var(--text)', background: 'var(--bg-medium)', border: '1px solid var(--glass-border)', cursor: 'pointer', transition: 'background 0.15s' },
  actionBtnAccent: { background: 'var(--accent-glass)', border: '1px solid var(--accent)', color: '#fff' },
  aiCard: {
    flex: '1 1 140px', display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px', borderRadius: 10,
    background: 'var(--bg-subtle)', border: '1px solid var(--glass-border)',
    textDecoration: 'none', cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
  },
  aiLogo: {
    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  aiInfo:  { flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  aiName:  { fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' as const },
  aiDesc:  { fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap' as const },
}

// ── パネルヘッダー ─────────────────────────────────
function PanelHeader({
  icon, title, sub, dateRange,
}: {
  icon: React.ReactNode
  title: string
  sub: string
  dateRange?: string
}) {
  return (
    <div style={s.panelHead}>
      <div style={s.panelTitle}>
        {icon}
        {title}
        <span style={s.panelSub}>{sub}</span>
      </div>
      <div style={s.panelRight}>
        {dateRange && <span style={s.dataRange}>{dateRange}</span>}
      </div>
    </div>
  )
}

function PanelCenter({ loading, error, onRetry }: { loading: boolean; error: string; onRetry: () => void }) {
  if (loading) return (
    <div style={s.center}>
      <div style={s.spinner} />
      <span style={{ color: 'var(--text-sub)', fontSize: 13 }}>取得中…</span>
    </div>
  )
  if (error) return (
    <div style={s.center}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,100,80,0.7)" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span style={{ color: 'var(--text-sub)', fontSize: 12, maxWidth: 280, textAlign: 'center' }}>{error}</span>
      <button style={s.retryBtn} onClick={onRetry}>再試行</button>
    </div>
  )
  return null
}

// ── メインコンポーネント ───────────────────────────
export function QuantView({ theme, isMobile, user, quantTab, settingsOpen, onCloseSettings }: Props) {
  const [invData,    setInvData]    = useState<InvestorWeekData[]>([])
  const [invLoading, setInvLoading] = useState(false)
  const [invError,   setInvError]   = useState('')
  const [invLoaded,  setInvLoaded]  = useState(false)

  const [marData,    setMarData]    = useState<MarginWeekData[]>([])
  const [marLoading, setMarLoading] = useState(false)
  const [marError,   setMarError]   = useState('')
  const [marLoaded,  setMarLoaded]  = useState(false)

  const [vixWeekData,   setVixWeekData]   = useState<VixWeekData[]>([])
  const [vixWeekLoaded, setVixWeekLoaded] = useState(false)

  const [adData,    setAdData]    = useState<AdvanceDeclineWeekData[]>([])
  const [adLoading, setAdLoading] = useState(false)
  const [adError,   setAdError]   = useState('')
  const [adLoaded,  setAdLoaded]  = useState(false)

  const [ssData,    setSsData]    = useState<ShortSellWeekData[]>([])
  const [ssLoading, setSsLoading] = useState(false)
  const [ssError,   setSsError]   = useState('')
  const [ssLoaded,  setSsLoaded]  = useState(false)

  const [arbData,    setArbData]    = useState<ArbitrageWeekData[]>([])
  const [arbLoading, setArbLoading] = useState(false)
  const [arbError,   setArbError]   = useState('')
  const [arbLoaded,  setArbLoaded]  = useState(false)

  const [arbDailyData,   setArbDailyData]   = useState<ArbitrageDayData[]>([])
  const [arbDailyLoaded, setArbDailyLoaded] = useState(false)

  const [usdjpyData,    setUsdjpyData]    = useState<UsdjpyDayData[]>([])
  const [usdjpyLoading, setUsdjpyLoading] = useState(false)
  const [usdjpyError,   setUsdjpyError]   = useState('')
  const [usdjpyLoaded,  setUsdjpyLoaded]  = useState(false)

  const [futuresDailyData,   setFuturesDailyData]   = useState<FuturesDayData[]>([])
  const [futuresDailyLoaded, setFuturesDailyLoaded] = useState(false)
  const [futuresDailyLoading, setFuturesDailyLoading] = useState(false)
  const [futuresDailyError,   setFuturesDailyError]   = useState('')

  const [participantsData,    setParticipantsData]    = useState<FuturesParticipantDayData[]>([])
  const [participantsLoading, setParticipantsLoading] = useState(false)
  const [participantsError,   setParticipantsError]   = useState('')
  const [participantsLoaded,  setParticipantsLoaded]  = useState(false)

  const [ntData, setNtData] = useState<NtRatioPoint[]>([])
  const handleNtDataLoaded = useCallback((d: NtRatioPoint[]) => {
    setNtData(d)
  }, [])

  const [nhkNews, setNhkNews] = useState<NhkNewsItem[]>([])

  // settingsOpen / onCloseSettings は props から受け取る（App.tsx でリフト済み）
  const [copyStatus,   setCopyStatus]   = useState<'' | 'prompt'>('')
  // quantTab / setQuantTab は props から受け取る（App.tsx でリフト済み）
  const [deltaModal,  setDeltaModal]  = useState<DeltaModalType | null>(null)

  // スマホ用テーブル展開状態（デフォルト: 折りたたみ）
  const [marExpanded,         setMarExpanded]         = useState(false)
  const [invExpanded,         setInvExpanded]         = useState(false)
  const [combinedExpanded,    setCombinedExpanded]    = useState(false)
  const [futuresDailyExpanded, setFuturesDailyExpanded] = useState(false)
  const MOBILE_ROW_LIMIT = 10

  const loadInvestor = useCallback(async (force = false) => {
    setInvLoading(true); setInvError('')
    try { setInvData(await fetchInvestorData(force)); setInvLoaded(true) }
    catch (e) { setInvError(e instanceof Error ? e.message : 'データ取得エラー') }
    finally { setInvLoading(false) }
  }, [])

  const loadMargin = useCallback(async (force = false) => {
    setMarLoading(true); setMarError('')
    try { setMarData(await fetchMarginData(force)); setMarLoaded(true) }
    catch (e) { setMarError(e instanceof Error ? e.message : 'データ取得エラー') }
    finally { setMarLoading(false) }
  }, [])

  const loadVixWeek = useCallback(async () => {
    try { setVixWeekData(await fetchVixData()); setVixWeekLoaded(true) }
    catch { /* silent: エクスポートにのみ使用 */ }
  }, [])

  const loadAdvanceDecline = useCallback(async (force = false) => {
    setAdLoading(true); setAdError('')
    try { setAdData(await fetchAdvanceDeclineData(force)); setAdLoaded(true) }
    catch (e) { setAdError(e instanceof Error ? e.message : 'データ取得エラー') }
    finally { setAdLoading(false) }
  }, [])

  const loadShortSell = useCallback(async (force = false) => {
    setSsLoading(true); setSsError('')
    try { setSsData(await fetchShortSellData(force)); setSsLoaded(true) }
    catch (e) { setSsError(e instanceof Error ? e.message : 'データ取得エラー') }
    finally { setSsLoading(false) }
  }, [])

  const loadArbitrage = useCallback(async (force = false) => {
    setArbLoading(true); setArbError('')
    try { setArbData(await fetchArbitrageData(force)); setArbLoaded(true) }
    catch (e) { setArbError(e instanceof Error ? e.message : 'データ取得エラー') }
    finally { setArbLoading(false) }
  }, [])

  const loadArbDaily = useCallback(async (force = false) => {
    try { setArbDailyData(await fetchArbitrageDailyData(force)); setArbDailyLoaded(true) }
    catch { /* AI export 用のみ・エラーはサイレント */ }
  }, [])

  const loadFuturesDaily = useCallback(async (force = false) => {
    setFuturesDailyLoading(true); setFuturesDailyError('')
    try { setFuturesDailyData(await fetchFuturesDailyData(force)); setFuturesDailyLoaded(true) }
    catch (e) { setFuturesDailyError(e instanceof Error ? e.message : 'データ取得エラー') }
    finally { setFuturesDailyLoading(false) }
  }, [])

  const loadUsdjpy = useCallback(async (force = false) => {
    setUsdjpyLoading(true); setUsdjpyError('')
    try { setUsdjpyData(await fetchUsdjpyData(force)); setUsdjpyLoaded(true) }
    catch (e) { setUsdjpyError(e instanceof Error ? e.message : 'データ取得エラー') }
    finally { setUsdjpyLoading(false) }
  }, [])

  const loadParticipants = useCallback(async (force = false) => {
    setParticipantsLoading(true); setParticipantsError('')
    try { setParticipantsData(await fetchFuturesParticipantsData(force)); setParticipantsLoaded(true) }
    catch (e) { setParticipantsError(e instanceof Error ? e.message : 'データ取得エラー') }
    finally { setParticipantsLoading(false) }
  }, [])

  useEffect(() => { if (!invLoaded)          loadInvestor()      }, [invLoaded,          loadInvestor])
  useEffect(() => { if (!participantsLoaded) loadParticipants()  }, [participantsLoaded, loadParticipants])

  // JST 18:30 daily auto-refresh for participants (futures_participants.json is updated daily around this time)
  useEffect(() => {
    function scheduleNextRefresh() {
      const now = new Date()
      const next = new Date(now)
      next.setUTCHours(9, 30, 0, 0)  // UTC 09:30 = JST 18:30
      if (next <= now) next.setUTCDate(next.getUTCDate() + 1)
      const id = setTimeout(() => { loadParticipants(true); scheduleNextRefresh() }, next.getTime() - now.getTime())
      return id
    }
    const id = scheduleNextRefresh()
    return () => clearTimeout(id)
  }, [loadParticipants])
  useEffect(() => { if (!marLoaded)     loadMargin()        }, [marLoaded,     loadMargin])
  useEffect(() => { if (!vixWeekLoaded) loadVixWeek()       }, [vixWeekLoaded, loadVixWeek])
  useEffect(() => { if (!adLoaded)      loadAdvanceDecline()}, [adLoaded,      loadAdvanceDecline])
  useEffect(() => { if (!ssLoaded)      loadShortSell()     }, [ssLoaded,      loadShortSell])
  useEffect(() => { if (!arbLoaded)     loadArbitrage()     }, [arbLoaded,     loadArbitrage])
  useEffect(() => { if (!arbDailyLoaded)  loadArbDaily()     }, [arbDailyLoaded,  loadArbDaily])
  useEffect(() => { if (!usdjpyLoaded)    loadUsdjpy()       }, [usdjpyLoaded,    loadUsdjpy])
  useEffect(() => { if (!futuresDailyLoaded) loadFuturesDaily() }, [futuresDailyLoaded, loadFuturesDaily])

  useEffect(() => {
    fetchNhkNews().then(setNhkNews).catch(() => {})
  }, [])

  const handlePromptCopy = useCallback(async () => {
    const json = JSON.stringify(buildExportJson(invData, marData, vixWeekData, nhkNews, ntData, adData, ssData, arbData, participantsData, arbDailyData, usdjpyData, futuresDailyData), null, 2)
    await copyText(AI_PROMPT_TEMPLATE + json)
    setCopyStatus('prompt')
    setTimeout(() => setCopyStatus(''), 2000)
  }, [invData, marData, vixWeekData, nhkNews, ntData, adData, ssData, arbData, participantsData, arbDailyData, usdjpyData, futuresDailyData])

  const tv = useMemo(() => themeVars(theme), [theme])

  // モバイル向けテーブルスタイル（横スクロールなし・パディング縮小・ヘッダー折り返し許可）
  const { mTblWrap, mTh, mTd, mThDate, mTdDate } = useMemo(() => ({
    mTblWrap: isMobile
      ? { ...s.tableWrap, overflowX: 'hidden' as const, overflowY: 'visible' as const, flex: 'none' as const }
      : s.tableWrap,
    mTh:     isMobile ? { ...s.th, padding: '6px 5px', whiteSpace: 'normal' as const, fontSize: 10 } : s.th,
    mTd:     isMobile ? { ...s.td, padding: '6px 5px', fontSize: 11 } : s.td,
    mThDate: isMobile ? { ...s.th, ...s.thDate, padding: '6px 5px', width: 52, minWidth: 52, whiteSpace: 'normal' as const, fontSize: 10 } : { ...s.th, ...s.thDate },
    mTdDate: isMobile ? { ...s.td, ...s.tdDate, padding: '6px 5px', width: 52, minWidth: 52 } : { ...s.td, ...s.tdDate },
  }), [isMobile])

  return (
    <div style={{ ...s.wrap, ...tv }}>
      {/* ── Δ分析モーダル ── */}
      {deltaModal && (
        <DeltaModal
          type={deltaModal}
          marData={marData}
          arbData={arbData}
          ssData={ssData}
          adData={adData}
          futuresDailyData={futuresDailyData}
          participantsData={participantsData}
          theme={theme}
          onClose={() => setDeltaModal(null)}
        />
      )}
      {/* ── ボディ ── */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* スライダートラック */}
        <div style={{
          display: 'flex',
          width: '300%',
          height: '100%',
          transform: quantTab === 'kankyou' ? 'translateX(0)' : quantTab === 'genbutsu' ? 'translateX(-33.333%)' : 'translateX(-66.667%)',
          transition: 'transform 0.25s ease',
        }}>

        {/* ━━ 環境 ━━ */}
        <div style={{
          width: '33.333%',
          flexShrink: 0,
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          height: '100%',
          overflowX: 'hidden',
          overflowY: isMobile ? 'auto' : 'hidden',
          paddingBottom: isMobile ? 130 : 0,
        }}>

        {/* VIX */}
        <div style={isMobile ? s.panelMobile : s.panel}>
          <div style={{ ...s.panelHead, minHeight: 36 }}>
            <div style={s.panelTitle}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
              VIX
              <span style={s.panelSub}>恐怖指数（CBOE・日足・約15分遅延）</span>
            </div>
          </div>
          <VixPanel theme={theme} vixWeekData={vixWeekData} isMobile={isMobile} />
        </div>

        <div style={isMobile ? s.dividerH : s.divider} />

        {/* NS倍率 */}
        <div style={isMobile ? s.panelMobile : s.panel}>
          <div style={{ ...s.panelHead, minHeight: 36 }}>
            <div style={s.panelTitle}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6"  y1="20" x2="6"  y2="14"/>
              </svg>
              NS倍率
              <span style={s.panelSub}>日経225 ÷ S&amp;P500（日足・約15分遅延）</span>
            </div>
          </div>
          <NtRatioPanel theme={theme} onDataLoaded={handleNtDataLoaded} />
        </div>

        <div style={isMobile ? s.dividerH : s.divider} />

        {/* クオンツ分析レポート */}
        <div style={isMobile ? { flexShrink: 0, display: 'flex', flexDirection: 'column' } : s.panel}>
          <QuantMemoPanel theme={theme} user={user} isMobile={isMobile} />
        </div>


        </div>{/* /環境 */}

        {/* ━━ 現物需給 ━━ */}
        <div style={isMobile ? {
          width: '33.333%', flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          height: '100%', overflowX: 'hidden', overflowY: 'auto',
          paddingBottom: 130,
        } : {
          width: '33.333%', flexShrink: 0,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          height: '100%', overflow: 'hidden',
        }}>

        {/* TL: 信用倍率 */}
        <div style={isMobile ? s.panelMobile : { ...s.panel, borderRight: '1px solid var(--border-dim)', borderBottom: '1px solid var(--border-dim)' }}>
          <PanelHeader
            icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>}
            title="信用倍率"
            sub="2市場計（週次）"
            dateRange={marData.length > 0 ? `${marData[marData.length - 1]?.date} 〜 ${marData[0]?.date}` : undefined}
          />
          <div style={mTblWrap}>
            {(marLoading && marData.length === 0) || marError
              ? <PanelCenter loading={marLoading && marData.length === 0} error={marError} onRetry={() => loadMargin(true)} />
              : (
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={mThDate}>週</th>
                      <th style={mTh}>
                        <div style={{ ...s.thLabel, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                          <button onClick={() => setDeltaModal('credit_long')} title="信用買い残 Δ分析" style={s.deltaBtn}>Δ</button>
                          買い残
                        </div>
                        <div style={s.thSub}>百万円</div>
                      </th>
                      <th style={mTh}><div style={s.thLabel}>売り残</div><div style={s.thSub}>百万円</div></th>
                      <th style={mTh}><div style={s.thLabel}>信用倍率</div><div style={s.thSub}>買残÷売残</div></th>
                      <th style={mTh}><div style={s.thLabel}>評価損益率</div><div style={s.thSub}>%</div></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const [longQ1, longQ3]   = quartiles(marData.map(r => r.longBal))
                      const [shortQ1, shortQ3] = quartiles(marData.map(r => r.shortBal))
                      const visibleRows = isMobile && !marExpanded ? marData.slice(0, MOBILE_ROW_LIMIT) : marData
                      return visibleRows.map((row, i) => (
                        <tr key={row.date} style={{ ...s.tr, background: i === 0 ? 'var(--latest-row-bg)' : 'transparent' }}>
                          <td style={mTdDate}>
                            <div style={s.dateMain}>{withYear(row.label, row.date)}</div>
                            <div style={s.dateSub}>{row.date}</div>
                          </td>
                          <td style={{ ...mTd, ...s.tdNum, background: balBg(row.longBal, longQ1, longQ3, true, theme) }}>
                            <span style={{ color: balTextColor(row.longBal, longQ1, longQ3, true, theme), fontWeight: 500 }}>
                              {fmtHyakuman(row.longBal)}
                            </span>
                          </td>
                          <td style={{ ...mTd, ...s.tdNum, background: balBg(row.shortBal, shortQ1, shortQ3, false, theme) }}>
                            <span style={{ color: balTextColor(row.shortBal, shortQ1, shortQ3, false, theme), fontWeight: 500 }}>
                              {fmtHyakuman(row.shortBal)}
                            </span>
                          </td>
                          <td style={{ ...mTd, ...s.tdNum, background: ratioBg(row.ratio, theme) }}>
                            <span style={{ color: ratioTextColor(row.ratio, theme), fontWeight: 700, fontSize: 14 }}>
                              {fmtRatio(row.ratio)}
                            </span>
                            <span style={s.unit}>倍</span>
                          </td>
                          <td style={{ ...mTd, ...s.tdNum, background: row.evalRatio != null ? evalRatioBg(row.evalRatio, theme) : 'transparent' }}>
                            {row.evalRatio != null ? (
                              <><span style={{ color: evalRatioColor(row.evalRatio, theme), fontWeight: 700, fontSize: 14 }}>
                                {row.evalRatio > 0 ? '+' : ''}{row.evalRatio.toFixed(2)}
                              </span><span style={s.unit}>%</span></>
                            ) : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                          </td>
                        </tr>
                      ))
                    })()}
                  </tbody>
                </table>
              )
            }
          </div>
          {isMobile && marData.length > MOBILE_ROW_LIMIT && (
            <button style={s.expandBtn} onClick={() => setMarExpanded(v => !v)}>
              {marExpanded ? `▲ 折りたたむ` : `▼ 全${marData.length}週を表示`}
            </button>
          )}
        </div>

        {isMobile && <div style={s.dividerH} />}

        {/* TR: 投資主体別売買動向 */}
        <div style={isMobile ? s.panelMobile : { ...s.panel, borderBottom: '1px solid var(--border-dim)' }}>
          <PanelHeader
            icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="17" cy="8" r="3"/><circle cx="7" cy="16" r="3"/><path d="M14 8H7M17 11v5"/></svg>}
            title="投資主体別売買動向"
            sub="差引金額（百万円）"
            dateRange={invData.length > 0 ? `${invData[invData.length - 1]?.date} 〜 ${invData[0]?.date}` : undefined}
          />
          <div style={mTblWrap}>
            {(invLoading && invData.length === 0) || invError
              ? <PanelCenter loading={invLoading && invData.length === 0} error={invError} onRetry={() => loadInvestor(true)} />
              : (
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={mThDate}>週</th>
                      {INVESTOR_COLS.map(col => (
                        <th key={col.key} style={mTh}>
                          <div style={s.thLabel}>{col.label}</div>
                          <div style={s.thSub}>{col.sub}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(isMobile && !invExpanded ? invData.slice(0, MOBILE_ROW_LIMIT) : invData).map((row, i) => (
                      <tr key={row.date} style={{ ...s.tr, background: i === 0 ? 'var(--latest-row-bg)' : 'transparent' }}>
                        <td style={mTdDate}>
                          <div style={s.dateMain}>{row.label}</div>
                          <div style={s.dateSub}>{row.date}</div>
                        </td>
                        {INVESTOR_COLS.map(col => {
                          const val = row[col.key] as number
                          return (
                            <td key={col.key} style={{ ...mTd, ...s.tdNum, background: valueBg(val, theme) }}>
                              <span style={{ color: valueTextColor(val, theme), fontWeight: val !== 0 ? 600 : 400 }}>
                                {fmtOku(val)}
                              </span>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            }
          </div>
          {isMobile && invData.length > MOBILE_ROW_LIMIT && (
            <button style={s.expandBtn} onClick={() => setInvExpanded(v => !v)}>
              {invExpanded ? `▲ 折りたたむ` : `▼ 全${invData.length}週を表示`}
            </button>
          )}
        </div>

        {isMobile && <div style={s.dividerH} />}

        {/* BL: 需給指標（騰落レシオ・空売り比率・裁定残高） */}
        <div style={isMobile ? s.panelMobile : { ...s.panel, borderRight: '1px solid var(--border-dim)' }}>
          {(() => {
            const combinedRows = buildCombinedRows(ssData, adData, arbData)
            const [arbQ1, arbQ3]           = quartiles(arbData.map(r => r.longBal))
            const [arbShortQ1, arbShortQ3] = quartiles(arbData.map(r => r.shortBal))
            const combinedLoading = (ssLoading || adLoading || arbLoading) && combinedRows.length === 0
            const combinedError = ssError || adError || arbError
            const latestDate = combinedRows[0]?.date
            return (
              <>
                <PanelHeader
                  icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
                  title="需給指標"
                  sub="空売り比率・騰落レシオ・裁定残高（週次）"
                  dateRange={latestDate ? `最新: ${latestDate}` : undefined}
                />
                <div style={mTblWrap}>
                  {combinedLoading || combinedError
                    ? <PanelCenter loading={combinedLoading} error={combinedError} onRetry={() => { loadShortSell(true); loadAdvanceDecline(true); loadArbitrage(true) }} />
                    : combinedRows.length === 0
                      ? <div style={s.center}><span style={{ color: 'var(--text-dim)', fontSize: 12, textAlign: 'center' }}>データなし</span></div>
                      : (
                        <table style={s.table}>
                          <thead>
                            <tr>
                              <th style={mThDate}>週</th>
                              <th style={mTh}>
                                <div style={{ ...s.thLabel, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                                  <button onClick={() => setDeltaModal('arbitrage_long')} title="裁定買い残 Δ分析" style={s.deltaBtn}>Δ</button>
                                  裁定買い残
                                </div>
                                <div style={s.thSub}>百万円</div>
                              </th>
                              <th style={mTh}>
                                <div style={{ ...s.thLabel, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                                  <button onClick={() => setDeltaModal('arbitrage_short')} title="裁定売り残 Δ分析" style={s.deltaBtn}>Δ</button>
                                  裁定売り残
                                </div>
                                <div style={s.thSub}>先物OI</div>
                              </th>
                              <th style={mTh}>
                                <div style={{ ...s.thLabel, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                                  <button onClick={() => setDeltaModal('advance_decline')} title="騰落レシオ Δ分析" style={s.deltaBtn}>Δ</button>
                                  騰落レシオ
                                </div>
                                <div style={s.thSub}>25日</div>
                              </th>
                              <th style={mTh}>
                                <div style={{ ...s.thLabel, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                                  <button onClick={() => setDeltaModal('short_sell')} title="空売り比率 Δ分析" style={s.deltaBtn}>Δ</button>
                                  空売り比率
                                </div>
                                <div style={s.thSub}>%</div>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {(isMobile && !combinedExpanded ? combinedRows.slice(0, MOBILE_ROW_LIMIT) : combinedRows).map((row, i) => (
                              <tr key={row.date} style={{ ...s.tr, background: i === 0 ? 'var(--latest-row-bg)' : 'transparent' }}>
                                <td style={mTdDate}>
                                  <div style={s.dateMain}>{row.label}</div>
                                  <div style={s.dateSub}>{row.date}</div>
                                </td>
                                <td style={{ ...mTd, ...s.tdNum, background: row.arbLongBal != null ? arbBg(row.arbLongBal, arbQ1, arbQ3, theme) : 'transparent' }}>
                                  {row.arbLongBal != null
                                    ? <span style={{ color: arbTextColor(row.arbLongBal, arbQ1, arbQ3, theme), fontWeight: 500 }}>{fmtHyakuman(row.arbLongBal)}</span>
                                    : <span style={{ color: 'var(--text-dim)' }}>-</span>
                                  }
                                </td>
                                <td style={{ ...mTd, ...s.tdNum, background: row.arbShortBal != null ? balBg(row.arbShortBal, arbShortQ1, arbShortQ3, false, theme) : 'transparent' }}>
                                  {row.arbShortBal != null
                                    ? <span style={{ color: balTextColor(row.arbShortBal, arbShortQ1, arbShortQ3, false, theme), fontWeight: 500 }}>{fmtHyakuman(row.arbShortBal)}</span>
                                    : <span style={{ color: 'var(--text-dim)' }}>-</span>
                                  }
                                </td>
                                <td style={{ ...mTd, ...s.tdNum, background: row.adRatio != null ? adRatioBg(row.adRatio, theme) : 'transparent' }}>
                                  {row.adRatio != null
                                    ? <span style={{ color: adRatioTextColor(row.adRatio, theme), fontWeight: 700, fontSize: 13 }}>{row.adRatio.toFixed(1)}</span>
                                    : <span style={{ color: 'var(--text-dim)' }}>-</span>
                                  }
                                </td>
                                <td style={{ ...mTd, ...s.tdNum, background: row.shortSell != null ? shortSellBg(row.shortSell, theme) : 'transparent' }}>
                                  {row.shortSell != null
                                    ? <><span style={{ color: shortSellTextColor(row.shortSell, theme), fontWeight: 700, fontSize: 13 }}>{row.shortSell.toFixed(1)}</span><span style={s.unit}>%</span></>
                                    : <span style={{ color: 'var(--text-dim)' }}>-</span>
                                  }
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )
                  }
                </div>
                {isMobile && combinedRows.length > MOBILE_ROW_LIMIT && (
                  <button style={s.expandBtn} onClick={() => setCombinedExpanded(v => !v)}>
                    {combinedExpanded ? `▲ 折りたたむ` : `▼ 全${combinedRows.length}週を表示`}
                  </button>
                )}
              </>
            )
          })()}
        </div>

        {isMobile && <div style={s.dividerH} />}

        {/* BR: USD/JPY 日次 */}
        <div style={isMobile ? s.panelMobile : s.panel}>
          <MarketDailyPanel
            theme={theme}
            isMobile={isMobile}
            usdjpyData={usdjpyData}
            usdjpyLoading={usdjpyLoading}
            usdjpyError={usdjpyError}
            onUsdjpyReload={() => loadUsdjpy(true)}
          />
        </div>


        </div>{/* /現物需給 */}

        {/* ━━ 先物需給 ━━ */}
        <div style={{
          width: '33.333%',
          flexShrink: 0,
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          height: '100%',
          overflowY: isMobile ? 'auto' : 'hidden',
          paddingBottom: isMobile ? 130 : 0,
        }}>

          {/* 左 2/3: 投資主体別先物手口 */}
          <div style={isMobile
            ? { display: 'flex', flexDirection: 'column' }
            : { flex: 2, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-dim)', overflow: 'hidden', minWidth: 0 }
          }>
            <MicroQuantView
              theme={theme}
              isMobile={isMobile}
              data={participantsData}
              loading={participantsLoading}
              error={participantsError}
              onReload={() => loadParticipants(true)}
              onOpenNetDelta={() => setDeltaModal('futures_net_weekly')}
            />
          </div>

          {isMobile && <div style={s.dividerH} />}

          {/* 右 1/3: 建玉残高・取引高（統合テーブル） */}
          {(() => {
            const rows = futuresDailyData.slice(0, isMobile ? (futuresDailyExpanded ? futuresDailyData.length : MOBILE_ROW_LIMIT) : 20)
            const fmtOi  = (n: number) => (n / 10000).toFixed(1) + '万'
            const fmtVol = (n: number) => n >= 10000 ? (n / 10000).toFixed(1) + '万' : n.toLocaleString()
            const latestDate = futuresDailyData[0]?.date ?? null
            const loadingEmpty = futuresDailyLoading && futuresDailyData.length === 0
            const errorEmpty   = futuresDailyError   && futuresDailyData.length === 0

            return (
              <div style={isMobile
                ? { display: 'flex', flexDirection: 'column' }
                : { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }
              }>
                <div style={isMobile ? s.halfPanelMobile : { ...s.halfPanel, flex: 1 }}>
                  <div style={{ ...s.panelHead, minHeight: 36 }}>
                    <div style={s.panelTitle}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
                      </svg>
                      建玉残高・取引高
                      <span style={s.panelSub}>日経225先物 全限月 (日次)</span>
                    </div>
                    <div style={s.panelRight}>
                      {latestDate && <span style={s.dataRange}>{latestDate}</span>}
                      <button onClick={() => loadFuturesDaily(true)} style={s.reloadBtn} title="再読み込み">↺</button>
                    </div>
                  </div>
                  {loadingEmpty
                    ? <div style={s.center}><div style={s.spinner} /></div>
                    : errorEmpty
                    ? <div style={s.center}>
                        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{futuresDailyError}</div>
                        <button style={s.retryBtn} onClick={() => loadFuturesDaily(true)}>再試行</button>
                      </div>
                    : futuresDailyData.length === 0
                    ? <div style={s.center}><div style={{ fontSize: 12, color: 'var(--text-dim)' }}>データなし</div></div>
                    : (
                      <div style={s.tableWrap}>
                        <table style={{ ...s.table, minWidth: 260 }}>
                          <thead>
                            <tr>
                              <th style={{ ...s.th, ...s.thDate }}>日付</th>
                              <th style={s.th}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                                  <button onClick={() => setDeltaModal('futures_oi')} title="先物OI前日比 Δ分析" style={s.deltaBtn}>Δ</button>
                                  建玉残高
                                </div>
                                <div style={s.thSub}>万枚</div>
                              </th>
                              <th style={s.th}>取引高<div style={s.thSub}>枚</div></th>
                              <th style={s.th}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                                  <button onClick={() => setDeltaModal('pcr')} title="PCR Δ分析" style={s.deltaBtn}>Δ</button>
                                  PCR
                                </div>
                                <div style={s.thSub}>P/C比</div>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row, i) => {
                              const prev = futuresDailyData[i + 1]
                              const oiDelta  = prev ? row.oi - prev.oi : null
                              const volDelta = prev ? row.volume - prev.volume : null
                              const pcrDelta = prev?.pcr != null && row.pcr != null ? Math.round((row.pcr - prev.pcr) * 100) / 100 : null
                              const deltaColor = (d: number | null) => d == null ? undefined
                                : d > 0 ? (theme === 'dark' ? 'rgba(52,211,153,0.9)' : 'rgba(5,150,105,0.9)')
                                : d < 0 ? (theme === 'dark' ? 'rgba(248,113,113,0.9)' : 'rgba(185,28,28,0.9)')
                                : undefined
                              // PCRは高い（put>call）ほど下圧力→赤、低い（call>put）ほど緑
                              const pcrDeltaColor = (d: number | null) => d == null ? undefined
                                : d > 0 ? (theme === 'dark' ? 'rgba(248,113,113,0.9)' : 'rgba(185,28,28,0.9)')
                                : d < 0 ? (theme === 'dark' ? 'rgba(52,211,153,0.9)' : 'rgba(5,150,105,0.9)')
                                : undefined
                              return (
                                <tr key={row.date} style={{ ...s.tr, background: i === 0 ? 'var(--latest-row-bg)' : 'transparent' }}>
                                  <td style={{ ...s.td, ...s.tdDate }}>
                                    <div style={s.dateMain}>{row.date.slice(5).replace('/', '/')}</div>
                                    <div style={s.dateSub}>{row.date.slice(0, 4)}</div>
                                  </td>
                                  <td style={{ ...s.td, ...s.tdNum, background: oiDelta != null ? valueBg(oiDelta, theme) : 'transparent' }}>
                                    <span style={{ fontWeight: 600 }}>{fmtOi(row.oi)}</span>
                                    {oiDelta != null && (
                                      <span style={{ fontSize: 10, color: deltaColor(oiDelta), marginLeft: 4 }}>
                                        {oiDelta > 0 ? '+' : ''}{Math.abs(oiDelta) >= 10000 ? (oiDelta / 10000).toFixed(1) + '万' : oiDelta.toLocaleString()}
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ ...s.td, ...s.tdNum, background: volDelta != null ? valueBg(volDelta, theme) : 'transparent' }}>
                                    <span style={{ color: 'var(--text-sub)' }}>{fmtVol(row.volume)}</span>
                                    {volDelta != null && (
                                      <span style={{ fontSize: 10, color: deltaColor(volDelta), marginLeft: 4 }}>
                                        {volDelta > 0 ? '+' : volDelta < 0 ? '-' : ''}{fmtVol(Math.abs(volDelta))}
                                      </span>
                                    )}
                                  </td>
                                  <td style={{
                                    ...s.td, ...s.tdNum,
                                    ...(row.pcr != null && row.pcr >= 1.2 ? { background: theme === 'dark' ? 'rgba(248,113,113,0.13)' : 'rgba(185,28,28,0.08)' } : {}),
                                    ...(row.pcr != null && row.pcr <= 0.8 ? { background: theme === 'dark' ? 'rgba(52,211,153,0.13)' : 'rgba(5,150,105,0.08)'  } : {}),
                                  }}>
                                    {row.pcr != null ? (
                                      <>
                                        <span style={{ fontWeight: 600, color: row.pcr >= 1.2 ? (theme === 'dark' ? '#f87171' : '#b91c1c') : row.pcr <= 0.8 ? (theme === 'dark' ? '#34d399' : '#059669') : 'var(--text)' }}>
                                          {row.pcr.toFixed(2)}
                                        </span>
                                        {pcrDelta != null && (
                                          <span style={{ fontSize: 10, color: pcrDeltaColor(pcrDelta), marginLeft: 4 }}>
                                            {pcrDelta > 0 ? '+' : ''}{pcrDelta.toFixed(2)}
                                          </span>
                                        )}
                                      </>
                                    ) : <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>—</span>}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                  }
                </div>
                {isMobile && futuresDailyData.length > MOBILE_ROW_LIMIT && (
                  <button style={s.expandBtn} onClick={() => setFuturesDailyExpanded(v => !v)}>
                    {futuresDailyExpanded ? `▲ 折りたたむ` : `▼ 全${futuresDailyData.length}日を表示`}
                  </button>
                )}
              </div>
            )
          })()}

        </div>

        </div>{/* /スライダートラック */}

      </div>{/* /ボディ */}

      <QuantSettingsModal
        isOpen={settingsOpen}
        onClose={onCloseSettings}
        onPromptCopy={handlePromptCopy}
        copyStatus={copyStatus}
      />
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap:      { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 },
  topBar:    {
    display: 'flex', alignItems: 'center',
    padding: '6px 12px', minHeight: 44, flexShrink: 0,
    borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none',
    userSelect: 'none',
  },
  gearBtn:   { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, color: 'var(--text-sub)', cursor: 'pointer', flexShrink: 0 },
  quantTabGroup:  { display: 'flex', borderRadius: 10, overflow: 'hidden', padding: 3, gap: 2, flexShrink: 0 },
  quantTab:       { padding: '5px 14px', borderRadius: 7, fontSize: 13, fontWeight: 500, color: 'var(--text-sub)', cursor: 'pointer', transition: 'background 0.15s, color 0.15s' },
  quantTabActive: { background: 'var(--view-btn-active-bg)', color: 'var(--view-btn-active-color)', boxShadow: '0 2px 8px rgba(100,120,200,0.15)' },
  body:      { flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 },

  panel:       { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 },
  panelMobile: { flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'visible' },

  // PC: 上下均等に flex 1 でチャート/テーブルが半分ずつ
  halfPanel:       { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 },
  // モバイル: チャートは固定高さ、テーブルは自然な高さ
  halfPanelMobile: { flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'visible' },

  divider:     { width: 1, background: 'var(--border-dim)', flexShrink: 0 },
  dividerH:    { height: 1, background: 'var(--border-dim)', flexShrink: 0 },

  panelHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '7px 14px', flexShrink: 0, gap: 8,
    borderBottom: '1px solid var(--border-dim)',
    userSelect: 'none',
  },
  panelTitle: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', minWidth: 0 },
  panelSub:   { fontSize: 10, fontWeight: 400, color: 'var(--text-sub)', marginLeft: 2, overflow: 'hidden', textOverflow: 'ellipsis' },
  panelRight: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  dataRange:  { fontSize: 10, color: 'var(--text-dim)' },
  reloadBtn:  {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
    color: 'var(--text-sub)', background: 'var(--glass-bg)',
    border: '1px solid var(--glass-border)', cursor: 'pointer',
  },

  center:   { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 },
  spinner:  {
    width: 28, height: 28, borderRadius: '50%',
    border: '3px solid var(--glass-border)',
    borderTopColor: 'var(--accent)',
    animation: 'spin 0.8s linear infinite',
  },
  retryBtn: {
    padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
    background: 'var(--accent-glass)', border: '1px solid var(--accent)',
    color: '#fff', cursor: 'pointer',
  },

  tableWrap: { flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '0 0 16px' },
  table:     { width: '100%', borderCollapse: 'collapse', minWidth: 220 },
  th:        {
    position: 'sticky', top: 0, zIndex: 2,
    padding: '9px 14px', textAlign: 'right',
    background: 'var(--modal-bg)', backdropFilter: 'blur(16px)',
    borderBottom: '2px solid var(--border-dim)',
    fontSize: 11, fontWeight: 700, color: 'var(--text)',
    whiteSpace: 'nowrap',
  },
  thDate:    { textAlign: 'left', width: 80, minWidth: 80 },
  thLabel:   { fontSize: 11, fontWeight: 700 },
  thSub:     { fontSize: 10, fontWeight: 400, color: 'var(--text-dim)', marginTop: 1 },
  tr:        { transition: 'background 0.1s' },
  td:        { padding: '7px 14px', borderBottom: '1px solid var(--border-dim)', fontSize: 12 },
  tdDate:    { width: 80, minWidth: 80 },
  tdNum:     { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  dateMain:  { fontSize: 11, fontWeight: 600, color: 'var(--text)' },
  dateSub:   { fontSize: 10, color: 'var(--text-dim)', marginTop: 2 },
  unit:      { fontSize: 10, color: 'var(--text-dim)', marginLeft: 3 },
  deltaBtn:  { background: 'none', border: '1px solid var(--border-dim)', borderRadius: 3, cursor: 'pointer', color: 'var(--accent)', fontSize: 10, fontWeight: 700, padding: '0px 3px', lineHeight: 1.4, letterSpacing: '0.02em', flexShrink: 0 } as React.CSSProperties,
  expandBtn: {
    display: 'block', width: '100%',
    padding: '9px 14px', textAlign: 'center' as const,
    fontSize: 11, fontWeight: 600, color: 'var(--text-sub)',
    background: 'var(--glass-bg)', border: 'none',
    borderTop: '1px solid var(--border-dim)',
    cursor: 'pointer', letterSpacing: '0.03em',
  },
}
