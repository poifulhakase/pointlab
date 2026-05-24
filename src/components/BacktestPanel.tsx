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
    HDRBG:  L ? 'rgba(228,242,255,0.97)' : 'rgba(3,9,22,0.97)',
    BG:     L ? 'rgba(218,236,255,0.92)' : 'rgba(3,10,24,0.92)',
    ACCENT: L ? '#0369a1'                : '#00e5ff',
    DIM:    L ? 'rgba(3,105,161,0.62)'   : 'rgba(0,229,255,0.52)',
    NUM:    L ? 'rgba(3,105,161,0.06)'   : 'rgba(0,215,255,0.07)',
    TEXT:   L ? 'rgba(8,28,75,0.90)'     : 'rgba(220,240,255,0.90)',
    SUB:    L ? 'rgba(30,65,135,0.62)'   : 'rgba(140,188,228,0.68)',
    RULE:   L ? 'rgba(3,105,161,0.12)'   : 'rgba(0,200,255,0.10)',
    TAGBG:  L ? 'rgba(3,105,161,0.07)'   : 'rgba(0,200,255,0.06)',
    TAGBDR: L ? 'rgba(3,105,161,0.26)'   : 'rgba(0,200,255,0.22)',
    SCAN:   L ? ''                       : 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,229,255,0.013) 3px,rgba(0,229,255,0.013) 4px)',
    GLOW:   L ? 'none'                   : '0 0 14px rgba(0,229,255,0.55)',
    WIN:    L ? '#15803d'                : '#4ade80',
    LOSS:   L ? '#dc2626'               : '#f87171',
    NEUT:   L ? 'rgba(30,65,135,0.45)'  : 'rgba(140,188,228,0.45)',
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 30,
      overflow: 'hidden',
      background: c.BG,
      backgroundImage: c.SCAN,
      backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
    }}>
      <style>{`
        @keyframes btFadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
        @keyframes btSweep  { from { transform:translateY(-100%); } to { transform:translateY(250%); } }
        @keyframes btBlink  { 0%,44%{ opacity:1; } 46%,100%{ opacity:0.15; } }
        .bt-s { opacity:0; animation: btFadeUp .55s cubic-bezier(.16,1,.3,1) forwards; }
      `}</style>

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

        {/* ── Content ── */}
        <div style={{
          maxWidth: isMobile ? '100%' : 680,
          margin: '0 auto',
          padding: isMobile ? '16px 20px 100px' : '24px 56px 120px',
        }}>

          {/* Loading */}
          {loading && (
            <div style={{ paddingTop: 80, display: 'flex', justifyContent: 'center' }}>
              <span style={{ fontFamily: mono, fontSize: 11, color: c.DIM, letterSpacing: '0.18em', animation: 'btBlink 1.4s ease-in-out infinite' }}>
                LOADING...
              </span>
            </div>
          )}

          {/* No data */}
          {!loading && !data && (
            <div className="bt-s" style={{ paddingTop: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ fontFamily: mono, fontSize: 10, color: c.DIM, letterSpacing: '0.22em' }}>NO_DATA</div>
              <p style={{ fontSize: 13, color: c.SUB, lineHeight: 1.8, textAlign: 'center', maxWidth: 300 }}>
                ターミナルで <code style={{ fontFamily: mono, fontSize: 12, color: c.ACCENT }}>npm run backtest</code> を実行するとデータが生成されます。
              </p>
            </div>
          )}

          {/* Data */}
          {!loading && data && <DataSections data={data} c={c} isMobile={isMobile} mono={mono} showLog={showLog} setShowLog={setShowLog} />}
        </div>
      </div>
    </div>
  )
}

// ── データ表示 ────────────────────────────────────────────

type C = {
  L: boolean; HDRBG: string; BG: string; ACCENT: string; DIM: string; NUM: string
  TEXT: string; SUB: string; RULE: string; TAGBG: string; TAGBDR: string
  SCAN: string; GLOW: string; WIN: string; LOSS: string; NEUT: string
}

function DataSections({ data, c, isMobile, mono, showLog, setShowLog }: {
  data: BacktestResult
  c: C
  isMobile: boolean
  mono: string
  showLog: boolean
  setShowLog: (v: boolean | ((p: boolean) => boolean)) => void
}) {
  const { summary, weekly_log, notes, computed_at, data_range } = data

  const pctStr = (v: number | null) => v == null ? '—' : Math.round(v * 100) + '%'
  const winColor = (rate: number | null) => {
    if (rate == null) return c.SUB
    return rate >= 0.5 ? c.WIN : rate <= 0.35 ? c.LOSS : c.TEXT
  }

  return (
    <>
      {/* ── 01 OVERVIEW ── */}
      <Section num="01" en="OVERVIEW" ja="概要" isMobile={isMobile} c={c} mono={mono} delay={0}>
        <div style={{ fontSize: isMobile ? 9 : 10, color: c.DIM, fontFamily: mono, letterSpacing: '0.12em', marginBottom: isMobile ? 18 : 24 }}>
          {data_range.from} ▸ {data_range.to} &nbsp;|&nbsp; {summary.total_weeks} WEEKS &nbsp;|&nbsp; COMPUTED {new Date(computed_at).toLocaleDateString('ja-JP')}
        </div>

        {/* Win rate big display */}
        <div style={{ display: 'flex', gap: isMobile ? 12 : 20, flexWrap: 'wrap', marginBottom: isMobile ? 24 : 32 }}>
          {[
            { label: 'OVERALL', val: summary.overall_win_rate, sub: `${summary.signal_weeks} signals` },
            { label: 'BULL',    val: summary.bull_win_rate,    sub: `${summary.bull_signals} trades` },
            { label: 'BEAR',    val: summary.bear_win_rate,    sub: `${summary.bear_signals} trades` },
          ].map(item => (
            <div key={item.label} style={{
              flex: 1, minWidth: isMobile ? 80 : 100,
              padding: isMobile ? '14px 16px' : '18px 22px',
              border: `1px solid ${c.RULE}`,
              background: c.TAGBG,
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: c.ACCENT, letterSpacing: '0.22em', fontFamily: mono }}>{item.label}</div>
              <div style={{
                fontSize: isMobile ? 28 : 36, fontWeight: 900, lineHeight: 1,
                color: winColor(item.val), fontFamily: mono,
                textShadow: item.val != null && item.val >= 0.5 ? (c.L ? 'none' : `0 0 20px ${c.WIN}60`) : 'none',
              }}>
                {pctStr(item.val)}
              </div>
              <div style={{ fontSize: 10, color: c.SUB, fontFamily: mono }}>{item.sub}</div>
            </div>
          ))}
          <div style={{
            flex: 1, minWidth: isMobile ? 80 : 100,
            padding: isMobile ? '14px 16px' : '18px 22px',
            border: `1px solid ${c.RULE}`,
            background: c.TAGBG,
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: c.DIM, letterSpacing: '0.22em', fontFamily: mono }}>NEUTRAL</div>
            <div style={{ fontSize: isMobile ? 28 : 36, fontWeight: 900, lineHeight: 1, color: c.SUB, fontFamily: mono }}>{summary.neutral_signals}</div>
            <div style={{ fontSize: 10, color: c.SUB, fontFamily: mono }}>回避週</div>
          </div>
        </div>
      </Section>

      {/* ── 02 BY STATUS ── */}
      <Section num="02" en="BY_STATUS" ja="ステータス別" isMobile={isMobile} c={c} mono={mono} delay={1}>
        <CyberTable
          head={['STATUS', 'N', 'WIN_RATE']}
          aligns={['left', 'right', 'right']}
          rows={STATUS_ORDER
            .filter(k => summary.by_status[k])
            .map(k => {
              const b = summary.by_status[k]
              return [k, `${b.n}回`, pctStr(b.win_rate)]
            })}
          rowColors={STATUS_ORDER
            .filter(k => summary.by_status[k])
            .map(k => [null, null, winColor(summary.by_status[k].win_rate)])}
          c={c} mono={mono} isMobile={isMobile}
        />
      </Section>

      {/* ── 03 BY CONFIDENCE ── */}
      <Section num="03" en="BY_CONFIDENCE" ja="信頼度別" isMobile={isMobile} c={c} mono={mono} delay={2}>
        <CyberTable
          head={['CONFIDENCE', 'N', 'WIN_RATE']}
          aligns={['left', 'right', 'right']}
          rows={(['high', 'mid'] as const).map(k => {
            const b = summary.by_confidence[k]
            return [b.label, `${b.n}回`, pctStr(b.win_rate)]
          })}
          rowColors={(['high', 'mid'] as const).map(k => [null, null, winColor(summary.by_confidence[k].win_rate)])}
          c={c} mono={mono} isMobile={isMobile}
        />
      </Section>

      {/* ── 04 NOTES ── */}
      <Section num="04" en="MODEL_NOTES" ja="モデル注記" isMobile={isMobile} c={c} mono={mono} delay={3}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {notes.map((n, i) => (
            <div key={i} style={{
              paddingTop: isMobile ? 12 : 14, paddingBottom: isMobile ? 12 : 14,
              borderTop: i === 0 ? `1px solid ${c.RULE}` : `1px solid ${c.RULE}`,
              borderBottom: i === notes.length - 1 ? `1px solid ${c.RULE}` : 'none',
              display: 'flex', gap: 12, alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: 9, fontFamily: mono, color: c.ACCENT, marginTop: 3, flexShrink: 0, letterSpacing: '0.12em' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ fontSize: isMobile ? 12 : 13, color: c.SUB, lineHeight: 1.82, letterSpacing: '0.02em' }}>{n}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 05 WEEKLY LOG ── */}
      <Section num="05" en="WEEKLY_LOG" ja="週次ログ" isMobile={isMobile} c={c} mono={mono} delay={4}>
        <button
          onClick={() => setShowLog(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'none',
            border: `1px solid ${c.TAGBDR}`,
            padding: '8px 16px', cursor: 'pointer',
            fontFamily: mono, fontSize: 10, fontWeight: 700,
            color: c.ACCENT, letterSpacing: '0.18em',
          }}
        >
          <span style={{ fontSize: 8 }}>{showLog ? '▲' : '▼'}</span>
          {showLog ? 'COLLAPSE' : 'EXPAND'}
        </button>

        {showLog && (
          <div style={{ marginTop: 16, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono, fontSize: isMobile ? 10 : 11 }}>
              <thead>
                <tr>
                  {['WEEK', 'TEV', 'STATUS', 'CONF', 'SIG', 'NK_%', 'W/L'].map((h, i) => (
                    <th key={h} style={{
                      padding: '6px 10px',
                      textAlign: i >= 4 ? 'center' : i >= 1 ? 'right' : 'left',
                      fontSize: 9, fontWeight: 800, color: c.ACCENT,
                      letterSpacing: '0.16em',
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
                  return (
                    <tr key={w.week} style={{ background: idx % 2 === 0 ? 'transparent' : (c.L ? 'rgba(0,80,160,0.025)' : 'rgba(0,200,255,0.018)') }}>
                      <td style={{ padding: '7px 10px', color: c.SUB, borderBottom: `1px solid ${c.RULE}`, whiteSpace: 'nowrap' }}>{w.week}</td>
                      <td style={{ padding: '7px 10px', color: c.TEXT, borderBottom: `1px solid ${c.RULE}`, textAlign: 'right', whiteSpace: 'nowrap' }}>{w.tev ?? '—'}</td>
                      <td style={{ padding: '7px 10px', color: c.SUB, borderBottom: `1px solid ${c.RULE}`, whiteSpace: 'nowrap' }}>{w.status ?? '—'}</td>
                      <td style={{ padding: '7px 10px', color: c.TEXT, borderBottom: `1px solid ${c.RULE}`, textAlign: 'right', whiteSpace: 'nowrap' }}>{w.confidence != null ? w.confidence + '%' : '—'}</td>
                      <td style={{ padding: '7px 10px', color: sigColor, borderBottom: `1px solid ${c.RULE}`, textAlign: 'center', whiteSpace: 'nowrap', textShadow: c.L ? 'none' : `0 0 8px ${sigColor}60` }}>{w.signal.toUpperCase()}</td>
                      <td style={{ padding: '7px 10px', color: nkColor, borderBottom: `1px solid ${c.RULE}`, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {w.price_change_pct != null ? (w.price_change_pct > 0 ? '+' : '') + w.price_change_pct + '%' : '—'}
                      </td>
                      <td style={{ padding: '7px 10px', color: wlColor, borderBottom: `1px solid ${c.RULE}`, textAlign: 'center', whiteSpace: 'nowrap', fontWeight: 700, textShadow: c.L ? 'none' : `0 0 8px ${wlColor}60` }}>
                        {w.win === null ? '—' : w.win ? '○' : '✗'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  )
}

// ── Section ─────────────────────────────────────────────

function Section({ num, en, ja, isMobile, c, mono, delay, children }: {
  num: string
  en: string
  ja: string
  isMobile: boolean
  c: C
  mono: string
  delay: number
  children: React.ReactNode
}) {
  const numSize = isMobile ? 88 : 120
  return (
    <div className="bt-s" style={{ animationDelay: `${delay * 60}ms` }}>
      <div style={{ paddingTop: delay === 0 ? (isMobile ? 20 : 28) : (isMobile ? 48 : 64), paddingBottom: isMobile ? 20 : 26 }}>
        {/* Watermark number */}
        <div style={{
          fontFamily: mono, fontSize: numSize, fontWeight: 900, lineHeight: 1,
          color: c.NUM, letterSpacing: '-0.04em', userSelect: 'none',
          marginBottom: isMobile ? -16 : -22, marginLeft: -4,
        }}>
          {num}
        </div>

        {/* EN label */}
        <div style={{
          fontSize: isMobile ? 10 : 11, fontWeight: 800, color: c.ACCENT,
          letterSpacing: '0.32em', fontFamily: mono, textTransform: 'uppercase',
          textShadow: c.GLOW, marginBottom: 4,
        }}>
          {en}
        </div>

        {/* JA label */}
        <div style={{
          fontSize: 10, color: c.SUB, letterSpacing: '0.16em',
          fontFamily: mono, marginBottom: isMobile ? 18 : 24,
        }}>
          {ja}
        </div>

        {/* Rule */}
        <div style={{
          height: 1,
          background: `linear-gradient(to right, ${c.ACCENT} 0%, ${c.RULE} 40%, transparent 80%)`,
          opacity: c.L ? 0.30 : 0.38,
          marginBottom: isMobile ? 20 : 28,
        }} />

        {children}
      </div>
    </div>
  )
}

// ── CyberTable ───────────────────────────────────────────

function CyberTable({ head, aligns, rows, rowColors, c, mono, isMobile }: {
  head: string[]
  aligns: ('left' | 'right' | 'center')[]
  rows: string[][]
  rowColors: (string | null)[][]
  c: C
  mono: string
  isMobile: boolean
}) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono, fontSize: isMobile ? 11 : 12 }}>
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={h} style={{
              padding: '6px 12px', textAlign: aligns[i],
              fontSize: 9, fontWeight: 800, color: c.ACCENT,
              letterSpacing: '0.16em',
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
                  textShadow: (ci === row.length - 1 && col !== c.TEXT && col !== c.SUB && !c.L)
                    ? `0 0 12px ${col}60` : 'none',
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
