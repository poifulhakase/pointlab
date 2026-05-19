import { useEffect } from 'react'

type User = { displayName?: string | null; email?: string | null; photoURL?: string | null } | null

type Props = {
  isOpen: boolean
  onClose: () => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  darkStyle: 'neutral' | 'blue'
  onChangeDarkStyle: (s: 'neutral' | 'blue') => void
  user: User
  syncStatus: string
  onOpenAccount: () => void
  isAdmin: boolean
  onOpenSpec: () => void
  pushEnabled: boolean
  onTogglePush: () => void
}

export function SettingsPanel({ isOpen, onClose, theme, onToggleTheme, darkStyle, onChangeDarkStyle, user, syncStatus, onOpenAccount, isAdmin, onOpenSpec, pushEnabled, onTogglePush }: Props) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onClose])

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
          width: 'min(420px, calc(100vw - 32px))',
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
          <span style={st.title}>設定</span>
          <button style={st.closeBtn} onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ボディ */}
        <div style={st.body}>

          {/* アカウント */}
          <section style={st.section}>
            <div style={st.sectionTitle}>アカウント</div>
            <button style={st.accountRow} onClick={() => { onClose(); onOpenAccount() }}>
              <span style={st.accountLeft}>
                {user?.photoURL
                  ? <img src={user.photoURL} alt="" style={st.avatar} referrerPolicy="no-referrer" />
                  : <span style={st.avatarPlaceholder}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                      </svg>
                    </span>
                }
                <span style={st.accountInfo}>
                  <span style={st.accountName}>
                    {user ? (user.displayName ?? user.email ?? 'アカウント') : 'Googleでログイン'}
                  </span>
                  {user && (
                    <span style={st.accountSub}>
                      {syncStatus === 'synced' ? '同期済み' : syncStatus === 'syncing' ? '同期中...' : user.email ?? ''}
                    </span>
                  )}
                </span>
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-dim)', flexShrink: 0 }}>
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </section>

          {/* 通知 */}
          <section style={st.section}>
            <div style={st.sectionTitle}>通知</div>
            <div style={{ ...st.accountRow, cursor: user ? 'pointer' : 'default', opacity: user ? 1 : 0.5 }}
              onClick={user ? onTogglePush : undefined}>
              <span style={st.accountLeft}>
                <span style={{ ...st.avatarPlaceholder, background: pushEnabled && user ? 'rgba(96,165,250,0.15)' : 'var(--glass-border)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={pushEnabled && user ? 'rgba(96,165,250,0.9)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                </span>
                <span style={st.accountInfo}>
                  <span style={st.accountName}>プッシュ通知</span>
                  <span style={st.accountSub}>
                    {!user ? 'ログインが必要です' : pushEnabled ? 'ON — 前日 12:30 に通知' : 'OFF'}
                  </span>
                </span>
              </span>
              {/* トグルスイッチ */}
              <span style={{
                width: 40, height: 22, borderRadius: 11, flexShrink: 0,
                background: pushEnabled && user ? 'rgba(96,165,250,0.85)' : 'var(--glass-border)',
                position: 'relative', transition: 'background 0.2s',
                display: 'inline-block',
              }}>
                <span style={{
                  position: 'absolute', top: 3, left: pushEnabled && user ? 21 : 3,
                  width: 16, height: 16, borderRadius: '50%',
                  background: 'white', transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </span>
            </div>
          </section>

          {/* 表示 */}
          <section style={st.section}>
            <div style={st.sectionTitle}>表示</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                style={{ ...st.themeBtn, ...(theme === 'light' ? st.themeBtnActive : {}) }}
                onClick={() => { if (theme !== 'light') onToggleTheme() }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
                ライト
              </button>
              <button
                style={{ ...st.themeBtn, ...(theme === 'dark' ? st.themeBtnActive : {}) }}
                onClick={() => { if (theme !== 'dark') onToggleTheme() }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
                ダーク
              </button>
            </div>

            {/* ダークスタイル（ダーク時のみ表示） */}
            {theme === 'dark' && (
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <button
                  style={{ ...st.styleBtn, ...(darkStyle === 'neutral' ? st.styleBtnActive : {}) }}
                  onClick={() => onChangeDarkStyle('neutral')}
                >
                  ニュートラル
                </button>
                <button
                  style={{ ...st.styleBtn, ...(darkStyle === 'blue' ? st.styleBtnActive : {}) }}
                  onClick={() => onChangeDarkStyle('blue')}
                >
                  ブルー（元）
                </button>
              </div>
            )}
          </section>

          {/* システム仕様（管理者のみ） */}
          {isAdmin && (
            <section style={st.section}>
              <div style={st.sectionTitle}>開発者</div>
              <button style={st.actionBtn} onClick={() => { onClose(); onOpenSpec() }}>
                システム仕様を開く
              </button>
            </section>
          )}

        </div>
      </div>
    </>
  )
}

const st: Record<string, React.CSSProperties> = {
  header:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-dim)', flexShrink: 0 },
  title:     { fontSize: 15, fontWeight: 700, color: 'var(--text)' },
  closeBtn:  { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, color: 'var(--text-sub)' },
  body:      { padding: '20px', display: 'flex', flexDirection: 'column', gap: 24 },
  section:   { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionTitle: { fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: 'var(--text-dim)', display: 'block' },

  themeBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    color: 'var(--text-sub)', border: '1px solid var(--glass-border)',
    background: 'transparent', cursor: 'pointer', transition: 'all 0.15s',
  },
  themeBtnActive: {
    background: 'var(--view-btn-active-bg)', color: 'var(--view-btn-active-color)',
    borderColor: 'transparent', boxShadow: '0 2px 8px rgba(100,120,200,0.15)',
  },

  styleBtn: {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 500,
    color: 'var(--text-sub)', border: '1px solid var(--glass-border)',
    background: 'transparent', cursor: 'pointer', transition: 'all 0.15s',
  },
  styleBtnActive: {
    background: 'var(--bg-subtle)', color: 'var(--text)',
    borderColor: 'var(--accent)', boxShadow: '0 0 0 1px var(--accent) inset',
  },

  accountRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
    background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
    transition: 'background 0.15s', textAlign: 'left',
  },
  accountLeft:  { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  accountInfo:  { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  accountName:  { fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  accountSub:   { fontSize: 11, color: 'var(--text-dim)' },
  avatar:       { width: 32, height: 32, borderRadius: '50%', flexShrink: 0 },
  avatarPlaceholder: { width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-sub)' },

  actionBtn: { padding: '8px 14px', borderRadius: 8, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-sub)', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left' as const },
}
