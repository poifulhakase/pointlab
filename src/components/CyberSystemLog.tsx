import { useState, useEffect, useRef } from 'react'
import { cy } from '../utils/cyberTheme'

// ── useSystemLog ─────────────────────────────────────
export type LogState = { logLines: string[]; cursorVisible: boolean; typedText: string }

export function useSystemLog(statusLines: string[]): LogState {
  const logIdxRef   = useRef(4)
  const [logLines,      setLogLines]      = useState<string[]>(() => statusLines.slice(0, 4))
  const [cursorVisible, setCursorVisible] = useState(true)
  const [typedText,     setTypedText]     = useState('')
  const typeStateRef = useRef({ line: '', idx: 0 })

  useEffect(() => {
    const id = setInterval(() => {
      setLogLines(prev => {
        const next = [...prev.slice(1), statusLines[logIdxRef.current % statusLines.length]]
        logIdxRef.current++
        return next
      })
    }, 5000)
    return () => clearInterval(id)
  }, []) // eslint-disable-line

  useEffect(() => {
    const id = setInterval(() => setCursorVisible(v => !v), 530)
    return () => clearInterval(id)
  }, [])

  const lastLine = logLines[logLines.length - 1]
  useEffect(() => {
    typeStateRef.current = { line: lastLine, idx: 0 }
    setTypedText('')
    const id = setInterval(() => {
      const st = typeStateRef.current
      if (st.idx >= st.line.length) { clearInterval(id); return }
      st.idx++
      setTypedText(st.line.slice(0, st.idx))
    }, 38)
    return () => clearInterval(id)
  }, [lastLine])

  return { logLines, cursorVisible, typedText }
}

// ── CyberSystemLog ────────────────────────────────────
export function CyberSystemLog({ logLines, cursorVisible, typedText, theme }: LogState & { theme: 'dark' | 'light' }) {
  const c = cy(theme)
  return (
    <div style={{ borderTop: `1px solid ${c.BORDER}`, background: c.LOGBG, padding: '14px 20px 16px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: c.GREEN, boxShadow: `0 0 6px ${c.GREEN}` }} />
        <span style={{ fontFamily: c.FONT, fontSize: 11, color: c.DIM, letterSpacing: '0.12em' }}>SYSTEM LOG ▶ LIVE</span>
      </div>
      {logLines.map((line, i) => (
        <div key={i} style={{
          fontFamily: c.FONT, fontSize: 13,
          color: i === logLines.length - 1 ? c.GREEN : c.FAINT,
          letterSpacing: '0.04em', whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.8,
        }}>
          {i === logLines.length - 1 ? '> ' : '  '}{i === logLines.length - 1 ? typedText : line}
          {i === logLines.length - 1 && <span style={{ opacity: cursorVisible ? 1 : 0 }}>█</span>}
        </div>
      ))}
    </div>
  )
}
