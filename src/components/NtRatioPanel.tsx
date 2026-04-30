import { useEffect, useRef, useState, useCallback } from 'react'
import { createChart, LineSeries, ColorType, CrosshairMode, type ISeriesApi } from 'lightweight-charts'
import { fetchNtRatioData, fetchNtTopixData, type NtRatioPoint } from '../utils/ntRatioData'

type Mode = 'ns' | 'nt'

type Props = {
  theme: 'dark' | 'light'
  onDataLoaded?: (data: NtRatioPoint[]) => void
}

// ── NS倍率 水準ラベル・配色（日経÷S&P500、範囲 7〜9）──
function nsLabel(val: number): string {
  if (val >= 8.5) return '酷暑（オーバーヒート）'
  if (val >= 8.0) return '真夏日'
  if (val >= 7.5) return '適温'
  return '冷え込み'
}
function nsColor(val: number, isDark: boolean): string {
  if (val >= 8.5) return isDark ? 'rgba(255,80,60,0.95)'   : 'rgba(200,30,30,0.95)'
  if (val >= 8.0) return isDark ? 'rgba(255,155,50,0.95)'  : 'rgba(190,100,0,0.95)'
  if (val >= 7.5) return isDark ? 'rgba(255,235,150,0.95)' : 'rgba(140,110,0,0.95)'
  return isDark ? 'rgba(96,165,250,0.95)' : 'rgba(37,99,235,0.95)'
}

// ── NT倍率 水準ラベル・配色（日経÷TOPIX、範囲 13〜16）──
function ntLabel(val: number): string {
  if (val >= 15.5) return '日経独歩高'
  if (val >= 14.5) return '高め'
  if (val >= 13.5) return '適温'
  return 'TOPIX優位'
}
function ntColor(val: number, isDark: boolean): string {
  if (val >= 15.5) return isDark ? 'rgba(255,80,60,0.95)'   : 'rgba(200,30,30,0.95)'
  if (val >= 14.5) return isDark ? 'rgba(255,155,50,0.95)'  : 'rgba(190,100,0,0.95)'
  if (val >= 13.5) return isDark ? 'rgba(255,235,150,0.95)' : 'rgba(140,110,0,0.95)'
  return isDark ? 'rgba(96,165,250,0.95)' : 'rgba(37,99,235,0.95)'
}

function getLabel(mode: Mode, val: number): string {
  return mode === 'ns' ? nsLabel(val) : ntLabel(val)
}
function getColor(mode: Mode, val: number, isDark: boolean): string {
  return mode === 'ns' ? nsColor(val, isDark) : ntColor(val, isDark)
}

function fmtNum(v: number): string {
  return v.toLocaleString('ja-JP', { maximumFractionDigits: 2 })
}

// ── メインコンポーネント ──────────────────────────
export function NtRatioPanel({ theme, onDataLoaded }: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef          = useRef<ReturnType<typeof createChart> | null>(null)
  const seriesRef         = useRef<ISeriesApi<'Line'> | null>(null)

  const [mode,      setMode]      = useState<Mode>('ns')
  const [data,      setData]      = useState<NtRatioPoint[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const load = useCallback(async (force = false) => {
    setLoading(true)
    setError('')
    try {
      const d = mode === 'ns'
        ? await fetchNtRatioData(force)
        : await fetchNtTopixData(force)
      setData(d)
      setUpdatedAt(new Date())
      if (mode === 'ns') onDataLoaded?.(d)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラー')
    } finally {
      setLoading(false)
    }
  }, [mode, onDataLoaded])

  useEffect(() => { load() }, [load])

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
      priceLineStyle: 2,
    })

    chartRef.current  = chart
    seriesRef.current = series

    if (data.length > 0) {
      series.setData(data.map(d => ({ time: d.time, value: d.ratio })))
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
      seriesRef.current.setData(data.map(d => ({ time: d.time, value: d.ratio })))
      chartRef.current?.timeScale().fitContent()
    }
  }, [data])

  const latest = data.at(-1)
  const isDark  = theme === 'dark'

  const tabActive: React.CSSProperties = {
    background: 'var(--view-btn-active-bg)',
    color: 'var(--view-btn-active-color)',
    fontWeight: 700,
  }
  const tabBase: React.CSSProperties = {
    padding: '3px 9px', fontSize: 11, fontWeight: 500,
    color: 'var(--text-dim)', cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
    border: 'none', background: 'transparent',
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* ── 現在値エリア ── */}
      <div style={{
        padding: '6px 14px 4px', flexShrink: 0,
        borderBottom: '1px solid var(--border-dim)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8,
      }}>

        {/* 値表示 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>取得中…</div>
          ) : error ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,100,80,0.8)', whiteSpace: 'pre-wrap' }}>{error}</span>
              <button
                onClick={() => load(true)}
                style={{ alignSelf: 'flex-start', fontSize: 11, padding: '3px 10px', borderRadius: 6, cursor: 'pointer', color: 'var(--text-sub)', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
              >
                再試行
              </button>
            </div>
          ) : latest != null ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, color: getColor(mode, latest.ratio, isDark) }}>
                  {latest.ratio.toFixed(2)}
                </span>
                {latest.change != null && (
                  <span style={{ fontSize: 12, fontWeight: 600,
                    color: latest.change > 0 ? 'rgba(255,120,80,0.95)' : 'rgba(96,200,140,0.9)' }}>
                    {latest.change > 0 ? '+' : ''}{latest.change.toFixed(3)}
                  </span>
                )}
                <span style={{ fontSize: 11, fontWeight: 600, marginLeft: 4,
                  color: getColor(mode, latest.ratio, isDark), opacity: 0.85 }}>
                  {getLabel(mode, latest.ratio)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                  日経 {fmtNum(latest.nikkei)}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                  {mode === 'ns' ? `S&P ${fmtNum(latest.sp500)}` : `TOPIX ${fmtNum(latest.sp500)}`}
                </span>
                {updatedAt && (
                  <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto' }}>
                    更新: {updatedAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* NS / NT トグル */}
        <div style={{
          display: 'flex', borderRadius: 8, overflow: 'hidden',
          border: '1px solid var(--border-dim)', flexShrink: 0, marginTop: 2,
        }}>
          <button style={{ ...tabBase, ...(mode === 'ns' ? tabActive : {}) }} onClick={() => setMode('ns')}>NS</button>
          <button style={{ ...tabBase, ...(mode === 'nt' ? tabActive : {}) }} onClick={() => setMode('nt')}>NT</button>
        </div>
      </div>

      {/* ── チャートエリア ── */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <div ref={chartContainerRef} style={{ position: 'absolute', inset: 0 }} />
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
    </div>
  )
}
