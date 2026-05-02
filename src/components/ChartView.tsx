import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { themeVars } from '../utils/themeVars'

type Props = {
  theme: 'dark' | 'light'
  isMobile: boolean
  symbol: string
  onSymbolChange: (s: string) => void
  settingsOpen: boolean
  onCloseSettings: () => void
}

// ── 単一チャートパネル ─────────────────────────────────────
function ChartPanel({ symbol, interval, theme, isMobile, height }: { symbol: string; interval: string; theme: 'dark' | 'light'; isMobile?: boolean; height: number }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (height === 0) return
    const el = containerRef.current
    if (!el) return
    el.innerHTML = ''

    const widget = document.createElement('div')
    widget.className = 'tradingview-widget-container__widget'
    widget.style.cssText = 'height:calc(100% - 32px);width:100%;'
    el.appendChild(widget)

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.async = true
    script.text = JSON.stringify({
      autosize: true, symbol,
      interval, timezone: 'Asia/Tokyo', theme,
      style: '1', locale: 'ja',
      allow_symbol_change: true, withdateranges: true,
      hide_side_toolbar: false, calendar: false,
      support_host: 'https://www.tradingview.com',
      studies: [
        'BB@tv-basicstudies',
        'MACD@tv-basicstudies',
      ],
    })
    el.appendChild(script)

    return () => { el.innerHTML = '' }
  }, [symbol, interval, theme, height])

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{ flex: 1, height, minWidth: 0, borderRadius: isMobile ? 0 : 12, overflow: 'hidden', border: isMobile ? 'none' : '1px solid var(--glass-border)' }}
    />
  )
}

// ── レイアウト選択カード用 SVG プレビュー ──────────────────
function LayoutPreview1() {
  return (
    <svg viewBox="0 0 180 108" width="180" height="108" style={{ display: 'block' }}>
      {/* パネル枠 */}
      <rect x="6" y="6" width="168" height="96" rx="7" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.20)" strokeWidth="1.2"/>
      {/* ヘッダーバー */}
      <rect x="6" y="6" width="168" height="22" rx="7" fill="rgba(255,255,255,0.10)"/>
      <rect x="6" y="20" width="168" height="8" fill="rgba(255,255,255,0.10)"/>
      {/* 操作ドット */}
      <circle cx="20" cy="17" r="3.5" fill="rgba(255,255,255,0.30)"/>
      <circle cx="32" cy="17" r="3.5" fill="rgba(255,255,255,0.30)"/>
      <circle cx="44" cy="17" r="3.5" fill="rgba(255,255,255,0.30)"/>
      {/* チャートライン */}
      <polyline points="16,90 34,75 52,82 70,60 88,68 106,50 124,56 142,40 160,44"
        fill="none" stroke="rgba(96,165,250,0.75)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      {/* 塗りつぶし */}
      <polygon points="16,90 34,75 52,82 70,60 88,68 106,50 124,56 142,40 160,44 160,96 16,96"
        fill="rgba(96,165,250,0.08)"/>
      {/* グリッド線 */}
      <line x1="16" y1="96" x2="164" y2="96" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
    </svg>
  )
}

function LayoutPreview2() {
  return (
    <svg viewBox="0 0 180 108" width="180" height="108" style={{ display: 'block' }}>
      {/* 左パネル */}
      <rect x="6" y="6" width="80" height="96" rx="7" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.20)" strokeWidth="1.2"/>
      <rect x="6" y="6" width="80" height="22" rx="7" fill="rgba(255,255,255,0.10)"/>
      <rect x="6" y="20" width="80" height="8" fill="rgba(255,255,255,0.10)"/>
      <circle cx="18" cy="17" r="3" fill="rgba(255,255,255,0.30)"/>
      <circle cx="28" cy="17" r="3" fill="rgba(255,255,255,0.30)"/>
      <circle cx="38" cy="17" r="3" fill="rgba(255,255,255,0.30)"/>
      <polyline points="14,90 26,76 38,83 50,65 62,72 74,55 82,59"
        fill="none" stroke="rgba(96,165,250,0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <polygon points="14,90 26,76 38,83 50,65 62,72 74,55 82,59 82,96 14,96"
        fill="rgba(96,165,250,0.08)"/>
      <line x1="14" y1="96" x2="82" y2="96" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>

      {/* 右パネル */}
      <rect x="94" y="6" width="80" height="96" rx="7" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.20)" strokeWidth="1.2"/>
      <rect x="94" y="6" width="80" height="22" rx="7" fill="rgba(255,255,255,0.10)"/>
      <rect x="94" y="20" width="80" height="8" fill="rgba(255,255,255,0.10)"/>
      <circle cx="106" cy="17" r="3" fill="rgba(255,255,255,0.30)"/>
      <circle cx="116" cy="17" r="3" fill="rgba(255,255,255,0.30)"/>
      <circle cx="126" cy="17" r="3" fill="rgba(255,255,255,0.30)"/>
      <polyline points="102,72 114,85 126,68 138,78 150,55 162,62 170,50"
        fill="none" stroke="rgba(52,211,153,0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <polygon points="102,72 114,85 126,68 138,78 150,55 162,62 170,50 170,96 102,96"
        fill="rgba(52,211,153,0.08)"/>
      <line x1="102" y1="96" x2="170" y2="96" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
    </svg>
  )
}

// ── 設定モーダル ───────────────────────────────────────────
type ModalProps = {
  isOpen: boolean
  onClose: () => void
  split: 1 | 2
  isMobile: boolean
  onApply: (split: 1 | 2) => void
}

function ChartSettingsModal({ isOpen, onClose, split, isMobile, onApply }: ModalProps) {
  const [localSplit, setLocalSplit] = useState<1 | 2>(split)

  useEffect(() => {
    if (isOpen) { setLocalSplit(split) }
  }, [isOpen])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  return (
    <>
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 399,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
          opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.20s',
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: isOpen ? 'translate(-50%,-50%) scale(1)' : 'translate(-50%,-50%) scale(0.96)',
          width: 'min(520px, calc(100vw - 32px))',
          zIndex: 400,
          opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.20s, transform 0.20s cubic-bezier(0.4,0,0.2,1)',
          background: 'var(--modal-bg)',
          backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)',
          borderRadius: 18, border: '1px solid var(--glass-border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.40)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div style={ms.header}>
          <span style={ms.title}>チャート設定</span>
          <button style={ms.closeBtn} onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div style={ms.body}>

          {/* ── レイアウト選択 ── */}
          <section style={ms.section}>
            <div style={ms.sectionTitle}>レイアウト</div>
            <div style={{ display: 'flex', gap: 14 }}>

              {/* 1分割カード */}
              <button
                onClick={() => setLocalSplit(1)}
                style={{
                  ...ms.layoutCard,
                  borderColor: localSplit === 1 ? 'var(--accent)' : 'var(--glass-border)',
                  background: localSplit === 1 ? 'rgba(37,99,235,0.08)' : 'var(--bg-subtle)',
                  boxShadow: localSplit === 1 ? '0 0 0 1px var(--accent)' : 'none',
                }}
              >
                <LayoutPreview1 />
                <div style={{ ...ms.layoutLabel, color: localSplit === 1 ? 'var(--accent)' : 'var(--text-sub)' }}>
                  {localSplit === 1 && <span style={ms.checkBadge}>✓</span>}
                  1分割
                </div>
              </button>

              {/* 2分割カード（モバイルでは非表示） */}
              {!isMobile && (
                <button
                  onClick={() => setLocalSplit(2)}
                  style={{
                    ...ms.layoutCard,
                    borderColor: localSplit === 2 ? 'var(--accent)' : 'var(--glass-border)',
                    background: localSplit === 2 ? 'rgba(37,99,235,0.08)' : 'var(--bg-subtle)',
                    boxShadow: localSplit === 2 ? '0 0 0 1px var(--accent)' : 'none',
                  }}
                >
                  <LayoutPreview2 />
                  <div style={{ ...ms.layoutLabel, color: localSplit === 2 ? 'var(--accent)' : 'var(--text-sub)' }}>
                    {localSplit === 2 && <span style={ms.checkBadge}>✓</span>}
                    2分割
                  </div>
                </button>
              )}

            </div>
            {isMobile && (
              <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                スマートフォンでは1分割のみ対応しています
              </p>
            )}
          </section>

        </div>

        {/* フッター */}
        <div style={ms.footer}>
          <button style={ms.cancelBtn} onClick={onClose}>キャンセル</button>
          <button style={ms.applyBtn} onClick={() => { onApply(localSplit); onClose() }}>
            適用
          </button>
        </div>
      </div>
    </>
  )
}

const ms: Record<string, React.CSSProperties> = {
  header:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--border-dim)', flexShrink: 0 },
  title:       { fontSize: 15, fontWeight: 700, color: 'var(--text)' },
  closeBtn:    { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, color: 'var(--text-sub)', cursor: 'pointer' },
  body:        { padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 22 },
  section:     { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionTitle:{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: 'var(--text-dim)' },
  layoutCard:  {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    padding: '14px 10px 12px', borderRadius: 14, border: '1.5px solid',
    cursor: 'pointer', transition: 'all 0.18s',
  },
  layoutLabel: { fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 },
  checkBadge:  { fontSize: 11, fontWeight: 700, color: 'var(--accent)' },
  footer:      { display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 22px', borderTop: '1px solid var(--border-dim)' },
  cancelBtn:   { padding: '7px 18px', borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--glass-border)', color: 'var(--text-sub)', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  applyBtn:    { padding: '7px 18px', borderRadius: 8, background: 'var(--accent-glass)', border: '1px solid var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
}

// ── メインビュー ───────────────────────────────────────────
export function ChartView({ theme, isMobile, symbol, onSymbolChange: _onSymbolChange, settingsOpen, onCloseSettings }: Props) {
  const [split, setSplit] = useState<1 | 2>(() => {
    const saved = localStorage.getItem('poical-chart-split')
    return saved === '2' ? 2 : 1
  })
  const effectiveSplit = isMobile ? 1 : split
  const [panelsHeight, setPanelsHeight] = useState(0)
  const panelsRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = panelsRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const h = entries[0]?.contentRect.height ?? 0
      if (h > 0) setPanelsHeight(h)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div style={{ ...styles.wrap, ...themeVars(theme) }}>
      <div ref={panelsRef} style={{ ...styles.panels, ...(isMobile ? { padding: '0' } : {}) }}>
        <ChartPanel symbol={symbol} interval="D" theme={theme} isMobile={isMobile} height={panelsHeight} />
        {effectiveSplit === 2 && (
          <>
            <div style={{ width: 10, flexShrink: 0 }} />
            <ChartPanel symbol={symbol} interval="W" theme={theme} isMobile={isMobile} height={panelsHeight} />
          </>
        )}
      </div>

      <ChartSettingsModal
        isOpen={settingsOpen}
        onClose={onCloseSettings}
        split={split}
        isMobile={isMobile}
        onApply={(s) => { setSplit(s); localStorage.setItem('poical-chart-split', String(s)) }}
      />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  wrap:    { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 },
  panels:  { flex: 1, display: 'flex', minHeight: 0, padding: '10px 14px 14px', gap: 8 },
}
