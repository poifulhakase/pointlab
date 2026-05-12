import { useEffect, useState, useRef, lazy, Suspense, useCallback } from 'react'

const NoteView   = lazy(() => import('./NoteView').then(m => ({ default: m.NoteView })))
const ManualView = lazy(() => import('./ManualView').then(m => ({ default: m.ManualView })))

type SupportTab = 'session' | 'note' | 'manual'

type Props = {
  theme: 'dark' | 'light'
  isMobile: boolean
  supportTab: SupportTab
  onOpenManual?: () => void
  onOpenLegal?: () => void
  onNavigate?: (view: 'month' | 'chart' | 'quant' | 'note') => void
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
  { id: 'poirobo',  label: 'Poirobo',  sub: 'ぽいロボ',   accent: '#4ade80', glow: 'rgba(74,222,128,0.45)',  view: 'quant',  icon: <RobotIcon />    },
  { id: 'data',     label: 'Data',     sub: '資料',       accent: '#a78bfa', glow: 'rgba(167,139,250,0.45)', view: 'note',   icon: <DataIcon />     },
  { id: 'settings', label: 'Settings', sub: '設定',       accent: '#fbbf24', glow: 'rgba(251,191,36,0.45)',  view: null,     icon: <GearIcon />     },
]

export function SupportView({ theme, isMobile, supportTab, onOpenManual, onOpenLegal, onNavigate }: Props) {
  const [visible,  setVisible]  = useState(false)
  const [ripples,  setRipples]  = useState<{ id: number; x: number; y: number }[]>([])
  const [rot,      setRot]      = useState({ x: -14, y: 5 })
  const [leaving,  setLeaving]  = useState(false)
  const rippleIdRef = useRef(0)
  const menuRef     = useRef<HTMLDivElement>(null)  // menu ラッパーのみ追尾（session全体ではない）

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true))
    })
    return () => cancelAnimationFrame(id)
  }, [])

  const handleRipple = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const id = ++rippleIdRef.current
    setRipples(prev => [...prev, { id, x, y }])
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 1000)
  }

  const handleMenuMouse = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = menuRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width  / 2
    const cy = rect.top  + rect.height / 2
    const dx = (e.clientX - cx) / (rect.width  / 2)
    const dy = (e.clientY - cy) / (rect.height / 2)
    setLeaving(false)
    setRot({ x: -14 + dy * -6, y: 5 + dx * 7 })
  }, [])

  const handleMenuLeave = useCallback(() => {
    setLeaving(true)
    setRot({ x: -14, y: 5 })
  }, [])

  const tabIndex = supportTab === 'session' ? 0 : supportTab === 'note' ? 1 : 2
  const overlayBg = 'rgba(8,16,36,0.82)'

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }} onPointerDown={handleRipple}>
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

        /* ── 3D Menu ── */
        .menu3d-list {
          transform-style: preserve-3d;
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .menu3d-item {
          transform-style: preserve-3d;
          opacity: 0;
          animation: menu3dEnter 0.50s cubic-bezier(0.2,0,0.1,1) forwards;
        }
        @keyframes menu3dEnter {
          from { opacity: 0; transform: translateX(-52px) translateZ(0); }
          to   { opacity: 1; transform: translateX(0)     translateZ(0); }
        }


        /* ── Button base ──
           outline + outline-offset で外枠との間にすき間を作る（参考画像の形状）。
           backdrop-filter は Chrome の preserve-3d 合成バグで文字が消えるため不使用。 */
        .menu3d-btn {
          position: relative;
          display: flex;
          align-items: center;
          width: 270px;
          height: 68px;
          padding: 0;
          border: 2px solid rgba(0,205,255,0.82);
          border-radius: 6px 20px 6px 20px;
          background: rgba(225,240,255,0.22);
          cursor: pointer;
          transform-style: preserve-3d;
          transform: translateZ(0px) scale(1.00);
          transition: transform 0.38s cubic-bezier(0.2,0.8,0.2,1),
                      box-shadow 0.28s ease,
                      border-color 0.28s ease,
                      outline-color 0.28s ease;
          overflow: visible;
          box-shadow:
            0 0 22px rgba(0,205,255,0.40),
            0 0 50px rgba(0,205,255,0.14),
            inset 0 1px 0 rgba(255,255,255,0.12),
            0 4px 20px rgba(0,0,0,0.35);
        }

        /* Back depth face - pointer-events:none で hover 誤反応を防ぐ */
        .menu3d-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 6px 20px 6px 20px;
          background: rgba(0,8,45,0.88);
          border: 2px solid rgba(0,150,200,0.18);
          transform: translateZ(-14px);
          box-shadow: 0 8px 28px rgba(0,0,0,0.70);
          pointer-events: none;
        }

        .menu3d-btn:hover {
          transform: translateZ(32px) scale(1.07);
          border-color: rgba(0,235,255,0.96);
          box-shadow:
            0 0 30px rgba(0,225,255,0.72),
            0 0 65px rgba(0,225,255,0.26),
            inset 0 1px 0 rgba(255,255,255,0.18),
            0 12px 30px rgba(0,0,0,0.45);
        }

        .menu3d-btn:active {
          transform: translateZ(14px) scale(1.03);
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
          height: 68px;
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

      {/* コンテンツカルーセル */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', width: '300%',
        transform: `translateX(${-tabIndex * 33.333}%)`,
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        zIndex: 2,
      }}>

        {/* ━━ 研究室 ━━ */}
        <div style={{ width: '33.333%', height: '100%', flexShrink: 0, position: 'relative' }}>
          <div
            ref={menuRef}
            style={{ position: 'absolute', top: 36, left: 32, perspective: '900px', perspectiveOrigin: '50% 50%' }}
            onMouseMove={handleMenuMouse}
            onMouseLeave={handleMenuLeave}
          >
            {/* ヘッダー */}
            <div className="menu3d-header">
              <span className="menu3d-header-label">Navigate</span>
              <span className="menu3d-header-line" />
            </div>

            {/* メニューリスト */}
            <ul
              className="menu3d-list"
              style={{
                transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
                transition: leaving
                  ? 'transform 0.55s cubic-bezier(0.2,0,0.1,1)'
                  : 'transform 0.10s ease',
              }}
            >
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
                    onClick={() => { if (item.view) onNavigate?.(item.view) }}
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
    </div>
  )
}
