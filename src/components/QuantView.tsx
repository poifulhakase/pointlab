import { useState, useEffect, useCallback } from 'react'
import type React from 'react'
import type { User } from 'firebase/auth'
import { themeVars } from '../utils/themeVars'
import { fetchInvestorData, type InvestorWeekData } from '../utils/jpxInvestorData'
import { fetchMarginData, getStoredMarginUpdatedAt, type MarginWeekData } from '../utils/jpxMarginData'
import { fetchVixData, type VixWeekData } from '../utils/vixData'
import { fetchNhkNews, type NhkNewsItem } from '../utils/nhkNews'
import { getMacroEventsForDate, MACRO_META } from '../utils/macroCalendar'
import { getSqDates, getSqMarkersForDate, SQ_META } from '../utils/sqCalendar'
import { getNote, saveNote } from '../utils/noteStorage'
import { fetchAdvanceDeclineData, type AdvanceDeclineWeekData } from '../utils/advanceDeclineData'
import { fetchShortSellData, type ShortSellWeekData } from '../utils/shortSellData'
import { fetchArbitrageData, type ArbitrageWeekData } from '../utils/arbitrageData'
import { fetchFuturesParticipantsData, computeMicroVectors, type FuturesParticipantDayData } from '../utils/futuresParticipantsData'
import { VixPanel } from './VixPanel'
import { NtRatioPanel } from './NtRatioPanel'
import { MicroQuantView } from './MicroQuantView'
import { DeltaModal, type DeltaModalType } from './DeltaModal'
import type { NtRatioPoint } from '../utils/ntRatioData'
import { FuturesOiPanel } from './FuturesOiPanel'

type Props = { theme: 'dark' | 'light'; isMobile: boolean; user: User | null }

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
  return Array.from(allDates)
    .sort((a, b) => b.localeCompare(a))
    .map(date => {
      const ss  = ssMap.get(date)
      const ad  = adMap.get(date)
      const arb = arbMap.get(date)
      return {
        date,
        label: (ss ?? ad ?? arb)?.label ?? '',
        shortSell:   ss  ? ss.ratio    : null,
        adRatio:     ad  ? ad.ratio25  : null,
        arbLongBal:  arb ? arb.longBal  : null,
        arbShortBal: arb ? (arb.shortBal > 0 ? arb.shortBal : null) : null,
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
) {
  const invMap = new Map(invData.map(d => [toDate(d.date), d]))
  const marMap = new Map(marData.map(d => [toDate(d.date), d]))
  const vixMap = new Map(vixData.map(d => [toDate(d.date), d]))
  const ntMap  = new Map(ntData.map(d => [d.time, d]))
  const adMap  = new Map(adData.map(d => [toDate(d.date), d]))
  const ssMap  = new Map(ssData.map(d => [toDate(d.date), d]))
  const arbMap = new Map(arbData.map(d => [toDate(d.date), d]))

  const allDates = new Set([...invMap.keys(), ...marMap.keys(), ...vixMap.keys()])

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
    .filter(r => r.vix.value !== 0 || r.flows.foreign !== 0 || r.credit_ratio !== 0)

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

  // 各指標の時間軸を明示（AIが時間軸のズレを誤解しないように）
  const data_freshness = {
    note: '各指標は公表タイミングが異なります。週次指標と日次指標を混同しないでください。',
    nikkei225:          { data_as_of: nk?.time ?? null,                        frequency: '日次', lag_note: 'Yahoo Finance・約15分遅延' },
    vix:                { data_as_of: vix_latest?.date ?? null,                 frequency: '週次', lag_note: '週末終値ベース' },
    futures_hand:       { data_as_of: participantsData[0]?.date ?? null,        frequency: '日次', lag_note: 'JPX翌営業日公表' },
    investor_flows:     { data_as_of: toDate(invData[0]?.date ?? '') || null,   frequency: '週次', lag_note: '約1週間遅延' },
    credit_ratio:       { data_as_of: toDate(marData[0]?.date ?? '') || null,   frequency: '週次', lag_note: '約1週間遅延' },
    short_sell_ratio:   { data_as_of: toDate(ssData[0]?.date  ?? '') || null,   frequency: '週次', lag_note: '約1週間遅延' },
    advance_decline:    { data_as_of: toDate(adData[0]?.date  ?? '') || null,   frequency: '週次', lag_note: '約1週間遅延' },
    arbitrage_balance:  { data_as_of: toDate(arbData[0]?.date ?? '') || null,   frequency: '週次', lag_note: '約1週間遅延' },
  }

  return {
    meta: { market: 'JP', index: 'Nikkei225', type: 'swing' },
    data_freshness,
    upcoming_events: getUpcomingEvents(28),
    recent_news: newsData.map(n => ({ title: n.title, pubDate: n.pubDate, description: n.description })),
    vix_latest,
    nikkei225_latest,
    micro_supply_demand,
    data: rows,
  }
}

// ── AI 分析プロンプトテンプレート ─────────────────
const AI_PROMPT_TEMPLATE = `# 🛡️ シニア・クオンツ・ストラテジスト：需給解析エンジン (Ver. 99)

# 役割定義
あなたは、機関投資家向けレポートを作成する「シニア・クオンツ・ストラテジスト」です。
目的は、市場の「物理的な重力（需給）」を可視化し、ユーザーがテクニカル指標でエントリーするための戦略的バイアスを提供することです。
チャートの形状よりも、「2日〜14日程度のスイングトレード」期間内に発生する、売買の質量（強制決済）の波及に特化して分析せよ。

# 🔴 最重要判定：加速フェーズ検知ロジック（高精度・最終形態）

以下の3条件を厳密に評価し、**2条件以上の成立、または①が「極大かつ加速」の場合に「加速フェーズ発動」**と断定せよ。

■ 判定条件
① 【ミクロ需給の極大・加速（実弾の加速度）】
   - Gravity (SG+Barclays+BNP) のネット枚数が絶対値で 6,000枚を超過
   - かつ、その絶対値が前日比で「増加」していること（＝投げ/踏みの加速）
   - ※上記成立で「強シグナル」

② 【先物OIのエネルギー解析（ポジションの歪み）】
   - 価格と逆方向にOI（建玉）が前日比 3.0%以上増加 → 「強シグナル」
   - 価格と同方向にOI（建玉）が前日比 3.0%以上増加 かつ ①が同一方向 → 「弱シグナル」

③ 【ボラティリティ・乖離率の拡大検知（速度変化）】
   - VIXが前日比 +5.0%以上
   - または、5日移動平均乖離率が ±3.0%を超過し、かつ「前日より乖離が拡大」していること

■ 判定ルール
- 2条件以上成立（または①強が単独成立）→ 「加速フェーズ：発動」と断定。
- 確信度補正: 発動時は一律 +10% 加算。①と②（強）が同時成立した場合は最大 +15% 加算。
- 曖昧な表現は禁止。必ず「発動 / 未発動」を明記すること。

# 🛡️ 最終執行トリガー（誤発動防止フィルター）

加速フェーズ判定後、以下のフィルターを適用して「戦術指示」を決定せよ。

1. 【時間フィルター】
   - 発動後、次の1セッション（翌日寄り〜前場）内で価格が判定方向に進行しない場合、シグナルを「ダマシ」と断定し、戦略を【静観】に格下げせよ。
2. 【価格確認フィルター】
   - 直近3営業日の高値/安値（バイアス方向）を終値ベースでブレイクするまでは、エントリー許可状態を【待機】とせよ。ブレイクで初めて【許可】へ移行。

# ⚡️ 意思決定の閾値（オーナー基準）
あなたの算出する「確信度」は、以下のユーザー行動に直結する。1%単位で厳密に判定せよ。
- **59%以下**: 「見送り（静観）」。需給の優位性がノイズに消されるレベル。
- **60%〜69%**: 「打診開始」。エッジが確認された臨界点。
- **70%超**: 「勝負圏」。需給の歪みが決定的であり、本玉を検討する局面。
※確信度が1%変化した際は、必ずその物理的根拠（どのデータがどう動いたか）を添えること。

# 分析アルゴリズム（優先順位）
0. **週次ミクロ需給ベクトル（執行のトリガー）**:
   - 以下の3指標を「事象」の核として、マクロ環境との不整合を特定せよ。
   - **スマートマネー (外国人+信託銀行)**: 海外勢と年金/信託のコンセンサス。マクロの方向性と一致しているか？
   - **機関投資家フロー (生命保険+投資信託)**: 大口機関の「実弾」。ここが大幅マイナスの時は本格的な売りが始まったと判定。
   - **個人/証券 (個人+証券会社)**: 目先の反発やヘッジ。これがプラスでも他がマイナスなら「ダマシ」と断定せよ。
1. **スイング期間内の需給重力（物理限界の測定）**:
   - **裁定買い残**: 3.5兆円超を「臨界点（暴落リスク）」、2.0兆円以下を「整理完了」と定義。
   - **信用買い残**: 倍率2.5倍を閾値とし、2週間以内の反発局面で「戻り売り」として降ってくる価格帯を特定。
2. **市場の歪みと過熱感（反転の予兆）**:
   - **空売り比率**: 35%未満を「楽観過熱（支えなし）」、45%超を「踏み上げ予兆」と判定。
   - **騰落レシオ**: 120%超での指数上昇を「最終局面」と判定。スイング期間内での反転確率を評価。
3. **SQ・清算イベントの構造的解析**:
   - 直近の「SQ（特別清算指数）算出日」を特定せよ。
   - SQまで14日以内、かつ裁定買い残が3.0兆円を超えている場合、メインシナリオを「解消（アンワインド）」に固定。
4. **ボラティリティ・ガード**:
   - VIXの急騰（前日比+10%以上、または20超への突入）を、トレンド転換の起爆剤として監視。
5. **動的ベクトル解析（Δの測定）**:
   - **先物OIの変化率**: 価格上昇＋OI増加は「本気の買い」、価格上昇＋OI減少は「ショートカバー（燃料切れ間近）」と自動判定せよ。
   - **需給の乖離ベクトル**: 裁定買い残の前週比変化を算出し、価格推移との「逆行（ダイバージェンス）」が発生していないか監視せよ。
   - **ボラティリティの加速**: VIXの「値」だけでなく、「上昇スピード（前日比％）」が価格の下落スピードを上回った場合、強制決済の連鎖を警告せよ。

# 💡 出力形式（Markdownコードブロック内のみ）
※回答はすべて、リスク管理部門にコピペしやすいよう、一つのMarkdownコードブロック（\`\`\`）の中に含めて出力すること。枠の外には挨拶や解説を一切書かないこと。

■ 加速フェーズ判定
・判定結果: 【発動 / 未発動】
・成立条件: ①実弾加速 [成立/未成立] ②OI歪み [強/弱/不成立] ③速度変化 [成立/未成立]
・確信度補正: [+X% / 補正なし]
・判定根拠: （各条件の具体的な数値とその判定理由を一行で明記）

■ 戦略展望（2日〜14日のバイアス）
（強気 / 弱気 / 警戒）
※確信度は補正後の最終値を1%単位で算出。冒頭に加速判定の結果を再記。

■ 事象分析：ミクロ需給ベクトル（週次）
・Trend (外国人+信託銀行): [ベクトルと枚数]
・Gravity (生命保険+投資信託): [ベクトルと枚数]
・Noise (個人+証券会社): [ベクトルと枚数]
※判定：マクロ環境に対し、ミクロ（実弾）が「順張り」か「逆行」かを明記。

■ 需給分析：物理的重力の測定
（裁定買い残、信用残、空売り比率から見た「売買の偏り」の解説）

■ 戦術指示（テクニカル連携用）
・エントリー許可状態: 【許可 / 待機 / 禁止】（最終執行トリガーを適用）
・バイアス: （例：戻り売り推奨 / 押し目買い厳禁 等）
・需給の壁（上値）: （具体的な価格帯）
・需給の底（目標）: （具体的な価格帯）
・撤退条件: （この価格を抜け、かつこのデータが変わったらシナリオ破棄）

■ 構造的リスクとイベント
（SQ日、重要指標など、スイング期間内の流動性インパクトを特定）

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
        position: 'fixed', inset: 0, zIndex: 399,
        background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)',
        opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none',
        transition: 'opacity 0.18s',
      }} onClick={onClose} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', zIndex: 400,
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            需給 設定
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
            <p style={ms.desc}>GeminiまたはClaudeにそのまま貼り付けて使用できます。</p>
            <div style={ms.promptPreview}>
              <span style={{ color: 'var(--text-sub)' }}>需給解析エンジン（スイング特化）</span>
              <br />
              <span style={{ color: 'var(--text-dim)' }}>確信度70%超=勝負圏 / 裁定3.5兆円臨界 / SQアンワインド判定…</span>
            </div>
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
            <div style={{ display: 'flex', gap: 10 }}>

              {/* Gemini */}
              <a
                href="https://gemini.google.com/app"
                target="_blank"
                rel="noopener noreferrer"
                style={ms.aiCard}
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
    flex: 1, display: 'flex', alignItems: 'center', gap: 10,
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
  icon, title, sub, dateRange, loading, onReload,
}: {
  icon: React.ReactNode
  title: string
  sub: string
  dateRange?: string
  loading: boolean
  onReload: () => void
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
        <button style={s.reloadBtn} onClick={onReload} disabled={loading} title="再取得">
          <svg
            width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
            style={{ transform: loading ? 'rotate(360deg)' : undefined, transition: loading ? 'transform 1s linear infinite' : undefined }}
          >
            <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          {loading ? '取得中…' : '更新'}
        </button>
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
export function QuantView({ theme, isMobile, user }: Props) {
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

  const [participantsData,    setParticipantsData]    = useState<FuturesParticipantDayData[]>([])
  const [participantsLoading, setParticipantsLoading] = useState(false)
  const [participantsError,   setParticipantsError]   = useState('')
  const [participantsLoaded,  setParticipantsLoaded]  = useState(false)

  const [ntData, setNtData] = useState<NtRatioPoint[]>([])
  const [ntLoaded, setNtLoaded] = useState(false)
  const handleNtDataLoaded = useCallback((d: NtRatioPoint[]) => {
    setNtData(d)
    setNtLoaded(true)
  }, [])

  const [nhkNews, setNhkNews] = useState<NhkNewsItem[]>([])

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [copyStatus,   setCopyStatus]   = useState<'' | 'prompt'>('')
  const [quantTab,    setQuantTab]    = useState<'kankyou' | 'macro' | 'micro'>('kankyou')
  const [deltaModal,  setDeltaModal]  = useState<DeltaModalType | null>(null)

  // スマホ用テーブル展開状態（デフォルト: 折りたたみ）
  const [marExpanded,      setMarExpanded]      = useState(false)
  const [invExpanded,      setInvExpanded]      = useState(false)
  const [combinedExpanded, setCombinedExpanded] = useState(false)
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

  useEffect(() => {
    fetchNhkNews().then(setNhkNews).catch(() => {})
  }, [])

  // NTデータ未ロード時のフォールバック: 10秒後に強制的にntLoadedをtrueにする
  useEffect(() => {
    const t = setTimeout(() => setNtLoaded(true), 10000)
    return () => clearTimeout(t)
  }, [])

  const AUTO_PROMPT_KEY = 'poical-auto-prompt-last-added'
  useEffect(() => {
    if (!invLoaded || !marLoaded || !vixWeekLoaded || !arbLoaded || !ntLoaded) return
    const updatedAt = getStoredMarginUpdatedAt()
    if (!updatedAt) return
    if (localStorage.getItem(AUTO_PROMPT_KEY) === updatedAt) return
    const json = JSON.stringify(buildExportJson(invData, marData, vixWeekData, nhkNews, ntData, adData, ssData, arbData, participantsData), null, 2)
    const promptText = '# クオンツ分析レポート\n\n' + AI_PROMPT_TEMPLATE + json
    const today = new Date()
    const existing = getNote(today)
    const newMemo = existing.memo.trim()
      ? existing.memo + '\n\n---\n\n' + promptText
      : promptText
    saveNote(today, { ...existing, memo: newMemo })
    localStorage.setItem(AUTO_PROMPT_KEY, updatedAt)
  }, [invLoaded, marLoaded, vixWeekLoaded, ntLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePromptCopy = useCallback(async () => {
    const json = JSON.stringify(buildExportJson(invData, marData, vixWeekData, nhkNews, ntData, adData, ssData, arbData, participantsData), null, 2)
    await copyText(AI_PROMPT_TEMPLATE + json)
    setCopyStatus('prompt')
    setTimeout(() => setCopyStatus(''), 2000)
  }, [invData, marData, vixWeekData, nhkNews]) // eslint-disable-line react-hooks/exhaustive-deps

  const tv = themeVars(theme)

  // モバイル向けテーブルスタイル（横スクロールなし・パディング縮小・ヘッダー折り返し許可）
  const mTblWrap  = isMobile
    ? { ...s.tableWrap, overflowX: 'hidden' as const, overflowY: 'visible' as const, flex: 'none' as const }
    : s.tableWrap
  const mTh       = isMobile ? { ...s.th, padding: '6px 5px', whiteSpace: 'normal' as const, fontSize: 10 } : s.th
  const mTd       = isMobile ? { ...s.td, padding: '6px 5px', fontSize: 11 } : s.td
  const mThDate   = isMobile ? { ...s.th, ...s.thDate, padding: '6px 5px', width: 52, minWidth: 52, whiteSpace: 'normal' as const, fontSize: 10 } : { ...s.th, ...s.thDate }
  const mTdDate   = isMobile ? { ...s.td, ...s.tdDate, padding: '6px 5px', width: 52, minWidth: 52 } : { ...s.td, ...s.tdDate }

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
          theme={theme}
          onClose={() => setDeltaModal(null)}
        />
      )}
      {/* ── 上部タイトルバー ── */}
      <div style={s.topBar} className="glass">
        <div style={s.quantTabGroup} className="glass">
          <button
            style={{ ...s.quantTab, ...(quantTab === 'kankyou' ? s.quantTabActive : {}) }}
            onClick={() => setQuantTab('kankyou')}
          >環境</button>
          <button
            style={{ ...s.quantTab, ...(quantTab === 'macro' ? s.quantTabActive : {}) }}
            onClick={() => setQuantTab('macro')}
          >マクロ需給</button>
          <button
            style={{ ...s.quantTab, ...(quantTab === 'micro' ? s.quantTabActive : {}) }}
            onClick={() => setQuantTab('micro')}
          >ミクロ需給</button>
        </div>
        <div style={{ flex: 1 }} />
        <button style={s.gearBtn} onClick={() => setSettingsOpen(true)} aria-label="設定">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>

      {/* ── ボディ ── */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* スライダートラック */}
        <div style={{
          display: 'flex',
          width: '300%',
          height: '100%',
          transform: quantTab === 'kankyou' ? 'translateX(0)' : quantTab === 'macro' ? 'translateX(-33.333333%)' : 'translateX(-66.666667%)',
          transition: 'transform 0.25s ease',
        }}>

        {/* ━━ 環境 ━━ */}
        <div style={{
          width: '33.333333%',
          flexShrink: 0,
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          height: '100%',
          overflowY: isMobile ? 'auto' : 'hidden',
        }}>

        {/* VIX */}
        <div style={isMobile ? s.panelMobile : s.panel}>
          <div style={s.panelHead}>
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
          <div style={s.panelHead}>
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

        {/* 信用倍率 */}
        <div style={isMobile ? s.panelMobile : s.panel}>
          <PanelHeader
            icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>}
            title="信用倍率"
            sub="2市場計（週次）"
            dateRange={marData.length > 0 ? `${marData[marData.length - 1]?.date} 〜 ${marData[0]?.date}` : undefined}
            loading={marLoading}
            onReload={() => loadMargin(true)}
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
                          {!isMobile && <button onClick={() => setDeltaModal('credit_long')} title="信用買い残 Δ分析" style={s.deltaBtn}>Δ</button>}
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

        </div>{/* /環境 */}

        {/* ━━ マクロ需給 ━━ */}
        <div style={{
          width: '33.333333%',
          flexShrink: 0,
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          height: '100%',
          overflowY: isMobile ? 'auto' : 'hidden',
        }}>

        {/* 先物OI */}
        <div style={isMobile ? s.panelMobile : s.panel}>
          <FuturesOiPanel
            data={participantsData}
            loading={participantsLoading}
            error={participantsError}
            onReload={() => loadParticipants(true)}
            theme={theme}
            isMobile={isMobile}
          />
        </div>

        <div style={isMobile ? s.dividerH : s.divider} />

        {/* 投資主体別売買動向 */}
        <div style={isMobile ? s.panelMobile : s.panel}>
          <PanelHeader
            icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="17" cy="8" r="3"/><circle cx="7" cy="16" r="3"/><path d="M14 8H7M17 11v5"/></svg>}
            title="投資主体別売買動向"
            sub="差引金額（百万円）"
            dateRange={invData.length > 0 ? `${invData[invData.length - 1]?.date} 〜 ${invData[0]?.date}` : undefined}
            loading={invLoading}
            onReload={() => loadInvestor(true)}
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

        <div style={isMobile ? s.dividerH : s.divider} />

        {/* 需給指標 */}
        <div style={isMobile ? s.panelMobile : s.panel}>
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
                  loading={ssLoading || adLoading || arbLoading}
                  onReload={() => { loadShortSell(true); loadAdvanceDecline(true); loadArbitrage(true) }}
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
                                  {!isMobile && <button onClick={() => setDeltaModal('arbitrage_long')} title="裁定買い残 Δ分析" style={s.deltaBtn}>Δ</button>}
                                  裁定買い残
                                </div>
                                <div style={s.thSub}>百万円</div>
                              </th>
                              <th style={mTh}><div style={s.thLabel}>裁定売り残</div><div style={s.thSub}>先物OI</div></th>
                              <th style={mTh}>
                                <div style={{ ...s.thLabel, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                                  {!isMobile && <button onClick={() => setDeltaModal('advance_decline')} title="騰落レシオ Δ分析" style={s.deltaBtn}>Δ</button>}
                                  騰落レシオ
                                </div>
                                <div style={s.thSub}>25日</div>
                              </th>
                              <th style={mTh}>
                                <div style={{ ...s.thLabel, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                                  {!isMobile && <button onClick={() => setDeltaModal('short_sell')} title="空売り比率 Δ分析" style={s.deltaBtn}>Δ</button>}
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

        </div>{/* /マクロ需給 */}

        {/* ━━ ミクロ需給 ━━ */}
        <div style={{
          width: '33.333333%',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflowY: isMobile ? 'auto' : 'hidden',
        }}>
          <MicroQuantView
            theme={theme}
            isMobile={isMobile}
            data={participantsData}
            loading={participantsLoading}
            error={participantsError}
            onReload={() => loadParticipants(true)}
            user={user}
          />
        </div>
        </div>{/* /スライダートラック */}

      </div>{/* /ボディ */}

      <QuantSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
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
