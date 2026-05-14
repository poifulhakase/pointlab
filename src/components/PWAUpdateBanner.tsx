import { useRegisterSW } from 'virtual:pwa-register/react'
import { Z } from '../utils/zIndex'

export function PWAUpdateBanner() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div style={{
      position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
      zIndex: Z.popover,
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 14px', borderRadius: 12,
      background: 'var(--glass-bg-strong)',
      backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)',
      border: '1px solid var(--glass-border)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
      fontSize: 13, color: 'var(--text)',
      whiteSpace: 'nowrap',
      animation: 'toastIn 0.25s ease',
    }}>
      <span style={{ fontSize: 15 }}>🔄</span>
      <span style={{ color: 'var(--text-sub)', fontSize: 12 }}>新しいバージョンがあります</span>
      <button
        onClick={() => updateServiceWorker(true)}
        style={{
          padding: '4px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
          background: 'var(--accent-glass)', border: '1px solid var(--accent)',
          color: '#fff', cursor: 'pointer',
        }}
      >
        今すぐ更新
      </button>
      <button
        onClick={() => setNeedRefresh(false)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 22, height: 22, borderRadius: 5,
          background: 'transparent', border: 'none',
          color: 'var(--text-dim)', cursor: 'pointer', fontSize: 14, lineHeight: 1,
        }}
        aria-label="閉じる"
      >
        ×
      </button>
    </div>
  )
}
