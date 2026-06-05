import { useState } from 'react'
import type { ViewMode } from '../hooks/useCalendar'
import { Z } from '../utils/zIndex'

type Props = {
  view: ViewMode
  setView: (v: ViewMode) => void
  isMobile: boolean
  isTablet: boolean
  sidebarOpen: boolean
  onMenuClick: () => void
  theme?: 'dark' | 'light'
}

const isCalendarView = (v: ViewMode) => v === 'day' || v === 'week' || v === 'month'

// ── ナビアイコン ──────────────────────────────────────
function CalendarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}

function ChartWaveIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
}

function RobotIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V4H8"/>
      <rect width="16" height="12" x="4" y="8" rx="2"/>
      <path d="M2 14h2"/>
      <path d="M20 14h2"/>
      <path d="M15 13v2"/>
      <path d="M9 13v2"/>
    </svg>
  )
}

function LabIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3v8L5.5 16.5A2 2 0 0 0 7.3 20h9.4a2 2 0 0 0 1.8-3.5L15 11V3"/>
      <line x1="6" y1="3" x2="18" y2="3"/>
      <path d="M9 12h6"/>
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )
}

// ── ナビ定義 ─────────────────────────────────────────
const MAIN_VIEWS = [
  { label: 'カレンダー', targetView: 'month'   as ViewMode, isActive: isCalendarView,                    icon: <CalendarIcon /> },
  { label: 'エンジン',   targetView: 'quant'   as ViewMode, isActive: (v: ViewMode) => v === 'quant',    icon: <RobotIcon /> },
  { label: 'シールド',   targetView: 'shield'  as ViewMode, isActive: (v: ViewMode) => v === 'shield',   icon: <ShieldIcon /> },
  { label: 'チャート',   targetView: 'chart'   as ViewMode, isActive: (v: ViewMode) => v === 'chart',    icon: <ChartWaveIcon /> },
  { label: '研究室',     targetView: 'support' as ViewMode, isActive: (v: ViewMode) => v === 'support',  icon: <LabIcon /> },
]

// ── コンポーネント ────────────────────────────────────
export function CalendarHeader({ view, setView, isMobile, isTablet: _isTablet, onMenuClick, theme = 'dark' }: Props) {
  const showMenu = isMobile
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null)

  const isLab    = view === 'support' || view === 'manual' || view === 'backtest' || view === 'evals' || view === 'spec' || view === 'legal' || view === 'playbook' || view === 'original' || view === 'timemachine'
  const useNeon  = isLab && theme === 'dark'
  const neonColor      = '#00e5ff'
  const neonDim        = 'rgba(0,229,255,0.42)'
  const neonActiveBg   = 'rgba(0,229,255,0.12)'
  const neonBg         = 'rgba(4,10,22,0.55)'
  const neonBorder     = 'rgba(0,229,255,0.18)'

  // モバイル: 4分割フル幅レイアウト
  if (isMobile) {
    return (
      <header
        style={{
          height: 'calc(var(--header-height) + env(safe-area-inset-bottom, 0px))',
          display: 'flex', alignItems: 'stretch',
          paddingLeft: '4px', paddingRight: '4px',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderBottom: 'none',
          flexShrink: 0, position: 'relative', zIndex: Z.calendarHeader,
          userSelect: 'none',
          ...(useNeon ? { background: neonBg, borderTop: `1px solid ${neonBorder}` } : {}),
        }}
        className={useNeon ? undefined : 'glass'}
      >
        {MAIN_VIEWS.map(v => {
          const active = v.isActive(view)
          return (
            <button
              key={v.label}
              style={{
                flex: 1,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                color: useNeon ? (active ? neonColor : neonDim) : (active ? 'var(--view-btn-active-color)' : 'var(--text-sub)'),
                transition: 'color 0.15s',
                padding: '4px 2px',
              }}
              onClick={() => setView(v.targetView)}
              aria-label={v.label}
            >
              <span style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 4,
                width: active ? '90%' : 'auto',
                padding: '6px 8px',
                borderRadius: 10,
                background: active ? (useNeon ? neonActiveBg : 'var(--view-btn-active-bg)') : 'transparent',
                boxShadow: active && useNeon ? `0 0 12px ${neonColor}28` : active ? '0 2px 8px rgba(100,120,200,0.15)' : 'none',
                transition: 'background 0.15s, box-shadow 0.15s',
              }}>
                {v.icon}
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.02em', lineHeight: 1, whiteSpace: 'nowrap' }}>
                  {v.label}
                </span>
              </span>
            </button>
          )
        })}
      </header>
    )
  }

  // デスクトップ / タブレット
  const desktopHeaderStyle: React.CSSProperties = useNeon
    ? { ...styles.header, background: neonBg, borderTop: `1px solid ${neonBorder}`, backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }
    : styles.header

  return (
    <header style={desktopHeaderStyle} className={useNeon ? undefined : 'glass'}>
      <div style={styles.left}>
        {/* ハンバーガーボタン */}
        {showMenu && (
          <button style={styles.menuBtn} onClick={onMenuClick} aria-label="メニュー">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6"  x2="21" y2="6"  />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}

        {/* ロゴ → カレンダーホームへ */}
        <button
          style={{ ...styles.logo, cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
          onClick={() => setView('month')}
          title="カレンダーへ戻る"
        >
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="ぽいロボ" style={{ height: 28, objectFit: 'contain', opacity: isCalendarView(view) ? 1 : 0.85, transition: 'opacity 0.15s' }} />
        </button>
      </div>

      {/* ビュー切替アイコン */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div
          style={useNeon
            ? { ...styles.viewGroup, background: 'rgba(0,229,255,0.06)', border: `1px solid ${neonBorder}` }
            : styles.viewGroup}
          className={useNeon ? undefined : 'glass'}
        >
          {MAIN_VIEWS.map(v => (
            <div key={v.label} style={{ position: 'relative' }}>
              <button
                style={{
                  ...styles.viewBtn,
                  ...(v.isActive(view)
                    ? useNeon
                      ? { background: neonActiveBg, color: neonColor, boxShadow: `0 0 14px ${neonColor}30` }
                      : styles.viewBtnActive
                    : useNeon
                      ? { color: neonDim }
                      : {}),
                }}
                onClick={() => setView(v.targetView)}
                onMouseEnter={() => setHoveredLabel(v.label)}
                onMouseLeave={() => setHoveredLabel(null)}
                aria-label={v.label}
              >
                {v.icon}
              </button>

              {/* ホバーラベル（上方向に表示） */}
              {hoveredLabel === v.label && (
                <div style={useNeon
                  ? { ...styles.tooltip, background: 'rgba(4,10,22,0.92)', border: `1px solid ${neonBorder}`, color: neonColor, boxShadow: `0 0 8px ${neonColor}28` }
                  : styles.tooltip
                }>{v.label}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </header>
  )
}

// ── エクスポートアイコン（他コンポーネントが使用） ──────
export function MonitorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  )
}

export function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}

export function ChevronLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}
export function ChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

// ── スタイル ─────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  header: {
    height: 'calc(var(--header-height) + env(safe-area-inset-bottom, 0px))',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 12px',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderBottom: 'none',
    flexShrink: 0, position: 'relative', zIndex: Z.calendarHeader, gap: 8,
    userSelect: 'none',
  },
  left: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
  menuBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 36, height: 36, borderRadius: 8, color: 'var(--text-sub)', flexShrink: 0,
  },
  logo: { display: 'flex', alignItems: 'center', gap: 6, marginLeft: 6, marginRight: 4, flexShrink: 0 },
  viewGroup: {
    display: 'flex', borderRadius: 10, overflow: 'visible', padding: 3, gap: 2, flexShrink: 0,
  },
  viewBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 42, height: 38, borderRadius: 7,
    color: 'var(--text-sub)', cursor: 'pointer',
    transition: 'color 0.15s',
  },
  viewBtnActive: {
    background: 'var(--view-btn-active-bg)', color: 'var(--view-btn-active-color)',
    boxShadow: '0 2px 8px rgba(100,120,200,0.15)',
  },
  tooltip: {
    position: 'absolute',
    bottom: 'calc(100% + 6px)',
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: 10, fontWeight: 600,
    color: 'var(--text-sub)',
    background: 'var(--modal-bg)',
    border: '1px solid var(--glass-border)',
    borderRadius: 6,
    padding: '3px 8px',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    zIndex: Z.headerTooltip,
  },
  todayBtn:  { padding: '5px 12px', borderRadius: 20, fontSize: 13, fontWeight: 500, color: 'var(--text)', flexShrink: 0 },
  navGroup:  { display: 'flex', gap: 2, flexShrink: 0 },
  navBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, borderRadius: 8, color: 'var(--text-sub)',
  },
  label: {
    fontWeight: 500, letterSpacing: '-0.3px', color: 'var(--text)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
}
