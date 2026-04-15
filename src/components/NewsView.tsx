import { useState, useEffect, useCallback } from 'react'

// ── ニュースソース定義 ──────────────────────────────────────
// Google News RSS：日経・ロイター・ブルームバーグ等を横断して集約してくれる
const SOURCES = [
  {
    id: 'jp-stock', label: '日本株', color: '#f97316',
    url: 'https://news.google.com/rss/search?q=日本株+株価+日経&hl=ja&gl=JP&ceid=JP:ja',
  },
  {
    id: 'forex', label: '為替', color: '#10b981',
    url: 'https://news.google.com/rss/search?q=為替+ドル円+円相場&hl=ja&gl=JP&ceid=JP:ja',
  },
  {
    id: 'economy', label: '経済', color: '#6366f1',
    url: 'https://news.google.com/rss/search?q=日本経済+金融政策+日銀&hl=ja&gl=JP&ceid=JP:ja',
  },
]

// allorigins.win：CORS プロキシ（無料・制限なし）
const PROXY = 'https://api.allorigins.win/get?url='

type Article = {
  id: string
  title: string
  link: string
  pubDate: string
  description: string
  sourceId: string
  sourceLabel: string
  sourceColor: string
}

// ── ユーティリティ ─────────────────────────────────────────
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min  = Math.floor(diff / 60_000)
  if (min < 1)  return 'たった今'
  if (min < 60) return `${min}分前`
  const h = Math.floor(min / 60)
  if (h < 24)   return `${h}時間前`
  const d = Math.floor(h / 24)
  if (d < 7)    return `${d}日前`
  return new Date(dateStr).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
}

// ── 記事カード ─────────────────────────────────────────────
function ArticleCard({ article }: { article: Article }) {
  const [hovered, setHovered] = useState(false)

  return (
    <a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'block', textDecoration: 'none',
        padding: '14px 16px',
        borderRadius: 12,
        background: hovered ? 'var(--glass-bg-hover)' : 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        transition: 'background 0.15s',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
        {/* ソースバッジ */}
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
          padding: '2px 8px', borderRadius: 20,
          background: article.sourceColor + '22',
          border: `1px solid ${article.sourceColor}55`,
          color: article.sourceColor,
          flexShrink: 0,
        }}>
          {article.sourceLabel}
        </span>
        {/* 時刻 */}
        <span style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>
          {relativeTime(article.pubDate)}
        </span>
      </div>
      {/* タイトル */}
      <p style={{
        fontSize: 13, fontWeight: 600, color: 'var(--text)',
        lineHeight: 1.55, margin: '0 0 6px',
        display: '-webkit-box', WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
      }}>
        {article.title}
      </p>
      {/* 本文抜粋 */}
      {article.description && (
        <p style={{
          fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.6, margin: 0,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
        }}>
          {article.description}
        </p>
      )}
    </a>
  )
}

// ── スケルトンローダー ─────────────────────────────────────
function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 70, height: 18, borderRadius: 20, background: 'var(--bg-medium)' }} />
            <div style={{ width: 40, height: 18, borderRadius: 4, background: 'var(--bg-medium)', marginLeft: 'auto' }} />
          </div>
          <div style={{ height: 14, borderRadius: 4, background: 'var(--bg-medium)', marginBottom: 6 }} />
          <div style={{ height: 14, borderRadius: 4, background: 'var(--bg-medium)', width: '70%' }} />
        </div>
      ))}
    </div>
  )
}

// ── メインビュー ──────────────────────────────────────────
export function NewsView() {
  const [articles,     setArticles]     = useState<Article[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [activeSource, setActiveSource] = useState<string>('all')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const results = await Promise.allSettled(
        SOURCES.map(async src => {
          const res  = await fetch(PROXY + encodeURIComponent(src.url))
          const data = await res.json()
          if (!data.contents) return []

          // RSS XML を DOMParser でパース
          const xml   = new DOMParser().parseFromString(data.contents, 'text/xml')
          const items = Array.from(xml.querySelectorAll('item'))

          return items.map((item, i): Article => {
            // <link> は子テキストノードで取れることが多い
            const link = item.querySelector('link')?.textContent?.trim()
              ?? item.getElementsByTagNameNS('*', 'origLink')[0]?.textContent?.trim()
              ?? ''
            return {
              id:          `${src.id}-${i}`,
              title:       item.querySelector('title')?.textContent?.trim()       ?? '',
              link,
              pubDate:     item.querySelector('pubDate')?.textContent?.trim()     ?? '',
              description: stripHtml(item.querySelector('description')?.textContent ?? ''),
              sourceId:    src.id,
              sourceLabel: src.label,
              sourceColor: src.color,
            }
          })
        })
      )

      const merged = results
        .filter((r): r is PromiseFulfilledResult<Article[]> => r.status === 'fulfilled')
        .flatMap(r => r.value)
        .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())

      if (merged.length === 0) throw new Error('記事を取得できませんでした。しばらく経ってから再試行してください。')
      setArticles(merged)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ニュースの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const displayed = activeSource === 'all'
    ? articles
    : articles.filter(a => a.sourceId === activeSource)

  return (
    <div style={styles.wrap}>

      {/* フィルターバー */}
      <div style={styles.filterBar}>
        {/* ソースタブ */}
        <div style={styles.tabs}>
          <button
            onClick={() => setActiveSource('all')}
            style={{ ...styles.tab, ...(activeSource === 'all' ? styles.tabActive : {}) }}
          >
            すべて
          </button>
          {SOURCES.map(src => (
            <button
              key={src.id}
              onClick={() => setActiveSource(src.id)}
              style={{
                ...styles.tab,
                ...(activeSource === src.id ? {
                  background: src.color + '1a',
                  border: `1px solid ${src.color}66`,
                  color: src.color,
                } : {}),
              }}
            >
              {src.label}
            </button>
          ))}
        </div>

        {/* 更新ボタン */}
        <button style={styles.refreshBtn} onClick={fetchAll} disabled={loading}>
          <svg
            width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}
          >
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          更新
        </button>
      </div>

      {/* 記事カウント */}
      {!loading && !error && (
        <p style={styles.count}>{displayed.length} 件</p>
      )}

      {/* コンテンツ */}
      <div style={styles.list}>
        {loading && <Skeleton />}
        {!loading && error && (
          <div style={styles.errorBox}>
            <p style={{ color: 'var(--text-sub)', fontSize: 13, marginBottom: 12 }}>{error}</p>
            <button style={styles.retryBtn} onClick={fetchAll}>再試行</button>
          </div>
        )}
        {!loading && !error && displayed.map(a => (
          <ArticleCard key={a.id} article={a} />
        ))}
      </div>

    </div>
  )
}

// ── スタイル ──────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  wrap: {
    flex: 1, display: 'flex', flexDirection: 'column',
    overflow: 'hidden', minHeight: 0,
    padding: '12px 16px 16px', gap: 10,
  },
  filterBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexShrink: 0, gap: 8,
  },
  tabs: {
    display: 'flex', gap: 6, flexWrap: 'wrap',
  },
  tab: {
    padding: '5px 13px', borderRadius: 20, fontSize: 12, fontWeight: 500,
    background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
    color: 'var(--text-sub)', cursor: 'pointer', transition: 'all 0.15s',
  },
  tabActive: {
    background: 'var(--glass-bg-strong)', border: '1px solid var(--glass-border)',
    color: 'var(--text)',
  },
  refreshBtn: {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
    background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
    color: 'var(--text-sub)', cursor: 'pointer', flexShrink: 0,
    transition: 'opacity 0.15s',
  },
  count: {
    fontSize: 11, color: 'var(--text-dim)', flexShrink: 0, margin: 0,
  },
  list: {
    flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column',
    gap: 8, minHeight: 0,
  },
  errorBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', flex: 1, gap: 4, paddingTop: 60,
  },
  retryBtn: {
    padding: '7px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
    color: 'var(--text-sub)', cursor: 'pointer',
  },
}
