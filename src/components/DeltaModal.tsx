import { createPortal } from 'react-dom'
import { useEffect, useRef } from 'react'
import { createChart, HistogramSeries, LineSeries, ColorType, CrosshairMode } from 'lightweight-charts'
import { type MarginWeekData } from '../utils/jpxMarginData'
import { type ArbitrageWeekData } from '../utils/arbitrageData'
import { type ShortSellWeekData } from '../utils/shortSellData'
import { type AdvanceDeclineWeekData } from '../utils/advanceDeclineData'
import { themeVars } from '../utils/themeVars'

export type DeltaModalType = 'credit_long' | 'arbitrage_long' | 'arbitrage_short' | 'short_sell' | 'advance_decline'

type Props = {
  type: DeltaModalType
  marData: MarginWeekData[]
  arbData: ArbitrageWeekData[]
  ssData: ShortSellWeekData[]
  adData: AdvanceDeclineWeekData[]
  theme: 'dark' | 'light'
  onClose: () => void
}

const CONFIG: Record<DeltaModalType, { title: string; unit: string; positiveIsBad: boolean; accent: string }> = {
  credit_long:     { title: '信用買い残 Δ',    unit: '%',   positiveIsBad: true,  accent: '#f87171' },
  arbitrage_long:  { title: '裁定買い残 Δ',    unit: '億円', positiveIsBad: false, accent: '#60a5fa' },
  arbitrage_short: { title: '裁定売り残 Δ',    unit: '億円', positiveIsBad: true,  accent: '#fb923c' },
  short_sell:      { title: '空売り比率 Δ',    unit: 'pp',  positiveIsBad: true,  accent: '#fb923c' },
  advance_decline: { title: '騰落レシオ Δ',    unit: 'pp',  positiveIsBad: true,  accent: '#a78bfa' },
}

const SUB_LABEL: Record<DeltaModalType, string> = {
  credit_long:     '前週比 %',
  arbitrage_long:  '週次変化 億円',
  arbitrage_short: '週次変化 億円',
  short_sell:      '週次変化 pp',
  advance_decline: '変化率 pp',
}

function toIso(d: string) { return d.replace(/\//g, '-') }

function computeDeltas(
  type: DeltaModalType,
  marData: MarginWeekData[],
  arbData: ArbitrageWeekData[],
  ssData: ShortSellWeekData[],
  adData: AdvanceDeclineWeekData[],
): { time: string; value: number }[] {
  const N = 14
  if (type === 'credit_long') {
    const arr = [...marData].sort((a, b) => b.date.localeCompare(a.date)).slice(0, N).reverse()
    return arr.slice(1).map((row, i) => {
      const prev = arr[i]
      const v = prev.longBal > 0 ? Math.round((row.longBal - prev.longBal) / prev.longBal * 10000) / 100 : 0
      return { time: toIso(row.date), value: v }
    })
  }
  if (type === 'arbitrage_long') {
    const arr = [...arbData].sort((a, b) => b.date.localeCompare(a.date)).slice(0, N).reverse()
    return arr.slice(1).map((row, i) => {
      const prev = arr[i]
      return { time: toIso(row.date), value: Math.round((row.longBal - prev.longBal) / 100) }
    })
  }
  if (type === 'arbitrage_short') {
    const arr = [...arbData].sort((a, b) => b.date.localeCompare(a.date)).slice(0, N).reverse()
    return arr.slice(1).map((row, i) => {
      const prev = arr[i]
      return { time: toIso(row.date), value: Math.round((row.shortBal - prev.shortBal) / 100) }
    })
  }
  if (type === 'short_sell') {
    const arr = [...ssData].sort((a, b) => b.date.localeCompare(a.date)).slice(0, N).reverse()
    return arr.slice(1).map((row, i) => {
      const prev = arr[i]
      return { time: toIso(row.date), value: Math.round((row.ratio - prev.ratio) * 100) / 100 }
    })
  }
  const arr = [...adData].sort((a, b) => b.date.localeCompare(a.date)).slice(0, N).reverse()
  return arr.slice(1).map((row, i) => {
    const prev = arr[i]
    return { time: toIso(row.date), value: Math.round((row.ratio25 - prev.ratio25) * 100) / 100 }
  })
}

function computeMA4(deltas: { time: string; value: number }[]) {
  return deltas.map((d, i) => {
    if (i < 3) return null
    const avg = (deltas[i].value + deltas[i-1].value + deltas[i-2].value + deltas[i-3].value) / 4
    return { time: d.time, value: Math.round(avg * 100) / 100 }
  }).filter((d): d is { time: string; value: number } => d !== null)
}

function DeltaChart({ type, deltas, theme }: { type: DeltaModalType; deltas: { time: string; value: number }[]; theme: 'dark' | 'light' }) {
  const ref = useRef<HTMLDivElement>(null)
  const cfg = CONFIG[type]
  const isDark = theme === 'dark'

  useEffect(() => {
    const el = ref.current
    if (!el || deltas.length < 2) return

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isDark ? 'rgba(180,185,210,0.75)' : 'rgba(40,45,70,0.75)',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
        horzLines: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
      autoSize: true,
    })

    const posColor = cfg.positiveIsBad
      ? (isDark ? 'rgba(248,113,113,0.85)' : 'rgba(200,50,30,0.82)')
      : (isDark ? 'rgba(96,165,250,0.85)' : 'rgba(26,115,232,0.80)')
    const negColor = cfg.positiveIsBad
      ? (isDark ? 'rgba(96,165,250,0.85)' : 'rgba(26,115,232,0.80)')
      : (isDark ? 'rgba(248,113,113,0.85)' : 'rgba(200,50,30,0.82)')

    const hist = chart.addSeries(HistogramSeries, { base: 0, priceLineVisible: false, lastValueVisible: true })
    hist.setData(deltas.map(d => ({ time: d.time as any, value: d.value, color: d.value >= 0 ? posColor : negColor })))

    if (type === 'short_sell' || type === 'advance_decline') {
      const maData = computeMA4(deltas)
      if (maData.length > 0) {
        const ma = chart.addSeries(LineSeries, {
          color: isDark ? 'rgba(251,191,36,0.92)' : 'rgba(161,120,0,0.92)',
          lineWidth: 2,
          crosshairMarkerVisible: false,
          priceLineVisible: false,
          lastValueVisible: false,
        })
        ma.setData(maData.map(d => ({ time: d.time as any, value: d.value })))
      }
    }

    chart.timeScale().fitContent()
    return () => chart.remove()
  }, [deltas, theme, type, isDark, cfg.positiveIsBad])

  return <div ref={ref} style={{ height: 220, width: '100%' }} />
}

export function DeltaModal({ type, marData, arbData, ssData, adData, theme, onClose }: Props) {
  const tv = themeVars(theme)
  const cfg = CONFIG[type]
  const deltas = computeDeltas(type, marData, arbData, ssData, adData)
  const isDark = theme === 'dark'

  const latest = deltas.length > 0 ? deltas[deltas.length - 1].value : null
  const vals = deltas.map(d => d.value)
  const maxV = vals.length > 0 ? Math.max(...vals) : null
  const minV = vals.length > 0 ? Math.min(...vals) : null

  const posCol = cfg.positiveIsBad
    ? (isDark ? 'rgba(248,113,113,0.95)' : 'rgba(200,50,30,0.9)')
    : (isDark ? 'rgba(96,165,250,0.95)' : 'rgba(26,115,232,0.9)')
  const negCol = cfg.positiveIsBad
    ? (isDark ? 'rgba(96,165,250,0.95)' : 'rgba(26,115,232,0.9)')
    : (isDark ? 'rgba(248,113,113,0.95)' : 'rgba(200,50,30,0.9)')
  const latestCol = latest != null ? (latest >= 0 ? posCol : negCol) : 'var(--text-dim)'

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isDark ? 'rgba(0,0,0,0.62)' : 'rgba(0,0,0,0.38)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          ...tv,
          position: 'relative',
          background: isDark
            ? 'rgba(16,20,36,0.94)'
            : 'rgba(255,255,255,0.94)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
          borderRadius: 20,
          boxShadow: isDark
            ? `0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px ${cfg.accent}18, inset 0 1px 0 rgba(255,255,255,0.06)`
            : `0 24px 60px rgba(0,0,0,0.18), 0 0 0 1px ${cfg.accent}28`,
          width: '92vw', maxWidth: 540,
          maxHeight: '88vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* アクセントバー */}
        <div style={{
          height: 3,
          background: `linear-gradient(90deg, ${cfg.accent}00 0%, ${cfg.accent} 40%, ${cfg.accent}cc 70%, ${cfg.accent}00 100%)`,
          flexShrink: 0,
        }} />

        {/* ヘッダー */}
        <div style={{
          padding: '18px 22px 16px',
          display: 'flex', alignItems: 'flex-start', gap: 14,
          flexShrink: 0,
        }}>
          {/* アイコン */}
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: `${cfg.accent}18`,
            border: `1px solid ${cfg.accent}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cfg.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
              <polyline points="16 7 22 7 22 13"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
              {cfg.title}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
              {SUB_LABEL[type]}　直近13週
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 9, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
              border: 'none', cursor: 'pointer',
              color: 'var(--text-dim)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* 統計サマリー行 */}
        {latest !== null && (
          <div style={{
            display: 'flex', gap: 10,
            padding: '0 22px 20px',
            flexShrink: 0,
          }}>
            {[
              { label: '直近', value: latest, colored: true },
              { label: '最大', value: maxV, colored: false },
              { label: '最小', value: minV, colored: false },
            ].map(({ label, value, colored }) => (
              <div key={label} style={{
                flex: 1, padding: '13px 16px', borderRadius: 13,
                background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)'}`,
                display: 'flex', flexDirection: 'column', gap: 7,
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>{label}</div>
                <div style={{
                  fontSize: 17, fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color: colored
                    ? latestCol
                    : (value != null && value >= 0 ? posCol : negCol),
                }}>
                  {value != null ? (value > 0 ? '+' : '') + value.toFixed(2) : '—'}
                  <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-dim)', marginLeft: 3 }}>{cfg.unit}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* セパレーター */}
        <div style={{ height: 1, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', flexShrink: 0 }} />

        {/* チャート */}
        <div style={{ flexShrink: 0, padding: '6px 20px 8px' }}>
          {deltas.length < 2
            ? <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 12 }}>データ不足（2週以上必要）</div>
            : <DeltaChart type={type} deltas={deltas} theme={theme} />
          }
        </div>

        {/* レジェンド */}
        <div style={{ padding: '10px 22px 24px', display: 'flex', gap: 10, fontSize: 11, flexWrap: 'wrap' as const, flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 20,
            background: `${posCol.replace(/[\d.]+\)$/, '0.12)')}`,
            border: `1px solid ${posCol.replace(/[\d.]+\)$/, '0.25)')}`,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: posCol, display: 'inline-block' }} />
            <span style={{ color: 'var(--text-sub)', fontWeight: 600 }}>正（＋）</span>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 20,
            background: `${negCol.replace(/[\d.]+\)$/, '0.12)')}`,
            border: `1px solid ${negCol.replace(/[\d.]+\)$/, '0.25)')}`,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: negCol, display: 'inline-block' }} />
            <span style={{ color: 'var(--text-sub)', fontWeight: 600 }}>負（−）</span>
          </div>
          {(type === 'short_sell' || type === 'advance_decline') && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 20,
              background: isDark ? 'rgba(251,191,36,0.10)' : 'rgba(161,120,0,0.08)',
              border: `1px solid ${isDark ? 'rgba(251,191,36,0.28)' : 'rgba(161,120,0,0.25)'}`,
            }}>
              <span style={{ width: 14, height: 2, background: isDark ? 'rgba(251,191,36,0.92)' : 'rgba(161,120,0,0.92)', display: 'inline-block', borderRadius: 1 }} />
              <span style={{ color: 'var(--text-sub)', fontWeight: 600 }}>4週MA</span>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
