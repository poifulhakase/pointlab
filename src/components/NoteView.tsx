import React, { useState } from 'react'

type Props = { theme: 'dark' | 'light'; isMobile: boolean; onOpenSpec: () => void; onOpenLegal: () => void }

type Article = {
  genre: string
  title: string
  mobileTitle?: string
  url: string | null
  thumb: string | null
}

const BASE = import.meta.env.BASE_URL + 'notes/'

const ARTICLES: Article[] = [
  // ── 基本 ──────────────────────────────────────────────────────
  { genre: '基本',           title: 'レジスタンスサポート・移動平均線', mobileTitle: 'レジサポ・移動平均線', url: 'https://note.com/pointlab/n/n383409929e89', thumb: BASE + 'Stock_Trade_Lab_moving_average_line_register_support.png' },
  { genre: '基本',           title: '出来高',          url: 'https://note.com/pointlab/n/na22865f89238', thumb: BASE + 'Stock_Trade_Lab_Volume.png' },
  { genre: '基本',           title: '時間軸',          url: 'https://note.com/pointlab/n/nd74fce56edcc', thumb: BASE + 'Stock_Trade_Lab_Timeframe.png' },
  { genre: '基本',           title: 'MTF分析',         url: null,                                         thumb: BASE + 'Stock_Trade_Lab_Mtf_Analysis.png' },
  { genre: '基本',           title: '分割エントリー',   url: 'https://note.com/pointlab/n/nb16ef04958ae', thumb: BASE + 'Stock_Trade_Lab_SplitEntry.png' },
  // ── インジケーター ────────────────────────────────────────────
  { genre: 'インジケーター', title: 'TradingView',    url: 'https://note.com/pointlab/n/n7b69eccb90f3', thumb: BASE + 'Stock_Trade_Lab_TradingView.png' },
  { genre: 'インジケーター', title: 'CVD',             url: 'https://note.com/pointlab/n/ned4eb2264600',  thumb: BASE + 'Stock_Trade_Lab_Cumulative_Volume_Delta.png' },
  { genre: 'インジケーター', title: 'MACD',            url: 'https://note.com/pointlab/n/n2817e9181530', thumb: BASE + 'Stock_Trade_Lab_Macd.png' },
  { genre: 'インジケーター', title: 'ボリンジャーバンド', url: 'https://note.com/pointlab/n/n91f688571407', thumb: BASE + 'Stock_Trade_Lab_BB.png' },
  { genre: 'インジケーター', title: 'RSI',             url: 'https://note.com/pointlab/n/ncd65c830de29', thumb: BASE + 'Stock_Trade_Lab_RSI.png' },
  { genre: 'インジケーター', title: 'パラボリック',     url: 'https://note.com/pointlab/n/n635865776b8e', thumb: BASE + 'Stock_Trade_Lab_ParabolicSAR.png' },
  { genre: 'インジケーター', title: 'ストキャスティクス', url: 'https://note.com/pointlab/n/na7f744ea8158', thumb: BASE + 'Stock_Trade_Lab_Stochastic.png' },
  { genre: 'インジケーター', title: '実践統合編',       url: 'https://note.com/pointlab/n/nb4793929edcd', thumb: BASE + 'Stock_Trade_Lab_Multiple_Index.png' },
  // ── イベントドリブン ──────────────────────────────────────────
  { genre: 'イベントドリブン', title: 'タックスロスセリング', url: 'https://note.com/pointlab/n/nc96324c04c97', thumb: BASE + 'Stock_Trade_Lab_Event_Driven_Tax_Loss_Selling.png' },
  // ── 未来ガジェット ────────────────────────────────────────────
  { genre: '未来ガジェット', title: 'PER市場温度計', url: 'https://note.com/pointlab/n/n27ca54c2922e', thumb: BASE + 'Future_Gadget_per_line_autogeneration_device.jpg' },
]

const GENRES = ['基本', 'インジケーター', 'イベントドリブン', '未来ガジェット']

function ArticleCard({ article, isMobile }: { article: Article; isMobile: boolean }) {
  const isComingSoon = article.url === null
  const [hovered, setHovered] = React.useState(false)

  const handleClick = () => {
    if (isComingSoon || !article.url) return
    if (isMobile) {
      window.open(article.url, '_blank')
    } else {
      window.open(article.url, '_blank', `width=800,height=${screen.height},left=100,top=0`)
    }
  }

  return (
    <div
      style={{
        ...s.card,
        cursor: isComingSoon ? 'default' : 'pointer',
        opacity: isComingSoon ? 0.55 : 1,
        transform: (!isComingSoon && hovered) ? 'translateY(-3px)' : 'none',
        boxShadow: (!isComingSoon && hovered) ? '0 8px 24px rgba(0,0,0,0.2)' : 'none',
      }}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role={isComingSoon ? undefined : 'button'}
      tabIndex={isComingSoon ? undefined : 0}
      onKeyDown={e => { if (!isComingSoon && (e.key === 'Enter' || e.key === ' ')) handleClick() }}
    >
      {/* サムネイル */}
      <div style={s.thumbWrap}>
        {article.thumb
          ? <img src={article.thumb} alt={article.title} style={s.thumb} loading="lazy" />
          : <div style={s.thumbPlaceholder} />
        }
        {isComingSoon && (
          <div style={s.comingSoonBadge}>近日公開</div>
        )}
      </div>

      {/* タイトル */}
      <div style={s.cardBody}>
        <p style={s.cardTitle}>{isMobile && article.mobileTitle ? article.mobileTitle : article.title}</p>
      </div>
    </div>
  )
}

export function NoteView({ isMobile, onOpenSpec, onOpenLegal }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ヘッダー */}
      <div style={s.header} className="glass">
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <button style={s.gearBtn} onClick={() => setMenuOpen(o => !o)} aria-label="設定">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
          {menuOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setMenuOpen(false)} />
              <div style={s.menuDropdown}>
                <button style={s.menuItem} onClick={() => { setMenuOpen(false); onOpenSpec() }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                  システム仕様
                </button>
                <div style={{ height: 1, background: 'var(--glass-border)', margin: '2px 0' }} />
                <button style={s.menuItem} onClick={() => { setMenuOpen(false); onOpenLegal() }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                  プライバシー・免責事項
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* コンテンツ */}
      <div style={s.wrap}>
        <div style={s.inner}>
          {GENRES.map(genre => {
            const items = ARTICLES.filter(a => a.genre === genre)
            return (
              <section key={genre} style={s.section}>
                <h2 style={s.genreHeading}>{genre}</h2>
                <div style={{ ...s.grid, ...(isMobile ? s.gridMobile : {}) }}>
                  {items.map(article => (
                    <ArticleCard key={article.title} article={article} isMobile={isMobile} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex', alignItems: 'center',
    padding: '7px 12px', minHeight: 46, flexShrink: 0,
    borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none',
    userSelect: 'none',
  },
  gearBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 32, height: 32, borderRadius: 8,
    color: 'var(--text-sub)', cursor: 'pointer',
    background: 'transparent', border: 'none',
  },
  menuDropdown: {
    position: 'absolute', right: 0, top: '100%', marginTop: 4,
    background: 'var(--modal-bg)', borderRadius: 10, overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(0,0,0,0.18)', minWidth: 140, zIndex: 100,
  },
  menuItem: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 16px', fontSize: 13, fontWeight: 500,
    color: 'var(--text)', cursor: 'pointer', width: '100%',
    textAlign: 'left', background: 'transparent', border: 'none',
  },
  wrap: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 16px 32px',
  },
  inner: {
    maxWidth: 1100,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 36,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  genreHeading: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '0.04em',
    paddingBottom: 6,
    borderBottom: '1px solid var(--glass-border)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 16,
  },
  gridMobile: {
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 12,
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    background: 'var(--glass-bg)',
    border: '1px solid var(--glass-border)',
    transition: 'transform 0.15s, box-shadow 0.15s',
    userSelect: 'none',
  },
  thumbWrap: {
    position: 'relative',
    width: '100%',
    paddingBottom: '56.25%', // 16:9
    background: 'var(--glass-border)',
    overflow: 'hidden',
  },
  thumb: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  thumbPlaceholder: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(135deg, rgba(80,80,100,0.3) 0%, rgba(40,40,60,0.5) 100%)',
  },
  comingSoonBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    background: 'rgba(0,0,0,0.6)',
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: 600,
    padding: '3px 8px',
    borderRadius: 20,
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    letterSpacing: '0.05em',
  },
  cardBody: {
    padding: '10px 12px 12px',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text)',
    lineHeight: 1.4,
    margin: 0,
  },
}
