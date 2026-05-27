import React from 'react'

type Props = {
  theme: 'dark' | 'light'
  isMobile: boolean
  isAdmin?: boolean
  onOpenManual?: () => void
  onOpenLegal?: () => void
  onOpenBacktest?: () => void
  onOpenEvals?: () => void
  onOpenSpec?: () => void
  onOpenOriginal?: () => void
}

type Article = {
  genre: string
  title: string
  mobileTitle?: string
  url: string | null
  thumb: string | null
  internalAction?: 'manual' | 'legal' | 'backtest' | 'evals' | 'spec' | 'original'
}

const BASE = import.meta.env.BASE_URL + 'notes/'

const ARTICLES: Article[] = [
  // ── ぽいロボ ──────────────────────────────────────────────────
  { genre: 'ぽいロボ', title: '説明書',           url: null, thumb: BASE + 'manual.png', internalAction: 'manual' },
  { genre: 'ぽいロボ', title: 'ぽいロボ独自機能', url: null, thumb: BASE + 'poirobo_original_feature.png', internalAction: 'original' },
  { genre: 'ぽいロボ', title: '需給エネルギーバックテスト', mobileTitle: 'エネルギーバックテスト', url: null, thumb: null, internalAction: 'backtest' },
  // ── 基礎 ──────────────────────────────────────────────────────
  { genre: '基礎',           title: 'レジスタンスサポート・移動平均線', mobileTitle: 'レジサポ・移動平均線', url: 'https://note.com/pointlab/n/n383409929e89', thumb: BASE + 'Stock_Trade_Lab_moving_average_line_register_support.webp' },
  { genre: '基礎',           title: '出来高',          url: 'https://note.com/pointlab/n/na22865f89238', thumb: BASE + 'Stock_Trade_Lab_Volume.webp' },
  { genre: '基礎',           title: '時間軸',          url: 'https://note.com/pointlab/n/nd74fce56edcc', thumb: BASE + 'Stock_Trade_Lab_Timeframe.webp' },
  { genre: '基礎',           title: '分割エントリー',   url: 'https://note.com/pointlab/n/nb16ef04958ae', thumb: BASE + 'Stock_Trade_Lab_SplitEntry.webp' },
  // ── インジケーター ────────────────────────────────────────────
  { genre: 'インジケーター', title: 'TradingView',    url: 'https://note.com/pointlab/n/n7b69eccb90f3', thumb: BASE + 'Stock_Trade_Lab_TradingView.webp' },
  { genre: 'インジケーター', title: 'CVD',             url: 'https://note.com/pointlab/n/ned4eb2264600',  thumb: BASE + 'Stock_Trade_Lab_Cumulative_Volume_Delta.webp' },
  { genre: 'インジケーター', title: 'MACD',            url: 'https://note.com/pointlab/n/n2817e9181530', thumb: BASE + 'Stock_Trade_Lab_Macd.webp' },
  { genre: 'インジケーター', title: 'ボリンジャーバンド', url: 'https://note.com/pointlab/n/n91f688571407', thumb: BASE + 'Stock_Trade_Lab_BB.webp' },
  { genre: 'インジケーター', title: 'RSI',             url: 'https://note.com/pointlab/n/ncd65c830de29', thumb: BASE + 'Stock_Trade_Lab_RSI.webp' },
  { genre: 'インジケーター', title: 'パラボリック',     url: 'https://note.com/pointlab/n/n635865776b8e', thumb: BASE + 'Stock_Trade_Lab_ParabolicSAR.webp' },
  { genre: 'インジケーター', title: 'ストキャスティクス', url: 'https://note.com/pointlab/n/na7f744ea8158', thumb: BASE + 'Stock_Trade_Lab_Stochastic.webp' },
  { genre: 'インジケーター', title: '実践統合編',       url: 'https://note.com/pointlab/n/nb4793929edcd', thumb: BASE + 'Stock_Trade_Lab_Multiple_Index.webp' },
  // ── イベントドリブン ──────────────────────────────────────────
  { genre: 'イベントドリブン', title: 'タックスロスセリング', url: 'https://note.com/pointlab/n/nc96324c04c97', thumb: BASE + 'Stock_Trade_Lab_Event_Driven_Tax_Loss_Selling.webp' },
  { genre: 'イベントドリブン', title: '権利落ち日',    url: null, thumb: BASE + 'Stock_Trade_Lab_Event_Driven_Ex_Rights_Day.webp' },
  { genre: 'イベントドリブン', title: '権利確定日前',  url: null, thumb: BASE + 'Stock_Trade_Lab_Event_Driven_Rights_Record_Day.webp' },
  { genre: 'イベントドリブン', title: 'TOPIX組入れ',   url: null, thumb: BASE + 'Stock_Trade_Lab_Event_Driven_TOPIX_Inclusion.webp' },
  // ── 管理者 ────────────────────────────────────────────────────
  { genre: '管理者', title: 'システム仕様', url: null, thumb: null, internalAction: 'spec' },
  { genre: '管理者', title: 'プロンプト Evals', url: null, thumb: null, internalAction: 'evals' },
  // ── 未来ガジェット ────────────────────────────────────────────
  { genre: '未来ガジェット', title: 'PER市場温度計', url: 'https://note.com/pointlab/n/n27ca54c2922e', thumb: BASE + 'Future_Gadget_per_line_autogeneration_device.webp' },
]

const GENRES = ['ぽいロボ', '未来ガジェット', '基礎', 'インジケーター', 'イベントドリブン', '管理者']

function ArticleCard({ article, isMobile, onOpenManual, onOpenLegal, onOpenBacktest, onOpenEvals, onOpenSpec, onOpenOriginal }: {
  article: Article
  isMobile: boolean
  onOpenManual?: () => void
  onOpenLegal?: () => void
  onOpenBacktest?: () => void
  onOpenEvals?: () => void
  onOpenSpec?: () => void
  onOpenOriginal?: () => void
}) {
  const isComingSoon = article.url === null && !article.internalAction
  const [hovered, setHovered] = React.useState(false)

  const handleClick = () => {
    if (isComingSoon) return
    if (article.internalAction === 'manual')   { onOpenManual?.();   return }
    if (article.internalAction === 'legal')    { onOpenLegal?.();    return }
    if (article.internalAction === 'backtest') { onOpenBacktest?.(); return }
    if (article.internalAction === 'evals')    { onOpenEvals?.();    return }
    if (article.internalAction === 'spec')     { onOpenSpec?.();     return }
    if (article.internalAction === 'original') { onOpenOriginal?.(); return }
    if (!article.url) return
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

export function NoteView({ theme, isMobile, isAdmin = false, onOpenManual, onOpenLegal, onOpenBacktest, onOpenEvals, onOpenSpec, onOpenOriginal }: Props) {
  const visibleArticles = isAdmin ? ARTICLES : ARTICLES.filter(a => a.internalAction !== 'evals' && a.internalAction !== 'spec')

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: theme === 'dark' ? 'transparent' : '#f4f6f9' }}>

      {/* コンテンツ */}
      <div style={s.wrap}>
        <div style={s.inner}>
          {GENRES.map(genre => {
            const items = visibleArticles.filter(a => a.genre === genre)
            if (items.length === 0) return null
            return (
              <section key={genre} style={s.section}>
                <h2 style={s.genreHeading}>{genre}</h2>
                <div style={{ ...s.grid, ...(isMobile ? s.gridMobile : {}) }}>
                  {items.map(article => (
                    <ArticleCard key={article.title} article={article} isMobile={isMobile} onOpenManual={onOpenManual} onOpenLegal={onOpenLegal} onOpenBacktest={onOpenBacktest} onOpenEvals={onOpenEvals} onOpenSpec={onOpenSpec} onOpenOriginal={onOpenOriginal} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>

        {/* フッター：スクロール末尾に配置 */}
        <div style={{ ...s.footer, flexDirection: 'column', gap: 12 }}>
          {/* SNS リンク */}
          <div style={{ display: 'flex', gap: 8 }}>
            <a
              href="https://note.com/pointlab"
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => { e.preventDefault(); window.open('https://note.com/pointlab', '_blank') }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 8,
                border: '1px solid var(--glass-border)',
                background: 'var(--glass-bg)',
                color: 'var(--text-sub)',
                textDecoration: 'none',
                fontSize: 12, fontWeight: 600,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                <path d="M5 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5zm2 4h4.5c1.4 0 2.5.6 3.1 1.5.4.6.6 1.3.6 2 0 1.9-1.2 3.5-3.2 3.5H9v3H7V7zm2 5.3h2.1c.9 0 1.4-.7 1.4-1.8 0-1-.5-1.7-1.4-1.7H9v3.5z"/>
              </svg>
              note
            </a>
            <a
              href="https://x.com/Aojiru_Hakase"
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => { e.preventDefault(); window.open('https://x.com/Aojiru_Hakase', '_blank') }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 8,
                border: '1px solid var(--glass-border)',
                background: 'var(--glass-bg)',
                color: 'var(--text-sub)',
                textDecoration: 'none',
                fontSize: 12, fontWeight: 600,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.727-8.84L1.254 2.25H8.08l4.253 5.622 5.91-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              X
            </a>
          </div>
          <button onClick={onOpenLegal} style={s.footerLink}>
            プライバシーポリシー・免責事項
          </button>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex', alignItems: 'center',
    padding: '7px 12px', minHeight: 46, flexShrink: 0,
    background: 'transparent', border: 'none',
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
    gap: 54,
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
  footer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '64px 16px 16px',
  },
  footerLink: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    color: 'var(--text-dim)',
    textDecoration: 'underline',
    textDecorationColor: 'var(--text-dim)',
    textUnderlineOffset: 3,
    padding: '4px 8px',
    borderRadius: 4,
  },
}
