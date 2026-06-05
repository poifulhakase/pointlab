export type NotificationSettingsProps = {
  // 真偽判定（ログイン有無）にのみ使用するため緩い構造型で受ける
  user: { email?: string | null } | null | undefined
  isMember?: boolean
  pushEnabled: boolean
  pushBusy?: boolean
  onTogglePush?: () => void
  notifyRadar: boolean
  onToggleNotifyRadar?: () => void
  notifyDataReady: boolean
  onToggleNotifyDataReady?: () => void
}

/**
 * プッシュ通知の設定セクション（トグル＋種別チェックボックス）。
 * 以前は SettingsPanel と SupportView に同じ markup が二重実装され、
 * 片方だけ更新されてチェックボックスが欠落するバグが発生していたため共通化した。
 */
export function NotificationSettings({
  user, isMember = false, pushEnabled, pushBusy = false, onTogglePush,
  notifyRadar, onToggleNotifyRadar, notifyDataReady, onToggleNotifyDataReady,
}: NotificationSettingsProps) {
  // プッシュ通知は会員限定機能。ログイン済みかつ会員のときだけ操作可能。
  const canUse = !!user && isMember
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>通知</div>

      {/* プッシュ通知トグル */}
      <div
        role="switch"
        aria-checked={pushEnabled}
        aria-label="プッシュ通知"
        tabIndex={canUse && !pushBusy ? 0 : -1}
        onKeyDown={e => { if (canUse && !pushBusy && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onTogglePush?.() } }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', borderRadius: 10,
          cursor: canUse && !pushBusy ? 'pointer' : 'default', opacity: canUse ? 1 : 0.5,
          background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
          transition: 'background 0.15s',
        }}
        onClick={canUse && !pushBusy ? onTogglePush : undefined}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: pushEnabled && canUse ? 'rgba(96,165,250,0.15)' : 'var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={pushEnabled && canUse ? 'rgba(96,165,250,0.9)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>プッシュ通知</span>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              {!user ? 'ログインが必要です' : !isMember ? 'メンバー登録が必要です' : pushBusy ? (pushEnabled ? '解除中…' : '設定中…') : pushEnabled ? 'ON' : 'OFF'}
            </span>
          </span>
        </span>
        <span style={{
          width: 50, height: 28, borderRadius: 14, flexShrink: 0,
          background: pushEnabled && canUse ? 'rgba(96,165,250,0.85)' : 'var(--glass-border)',
          position: 'relative', transition: 'background 0.2s',
          display: 'inline-block',
        }}>
          {pushBusy ? (
            <span style={{
              position: 'absolute', top: '50%', left: '50%',
              width: 16, height: 16, marginTop: -8, marginLeft: -8,
              border: '2px solid rgba(255,255,255,0.4)',
              borderTopColor: '#fff', borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
            }} />
          ) : (
            <span style={{
              position: 'absolute', top: 3, left: pushEnabled && canUse ? 25 : 3,
              width: 22, height: 22, borderRadius: '50%',
              background: 'white', transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }} />
          )}
        </span>
      </div>

      {/* 通知種別チェックボックス（プッシュ通知 ON のときのみ表示） */}
      {pushEnabled && canUse && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 4 }}>
          {[
            { checked: notifyRadar, onToggle: onToggleNotifyRadar, label: 'ぽいロボ レーダー', sub: 'イベント前日 12:30' },
            { checked: notifyDataReady, onToggle: onToggleNotifyDataReady, label: '需給データ更新通知', sub: '週次データ更新後（土曜）' },
          ].map(({ checked, onToggle, label, sub }) => (
            <div
              key={label}
              role="checkbox"
              aria-checked={checked}
              aria-label={label}
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle?.() } }}
              onClick={onToggle}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
            >
              <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{sub}</span>
              </span>
              <span style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${checked ? 'rgba(96,165,250,0.85)' : 'var(--glass-border)'}`, background: checked ? 'rgba(96,165,250,0.85)' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                {checked && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
