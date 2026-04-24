import { useState } from 'react'
import type { User } from 'firebase/auth'
import type { SyncStatus } from '../hooks/useFirebaseSync'
import { guestLogin } from '../utils/guestAuth'

type Props = {
  isOpen: boolean
  isRequired?: boolean
  onClose: () => void
  onUnlock: () => void
  user: User | null
  syncStatus: SyncStatus
  onSignIn: () => Promise<void>
  onSignOut: () => Promise<void>
  onRetry?: () => void
}

export function AuthModal({ isOpen, isRequired, onClose, onUnlock, user, syncStatus, onSignIn, onSignOut, onRetry }: Props) {
  if (!isOpen) return null

  const handleClose = () => { if (!isRequired) onClose() }

  return (
    <>
      <div style={styles.backdrop} onClick={handleClose} />
      <div style={styles.modal} className="glass">
        {!isRequired && (
          <button style={styles.closeBtn} onClick={handleClose} aria-label="閉じる">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}

        {/* ゲート（isRequired）: ID/PW のみ */}
        {isRequired && <GateView onUnlock={onUnlock} />}

        {/* アカウント管理（歯車から）: Google ログイン/ログアウト */}
        {!isRequired && (
          user
            ? <LoggedInView user={user} syncStatus={syncStatus} onSignOut={async () => { await onSignOut(); onClose() }} onRetry={onRetry} />
            : <SyncView onSignIn={onSignIn} onClose={onClose} />
        )}
      </div>
    </>
  )
}

/** アプリへの入場ゲート: ID + パスワード */
function GateView({ onUnlock }: { onUnlock: () => void }) {
  const [id, setId]           = useState('')
  const [pw, setPw]           = useState('')
  const [error, setError]     = useState('')
  const [showPw, setShowPw]   = useState(false)
  const [savePw, setSavePw]   = useState(true)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (guestLogin(id, pw)) {
      onUnlock()
    } else {
      setError('IDまたはパスワードが違います')
    }
  }

  return (
    <div style={styles.body}>
      <div style={styles.logoWrap}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
      </div>
      <h2 style={styles.title}>ぽいらぼ</h2>
      <p style={styles.subtitle}>IDとパスワードを入力してください</p>

      <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          value={id}
          onChange={e => { setId(e.target.value); setError('') }}
          placeholder="ID"
          autoComplete="username"
          name="username"
          style={styles.input}
        />
        <div style={styles.pwWrap}>
          <input
            value={pw}
            onChange={e => { setPw(e.target.value); setError('') }}
            placeholder="パスワード"
            type={showPw ? 'text' : 'password'}
            autoComplete={savePw ? 'current-password' : 'off'}
            name="password"
            style={{ ...styles.input, paddingRight: 40 }}
          />
          <button style={styles.eyeBtn} onClick={() => setShowPw(v => !v)} type="button">
            {showPw
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            }
          </button>
        </div>

        {/* パスワード保存チェックボックス */}
        <label style={styles.checkLabel}>
          <input
            type="checkbox"
            checked={savePw}
            onChange={e => setSavePw(e.target.checked)}
            style={styles.checkbox}
          />
          <span>パスワードをブラウザに保存</span>
        </label>

        {error && <p style={styles.error}>{error}</p>}
        <button
          type="submit"
          style={{ ...styles.loginBtn, opacity: !id || !pw ? 0.5 : 1 }}
          disabled={!id || !pw}
        >
          ログイン
        </button>
      </form>
    </div>
  )
}

/** 同期設定（歯車 → 未 Google ログイン時） */
function SyncView({ onSignIn, onClose }: { onSignIn: () => Promise<void>; onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleGoogle = async () => {
    setLoading(true)
    setError('')
    try {
      await onSignIn()
      onClose()
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code ?? ''
      const msg  = (e as { message?: string })?.message ?? ''
      setError(`${code || 'error'}: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.body}>
      <div style={styles.logoWrap}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
          <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
      </div>
      <h2 style={styles.title}>クラウド同期</h2>
      <p style={styles.subtitle}>Googleアカウントでログインするとスマホ・PC間でメモを同期できます</p>

      <div style={styles.featureList}>
        {['📱 スマホ・PC でメモを自動同期', '☁️ 直近2年分をバックアップ'].map(t => (
          <div key={t} style={styles.featureItem}><span style={styles.featureText}>{t}</span></div>
        ))}
      </div>

      {error && <p style={styles.error}>{error}</p>}

      <button
        style={{ ...styles.googleBtn, opacity: loading ? 0.7 : 1 }}
        onClick={handleGoogle}
        disabled={loading}
      >
        {loading ? <span style={styles.spinner} /> : <GoogleIcon />}
        <span>{loading ? 'ログイン中...' : 'Googleでログイン'}</span>
      </button>
    </div>
  )
}

/** Google ログイン済み: アカウント情報 */
function LoggedInView({ user, syncStatus, onSignOut, onRetry }: {
  user: User
  syncStatus: SyncStatus
  onSignOut: () => void
  onRetry?: () => void
}) {
  const syncLabel: Record<string, string> = {
    idle: 'クラウド同期有効', syncing: '同期中...', synced: '同期済み', error: '同期エラー',
  }
  const syncColor: Record<string, string> = {
    idle: 'var(--text-sub)', syncing: 'var(--accent)',
    synced: 'rgba(96,200,140,0.9)', error: 'rgba(255,120,100,0.9)',
  }

  return (
    <div style={styles.body}>
      <div style={styles.avatarWrap}>
        {user.photoURL
          ? <img src={user.photoURL} alt="" style={styles.avatar} referrerPolicy="no-referrer" />
          : <div style={styles.avatarFallback}>{(user.displayName ?? user.email ?? '?')[0]}</div>
        }
      </div>
      <h2 style={styles.title}>{user.displayName ?? user.email}</h2>
      <p style={styles.subtitle}>{user.email}</p>
      <div style={styles.syncRow}>
        <span style={{ ...styles.syncDot, background: syncColor[syncStatus] }} />
        <span style={{ color: syncColor[syncStatus], fontSize: 13, fontWeight: 500 }}>
          {syncLabel[syncStatus]}
        </span>
        {syncStatus === 'error' && onRetry && (
          <button style={styles.retryBtn} onClick={onRetry}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
            </svg>
            再試行
          </button>
        )}
      </div>
      <div style={styles.featureList}>
        {['📱 スマホ・PC でメモを自動同期中', '☁️ 直近2年分をバックアップ'].map(t => (
          <div key={t} style={styles.featureItem}><span style={styles.featureText}>{t}</span></div>
        ))}
      </div>
      <button style={styles.signOutBtn} onClick={onSignOut}>Googleログアウト</button>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 399,
    background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
  },
  modal: {
    position: 'fixed', top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 'min(380px, calc(100vw - 32px))',
    maxHeight: 'calc(100vh - 40px)', overflowY: 'auto',
    zIndex: 400, borderRadius: 20,
    background: 'var(--modal-bg)',
    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid var(--glass-border)',
    boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
    padding: '32px 28px 28px',
  },
  closeBtn: {
    position: 'absolute', top: 14, right: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, borderRadius: 6,
    color: 'var(--text-sub)', cursor: 'pointer',
  },
  body: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 },
  logoWrap: {
    width: 56, height: 56, borderRadius: '50%',
    background: 'var(--bg-subtle)', border: '1px solid var(--glass-border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  avatarWrap: { width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--glass-border)' },
  avatar: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarFallback: {
    width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--accent)', color: '#fff', fontSize: 26, fontWeight: 700,
  },
  title: { fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 },
  subtitle: { fontSize: 13, color: 'var(--text-sub)', margin: 0, textAlign: 'center' },
  input: {
    width: '100%', padding: '10px 14px', borderRadius: 10,
    background: 'var(--bg-subtle)', border: '1px solid var(--glass-border)',
    color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
  },
  pwWrap: { position: 'relative', width: '100%' },
  eyeBtn: {
    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
    display: 'flex', alignItems: 'center', color: 'var(--text-dim)', cursor: 'pointer',
  },
  loginBtn: {
    width: '100%', padding: '11px 20px', borderRadius: 10,
    background: 'var(--accent)', border: 'none',
    color: '#fff', fontSize: 14, fontWeight: 700,
    cursor: 'pointer', transition: 'opacity 0.15s',
  },
  googleBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    width: '100%', padding: '11px 20px', borderRadius: 12,
    background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(0,0,0,0.12)',
    color: '#3c4043', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', transition: 'opacity 0.15s',
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
  },
  spinner: {
    display: 'inline-block', width: 16, height: 16, borderRadius: '50%',
    border: '2px solid rgba(60,64,67,0.3)', borderTopColor: '#3c4043',
    animation: 'spin 0.7s linear infinite', flexShrink: 0,
  },
  featureList: {
    width: '100%', background: 'var(--bg-subtle)', border: '1px solid var(--glass-border)',
    borderRadius: 12, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6,
  },
  featureItem: { display: 'flex', alignItems: 'center' },
  featureText: { fontSize: 13, color: 'var(--text-sub)' },
  syncRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const },
  retryBtn: {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
    color: 'rgba(255,120,100,0.9)', cursor: 'pointer',
    background: 'rgba(255,100,80,0.10)', border: '1px solid rgba(255,100,80,0.25)',
  },
  syncDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  checkLabel: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontSize: 12, color: 'var(--text-sub)', cursor: 'pointer',
    userSelect: 'none', margin: '6px 0',
  },
  checkbox: { width: 14, height: 14, accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 },
  error: { fontSize: 12, color: 'rgba(255,120,100,0.9)', margin: 0 },
  signOutBtn: {
    padding: '9px 24px', borderRadius: 10,
    background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)',
    color: 'rgba(252,165,165,0.90)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
}
