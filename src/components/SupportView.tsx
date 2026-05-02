import { useEffect, useState } from 'react'

export function SupportView() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true))
    })
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @keyframes supportKenBurns {
          0%   { transform: scale(1.08); }
          100% { transform: scale(1.00); }
        }
      `}</style>

      {/* 背景画像（じわっとフェードイン＋ケンバーンズ） */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${import.meta.env.BASE_URL}support-room.jpg)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          opacity: visible ? 1 : 0,
          animation: visible ? 'supportKenBurns 4s cubic-bezier(0.4,0,0.2,1) forwards' : 'none',
          transition: 'opacity 1.6s ease',
        }}
      />

      {/* 下部グラデーション（フッターとの馴染み） */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 120,
        background: 'linear-gradient(to bottom, transparent 0%, rgba(8,20,40,0.7) 100%)',
        pointerEvents: 'none',
      }} />
    </div>
  )
}
