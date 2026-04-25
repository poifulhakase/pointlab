import { createPortal } from 'react-dom'
import { useEffect, useRef } from 'react'
import { createChart, HistogramSeries, LineSeries, ColorType, CrosshairMode } from 'lightweight-charts'
import { type MarginWeekData } from '../utils/jpxMarginData'
import { type ArbitrageWeekData } from '../utils/arbitrageData'
import { type ShortSellWeekData } from '../utils/shortSellData'
import { themeVars } from '../utils/themeVars'

export type DeltaModalType = 'credit_long' | 'arbitrage_long' | 'short_sell'

type Props = {
  type: DeltaModalType
  marData: MarginWeekData[]
  arbData: ArbitrageWeekData[]
  ssData: ShortSellWeekData[]
  theme: 'dark' | 'light'
  onClose: () => void
}

const CONFIG: Record<DeltaModalType, { title: string; checkpoint: string; unit: string; positiveIsBad: boolean; interpretation: string }> = {
  credit_long: {
    title: '信用買い残 Δ（前週比 %）',
    checkpoint: '逆行の深さ',
    unit: '%',
    positiveIsBad: true,
    interpretation: '価格が下落しているのにΔが正（＋）なら、将来の「強制売りボタン」が次々と予約されている状態。信用評価損益率が深いマイナス圏にある時期のΔ＋は特に危険なシグナル。Δが連続してプラスの場合は信用整理が進んでいないため、下値余地が拡大していると解釈する。',
  },
  arbitrage_long: {
    title: '裁定買い残 Δ（週次変化 億円）',
    checkpoint: '解消の加速度',
    unit: '億円',
    positiveIsBad: false,
    interpretation: 'Δがマイナス方向に拡大（急加速）し始めたら、現物株の大規模売却が始まった「物理的な崩落」の合図。連続するマイナスBarが前週より大きくなっている加速パターンを特に警戒すること。残高が 3.5 兆円超でΔが急落した場合は最も危険な組み合わせ。',
  },
  short_sell: {
    title: '空売り比率 Δ（週次変化 pp）',
    checkpoint: 'ヘッジの真剣度',
    unit: 'pp',
    positiveIsBad: true,
    interpretation: '40%という基準値だけでなく、Δが急増していれば「プロが下落を確信して一刻も早く売り叩こうとしている」という緊急性を読み取れる。4週移動平均線（黄線）がゼロを上抜けした局面は空売りトレンドの転換点。逆にΔが急低下（踏み上げ）する場合は短期の急反騰シグナル。',
  },
}

function toIso(d: string) { return d.replace(/\//g, '-') }

function computeDeltas(
  type: DeltaModalType,
  marData: MarginWeekData[],
  arbData: ArbitrageWeekData[],
  ssData: ShortSellWeekData[],
): { time: string; value: number }[] {
  const N = 14
  if (type === 'credit_long') {
    const arr = [...marData].slice(0, N).reverse()
    return arr.slice(1).map((row, i) => {
      const prev = arr[i]
      const v = prev.longBal > 0 ? Math.round((row.longBal - prev.longBal) / prev.longBal * 10000) / 100 : 0
      return { time: toIso(row.date), value: v }
    })
  }
  if (type === 'arbitrage_long') {
    const arr = [...arbData].slice(0, N).reverse()
    return arr.slice(1).map((row, i) => {
      const prev = arr[i]
      return { time: toIso(row.date), value: Math.round((row.longBal - prev.longBal) / 100) }
    })
  }
  const arr = [...ssData].slice(0, N).reverse()
  return arr.slice(1).map((row, i) => {
    const prev = arr[i]
    return { time: toIso(row.date), value: Math.round((row.ratio - prev.ratio) * 100) / 100 }
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
        background: { type: ColorType.Solid, color: isDark ? 'rgba(20,22,35,0.0)' : 'rgba(248,250,255,0.0)' },
        textColor: isDark ? 'rgba(180,185,210,0.8)' : 'rgba(40,45,70,0.8)',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
        horzLines: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderVisible: false },
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

    if (type === 'short_sell') {
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

  return <div ref={ref} style={{ height: 190 }} />
}

export function DeltaModal({ type, marData, arbData, ssData, theme, onClose }: Props) {
  const tv = themeVars(theme)
  const cfg = CONFIG[type]
  const deltas = computeDeltas(type, marData, arbData, ssData)
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
        <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 2, flexShrink: 0 }}>
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
          </svg>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{cfg.title}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3 }}>
              チェックポイント：
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{cfg.checkpoint}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 20, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>×</button>
        </div>

        {/* Chart */}
        <div style={{ flexShrink: 0, padding: '0 4px' }}>
          {deltas.length < 2
            ? <div style={{ height: 190, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 12 }}>データ不足（2週以上必要）</div>
            : <DeltaChart type={type} deltas={deltas} theme={theme} />
          }
        </div>

        {/* Legend */}
        <div style={{ padding: '4px 18px 0', display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-dim)', flexWrap: 'wrap', flexShrink: 0 }}>
          <span>
            <span style={{ color: cfg.positiveIsBad ? (isLight ? 'rgba(200,50,30,0.9)' : 'rgba(255,100,80,0.9)') : (isLight ? 'rgba(26,115,232,0.9)' : 'rgba(96,165,250,0.9)') }}>■</span>
            {' '}正（＋）
          </span>
          <span>
            <span style={{ color: cfg.positiveIsBad ? (isLight ? 'rgba(26,115,232,0.9)' : 'rgba(96,165,250,0.9)') : (isLight ? 'rgba(200,50,30,0.9)' : 'rgba(255,100,80,0.9)') }}>■</span>
            {' '}負（−）
          </span>
          {type === 'short_sell' && (
            <span style={{ color: isLight ? 'rgba(161,120,0,0.9)' : 'rgba(251,191,36,0.9)' }}>— 4週MA</span>
          )}
        </div>

        {/* Interpretation */}
        <div style={{ padding: '12px 18px 16px', fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.75, overflowY: 'auto' }}>
          <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>解釈</div>
          {cfg.interpretation}
        </div>
      </div>
    </div>,
    document.body,
  )
}
