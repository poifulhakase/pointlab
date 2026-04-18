import { useEffect, useRef, useState, useCallback } from 'react'
import { createChart, LineSeries, ColorType, CrosshairMode, type ISeriesApi } from 'lightweight-charts'

type Props = { theme: 'dark' | 'light' }
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
const VIX_CACHE_TTL = 30 * 60 * 1000 // 30分

function readVixCache(): { data: Point[]; fetchedAt: number } | null {
  try {
    const raw = localStorage.getItem(VIX_CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw) as { data: Point[]; fetchedAt: number }
    if (Date.now() - cache.fetchedAt > VIX_CACHE_TTL) return null
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
  for (const def of PROXY_DEFS) {
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

// ── メインコンポーネント ──────────────────────────
export function VixPanel({ theme }: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef          = useRef<ReturnType<typeof createChart> | null>(null)
  const seriesRef         = useRef<ISeriesApi<'Line'> | null>(null)

  const [data,      setData]      = useState<Point[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

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
      <div ref={chartContainerRef} style={{ flex: 1, minHeight: 0 }} />
    </div>
  )
}
