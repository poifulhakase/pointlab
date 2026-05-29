import { useState, useEffect } from 'react'
import { Z } from '../utils/zIndex'

const DISMISS_KEY = 'poical-pwa-install-dismissed'
const DISMISS_MS  = 30 * 24 * 60 * 60 * 1000  // 30日間非表示

const CY_BG      = 'linear-gradient(160deg, rgba(0,10,26,0.98) 0%, rgba(0,5,16,0.98) 100%)'
const CY_ACCENT  = 'rgba(0,229,255,0.95)'
const CY_DIM     = 'rgba(0,229,255,0.55)'
const CY_BORDER  = 'rgba(0,229,255,0.28)'
const CY_BTN_BG  = 'rgba(0,229,255,0.12)'
const CY_FONT    = "'Courier New', Courier, monospace" as const

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
    if (isStandalone() || wasDismissed()) return
    if (window.innerWidth > 768) return

    if (ios) {
      const t = setTimeout(() => setShow(true), 3000)
      return () => clearTimeout(t)
    } else {
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
      width: 'min(320px, calc(100vw - 32px))',
      background: CY_BG,
      border: `1px solid ${CY_BORDER}`,
      borderRadius: 10,
      boxShadow: `0 0 24px rgba(0,229,255,0.10), 0 6px 28px rgba(0,0,0,0.55)`,
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      overflow: 'hidden',
      animation: 'toastIn 0.3s ease',
    }}>
      {/* ヘッダーバー */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 12px',
        borderBottom: `1px solid ${CY_BORDER}`,
        background: 'rgba(0,229,255,0.05)',
      }}>
        <span style={{
          fontFamily: CY_FONT, fontSize: 9, fontWeight: 700,
          letterSpacing: '0.18em', color: CY_DIM,
          textShadow: `0 0 8px ${CY_DIM}`,
        }}>
          POIROBO_OS ▸ INSTALL
        </span>
        <button
          onClick={handleDismiss}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: CY_DIM, fontSize: 13, lineHeight: 1, padding: '2px 4px',
          }}
          aria-label="閉じる"
        >×</button>
      </div>

      {/* 本体 */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* メインテキスト */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* 点滅ドット */}
          <span style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: CY_ACCENT,
            boxShadow: `0 0 6px ${CY_ACCENT}`,
          }} />
          <span style={{
            fontFamily: CY_FONT, fontSize: 12, fontWeight: 700,
            color: CY_ACCENT, letterSpacing: '0.06em',
            textShadow: `0 0 10px rgba(0,229,255,0.5)`,
          }}>
            アプリとして使う
          </span>
        </div>

        {/* サブテキスト */}
        <div style={{
          fontFamily: CY_FONT, fontSize: 10, color: CY_DIM,
          lineHeight: 1.65, letterSpacing: '0.03em',
          paddingLeft: 14,
        }}>
          {ios ? (
            <>
              Safari 下部の <span style={{ color: CY_ACCENT }}>共有ボタン</span> をタップ<br />
              →「ホーム画面に追加」を選択
            </>
          ) : (
            <>ホーム画面に追加してアプリ感覚で利用できます。</>
          )}
        </div>

        {/* Android: 追加ボタン */}
        {!ios && prompt && (
          <button
            onClick={handleAdd}
            style={{
              marginTop: 2,
              padding: '7px 0', borderRadius: 6,
              background: CY_BTN_BG,
              border: `1px solid ${CY_BORDER}`,
              color: CY_ACCENT, cursor: 'pointer',
              fontFamily: CY_FONT, fontSize: 11, fontWeight: 700,
              letterSpacing: '0.14em',
              boxShadow: `0 0 10px rgba(0,229,255,0.08)`,
              width: '100%',
            }}
          >
            [ ホーム画面に追加 ]
          </button>
        )}
      </div>
    </div>
  )
}
