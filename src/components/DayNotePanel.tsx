import { useState, useEffect, useRef } from 'react'
import { type CheckItem, type DayNote, type ScheduleEntry, getNote, saveNote } from '../utils/noteStorage'
import { TimeField } from './TimeField'
import { CustomSelect } from './CustomSelect'

type Props = {
  date: Date | null
  prefillTime?: string
  onClose: () => void
  onSave: () => void
  onAfterSave?: (date: Date, note: DayNote) => void
  onSaved?: () => void
  isMobile?: boolean
}

const ALERT_OPTIONS = [
  { value: 0,  label: 'アラートなし' },
  { value: 5,  label: '5分前' },
  { value: 10, label: '10分前' },
  { value: 15, label: '15分前' },
  { value: 30, label: '30分前' },
  { value: 60, label: '1時間前' },
]

function calcDefaultEnd(start: string): string {
  const [h, m] = start.split(':').map(Number)
  const total = h * 60 + m + 60
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function DayNotePanel({ date, prefillTime, onClose, onSave, onAfterSave, onSaved, isMobile }: Props) {
  const [title, setTitle]         = useState('')
  const [memo, setMemo]           = useState('')
  const [checklist, setChecklist] = useState<CheckItem[]>([])
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([])
  const [newText, setNewText]     = useState('')
  const [isDirty, setIsDirty]     = useState(false)
  const [titleFocused, setTitleFocused] = useState(false)
  const addInputRef   = useRef<HTMLInputElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!date) return
    const note = getNote(date)
    setTitle(note.title)
    setMemo(note.memo)
    setChecklist(note.checklist)
    let scheds = note.schedules ?? []
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
    setNewText('')
    setIsDirty(prefillTime ? true : false)
    setTimeout(() => titleInputRef.current?.focus(), 20)
  }, [date?.toDateString(), prefillTime])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  const persist = (t: string, m: string, cl: CheckItem[], schs: ScheduleEntry[]) => {
    if (!date) return
    setIsDirty(true)
    const note: DayNote = { title: t, memo: m, checklist: cl, schedules: schs }
    saveNote(date, note)
    onSave()
    onAfterSave?.(date, note)
  }

  // ── ノートフィールド ──
  const handleTitle = (v: string) => { setTitle(v); persist(v, memo, checklist, schedules) }
  const handleMemo  = (v: string) => { setMemo(v);  persist(title, v, checklist, schedules) }

  // ── スケジュール ──
  const handleSchTitle = (id: string, v: string) => {
    const next = schedules.map(s => s.id === id ? { ...s, title: v } : s)
    setSchedules(next); persist(title, memo, checklist, next)
  }
  const handleSchStart = (id: string, v: string) => {
    const next = schedules.map(s => {
      if (s.id !== id) return s
      const endTime = s.endTime || calcDefaultEnd(v)
      return { ...s, startTime: v, endTime }
    })
    setSchedules(next); persist(title, memo, checklist, next)
  }
  const handleSchEnd = (id: string, v: string) => {
    const next = schedules.map(s => s.id === id ? { ...s, endTime: v } : s)
    setSchedules(next); persist(title, memo, checklist, next)
  }
  const handleSchAlert = (id: string, v: number) => {
    const next = schedules.map(s => s.id === id ? { ...s, alertMinutes: v } : s)
    setSchedules(next); persist(title, memo, checklist, next)
  }
  const handleSchDelete = (id: string) => {
    const next = schedules.filter(s => s.id !== id)
    setSchedules(next); persist(title, memo, checklist, next)
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
    setSchedules(next); persist(title, memo, checklist, next)
  }

  // ── チェックリスト ──
  const toggleItem = (id: string) => {
    const next = checklist.map(i => i.id === id ? { ...i, done: !i.done } : i)
    setChecklist(next); persist(title, memo, next, schedules)
  }
  const deleteItem = (id: string) => {
    const next = checklist.filter(i => i.id !== id)
    setChecklist(next); persist(title, memo, next, schedules)
  }
  const clearDone = () => {
    const next = checklist.filter(i => !i.done)
    setChecklist(next); persist(title, memo, next, schedules)
  }
  const addItem = () => {
    const text = newText.trim()
    if (!text) return
    const next = [...checklist, { id: String(Date.now()), text, done: false }]
    setChecklist(next); setNewText(''); persist(title, memo, next, schedules)
    setTimeout(() => addInputRef.current?.focus(), 0)
  }

  const handleDelete = () => {
    if (!date) return
    if (!window.confirm('このメモ・スケジュールを削除してよろしいですか？')) return
    saveNote(date, { title: '', memo: '', checklist: [], schedules: [] })
    onSave()
    onClose()
  }

  const doneCount  = checklist.filter(i => i.done).length
  const progress   = checklist.length > 0 ? Math.round(doneCount / checklist.length * 100) : 0
  const isOpen     = !!date
  const hasContent = !!(title.trim() || memo.trim() || checklist.length > 0 || schedules.length > 0)

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    if (isOpen) {
      setMounted(true)
    } else {
      const t = setTimeout(() => setMounted(false), 160)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  const [vvHeight, setVvHeight] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerHeight : 0
  )
  useEffect(() => {
    if (!isMobile) return
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => setVvHeight(vv.height)
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
        onClick={onClose}
      />

      <div
        style={{
          position: 'fixed',
          ...(keyboardOpen
            ? {
                top: 8,
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
      >
        {/* ── ヘッダー ── */}
        <div style={styles.modalHeader}>
          <span style={styles.dateChip}>{dateLabel}</span>
          <button style={styles.closeBtn} onClick={onClose} aria-label="閉じる">
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
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: sch.alertMinutes ? 'var(--accent)' : 'var(--text-dim)', flexShrink: 0, marginLeft: 4 }}>
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                    <CustomSelect
                      value={sch.alertMinutes}
                      onChange={v => handleSchAlert(sch.id, v)}
                      options={ALERT_OPTIONS}
                      icon={null}
                    />
                  </div>
                </div>
              ))}
            </div>

            <button style={styles.addSchBtn} onClick={handleSchAdd}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              スケジュールを追加
            </button>
          </section>

          {/* チェックリスト */}
          <section style={styles.section}>
            <div style={styles.sectionTitle}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 11 12 14 22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              チェックリスト
              {checklist.length > 0 && (
                <span style={styles.countBadge}>{doneCount} / {checklist.length}</span>
              )}
              {doneCount > 0 && (
                <button style={styles.clearBtn} onClick={clearDone}>完了済みを削除</button>
              )}
            </div>

            {checklist.length > 0 && (
              <div style={styles.progressWrap}>
                <span style={styles.progressPct}>{progress}%</span>
                <div style={styles.progressTrack}>
                  <div style={{ ...styles.progressFill, width: `${progress}%` }} />
                </div>
              </div>
            )}

            <div style={styles.itemList}>
              {checklist.map(item => (
                <div key={item.id} style={styles.itemRow}>
                  <button
                    style={{
                      ...styles.checkbox,
                      background: item.done ? 'rgba(96,165,250,0.8)' : 'transparent',
                      borderColor: item.done ? '#60a5fa' : 'rgba(255,255,255,0.30)',
                    }}
                    onClick={() => toggleItem(item.id)}
                  >
                    {item.done && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </button>
                  <span style={{ ...styles.itemText, textDecoration: item.done ? 'line-through' : 'none', opacity: item.done ? 0.40 : 1 }}>
                    {item.text}
                  </span>
                  <button style={styles.delBtn} onClick={() => deleteItem(item.id)}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <div style={styles.addRow}>
              <input
                ref={addInputRef}
                value={newText}
                onChange={e => setNewText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addItem() }}
                placeholder="+ 項目を追加..."
                style={styles.addInput}
              />
              {newText.trim() && (
                <button style={styles.addBtn} onClick={addItem}>追加</button>
              )}
            </div>
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
            disabled={!isDirty}
            style={{ ...styles.saveFooterBtn, ...(!isDirty ? styles.saveFooterBtnDisabled : {}) }}
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
  clearBtn: {
    marginLeft: 'auto', fontSize: 10, fontWeight: 500,
    color: 'rgba(255,100,100,0.65)',
    textTransform: 'none' as const, letterSpacing: 0,
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
    color: 'rgba(96,165,250,0.75)', fontSize: 12, fontWeight: 600,
    alignSelf: 'flex-start',
    cursor: 'pointer',
  },
  // チェックリスト
  progressWrap: { display: 'flex', alignItems: 'center', gap: 8 },
  progressPct: { fontSize: 10, fontWeight: 700, color: 'var(--accent)', minWidth: 28, textAlign: 'right' as const },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, background: 'var(--bg-medium)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, rgba(96,165,250,0.7), rgba(96,165,250,1))', transition: 'width 0.25s ease' },
  itemList: { display: 'flex', flexDirection: 'column', gap: 2 },
  itemRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '7px 10px', borderRadius: 8,
    background: 'var(--bg-item)',
    border: '1px solid var(--border-dim)',
  },
  checkbox: {
    width: 18, height: 18, borderRadius: 4, flexShrink: 0,
    border: '1.5px solid', display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s',
  },
  itemText: { flex: 1, fontSize: 13, color: 'var(--text)', lineHeight: 1.4, transition: 'opacity 0.15s' },
  delBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 22, height: 22, borderRadius: 4, flexShrink: 0,
    color: 'var(--text-dim)',
  },
  addRow: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 },
  addInput: {
    flex: 1, background: 'var(--bg-subtle)',
    border: '1px solid var(--glass-border)',
    borderRadius: 8, color: 'var(--text)',
    fontSize: 13, padding: '8px 12px', fontFamily: 'inherit', outline: 'none',
  },
  addBtn: {
    padding: '8px 14px', borderRadius: 8,
    background: 'rgba(96,165,250,0.20)', border: '1px solid rgba(96,165,250,0.35)',
    color: 'var(--accent)', fontSize: 12, fontWeight: 600, flexShrink: 0,
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
    color: 'rgba(252,165,165,0.90)', fontSize: 12, fontWeight: 600,
  },
  saveFooterBtn: {
    padding: '7px 24px', borderRadius: 8,
    background: 'rgba(96,165,250,0.18)', border: '1px solid rgba(96,165,250,0.45)',
    color: 'rgba(96,165,250,1)', fontSize: 12, fontWeight: 700,
    cursor: 'pointer', transition: 'opacity 0.15s',
  },
  saveFooterBtnDisabled: {
    background: 'var(--bg-subtle)', border: '1px solid var(--glass-border)',
    color: 'var(--text-dim)', cursor: 'not-allowed', opacity: 0.5,
  },
}
