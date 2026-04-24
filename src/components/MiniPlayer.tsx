import { createPortal } from 'react-dom'

export type YtPlayInfo = { videoId: string; title: string; time: number }

export function MiniPlayer({
  info,
  onClose,
  onExpand,
}: {
  info: YtPlayInfo
  onClose: () => void
  onExpand: () => void
}) {
  const startSec = Math.floor(info.time)

  return createPortal(
    <div style={s.wrap}>
      {/* header bar */}
      <div style={s.header}>
        <span style={s.title} title={info.title}>{info.title}</span>
        <div style={s.headerBtns}>
          <button style={s.iconBtn} onClick={onExpand} title="ムービーを開く">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 3 21 3 21 9"/>
              <polyline points="9 21 3 21 3 15"/>
              <line x1="21" y1="3" x2="14" y2="10"/>
              <line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
          </button>
          <button style={s.iconBtn} onClick={onClose} title="閉じる">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* player */}
      <div style={s.playerWrap}>
        <iframe
          key={`${info.videoId}-${startSec}`}
          style={s.iframe}
          src={`https://www.youtube.com/embed/${info.videoId}?autoplay=1&start=${startSec}&controls=1&rel=0&modestbranding=1&enablejsapi=1`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={info.title}
        />
      </div>
    </div>,
    document.body
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'fixed',
    bottom: 'calc(var(--header-height) + 12px)',
    right: 16,
    width: 320,
    borderRadius: 10,
    overflow: 'hidden',
    zIndex: 500,
    background: 'rgba(14,16,28,0.92)',
    border: '1px solid rgba(255,255,255,0.12)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 8px',
    background: 'rgba(0,0,0,0.35)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  title: {
    flex: 1,
    fontSize: 11,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.88)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  headerBtns: { display: 'flex', gap: 2, flexShrink: 0 },
  iconBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 26, height: 26, borderRadius: 6,
    color: 'rgba(255,255,255,0.7)',
    transition: 'background 0.12s',
  },
  playerWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: '16/9',
    background: '#000',
  },
  iframe: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    border: 'none',
    display: 'block',
  },
}
