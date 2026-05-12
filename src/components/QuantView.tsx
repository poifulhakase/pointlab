import { useState, useEffect, useCallback, useMemo } from 'react'
import type React from 'react'
import type { User } from 'firebase/auth'
import { themeVars } from '../utils/themeVars'
import { fetchInvestorData, type InvestorWeekData } from '../utils/jpxInvestorData'
import { fetchMarginData, type MarginWeekData } from '../utils/jpxMarginData'
import { fetchVixData, fetchVixDailyData, type VixWeekData, type VixDayData } from '../utils/vixData'
import { getMacroEventsForDate, MACRO_META } from '../utils/macroCalendar'
import { getSqDates, getSqMarkersForDate, SQ_META } from '../utils/sqCalendar'
import { fetchAdvanceDeclineData, type AdvanceDeclineWeekData } from '../utils/advanceDeclineData'
import { fetchShortSellData, type ShortSellWeekData } from '../utils/shortSellData'
import { fetchArbitrageData, fetchArbitrageDailyData, type ArbitrageWeekData, type ArbitrageDayData } from '../utils/arbitrageData'
import { fetchCotNikkeiData, type CotNikkeiWeekData } from '../utils/cotNikkeiData'
import { fetchFuturesDailyData, type FuturesDayData } from '../utils/futuresDailyData'
import { fetchUsdjpyData, type UsdjpyDayData } from '../utils/usdjpyData'
import { fetchNas100Data, type Nas100DayData } from '../utils/nas100Data'
import { fetchNkFuturesPriceData, type NkFuturesDayData } from '../utils/nkFuturesPriceData'
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

const EXPORT_WEEKS = 26

// ── 偏差スコア計算ヘルパー ──────────────────────────
// 最低 MIN_Z 件あれば計算（データ欠損・プロキシ失敗でも動作）
const MIN_Z = 3

function zScore(values: number[]): number | null {
  if (values.length < MIN_Z) return null
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length
  const std = Math.sqrt(variance)
  if (std === 0) return 0
  return r2((values[values.length - 1] - mean) / std)
}

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
  ntData: NtRatioPoint[],
  adData: AdvanceDeclineWeekData[],
  ssData: ShortSellWeekData[],
  arbData: ArbitrageWeekData[],
  cotData: CotNikkeiWeekData[],
  arbDailyData: ArbitrageDayData[],
  usdjpyData: UsdjpyDayData[],
  futuresDailyData: FuturesDayData[],
  nas100Data: Nas100DayData[],
  vixDailyData: VixDayData[],
  nkFuturesPriceData: NkFuturesDayData[],
) {
  // ── ローカルヘルパー ──────────────────────────────
  function pctRank(series: number[], val: number): number {
    if (series.length === 0) return 50
    return Math.round(series.filter(v => v < val).length / series.length * 100)
  }
  function sig(bullPct: number): 'BULL' | 'NEUTRAL' | 'BEAR' {
    return bullPct >= 65 ? 'BULL' : bullPct <= 35 ? 'BEAR' : 'NEUTRAL'
  }
  function hvol(prices: number[], window: number): number | null {
    if (prices.length < window + 1) return null
    const sl   = prices.slice(-(window + 1))
    const rets = sl.slice(1).map((p, i) => Math.log(p / sl[i]))
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length
    const variance = rets.reduce((a, r) => a + (r - mean) ** 2, 0) / rets.length
    return r2(Math.sqrt(variance * 252) * 100)
  }
  function maL(arr: number[], n: number): number | null {
    if (arr.length < n) return null
    return r2(arr.slice(-n).reduce((a, b) => a + b, 0) / n)
  }
  function nearKey<T>(map: Map<string, T>, date: string, maxDays = 7): T | undefined {
    if (map.has(date)) return map.get(date)
    const base = new Date(date)
    for (let delta = 1; delta <= maxDays; delta++) {
      for (const sign of [1, -1]) {
        const t = new Date(base); t.setDate(base.getDate() + sign * delta)
        const k = t.toISOString().slice(0, 10)
        if (map.has(k)) return map.get(k)
      }
    }
    return undefined
  }

  // ── データ整列とマップ ────────────────────────────
  const invS  = [...invData].sort((a, b) => toDate(b.date).localeCompare(toDate(a.date)))
  const marS  = [...marData].sort((a, b) => toDate(b.date).localeCompare(toDate(a.date)))
  const vixS  = [...vixData].sort((a, b) => toDate(b.date).localeCompare(toDate(a.date)))
  const adS   = [...adData].sort((a, b) => toDate(b.date).localeCompare(toDate(a.date)))
  const ssS   = [...ssData].sort((a, b) => toDate(b.date).localeCompare(toDate(a.date)))
  const arbS  = [...arbData].sort((a, b) => toDate(b.date).localeCompare(toDate(a.date)))
  const cotS  = [...cotData].sort((a, b) => b.date.localeCompare(a.date))

  const invMap  = new Map(invS.map(d => [toDate(d.date), d]))
  const marMap  = new Map(marS.map(d => [toDate(d.date), d]))
  const vixMapW = new Map(vixS.map(d => [toDate(d.date), d]))
  const adMap   = new Map(adS.map(d => [toDate(d.date), d]))
  const ssMap   = new Map(ssS.map(d => [toDate(d.date), d]))
  const arbMap  = new Map(arbS.map(d => [toDate(d.date), d]))
  const cotMap  = new Map(cotS.map(d => [d.date, d]))
  const ntMap   = new Map(ntData.map(d => [d.time, d]))

  // Daily refs (ascending → latest at tail; futuresDailyData is descending)
  const nk         = ntData.length > 0 ? ntData[ntData.length - 1] : null
  const fx         = usdjpyData.length > 0 ? usdjpyData[usdjpyData.length - 1] : null
  const nas        = nas100Data.length > 0 ? nas100Data[nas100Data.length - 1] : null
  const latestFut  = futuresDailyData[0] ?? null
  const latestVixD = vixDailyData.length > 0 ? vixDailyData[vixDailyData.length - 1] : null
  const nkCur      = nk ? nk.nikkei : null
  const nkPrices   = ntData.map(d => d.nikkei)

  // ── 外国人フロー累計 ─────────────────────────────
  const invT = (d: InvestorWeekData) => d.foreigner / 1_000_000
  const foreign4w  = r2(invS.slice(0, 4).reduce((s, d) => s + invT(d), 0))
  const foreign13w = r2(invS.slice(0, 13).reduce((s, d) => s + invT(d), 0))
  const foreign26w = r2(invS.slice(0, 26).reduce((s, d) => s + invT(d), 0))
  const rolling4w: number[] = []
  for (let i = 0; i + 3 < invS.length && i < 26; i++) {
    rolling4w.push(invS.slice(i, i + 4).reduce((s, d) => s + invT(d), 0))
  }
  const foreign4wPct = rolling4w.length > 1 ? pctRank(rolling4w.slice(1), rolling4w[0]) : 50

  // ── パーセンタイル ───────────────────────────────
  const creditRatios   = marS.slice(0, 26).map(d => d.ratio)
  const creditRatioPct = creditRatios.length > 1 ? pctRank(creditRatios.slice(1), creditRatios[0]) : 50

  const arbLongs   = arbS.slice(0, 26).map(d => d.longBal / 1_000_000)
  const arbLongPct = arbLongs.length > 1 ? pctRank(arbLongs.slice(1), arbLongs[0]) : 50

  const adRatios = adS.slice(0, 26).map(d => d.ratio25)
  const adPct    = adRatios.length > 1 ? pctRank(adRatios.slice(1), adRatios[0]) : 50

  const ssRatios = ssS.slice(0, 26).map(d => d.ratio)
  const ssPct    = ssRatios.length > 1 ? pctRank(ssRatios.slice(1), ssRatios[0]) : 50

  const cotLfNets = cotS.slice(0, 52).map(d => d.nonCommNet)
  const cotLfPct  = cotLfNets.length > 1 ? pctRank(cotLfNets.slice(1), cotLfNets[0]) : 50
  const cotAmNets = cotS.slice(0, 52).map(d => d.commNet)
  const cotAmPct  = cotAmNets.length > 1 ? pctRank(cotAmNets.slice(1), cotAmNets[0]) : 50

  const vixCloses52 = vixS.slice(0, 52).map(d => d.close)
  const vixPct52w   = vixCloses52.length > 1 ? pctRank(vixCloses52.slice(1), vixCloses52[0]) : 50

  const oiVals20  = futuresDailyData.slice(0, 20).map(d => d.oi)
  const oiPct20   = oiVals20.length > 1 ? pctRank(oiVals20.slice(1), oiVals20[0]) : 50
  const volVals20 = futuresDailyData.slice(0, 20).map(d => d.volume)
  const volPct20  = volVals20.length > 1 ? pctRank(volVals20.slice(1), volVals20[0]) : 50

  const latestPcrEntry = futuresDailyData.find(d => d.pcr != null)
  const latestPcr      = latestPcrEntry?.pcr ?? null
  const pcrVals20      = futuresDailyData.slice(0, 20).filter(d => d.pcr != null).map(d => d.pcr!)
  const pcrPct20       = pcrVals20.length > 1 ? pctRank(pcrVals20.slice(1), pcrVals20[0]) : 50
  const pcrSignal: 'BULL' | 'NEUTRAL' | 'BEAR' = latestPcr != null
    ? latestPcr > 0.90 ? 'BULL' : latestPcr < 0.65 ? 'BEAR' : 'NEUTRAL'
    : 'NEUTRAL'

  // ── 偏差スコア ───────────────────────────────────
  const W = 30
  const fxSeries     = usdjpyData.slice(-W).map(d => d.changePct ?? 0)
  let nasSeries: number[]
  if (nas100Data.length >= MIN_Z) {
    nasSeries = nas100Data.slice(-W).map(d => d.changePct ?? 0)
  } else if (ntData.length >= MIN_Z + 1) {
    const sl = ntData.slice(-Math.min(W + 1, ntData.length))
    nasSeries = sl.slice(1).map((d, i) =>
      sl[i].nikkei > 0 ? r2((d.nikkei - sl[i].nikkei) / sl[i].nikkei * 100) : 0
    )
  } else {
    nasSeries = []
  }
  const vixInvSeries = vixDailyData.slice(-W).map(d => d.close > 0 ? 1 / d.close : 0)
  const oiDeltas: number[] = []
  for (let i = 0; i < Math.min(W, futuresDailyData.length - 1); i++) {
    const cur = futuresDailyData[i], prev = futuresDailyData[i + 1]
    if (prev.oi > 0) oiDeltas.push((cur.oi - prev.oi) / prev.oi * 100)
  }
  const z_usdjpy  = zScore(fxSeries)
  const z_nas100  = zScore(nasSeries)
  const z_vix_inv = zScore(vixInvSeries)
  const z_oi      = zScore(oiDeltas)
  const nas100_source = nas100Data.length >= MIN_Z
    ? 'NAS100(^NDX)'
    : ntData.length >= MIN_Z + 1 ? '日経225(^N225)フォールバック' : null

  function scoreAtOffset(offsetDays: number): number | null {
    function zAt(series: number[], offset: number): number | null {
      const end = series.length - offset
      if (end < MIN_Z) return null
      return zScore(series.slice(0, end))
    }
    const zFx  = zAt(fxSeries,     offsetDays)
    const zNas = zAt(nasSeries,    offsetDays)
    const zVi  = zAt(vixInvSeries, offsetDays)
    const zOi  = zAt(oiDeltas,     offsetDays)
    const components: [number | null, number][] = [
      [zFx, 0.30], [zNas, 0.25], [zVi, 0.20], [zOi, 0.15],
    ]
    const [sum, wt] = components.reduce<[number, number]>(([s, w], [v, ww]) =>
      v != null ? [s + v * ww, w + ww] : [s, w], [0, 0])
    return wt >= 0.30 ? r2(sum / wt * wt) : null
  }
  const score_today = scoreAtOffset(0)
  const score_3d    = scoreAtOffset(3)

  // ── HV・MA・価格帯 ───────────────────────────────
  const hv20          = hvol(nkPrices, 20)
  const hv60          = hvol(nkPrices, 60)
  const vixCurClose   = vixS[0]?.close ?? latestVixD?.close ?? null
  const vixHv20Spread = vixCurClose != null && hv20 != null ? r2(vixCurClose - hv20) : null

  const nkMa5        = maL(nkPrices, 5)
  const nkMa20       = maL(nkPrices, 20)
  const nkMa60       = maL(nkPrices, 60)
  const nkMa200      = maL(nkPrices, 200)
  const nkPrices260  = nkPrices.slice(-260)
  const nkHigh52w    = nkPrices260.length > 0 ? Math.round(Math.max(...nkPrices260)) : null
  const nkLow52w     = nkPrices260.length > 0 ? Math.round(Math.min(...nkPrices260)) : null
  const nkPos52w     = nkCur != null && nkHigh52w != null && nkLow52w != null && nkHigh52w > nkLow52w
    ? r2((nkCur - nkLow52w) / (nkHigh52w - nkLow52w) * 100) : null

  const fxPrices     = usdjpyData.map(d => d.close)
  const fxMa5        = maL(fxPrices, 5)
  const fxMa20       = maL(fxPrices, 20)
  const fxPrices260  = fxPrices.slice(-260)
  const fxHigh52w    = fxPrices260.length > 0 ? r2(Math.max(...fxPrices260)) : null
  const fxLow52w     = fxPrices260.length > 0 ? r2(Math.min(...fxPrices260)) : null

  // ── 先物ベーシス ─────────────────────────────────
  const futClose  = latestFut?.close ?? null
  const basis     = futClose != null && nkCur != null ? r2(futClose - nkCur) : null
  const basisPct  = basis != null && nkCur != null && nkCur > 0 ? r2(basis / nkCur * 100) : null
  const basisNote = basis != null
    ? (basis > 0 ? 'コンタンゴ（先物プレミアム）' : '逆ざや（先物ディスカウント）')
    : '先物清算値データなし'

  // ── シグナルスコアボード ─────────────────────────
  type SigItem = {
    id: string; name: string; category: string; weight: number
    value: number | null; unit: string
    signal: 'BULL' | 'NEUTRAL' | 'BEAR'
    percentile?: number; note?: string
  }
  const usdjpySig: 'BULL' | 'NEUTRAL' | 'BEAR' = z_usdjpy != null
    ? (z_usdjpy > 0.8 ? 'BULL' : z_usdjpy < -0.8 ? 'BEAR' : 'NEUTRAL') : 'NEUTRAL'
  const nasSig: 'BULL' | 'NEUTRAL' | 'BEAR' = z_nas100 != null
    ? (z_nas100 > 0.8 ? 'BULL' : z_nas100 < -0.8 ? 'BEAR' : 'NEUTRAL') : 'NEUTRAL'

  const sigItems: SigItem[] = [
    { id: 'foreign_4w',   name: '外国人4週累計',   category: 'フロー',         weight: 0.25, value: foreign4w,                                         unit: '兆円', signal: sig(foreign4wPct),       percentile: foreign4wPct },
    { id: 'cot_lf_net',   name: 'HF純計(LF)',     category: 'ポジション',     weight: 0.15, value: cotS[0]?.nonCommNet ?? null,                       unit: '枚',   signal: sig(cotLfPct),            percentile: cotLfPct },
    { id: 'credit_ratio', name: '信用倍率',         category: 'ポジション',     weight: 0.15, value: marS[0]?.ratio ?? null,                           unit: '倍',   signal: sig(100 - creditRatioPct), percentile: creditRatioPct, note: '高倍率=BEAR' },
    { id: 'arb_long',     name: '裁定買い残',       category: 'ポジション',     weight: 0.10, value: arbS[0] ? r2(arbS[0].longBal / 1_000_000) : null, unit: '兆円', signal: sig(100 - arbLongPct),    percentile: arbLongPct,   note: '高残高=BEAR' },
    { id: 'ad_25d',       name: '騰落レシオ25日',   category: '市場強度',       weight: 0.08, value: adS[0]?.ratio25 ?? null,                          unit: '',     signal: sig(adPct),               percentile: adPct },
    { id: 'vix',          name: 'VIX',             category: 'ボラティリティ', weight: 0.08, value: vixCurClose,                                       unit: '',     signal: sig(100 - vixPct52w),     percentile: vixPct52w,    note: '高VIX=BEAR' },
    { id: 'short_sell',   name: '空売り比率',       category: '市場強度',       weight: 0.07, value: ssS[0]?.ratio ?? null,                            unit: '%',    signal: sig(100 - ssPct),         percentile: ssPct,        note: '高比率=BEAR' },
    { id: 'pcr',          name: 'PCR',             category: 'オプション',     weight: 0.07, value: latestPcr,                                         unit: '',     signal: pcrSignal,                percentile: pcrPct20 },
    { id: 'usdjpy_z',     name: 'USD/JPY Zスコア', category: 'マクロ',         weight: 0.05, value: z_usdjpy,                                          unit: '',     signal: usdjpySig },
  ]
  const totalW = sigItems.reduce((s, i) => s + i.weight, 0)
  let rawScore = 0
  for (const item of sigItems) rawScore += (item.signal === 'BULL' ? 1 : item.signal === 'BEAR' ? -1 : 0) * item.weight
  const compositeScore  = r2(rawScore / totalW * 100)
  const netSignal: 'BULL' | 'NEUTRAL' | 'BEAR' = compositeScore >= 20 ? 'BULL' : compositeScore <= -20 ? 'BEAR' : 'NEUTRAL'
  const bullIds    = sigItems.filter(i => i.signal === 'BULL').map(i => i.id)
  const bearIds    = sigItems.filter(i => i.signal === 'BEAR').map(i => i.id)
  const neutralIds = sigItems.filter(i => i.signal === 'NEUTRAL').map(i => i.id)

  // ── マーケットレジーム ───────────────────────────
  const vixCur = vixCurClose ?? 0
  const market_regime =
    vixCur > 30          ? '高ボラティリティ（VIX>30）' :
    vixCur > 20          ? '警戒モード（VIX 20-30）' :
    compositeScore >= 20  ? '強気相場' :
    compositeScore <= -20 ? '弱気相場' : '中立・膠着'

  // ── SQ ──────────────────────────────────────────
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const allSq = [...getSqDates(today.getFullYear()), ...getSqDates(today.getFullYear() + 1)]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
  const nextSq         = allSq.find(sq => sq.date > today)
  const days_to_sq     = nextSq ? Math.ceil((nextSq.date.getTime() - today.getTime()) / 86400000) : null
  const vix_iv_proxy   = vixDailyData.length > 0 ? vixDailyData[vixDailyData.length - 1].changePct : null
  const tpi            = days_to_sq && days_to_sq > 0 && vix_iv_proxy != null
    ? r2((1 / days_to_sq) * Math.abs(vix_iv_proxy)) : null
  const sq_rule_current =
    days_to_sq == null ? '通常運用' :
    days_to_sq === 0   ? '原則ノートレ' :
    days_to_sq <= 2    ? 'ポジション縮小' : '通常運用'

  // ── データ品質 ───────────────────────────────────
  const now_ms = Date.now()
  const freshDays = (d: string | null | undefined, maxD: number) =>
    d ? (now_ms - new Date(d).getTime()) / 86400000 < maxD : false
  const tier1 = [
    { name: '日経225',  date: nk?.time ?? null },
    { name: 'USD/JPY', date: fx?.time ?? null },
    { name: 'VIX日次', date: latestVixD?.time ?? null },
    { name: '先物OI',  date: latestFut?.date?.replace(/\//g, '-') ?? null },
    { name: 'NAS100',  date: nas?.time ?? null },
  ]
  const tier2 = [
    { name: 'PCR',       date: latestPcrEntry?.date?.replace(/\//g, '-') ?? null },
    { name: '騰落レシオ', date: adS[0] ? toDate(adS[0].date) : null },
  ]
  const tier3 = [
    { name: '投資主体別', date: invS[0] ? toDate(invS[0].date) : null },
    { name: '信用残高',   date: marS[0] ? toDate(marS[0].date) : null },
    { name: '裁定残高',   date: arbS[0] ? toDate(arbS[0].date) : null },
  ]
  const t1ok = tier1.filter(t => freshDays(t.date, 5)).length
  const t2ok = tier2.filter(t => freshDays(t.date, 10)).length
  const t3ok = tier3.filter(t => freshDays(t.date, 14)).length
  const dqScore = r2((t1ok / tier1.length) * 0.5 + (t2ok / tier2.length) * 0.3 + (t3ok / tier3.length) * 0.2)
  const staleFields = [
    ...tier1.filter(t => !freshDays(t.date, 5)).map(t => t.name),
    ...tier2.filter(t => !freshDays(t.date, 10)).map(t => t.name),
  ]

  // ── OI集積上位3日 ───────────────────────────────
  const oiHeavy3d = futuresDailyData.slice(0, 20)
    .map((d, i) => ({ date: d.date, oi: d.oi, oi_delta: futuresDailyData[i + 1] ? d.oi - futuresDailyData[i + 1].oi : 0 }))
    .sort((a, b) => Math.abs(b.oi_delta) - Math.abs(a.oi_delta))
    .slice(0, 3)

  // ── 週次ヒストリー（26週） ───────────────────────
  const allWeeklyDates = new Set([
    ...invS.map(d => toDate(d.date)),
    ...marS.map(d => toDate(d.date)),
    ...adS.map(d => toDate(d.date)),
    ...ssS.map(d => toDate(d.date)),
    ...arbS.map(d => toDate(d.date)),
  ])
  const weeklyDates = Array.from(allWeeklyDates).sort((a, b) => b.localeCompare(a)).slice(0, EXPORT_WEEKS)
  const weekly_history = weeklyDates.map(date => {
    const inv  = nearKey(invMap, date)
    const mar  = nearKey(marMap, date)
    const ad   = nearKey(adMap,  date)
    const ss   = nearKey(ssMap,  date)
    const arb  = nearKey(arbMap, date)
    const vixW = findVixForDate(vixMapW, date)
    const cot  = nearKey(cotMap, date, 7)
    const nt   = findNtForDate(ntMap, date)
    return {
      date,
      nk_close:        nt   ? Math.round(nt.nikkei)        : null,
      vix:             vixW ? vixW.close                    : null,
      foreign_net_t:   inv  ? r2(inv.foreigner / 1_000_000) : null,
      credit_ratio:    mar  ? mar.ratio                     : null,
      credit_eval_pct: mar  ? mar.evalRatio                 : null,
      credit_long_t:   mar  ? r2(mar.longBal  / 1_000_000) : null,
      arb_long_t:      arb  ? r2(arb.longBal  / 1_000_000) : null,
      cot_lf_net:      cot  ? cot.nonCommNet                : null,
      cot_am_net:      cot  ? cot.commNet                   : null,
      cot_oi:          cot  ? cot.openInterest              : null,
      ad_25d:          ad   ? ad.ratio25                    : null,
      ss_ratio:        ss   ? ss.ratio                      : null,
    }
  })

  // ── 組立 ─────────────────────────────────────────
  const generated_at = new Date().toISOString().slice(0, 19).replace('T', ' ')

  return {
    generated_at,
    market:   { exchange: 'JPX', index: '日経225', type: 'swing_trade' },
    strategy: { timeframe: '週次スイング', direction: 'long/short', leverage: '1x/2x' },

    instant_briefing: {
      date:            nk?.time ?? generated_at.slice(0, 10),
      nikkei225:       nkCur ? Math.round(nkCur) : null,
      usdjpy:          fx?.close ?? null,
      vix:             vixCurClose,
      market_regime,
      bull_signals:    bullIds,
      bear_signals:    bearIds,
      neutral_signals: neutralIds,
      net_signal:      netSignal,
      composite_score: compositeScore,
      data_quality:    dqScore,
      sq_rule:         sq_rule_current,
      days_to_sq,
    },

    signal_scoreboard: {
      items:           sigItems,
      composite_score: compositeScore,
      net_signal:      netSignal,
      regime:          market_regime,
    },

    flows: {
      foreign: {
        latest_week_t:       invS[0] ? r2(invT(invS[0]))    : null,
        cumulative_trillion: { w4: foreign4w, w13: foreign13w, w26: foreign26w },
        percentile_4w_vs26w: foreign4wPct,
        signal:              sig(foreign4wPct),
        as_of:               invS[0] ? toDate(invS[0].date) : null,
      },
      institution: {
        trust_bank_t: invS[0] ? r2(invS[0].trustBank  / 1_000_000) : null,
        securities_t: invS[0] ? r2(invS[0].securities / 1_000_000) : null,
        combined_t:   invS[0] ? r2((invS[0].trustBank + invS[0].securities) / 1_000_000) : null,
        as_of:        invS[0] ? toDate(invS[0].date) : null,
      },
      retail: {
        latest_week_t: invS[0] ? r2(invS[0].individual / 1_000_000) : null,
        as_of:         invS[0] ? toDate(invS[0].date) : null,
      },
      cot: {
        as_of:          cotS[0]?.date ?? null,
        open_interest:  cotS[0]?.openInterest ?? null,
        leveraged_funds: {
          label: 'ヘッジファンド（投機筋）',
          net:   cotS[0]?.nonCommNet   ?? null,
          long:  cotS[0]?.nonCommLong  ?? null,
          short: cotS[0]?.nonCommShort ?? null,
          percentile_52w: cotLfPct,
          signal: sig(cotLfPct),
        },
        asset_manager: {
          label: '機関投資家（実需）',
          net:   cotS[0]?.commNet   ?? null,
          long:  cotS[0]?.commLong  ?? null,
          short: cotS[0]?.commShort ?? null,
          percentile_52w: cotAmPct,
          signal: sig(cotAmPct),
        },
        non_reportable: {
          label: '個人投資家（小口）',
          net:   cotS[0]?.nonReptNet   ?? null,
          long:  cotS[0]?.nonReptLong  ?? null,
          short: cotS[0]?.nonReptShort ?? null,
        },
        lag_note: 'CFTC公表（火曜基準→金曜公開）約3〜4日遅延',
      },
    },

    positioning: {
      credit_margin: {
        ratio:               marS[0]?.ratio     ?? null,
        eval_ratio_pct:      marS[0]?.evalRatio ?? null,
        long_bal_t:          marS[0] ? r2(marS[0].longBal  / 1_000_000) : null,
        short_bal_t:         marS[0] ? r2(marS[0].shortBal / 1_000_000) : null,
        ratio_percentile_26w: creditRatioPct,
        signal:              sig(100 - creditRatioPct),
        as_of:               marS[0] ? toDate(marS[0].date) : null,
      },
      arbitrage: {
        long_bal_t:     arbS[0] ? r2(arbS[0].longBal  / 1_000_000) : null,
        short_bal_t:    arbS[0] ? r2(arbS[0].shortBal / 1_000_000) : null,
        percentile_26w: arbLongPct,
        signal:         sig(100 - arbLongPct),
        as_of:          arbS[0] ? toDate(arbS[0].date) : null,
        daily_recent:   arbDailyData.slice(0, 7).map(d => ({
          date:       d.date,
          long_bal_t: r2(d.longBal / 1_000_000),
          delta_100m: d.longBalDelta != null ? Math.round(d.longBalDelta / 100) : null,
        })),
      },
    },

    futures: {
      oi:                    latestFut?.oi     ?? null,
      oi_percentile_20d:     oiPct20,
      volume:                latestFut?.volume ?? null,
      volume_percentile_20d: volPct20,
      pcr:                   latestPcr,
      pcr_percentile_20d:    pcrPct20,
      pcr_signal:            pcrSignal,
      close:                 futClose,
      basis,
      basis_pct:             basisPct,
      basis_note:            basisNote,
      as_of:                 latestFut?.date ?? null,
      oi_heavy_3d:           oiHeavy3d,
      recent_20d:            futuresDailyData.slice(0, 20).map((d, i) => {
        const prev = futuresDailyData[i + 1]
        return {
          date:     d.date,
          oi:       d.oi,
          oi_delta: prev ? d.oi - prev.oi : null,
          volume:   d.volume,
          pcr:      d.pcr ?? null,
          close:    d.close ?? null,
        }
      }),
      // NK=F (CME 日経225先物・円建て連続限月) 直近10取引日 OHLCV
      nk_futures_ohlcv_10d:  [...nkFuturesPriceData].reverse(),
    },

    breadth: {
      advance_decline_25d: {
        value:          adS[0]?.ratio25 ?? null,
        percentile_26w: adPct,
        signal:         sig(adPct),
        as_of:          adS[0] ? toDate(adS[0].date) : null,
        note:           '120以上=過熱・80以下=売られすぎ',
      },
      short_sell: {
        value:          ssS[0]?.ratio ?? null,
        percentile_26w: ssPct,
        signal:         sig(100 - ssPct),
        as_of:          ssS[0] ? toDate(ssS[0].date) : null,
        note:           '高比率=ベア（逆転シグナル）',
      },
      nt_ratio: {
        value:      nk ? r2(nk.ratio) : null,
        wow_change: nk?.change ?? null,
        as_of:      nk?.time  ?? null,
      },
    },

    volatility: {
      vix: {
        daily:  latestVixD ? { date: latestVixD.time, close: latestVixD.close, change_pct: latestVixD.changePct } : null,
        weekly: vixS[0] ? {
          date:           toDate(vixS[0].date),
          close:          vixS[0].close,
          change:         vixS[0].change,
          change_pct:     vixS[0].changePct,
          percentile_52w: vixPct52w,
          signal:         sig(100 - vixPct52w),
          regime:         vixCur > 30 ? '恐慌' : vixCur > 20 ? '警戒' : '平常',
        } : null,
      },
      hv: {
        hv20_annualized_pct: hv20,
        hv60_annualized_pct: hv60,
        vix_hv20_spread:     vixHv20Spread,
        interpretation:      vixHv20Spread != null
          ? vixHv20Spread > 5  ? 'VIXプレミアム高・オプション割高'
          : vixHv20Spread < -2 ? 'リアライズドVol高・市場不安定'
          : '適正レンジ'
          : null,
      },
    },

    macro: {
      usdjpy: {
        date:        fx?.time  ?? null,
        close:       fx?.close ?? null,
        ma5:         fx?.ma5   ?? null,
        ma5_dev_pct: fx?.ma5dev ?? null,
        z_score_30d: z_usdjpy,
        signal:      usdjpySig,
      },
      nas100: {
        date:        nas?.time      ?? null,
        close:       nas?.close     ?? null,
        change_pct:  nas?.changePct ?? null,
        z_score_30d: z_nas100,
        source:      nas100_source,
        signal:      nasSig,
      },
      sp500_nikkei_ratio: nk ? r2(nk.sp500 / nk.nikkei) : null,
    },

    price_structure: {
      nikkei225: {
        current:      nkCur ? Math.round(nkCur) : null,
        ma5:          nkMa5,
        ma20:         nkMa20,
        ma60:         nkMa60,
        ma200:        nkMa200,
        ma5_dev_pct:  nkMa5  && nkCur ? r2((nkCur - nkMa5)  / nkMa5  * 100) : null,
        ma20_dev_pct: nkMa20 && nkCur ? r2((nkCur - nkMa20) / nkMa20 * 100) : null,
        ma60_dev_pct: nkMa60 && nkCur ? r2((nkCur - nkMa60) / nkMa60 * 100) : null,
        high_52w:     nkHigh52w,
        low_52w:      nkLow52w,
        pos_in_52w_pct: nkPos52w,
      },
      usdjpy: {
        current:      fx?.close ?? null,
        ma5:          fxMa5,
        ma20:         fxMa20,
        ma5_dev_pct:  fxMa5 && fx ? r2((fx.close - fxMa5)  / fxMa5  * 100) : null,
        ma20_dev_pct: fxMa20 && fx ? r2((fx.close - fxMa20) / fxMa20 * 100) : null,
        high_52w:     fxHigh52w,
        low_52w:      fxLow52w,
      },
    },

    deviation_score: {
      z_usdjpy,
      z_nas100,
      z_vix_inv,
      z_oi,
      nas100_source,
      score:       score_today,
      acc:         score_today != null && score_3d != null ? r2(score_today - score_3d) : null,
      window_days: W,
    },

    events: {
      sq: {
        next_date:      nextSq ? nextSq.date.toISOString().slice(0, 10) : null,
        next_type:      nextSq?.type ?? null,
        days_remaining: days_to_sq,
        rule:           sq_rule_current,
        tpi,
        tpi_note:       'TPI=(1/SQ残日数)×|VIX日次変化率|',
        iv_proxy:       vix_iv_proxy,
      },
      scheduled_28d: getUpcomingEvents(28),
    },

    data_quality: {
      score:        dqScore,
      tier1_daily:  { items: tier1, ok: t1ok, total: tier1.length, max_age_days: 5 },
      tier2_semi:   { items: tier2, ok: t2ok, total: tier2.length, max_age_days: 10 },
      tier3_weekly: { items: tier3, ok: t3ok, total: tier3.length, max_age_days: 14 },
      stale_fields: staleFields,
    },

    weekly_history,
  }
}

// ── AI 分析プロンプトテンプレート ─────────────────
const AI_PROMPT_TEMPLATE = `# Role
あなたは価格変動を「需給の質量（重力）」と「市場の呼吸（循環）」として解析する、スイングトレード（ブル・ベア1倍/2倍）専用の需給物理解析OS「ぽいロボ エンジン」です。
小難しい分析に逃げることを禁じ、市場を「エネルギーの蓄積・限界・放出」という物理現象としてのみ捉え、客観的な【需給物理・執行ログ】をコードブロック内に出力せよ。

# 分析の4大原則：需給の物理法則
1. 質量の法則（重力）：信用・裁定買い残は「物理的な負債」であり、浮力が消えた瞬間に自由落下を開始する「質量」である。
2. 弾性の法則（復元）：乖離はラバーバンドである。極限まで伸びた後、元の位置へ戻ろうとする「復元力」は最大化する。
3. 呼吸の法則（循環）：市場は吸気（蓄積）と呼気（清算）を繰り返す。現在の過熱から、いつ「吐き出す」かを射抜け。
4. 慣性の法則（推進）：強い外部エネルギー（ファンドの継続的な偏り等）が加わる際、ラバーバンドは「引き戻し」を拒否し、限界付近で粘り続ける（バンドウォーク）。この時、復元力の判定を一時停止し、慣性が切れる「エネルギーの枯渇」を監視せよ。

# スイング解析の物理定義
- 解析射程：週足・日足の慣性を主軸とし、2日から2週間程度のスイング波動を物理的射程とする。
- 事象の地平線：SQ（特別清算指数）は、蓄積された全エネルギーが強制放出される「事象の地平線」である。残日数に応じたロールオーバー（乗り換え）圧力を重力計算に含めよ。

# 執行の確信度と資金配分ルール
- 30-50% [打診執行]：物理的予兆（乖離限界など）に基づく「先回り」。トレンド転換の確証はないが、有利な位置を確保するための少量エントリー。
- 60-90% [本命執行]：物理的トレンド（節目割れ・MA突破）の確定。または「慣性の法則」に基づくトレンド継続の追随。
- 91%以上 [確信執行]：需給崩壊（強制決済の連鎖）または「慣性の加速」が発生。ファンドの純計と需給バランスが同一方向に共振した時のみ許される。

# 出力形式：
必ず以下の構成で、黒背景のコードブロック内に全てを出力すること。

---
## 需給物理・執行ログ：[日付]
### 【1. 市場の状態診断】
- ステータス：[ 限界膨張 / 重力反転中 / 真空落下 / 底打ち反転 / 慣性航行中 ]
- 質量負荷：(信用・裁定の合算状況と重力評価を物理的に記述)
- 復元力：(平均回帰の必然性とラバーバンドの伸び状況を記述)
- 推進力（慣性）：(ファンド純計やHVを元に、バンドウォークの継続性を物理的に記述)

### 【2. 本質的結論】
- スイングトレードの視点から、現在の「呼吸（サイクル）」がどこにあるのかを簡潔に総括。

### 【3. 最終執行指令】
- 指令：[ ベア本命執行 / ブル打診買い / 全力待機 / 利益最大化保持 等 ]
- 確信度：(0-100%)

#### ■ ブル（1倍・2倍）
- 判定：(購入禁止 / 打診 / 本命 / 継続保持)
- 物理的根拠：

#### ■ ベア（1倍・2倍）
- 判定：(購入禁止 / 打診 / 本命 / 継続保持)
- 物理的根拠：

---

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
            ぽいロボ エンジン
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Gemini */}
              <a
                href="https://gemini.google.com/app"
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...ms.aiCard, flex: 'none', width: '100%' }}
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
                style={{ ...ms.aiCard, flex: 'none', width: '100%' }}
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
                style={{ ...ms.aiCard, flex: 'none', width: '100%' }}
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

  const [nas100Data,   setNas100Data]   = useState<Nas100DayData[]>([])
  const [nas100Loaded, setNas100Loaded] = useState(false)

  const [nkFuturesPriceData,   setNkFuturesPriceData]   = useState<NkFuturesDayData[]>([])
  const [nkFuturesPriceLoaded, setNkFuturesPriceLoaded] = useState(false)

  const [vixDailyData,   setVixDailyData]   = useState<VixDayData[]>([])
  const [vixDailyLoaded, setVixDailyLoaded] = useState(false)

  const [futuresDailyData,   setFuturesDailyData]   = useState<FuturesDayData[]>([])
  const [futuresDailyLoaded, setFuturesDailyLoaded] = useState(false)
  const [futuresDailyLoading, setFuturesDailyLoading] = useState(false)
  const [futuresDailyError,   setFuturesDailyError]   = useState('')

  const [cotData,          setCotData]          = useState<CotNikkeiWeekData[]>([])
  const [cotLoading,       setCotLoading]       = useState(false)
  const [cotError,         setCotError]         = useState('')
  const [cotLoaded,        setCotLoaded]        = useState(false)

  const [ntData, setNtData] = useState<NtRatioPoint[]>([])
  const handleNtDataLoaded = useCallback((d: NtRatioPoint[]) => {
    setNtData(d)
  }, [])

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

  const loadNas100 = useCallback(async () => {
    try { setNas100Data(await fetchNas100Data()); setNas100Loaded(true) }
    catch { /* エラー時は空配列のまま */ }
  }, [])

  const loadNkFuturesPrice = useCallback(async () => {
    try { setNkFuturesPriceData(await fetchNkFuturesPriceData()); setNkFuturesPriceLoaded(true) }
    catch { /* エラー時は空配列のまま */ }
  }, [])

  const loadVixDaily = useCallback(async () => {
    try { setVixDailyData(await fetchVixDailyData()); setVixDailyLoaded(true) }
    catch { /* エラー時は空配列のまま */ }
  }, [])

  const loadCot = useCallback(async (force = false) => {
    setCotLoading(true); setCotError('')
    try { setCotData(await fetchCotNikkeiData(force)); setCotLoaded(true) }
    catch (e) { setCotError(e instanceof Error ? e.message : 'データ取得エラー') }
    finally { setCotLoading(false) }
  }, [])

  useEffect(() => { if (!invLoaded)  loadInvestor() }, [invLoaded,  loadInvestor])
  useEffect(() => { if (!cotLoaded)  loadCot()      }, [cotLoaded,  loadCot])
  useEffect(() => { if (!marLoaded)     loadMargin()        }, [marLoaded,     loadMargin])
  useEffect(() => { if (!vixWeekLoaded) loadVixWeek()       }, [vixWeekLoaded, loadVixWeek])
  useEffect(() => { if (!adLoaded)      loadAdvanceDecline()}, [adLoaded,      loadAdvanceDecline])
  useEffect(() => { if (!ssLoaded)      loadShortSell()     }, [ssLoaded,      loadShortSell])
  useEffect(() => { if (!arbLoaded)     loadArbitrage()     }, [arbLoaded,     loadArbitrage])
  useEffect(() => { if (!arbDailyLoaded)  loadArbDaily()     }, [arbDailyLoaded,  loadArbDaily])
  useEffect(() => { if (!usdjpyLoaded)    loadUsdjpy()       }, [usdjpyLoaded,    loadUsdjpy])
  useEffect(() => { if (!nas100Loaded)         loadNas100()          }, [nas100Loaded,         loadNas100])
  useEffect(() => { if (!nkFuturesPriceLoaded) loadNkFuturesPrice()  }, [nkFuturesPriceLoaded, loadNkFuturesPrice])
  useEffect(() => { if (!vixDailyLoaded)       loadVixDaily()        }, [vixDailyLoaded,        loadVixDaily])
  useEffect(() => { if (!futuresDailyLoaded) loadFuturesDaily() }, [futuresDailyLoaded, loadFuturesDaily])

  const handlePromptCopy = useCallback(async () => {
    const json = JSON.stringify(buildExportJson(invData, marData, vixWeekData, ntData, adData, ssData, arbData, cotData, arbDailyData, usdjpyData, futuresDailyData, nas100Data, vixDailyData, nkFuturesPriceData), null, 2)
    await copyText(AI_PROMPT_TEMPLATE + json)
    setCopyStatus('prompt')
    setTimeout(() => setCopyStatus(''), 2000)
  }, [invData, marData, vixWeekData, ntData, adData, ssData, arbData, cotData, arbDailyData, usdjpyData, futuresDailyData, nas100Data, vixDailyData, nkFuturesPriceData])

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
          cotData={cotData}
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
              data={cotData}
              loading={cotLoading}
              error={cotError}
              onReload={() => loadCot(true)}
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
