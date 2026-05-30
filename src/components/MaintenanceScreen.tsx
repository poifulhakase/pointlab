// アプリ全体のメンテナンス画面（管理者以外に表示）。ぽいロボ サイバー世界観。
const DEFAULT_MESSAGE = 'ただいまメンテナンス中です。\nしばらく時間をおいて再度アクセスしてください。'

export function MaintenanceScreen({ theme, message }: { theme: 'dark' | 'light'; message?: string }) {
  const dark   = theme === 'dark'
  const accent = dark ? '#00e5ff' : '#0369a1'
  const bg     = dark
    ? 'radial-gradient(circle at 50% 30%, #0a1f30 0%, #050e1a 70%)'
    : 'radial-gradient(circle at 50% 30%, #e8f4f8 0%, #f0f7ff 70%)'
  const sub    = dark ? 'rgba(200,240,255,0.7)' : 'rgba(3,105,161,0.7)'
  const bracket = dark ? 'rgba(0,229,255,0.45)' : 'rgba(3,105,161,0.4)'
  const text   = (message ?? '').trim() || DEFAULT_MESSAGE
  const base   = import.meta.env.BASE_URL

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 22, padding: '32px 24px', textAlign: 'center',
      background: bg, fontFamily: "'Courier New', Courier, monospace",
    }}>
      <style>{`
        @keyframes mnt-pulse { 0%,100% { opacity: 0.55 } 50% { opacity: 1 } }
        @keyframes mnt-spin  { to { transform: rotate(360deg) } }
      `}</style>

      {/* 博士アイコン */}
      <div style={{ position: 'relative', width: 120, height: 120 }}>
        <span style={{
          position: 'absolute', inset: -8, borderRadius: '50%',
          border: `2px dashed ${bracket}`, animation: 'mnt-spin 14s linear infinite',
        }} />
        <img
          src={`${base}hakase.png`}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'contain', filter: dark ? 'drop-shadow(0 0 14px rgba(0,229,255,0.4))' : 'none' }}
        />
      </div>

      {/* ステータスラベル */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: accent, boxShadow: `0 0 8px ${accent}`, animation: 'mnt-pulse 1.6s ease-in-out infinite' }} />
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.28em', color: accent, textTransform: 'uppercase' }}>
          MAINTENANCE
        </span>
      </div>

      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: dark ? '#fff' : '#0b2942', letterSpacing: '0.04em' }}>
        ぽいロボ メンテナンス中
      </h1>

      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.9, color: sub, whiteSpace: 'pre-wrap', maxWidth: 420 }}>
        {text}
      </p>

      <p style={{ margin: 0, fontSize: 11, color: sub, opacity: 0.7, letterSpacing: '0.06em' }}>
        POIROBO_OS ▸ SYSTEM UPDATE IN PROGRESS
      </p>
    </div>
  )
}
