import { useState, useEffect } from 'react'
import { Z } from '../utils/zIndex'

const DISMISS_KEY = 'poical-pwa-install-dismissed'
const DISMISS_MS  = 30 * 24 * 60 * 60 * 1000  // 30日間非表示

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

function isIOSSafari() {
  const ua = navigator.userAgent
  const isIOS = /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  // Chrome/Firefox on iOS は PWA インストール非対応のためスキップ
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
  return isIOS && isSafari
}

function wasDismissed() {
  try {
    const ts = parseInt(localStorage.getItem(DISMISS_KEY) ?? '0', 10)
    return ts > 0 && Date.now() - ts < DISMISS_MS
  } catch { return false }
}

export function PWAInstallBanner() {
  const [show,   setShow]   = useState(false)
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const ios = isIOSSafari()

  useEffect(() => {
    // インストール済み・非表示設定済み・PC はスキップ
    if (isStandalone() || wasDismissed()) return
    if (window.innerWidth > 768) return

    if (ios) {
      // iOS Safari: 3秒後に表示（手動インストール案内）
      const t = setTimeout(() => setShow(true), 3000)
      return () => clearTimeout(t)
    } else {
      // Android / Chrome 等: beforeinstallprompt イベントを待つ
      const handler = (e: Event) => {
        e.preventDefault()
        setPrompt(e as BeforeInstallPromptEvent)
        setTimeout(() => setShow(true), 3000)
      }
      window.addEventListener('beforeinstallprompt', handler)
      return () => window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [ios])

  const handleAdd = async () => {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setShow(false)
    setPrompt(null)
  }

  const handleDismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {}
    setShow(false)
  }

  if (!show) return null

  return (
    <div style={{
      position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      zIndex: Z.popover,
      width: 'min(340px, calc(100vw - 32px))',
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px', borderRadius: 14,
      background: 'var(--modal-bg)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid var(--glass-border)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
      animation: 'toastIn 0.3s ease',
    }}>
      {/* アイコン */}
      <span style={{ fontSize: 22, flexShrink: 0 }}>📱</span>

      {/* テキスト */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>
          アプリとして使う
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-sub)', lineHeight: 1.5 }}>
          {ios
            ? '下の共有ボタン →「ホーム画面に追加」'
            : 'ホーム画面に追加してアプリ感覚で使えます'}
        </div>
      </div>

      {/* Android: 追加ボタン */}
      {!ios && prompt && (
        <button
          onClick={handleAdd}
          style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: 'rgba(96,165,250,0.18)', border: '1px solid rgba(96,165,250,0.45)',
            color: 'var(--accent)', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
          }}
        >
          追加
        </button>
      )}

      {/* 閉じるボタン（30日間非表示） */}
      <button
        onClick={handleDismiss}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 22, height: 22, borderRadius: 5,
          background: 'transparent', border: 'none',
          color: 'var(--text-dim)', cursor: 'pointer', fontSize: 15, flexShrink: 0,
        }}
        aria-label="閉じる"
      >×</button>
    </div>
  )
}
