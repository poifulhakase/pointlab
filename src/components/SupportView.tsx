import { useEffect, useState, useRef, lazy, Suspense } from 'react'

const NoteView   = lazy(() => import('./NoteView').then(m => ({ default: m.NoteView })))
const ManualView = lazy(() => import('./ManualView').then(m => ({ default: m.ManualView })))

type Props = {
  theme: 'dark' | 'light'
  isMobile: boolean
  supportTab: SupportTab
  user?: ConnectUser | null
  onOpenManual?: () => void
  onOpenLegal?: () => void
  onNavigate?: (view: 'month' | 'chart' | 'quant' | 'note') => void
  onOpenSettings?: () => void
}

type SupportTab = 'session' | 'note' | 'manual'

type ConnectUser = { uid: string; displayName: string | null; email: string | null }
type JitsiAPI = {
  dispose(): void
  addListener(event: string, fn: (...args: unknown[]) => void): void
  executeCommand(command: string, ...args: unknown[]): void
}

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (domain: string, opts: Record<string, unknown>) => JitsiAPI
  }
}

function ViewLoader() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        border: '3px solid rgba(255,255,255,0.15)',
        borderTopColor: 'rgba(255,255,255,0.7)',
        animation: 'spin 0.7s linear infinite',
      }} />
    </div>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────
function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}
function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 20 9 4 6 12 2 12"/>
    </svg>
  )
}
function RobotIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M9 11V8a3 3 0 0 1 6 0v3"/>
      <circle cx="9" cy="16.5" r="1.3" fill="currentColor" stroke="none"/>
      <circle cx="15" cy="16.5" r="1.3" fill="currentColor" stroke="none"/>
      <line x1="12" y1="2" x2="12" y2="5"/>
      <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none"/>
    </svg>
  )
}
function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}
function DataIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 0 3-3h7z"/>
    </svg>
  )
}

// ── Menu data ──────────────────────────────────────────────────────────────
type MenuView = 'month' | 'chart' | 'quant' | 'note' | null
type MenuItem = { id: string; label: string; sub: string; accent: string; glow: string; view: MenuView; icon: React.ReactNode }

const MENU_ITEMS: MenuItem[] = [
  { id: 'calendar', label: 'Calendar', sub: 'カレンダー', accent: '#67e8f9', glow: 'rgba(103,232,249,0.45)', view: 'month',  icon: <CalendarIcon /> },
  { id: 'chart',    label: 'Chart',    sub: 'チャート',   accent: '#c084fc', glow: 'rgba(192,132,252,0.45)', view: 'chart',  icon: <ChartIcon />    },
  { id: 'poirobo',  label: 'Poirobo Engine',  sub: 'ぽいロボ エンジン',   accent: '#4ade80', glow: 'rgba(74,222,128,0.45)',  view: 'quant',  icon: <RobotIcon />    },
  { id: 'data',     label: 'Data',     sub: '資料',       accent: '#a78bfa', glow: 'rgba(167,139,250,0.45)', view: 'note',   icon: <DataIcon />     },
  { id: 'settings', label: 'Settings', sub: '設定',       accent: '#fbbf24', glow: 'rgba(251,191,36,0.45)',  view: null,     icon: <GearIcon />     },
]

// ── Jitsi コネクトパネル（JaaS） ───────────────────────────────────────────
function JitsiPanel({ user, isMobile, onClose }: { user: ConnectUser; isMobile: boolean; onClose: () => void }) {
  const containerRef   = useRef<HTMLDivElement>(null)
  const participantRef = useRef(1) // 自分を含む参加人数
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'full'>('loading')

  const shortRoom   = `poirobo-${user.uid.substring(0, 12)}`
  const isAdmin     = user.email === 'sushi.ramen.unajyu@gmail.com'
  const displayName = isAdmin ? 'ぽいふる博士' : (user.displayName ?? 'ユーザー')
  // iPad (新型) は userAgent が MacIntel になるため maxTouchPoints で補完
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const toolbarButtons = isIOS
    ? ['microphone', 'hangup']
    : ['microphone', 'desktop', 'hangup']

  useEffect(() => {
    let api: JitsiAPI | null = null
    let cancelled = false

    const init = async () => {
      // JaaS スクリプトをロード
      if (!window.JitsiMeetExternalAPI) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script')
          s.src = 'https://8x8.vc/external_api.js'
          s.async = true
          s.onload  = () => resolve()
          s.onerror = () => reject(new Error('Script load failed'))
          document.head.appendChild(s)
        })
      }
      if (cancelled || !containerRef.current) return

      // Vercel API Route で JWT 取得
      const params = new URLSearchParams({
        room:  shortRoom,
        name:  displayName,
        email: user.email ?? '',
        uid:   user.uid,
      })
      const res = await fetch(`/api/jitsi-token?${params}`)
      if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`)
      const { token } = await res.json() as { token: string }
      if (cancelled || !containerRef.current) return

      const appId     = import.meta.env.VITE_JAAS_APP_ID as string
      const roomName  = `${appId}/${shortRoom}`
      const avatarUrl = `${window.location.origin}${import.meta.env.BASE_URL}hakase.png`

      api = new window.JitsiMeetExternalAPI!('8x8.vc', {
        roomName,
        jwt: token,
        parentNode: containerRef.current,
        userInfo: { displayName, avatarUrl },
        configOverwrite: {
          startWithVideoMuted: true,
          startWithAudioMuted: false,
          prejoinPageEnabled: false,
          prejoinConfig: { enabled: false },
          disableDeepLinking: true,
          enableWelcomePage: false,
          toolbarButtons,
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_BRAND_WATERMARK: false,
          DISPLAY_WELCOME_FOOTER: false,
          MOBILE_APP_PROMO: false,
          HIDE_INVITE_MORE_HEADER: true,
          TOOLBAR_BUTTONS: toolbarButtons,
        },
      })

      api.addListener('videoConferenceJoined', () => {
        api?.executeCommand('avatarUrl', avatarUrl)
      })
      api.addListener('participantJoined', (...args: unknown[]) => {
        participantRef.current++
        if (participantRef.current > 2) {
          const p = args[0] as { id: string }
          if (isAdmin) {
            api?.executeCommand('kickParticipant', p.id)
          } else {
            setStatus('full')
            api?.executeCommand('hangup')
          }
        }
      })
      api.addListener('participantLeft', () => { participantRef.current-- })
      api.addListener('readyToClose', onClose)

      if (!cancelled) setStatus('ready')
    }

    init().catch(() => { if (!cancelled) setStatus('error') })

    return () => {
      cancelled = true
      api?.dispose()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 15,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: isMobile ? 0 : '18px 22px',
      userSelect: 'none',
    }}>
      <div style={{
        width: '100%', height: '100%',
        maxWidth: isMobile ? undefined : 980,
        maxHeight: isMobile ? undefined : 700,
        background: '#050810',
        border: isMobile ? 'none' : '1px solid rgba(0,242,255,0.18)',
        borderRadius: isMobile ? 0 : 14,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: isMobile ? 'none' : '0 0 70px rgba(0,60,200,0.18), 0 24px 80px rgba(0,0,0,0.75)',
      }}>

        {/* ヘッダーバー */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 14px', flexShrink: 0,
          background: 'rgba(0,10,22,0.97)',
          borderBottom: '1px solid rgba(0,242,255,0.10)',
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: status === 'ready' ? '#00f2ff' : status === 'error' ? '#ff4444' : 'rgba(0,242,255,0.35)',
            boxShadow: status === 'ready' ? '0 0 8px #00f2ff' : 'none',
            flexShrink: 0, transition: 'all 0.4s',
          }} />
          <span style={{ flex: 1, fontSize: 10, fontWeight: 700, color: 'rgba(80,190,255,0.80)', letterSpacing: '0.18em' }}>
            POIROBO CONNECT
          </span>
          <code style={{ fontSize: 9, color: 'rgba(0,242,255,0.35)', fontFamily: 'monospace', letterSpacing: '0.04em' }}>
            {shortRoom}
          </code>
          <button
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 11px', borderRadius: 6, cursor: 'pointer',
              background: 'rgba(200,40,40,0.12)',
              border: '1px solid rgba(200,40,40,0.35)',
              color: '#ff6666', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            切断
          </button>
        </div>

        {/* Jitsi エリア */}
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          {status === 'loading' && (
            <div style={{
              position: 'absolute', inset: 0, background: '#050810', zIndex: 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                border: '2.5px solid rgba(0,242,255,0.15)',
                borderTopColor: '#00f2ff',
                animation: 'spin 0.8s linear infinite',
              }} />
              <span style={{ color: 'rgba(0,242,255,0.5)', fontSize: 10, letterSpacing: '0.15em' }}>接続中...</span>
            </div>
          )}
          {status === 'error' && (
            <div style={{
              position: 'absolute', inset: 0, background: '#050810', zIndex: 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
            }}>
              <span style={{ color: '#ff6666', fontSize: 13 }}>接続に失敗しました</span>
              <button onClick={onClose} style={{
                padding: '6px 18px', borderRadius: 8, cursor: 'pointer',
                background: 'rgba(200,40,40,0.15)', border: '1px solid rgba(200,40,40,0.4)',
                color: '#ff8888', fontSize: 12, fontWeight: 600,
              }}>閉じる</button>
            </div>
          )}
          {status === 'full' && (
            <div style={{
              position: 'absolute', inset: 0, background: '#050810', zIndex: 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
            }}>
              <span style={{ color: '#fbbf24', fontSize: 13 }}>現在満員です（最大2名）</span>
              <button onClick={onClose} style={{
                padding: '6px 18px', borderRadius: 8, cursor: 'pointer',
                background: 'rgba(200,140,20,0.15)', border: '1px solid rgba(200,140,20,0.4)',
                color: '#fbbf24', fontSize: 12, fontWeight: 600,
              }}>閉じる</button>
            </div>
          )}
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
    </div>
  )
}

// ── メインビュー ────────────────────────────────────────────────────────────
export function SupportView({ theme, isMobile, supportTab, user, onOpenManual, onOpenLegal, onNavigate, onOpenSettings }: Props) {
  const [visible,      setVisible]      = useState(false)
  const [connectMode,  setConnectMode]  = useState(false)
  const [confirmOpen,  setConfirmOpen]  = useState(false)
  const [ripples,      setRipples]      = useState<{ id: number; x: number; y: number }[]>([])

  const rippleIdRef = useRef(0)
  const menuRef     = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true))
    })
    return () => cancelAnimationFrame(id)
  }, [])

  const handleRipple = (e: React.PointerEvent<HTMLDivElement>) => {
    if (connectMode) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const id = ++rippleIdRef.current
    setRipples(prev => [...prev, { id, x, y }])
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 1000)
  }

  const tabIndex = supportTab === 'session' ? 0 : supportTab === 'note' ? 1 : 2
  const overlayBg = 'rgba(8,16,36,0.82)'

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', userSelect: 'none' }} onPointerDown={handleRipple}>
      <style>{`
        @keyframes supportKenBurns {
          0%   { transform: scale(1.08); }
          100% { transform: scale(1.00); }
        }
        @keyframes supportRipple {
          0%   { transform: translate(-50%,-50%) scale(0); opacity: 1; }
          70%  { opacity: 0.4; }
          100% { transform: translate(-50%,-50%) scale(1); opacity: 0; }
        }

        /* ── Menu ── */
        .menu3d-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .menu3d-item {
          opacity: 0;
          animation: menu3dEnter 0.50s cubic-bezier(0.2,0,0.1,1) forwards;
        }
        @keyframes menu3dEnter {
          from { opacity: 0; transform: translateX(-52px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        .menu3d-btn {
          position: relative;
          display: flex;
          align-items: center;
          width: 270px;
          height: 76px;
          padding: 0;
          border: 2px solid rgba(0,205,255,0.45);
          border-radius: 6px 20px 6px 20px;
          background: rgba(2,12,28,0.42);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          cursor: pointer;
          transform: scale(1.00);
          transition: transform 0.20s ease,
                      box-shadow 0.20s ease,
                      border-color 0.20s ease;
          overflow: visible;
          box-shadow:
            0 0 14px rgba(0,205,255,0.22),
            0 0 32px rgba(0,205,255,0.08),
            inset 0 1px 0 rgba(255,255,255,0.06),
            0 4px 20px rgba(0,0,0,0.45);
        }

        .menu3d-btn:hover {
          transform: scale(1.03);
          border-color: rgba(0,235,255,0.70);
          box-shadow:
            0 0 30px rgba(0,225,255,0.72),
            0 0 65px rgba(0,225,255,0.26),
            inset 0 1px 0 rgba(255,255,255,0.18),
            0 12px 30px rgba(0,0,0,0.45);
        }

        .menu3d-btn:active {
          transform: scale(0.98);
        }

        /* Corner brackets */
        .menu3d-tl,
        .menu3d-br {
          position: absolute;
          width: 13px;
          height: 13px;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.22s ease, transform 0.30s cubic-bezier(0.2,0,0.1,1);
        }
        .menu3d-tl {
          top: 4px; left: 4px;
          border-top: 2px solid rgba(50,200,255,0.90);
          border-left: 2px solid rgba(50,200,255,0.90);
          border-radius: 2px 0 0 0;
          transform: translate(-5px, -5px);
        }
        .menu3d-br {
          bottom: 4px; right: 4px;
          border-bottom: 2px solid rgba(50,200,255,0.90);
          border-right: 2px solid rgba(50,200,255,0.90);
          border-radius: 0 0 2px 0;
          transform: translate(5px, 5px);
        }
        .menu3d-btn:hover .menu3d-tl {
          opacity: 1;
          transform: translate(0, 0);
        }
        .menu3d-btn:hover .menu3d-br {
          opacity: 1;
          transform: translate(0, 0);
        }

        /* Icon area */
        .menu3d-icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 58px;
          height: 76px;
          flex-shrink: 0;
          color: var(--accent);
          filter: drop-shadow(0 0 5px var(--glow));
          transition: filter 0.28s ease;
        }
        .menu3d-btn:hover .menu3d-icon-wrap {
          filter: drop-shadow(0 0 12px var(--glow));
        }

        /* Divider */
        .menu3d-divider {
          width: 1px;
          height: 36px;
          background: rgba(50,180,255,0.20);
          flex-shrink: 0;
        }

        /* Labels */
        .menu3d-labels {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          flex: 1;
          padding: 0 18px;
          gap: 5px;
          min-width: 0;
        }
        .menu3d-label {
          color: #ffffff;
          font-size: 15px;
          font-weight: 800;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          line-height: 1;
          white-space: nowrap;
        }
        .menu3d-sub {
          color: rgba(180,230,255,0.85);
          font-size: 11px;
          letter-spacing: 0.06em;
          line-height: 1;
          white-space: nowrap;
        }

        /* Header */
        .menu3d-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 24px;
        }
        .menu3d-header-label {
          color: rgba(100,210,255,0.60);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          text-shadow: 0 0 10px rgba(100,210,255,0.40);
        }
        .menu3d-header-line {
          flex: 1;
          height: 1px;
          background: linear-gradient(to right, rgba(50,180,255,0.55) 0%, transparent 75%);
          max-width: 130px;
        }

        /* ── Dust particles ── */
        @keyframes digital-dust {
          0%   { transform: translateY(0); opacity: 0; }
          20%  { opacity: 0.4; }
          100% { transform: translateY(-160px); opacity: 0; }
        }
        .poyon-dust {
          position: absolute;
          width: 2px; height: 2px;
          background: #00f2ff;
          border-radius: 50%;
          opacity: 0;
          animation: digital-dust 10s linear infinite;
          pointer-events: none;
        }

        /* ── Scanline ── */
        @keyframes support-scanline {
          0%   { top: -20px; }
          100% { top: 110%; }
        }
        .poyon-scanline {
          position: absolute; left: 0; width: 100%; height: 15px;
          background: linear-gradient(to bottom, transparent, rgba(0,242,255,0.05), transparent);
          pointer-events: none;
          animation: support-scanline 8s linear infinite;
        }

        /* ── Connect button ── */
        @keyframes slow-rotate { to { transform: rotate(360deg); } }
        @keyframes cyberTooltipFlicker {
          0%, 65%       { opacity: 0; }
          66%           { opacity: 0.6; }
          67%           { opacity: 0;   }
          68%, 93%      { opacity: 1;   }
          94%           { opacity: 0.2; }
          95%           { opacity: 1;   }
          96%           { opacity: 0;   }
          100%          { opacity: 0;   }
        }
        @keyframes text-subtle-poyon {
          0%   { transform: translateY(0) scale(1); }
          40%  { transform: translateY(-4px) scale(1.03); }
          70%  { transform: translateY(1px) scale(0.99); }
          100% { transform: translateY(0) scale(1); }
        }
        .poyon-connect-area {
          position: relative;
          width: clamp(130px, 30vw, 180px); height: clamp(130px, 30vw, 180px);
          display: flex; justify-content: center; align-items: center;
          cursor: pointer; -webkit-tap-highlight-color: transparent;
        }
        .poyon-scanner-ring {
          position: absolute; width: 110%; height: 110%;
          border: 1px solid rgba(0,242,255,0.2); border-radius: 50%;
          animation: slow-rotate 15s linear infinite; pointer-events: none;
        }
        .poyon-main-core {
          position: relative; width: 90%; height: 90%;
          background: rgba(8,12,16,0.92);
          border: 1px solid rgba(0,242,255,0.45); border-radius: 50%;
          display: flex; flex-direction: column; justify-content: center; align-items: center;
          box-shadow: inset 0 0 25px rgba(0,242,255,0.3);
          transition: all 0.4s cubic-bezier(0.175,0.885,0.32,1.275);
          backdrop-filter: blur(8px); overflow: hidden;
        }
        .poyon-connect-area:hover .poyon-main-core {
          transform: scale(1.05); border-color: #00f2ff;
          box-shadow: 0 0 30px rgba(0,242,255,0.4), inset 0 0 20px rgba(0,242,255,0.3);
        }
        .poyon-connect-area:active .poyon-main-core {
          transform: scale(0.92) translateY(3px); filter: brightness(1.2); transition: 0.1s;
        }
        .poyon-image-mask {
          width: 40%; height: 40%; border-radius: 50%; overflow: hidden;
          margin-bottom: 5px; transform: translateY(-4px); background-color: #080c10;
        }
        .poyon-doctor-image {
          width: auto; height: 110%;
          filter: sepia(1) hue-rotate(150deg) saturate(1.2) brightness(0.7) contrast(1.1);
          transition: 0.4s ease; opacity: 0.8;
        }
        .poyon-connect-area:hover .poyon-doctor-image {
          filter: sepia(1) hue-rotate(150deg) saturate(1.6) brightness(0.9) contrast(1.1);
          opacity: 1; transform: scale(1.05);
        }
        .poyon-text-main {
          font-size: clamp(9px,2.5vw,12px); font-weight: 900;
          color: #f0f8ff; text-shadow: 0 0 10px #00f2ff; text-align: center;
        }
        .poyon-text-sub {
          font-size: clamp(6px,1.5vw,8px); color: #00f2ff;
          font-weight: bold; margin-top: 3px; text-align: center;
        }
        .poyon-connect-area:hover .poyon-text-wrap {
          animation: text-subtle-poyon 0.5s cubic-bezier(0.25,1,0.5,1) forwards;
        }
      `}</style>

      {/* 背景画像 */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url(${import.meta.env.BASE_URL}support-room.jpg)`,
        backgroundSize: 'cover',
        backgroundPosition: isMobile ? '72% top' : 'center top',
        opacity: visible ? 1 : 0,
        animation: visible ? 'supportKenBurns 4s cubic-bezier(0.4,0,0.2,1) forwards' : 'none',
        transition: 'opacity 1.6s ease',
        zIndex: 0,
      }} />

      {/* 下部グラデーション */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 160,
        background: 'linear-gradient(to bottom, transparent 0%, rgba(8,20,40,0.75) 100%)',
        pointerEvents: 'none', zIndex: 1,
      }} />

      {/* ダストパーティクル + スキャンライン */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }}>
        <div className="poyon-dust" style={{ top: '70%', left: '20%', animationDelay: '0s' }} />
        <div className="poyon-dust" style={{ top: '40%', left: '80%', animationDelay: '2s' }} />
        <div className="poyon-dust" style={{ top: '80%', left: '65%', animationDelay: '1s' }} />
        <div className="poyon-dust" style={{ top: '20%', left: '30%', animationDelay: '3s' }} />
        <div className="poyon-dust" style={{ top: '60%', left: '50%', animationDelay: '4.5s' }} />
        <div className="poyon-dust" style={{ top: '35%', left: '10%', animationDelay: '6s' }} />
        <div className="poyon-dust" style={{ top: '85%', left: '45%', animationDelay: '1.5s' }} />
        <div className="poyon-dust" style={{ top: '15%', left: '70%', animationDelay: '5s' }} />
      </div>
      <div className="poyon-scanline" style={{ zIndex: 3 }} />

      {/* 波紋 */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
        {ripples.map(r => (
          <div key={r.id} style={{
            position: 'absolute', left: r.x, top: r.y,
            width: 700, height: 700, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(180,230,255,0.55) 0%, rgba(103,232,249,0.28) 35%, transparent 68%)',
            animation: 'supportRipple 1s cubic-bezier(0.2,0.6,0.4,1) forwards',
            pointerEvents: 'none',
          }} />
        ))}
      </div>

      {/* コンテンツカルーセル（コネクト中は非表示） */}
      <div style={{
        position: 'absolute', inset: 0,
        display: connectMode ? 'none' : 'flex',
        width: '300%',
        transform: `translateX(${-tabIndex * 33.333}%)`,
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        zIndex: 2,
      }}>

        {/* ━━ 研究室 ━━ */}
        <div style={{ width: '33.333%', height: '100%', flexShrink: 0, position: 'relative' }}>
          <div
            ref={menuRef}
            style={{ position: 'absolute', top: 36, left: 32 }}
          >
            {/* ヘッダー */}
            <div className="menu3d-header">
              <span className="menu3d-header-label">Navigate</span>
              <span className="menu3d-header-line" />
            </div>

            {/* メニューリスト */}
            <ul className="menu3d-list">
              {MENU_ITEMS.map((item, i) => (
                <li
                  key={item.id}
                  className="menu3d-item"
                  style={{
                    '--accent': item.accent,
                    '--glow':   item.glow,
                    animationDelay: `${i * 85 + 120}ms`,
                  } as React.CSSProperties}
                >
                  <button
                    className="menu3d-btn"
                    onClick={() => {
                      if (item.id === 'settings') { onOpenSettings?.(); return }
                      if (item.view) onNavigate?.(item.view)
                    }}
                  >
                    <span className="menu3d-tl" />
                    <span className="menu3d-br" />
                    <span className="menu3d-icon-wrap">{item.icon}</span>
                    <span className="menu3d-divider" />
                    <span className="menu3d-labels">
                      <span className="menu3d-label" style={{ color: '#ffffff' }}>{item.label}</span>
                      <span className="menu3d-sub" style={{ color: 'rgba(190,235,255,0.88)' }}>{item.sub}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ━━ 資料 ━━ */}
        <div style={{
          width: '33.333%', height: '100%', flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          background: overlayBg,
          backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
        }}>
          <Suspense fallback={<ViewLoader />}>
            <NoteView theme={theme} isMobile={isMobile} onOpenManual={onOpenManual} onOpenLegal={onOpenLegal} />
          </Suspense>
        </div>

        {/* ━━ 使い方 ━━ */}
        <div style={{
          width: '33.333%', height: '100%', flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          background: overlayBg,
          backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
          overflowY: 'auto',
        }}>
          <Suspense fallback={<ViewLoader />}>
            <ManualView theme={theme} isMobile={isMobile} />
          </Suspense>
        </div>

      </div>

      {/* 接続確認モーダル */}
      {confirmOpen && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,4,16,0.75)', backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}>
          <div style={{
            width: isMobile ? 'calc(100% - 48px)' : 360,
            background: 'linear-gradient(160deg, rgba(0,12,32,0.98) 0%, rgba(0,6,20,0.98) 100%)',
            border: '1px solid rgba(0,242,255,0.35)',
            borderRadius: 16,
            boxShadow: '0 0 40px rgba(0,180,255,0.12), 0 24px 60px rgba(0,0,0,0.7)',
            overflow: 'hidden',
          }}>
            {/* ヘッダー */}
            <div style={{
              padding: '14px 18px 12px',
              borderBottom: '1px solid rgba(0,242,255,0.12)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(0,242,255,0.6)',
                boxShadow: '0 0 8px rgba(0,242,255,0.8)',
              }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(0,220,255,0.80)', letterSpacing: '0.2em' }}>
                CONNECTION REQUEST
              </span>
            </div>

            {/* ボディ */}
            <div style={{ padding: '20px 20px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <img
                src={`${import.meta.env.BASE_URL}hakase.webp`}
                alt="博士"
                style={{ width: 72, height: 72, objectFit: 'contain', filter: 'drop-shadow(0 0 10px rgba(0,200,255,0.5))' }}
              />
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'rgba(0,230,255,0.95)', letterSpacing: '0.04em' }}>
                  ぽいふる博士
                </p>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: 'rgba(180,220,255,0.65)', lineHeight: 1.6 }}>
                  音声通話・画面共有セッションを<br />開始しますか？
                </p>
              </div>
              <div style={{
                fontSize: 10, color: 'rgba(0,200,255,0.45)', letterSpacing: '0.12em',
                fontFamily: 'monospace', padding: '6px 14px',
                border: '1px solid rgba(0,200,255,0.12)', borderRadius: 6,
              }}>
                PROTOCOL: SECURE_SYNC v2.0
              </div>
            </div>

            {/* ボタン */}
            <div style={{ display: 'flex', gap: 10, padding: '16px 20px 20px' }}>
              <button
                onClick={() => setConfirmOpen(false)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 9, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(180,200,220,0.7)', fontSize: 13, fontWeight: 600, letterSpacing: '0.04em',
                }}
              >
                キャンセル
              </button>
              <button
                onClick={() => { setConfirmOpen(false); setConnectMode(true) }}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 9, cursor: 'pointer',
                  background: 'linear-gradient(135deg, rgba(0,160,255,0.25) 0%, rgba(0,100,200,0.18) 100%)',
                  border: '1px solid rgba(0,200,255,0.5)',
                  color: 'rgba(0,230,255,0.95)', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em',
                  boxShadow: '0 0 16px rgba(0,180,255,0.15)',
                }}
              >
                接続する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Jitsi コネクトパネル（コネクト中のみ表示） */}
      {connectMode && user && (
        <JitsiPanel user={user} isMobile={isMobile} onClose={() => setConnectMode(false)} />
      )}

      {/* コネクトボタン（コネクト中は非表示） */}
      {!connectMode && (
        <div style={{ position: 'absolute', bottom: isMobile ? 20 : 28, right: isMobile ? 16 : 28, zIndex: 20, transform: 'scale(1.2)', transformOrigin: 'bottom right' }}>
          <div style={{
            position: 'absolute', bottom: 'calc(100% + 12px)', right: 0, width: 220,
            padding: '14px 16px',
            background: 'rgba(0,25,35,0.95)',
            border: '1px solid rgba(0,242,255,0.3)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            pointerEvents: 'none',
            animation: 'cyberTooltipFlicker 11s linear infinite',
          }}>
            <span style={{ position: 'absolute', top: -1, left: -1, width: 20, height: 20,
              borderTop: '2px solid #00f2ff', borderLeft: '2px solid #00f2ff' }} />
            <span style={{ position: 'absolute', bottom: -5, right: -5, width: 8, height: 8,
              background: '#081015', border: '2px solid #00f2ff', borderRadius: '50%' }} />
            <span style={{ display: 'block', fontSize: 9, color: '#00f2ff', fontWeight: 700,
              letterSpacing: '0.15em', marginBottom: 8,
              borderBottom: '1px solid rgba(0,242,255,0.2)', paddingBottom: 4 }}>
              POIROBO_CONNECT_v2.0
            </span>
            <div style={{ fontSize: 12, color: '#f0f8ff', lineHeight: 1.6 }}>
              ぽいふる博士と音声通話・画面共有ができます。
              <span style={{ display: 'block', fontSize: 10, color: '#00f2ff', opacity: 0.8, marginTop: 6 }}>
                接続プロトコル：SECURE_SYNC
              </span>
            </div>
          </div>
          <div
            className="poyon-connect-area"
            onClick={() => { if (user) setConfirmOpen(true) }}
          >
            <div className="poyon-scanner-ring" />
            <div className="poyon-main-core">
              <div className="poyon-image-mask">
                <img src={`${import.meta.env.BASE_URL}hakase.webp`} className="poyon-doctor-image" alt="博士" draggable={false} />
              </div>
              <div className="poyon-text-wrap">
                <div className="poyon-text-main">ぽいロボ コネクト</div>
                <div className="poyon-text-sub">ぽいふる博士と接続</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
