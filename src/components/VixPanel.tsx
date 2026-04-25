import { useEffect, useRef, useState, useCallback } from 'react'
import { createChart, LineSeries, HistogramSeries, ColorType, CrosshairMode, type ISeriesApi } from 'lightweight-charts'
import { type VixWeekData } from '../utils/vixData'

type Props = { theme: 'dark' | 'light'; vixWeekData?: VixWeekData[] }
type Point = { time: string; value: number }

// ── 米国市場時間判定（UTC 13:30〜21:15、平日） ────
function isUsMarketOpen(): boolean {
  const now = new Date()
  const day = now.getUTCDay() // 0=日, 6=土
  if (day === 0 || day === 6) return false
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes()
  return mins >= 13 * 60 + 30 && mins <= 21 * 60 + 15
}

// ── VIX データ取得（複数プロキシにフォールバック） ──
const TARGET_Q1 = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=1y'
const TARGET_Q2 = 'https://query2.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=1y'

const VIX_CACHE_KEY = 'poical-vix-data'
const VIX_CACHE_TTL_OPEN   = 30 * 60 * 1000      // 30分（市場オープン中）
const VIX_CACHE_TTL_CLOSED = 2 * 60 * 60 * 1000  // 2時間（市場クローズ中）

function readVixCache(): { data: Point[]; fetchedAt: number } | null {
  try {
    const raw = localStorage.getItem(VIX_CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw) as { data: Point[]; fetchedAt: number }
    const ttl = isUsMarketOpen() ? VIX_CACHE_TTL_OPEN : VIX_CACHE_TTL_CLOSED
    if (Date.now() - cache.fetchedAt > ttl) return null
    return cache
  } catch { return null }
}

function writeVixCache(data: Point[]) {
  try {
    localStorage.setItem(VIX_CACHE_KEY, JSON.stringify({ data, fetchedAt: Date.now() }))
  } catch { /* ignore */ }
}

function timeoutSignal(ms: number): AbortSignal {
  const ac = new AbortController()
  setTimeout(() => ac.abort(), ms)
  return ac.signal
}

function parseYahooVix(json: unknown): Point[] {
  const r = (json as any)?.chart?.result?.[0]
  if (!r) throw new Error('レスポンス形式が不正')
  const ts: number[]          = r.timestamp ?? []
  const cl: (number | null)[] = r.indicators?.quote?.[0]?.close ?? []
  const seen = new Set<string>()
  const pts: Point[] = []
  for (let i = 0; i < ts.length; i++) {
    if (cl[i] == null) continue
    const time = new Date(ts[i] * 1000).toISOString().slice(0, 10)
    if (seen.has(time)) continue
    seen.add(time)
    pts.push({ time, value: Math.round(cl[i]! * 100) / 100 })
  }
  return pts.sort((a, b) => a.time.localeCompare(b.time))
}

// 各プロキシは { url, parse } 形式で定義
type ProxyDef = { url: (u: string) => string; parse: (res: Response) => Promise<unknown> }

const parseRaw = async (res: Response) => {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`プロキシ応答エラー: ${text.slice(0, 80)}`)
  }
}
const parseAlloriginsGet = async (res: Response) => {
  const w = await res.json() as { contents?: string }
  if (!w.contents) throw new Error('empty contents')
  try {
    return JSON.parse(w.contents)
  } catch {
    throw new Error(`プロキシ応答エラー: ${w.contents.slice(0, 80)}`)
  }
}

const PROXY_DEFS: ProxyDef[] = [
  // allorigins /get（JSONラッパー形式・最も安定）
  { url: u => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`, parse: parseAlloriginsGet },
  // allorigins /raw
  { url: u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`, parse: parseRaw },
  // codetabs（corsproxy.ioはレート制限のため除外）
  { url: u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`, parse: parseRaw },
]

async function tryFetchVix(target: string): Promise<Point[]> {
  let lastErr = ''
  for (let i = 0; i < PROXY_DEFS.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 500 * i))
    const def = PROXY_DEFS[i]
    try {
      const res = await fetch(def.url(target), { signal: timeoutSignal(12000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await def.parse(res)
      return parseYahooVix(json)
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e)
    }
  }
  throw new Error(lastErr)
}

async function fetchVix(force = false): Promise<Point[]> {
  if (!force) {
    const cached = readVixCache()
    if (cached) return cached.data
  }
  let data: Point[]
  try {
    data = await tryFetchVix(TARGET_Q1)
  } catch {
    // query1 が全滅なら query2 で再試行
    data = await tryFetchVix(TARGET_Q2)
  }
  writeVixCache(data)
  return data
}

// ── VIX 水準カラー（温度計カラー） ───────────────
function vixColor(val: number, isDark: boolean): string {
  if (val >= 40) return isDark ? 'rgba(255,60,60,0.95)'   : 'rgba(200,30,30,0.95)'
  if (val >= 30) return isDark ? 'rgba(255,130,50,0.95)'  : 'rgba(190,80,0,0.95)'
  if (val >= 20) return isDark ? 'rgba(255,230,130,0.95)' : 'rgba(140,110,0,0.95)'
  return isDark ? 'rgba(96,165,250,0.95)' : 'rgba(37,99,235,0.95)'
}
function vixLabel(val: number): string {
  if (val >= 40) return '極度恐怖'
  if (val >= 30) return '恐怖'
  if (val >= 25) return '警戒'
  if (val >= 20) return 'やや高め'
  if (val >= 15) return '通常'
  return '低位'
}

// ── VIX 週次Δヒストグラム ─────────────────────────
function VixDeltaHistogram({ data, theme }: { data: VixWeekData[]; theme: 'dark' | 'light' }) {
  const ref = useRef<HTMLDivElement>(null)
  const isDark = theme === 'dark'

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const pts = [...data].reverse().filter(d => d.changePct != null)
    if (pts.length < 2) return

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isDark ? 'rgba(160,165,185,0.7)' : 'rgba(60,65,90,0.7)',
        fontSize: 9,
      },
      grid: {
        vertLines: { color: 'transparent' },
        horzLines: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.05, bottom: 0.05 } },
      timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
      autoSize: true,
    })

    const hist = chart.addSeries(HistogramSeries, { base: 0, priceLineVisible: false, lastValueVisible: true })
    hist.setData(pts.map(d => ({
      time: d.date.replace(/\//g, '-') as any,
      value: d.changePct!,
      color: d.changePct! >= 0
        ? (isDark ? 'rgba(255,100,80,0.80)' : 'rgba(200,50,30,0.75)')
        : (isDark ? 'rgba(96,200,140,0.75)' : 'rgba(22,163,74,0.70)'),
    })))

    hist.createPriceLine({ price: 15,  color: isDark ? 'rgba(255,80,60,0.45)'  : 'rgba(200,40,20,0.45)',  lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '+15%' })
    hist.createPriceLine({ price: -15, color: isDark ? 'rgba(96,200,140,0.45)' : 'rgba(22,163,74,0.45)',  lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '-15%' })

    chart.timeScale().fitContent()
    return () => chart.remove()
  }, [data, isDark])

  return (
    <div style={{ flexShrink: 0, borderTop: '1px solid var(--border-dim)' }}>
      <div style={{ padding: '4px 12px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600 }}>VIX Δ 前週比 %</span>
        <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>±15% ライン表示</span>
      </div>
      <div ref={ref} style={{ height: 88 }} />
    </div>
  )
}

// ── メインコンポーネント ──────────────────────────
export function VixPanel({ theme, vixWeekData = [] }: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef          = useRef<ReturnType<typeof createChart> | null>(null)
  const seriesRef         = useRef<ISeriesApi<'Line'> | null>(null)

  const [data,          setData]          = useState<Point[]>([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [updatedAt,     setUpdatedAt]     = useState<Date | null>(null)
  const [showHistogram, setShowHistogram] = useState(false)

  // ── データ取得 ──────────────────────────────────
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError('')
    try {
      const d = await fetchVix()
      setData(d)
      setUpdatedAt(new Date())
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : 'エラー')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  // 初回ロード
  useEffect(() => { load() }, [load])

  // 市場時間中のみ5分おきにポーリング
  useEffect(() => {
    const id = setInterval(() => {
      if (isUsMarketOpen()) load(true)
    }, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [load])

  // ── チャート初期化（テーマ変更時も再生成） ───────
  useEffect(() => {
    const el = chartContainerRef.current
    if (!el) return

    const isDark    = theme === 'dark'
    const textColor = isDark ? 'rgba(180,185,210,0.85)' : 'rgba(40,45,70,0.85)'
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
    const lineColor = isDark ? 'rgba(255,255,255,0.88)' : 'rgba(40,40,60,0.88)'

    const chart = createChart(el, {
      layout: {
        background: {
          // 上=赤（高恐怖・過熱）/ 下=青（低恐怖・冷静） — NS倍率と共通の温度計配色
          type: ColorType.VerticalGradient,
          topColor:    isDark ? 'rgba(255,60,60,0.18)'  : 'rgba(255,60,60,0.11)',
          bottomColor: isDark ? 'rgba(37,99,235,0.18)'  : 'rgba(37,99,235,0.11)',
        },
        textColor,
        fontSize: 11,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
      autoSize: true,
    })

    const series = chart.addSeries(LineSeries, {
      color: lineColor,
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      priceLineVisible: true,
      priceLineColor: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(40,40,60,0.35)',
      priceLineStyle: 2, // dashed
    })

    chartRef.current  = chart
    seriesRef.current = series

    // テーマ切替後にチャートが再生成された場合、既存データを即座に反映
    if (data.length > 0) {
      series.setData(data)
      chart.timeScale().fitContent()
    }

    return () => {
      chart.remove()
      chartRef.current  = null
      seriesRef.current = null
    }
  }, [theme]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── データ → チャート反映 ──────────────────────
  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      seriesRef.current.setData(data)
      chartRef.current?.timeScale().fitContent()
    }
  }, [data])

  // ── Δヒストグラム切り替え時にグラデーション背景を強制再適用 ──
  // lightweight-charts が resize 後に VerticalGradient を描画しないバグの回避
  useEffect(() => {
    if (!chartRef.current) return
    const isDark = theme === 'dark'
    chartRef.current.applyOptions({
      layout: {
        background: {
          type: ColorType.VerticalGradient,
          topColor:    isDark ? 'rgba(255,60,60,0.18)'  : 'rgba(255,60,60,0.11)',
          bottomColor: isDark ? 'rgba(37,99,235,0.18)'  : 'rgba(37,99,235,0.11)',
        },
      },
    })
  }, [showHistogram, theme])

  const latest = data.at(-1)?.value
  const prev   = data.at(-2)?.value
  const change = latest != null && prev != null
    ? Math.round((latest - prev) * 100) / 100
    : null
  const marketOpen = isUsMarketOpen()
  const isDark = theme === 'dark'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* ── 現在値エリア ── */}
      <div style={{ padding: '6px 14px 4px', flexShrink: 0, borderBottom: '1px solid var(--border-dim)' }}>
        {loading ? (
          <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>取得中…</div>
        ) : error ? (
          <div style={{ fontSize: 11, color: 'rgba(255,100,80,0.8)', whiteSpace: 'pre-wrap' }}>{error}</div>
        ) : latest != null ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, color: vixColor(latest, isDark) }}>
                {latest.toFixed(2)}
              </span>
              {change != null && (
                <span style={{ fontSize: 12, fontWeight: 600,
                  color: change > 0 ? 'rgba(255,120,80,0.95)' : 'rgba(96,165,250,0.9)' }}>
                  {change > 0 ? '+' : ''}{change.toFixed(2)}
                </span>
              )}
              <span style={{ fontSize: 11, fontWeight: 600, marginLeft: 4,
                color: vixColor(latest, isDark), opacity: 0.85 }}>
                {vixLabel(latest)}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto',
                display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: marketOpen ? 'rgba(96,200,140,0.9)' : 'rgba(150,155,170,0.5)',
                  display: 'inline-block' }} />
                {marketOpen ? '市場オープン' : '市場クローズ'}
              </span>
            </div>
            {updatedAt && (
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                更新: {updatedAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                {!marketOpen && <span style={{ marginLeft: 6 }}>（次回更新: 市場オープン時）</span>}
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* ── チャートエリア ── */}
      <div style={{
        flex: 1, minHeight: 0, position: 'relative',
        background: isDark
          ? 'linear-gradient(to bottom, rgba(255,60,60,0.10) 0%, rgba(37,99,235,0.10) 100%)'
          : 'linear-gradient(to bottom, rgba(255,60,60,0.06) 0%, rgba(37,99,235,0.06) 100%)',
      }}>
        <div ref={chartContainerRef} style={{ position: 'absolute', inset: 0 }} />
        {/* Δヒストグラム トグルボタン */}
        <button
          onClick={() => setShowHistogram(v => !v)}
          title={showHistogram ? 'VIX 変化率Δ を非表示' : 'VIX 変化率Δ を表示'}
          style={{
            position: 'absolute', top: 6, left: 6, zIndex: 3,
            display: 'flex', alignItems: 'center', gap: 4,
            background: showHistogram
              ? (isDark ? 'rgba(96,165,250,0.18)' : 'rgba(37,99,235,0.10)')
              : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
            border: '1px solid ' + (showHistogram
              ? (isDark ? 'rgba(96,165,250,0.55)' : 'rgba(37,99,235,0.45)')
              : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)')),
            borderRadius: 5, cursor: 'pointer',
            color: showHistogram
              ? (isDark ? 'rgba(96,165,250,0.95)' : 'rgba(37,99,235,0.95)')
              : 'var(--text-dim)',
            fontSize: 10, fontWeight: 700, padding: '3px 7px',
            lineHeight: 1.4, letterSpacing: '0.02em',
          }}
        >
          変化率 Δ
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            {showHistogram ? (
              <>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </>
            ) : (
              <>
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </>
            )}
          </svg>
        </button>
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>読み込み中…</span>
          </div>
        )}
      </div>

      {/* ── Δヒストグラム（トグル表示） ── */}
      {showHistogram && vixWeekData.length > 0 && (
        <VixDeltaHistogram data={vixWeekData} theme={theme} />
      )}
    </div>
  )
}
