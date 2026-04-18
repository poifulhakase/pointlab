import type { User } from 'firebase/auth'
import type { SyncStatus } from '../hooks/useFirebaseSync'

type Props = {
  user: User | null
  syncStatus: SyncStatus
  onSignIn: () => void
  onSignOut: () => void
  onClose: () => void
}

const SYNC_LABEL: Record<SyncStatus, string> = {
  idle:    '',
  syncing: '同期中…',
  synced:  '同期済み ✓',
  error:   '同期エラー',
}

const SYNC_COLOR: Record<SyncStatus, string> = {
  idle:    'var(--text-dim)',
  syncing: 'var(--accent)',
  synced:  'rgba(96,200,140,0.85)',
  error:   'rgba(255,120,100,0.85)',
}

export function AuthButton({ user, syncStatus, onSignIn, onSignOut, onClose }: Props) {
  if (!user) {
    return (
      <button
        style={styles.item}
        onClick={() => { onSignIn(); onClose() }}
      >
        <span style={styles.icon}>
          <GoogleIcon />
        </span>
        <span>Googleでログイン</span>
      </button>
    )
  }

  return (
    <div style={styles.loggedIn}>
      <div style={styles.userRow}>
        {user.photoURL
          ? <img src={user.photoURL} alt="" style={styles.avatar} referrerPolicy="no-referrer" />
          : <span style={styles.avatarFallback}>{(user.displayName ?? user.email ?? '?')[0]}</span>
        }
        <div style={styles.userText}>
          <span style={styles.userName}>{user.displayName ?? user.email}</span>
          {syncStatus !== 'idle' && (
            <span style={{ ...styles.syncLabel, color: SYNC_COLOR[syncStatus] }}>
              {SYNC_LABEL[syncStatus]}
            </span>
          )}
        </div>
      </div>
      <button
        style={styles.signOutBtn}
        onClick={() => { onSignOut(); onClose() }}
      >
        ログアウト
      </button>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

const styles: Record<string, React.CSSProperties> = {
  item: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 16px', fontSize: 13, fontWeight: 500,
    color: 'var(--text)', cursor: 'pointer', textAlign: 'left',
    background: 'transparent', width: '100%',
    transition: 'background 0.1s',
  },
  icon: { display: 'flex', alignItems: 'center' },
  loggedIn: {
    padding: '10px 16px',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  userRow: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: { width: 28, height: 28, borderRadius: '50%', flexShrink: 0 },
  avatarFallback: {
    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
    background: 'var(--accent)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 700,
  },
  userText: { display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 },
  userName: { fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  syncLabel: { fontSize: 10, fontWeight: 500 },
  signOutBtn: {
    alignSelf: 'flex-start',
    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
    color: 'rgba(255,120,100,0.80)',
    background: 'rgba(239,68,68,0.10)',
    border: '1px solid rgba(239,68,68,0.20)',
    cursor: 'pointer',
  },
}
