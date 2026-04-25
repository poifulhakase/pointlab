import { createPortal } from 'react-dom'
import { useEffect, useRef } from 'react'
import { createChart, HistogramSeries, LineSeries, ColorType, CrosshairMode } from 'lightweight-charts'
import { type MarginWeekData } from '../utils/jpxMarginData'
import { type ArbitrageWeekData } from '../utils/arbitrageData'
import { type ShortSellWeekData } from '../utils/shortSellData'
import { type AdvanceDeclineWeekData } from '../utils/advanceDeclineData'
import { themeVars } from '../utils/themeVars'

export type DeltaModalType = 'credit_long' | 'arbitrage_long' | 'short_sell' | 'advance_decline'

type Props = {
  type: DeltaModalType
  marData: MarginWeekData[]
  arbData: ArbitrageWeekData[]
  ssData: ShortSellWeekData[]
  adData: AdvanceDeclineWeekData[]
  theme: 'dark' | 'light'
  onClose: () => void
}

const CONFIG: Record<DeltaModalType, { title: string; unit: string; positiveIsBad: boolean }> = {
  credit_long:      { title: '信用買い残 Δ（前週比 %）',    unit: '%',  positiveIsBad: true  },
  arbitrage_long:   { title: '裁定買い残 Δ（週次変化 億円）', unit: '億円', positiveIsBad: false },
  short_sell:       { title: '空売り比率 Δ（週次変化 pp）',  unit: 'pp', positiveIsBad: true  },
  advance_decline:  { title: '騰落レシオ Δ（週次変化 pp）',  unit: 'pp', positiveIsBad: true  },
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
    // marData は降順（新→古）前提
    const arr = [...marData].sort((a, b) => b.date.localeCompare(a.date)).slice(0, N).reverse()
    return arr.slice(1).map((row, i) => {
      const prev = arr[i]
      const v = prev.longBal > 0 ? Math.round((row.longBal - prev.longBal) / prev.longBal * 10000) / 100 : 0
      return { time: toIso(row.date), value: v }
    })
  }
  if (type === 'arbitrage_long') {
    // arbData は降順（新→古）で揃えてから処理
    const arr = [...arbData].sort((a, b) => b.date.localeCompare(a.date)).slice(0, N).reverse()
    return arr.slice(1).map((row, i) => {
      const prev = arr[i]
      return { time: toIso(row.date), value: Math.round((row.longBal - prev.longBal) / 100) }
    })
  }
  if (type === 'short_sell') {
    const arr = [...ssData].sort((a, b) => b.date.localeCompare(a.date)).slice(0, N).reverse()
    return arr.slice(1).map((row, i) => {
      const prev = arr[i]
      return { time: toIso(row.date), value: Math.round((row.ratio - prev.ratio) * 100) / 100 }
    })
  }
  // advance_decline: adData は降順前提
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
        textColor: isDark ? 'rgba(180,185,210,0.8)' : 'rgba(40,45,70,0.8)',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
        horzLines: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.08 } },
      timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
      autoSize: true,
    })

    const posColor = cfg.positiveIsBad
      ? (isDark ? 'rgba(255,100,80,0.82)' : 'rgba(200,50,30,0.82)')
      : (isDark ? 'rgba(96,165,250,0.80)' : 'rgba(26,115,232,0.80)')
    const negColor = cfg.positiveIsBad
      ? (isDark ? 'rgba(96,165,250,0.80)' : 'rgba(26,115,232,0.80)')
      : (isDark ? 'rgba(255,100,80,0.82)' : 'rgba(200,50,30,0.82)')

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
  const isLight = theme === 'light'

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        style={{
          ...tv,
          background: 'var(--modal-bg)',
          border: '1px solid var(--glass-border)',
          borderRadius: 16,
          boxShadow: '0 24px 64px rgba(0,0,0,0.38)',
          width: '92vw', maxWidth: 560,
          maxHeight: '88vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
          </svg>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{cfg.title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 20, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>×</button>
        </div>

        {/* Chart */}
        <div style={{ flexShrink: 0, padding: '0 4px' }}>
          {deltas.length < 2
            ? <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 12 }}>データ不足（2週以上必要）</div>
            : <DeltaChart type={type} deltas={deltas} theme={theme} />
          }
        </div>

        {/* Legend */}
        <div style={{ padding: '4px 18px 14px', display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-dim)', flexWrap: 'wrap', flexShrink: 0 }}>
          <span>
            <span style={{ color: cfg.positiveIsBad ? (isLight ? 'rgba(200,50,30,0.9)' : 'rgba(255,100,80,0.9)') : (isLight ? 'rgba(26,115,232,0.9)' : 'rgba(96,165,250,0.9)') }}>■</span>
            {' '}正（＋）
          </span>
          <span>
            <span style={{ color: cfg.positiveIsBad ? (isLight ? 'rgba(26,115,232,0.9)' : 'rgba(96,165,250,0.9)') : (isLight ? 'rgba(200,50,30,0.9)' : 'rgba(255,100,80,0.9)') }}>■</span>
            {' '}負（−）
          </span>
          {(type === 'short_sell' || type === 'advance_decline') && (
            <span style={{ color: isLight ? 'rgba(161,120,0,0.9)' : 'rgba(251,191,36,0.9)' }}>— 4週MA</span>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
