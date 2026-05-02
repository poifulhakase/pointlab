import { useState } from 'react'
import type React from 'react'
import type { FuturesParticipantDayData } from '../utils/futuresParticipantsData'

const MOBILE_ROW_LIMIT = 10

interface OiRow {
  date:       string
  label:      string
  totalNets:  number
  delta:      number | null
}

function computeRows(data: FuturesParticipantDayData[], n = 60): OiRow[] {
  if (data.length === 0) return []
  const source = [...data].reverse()
  const rows: OiRow[] = []
  for (const d of source) {
    const total = (d.foreign ?? 0) + (d.trustBank ?? 0) + (d.lifeIns ?? 0) +
                  (d.invTrust ?? 0) + (d.individual ?? 0) + (d.securities ?? 0)
    const prev = rows.length > 0 ? rows[rows.length - 1] : null
    rows.push({ date: d.date, label: d.label, totalNets: total, delta: prev ? total - prev.totalNets : null })
  }
  return rows.slice(-n).reverse()
}

function netColor(val: number, theme: 'dark' | 'light'): string {
  if (val > 0)  return theme === 'dark' ? 'rgba(96,200,140,0.95)'  : 'rgba(22,130,80,0.95)'
  if (val < 0)  return theme === 'dark' ? 'rgba(255,120,100,0.95)' : 'rgba(200,50,30,0.95)'
  return 'var(--text-dim)'
}

function netBg(val: number, theme: 'dark' | 'light'): string {
  if (val > 0)  return theme === 'dark' ? 'rgba(96,200,140,0.12)'  : 'rgba(22,130,80,0.08)'
  if (val < 0)  return theme === 'dark' ? 'rgba(255,120,100,0.12)' : 'rgba(200,50,30,0.08)'
  return 'transparent'
}

export function FuturesOiPanel({
  data,
  loading,
  error,
  onReload,
  theme,
  isMobile = false,
}: {
  data:      FuturesParticipantDayData[]
  loading:   boolean
  error:     string
  onReload:  () => void
  theme:     'dark' | 'light'
  isMobile?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const allRows = computeRows(data)
  const rows = isMobile && !expanded ? allRows.slice(0, MOBILE_ROW_LIMIT) : allRows

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      {/* header */}
      <div style={s.head}>
        <div style={s.title}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6"  y1="20" x2="6"  y2="14"/>
          </svg>
          先物OI
          <span style={s.sub}>証券会社別ネット枚数（日次・JPX）</span>
        </div>
        <div style={s.right}>
          {data.length > 0 && <span style={s.dateLabel}>最新: {data[0].date}</span>}
        </div>
      </div>

      {/* body */}
      {loading && data.length === 0 ? (
        <div style={s.center}>
          <div style={s.spinner} />
          <span style={{ color: 'var(--text-sub)', fontSize: 13 }}>取得中…</span>
        </div>
      ) : error && data.length === 0 ? (
        <div style={s.center}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,100,80,0.7)" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span style={{ color: 'var(--text-sub)', fontSize: 12, maxWidth: 260, textAlign: 'center' }}>{error}</span>
          <button style={s.retryBtn} onClick={onReload}>再試行</button>
        </div>
      ) : rows.length === 0 ? (
        <div style={s.center}>
          <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>データなし</span>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={{ ...s.th, ...s.thDate }}>日付</th>
                <th style={s.th}><div style={s.thLabel}>全体建玉残高</div><div style={s.thSub}>ネット枚数合計</div></th>
                <th style={s.th}><div style={s.thLabel}>建玉増減</div><div style={s.thSub}>前日比（枚）</div></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.date} style={{ ...s.tr, background: i === 0 ? 'var(--latest-row-bg)' : 'transparent' }}>
                  <td style={{ ...s.td, ...s.tdDate }}>
                    <div style={s.dateMain}>{row.label}</div>
                    <div style={s.dateSub}>{row.date}</div>
                  </td>
                  <td style={{ ...s.td, ...s.tdNum, background: netBg(row.totalNets, theme) }}>
                    <span style={{ color: netColor(row.totalNets, theme), fontWeight: 700, fontSize: 13 }}>
                      {row.totalNets > 0 ? '+' : ''}{row.totalNets.toLocaleString()}
                    </span>
                    <span style={s.unit}>枚</span>
                  </td>
                  <td style={{ ...s.td, ...s.tdNum }}>
                    {row.delta != null ? (
                      <span style={{ color: netColor(row.delta, theme), fontWeight: 600, fontSize: 12 }}>
                        {row.delta > 0 ? '↑' : row.delta < 0 ? '↓' : '→'}{' '}
                        {row.delta > 0 ? '+' : ''}{row.delta.toLocaleString()}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-dim)' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {isMobile && allRows.length > MOBILE_ROW_LIMIT && (
            <button style={s.expandBtn} onClick={() => setExpanded(v => !v)}>
              {expanded ? '▲ 折りたたむ' : `▼ 全${allRows.length}日を表示`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  head:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', flexShrink: 0, gap: 8, borderBottom: '1px solid var(--border-dim)', userSelect: 'none' },
  title:     { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', minWidth: 0 },
  sub:       { fontSize: 10, fontWeight: 400, color: 'var(--text-sub)', marginLeft: 2, overflow: 'hidden', textOverflow: 'ellipsis' },
  right:     { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  dateLabel: { fontSize: 10, color: 'var(--text-dim)' },
  reloadBtn: { display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, color: 'var(--text-sub)', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', cursor: 'pointer' },
  center:    { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 },
  spinner:   { width: 28, height: 28, borderRadius: '50%', border: '3px solid var(--glass-border)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' },
  retryBtn:  { padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--accent-glass)', border: '1px solid var(--accent)', color: '#fff', cursor: 'pointer' },
  table:     { width: '100%', borderCollapse: 'collapse', minWidth: 220 },
  th:        { position: 'sticky', top: 0, zIndex: 2, padding: '9px 14px', textAlign: 'right', background: 'var(--modal-bg)', backdropFilter: 'blur(16px)', borderBottom: '2px solid var(--border-dim)', fontSize: 11, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' },
  thDate:    { textAlign: 'left', width: 80, minWidth: 80 },
  thLabel:   { fontSize: 11, fontWeight: 700 },
  thSub:     { fontSize: 10, fontWeight: 400, color: 'var(--text-dim)', marginTop: 1 },
  tr:        { transition: 'background 0.1s' },
  td:        { padding: '7px 14px', borderBottom: '1px solid var(--border-dim)', fontSize: 12 },
  tdDate:    { width: 80, minWidth: 80 },
  tdNum:     { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
  dateMain:  { fontSize: 11, fontWeight: 600, color: 'var(--text)' },
  dateSub:   { fontSize: 10, color: 'var(--text-dim)', marginTop: 2 },
  unit:      { fontSize: 10, color: 'var(--text-dim)', marginLeft: 3 },
  expandBtn: { display: 'block', width: '100%', padding: '9px 14px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-sub)', background: 'var(--glass-bg)', border: 'none', borderTop: '1px solid var(--border-dim)', cursor: 'pointer', letterSpacing: '0.03em' },
}
