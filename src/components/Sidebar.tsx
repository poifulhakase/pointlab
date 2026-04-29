import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ClockWidget } from './ClockWidget'
import { StickyNoteModal } from './StickyNoteModal'
import { newStickyNote, type StickyNote } from '../utils/stickyNotes'
import { type MacroFilter, MACRO_COLOR } from '../utils/macroCalendar'
import { ANOMALY_COLOR } from '../utils/anomalyCalendar'

type Props = {
  current?: Date
  today?: Date
  isOpen: boolean
  isMobile: boolean
  isTablet: boolean
  macroFilter: MacroFilter
  onMacroFilterChange: (f: MacroFilter) => void
  stickyNotes: StickyNote[]
  onStickyNotesSaved: (notes: StickyNote[]) => void
  showPrivate: boolean
  onShowPrivateChange: (v: boolean) => void
  showAnomaly: boolean
  onShowAnomalyChange: (v: boolean) => void
}

const FILTER_ITEMS: { key: keyof MacroFilter; label: string; sub: string }[] = [
  { key: 'us', label: '米国',  sub: 'FOMC・雇用統計・CPI・PCE・GDP' },
  { key: 'jp', label: '日本',  sub: '日銀決定会合・短観・メジャーSQ・ミニSQ・権利付最終日・権利落ち日・権利確定日' },
]

export function Sidebar({ isOpen, isMobile, isTablet, macroFilter, onMacroFilterChange, stickyNotes: notes, onStickyNotesSaved, showPrivate, onShowPrivateChange, showAnomaly, onShowAnomalyChange }: Props) {
  const isFixed = isMobile

  // ── スティッキーメモ ──────────────────────────────
  const [editingNote, setEditingNote] = useState<StickyNote | null>(null)
  const [toast, setToast] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(true)
    toastTimer.current = setTimeout(() => setToast(false), 2500)
  }

  const handleAddNote = () => {
    if (notes.length >= 1) return
    setEditingNote(newStickyNote())
  }

  const handleSaveNote = (content: string) => {
    if (!editingNote) return
    const exists = notes.some(n => n.id === editingNote.id)
    const updated = exists
      ? notes.map(n => n.id === editingNote.id ? { ...n, content, updatedAt: new Date().toISOString() } : n)
      : [...notes, { ...editingNote, content, updatedAt: new Date().toISOString() }]
    onStickyNotesSaved(updated)
    setEditingNote(null)
    showToast()
  }

  const handleDeleteNote = (id: string) => {
    if (!window.confirm('このメモを削除してよろしいですか？')) return
    onStickyNotesSaved(notes.filter(n => n.id !== id))
  }

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
    <>
    <aside style={sidebarStyle} className={isFixed ? '' : 'glass'}>
      <div style={contentStyle}>

        {/* 時計・市場ステータス・カウントダウン */}
        <ClockWidget isMobile={isMobile} />

        {/* マーケットイベント・スティッキーメモ（下部固定） */}
        <div style={{ marginTop: 'auto' }}>

        {/* ──── スティッキーメモ ──── */}
        <div style={styles.memoWrap}>
          <div style={styles.memoHeader}>
            <span style={styles.memoHeading}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              メモ
            </span>
            {notes.length < 1 && (
              <button
                onClick={handleAddNote}
                style={styles.memoAddBtn}
                aria-label="メモを追加"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            )}
          </div>

          {notes.length === 0 && (
            <button onClick={handleAddNote} style={styles.memoEmptyBtn}>
              ＋ タップして追加
            </button>
          )}

          {notes.map(note => (
            <div key={note.id} style={styles.memoCard}>
              <button
                onClick={() => setEditingNote(note)}
                style={styles.memoCardText}
                title={note.content || '（空のメモ）'}
              >
                {note.content ? (note.content.split('\n').find(l => l.trim()) ?? '（空のメモ）') : '（空のメモ）'}
              </button>
              <button
                onClick={() => handleDeleteNote(note.id)}
                style={styles.memoDeleteBtn}
                aria-label="削除"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* ──── プライベート ──── */}
        <div style={styles.privateWrap}>
          <label style={styles.filterRow}>
            <span
              style={{
                ...styles.customCheckbox,
                background: showPrivate ? 'rgba(96,165,250,0.85)' : 'transparent',
                borderColor: showPrivate ? 'rgba(96,165,250,0.85)' : 'var(--text-dim)',
              }}
              onClick={() => onShowPrivateChange(!showPrivate)}
            >
              {showPrivate && (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </span>
            <span style={styles.filterLabel} onClick={() => onShowPrivateChange(!showPrivate)}>
              <span style={{ ...styles.filterCountry, color: showPrivate ? 'var(--text)' : 'var(--text-dim)' }}>
                プライベート
              </span>
              <span style={{ ...styles.filterSub, color: showPrivate ? 'var(--text-sub)' : 'var(--text-dim)' }}>
                メモ・スケジュールを表示
              </span>
            </span>
          </label>
        </div>

        {/* ──── マーケット情報フィルター ──── */}
        <div style={{ ...styles.filterWrap, marginTop: 0, borderTop: 'none', borderBottom: '1px solid var(--border-dim)' }}>
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
                  background: macroFilter[item.key] ? MACRO_COLOR : 'transparent',
                  borderColor: macroFilter[item.key] ? MACRO_COLOR : 'var(--text-dim)',
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

          {/* アノマリー（PC限定・月ビューのみ） */}
          {!isMobile && (
            <label style={styles.filterRow}>
              <span
                style={{
                  ...styles.customCheckbox,
                  background: showAnomaly ? ANOMALY_COLOR : 'transparent',
                  borderColor: showAnomaly ? ANOMALY_COLOR : 'var(--text-dim)',
                }}
                onClick={() => onShowAnomalyChange(!showAnomaly)}
              >
                {showAnomaly && (
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </span>
              <span style={styles.filterLabel} onClick={() => onShowAnomalyChange(!showAnomaly)}>
                <span style={{ ...styles.filterCountry, color: showAnomaly ? 'var(--text)' : 'var(--text-dim)' }}>
                  アノマリー
                </span>
                <span style={{ ...styles.filterSub, color: showAnomaly ? 'var(--text-sub)' : 'var(--text-dim)' }}>
                  節分天井・彼岸底・セルインメイ等
                </span>
              </span>
            </label>
          )}
        </div>

        </div>

      </div>
    </aside>

    {/* メモモーダル（createPortal で body 直下にレンダリング） */}
    {editingNote && (
      <StickyNoteModal
        note={editingNote}
        onSave={handleSaveNote}
        onClose={() => setEditingNote(null)}
      />
    )}

    {/* 保存トースト */}
    {createPortal(
      <div style={{
        position: 'fixed', bottom: 88, right: 24, zIndex: 9999,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 16px', borderRadius: 12,
        background: 'var(--glass-bg-strong)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        border: '1px solid var(--glass-border)',
        boxShadow: 'var(--glass-shadow)',
        fontSize: 13, fontWeight: 500, color: 'var(--text)',
        pointerEvents: 'none',
        opacity: toast ? 1 : 0,
        transform: toast ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.2s, transform 0.2s',
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="8" cy="8" r="7.5" stroke="rgba(96,165,250,0.8)" />
          <path d="M4.5 8l2.5 2.5 4.5-5" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        保存しました
      </div>,
      document.body,
    )}
  </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  memoWrap: {
    padding: '10px 14px 12px',
    borderBottom: '1px solid var(--border-dim)',
  },
  memoHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 6,
  },
  memoHeading: {
    display: 'flex', alignItems: 'center', gap: 5,
    fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
    textTransform: 'uppercase' as const,
    color: 'var(--text-dim)',
  },
  memoAddBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 20, height: 20, borderRadius: 5,
    color: 'var(--text-dim)', cursor: 'pointer',
    transition: 'color 0.15s',
  },
  memoEmptyBtn: {
    width: '100%', padding: '6px 8px', borderRadius: 6,
    fontSize: 11, color: 'var(--text-dim)', textAlign: 'left' as const,
    cursor: 'pointer',
    border: '1px dashed var(--border-dim)',
    background: 'transparent',
  },
  memoCard: {
    display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4,
  },
  memoCardText: {
    flex: 1, padding: '5px 8px', borderRadius: 6,
    fontSize: 11, color: 'var(--text-sub)', textAlign: 'left' as const,
    cursor: 'pointer',
    background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
    transition: 'background 0.15s',
  },
  memoDeleteBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 20, height: 20, borderRadius: 5, flexShrink: 0,
    color: 'var(--text-dim)', cursor: 'pointer',
    transition: 'color 0.15s',
  },
  createBtn: {
    display: 'flex', alignItems: 'center', gap: 8,
    margin: '8px 16px 0',
    padding: '14px 16px', borderRadius: 24,
    fontSize: 14, fontWeight: 600,
    color: 'var(--text)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
    flexShrink: 0,
  },
  privateWrap: {
    padding: '10px 16px 12px',
    borderBottom: '1px solid var(--border-dim)',
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
    whiteSpace: 'normal' as const,
    lineHeight: 1.5,
  },
}
