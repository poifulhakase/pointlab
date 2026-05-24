import { useEffect, useState } from 'react'
import { fetchBacktestResult, type BacktestResult, type WeeklyEntry } from '../utils/backtestData'

type Props = {
  theme: 'dark' | 'light'
  isMobile: boolean
  onClose: () => void
}

const STATUS_ORDER = ['慣性航行中', '重力反転中', '真空落下', '限界膨張']
const mono = "'Courier New', Courier, monospace" as const

export function BacktestPanel({ theme, isMobile, onClose }: Props) {
  const [data, setData]       = useState<BacktestResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [showLog, setShowLog] = useState(false)

  useEffect(() => {
    fetchBacktestResult().then(r => { setData(r); setLoading(false) })
  }, [])

  const L = theme === 'light'
  const c = {
    L,
    BG:     L ? 'rgba(218,236,255,0.92)' : 'rgba(3,10,24,0.92)',
    HDRBG:  L ? 'rgba(228,242,255,0.97)' : 'rgba(3,9,22,0.97)',
    ACCENT: L ? '#0369a1'                : '#00e5ff',
    DIM:    L ? 'rgba(3,105,161,0.62)'   : 'rgba(0,229,255,0.52)',
    TEXT:   L ? 'rgba(8,28,75,0.90)'     : 'rgba(220,240,255,0.90)',
    SUB:    L ? 'rgba(30,65,135,0.62)'   : 'rgba(140,188,228,0.68)',
    RULE:   L ? 'rgba(3,105,161,0.12)'   : 'rgba(0,200,255,0.10)',
    TAGBG:  L ? 'rgba(3,105,161,0.07)'   : 'rgba(0,200,255,0.06)',
    TAGBDR: L ? 'rgba(3,105,161,0.26)'   : 'rgba(0,200,255,0.22)',
    SCAN:   L ? ''                       : 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,229,255,0.013) 3px,rgba(0,229,255,0.013) 4px)',
    GLOW:   L ? 'none'                   : '0 0 14px rgba(0,229,255,0.55)',
    WIN:    L ? '#15803d'                : '#4ade80',
    LOSS:   L ? '#dc2626'                : '#f87171',
    NEUT:   L ? 'rgba(30,65,135,0.45)'   : 'rgba(140,188,228,0.45)',
  }

  const pctStr   = (v: number | null) => v == null ? '—' : Math.round(v * 100) + '%'
  const winColor = (rate: number | null) => {
    if (rate == null) return c.SUB
    return rate >= 0.5 ? c.WIN : rate <= 0.35 ? c.LOSS : c.TEXT
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 30,
      overflow: 'hidden',
      background: c.BG,
      backgroundImage: c.SCAN,
      backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
    }}>
      <style>{`@keyframes btSweep { from { transform:translateY(-100%); } to { transform:translateY(250%); } }`}</style>

      {/* Scan sweep (dark only) */}
      {!L && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', left: 0, right: 0, height: '26%',
            background: 'linear-gradient(to bottom,transparent 0%,rgba(0,229,255,0.024) 50%,transparent 100%)',
            animation: 'btSweep 11s linear infinite',
          }} />
        </div>
      )}

      {/* Scroll container */}
      <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', zIndex: 1 }}>

        {/* ── Sticky header ── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 5,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: isMobile ? '11px 16px' : '12px 28px',
          background: c.HDRBG,
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${c.RULE}`,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.ACCENT, boxShadow: L ? 'none' : `0 0 7px ${c.ACCENT}`, flexShrink: 0 }} />
          <span style={{
            flex: 1, fontSize: 10, fontWeight: 700, letterSpacing: '0.22em',
            color: c.DIM, fontFamily: mono, whiteSpace: 'nowrap',
            textShadow: L ? 'none' : '0 0 10px rgba(0,229,255,0.28)',
          }}>
            POIROBO_OS ▸ TEV_BACKTEST
          </span>
          <span style={{ fontSize: 9, color: c.SUB, fontFamily: mono, flexShrink: 0, letterSpacing: '0.06em' }}>BETA</span>
          <button
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 7,
              border: L ? '1px solid rgba(0,100,180,0.25)' : '1px solid rgba(0,200,255,0.2)',
              background: L ? 'rgba(0,100,180,0.08)' : 'rgba(0,200,255,0.06)',
              color: L ? 'rgba(0,80,160,0.70)' : 'rgba(0,200,255,0.65)',
              cursor: 'pointer', flexShrink: 0,
            }}
            aria-label="閉じる"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{
          maxWidth: isMobile ? '100%' : 680,
          margin: '0 auto',
          padding: isMobile ? '20px 20px 80px' : '28px 40px 100px',
          display: 'flex', flexDirection: 'column', gap: isMobile ? 28 : 36,
        }}>

          {/* Loading */}
          {loading && (
            <div style={{ paddingTop: 60, display: 'flex', justifyContent: 'center' }}>
              <span style={{ fontFamily: mono, fontSize: 11, color: c.DIM, letterSpacing: '0.18em' }}>LOADING...</span>
            </div>
          )}

          {/* No data */}
          {!loading && !data && (
            <div style={{ paddingTop: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ fontSize: 32 }}>📊</div>
              <p style={{ fontSize: 13, color: c.SUB, lineHeight: 1.8, textAlign: 'center', maxWidth: 300 }}>
                ターミナルで <code style={{ fontFamily: mono, fontSize: 12, color: c.ACCENT }}>npm run backtest</code> を実行するとデータが生成されます。
              </p>
            </div>
          )}

          {/* Data */}
          {!loading && data && (() => {
            const { summary, weekly_log, notes, computed_at, data_range } = data
            return (
              <>
                {/* メタ */}
                <div style={{ fontSize: isMobile ? 10 : 11, color: c.DIM, fontFamily: mono, letterSpacing: '0.10em' }}>
                  {data_range.from} ▸ {data_range.to}&nbsp;&nbsp;{summary.total_weeks} WEEKS&nbsp;&nbsp;|&nbsp;&nbsp;{new Date(computed_at).toLocaleDateString('ja-JP')} 算出
                </div>

                {/* ── サマリーカード ── */}
                <div>
                  <SectionLabel label="サマリー" c={c} />
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 10 }}>
                    {[
                      { label: 'OVERALL', val: summary.overall_win_rate, sub: `${summary.signal_weeks}週シグナル` },
                      { label: 'BULL',    val: summary.bull_win_rate,    sub: `${summary.bull_signals}回` },
                      { label: 'BEAR',    val: summary.bear_win_rate,    sub: `${summary.bear_signals}回` },
                      { label: 'NEUTRAL', val: null,                     sub: '回避', extra: String(summary.neutral_signals) + '週' },
                    ].map(item => (
                      <div key={item.label} style={{
                        padding: isMobile ? '14px 14px' : '16px 18px',
                        border: `1px solid ${c.TAGBDR}`,
                        background: c.TAGBG,
                        display: 'flex', flexDirection: 'column', gap: 5,
                      }}>
                        <div style={{ fontSize: 9, fontWeight: 800, color: item.label === 'NEUTRAL' ? c.DIM : c.ACCENT, letterSpacing: '0.22em', fontFamily: mono }}>{item.label}</div>
                        <div style={{
                          fontSize: isMobile ? 26 : 30, fontWeight: 900, lineHeight: 1,
                          color: item.extra ? c.SUB : winColor(item.val),
                          fontFamily: mono,
                          textShadow: (!item.extra && item.val != null && item.val >= 0.5 && !L) ? `0 0 16px ${c.WIN}70` : 'none',
                        }}>
                          {item.extra ?? pctStr(item.val)}
                        </div>
                        <div style={{ fontSize: 10, color: c.SUB }}>{item.sub}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── ステータス別 ── */}
                <div>
                  <SectionLabel label="ステータス別" c={c} />
                  <CyberTable
                    head={['ステータス', '回数', '勝率']}
                    aligns={['left', 'right', 'right']}
                    rows={STATUS_ORDER.filter(k => summary.by_status[k]).map(k => {
                      const b = summary.by_status[k]
                      return [k, `${b.n}回`, pctStr(b.win_rate)]
                    })}
                    rowColors={STATUS_ORDER.filter(k => summary.by_status[k]).map(k =>
                      [null, null, winColor(summary.by_status[k].win_rate)]
                    )}
                    c={c}
                  />
                </div>

                {/* ── 信頼度別 ── */}
                <div>
                  <SectionLabel label="信頼度別" c={c} />
                  <CyberTable
                    head={['区分', '回数', '勝率']}
                    aligns={['left', 'right', 'right']}
                    rows={(['high', 'mid'] as const).map(k => {
                      const b = summary.by_confidence[k]
                      return [b.label, `${b.n}回`, pctStr(b.win_rate)]
                    })}
                    rowColors={(['high', 'mid'] as const).map(k =>
                      [null, null, winColor(summary.by_confidence[k].win_rate)]
                    )}
                    c={c}
                  />
                </div>

                {/* ── モデル注記 ── */}
                <div>
                  <SectionLabel label="モデル注記" c={c} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {notes.map((n, i) => (
                      <div key={i} style={{
                        padding: isMobile ? '11px 0' : '13px 0',
                        borderTop: `1px solid ${c.RULE}`,
                        borderBottom: i === notes.length - 1 ? `1px solid ${c.RULE}` : 'none',
                        display: 'flex', gap: 12, alignItems: 'flex-start',
                      }}>
                        <span style={{ fontSize: 9, fontFamily: mono, color: c.ACCENT, marginTop: 3, flexShrink: 0 }}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span style={{ fontSize: isMobile ? 12 : 13, color: c.SUB, lineHeight: 1.82, letterSpacing: '0.02em' }}>{n}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── 週次ログ ── */}
                <div>
                  <SectionLabel label="週次ログ" c={c} />
                  <button
                    onClick={() => setShowLog(v => !v)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: 'none',
                      border: `1px solid ${c.TAGBDR}`,
                      padding: '7px 14px', cursor: 'pointer',
                      fontFamily: mono, fontSize: 10, fontWeight: 700,
                      color: c.ACCENT, letterSpacing: '0.16em',
                      marginBottom: showLog ? 14 : 0,
                    }}
                  >
                    <span style={{ fontSize: 8 }}>{showLog ? '▲' : '▼'}</span>
                    {showLog ? 'COLLAPSE' : 'EXPAND'}
                  </button>

                  {showLog && (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono, fontSize: isMobile ? 10 : 11 }}>
                        <thead>
                          <tr>
                            {['WEEK', 'TEV', 'STATUS', 'CONF', 'SIG', 'NK_%', 'W/L'].map((h, i) => (
                              <th key={h} style={{
                                padding: '6px 10px',
                                textAlign: i === 0 || i === 2 ? 'left' : 'center',
                                fontSize: 9, fontWeight: 800, color: c.ACCENT,
                                letterSpacing: '0.14em',
                                borderBottom: `1px solid ${c.RULE}`,
                                whiteSpace: 'nowrap',
                              }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {weekly_log.map((w: WeeklyEntry, idx: number) => {
                            const sigColor = w.signal === 'bull' ? c.WIN : w.signal === 'bear' ? c.LOSS : c.NEUT
                            const nkColor  = w.price_change_pct == null ? c.SUB : w.price_change_pct > 0 ? c.WIN : w.price_change_pct < 0 ? c.LOSS : c.TEXT
                            const wlColor  = w.win == null ? c.SUB : w.win ? c.WIN : c.LOSS
                            const rowBg    = idx % 2 === 0 ? 'transparent' : (L ? 'rgba(0,80,160,0.025)' : 'rgba(0,200,255,0.018)')
                            return (
                              <tr key={w.week} style={{ background: rowBg }}>
                                <td style={{ padding: '7px 10px', color: c.SUB, borderBottom: `1px solid ${c.RULE}`, whiteSpace: 'nowrap' }}>{w.week}</td>
                                <td style={{ padding: '7px 10px', color: c.TEXT, borderBottom: `1px solid ${c.RULE}`, textAlign: 'center', whiteSpace: 'nowrap' }}>{w.tev ?? '—'}</td>
                                <td style={{ padding: '7px 10px', color: c.SUB, borderBottom: `1px solid ${c.RULE}`, whiteSpace: 'nowrap' }}>{w.status ?? '—'}</td>
                                <td style={{ padding: '7px 10px', color: c.TEXT, borderBottom: `1px solid ${c.RULE}`, textAlign: 'center', whiteSpace: 'nowrap' }}>{w.confidence != null ? w.confidence + '%' : '—'}</td>
                                <td style={{ padding: '7px 10px', color: sigColor, borderBottom: `1px solid ${c.RULE}`, textAlign: 'center', whiteSpace: 'nowrap', fontWeight: 700 }}>{w.signal.toUpperCase()}</td>
                                <td style={{ padding: '7px 10px', color: nkColor, borderBottom: `1px solid ${c.RULE}`, textAlign: 'center', whiteSpace: 'nowrap' }}>
                                  {w.price_change_pct != null ? (w.price_change_pct > 0 ? '+' : '') + w.price_change_pct + '%' : '—'}
                                </td>
                                <td style={{ padding: '7px 10px', color: wlColor, borderBottom: `1px solid ${c.RULE}`, textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                  {w.win === null ? '—' : w.win ? '○' : '✗'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

// ── 小コンポーネント ─────────────────────────────────────

type C = {
  L: boolean; HDRBG: string; BG: string; ACCENT: string; DIM: string
  TEXT: string; SUB: string; RULE: string; TAGBG: string; TAGBDR: string
  SCAN: string; GLOW: string; WIN: string; LOSS: string; NEUT: string
}

function SectionLabel({ label, c }: { label: string; c: C }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '0.10em',
      color: c.ACCENT, marginBottom: 12,
      textShadow: c.L ? 'none' : c.GLOW,
    }}>
      {label}
    </div>
  )
}

function CyberTable({ head, aligns, rows, rowColors, c }: {
  head: string[]
  aligns: ('left' | 'right' | 'center')[]
  rows: string[][]
  rowColors: (string | null)[][]
  c: C
}) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={h} style={{
              padding: '7px 12px', textAlign: aligns[i],
              fontSize: 10, fontWeight: 700, color: c.DIM,
              letterSpacing: '0.08em',
              borderBottom: `1px solid ${c.RULE}`,
              whiteSpace: 'nowrap',
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} style={{ background: ri % 2 === 0 ? 'transparent' : (c.L ? 'rgba(0,80,160,0.025)' : 'rgba(0,200,255,0.018)') }}>
            {row.map((cell, ci) => {
              const col = rowColors[ri]?.[ci] ?? c.TEXT
              return (
                <td key={ci} style={{
                  padding: '10px 12px',
                  textAlign: aligns[ci],
                  color: col,
                  borderBottom: `1px solid ${c.RULE}`,
                  whiteSpace: 'nowrap',
                  fontWeight: ci === row.length - 1 ? 700 : 400,
                }}>
                  {cell}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
