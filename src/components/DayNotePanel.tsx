import { useState, useEffect, useRef, useCallback } from 'react'
import { type DayNote, type ScheduleEntry, getNote, saveNote } from '../utils/noteStorage'
import { TimeField } from './TimeField'

type Props = {
  date: Date | null
  prefillTime?: string
  onClose: () => void
  onSave: () => void
  onAfterSave?: (date: Date, note: DayNote) => void
  onSaved?: () => void
  isMobile?: boolean
}

function calcDefaultEnd(start: string): string {
  const [h, m] = start.split(':').map(Number)
  const total = h * 60 + m + 60
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function DayNotePanel({ date, prefillTime, onClose, onSave, onAfterSave, onSaved, isMobile }: Props) {
  const [title, setTitle]         = useState('')
  const [memo, setMemo]           = useState('')
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([])
  const [isDirty, setIsDirty]     = useState(false)
  const [titleFocused, setTitleFocused] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!date) return
    const note = getNote(date)
    setTitle(note.title)
    setMemo(note.memo)
    let scheds = note.schedules ?? []
    // 古いデータにタイトルなしスケジュールが残っている場合は即座に修正
    const cleaned = scheds.filter(s => s.title.trim())
    if (cleaned.length !== scheds.length) {
      saveNote(date, { ...note, schedules: cleaned })
      scheds = cleaned
    }
    if (prefillTime) {
      const alreadyExists = scheds.some(s => s.startTime === prefillTime)
      if (!alreadyExists) {
        scheds = [...scheds, {
          id: String(Date.now()),
          title: '',
          startTime: prefillTime,
          endTime: calcDefaultEnd(prefillTime),
          alertMinutes: 0,
        }]
      }
    }
    setSchedules(scheds)
    setIsDirty(prefillTime ? true : false)
    setTimeout(() => titleInputRef.current?.focus(), 20)
  }, [date?.toDateString(), prefillTime])

  const persist = (t: string, m: string, schs: ScheduleEntry[]) => {
    if (!date) return
    setIsDirty(true)
    const savedSchs = schs.filter(s => s.title.trim())
    const note: DayNote = { title: t, memo: m, schedules: savedSchs }
    saveNote(date, note)
    onSave()
    onAfterSave?.(date, note)
  }

  // ── ノートフィールド ──
  const handleTitle = (v: string) => { setTitle(v); persist(v, memo, schedules) }
  const handleMemo  = (v: string) => { setMemo(v);  persist(title, v, schedules) }

  // ── スケジュール ──
  const handleSchTitle = (id: string, v: string) => {
    const next = schedules.map(s => s.id === id ? { ...s, title: v } : s)
    setSchedules(next); persist(title, memo, next)
  }
  const handleSchStart = (id: string, v: string) => {
    const next = schedules.map(s => {
      if (s.id !== id) return s
      const endTime = s.endTime || calcDefaultEnd(v)
      return { ...s, startTime: v, endTime }
    })
    setSchedules(next); persist(title, memo, next)
  }
  const handleSchEnd = (id: string, v: string) => {
    const next = schedules.map(s => s.id === id ? { ...s, endTime: v } : s)
    setSchedules(next); persist(title, memo, next)
  }
  const handleSchDelete = (id: string) => {
    const next = schedules.filter(s => s.id !== id)
    setSchedules(next); persist(title, memo, next)
  }
  const handleSchAdd = () => {
    const newSch: ScheduleEntry = {
      id: String(Date.now()),
      title: '',
      startTime: '',
      endTime: '',
      alertMinutes: 0,
    }
    const next = [...schedules, newSch]
    setSchedules(next); persist(title, memo, next)
  }

  const handleClose = useCallback(() => {
    const cleaned = schedules.filter(s => s.title.trim())
    if (cleaned.length !== schedules.length) {
      persist(title, memo, cleaned)
    }
    onClose()
  }, [schedules, title, memo, onClose])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [handleClose])

  const handleDelete = () => {
    if (!date) return
    if (!window.confirm('このメモ・スケジュールを削除してよろしいですか？')) return
    const emptyNote: DayNote = { title: '', memo: '', schedules: [] }
    saveNote(date, emptyNote)
    onAfterSave?.(date, emptyNote)
    onSave()
    onClose()
  }

  const isOpen          = !!date
  const hasContent      = !!(title.trim() || memo.trim() || schedules.length > 0)
  const hasEmptySchTitle = schedules.some(s => !s.title.trim())

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    if (isOpen) {
      setMounted(true)
    } else {
      const t = setTimeout(() => setMounted(false), 160)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  const [vvHeight,    setVvHeight]    = useState<number>(() => typeof window !== 'undefined' ? window.innerHeight : 0)
  const [vvOffsetTop, setVvOffsetTop] = useState<number>(0)
  useEffect(() => {
    if (!isMobile) return
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => {
      setVvHeight(vv.height)
      setVvOffsetTop(vv.offsetTop ?? 0)
    }
    vv.addEventListener('resize', onResize)
    onResize()
    return () => vv.removeEventListener('resize', onResize)
  }, [isMobile])
  const keyboardOpen = isMobile && vvHeight < window.innerHeight * 0.80

  const dateLabel = date
    ? date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
    : ''

  if (!mounted) return null

  return (
    <>
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 299,
          background: 'rgba(0,0,0,0.55)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.15s',
        }}
        onClick={handleClose}
      />

      <div
        style={{
          position: 'fixed',
          ...(keyboardOpen
            ? {
                top: vvOffsetTop + 8,
                left: '50%',
                transform: isOpen ? 'translateX(-50%) scale(1)' : 'translateX(-50%) scale(0.96)',
                maxHeight: vvHeight - 16,
              }
            : {
                top: '50%',
                left: '50%',
                transform: isOpen
                  ? 'translate(-50%, -50%) scale(1)'
                  : 'translate(-50%, -50%) scale(0.96)',
                ...(isMobile
                  ? { maxHeight: 'calc(100vh - 80px)' }
                  : { height: 'calc(100vh - 80px)' }),
              }
          ),
          width: 'min(750px, calc(100vw - 32px))',
          zIndex: 300,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.15s, transform 0.15s cubic-bezier(0.4,0,0.2,1), top 0.2s cubic-bezier(0.4,0,0.2,1), max-height 0.2s',
          willChange: 'transform, opacity',
          display: 'flex', flexDirection: 'column',
          background: 'var(--modal-bg)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: 16,
          border: '1px solid var(--glass-border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.40)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="daynote-panel-header"
      >
        {/* ── ヘッダー ── */}
        <div style={styles.modalHeader}>
          <span id="daynote-panel-header" style={styles.dateChip}>{dateLabel}</span>
          <button style={styles.closeBtn} onClick={handleClose} aria-label="閉じる">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ── タイトル ── */}
        <div style={styles.titleSection}>
          <input
            ref={titleInputRef}
            value={title}
            onChange={e => handleTitle(e.target.value)}
            onFocus={() => setTitleFocused(true)}
            onBlur={() => setTitleFocused(false)}
            placeholder="タイトルを追加..."
            style={{
              ...styles.titleInput,
              borderBottomColor: titleFocused ? 'var(--accent)' : 'var(--glass-border)',
            }}
          />
        </div>

        {/* ── スクロールボディ ── */}
        <div style={styles.body}>

          {/* スケジュール */}
          <section style={styles.section}>
            <div style={styles.sectionTitle}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              スケジュール
              {schedules.length > 0 && (
                <span style={styles.countBadge}>{schedules.length}</span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {schedules.map(sch => (
                <div key={sch.id} style={styles.schedCard}>
                  <div style={styles.schedCardHeader}>
                    <input
                      value={sch.title}
                      onChange={e => handleSchTitle(sch.id, e.target.value)}
                      placeholder="スケジュールのタイトル"
                      style={styles.schTitleInput}
                    />
                    <button style={styles.schDeleteBtn} onClick={() => handleSchDelete(sch.id)} title="削除">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                  <div style={styles.schedCardBody}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--text-dim)', flexShrink: 0 }}>
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <TimeField value={sch.startTime} onChange={v => handleSchStart(sch.id, v)} placeholder="開始" />
                    <span style={styles.timeSep}>—</span>
                    <TimeField value={sch.endTime} onChange={v => handleSchEnd(sch.id, v)} placeholder="終了" />
                  </div>
                </div>
              ))}
            </div>

            {hasEmptySchTitle && (
              <div style={{ fontSize: 11, color: 'rgba(255,100,80,0.90)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                スケジュールのタイトルを入力してください
              </div>
            )}

            <button style={styles.addSchBtn} onClick={handleSchAdd}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              スケジュールを追加
            </button>
          </section>

          {/* メモ */}
          <section style={{ ...styles.section, ...(!isMobile ? styles.sectionGrow : {}) }}>
            <div style={styles.sectionTitle}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              メモ
            </div>
            <textarea
              value={memo}
              onChange={e => handleMemo(e.target.value)}
              placeholder="メモを入力..."
              style={{ ...styles.textarea, ...(!isMobile ? styles.textareaGrow : {}) }}
            />
          </section>

        </div>

        {/* ── フッター ── */}
        <div style={styles.footer}>
          {hasContent
            ? <button style={styles.deleteBtn} onClick={handleDelete}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/>
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
                削除
              </button>
            : <div />
          }
          <button
            disabled={!isDirty || hasEmptySchTitle}
            style={{ ...styles.saveFooterBtn, ...(!isDirty || hasEmptySchTitle ? styles.saveFooterBtnDisabled : {}) }}
            onClick={() => { onSaved?.(); onClose() }}
          >保存</button>
        </div>
      </div>
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  modalHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px 0',
    flexShrink: 0,
  },
  dateChip: {
    fontSize: 12, color: 'var(--text-sub)', fontWeight: 500,
  },
  closeBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, borderRadius: 6,
    color: 'var(--text-sub)',
  },
  titleSection: {
    padding: '10px 20px 4px',
    flexShrink: 0,
  },
  titleInput: {
    width: '100%', background: 'none', border: 'none',
    borderBottom: '2px solid',
    color: 'var(--text)',
    fontSize: 20, fontWeight: 700,
    padding: '2px 0 8px', fontFamily: 'inherit', outline: 'none',
    transition: 'border-bottom-color 0.15s',
  },
  body: {
    flex: 1, overflowY: 'auto',
    padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20,
  },
  section: { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionGrow: { flex: 1, minHeight: 0 },
  sectionTitle: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
    textTransform: 'uppercase' as const,
    color: 'var(--text-sub)',
  },
  countBadge: {
    marginLeft: 4, fontSize: 11, fontWeight: 600,
    color: 'var(--text-sub)', background: 'var(--bg-medium)',
    borderRadius: 10, padding: '1px 7px',
  },
  // スケジュールカード
  schedCard: {
    background: 'var(--bg-item)',
    border: '1px solid var(--border-dim)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  schedCardHeader: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 10px 6px',
    borderBottom: '1px solid var(--border-dim)',
  },
  schTitleInput: {
    flex: 1, background: 'none', border: 'none', outline: 'none',
    color: 'var(--text)', fontSize: 13, fontWeight: 600,
    fontFamily: 'inherit',
  },
  schDeleteBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 22, height: 22, borderRadius: 4, flexShrink: 0,
    color: 'var(--text-dim)',
  },
  schedCardBody: {
    display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const,
    padding: '6px 10px 8px',
  },
  timeSep: { color: 'var(--text-dim)', fontSize: 13 },
  addSchBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 14px', borderRadius: 8,
    background: 'rgba(96,165,250,0.08)', border: '1px dashed rgba(96,165,250,0.30)',
    color: 'var(--accent)', fontSize: 12, fontWeight: 600,
    alignSelf: 'flex-start',
    cursor: 'pointer',
  },
  // メモ
  textarea: {
    background: 'var(--bg-subtle)',
    border: '1px solid var(--glass-border)',
    borderRadius: 10, color: 'var(--text)',
    fontSize: 13, lineHeight: 1.65, padding: '10px 12px',
    width: '100%', resize: 'vertical' as const, minHeight: 80,
    fontFamily: 'inherit', outline: 'none',
  },
  textareaGrow: { flex: 1, resize: 'none' as const, height: '100%', minHeight: 0 },
  // フッター
  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 20px',
    borderTop: '1px solid var(--border-dim)',
    flexShrink: 0,
  },
  deleteBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 14px', borderRadius: 8,
    background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.28)',
    color: 'var(--delete-btn-color, rgba(252,165,165,0.90))', fontSize: 12, fontWeight: 600,
  },
  saveFooterBtn: {
    padding: '7px 24px', borderRadius: 8,
    background: 'var(--glass-bg)', border: '1px solid var(--accent)',
    color: 'var(--accent)', fontSize: 12, fontWeight: 700,
    cursor: 'pointer', transition: 'opacity 0.15s',
  },
  saveFooterBtnDisabled: {
    background: 'var(--bg-subtle)', border: '1px solid var(--glass-border)',
    color: 'var(--text-dim)', cursor: 'not-allowed', opacity: 0.5,
  },
}
