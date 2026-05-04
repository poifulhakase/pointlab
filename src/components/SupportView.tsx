import { useEffect, useState, lazy, Suspense } from 'react'

const NoteView   = lazy(() => import('./NoteView').then(m => ({ default: m.NoteView })))
const ManualView = lazy(() => import('./ManualView').then(m => ({ default: m.ManualView })))

type SupportTab = 'session' | 'note' | 'manual'

type Props = {
  theme: 'dark' | 'light'
  isMobile: boolean
  supportTab: SupportTab
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

export function SupportView({ theme, isMobile, supportTab }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true))
    })
    return () => cancelAnimationFrame(id)
  }, [])

  const tabIndex = supportTab === 'session' ? 0 : supportTab === 'note' ? 1 : 2
  const isDark = theme === 'dark'
  const overlayBg = isDark ? 'rgba(8,16,36,0.82)' : 'rgba(10,20,48,0.75)'

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @keyframes supportKenBurns {
          0%   { transform: scale(1.08); }
          100% { transform: scale(1.00); }
        }
      `}</style>

      {/* 背景画像（常時表示・ケンバーンズ） */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${import.meta.env.BASE_URL}support-room.jpg)`,
          backgroundSize: 'cover',
          backgroundPosition: isMobile ? '72% top' : 'center top',
          opacity: visible ? 1 : 0,
          animation: visible ? 'supportKenBurns 4s cubic-bezier(0.4,0,0.2,1) forwards' : 'none',
          transition: 'opacity 1.6s ease',
          zIndex: 0,
        }}
      />

      {/* 下部グラデーション */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 160,
        background: 'linear-gradient(to bottom, transparent 0%, rgba(8,20,40,0.75) 100%)',
        pointerEvents: 'none',
        zIndex: 1,
      }} />

      {/* コンテンツカルーセル */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        width: '300%',
        transform: `translateX(${-tabIndex * 33.333}%)`,
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        zIndex: 2,
      }}>

        {/* ━━ 1on1セッション ━━ */}
        <div style={{ width: '33.333%', height: '100%', flexShrink: 0 }} />

        {/* ━━ ノート ━━ */}
        <div style={{
          width: '33.333%', height: '100%', flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          background: overlayBg,
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
        }}>
          <Suspense fallback={<ViewLoader />}>
            <NoteView theme={theme} isMobile={isMobile} />
          </Suspense>
        </div>

        {/* ━━ 使い方 ━━ */}
        <div style={{
          width: '33.333%', height: '100%', flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          background: overlayBg,
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
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
