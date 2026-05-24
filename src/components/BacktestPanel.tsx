import { useEffect, useState } from 'react'
import { fetchBacktestResult, type BacktestResult, type WeeklyEntry } from '../utils/backtestData'

type Props = {
  theme: 'dark' | 'light'
  isMobile: boolean
  onClose: () => void
}

const STATUS_ORDER = ['慣性航行中', '重力反転中', '真空落下', '限界膨張']

function pctStr(v: number | null) {
  if (v == null) return '—'
  return Math.round(v * 100) + '%'
}

function winColor(rate: number | null, theme: 'dark' | 'light') {
  if (rate == null) return 'var(--text-dim)'
  const pct = rate * 100
  if (pct >= 60) return theme === 'dark' ? '#4ade80' : '#16a34a'
  if (pct <= 40) return theme === 'dark' ? '#f87171' : '#dc2626'
  return 'var(--text)'
}

export function BacktestPanel({ theme, isMobile, onClose }: Props) {
  const [data, setData] = useState<BacktestResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [showLog, setShowLog] = useState(false)

  useEffect(() => {
    fetchBacktestResult().then(r => { setData(r); setLoading(false) })
  }, [])

  const s = styles(theme, isMobile)

  return (
    <div style={s.root}>
      {/* ヘッダー */}
      <div style={s.header}>
        <button onClick={onClose} style={s.backBtn} aria-label="戻る">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span style={s.headerTitle}>TEV バックテスト</span>
      </div>

      <div style={s.body}>
        {loading && (
          <div style={s.center}><span style={s.spinner} /></div>
        )}

        {!loading && !data && (
          <div style={s.center}>
            <div style={s.emptyBox}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>データ未生成</div>
              <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6 }}>
                <code style={s.code}>npm run backtest</code> を実行するとデータが生成されます。
              </div>
            </div>
          </div>
        )}

        {!loading && data && (() => {
          const { summary, weekly_log, notes, computed_at, data_range } = data

          return (
            <>
              {/* メタ情報 */}
              <div style={s.meta}>
                <span>{data_range.from} 〜 {data_range.to}（{summary.total_weeks}週）</span>
                <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>
                  {new Date(computed_at).toLocaleDateString('ja-JP')} 算出
                </span>
              </div>

              {/* サマリーカード */}
              <div style={s.cardGrid}>
                <SummaryCard label="全体勝率" value={pctStr(summary.overall_win_rate)} color={winColor(summary.overall_win_rate, theme)} sub={`${summary.signal_weeks}週シグナル`} />
                <SummaryCard label="Bull勝率" value={pctStr(summary.bull_win_rate)} color={winColor(summary.bull_win_rate, theme)} sub={`${summary.bull_signals}回`} />
                <SummaryCard label="Bear勝率" value={pctStr(summary.bear_win_rate)} color={winColor(summary.bear_win_rate, theme)} sub={`${summary.bear_signals}回`} />
                <SummaryCard label="中立回避" value={summary.neutral_signals + '週'} color="var(--text-sub)" sub="シグナルなし" />
              </div>

              {/* 信頼度別 */}
              <Section title="信頼度別">
                <table style={s.table}>
                  <thead><tr>
                    <Th>区分</Th><Th align="right">回数</Th><Th align="right">勝率</Th>
                  </tr></thead>
                  <tbody>
                    {(['high', 'mid'] as const).map(k => {
                      const b = summary.by_confidence[k]
                      return (
                        <tr key={k}>
                          <Td>{b.label}</Td>
                          <Td align="right">{b.n}回</Td>
                          <Td align="right" color={winColor(b.win_rate, theme)}>{pctStr(b.win_rate)}</Td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </Section>

              {/* ステータス別 */}
              <Section title="ステータス別">
                <table style={s.table}>
                  <thead><tr>
                    <Th>ステータス</Th><Th align="right">回数</Th><Th align="right">勝率</Th>
                  </tr></thead>
                  <tbody>
                    {STATUS_ORDER
                      .filter(k => summary.by_status[k])
                      .map(k => {
                        const b = summary.by_status[k]
                        return (
                          <tr key={k}>
                            <Td>{k}</Td>
                            <Td align="right">{b.n}回</Td>
                            <Td align="right" color={winColor(b.win_rate, theme)}>{pctStr(b.win_rate)}</Td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </Section>

              {/* 注釈 */}
              <Section title="モデル注記">
                <ul style={s.noteList}>
                  {notes.map((n, i) => <li key={i} style={s.noteItem}>{n}</li>)}
                </ul>
              </Section>

              {/* 週次ログ（折りたたみ） */}
              <Section title="">
                <button onClick={() => setShowLog(v => !v)} style={s.toggleBtn}>
                  {showLog ? '▲ 週次ログを閉じる' : '▼ 週次ログを表示'}
                </button>
                {showLog && (
                  <div style={s.logWrap}>
                    <table style={{ ...s.table, fontSize: 11 }}>
                      <thead><tr>
                        <Th>週</Th>
                        <Th align="right">TEV</Th>
                        <Th>ステータス</Th>
                        <Th align="right">信頼度</Th>
                        <Th>シグナル</Th>
                        <Th align="right">日経騰落</Th>
                        <Th align="center">勝敗</Th>
                      </tr></thead>
                      <tbody>
                        {weekly_log.map((w: WeeklyEntry) => (
                          <tr key={w.week}>
                            <Td>{w.week}</Td>
                            <Td align="right">{w.tev ?? '—'}</Td>
                            <Td>{w.status ?? '—'}</Td>
                            <Td align="right">{w.confidence != null ? w.confidence + '%' : '—'}</Td>
                            <Td color={w.signal === 'bull' ? (theme === 'dark' ? '#4ade80' : '#16a34a') : w.signal === 'bear' ? (theme === 'dark' ? '#f87171' : '#dc2626') : 'var(--text-sub)'}>
                              {w.signal}
                            </Td>
                            <Td align="right" color={w.price_change_pct != null ? (w.price_change_pct > 0 ? (theme === 'dark' ? '#4ade80' : '#16a34a') : w.price_change_pct < 0 ? (theme === 'dark' ? '#f87171' : '#dc2626') : 'var(--text)') : 'var(--text-dim)'}>
                              {w.price_change_pct != null ? (w.price_change_pct > 0 ? '+' : '') + w.price_change_pct + '%' : '—'}
                            </Td>
                            <Td align="center" color={w.win === null ? 'var(--text-dim)' : w.win ? (theme === 'dark' ? '#4ade80' : '#16a34a') : (theme === 'dark' ? '#f87171' : '#dc2626')}>
                              {w.win === null ? '—' : w.win ? '○' : '✗'}
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>
            </>
          )
        })()}
      </div>
    </div>
  )
}

// ── 小コンポーネント ─────────────────────────────────────

function SummaryCard({ label, value, color, sub }: { label: string; value: string; color: string; sub: string }) {
  return (
    <div style={{
      background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
      borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-sub)' }}>{sub}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      {title && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>{title}</div>}
      {children}
    </div>
  )
}

function Th({ children, align }: { children?: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
  return (
    <th style={{ padding: '6px 10px', textAlign: align ?? 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', borderBottom: '1px solid var(--glass-border)', whiteSpace: 'nowrap' }}>
      {children}
    </th>
  )
}

function Td({ children, align, color }: { children?: React.ReactNode; align?: 'left' | 'right' | 'center'; color?: string }) {
  return (
    <td style={{ padding: '7px 10px', textAlign: align ?? 'left', color: color ?? 'var(--text)', borderBottom: '1px solid var(--glass-border)', whiteSpace: 'nowrap' }}>
      {children}
    </td>
  )
}

// ── スタイル ─────────────────────────────────────────────

function styles(theme: 'dark' | 'light', isMobile: boolean) {
  return {
    root: {
      display: 'flex', flexDirection: 'column' as const,
      height: '100%', background: 'var(--bg)', color: 'var(--text)',
      fontFamily: 'var(--font-sans, system-ui, sans-serif)',
    },
    header: {
      display: 'flex', alignItems: 'center', gap: 12,
      padding: isMobile ? '14px 16px' : '16px 24px',
      borderBottom: '1px solid var(--glass-border)',
      flexShrink: 0,
    },
    headerTitle: {
      fontSize: 16, fontWeight: 700, color: 'var(--text)',
    },
    backBtn: {
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: 34, height: 34, borderRadius: 8, border: 'none',
      background: 'var(--glass-bg)', cursor: 'pointer', color: 'var(--text)',
      flexShrink: 0,
    },
    body: {
      flex: 1, overflowY: 'auto' as const,
      padding: isMobile ? '16px' : '20px 24px',
      display: 'flex', flexDirection: 'column' as const, gap: 0,
    },
    meta: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      fontSize: 12, color: 'var(--text-sub)', marginBottom: 16, flexWrap: 'wrap' as const, gap: 4,
    },
    cardGrid: {
      display: 'grid',
      gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
      gap: 10, marginBottom: 24,
    },
    table: {
      width: '100%', borderCollapse: 'collapse' as const,
      background: 'var(--glass-bg)', borderRadius: 10,
      overflow: 'hidden', border: '1px solid var(--glass-border)',
    },
    noteList: {
      margin: 0, paddingLeft: 18,
      background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
      borderRadius: 10, padding: '12px 16px 12px 28px',
    },
    noteItem: {
      fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.7,
    },
    toggleBtn: {
      background: 'none', border: '1px solid var(--glass-border)',
      borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
      fontSize: 12, color: 'var(--text-sub)', marginBottom: 10,
    },
    logWrap: {
      overflowX: 'auto' as const,
    },
    center: {
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300,
    },
    emptyBox: {
      textAlign: 'center' as const, padding: 32,
      background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
      borderRadius: 16, maxWidth: 320,
    },
    code: {
      background: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace', fontSize: 12,
    },
    spinner: {
      display: 'inline-block', width: 28, height: 28,
      border: '3px solid var(--glass-border)',
      borderTopColor: 'var(--text-sub)',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    },
  }
}
