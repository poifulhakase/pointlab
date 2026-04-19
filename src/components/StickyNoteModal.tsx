import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { StickyNote } from '../utils/stickyNotes'

type Props = {
  note: StickyNote
  onSave: (content: string) => void
  onClose: () => void
}

export function StickyNoteModal({ note, onSave, onClose }: Props) {
  const [content, setContent] = useState(note.content)
  const [saved, setSaved] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setContent(note.content)
    const t = setTimeout(() => textareaRef.current?.focus(), 40)
    return () => clearTimeout(t)
  }, [note.id, note.content])

  const handleSave = useCallback(() => {
    onSave(content)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [content, onSave])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave() }
      else if (e.key === 'Escape') { onClose() }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [handleSave, onClose])

  return createPortal(
    <div
      style={styles.overlay}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={styles.modal} className="glass">
        {/* ツールバー */}
        <div style={styles.toolbar}>
          <span style={styles.hint}>Ctrl+S で保存 · Esc で閉じる</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {saved && (
              <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(96,200,140,0.9)' }}>保存しました</span>
            )}
            <button style={styles.saveBtn} onClick={handleSave}>保存</button>
            <button style={styles.closeBtn} onClick={onClose} aria-label="閉じる">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* テキストエリア */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="メモを入力..."
          style={styles.textarea}
        />
      </div>
    </div>,
    document.body,
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.65)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    zIndex: 900,
    display: 'flex', alignItems: 'stretch', justifyContent: 'stretch',
    padding: 20,
  },
  modal: {
    flex: 1, display: 'flex', flexDirection: 'column',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
  },
  toolbar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 16px',
    borderBottom: '1px solid var(--border-dim)',
    flexShrink: 0,
  },
  hint: { fontSize: 11, color: 'var(--text-dim)' },
  saveBtn: {
    padding: '5px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    background: 'var(--accent)', color: '#fff', cursor: 'pointer',
  },
  closeBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 30, height: 30, borderRadius: 8,
    color: 'var(--text-dim)', cursor: 'pointer',
  },
  textarea: {
    flex: 1, resize: 'none',
    padding: '20px 24px',
    fontSize: 15, lineHeight: 1.75,
    color: 'var(--text)',
    background: 'transparent',
    border: 'none', outline: 'none',
    fontFamily: 'inherit',
  },
}
