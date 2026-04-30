import type { ArbitrageDayData } from '../utils/arbitrageData'
import type { UsdjpyDayData } from '../utils/usdjpyData'

type Props = {
  theme: 'dark' | 'light'
  isMobile: boolean
  arbDailyData: ArbitrageDayData[]
  arbDailyLoading: boolean
  arbDailyError: string
  onArbDailyReload: () => void
  usdjpyData: UsdjpyDayData[]
  usdjpyLoading: boolean
  usdjpyError: string
  onUsdjpyReload: () => void
}

function fmtBal(val: number): string {
  return Math.round(val).toLocaleString()
}

function fmtDelta(val: number | null): string {
  if (val == null) return '—'
  const sign = val > 0 ? '+' : ''
  return `${sign}${Math.round(val).toLocaleString()}`
}

function deltaColor(val: number | null, theme: 'dark' | 'light'): string {
  if (val == null || val === 0) return 'var(--text-dim)'
  if (val > 0) return theme === 'dark' ? 'rgba(255,120,100,0.95)' : 'rgba(200,50,30,0.95)'
  return theme === 'dark' ? 'rgba(96,200,140,0.95)' : 'rgba(22,130,80,0.95)'
}

function fxColor(val: number | null, theme: 'dark' | 'light'): string {
  if (val == null || val === 0) return 'var(--text)'
  if (val > 0) return theme === 'dark' ? 'rgba(96,200,140,0.95)' : 'rgba(22,130,80,0.95)'
  return theme === 'dark' ? 'rgba(255,120,100,0.95)' : 'rgba(200,50,30,0.95)'
}

export function MarketDailyPanel({
  theme, isMobile,
  arbDailyData, arbDailyLoading, arbDailyError, onArbDailyReload,
  usdjpyData, usdjpyLoading, usdjpyError, onUsdjpyReload,
}: Props) {
  const isDark  = theme === 'dark'
  const latestFx = usdjpyData.length > 0 ? usdjpyData[usdjpyData.length - 1] : null

  const cardBg    = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
  const cardBdr   = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const tblWrap   = isMobile
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
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          需給指標+
          <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-sub)', marginLeft: 2 }}>裁定残高（週次）・ドル円（日次）</span>
        </div>
        <button
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
            color: 'var(--text-sub)', background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)', cursor: 'pointer',
          }}
          onClick={() => { onArbDailyReload(); onUsdjpyReload() }}
          disabled={arbDailyLoading || usdjpyLoading}
          title="再取得"
        >
          <svg
            width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
            style={{
              transform: (arbDailyLoading || usdjpyLoading) ? 'rotate(360deg)' : undefined,
              transition: (arbDailyLoading || usdjpyLoading) ? 'transform 1s linear infinite' : undefined,
            }}
          >
            <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          {(arbDailyLoading || usdjpyLoading) ? '取得中…' : '更新'}
        </button>
      </div>

      {/* ── ドル円サマリー ── */}
      <div style={{ padding: '8px 10px', flexShrink: 0, borderBottom: '1px solid var(--border-dim)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
          USD / JPY
        </div>
        {usdjpyLoading && usdjpyData.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>取得中…</div>
        ) : usdjpyError && usdjpyData.length === 0 ? (
          <div style={{ fontSize: 11, color: 'rgba(255,100,80,0.7)', lineHeight: 1.4 }}>{usdjpyError}</div>
        ) : latestFx ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ flex: 1, background: cardBg, border: `1px solid ${cardBdr}`, borderRadius: 10, padding: '7px 10px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 3 }}>終値</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                {latestFx.close.toFixed(2)}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>{latestFx.time}</div>
            </div>
            <div style={{ flex: 1, background: cardBg, border: `1px solid ${cardBdr}`, borderRadius: 10, padding: '7px 10px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 3 }}>前日比</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: fxColor(latestFx.change, theme), fontVariantNumeric: 'tabular-nums' }}>
                {latestFx.change != null ? (latestFx.change > 0 ? '+' : '') + latestFx.change.toFixed(2) : '—'}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>
                {latestFx.changePct != null ? (latestFx.changePct > 0 ? '+' : '') + latestFx.changePct.toFixed(2) + '%' : ''}
              </div>
            </div>
            <div style={{ flex: 1, background: cardBg, border: `1px solid ${cardBdr}`, borderRadius: 10, padding: '7px 10px' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 3 }}>MA5乖離</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: fxColor(latestFx.ma5dev, theme), fontVariantNumeric: 'tabular-nums' }}>
                {latestFx.ma5dev != null ? (latestFx.ma5dev > 0 ? '+' : '') + latestFx.ma5dev.toFixed(2) + '%' : '—'}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>
                {latestFx.ma5 != null ? `MA5: ${latestFx.ma5.toFixed(2)}` : ''}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>データなし</div>
        )}
      </div>

      {/* ── 裁定日次テーブル ── */}
      <div style={{ flexShrink: 0, padding: '6px 14px 4px', borderBottom: '1px solid var(--border-dim)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          裁定買い残（週次）
        </div>
      </div>

      <div style={tblWrap}>
        {arbDailyLoading && arbDailyData.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <span style={{ color: 'var(--text-sub)', fontSize: 13 }}>取得中…</span>
          </div>
        ) : arbDailyError && arbDailyData.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 }}>
            <span style={{ color: 'var(--text-sub)', fontSize: 12, textAlign: 'center' }}>{arbDailyError}</span>
            <button style={{ padding: '5px 14px', borderRadius: 7, fontSize: 11, fontWeight: 600, background: 'var(--accent-glass)', border: '1px solid var(--accent)', color: '#fff', cursor: 'pointer' }} onClick={onArbDailyReload}>再試行</button>
          </div>
        ) : arbDailyData.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>データなし</span>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 160 }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', top: 0, zIndex: 2, padding: '6px 10px', textAlign: 'left', background: 'var(--modal-bg)', backdropFilter: 'blur(16px)', borderBottom: '2px solid var(--border-dim)', fontSize: 10, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                  日付
                </th>
                <th style={{ position: 'sticky', top: 0, zIndex: 2, padding: '6px 10px', textAlign: 'right', background: 'var(--modal-bg)', backdropFilter: 'blur(16px)', borderBottom: '2px solid var(--border-dim)', fontSize: 10, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                  買い残<br /><span style={{ fontWeight: 400, color: 'var(--text-dim)' }}>百万円</span>
                </th>
                <th style={{ position: 'sticky', top: 0, zIndex: 2, padding: '6px 10px', textAlign: 'right', background: 'var(--modal-bg)', backdropFilter: 'blur(16px)', borderBottom: '2px solid var(--border-dim)', fontSize: 10, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                  前日比<br /><span style={{ fontWeight: 400, color: 'var(--text-dim)' }}>百万円</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {arbDailyData.map((row, i) => (
                <tr key={row.date} style={{ background: i === 0 ? 'var(--latest-row-bg)' : 'transparent', transition: 'background 0.1s' }}>
                  <td style={{ padding: '5px 10px', borderBottom: '1px solid var(--border-dim)', fontSize: 11, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: 'var(--text)' }}>
                    {row.date}
                  </td>
                  <td style={{ padding: '5px 10px', borderBottom: '1px solid var(--border-dim)', fontSize: 11, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>
                    {fmtBal(row.longBal)}
                  </td>
                  <td style={{ padding: '5px 10px', borderBottom: '1px solid var(--border-dim)', fontSize: 11, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: deltaColor(row.longBalDelta, theme), fontWeight: row.longBalDelta != null && row.longBalDelta !== 0 ? 600 : 400 }}>
                    {fmtDelta(row.longBalDelta)}
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
