import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react'
import type React from 'react'
import type { User } from 'firebase/auth'
import { themeVars } from '../utils/themeVars'
import { fetchInvestorData, type InvestorWeekData } from '../utils/jpxInvestorData'
import { fetchMarginData, type MarginWeekData } from '../utils/jpxMarginData'
import { fetchVixData, fetchVixDailyData, type VixWeekData, type VixDayData } from '../utils/vixData'
import { fetchAdvanceDeclineData, type AdvanceDeclineWeekData } from '../utils/advanceDeclineData'
import { fetchShortSellData, type ShortSellWeekData } from '../utils/shortSellData'
import { fetchArbitrageData, fetchArbitrageDailyData, type ArbitrageWeekData, type ArbitrageDayData } from '../utils/arbitrageData'
import { fetchCotNikkeiData, type CotNikkeiWeekData } from '../utils/cotNikkeiData'
import { fetchFuturesDailyData, type FuturesDayData } from '../utils/futuresDailyData'
import { fetchUsdjpyData, type UsdjpyDayData } from '../utils/usdjpyData'
import { fetchNas100Data, type Nas100DayData } from '../utils/nas100Data'
import { fetchNkFuturesPriceData, type NkFuturesDayData } from '../utils/nkFuturesPriceData'
import { fetchStocksDaily, type StocksDailyData } from '../utils/stocksDailyData'
import { AI_PROMPT_TEMPLATE } from '../utils/enginePrompt'
import { buildExportJson } from '../utils/engineExport'
import { EnginePanel, useEngineSystemLog, EngineSystemLog, STATUS_LINES } from './EnginePanel'
const VixPanel    = lazy(() => import('./VixPanel').then(m => ({ default: m.VixPanel })))
const NtRatioPanel = lazy(() => import('./NtRatioPanel').then(m => ({ default: m.NtRatioPanel })))
const DeltaModal  = lazy(() => import('./DeltaModal').then(m => ({ default: m.DeltaModal })))
import type { DeltaModalType } from './DeltaModal'
const MicroQuantView = lazy(() => import('./MicroQuantView').then(m => ({ default: m.MicroQuantView })))
const QuantMemoPanel = lazy(() => import('./MicroQuantView').then(m => ({ default: m.QuantMemoPanel })))
const MarketDailyPanel = lazy(() => import('./MarketDailyPanel').then(m => ({ default: m.MarketDailyPanel })))
const ContribSectorPanel = lazy(() => import('./StocksView').then(m => ({ default: m.ContribSectorPanel })))
import type { NtRatioPoint } from '../utils/ntRatioData'

type QuantTabKey = 'bunseki' | 'kankyou' | 'genbutsu' | 'micro'
type Props = {
  theme: 'dark' | 'light'
  isMobile: boolean
  user: User | null
  quantTab: QuantTabKey
  onQuantTabChange: (t: QuantTabKey) => void
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


// AI_PROMPT_TEMPLATE は src/utils/enginePrompt.ts で管理

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

// ── データ鮮度ヘルパー ──────────────────────────────
function freshnessColor(dateStr: string | null | undefined): string {
  if (!dateStr) return 'var(--text-dim)'
  const d = new Date(dateStr.replace(/\//g, '-'))
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days <= 7)  return 'rgba(74,222,128,0.9)'
  if (days <= 14) return 'rgba(251,191,36,0.9)'
  return 'rgba(255,107,107,0.9)'
}

function FreshnessTag({ dateStr }: { dateStr: string | null | undefined }) {
  if (!dateStr) return null
  const d = new Date(dateStr.replace(/\//g, '-'))
  const label = `${d.getMonth() + 1}/${d.getDate()}現在`
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text-dim)' }}>
      <span style={{ color: freshnessColor(dateStr), fontSize: 8, lineHeight: 1 }}>●</span>
      {label}
    </span>
  )
}

// ── パネルヘッダー ─────────────────────────────────
function PanelHeader({
  icon, title, sub, dateRange, latestDate,
}: {
  icon: React.ReactNode
  title: string
  sub: string
  dateRange?: string
  latestDate?: string | null
}) {
  return (
    <div style={s.panelHead}>
      <div style={s.panelTitle}>
        {icon}
        {title}
        <span style={s.panelSub}>{sub}</span>
      </div>
      <div style={s.panelRight}>
        {latestDate
          ? <FreshnessTag dateStr={latestDate} />
          : dateRange && <span style={s.dataRange}>{dateRange}</span>
        }
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
export function QuantView({ theme, isMobile, user, quantTab }: Props) {
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

  const [nkFuturesPriceData,    setNkFuturesPriceData]    = useState<NkFuturesDayData[]>([])
  const [nkFuturesPriceLoaded,  setNkFuturesPriceLoaded]  = useState(false)
  const [nkFuturesPriceLoading, setNkFuturesPriceLoading] = useState(false)
  const [nkFuturesPriceError,   setNkFuturesPriceError]   = useState('')

  const [stocksDailyData,   setStocksDailyData]   = useState<StocksDailyData | null>(null)
  const [stocksDailyLoaded, setStocksDailyLoaded] = useState(false)

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
  const engineLogState = useEngineSystemLog(STATUS_LINES)
  // quantTab / setQuantTab は props から受け取る（App.tsx でリフト済み）
  const [deltaModal,  setDeltaModal]  = useState<DeltaModalType | null>(null)

  // micro タブは初回訪問時にマウント（以降は維持）
  const [microMounted, setMicroMounted] = useState(() => quantTab === 'micro')
  useEffect(() => { if (quantTab === 'micro') setMicroMounted(true) }, [quantTab])

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

  const loadNkFuturesPrice = useCallback(async (force = false) => {
    setNkFuturesPriceLoading(true); setNkFuturesPriceError('')
    try { setNkFuturesPriceData(await fetchNkFuturesPriceData(force)); setNkFuturesPriceLoaded(true) }
    catch (e) { setNkFuturesPriceError(e instanceof Error ? e.message : 'データ取得エラー'); setNkFuturesPriceLoaded(true) }
    finally { setNkFuturesPriceLoading(false) }
  }, [])

  const loadStocksDaily = useCallback(async () => {
    try { setStocksDailyData(await fetchStocksDaily()); setStocksDailyLoaded(true) }
    catch { /* エラー時は null のまま */ }
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
  useEffect(() => { if (!stocksDailyLoaded) loadStocksDaily() }, [stocksDailyLoaded, loadStocksDaily])

  const handlePromptCopy = useCallback(async () => {
    const json = JSON.stringify(
      buildExportJson(invData, marData, vixWeekData, ntData, adData, ssData, arbData, cotData, arbDailyData, usdjpyData, futuresDailyData, nas100Data, vixDailyData, nkFuturesPriceData, stocksDailyData),
      null, 2
    )
    await copyText(AI_PROMPT_TEMPLATE + json)
    setCopyStatus('prompt')
    setTimeout(() => setCopyStatus(''), 2000)
  }, [invData, marData, vixWeekData, ntData, adData, ssData, arbData, cotData, arbDailyData, usdjpyData, futuresDailyData, nas100Data, vixDailyData, nkFuturesPriceData, stocksDailyData])


  const tv = useMemo(() => themeVars(theme), [theme])

  // モバイル向けテーブルスタイル（横スクロールなし・パディング縮小・ヘッダー折り返し許可）
  const [marLongQ1,  marLongQ3]  = useMemo(() => quartiles(marData.map(r => r.longBal)),  [marData])
  const [marShortQ1, marShortQ3] = useMemo(() => quartiles(marData.map(r => r.shortBal)), [marData])
  const [arbLongQ1,  arbLongQ3]  = useMemo(() => quartiles(arbData.map(r => r.longBal)),  [arbData])
  const [arbShortQ1, arbShortQ3] = useMemo(() => quartiles(arbData.map(r => r.shortBal)), [arbData])
  const combinedRows = useMemo(() => buildCombinedRows(ssData, adData, arbData), [ssData, adData, arbData])

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
        <Suspense fallback={null}>
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
        </Suspense>
      )}
      {/* ── ボディ ── */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* スライダートラック */}
        <div style={{
          display: 'flex',
          width: '400%',
          height: '100%',
          transform: quantTab === 'bunseki' ? 'translateX(0)' : quantTab === 'kankyou' ? 'translateX(-25%)' : quantTab === 'genbutsu' ? 'translateX(-50%)' : 'translateX(-75%)',
          transition: 'transform 0.25s ease',
        }}>

        {/* ━━ 分析 ━━ */}
        <div style={{
          width: '25%',
          flexShrink: 0,
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          height: '100%',
          overflowX: 'hidden',
          overflowY: isMobile ? 'auto' : 'hidden',
          paddingBottom: isMobile ? 130 : 0,
        }}>
          <EnginePanel onPromptCopy={handlePromptCopy} copyStatus={copyStatus} isMobile={isMobile} theme={theme} logState={engineLogState} />
          <div style={isMobile ? s.dividerH : s.divider} />
          <div style={isMobile ? { flexShrink: 0, display: 'flex', flexDirection: 'column' } : s.panel}>
            <Suspense fallback={null}><QuantMemoPanel theme={theme} user={user} isMobile={isMobile} /></Suspense>
          </div>
          {/* ② スマホ: SYSTEM LOG は QuantMemoPanel の下に表示 */}
          {isMobile && <EngineSystemLog {...engineLogState} theme={theme} />}
        </div>{/* /分析 */}

        {/* ━━ 環境 ━━ */}
        <div style={{
          width: '25%',
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
          <Suspense fallback={null}><VixPanel theme={theme} vixWeekData={vixWeekData} isMobile={isMobile} /></Suspense>
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
          <Suspense fallback={null}><NtRatioPanel theme={theme} onDataLoaded={handleNtDataLoaded} /></Suspense>
        </div>

        <div style={isMobile ? s.dividerH : s.divider} />

        {/* USD/JPY */}
        <div style={isMobile ? s.panelMobile : s.panel}>
          <Suspense fallback={null}>
            <MarketDailyPanel
              theme={theme}
              isMobile={isMobile}
              usdjpyData={usdjpyData}
              usdjpyLoading={usdjpyLoading}
              usdjpyError={usdjpyError}
              onUsdjpyReload={() => loadUsdjpy(true)}
            />
          </Suspense>
        </div>


        </div>{/* /環境 */}

        {/* ━━ 現物需給 ━━ */}
        <div style={isMobile ? {
          width: '25%', flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          height: '100%', overflowX: 'hidden', overflowY: 'auto',
          paddingBottom: 130,
        } : {
          width: '25%', flexShrink: 0,
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
            latestDate={marData[0]?.date}
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
                    {(isMobile && !marExpanded ? marData.slice(0, MOBILE_ROW_LIMIT) : marData).map((row, i) => (
                        <tr key={row.date} style={{ ...s.tr, background: i === 0 ? 'var(--latest-row-bg)' : 'transparent' }}>
                          <td style={mTdDate}>
                            <div style={s.dateMain}>{withYear(row.label, row.date)}</div>
                            <div style={s.dateSub}>{row.date}</div>
                          </td>
                          <td style={{ ...mTd, ...s.tdNum, background: balBg(row.longBal, marLongQ1, marLongQ3, true, theme) }}>
                            <span style={{ color: balTextColor(row.longBal, marLongQ1, marLongQ3, true, theme), fontWeight: 500 }}>
                              {fmtHyakuman(row.longBal)}
                            </span>
                          </td>
                          <td style={{ ...mTd, ...s.tdNum, background: balBg(row.shortBal, marShortQ1, marShortQ3, false, theme) }}>
                            <span style={{ color: balTextColor(row.shortBal, marShortQ1, marShortQ3, false, theme), fontWeight: 500 }}>
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
                    ))}
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
            latestDate={invData[0]?.date}
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
            const combinedLoading = (ssLoading || adLoading || arbLoading) && combinedRows.length === 0
            const combinedError = ssError || adError || arbError
            const latestDate = combinedRows[0]?.date
            return (
              <>
                <PanelHeader
                  icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
                  title="需給指標"
                  sub="空売り比率・騰落レシオ・裁定残高（週次）"
                  latestDate={latestDate}
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
                                <td style={{ ...mTd, ...s.tdNum, background: row.arbLongBal != null ? arbBg(row.arbLongBal, arbLongQ1, arbLongQ3, theme) : 'transparent' }}>
                                  {row.arbLongBal != null
                                    ? <span style={{ color: arbTextColor(row.arbLongBal, arbLongQ1, arbLongQ3, theme), fontWeight: 500 }}>{fmtHyakuman(row.arbLongBal)}</span>
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

        {/* BR: 銘柄別寄与度 / 業種別騰落率 */}
        <div style={isMobile ? s.panelMobile : s.panel}>
          <Suspense fallback={null}><ContribSectorPanel theme={theme} isMobile={isMobile} /></Suspense>
        </div>


        </div>{/* /現物需給 */}

        {/* ━━ 先物需給 ━━ */}
        <div style={{
          width: '25%',
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
            {microMounted && (
              <Suspense fallback={null}>
                <MicroQuantView
                  theme={theme}
                  isMobile={isMobile}
                  data={cotData}
                  loading={cotLoading}
                  error={cotError}
                  onReload={() => loadCot(true)}
                  onOpenNetDelta={() => setDeltaModal('futures_net_weekly')}
                />
              </Suspense>
            )}
          </div>

          {isMobile && <div style={s.dividerH} />}

          {/* 右 1/3: 建玉残高・取引高 + 日経平均先物 */}
          {(() => {
            const rows = futuresDailyData.slice(0, isMobile ? (futuresDailyExpanded ? futuresDailyData.length : MOBILE_ROW_LIMIT) : 20)
            const fmtOi  = (n: number) => (n / 10000).toFixed(1) + '万'
            const fmtVol = (n: number) => n >= 10000 ? (n / 10000).toFixed(1) + '万' : n.toLocaleString()
            const latestDate = futuresDailyData[0]?.date ?? null
            const loadingEmpty = futuresDailyLoading && futuresDailyData.length === 0
            const errorEmpty   = futuresDailyError   && futuresDailyData.length === 0
            const nkRows = [...nkFuturesPriceData]
            const changePctColor = (pct: number | null) => {
              if (pct == null) return 'var(--text)'
              if (pct > 0) return theme === 'dark' ? 'rgba(52,211,153,0.95)' : 'rgba(5,150,105,0.95)'
              if (pct < 0) return theme === 'dark' ? 'rgba(248,113,113,0.95)' : 'rgba(185,28,28,0.95)'
              return 'var(--text)'
            }
            const changePctBg = (pct: number | null) => {
              if (pct == null || pct === 0) return 'transparent'
              if (pct > 0) return theme === 'dark' ? 'rgba(52,211,153,0.15)' : 'rgba(5,150,105,0.10)'
              return theme === 'dark' ? 'rgba(248,113,113,0.15)' : 'rgba(185,28,28,0.10)'
            }

            return (
              <div style={isMobile
                ? { display: 'flex', flexDirection: 'column' }
                : { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }
              }>
                {/* 上段: 建玉残高・取引高・PCR */}
                <div style={isMobile ? s.halfPanelMobile : s.halfPanel}>
                  <div style={{ ...s.panelHead, minHeight: 36 }}>
                    <div style={s.panelTitle}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
                      </svg>
                      建玉残高・取引高
                      <span style={s.panelSub}>日経225先物 全限月 (日次・JPX)</span>
                    </div>
                    <div style={s.panelRight}>
                      <FreshnessTag dateStr={latestDate} />
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
                                  <button onClick={() => setDeltaModal('futures_oi')} title="建玉残高前日比 Δ分析" style={s.deltaBtn}>Δ</button>
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

                <div style={s.dividerH} />

                {/* 下段: 日経平均先物 (NK=F) */}
                <div style={isMobile ? s.halfPanelMobile : s.halfPanel}>
                  <div style={{ ...s.panelHead, minHeight: 36 }}>
                    <div style={s.panelTitle}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
                        <polyline points="16 7 22 7 22 13"/>
                      </svg>
                      日経平均先物
                      <span style={s.panelSub}>^N225 / 日経225 (日足)</span>
                    </div>
                    <div style={s.panelRight}>
                      <FreshnessTag dateStr={nkRows[0]?.date ?? null} />
                    </div>
                  </div>
                  {!nkFuturesPriceLoaded || (nkFuturesPriceLoading && nkRows.length === 0)
                    ? <div style={s.center}><div style={s.spinner} /></div>
                    : nkFuturesPriceError && nkRows.length === 0
                    ? <div style={s.center}>
                        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>取得エラー</div>
                        <button style={s.retryBtn} onClick={() => loadNkFuturesPrice(true)}>再試行</button>
                      </div>
                    : nkRows.length === 0
                    ? <div style={s.center}><span style={{ color: 'var(--text-dim)', fontSize: 12 }}>データなし</span></div>
                    : (
                      <div style={s.tableWrap}>
                        <table style={{ ...s.table, minWidth: 240 }}>
                          <thead>
                            <tr>
                              <th style={{ ...s.th, ...s.thDate }}>日付</th>
                              <th style={s.th}><div style={s.thLabel}>高値</div><div style={s.thSub}>円</div></th>
                              <th style={s.th}><div style={s.thLabel}>安値</div><div style={s.thSub}>円</div></th>
                              <th style={s.th}><div style={s.thLabel}>終値</div><div style={s.thSub}>円</div></th>
                              <th style={s.th}><div style={s.thLabel}>前日比</div><div style={s.thSub}>%</div></th>
                            </tr>
                          </thead>
                          <tbody>
                            {nkRows.map((row, i) => (
                              <tr key={row.date} style={{ ...s.tr, background: i === 0 ? 'var(--latest-row-bg)' : 'transparent' }}>
                                <td style={{ ...s.td, ...s.tdDate }}>
                                  <div style={s.dateMain}>{row.date.slice(5).replace('-', '/')}</div>
                                  <div style={s.dateSub}>{row.date.slice(0, 4)}</div>
                                </td>
                                <td style={{ ...s.td, ...s.tdNum }}>
                                  <span style={{ fontSize: 11 }}>{row.high.toLocaleString()}</span>
                                </td>
                                <td style={{ ...s.td, ...s.tdNum }}>
                                  <span style={{ fontSize: 11 }}>{row.low.toLocaleString()}</span>
                                </td>
                                <td style={{ ...s.td, ...s.tdNum }}>
                                  <span style={{ fontWeight: 600 }}>{row.close.toLocaleString()}</span>
                                </td>
                                <td style={{ ...s.td, ...s.tdNum, background: changePctBg(row.change_pct) }}>
                                  {row.change_pct != null ? (
                                    <span style={{ fontWeight: 600, color: changePctColor(row.change_pct) }}>
                                      {row.change_pct > 0 ? '+' : ''}{row.change_pct.toFixed(2)}%
                                    </span>
                                  ) : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  }
                </div>
              </div>
            )
          })()}

        </div>

        </div>{/* /スライダートラック */}

      </div>{/* /ボディ */}
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
