import { MiniCalendar } from './MiniCalendar'
import { type MacroFilter } from '../utils/macroCalendar'

type Props = {
  current: Date
  today: Date
  onSelect: (date: Date) => void
  onNavigate: (delta: number) => void
  isOpen: boolean
  isMobile: boolean
  isTablet: boolean
  macroFilter: MacroFilter
  onMacroFilterChange: (f: MacroFilter) => void
  onCreateNote: () => void
}

const FILTER_ITEMS: { key: keyof MacroFilter; label: string; sub: string; color: string }[] = [
  { key: 'us', label: '米国',  sub: 'FOMC・雇用統計・CPI・PCE・GDP', color: '#f59e0b' },
  { key: 'jp', label: '日本',  sub: '日銀決定会合・短観',             color: '#f87171' },
]

export function Sidebar({ current, today, onSelect, onNavigate, isOpen, isMobile, isTablet, macroFilter, onMacroFilterChange, onCreateNote }: Props) {
  const isFixed = isMobile

  const sidebarStyle: React.CSSProperties = isFixed
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        height: 'calc(100% - var(--header-height))',
        width: 'var(--sidebar-width)',
        zIndex: 200,
        transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        borderRadius: 0,
        borderTop: 'none', borderBottom: 'none', borderLeft: 'none',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        padding: '16px 0',
        background: 'var(--sidebar-fixed-bg)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '4px 0 24px rgba(0,0,0,0.25)',
        userSelect: 'none',
      }
    : {
        width: isOpen ? 'var(--sidebar-width)' : 0,
        minWidth: 0, flexShrink: 0,
        overflow: 'hidden',
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
        borderRadius: 0,
        borderTop: 'none', borderBottom: 'none', borderLeft: 'none',
        display: 'flex', flexDirection: 'column',
        padding: isOpen ? '0' : '0',
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }

  const contentStyle: React.CSSProperties = {
    width: 'var(--sidebar-width)',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    ...(isTablet && !isMobile
      ? { background: 'var(--glass-bg)', backdropFilter: 'blur(24px)', borderRight: '1px solid var(--glass-border)' }
      : {}),
  }

  return (
    <aside style={sidebarStyle} className={isFixed ? '' : 'glass'}>
      <div style={contentStyle}>

        {/* 作成ボタン */}
        <button style={styles.createBtn} className="glass" onClick={onCreateNote}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          本日のスケジュール追加
        </button>

        {/* ミニカレンダー（月タイトルをMonthViewのカード先頭に合わせる） */}
        <div style={{ marginTop: 46 }}>
          <MiniCalendar
            current={current}
            today={today}
            onSelect={onSelect}
            onNavigate={onNavigate}
          />
        </div>

        {/* ──── マーケット情報フィルター（左下） ──── */}
        <div style={styles.filterWrap}>
          <div style={styles.filterHeading}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            マーケットイベント
          </div>

          {FILTER_ITEMS.map(item => (
            <label key={item.key} style={styles.filterRow}>
              <span
                style={{
                  ...styles.customCheckbox,
                  background: macroFilter[item.key] ? item.color : 'transparent',
                  borderColor: macroFilter[item.key] ? item.color : 'var(--text-dim)',
                }}
                onClick={() => onMacroFilterChange({ ...macroFilter, [item.key]: !macroFilter[item.key] })}
              >
                {macroFilter[item.key] && (
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </span>
              <span style={styles.filterLabel} onClick={() => onMacroFilterChange({ ...macroFilter, [item.key]: !macroFilter[item.key] })}>
                <span style={{ ...styles.filterCountry, color: macroFilter[item.key] ? 'var(--text)' : 'var(--text-dim)' }}>
                  {item.label}
                </span>
                <span style={{ ...styles.filterSub, color: macroFilter[item.key] ? 'var(--text-sub)' : 'var(--text-dim)' }}>
                  {item.sub}
                </span>
              </span>
            </label>
          ))}
        </div>

      </div>
    </aside>
  )
}

const styles: Record<string, React.CSSProperties> = {
  createBtn: {
    display: 'flex', alignItems: 'center', gap: 8,
    margin: '8px 16px 0',
    padding: '14px 16px', borderRadius: 24,
    fontSize: 14, fontWeight: 600,
    color: 'var(--text)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
    flexShrink: 0,
  },
  filterWrap: {
    marginTop: 'auto',
    padding: '14px 16px 16px',
    borderTop: '1px solid var(--border-dim)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  filterHeading: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
    textTransform: 'uppercase' as const,
    color: 'var(--text-dim)',
    marginBottom: 2,
  },
  filterRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    cursor: 'pointer',
    userSelect: 'none' as const,
  },
  customCheckbox: {
    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
    border: '1.5px solid',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s',
    cursor: 'pointer',
  },
  filterLabel: {
    display: 'flex', flexDirection: 'column' as const, gap: 1, cursor: 'pointer',
  },
  filterCountry: {
    fontSize: 12, fontWeight: 600,
    transition: 'color 0.15s',
  },
  filterSub: {
    fontSize: 10,
    transition: 'color 0.15s',
  },
}
