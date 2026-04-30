import type { UsdjpyDayData } from '../utils/usdjpyData'

type Props = {
  theme: 'dark' | 'light'
  isMobile: boolean
  usdjpyData: UsdjpyDayData[]
  usdjpyLoading: boolean
  usdjpyError: string
  onUsdjpyReload: () => void
}

function fxColor(val: number | null, theme: 'dark' | 'light'): string {
  if (val == null || val === 0) return 'var(--text-dim)'
  if (val > 0) return theme === 'dark' ? 'rgba(255,120,100,0.95)' : 'rgba(200,50,30,0.95)'
  return theme === 'dark' ? 'rgba(96,200,140,0.95)' : 'rgba(22,130,80,0.95)'
}

function fxBg(val: number | null, theme: 'dark' | 'light'): string {
  if (val == null || val === 0) return 'transparent'
  if (val > 0) return theme === 'dark' ? 'rgba(255,120,100,0.10)' : 'rgba(200,50,30,0.07)'
  return theme === 'dark' ? 'rgba(96,200,140,0.10)' : 'rgba(22,130,80,0.07)'
}

export function MarketDailyPanel({
  theme, isMobile,
  usdjpyData, usdjpyLoading, usdjpyError, onUsdjpyReload,
}: Props) {
  const rows = [...usdjpyData].reverse()

  const th: React.CSSProperties = {
    position: 'sticky', top: 0, zIndex: 2,
    padding: isMobile ? '6px 5px' : '9px 14px',
    background: 'var(--modal-bg)', backdropFilter: 'blur(16px)',
    borderBottom: '2px solid var(--border-dim)',
    fontSize: isMobile ? 10 : 11, fontWeight: 700, color: 'var(--text)',
    whiteSpace: 'nowrap' as const, textAlign: 'right' as const,
  }
  const thL: React.CSSProperties = { ...th, textAlign: 'left' as const, width: isMobile ? 60 : 74, minWidth: isMobile ? 60 : 74 }
  const td: React.CSSProperties = {
    padding: isMobile ? '5px 5px' : '7px 14px',
    borderBottom: '1px solid var(--border-dim)',
    fontSize: isMobile ? 11 : 12, textAlign: 'right' as const,
    fontVariantNumeric: 'tabular-nums' as const, whiteSpace: 'nowrap' as const,
  }
  const tdL: React.CSSProperties = { ...td, textAlign: 'left' as const, color: 'var(--text)' }

  const tblWrap = isMobile
    ? { overflowX: 'hidden' as const, overflowY: 'visible' as const }
    : { flex: 1, overflowY: 'auto' as const, overflowX: 'auto' as const, padding: '0 0 8px' }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

      {/* ── ヘッダー ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 14px', flexShrink: 0, borderBottom: '1px solid var(--border-dim)',
        userSelect: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text)', minWidth: 0, overflow: 'hidden' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
          USD / JPY
          <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-sub)', marginLeft: 2 }}>日次（平日）</span>
        </div>
        <button
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
            color: 'var(--text-sub)', background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)', cursor: 'pointer',
          }}
          onClick={onUsdjpyReload}
          disabled={usdjpyLoading}
          title="再取得"
        >
          <svg
            width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
            style={{ transform: usdjpyLoading ? 'rotate(360deg)' : undefined, transition: usdjpyLoading ? 'transform 1s linear infinite' : undefined }}
          >
            <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          {usdjpyLoading ? '取得中…' : '更新'}
        </button>
      </div>

      {/* ── テーブル ── */}
      <div style={tblWrap}>
        {usdjpyLoading && usdjpyData.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, flex: 1, padding: 32 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid var(--glass-border)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ color: 'var(--text-sub)', fontSize: 13 }}>取得中…</span>
          </div>
        ) : usdjpyError && usdjpyData.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, flex: 1, padding: 32 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,100,80,0.7)" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span style={{ color: 'var(--text-sub)', fontSize: 12, textAlign: 'center', maxWidth: 220 }}>{usdjpyError}</span>
            <button style={{ padding: '5px 14px', borderRadius: 7, fontSize: 11, fontWeight: 600, background: 'var(--accent-glass)', border: '1px solid var(--accent)', color: '#fff', cursor: 'pointer' }} onClick={onUsdjpyReload}>再試行</button>
          </div>
        ) : rows.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
            <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>データなし</span>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thL}>日付</th>
                <th style={th}>終値</th>
                <th style={th}>前日比<br /><span style={{ fontWeight: 400, color: 'var(--text-dim)', fontSize: 9 }}>円</span></th>
                <th style={th}>前日比<br /><span style={{ fontWeight: 400, color: 'var(--text-dim)', fontSize: 9 }}>%</span></th>
                <th style={th}>MA5<br /><span style={{ fontWeight: 400, color: 'var(--text-dim)', fontSize: 9 }}>乖離%</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.time} style={{ background: i === 0 ? 'var(--latest-row-bg)' : 'transparent', transition: 'background 0.1s' }}>
                  <td style={tdL}>{row.time}</td>
                  <td style={{ ...td, color: 'var(--text)', fontWeight: i === 0 ? 700 : 400 }}>
                    {row.close.toFixed(2)}
                  </td>
                  <td style={{ ...td, background: fxBg(row.change, theme), color: fxColor(row.change, theme), fontWeight: row.change != null && row.change !== 0 ? 600 : 400 }}>
                    {row.change != null ? (row.change > 0 ? '+' : '') + row.change.toFixed(2) : '—'}
                  </td>
                  <td style={{ ...td, color: fxColor(row.changePct, theme) }}>
                    {row.changePct != null ? (row.changePct > 0 ? '+' : '') + row.changePct.toFixed(2) + '%' : '—'}
                  </td>
                  <td style={{ ...td, color: fxColor(row.ma5dev, theme) }}>
                    {row.ma5dev != null ? (row.ma5dev > 0 ? '+' : '') + row.ma5dev.toFixed(2) + '%' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  )
}
