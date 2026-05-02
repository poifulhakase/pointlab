import { useState, useEffect } from 'react'
import { getSettings, saveSettings, type AppSettings } from '../utils/settingsStorage'

type Props = {
  isOpen: boolean
  onClose: () => void
}

export function SettingsPanel({ isOpen, onClose }: Props) {
  const [s, setS] = useState<AppSettings>(getSettings)
  const [notifStatus, setNotifStatus] = useState<NotificationPermission>('default')

  useEffect(() => {
    if ('Notification' in window) setNotifStatus(Notification.permission)
  }, [isOpen])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

  const update = (patch: Partial<AppSettings>) => {
    const next = { ...s, ...patch }
    setS(next)
    saveSettings(next)
  }

  const requestBrowserPermission = async () => {
    const result = await Notification.requestPermission()
    setNotifStatus(result)
    if (result === 'granted') update({ browserNotifEnabled: true })
  }

  const testBrowserNotif = () => {
    if (notifStatus !== 'granted') return
    new Notification('🔔 テスト通知', { body: 'ぽいロボからのアラートテストです', icon: '/favicon.png' })
  }

  return (
    <>
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 399,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
          opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.22s',
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: isOpen ? 'translate(-50%,-50%) scale(1)' : 'translate(-50%,-50%) scale(0.95)',
          width: 'min(480px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 80px)',
          zIndex: 400,
          opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.22s, transform 0.22s cubic-bezier(0.4,0,0.2,1)',
          display: 'flex', flexDirection: 'column',
          background: 'var(--modal-bg)',
          backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)',
          borderRadius: 16,
          border: '1px solid var(--glass-border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div style={st.header}>
          <span style={st.title}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
            カレンダー通知
          </span>
          <button style={st.closeBtn} onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ボディ */}
        <div style={st.body}>
          <section style={st.section}>
            <div style={st.sectionTitle}>ブラウザ通知</div>
            <div style={st.row}>
              <Toggle
                checked={s.browserNotifEnabled && notifStatus === 'granted'}
                disabled={notifStatus === 'denied'}
                onChange={v => update({ browserNotifEnabled: v })}
                label="ブラウザ通知を有効にする"
              />
            </div>
            {notifStatus === 'default' && (
              <button style={st.actionBtn} onClick={requestBrowserPermission}>
                通知を許可する（ブラウザに確認）
              </button>
            )}
            {notifStatus === 'denied' && (
              <p style={st.hint}>ブラウザ設定から通知を許可してください。</p>
            )}
            {notifStatus === 'granted' && (
              <button style={{ ...st.actionBtn, marginTop: 4 }} onClick={testBrowserNotif}>
                テスト通知を送る
              </button>
            )}
          </section>
        </div>
      </div>
    </>
  )
}

function Toggle({ checked, disabled = false, onChange, label }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1 }}>
      <span
        style={{
          width: 36, height: 20, borderRadius: 10, flexShrink: 0,
          background: checked && !disabled ? 'var(--accent-glass)' : 'var(--toggle-track)',
          position: 'relative', transition: 'background 0.18s',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
        onClick={() => !disabled && onChange(!checked)}
      >
        <span style={{
          position: 'absolute', top: 2, left: checked ? 18 : 2,
          width: 16, height: 16, borderRadius: '50%', background: 'white',
          transition: 'left 0.18s',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }} />
      </span>
      <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>{label}</span>
    </label>
  )
}

const st: Record<string, React.CSSProperties> = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-dim)', flexShrink: 0 },
  title:  { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--text)' },
  closeBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, color: 'var(--text-sub)' },
  body:   { flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 24 },
  section: { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionTitle: { fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: 'var(--text-dim)', marginBottom: 2 },
  row: { display: 'flex', alignItems: 'center' },
  actionBtn: { padding: '7px 14px', borderRadius: 8, background: 'rgba(96,165,250,0.14)', border: '1px solid rgba(96,165,250,0.30)', color: 'var(--accent)', fontSize: 12, fontWeight: 600, width: 'fit-content' },
  hint: { fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.7, marginTop: 4 },
}
