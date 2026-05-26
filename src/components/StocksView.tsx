import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { fetchStocksDaily, STOCKS_CACHE_KEY, type StocksItem, type SectorItem, type StocksDailyData, type NkFuturesDayData } from '../utils/stocksDailyData'
import { getCachedUpdatedAt } from '../utils/dataCache'

type Props = {
  theme: 'dark' | 'light'
  isMobile: boolean
}

// Japanese stock convention: 上昇=赤, 下落=青
function upColor(isDark: boolean)  { return isDark ? 'rgba(248,113,113,0.92)' : 'rgba(185,28,28,0.9)' }
function upBg(isDark: boolean)     { return isDark ? 'rgba(248,113,113,0.10)' : 'rgba(185,28,28,0.07)' }
function upBorder(isDark: boolean) { return isDark ? 'rgba(248,113,113,0.25)' : 'rgba(185,28,28,0.15)' }
function dnColor(isDark: boolean)  { return isDark ? 'rgba(96,165,250,0.92)'  : 'rgba(37,99,235,0.9)'  }
function dnBg(isDark: boolean)     { return isDark ? 'rgba(96,165,250,0.10)'  : 'rgba(37,99,235,0.07)' }
function dnBorder(isDark: boolean) { return isDark ? 'rgba(96,165,250,0.25)'  : 'rgba(37,99,235,0.15)' }

function chgColor(v: number | null, isDark: boolean) {
  if (v == null || v === 0) return 'var(--text-dim)'
  return v > 0 ? upColor(isDark) : dnColor(isDark)
}
function chgBg(v: number | null, isDark: boolean) {
  if (v == null || v === 0) return 'transparent'
  return v > 0 ? upBg(isDark) : dnBg(isDark)
}

function fmtContrib(v: number): string {
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(2)}`
}
function fmtPct(v: number): string {
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(2)}%`
}
function fmtChg(v: number | null): string {
  if (v == null) return '—'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toLocaleString()}`
}
function fmtChgPct(v: number | null): string {
  if (v == null) return '—'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(2)}%`
}
function fmtDate(s: string): string {
  // YYYY-MM-DD → M/D
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return s
  return `${parseInt(m[2])}/${parseInt(m[3])}`
}
function fmtUpdatedAt(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const h = d.getHours().toString().padStart(2, '0')
  const mn = d.getMinutes().toString().padStart(2, '0')
  return `${h}:${mn}`
}
function fmtDateMD(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// ── 日経先物 日次テーブル ──────────────────────────────────
function NkDailyTable({ rows, isMobile, isDark }: {
  rows: NkFuturesDayData[]; isMobile: boolean; isDark: boolean
}) {
  const th: React.CSSProperties = {
    position: 'sticky', top: 0, zIndex: 2,
    padding: isMobile ? '7px 6px' : '8px 12px',
    background: 'var(--modal-bg)',
    backdropFilter: 'blur(8px)',
    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.09)'}`,
    fontSize: isMobile ? 10 : 11, fontWeight: 700, color: 'var(--text-sub)',
    textAlign: 'right' as const, whiteSpace: 'nowrap' as const,
  }
  const thL: React.CSSProperties = { ...th, textAlign: 'left' as const }
  const td = (chg: number | null): React.CSSProperties => ({
    padding: isMobile ? '9px 6px' : '10px 12px',
    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
    fontSize: isMobile ? 12 : 13,
    textAlign: 'right' as const,
    fontVariantNumeric: 'tabular-nums' as const,
    whiteSpace: 'nowrap' as const,
    color: chgColor(chg, isDark),
    background: chgBg(chg, isDark),
  })
  const tdN: React.CSSProperties = {
    ...td(null),
    color: 'var(--text)', background: 'transparent',
  }
  const tdDate: React.CSSProperties = {
    ...tdN, textAlign: 'left' as const,
    color: 'var(--text-sub)', fontSize: isMobile ? 11 : 12,
  }

  return (
    <div style={{
      background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)'}`,
      borderRadius: 10, overflow: 'hidden',
    }}>
      {/* panel title */}
      <div style={{
        padding: '9px 12px 8px',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
        fontSize: 12, fontWeight: 700, color: 'var(--text-sub)', letterSpacing: '0.06em',
      }}>
        日経平均先物（NK=F）日次
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thL}>日付</th>
              {!isMobile && <th style={th}>始値</th>}
              {!isMobile && <th style={th}>高値</th>}
              {!isMobile && <th style={th}>安値</th>}
              <th style={th}>終値</th>
              <th style={th}>前日比</th>
              <th style={th}>変動率</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map(row => (
              <tr key={row.date}>
                <td style={tdDate}>{fmtDate(row.date)}</td>
                {!isMobile && <td style={tdN}>{row.open.toLocaleString()}</td>}
                {!isMobile && <td style={tdN}>{row.high.toLocaleString()}</td>}
                {!isMobile && <td style={tdN}>{row.low.toLocaleString()}</td>}
                <td style={tdN}>{row.close.toLocaleString()}</td>
                <td style={td(row.change)}>{fmtChg(row.change)}</td>
                <td style={td(row.change_pct)}>{fmtChgPct(row.change_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── 銘柄寄与度 row ─────────────────────────────────────────
function ContribRow({ item, rank, isUp, isDark, total }: {
  item: StocksItem; rank: number; isUp: boolean; isDark: boolean; total: number
}) {
  const color = isUp ? upColor(isDark) : dnColor(isDark)
  const pct   = total !== 0 ? Math.abs(item.contribution / total * 100) : null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '0 12px', height: 42,
      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
    }}>
      <span style={{
        fontSize: 11, fontWeight: 700, color: 'var(--text-dim)',
        minWidth: 14, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
      }}>{rank}</span>
      <span style={{
        fontSize: 11, color: 'var(--text-dim)',
        minWidth: 38, fontVariantNumeric: 'tabular-nums',
      }}>{item.code}</span>
      <span style={{
        flex: 1, fontSize: 13, color: 'var(--text)', overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
      }}>{item.name}</span>
      {item.sector && (
        <span style={{
          fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap',
          padding: '2px 5px', borderRadius: 3,
          background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)'}`,
          flexShrink: 0,
        }}>{item.sector}</span>
      )}
      <span style={{
        fontSize: 14, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums',
        minWidth: 52, textAlign: 'right', flexShrink: 0,
      }}>{fmtContrib(item.contribution)}</span>
      <span style={{
        fontSize: 12, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums',
        minWidth: 42, textAlign: 'right', flexShrink: 0,
        opacity: pct != null ? 1 : 0,
      }}>{pct != null ? `${pct.toFixed(1)}%` : ''}</span>
    </div>
  )
}

// ── 業種別騰落率 row ────────────────────────────────────────
function SectorRow({ item, rank, isUp, isDark }: {
  item: SectorItem; rank: number; isUp: boolean; isDark: boolean
}) {
  const color = isUp ? upColor(isDark) : dnColor(isDark)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '0 12px', height: 42,
      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
    }}>
      <span style={{
        fontSize: 11, fontWeight: 700, color: 'var(--text-dim)',
        minWidth: 14, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
      }}>{rank}</span>
      <span style={{
        flex: 1, fontSize: 13, color: 'var(--text)', overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{item.name}</span>
      <span style={{
        fontSize: 14, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums',
        minWidth: 56, textAlign: 'right',
      }}>{fmtPct(item.changePct)}</span>
    </div>
  )
}

// ── セクションヘッダー（上昇 / 下落） ─────────────────────
function SectionLabel({ label, isUp, isDark }: { label: string; isUp: boolean; isDark: boolean }) {
  const color  = isUp ? upColor(isDark)  : dnColor(isDark)
  const bg     = isUp ? upBg(isDark)     : dnBg(isDark)
  const border = isUp ? upBorder(isDark) : dnBorder(isDark)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '0 12px', height: 30,
      background: bg, borderBottom: `1px solid ${border}`,
    }}>
      <svg width="8" height="8" viewBox="0 0 8 8" fill={color}>
        {isUp ? <polygon points="4,0 8,8 0,8" /> : <polygon points="0,0 8,0 4,8" />}
      </svg>
      <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: '0.05em' }}>{label}</span>
    </div>
  )
}

// ── パネル（銘柄 or 業種） ─────────────────────────────────
function Panel({ title, upItems, downItems, renderUp, renderDown, isDark }: {
  title: string; upItems: unknown[]; downItems: unknown[]
  renderUp: (item: unknown, rank: number) => ReactNode
  renderDown: (item: unknown, rank: number) => ReactNode
  isDark: boolean
}) {
  return (
    <div style={{
      flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
      background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)'}`,
      borderRadius: 10, overflow: 'hidden',
    }}>
      <div style={{
        padding: '9px 12px 8px',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
        fontSize: 12, fontWeight: 700, color: 'var(--text-sub)', letterSpacing: '0.06em',
      }}>{title}</div>
      <SectionLabel label="上昇 TOP5" isUp isDark={isDark} />
      {upItems.length > 0
        ? upItems.map((item, i) => renderUp(item, i + 1))
        : <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-dim)' }}>データなし</div>}
      <SectionLabel label="下落 TOP5" isUp={false} isDark={isDark} />
      {downItems.length > 0
        ? downItems.map((item, i) => renderDown(item, i + 1))
        : <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-dim)' }}>データなし</div>}
    </div>
  )
}

function Spinner() {
  return (
    <div style={{
      width: 22, height: 22, borderRadius: '50%',
      border: '2.5px solid var(--glass-border)', borderTopColor: 'var(--accent)',
      animation: 'spin 0.8s linear infinite',
    }} />
  )
}

// ── メインコンポーネント ───────────────────────────────────
export function StocksView({ theme, isMobile }: Props) {
  const isDark = theme === 'dark'
  const [data,    setData]    = useState<StocksDailyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const load = useCallback(async (force = false) => {
    setLoading(true)
    setError('')
    try {
      setData(await fetchStocksDaily(force))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const updatedAt = data?.updatedAt ?? getCachedUpdatedAt(STOCKS_CACHE_KEY)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

      {/* ── ヘッダー ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 14px', flexShrink: 0,
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
        userSelect: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-sub)' }}>
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6"  y1="20" x2="6"  y2="14"/>
          </svg>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>日経平均</span>
          <span style={{ fontSize: 10, color: 'var(--text-sub)' }}>日次 / 銘柄別寄与度 / 業種別騰落率</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {updatedAt && (
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{fmtUpdatedAt(updatedAt)}</span>
          )}
          <button
            onClick={() => load(true)} disabled={loading}
            style={{
              background: 'none', border: 'none', cursor: loading ? 'default' : 'pointer',
              padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-dim)', opacity: loading ? 0.5 : 1, borderRadius: 4,
            }}
            title="再取得"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }}>
              <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
              <path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── コンテンツ ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '10px 10px 16px' : '14px 16px 20px' }}>

        {loading && !data && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 48 }}>
            <Spinner />
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>取得中…</span>
          </div>
        )}

        {error && !data && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 32 }}>
            <span style={{ fontSize: 12, color: isDark ? 'rgba(248,113,113,0.7)' : 'rgba(185,28,28,0.7)' }}>{error}</span>
            <button onClick={() => load(true)} style={{
              fontSize: 11, padding: '5px 14px', borderRadius: 6, cursor: 'pointer',
              background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'}`,
              color: 'var(--text)',
            }}>再試行</button>
          </div>
        )}

        {data && (
          <>
            {/* 3列レイアウト: 銘柄別寄与度 | 業種別騰落率 | 日経先物日次 */}
            <div style={{
              display: 'flex', flexDirection: isMobile ? 'column' : 'row',
              gap: isMobile ? 10 : 14, alignItems: 'stretch',
            }}>
              <Panel
                title="銘柄別寄与度"
                upItems={data.contribution.up}
                downItems={data.contribution.down}
                isDark={isDark}
                renderUp={(item, rank) => (
                  <ContribRow key={(item as StocksItem).code} item={item as StocksItem} rank={rank} isUp isDark={isDark} total={data.contribution.total ?? 0} />
                )}
                renderDown={(item, rank) => (
                  <ContribRow key={(item as StocksItem).code} item={item as StocksItem} rank={rank} isUp={false} isDark={isDark} total={data.contribution.total ?? 0} />
                )}
              />
              <Panel
                title="業種別騰落率（東証33業種）"
                upItems={data.sector.up}
                downItems={data.sector.down}
                isDark={isDark}
                renderUp={(item, rank) => (
                  <SectorRow key={(item as SectorItem).name} item={item as SectorItem} rank={rank} isUp isDark={isDark} />
                )}
                renderDown={(item, rank) => (
                  <SectorRow key={(item as SectorItem).name} item={item as SectorItem} rank={rank} isUp={false} isDark={isDark} />
                )}
              />
              {/* 日経先物 日次テーブル（3列目） */}
              {(data.nkFutures?.length ?? 0) > 0 && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <NkDailyTable rows={data.nkFutures ?? []} isMobile={isMobile} isDark={isDark} />
                </div>
              )}
            </div>

            {/* データソース */}
            <div style={{
              marginTop: 12, padding: '0 2px',
              fontSize: 10, color: 'var(--text-dim)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span>出典:</span>
              <span>nikkeiyosoku.com / Yahoo Finance</span>
              <span style={{ margin: '0 2px' }}>·</span>
              <span>30分キャッシュ</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── 銘柄別寄与度 / 業種別騰落率 (QuantView 現物タブ BR セル用) ─────────
export function ContribSectorPanel({ theme, isMobile }: { theme: 'dark' | 'light'; isMobile: boolean }) {
  const isDark = theme === 'dark'
  const [data,    setData]    = useState<StocksDailyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const load = useCallback(async (force = false) => {
    setLoading(true)
    setError('')
    try {
      setData(await fetchStocksDaily(force))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const upCol = isDark ? 'rgba(96,200,140,0.95)'  : 'rgba(22,130,80,0.95)'
  const dnCol = isDark ? 'rgba(255,120,100,0.95)' : 'rgba(200,50,30,0.95)'

  const th: React.CSSProperties = {
    position: 'sticky', top: 0, zIndex: 2,
    padding: '16px 10px', textAlign: 'right',
    background: 'var(--modal-bg)', backdropFilter: 'blur(16px)',
    borderBottom: '2px solid var(--border-dim)',
    fontSize: 11, fontWeight: 700, color: 'var(--text)',
    whiteSpace: 'nowrap',
  }
  const thL: React.CSSProperties = { ...th, textAlign: 'left' }
  const td: React.CSSProperties = {
    padding: '6px 10px', borderBottom: '1px solid var(--border-dim)',
    fontSize: 12, whiteSpace: 'nowrap',
  }
  const tdL: React.CSSProperties = { ...td, textAlign: 'left' }
  const tdR: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

  const sectionTd = (col: string, upBg: string): React.CSSProperties => ({
    ...td, padding: '4px 10px',
    fontSize: 10, fontWeight: 700, color: col,
    background: upBg,
  })

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

      {/* header — s.panelHead と同一スタイル */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 14px', flexShrink: 0,
        borderBottom: '1px solid var(--border-dim)', userSelect: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6"  y1="20" x2="6"  y2="14"/>
          </svg>
          日経平均
          <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-sub)', marginLeft: 2 }}>銘柄別寄与度 / 業種別騰落率</span>
        </div>
        {data?.updatedAt && (
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{fmtDateMD(data.updatedAt)}現在</span>
        )}
      </div>

      {/* content */}
      {loading && !data ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spinner />
        </div>
      ) : error && !data ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{error}</span>
          <button onClick={() => load(true)} style={{
            fontSize: 11, padding: '5px 14px', borderRadius: 6, cursor: 'pointer',
            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text)',
          }}>再試行</button>
        </div>
      ) : data ? (
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {isMobile ? (
            /* ── モバイル: 銘柄別寄与度 → 業種別騰落率 を縦積み ── */
            <>
              {/* 銘柄別寄与度 */}
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thL} colSpan={2}>銘柄別寄与度</th>
                    <th style={th}>寄与度</th>
                    <th style={th}>比率</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td colSpan={4} style={sectionTd(upCol, isDark ? 'rgba(96,200,140,0.06)' : 'rgba(22,130,80,0.05)')}>▲ 上昇 TOP5</td></tr>
                  {data.contribution.up.map((raw, i) => {
                    const contrib = raw as StocksItem
                    const total   = data.contribution.total ?? 0
                    const pct     = total !== 0 ? Math.abs(contrib.contribution / total * 100) : null
                    return (
                      <tr key={contrib.code} style={{ background: isDark ? 'rgba(96,200,140,0.08)' : 'rgba(22,130,80,0.05)' }}>
                        <td style={{ ...tdL, color: 'var(--text-dim)', fontSize: 10 }}>{i + 1}</td>
                        <td style={{ ...tdL, maxWidth: 120, overflow: 'hidden' }}>
                          <div style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contrib.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{contrib.code}</div>
                        </td>
                        <td style={{ ...tdR, color: upCol, fontWeight: 700 }}>{fmtContrib(contrib.contribution)}</td>
                        <td style={{ ...tdR, color: 'var(--text-dim)', fontSize: 11 }}>{pct != null ? `${pct.toFixed(1)}%` : '—'}</td>
                      </tr>
                    )
                  })}
                  <tr><td colSpan={4} style={sectionTd(dnCol, isDark ? 'rgba(255,120,100,0.06)' : 'rgba(200,50,30,0.05)')}>▼ 下落 TOP5</td></tr>
                  {data.contribution.down.map((raw, i) => {
                    const contrib = raw as StocksItem
                    const total   = data.contribution.total ?? 0
                    const pct     = total !== 0 ? Math.abs(contrib.contribution / total * 100) : null
                    return (
                      <tr key={contrib.code} style={{ background: isDark ? 'rgba(255,120,100,0.08)' : 'rgba(200,50,30,0.05)' }}>
                        <td style={{ ...tdL, color: 'var(--text-dim)', fontSize: 10 }}>{i + 1}</td>
                        <td style={{ ...tdL, maxWidth: 120, overflow: 'hidden' }}>
                          <div style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contrib.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{contrib.code}</div>
                        </td>
                        <td style={{ ...tdR, color: dnCol, fontWeight: 700 }}>{fmtContrib(contrib.contribution)}</td>
                        <td style={{ ...tdR, color: 'var(--text-dim)', fontSize: 11 }}>{pct != null ? `${pct.toFixed(1)}%` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {/* 業種別騰落率 */}
              <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: '2px solid var(--border-dim)' }}>
                <thead>
                  <tr>
                    <th style={thL}>業種別騰落率（東証33業種）</th>
                    <th style={th}>騰落率</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td colSpan={2} style={sectionTd(upCol, isDark ? 'rgba(96,200,140,0.06)' : 'rgba(22,130,80,0.05)')}>▲ 上昇 TOP5</td></tr>
                  {data.sector.up.map((raw, i) => {
                    const sector = raw as SectorItem
                    return (
                      <tr key={sector.name} style={{ background: isDark ? 'rgba(96,200,140,0.08)' : 'rgba(22,130,80,0.05)' }}>
                        <td style={{ ...tdL, color: 'var(--text-sub)' }}><span style={{ color: 'var(--text-dim)', fontSize: 10, marginRight: 6 }}>{i + 1}</span>{sector.name}</td>
                        <td style={{ ...tdR, color: upCol, fontWeight: 700 }}>{fmtPct(sector.changePct)}</td>
                      </tr>
                    )
                  })}
                  <tr><td colSpan={2} style={sectionTd(dnCol, isDark ? 'rgba(255,120,100,0.06)' : 'rgba(200,50,30,0.05)')}>▼ 下落 TOP5</td></tr>
                  {data.sector.down.map((raw, i) => {
                    const sector = raw as SectorItem
                    return (
                      <tr key={sector.name} style={{ background: isDark ? 'rgba(255,120,100,0.08)' : 'rgba(200,50,30,0.05)' }}>
                        <td style={{ ...tdL, color: 'var(--text-sub)' }}><span style={{ color: 'var(--text-dim)', fontSize: 10, marginRight: 6 }}>{i + 1}</span>{sector.name}</td>
                        <td style={{ ...tdR, color: dnCol, fontWeight: 700 }}>{fmtPct(sector.changePct)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          ) : (
            /* ── デスクトップ: 1テーブル2列（行高さ自動同期） ── */
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <colgroup>
                <col style={{ width: 18 }} />
                <col style={{ width: '30%' }} />
                <col />
                <col />
                <col style={{ width: 1, borderLeft: '1px solid var(--border-dim)' }} />
                <col style={{ width: '25%' }} />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th style={thL} colSpan={2}>銘柄別寄与度</th>
                  <th style={th}>寄与度</th>
                  <th style={th}>比率</th>
                  <th style={{ ...th, padding: 0, width: 1 }} />
                  <th style={thL}>業種別騰落率（東証33業種）</th>
                  <th style={th}>騰落率</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={4} style={sectionTd(upCol, isDark ? 'rgba(96,200,140,0.06)' : 'rgba(22,130,80,0.05)')}>▲ 上昇 TOP5</td>
                  <td style={{ padding: 0, borderLeft: '1px solid var(--border-dim)' }} />
                  <td colSpan={2} style={sectionTd(upCol, isDark ? 'rgba(96,200,140,0.06)' : 'rgba(22,130,80,0.05)')}>▲ 上昇 TOP5</td>
                </tr>
                {data.contribution.up.map((raw, i) => {
                  const contrib = raw as StocksItem
                  const sector  = data.sector.up[i] as SectorItem | undefined
                  const total   = data.contribution.total ?? 0
                  const pct     = total !== 0 ? Math.abs(contrib.contribution / total * 100) : null
                  const rowBg   = isDark ? 'rgba(96,200,140,0.08)' : 'rgba(22,130,80,0.05)'
                  return (
                    <tr key={contrib.code} style={{ background: rowBg }}>
                      <td style={{ ...tdL, color: 'var(--text-dim)', fontSize: 10 }}>{i + 1}</td>
                      <td style={{ ...tdL, maxWidth: 120, overflow: 'hidden' }}>
                        <div style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contrib.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{contrib.code}</div>
                      </td>
                      <td style={{ ...tdR, color: upCol, fontWeight: 700 }}>{fmtContrib(contrib.contribution)}</td>
                      <td style={{ ...tdR, color: 'var(--text-dim)', fontSize: 11 }}>{pct != null ? `${pct.toFixed(1)}%` : '—'}</td>
                      <td style={{ padding: 0, borderLeft: '1px solid var(--border-dim)', borderBottom: '1px solid var(--border-dim)' }} />
                      <td style={{ ...tdL, color: 'var(--text-sub)', verticalAlign: 'middle' }}>{sector?.name ?? '—'}</td>
                      <td style={{ ...tdR, color: upCol, fontWeight: 700, verticalAlign: 'middle' }}>{sector ? fmtPct(sector.changePct) : '—'}</td>
                    </tr>
                  )
                })}
                <tr>
                  <td colSpan={4} style={sectionTd(dnCol, isDark ? 'rgba(255,120,100,0.06)' : 'rgba(200,50,30,0.05)')}>▼ 下落 TOP5</td>
                  <td style={{ padding: 0, borderLeft: '1px solid var(--border-dim)' }} />
                  <td colSpan={2} style={sectionTd(dnCol, isDark ? 'rgba(255,120,100,0.06)' : 'rgba(200,50,30,0.05)')}>▼ 下落 TOP5</td>
                </tr>
                {data.contribution.down.map((raw, i) => {
                  const contrib = raw as StocksItem
                  const sector  = data.sector.down[i] as SectorItem | undefined
                  const total   = data.contribution.total ?? 0
                  const pct     = total !== 0 ? Math.abs(contrib.contribution / total * 100) : null
                  const rowBg   = isDark ? 'rgba(255,120,100,0.08)' : 'rgba(200,50,30,0.05)'
                  return (
                    <tr key={contrib.code} style={{ background: rowBg }}>
                      <td style={{ ...tdL, color: 'var(--text-dim)', fontSize: 10 }}>{i + 1}</td>
                      <td style={{ ...tdL, maxWidth: 120, overflow: 'hidden' }}>
                        <div style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contrib.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{contrib.code}</div>
                      </td>
                      <td style={{ ...tdR, color: dnCol, fontWeight: 700 }}>{fmtContrib(contrib.contribution)}</td>
                      <td style={{ ...tdR, color: 'var(--text-dim)', fontSize: 11 }}>{pct != null ? `${pct.toFixed(1)}%` : '—'}</td>
                      <td style={{ padding: 0, borderLeft: '1px solid var(--border-dim)', borderBottom: '1px solid var(--border-dim)' }} />
                      <td style={{ ...tdL, color: 'var(--text-sub)', verticalAlign: 'middle' }}>{sector?.name ?? '—'}</td>
                      <td style={{ ...tdR, color: dnCol, fontWeight: 700, verticalAlign: 'middle' }}>{sector ? fmtPct(sector.changePct) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </div>
  )
}
