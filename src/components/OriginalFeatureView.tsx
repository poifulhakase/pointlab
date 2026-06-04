type Props = { theme: 'dark' | 'light'; isMobile: boolean; onClose?: () => void }

export function OriginalFeatureView({ theme, isMobile, onClose }: Props) {
  const D = theme === 'dark'
  const mono = "'Courier New', Courier, monospace" as const
  const c = {
    bg:    D ? 'rgba(3,10,24,0.92)'  : 'rgba(218,236,255,0.92)',
    hdrBg: D ? 'rgba(3,9,22,0.97)'   : 'rgba(228,242,255,0.97)',
    scan:  D ? 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,229,255,0.013) 3px,rgba(0,229,255,0.013) 4px)' : 'none',
    accent: D ? '#00e5ff'             : '#0369a1',
    dim:   D ? 'rgba(0,229,255,0.42)' : 'rgba(3,105,161,0.62)',
    rule:  D ? 'rgba(0,200,255,0.10)' : 'rgba(3,105,161,0.12)',
  }

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: c.bg, backgroundImage: c.scan }}>
      <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', zIndex: 1, display: 'flex', flexDirection: 'column' }}>

        <div style={{
          position: 'sticky', top: 0, zIndex: 5,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: isMobile ? '11px 16px' : '12px 28px',
          background: c.hdrBg,
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${c.rule}`,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.accent, boxShadow: D ? `0 0 7px ${c.accent}` : 'none', flexShrink: 0 }} />
          <span style={{
            flex: 1, fontSize: 10, fontWeight: 700, letterSpacing: '0.22em',
            color: c.dim, fontFamily: mono, whiteSpace: 'nowrap',
            textShadow: D ? '0 0 10px rgba(0,229,255,0.28)' : 'none',
          }}>
            ぽいロボ ▸ 独自機能
          </span>
          {onClose && (
            <button onClick={onClose} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 7,
              border: D ? '1px solid rgba(0,200,255,0.20)' : '1px solid rgba(0,100,180,0.25)',
              background: D ? 'rgba(0,200,255,0.06)' : 'rgba(0,100,180,0.08)',
              color: D ? 'rgba(0,200,255,0.65)' : 'rgba(0,80,160,0.70)',
              cursor: 'pointer', flexShrink: 0,
            }} aria-label="閉じる">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '24px 16px' : '32px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>🔬</div>
          <p style={{ fontSize: 14, color: c.dim, fontFamily: mono, letterSpacing: '0.08em' }}>準備中</p>
        </div>

      </div>
    </div>
  )
}
