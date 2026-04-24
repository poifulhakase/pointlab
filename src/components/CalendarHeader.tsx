import { useState } from 'react'
import type { ViewMode } from '../hooks/useCalendar'

type Props = {
  view: ViewMode
  setView: (v: ViewMode) => void
  isMobile: boolean
  isTablet: boolean
  sidebarOpen: boolean
  onMenuClick: () => void
}

const isCalendarView = (v: ViewMode) => v === 'day' || v === 'week' || v === 'month'

// ── ナビアイコン ──────────────────────────────────────
function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
}

function NoteIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <line x1="10" y1="9" x2="8" y2="9"/>
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

function VideoIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7"/>
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>
  )
}

// ── ナビ定義 ─────────────────────────────────────────
const MAIN_VIEWS = [
  { label: 'ホーム',     targetView: 'month'   as ViewMode, isActive: isCalendarView,                icon: <HomeIcon /> },
  { label: 'チャート',   targetView: 'chart'   as ViewMode, isActive: (v: ViewMode) => v === 'chart',  icon: <ChartWaveIcon /> },
  { label: 'データ',     targetView: 'quant'   as ViewMode, isActive: (v: ViewMode) => v === 'quant',  icon: <RobotIcon /> },
  { label: 'ノート',     targetView: 'note'    as ViewMode, isActive: (v: ViewMode) => v === 'note',   icon: <NoteIcon /> },
  { label: 'ムービー',   targetView: 'youtube' as ViewMode, isActive: (v: ViewMode) => v === 'youtube',icon: <VideoIcon /> },
]

// ── コンポーネント ────────────────────────────────────
export function CalendarHeader({ view, setView, isMobile, isTablet, onMenuClick }: Props) {
  const showMenu = isMobile || isTablet
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null)

  return (
    <header style={styles.header} className="glass">
      <div style={styles.left}>
        {/* ハンバーガーボタン */}
        {showMenu && !(isMobile && !isCalendarView(view)) && (
          <button style={styles.menuBtn} onClick={onMenuClick} aria-label="メニュー">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6"  x2="21" y2="6"  />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}

        {/* ロゴ（デスクトップのみ）→ カレンダーホームへ */}
        {!isMobile && (
          <button
            style={{ ...styles.logo, cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
            onClick={() => setView('month')}
            title="カレンダーへ戻る"
          >
            <img src="/logo.svg" alt="ぽいらぼ" style={{ height: 28, objectFit: 'contain', opacity: isCalendarView(view) ? 1 : 0.85, transition: 'opacity 0.15s' }} />
          </button>
        )}
      </div>

      {/* ビュー切替アイコン */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={styles.viewGroup} className="glass">
          {MAIN_VIEWS.map(v => (
            <div key={v.label} style={{ position: 'relative' }}>
              <button
                style={{
                  ...styles.viewBtn,
                  ...(v.isActive(view) ? styles.viewBtnActive : {}),
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
                <div style={styles.tooltip}>{v.label}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </header>
  )
}

// ── エクスポートアイコン（他コンポーネントが使用） ──────
export function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}

export function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  )
}

export function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}

export function BellIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
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
    height: 'var(--header-height)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 12px',
    borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderBottom: 'none',
    flexShrink: 0, position: 'relative', zIndex: 10, gap: 8,
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
    zIndex: 100,
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
