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

const MAIN_VIEWS: { label: string; targetView: ViewMode; isActive: (v: ViewMode) => boolean }[] = [
  { label: 'カレンダー', targetView: 'month',   isActive: isCalendarView },
  { label: 'チャート', targetView: 'chart',   isActive: v => v === 'chart' },
  { label: '需給',   targetView: 'quant',   isActive: v => v === 'quant' },
  { label: '動画',   targetView: 'youtube', isActive: v => v === 'youtube' },
]

export function CalendarHeader({ view, setView, isMobile, isTablet, onMenuClick }: Props) {
  const showMenu = isMobile || isTablet

  return (
    <header style={styles.header} className="glass">
      <div style={styles.left}>
        {/* ハンバーガー / トグルボタン（スマホ+非カレンダービューでは非表示） */}
        {showMenu && !(isMobile && !isCalendarView(view)) && (
          <button style={styles.menuBtn} onClick={onMenuClick} aria-label="メニュー">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6"  x2="21" y2="6"  />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}

        {/* ロゴ（デスクトップのみ）→ クリックで仕様書ビューへ */}
        {!isMobile && (
          <button
            style={{ ...styles.logo, cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
            onClick={() => setView('spec')}
            title="説明書を開く"
          >
            <img src="/logo.svg" alt="ぽいらぼ" style={{ height: 28, objectFit: 'contain', opacity: view === 'spec' ? 1 : 0.85, transition: 'opacity 0.15s' }} />
          </button>
        )}

        {/* 今日ボタン・ナビ・ラベルはcalSubBarに移動したため非表示 */}
      </div>

      {/* 右側：ビュー切替 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={styles.viewGroup} className="glass">
          {MAIN_VIEWS.map(v => (
            <button
              key={v.label}
              style={{
                ...styles.viewBtn,
                ...(v.isActive(view) ? styles.viewBtnActive : {}),
                ...(isMobile ? { padding: '6px 11px', fontSize: 14 } : {}),
              }}
              onClick={() => setView(v.targetView)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
    </header>
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

const styles: Record<string, React.CSSProperties> = {
  header: {
    height: 'var(--header-height)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 12px',
    borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderBottom: 'none',
    flexShrink: 0, zIndex: 10, gap: 8,
    userSelect: 'none',
  },
  left:    { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 },
  menuBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 36, height: 36, borderRadius: 8, color: 'var(--text-sub)', flexShrink: 0,
  },
  logo:      { display: 'flex', alignItems: 'center', gap: 6, marginLeft: 6, marginRight: 4, flexShrink: 0 },
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
  viewGroup: {
    display: 'flex', borderRadius: 10, overflow: 'hidden', padding: 3, gap: 2, flexShrink: 0,
  },
  viewBtn: {
    padding: '5px 12px', borderRadius: 7, fontSize: 13, fontWeight: 500, color: 'var(--text-sub)',
  },
  viewBtnActive: {
    background: 'var(--view-btn-active-bg)', color: 'var(--view-btn-active-color)',
    boxShadow: '0 2px 8px rgba(100,120,200,0.15)',
  },
}
