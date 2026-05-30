import { useEffect, useState } from 'react'
import { fetchBacktestResult, type BacktestResult, type WeeklyEntry } from '../utils/backtestData'

type Props = {
  theme: 'dark' | 'light'
  isMobile: boolean
  onClose: () => void
}

const STATUS_ORDER = ['慣性航行中', '重力反転中', '真空落下', '限界膨張']
const mono = "'Courier New', Courier, monospace" as const

function inertiaPhase(e: WeeklyEntry): 'strong' | 'mid' | 'exhausted' {
  if (e.status?.startsWith('限界膨張')) return 'exhausted'
  const dec = e.decay
  const acc = e.acc
  const f4w = e.foreign4w_pct
  const cot = e.cot_pct
  if (dec !== null && acc !== null && f4w !== null && cot !== null) {
    const n = [dec < 0.85, acc < 0, f4w < 40, cot < 40].filter(Boolean).length
    if (n >= 2) return 'exhausted'
    if (dec >= 0.95 && acc > 0 && f4w >= 60 && e.status === '慣性航行中') return 'strong'
    return 'mid'
  }
  if (dec !== null && dec < 0.85) return 'exhausted'
  if (dec !== null && dec >= 0.95 && e.status === '慣性航行中') return 'strong'
  return 'mid'
}

type C = {
  L: boolean; BG: string; HDRBG: string; ACCENT: string; DIM: string
  TEXT: string; SUB: string; RULE: string; TAGBG: string; TAGBDR: string
  SCAN: string; GLOW: string; WIN: string; LOSS: string; NEUT: string
}

function makeC(theme: 'dark' | 'light'): C {
  const L = theme === 'light'
  return {
    L,
    BG:     L ? 'rgba(240,248,255,0.72)' : 'rgba(4,10,22,0.55)',
    HDRBG:  L ? 'rgba(248,252,255,0.90)' : 'rgba(4,10,22,0.80)',
    ACCENT: L ? '#0369a1'                : '#00e5ff',
    DIM:    L ? 'rgba(3,105,161,0.62)'   : 'rgba(0,229,255,0.42)',
    TEXT:   L ? 'rgba(8,28,75,0.90)'     : 'rgba(220,240,255,0.90)',
    SUB:    L ? 'rgba(30,65,135,0.62)'   : 'rgba(140,188,228,0.68)',
    RULE:   L ? 'rgba(3,105,161,0.18)'   : 'rgba(0,229,255,0.18)',
    TAGBG:  L ? 'rgba(3,105,161,0.08)'   : 'rgba(0,229,255,0.12)',
    TAGBDR: L ? 'rgba(3,105,161,0.28)'   : 'rgba(0,229,255,0.18)',
    SCAN:   L ? ''                       : 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,229,255,0.013) 3px,rgba(0,229,255,0.013) 4px)',
    GLOW:   L ? 'none'                   : '0 0 14px rgba(0,229,255,0.55)',
    WIN:    L ? '#15803d'                : '#4ade80',
    LOSS:   L ? '#dc2626'                : '#f87171',
    NEUT:   L ? 'rgba(30,65,135,0.45)'   : 'rgba(140,188,228,0.45)',
  }
}

export function BacktestPanel({ theme, isMobile, onClose }: Props) {
  const [data, setData]       = useState<BacktestResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [showLog, setShowLog] = useState(false)

  useEffect(() => {
    fetchBacktestResult().then(r => { setData(r); setLoading(false) })
  }, [])

  const c = makeC(theme)

  const pctStr   = (v: number | null) => v == null ? '—' : Math.round(v * 100) + '%'
  const winColor = (rate: number | null) => {
    if (rate == null) return c.SUB
    return rate >= 0.5 ? c.WIN : rate <= 0.35 ? c.LOSS : c.TEXT
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 30,
      display: 'flex', flexDirection: 'column',
      background: c.BG, backgroundImage: c.SCAN,
      backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      overflow: 'hidden',
    }}>
      <style>{`@keyframes btSweep{from{transform:translateY(-100%)}to{transform:translateY(250%)}}`}</style>

      {/* scan sweep */}
      {!c.L && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', left: 0, right: 0, height: '26%',
            background: 'linear-gradient(to bottom,transparent,rgba(0,229,255,0.024) 50%,transparent)',
            animation: 'btSweep 11s linear infinite',
          }} />
        </div>
      )}

      {/* ── Header ── */}
      <div style={{
        flexShrink: 0, zIndex: 5,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: isMobile ? '11px 16px' : '12px 28px',
        background: c.HDRBG,
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${c.RULE}`,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.ACCENT, boxShadow: c.L ? 'none' : `0 0 7px ${c.ACCENT}`, flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', color: c.DIM, fontFamily: mono, whiteSpace: 'nowrap', textShadow: c.L ? 'none' : '0 0 10px rgba(0,229,255,0.28)' }}>
          ぽいロボ ▸ バックテスト
        </span>
        <span style={{ fontSize: 9, color: c.SUB, fontFamily: mono, flexShrink: 0, letterSpacing: '0.06em' }}>ベータ</span>
        <button onClick={onClose} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 28, borderRadius: 7, cursor: 'pointer',
          border: c.L ? '1px solid rgba(0,100,180,0.25)' : '1px solid rgba(0,200,255,0.2)',
          background: c.L ? 'rgba(0,100,180,0.08)' : 'rgba(0,200,255,0.06)',
          color: c.L ? 'rgba(0,80,160,0.70)' : 'rgba(0,200,255,0.65)',
          flexShrink: 0,
        }} aria-label="閉じる">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* ── Body（スクロールなし・フル画面） ── */}
      <div style={{
        flex: 1, overflow: 'hidden', zIndex: 1,
        display: 'flex', flexDirection: 'column',
        padding: isMobile ? '12px 16px 14px' : '16px 28px 20px',
        gap: isMobile ? 10 : 14,
      }}>

        {/* 注意書き：検証途上・サンプル不足である旨を明示（成績の誤解防止） */}
        <div style={{
          flexShrink: 0,
          padding: isMobile ? '8px 12px' : '9px 14px',
          borderRadius: 8,
          border: `1px solid ${c.RULE}`,
          background: c.L ? 'rgba(0,100,180,0.05)' : 'rgba(0,200,255,0.05)',
          fontFamily: mono, fontSize: isMobile ? 10 : 11, lineHeight: 1.7,
          color: c.DIM, letterSpacing: '0.02em',
        }}>
          ⚠ 検証期間が短く（約半年・下落相場が中心）、統計的に有意な結論を出すにはサンプルが不足しています。
          これは手法の妥当性を継続検証するための研究用データであり、将来の成績や投資成果を示すものではありません（継続検証中）。
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: mono, fontSize: 11, color: c.DIM, letterSpacing: '0.18em' }}>読み込み中...</span>
          </div>
        )}

        {/* No data */}
        {!loading && !data && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <div style={{ fontSize: 32 }}>📊</div>
            <p style={{ fontSize: 13, color: c.SUB, lineHeight: 1.8, textAlign: 'center', maxWidth: 300 }}>
              <code style={{ fontFamily: mono, fontSize: 12, color: c.ACCENT }}>npm run backtest</code> を実行するとデータが生成されます。
            </p>
          </div>
        )}

        {/* Data */}
        {!loading && data && (() => {
          const { summary, data_range, computed_at } = data
          const calcWinRate = (arr: WeeklyEntry[]) =>
            arr.length === 0 ? null : Math.round(arr.filter(w => w.win).length / arr.length * 100) / 100
          const allSig     = data.weekly_log.filter(w => w.signal !== 'neutral' && w.win !== null)
          const noExh      = allSig.filter(w => inertiaPhase(w) !== 'exhausted')
          const strongOnly = allSig.filter(w => inertiaPhase(w) === 'strong')
          const regimeRows = [
            { label: '全シグナル', entries: allSig },
            { label: '枯渇圏除外', entries: noExh },
            { label: '強持続のみ', entries: strongOnly },
          ]
          return (
            <>
              {/* Meta */}
              <div style={{ flexShrink: 0, fontSize: isMobile ? 9 : 10, color: c.DIM, fontFamily: mono, letterSpacing: '0.10em' }}>
                {data_range.from} ▸ {data_range.to}&nbsp;&nbsp;{summary.total_weeks}週&nbsp;&nbsp;|&nbsp;&nbsp;{new Date(computed_at).toLocaleDateString('ja-JP')} 算出
              </div>

              {/* Summary cards（4列固定） */}
              <div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: isMobile ? 6 : 10 }}>
                {[
                  { label: '総合',   val: summary.overall_win_rate, sub: `${summary.signal_weeks}週` },
                  { label: 'ブル',   val: summary.bull_win_rate,    sub: `${summary.bull_signals}回` },
                  { label: 'ベア',   val: summary.bear_win_rate,    sub: `${summary.bear_signals}回` },
                  { label: '中立',   val: null, sub: '回避', extra: String(summary.neutral_signals) + '週' },
                ].map(item => (
                  <div key={item.label} style={{
                    padding: isMobile ? '10px 8px' : '14px 16px',
                    border: `1px solid ${c.TAGBDR}`, background: c.TAGBG,
                    display: 'flex', flexDirection: 'column', gap: isMobile ? 3 : 5,
                  }}>
                    <div style={{ fontSize: isMobile ? 7 : 9, fontWeight: 800, letterSpacing: '0.16em', fontFamily: mono, color: item.label === '中立' ? c.DIM : c.ACCENT }}>
                      {item.label}
                    </div>
                    <div style={{
                      fontSize: isMobile ? 20 : 28, fontWeight: 900, lineHeight: 1, fontFamily: mono,
                      color: item.extra ? c.SUB : winColor(item.val),
                    }}>
                      {item.extra ?? pctStr(item.val)}
                    </div>
                    <div style={{ fontSize: isMobile ? 9 : 10, color: c.SUB }}>{item.sub}</div>
                  </div>
                ))}
              </div>

              {/* Tables エリア（残りスペースを埋める） */}
              <div style={{
                flex: 1, minHeight: 0,
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                gap: isMobile ? 10 : 16,
                overflow: 'hidden',
              }}>

                {/* ステータス別 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
                  <Label text="ステータス別" c={c} />
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
                    c={c} isMobile={isMobile}
                  />
                </div>

                {/* 信頼度別 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
                  <Label text="信頼度別" c={c} />
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
                    c={c} isMobile={isMobile}
                  />
                </div>

                {/* 慣性フィルター */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
                  <Label text="慣性フィルター" c={c} />
                  <CyberTable
                    head={['条件', '回数', '勝率']}
                    aligns={['left', 'right', 'right']}
                    rows={regimeRows.map(r => [r.label, `${r.entries.length}回`, pctStr(calcWinRate(r.entries))])}
                    rowColors={regimeRows.map(r => [null, null, winColor(calcWinRate(r.entries))])}
                    c={c} isMobile={isMobile}
                  />
                  {!isMobile && (
                    <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                      <LogButton c={c} onClick={() => setShowLog(true)} />
                    </div>
                  )}
                </div>
              </div>

              {/* ログボタン（モバイル：最下部） */}
              {isMobile && (
                <div style={{ flexShrink: 0 }}>
                  <LogButton c={c} onClick={() => setShowLog(true)} />
                </div>
              )}
            </>
          )
        })()}
      </div>

      {/* ── 週次ログ モーダル ── */}
      {showLog && data && (
        <WeeklyLogModal data={data} c={c} isMobile={isMobile} onClose={() => setShowLog(false)} />
      )}
    </div>
  )
}

// ── 週次ログ モーダル ────────────────────────────────────

function WeeklyLogModal({ data, c, isMobile, onClose }: {
  data: BacktestResult
  c: C
  isMobile: boolean
  onClose: () => void
}) {
  const { weekly_log, notes } = data

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 20,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: c.L ? 'rgba(0,20,60,0.35)' : 'rgba(0,0,0,0.60)',
      backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      padding: isMobile ? '12px' : '24px',
    }} onClick={onClose}>
      <div
        style={{
          width: '100%', maxWidth: 780,
          height: '100%', maxHeight: isMobile ? '100%' : '88vh',
          display: 'flex', flexDirection: 'column',
          background: c.HDRBG,
          border: `1px solid ${c.TAGBDR}`,
          boxShadow: c.L ? '0 8px 40px rgba(0,60,180,0.15)' : '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,200,255,0.08)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* モーダルヘッダー */}
        <div style={{
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: isMobile ? '12px 16px' : '14px 24px',
          borderBottom: `1px solid ${c.RULE}`,
        }}>
          <span style={{ flex: 1, fontSize: 10, fontWeight: 700, letterSpacing: '0.20em', color: c.DIM, fontFamily: mono, textShadow: c.L ? 'none' : '0 0 10px rgba(0,229,255,0.28)' }}>
            週次ログ
          </span>
          <button onClick={onClose} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: 7, cursor: 'pointer',
            border: c.L ? '1px solid rgba(0,100,180,0.25)' : '1px solid rgba(0,200,255,0.2)',
            background: c.L ? 'rgba(0,100,180,0.08)' : 'rgba(0,200,255,0.06)',
            color: c.L ? 'rgba(0,80,160,0.70)' : 'rgba(0,200,255,0.65)',
          }} aria-label="閉じる">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* モーダルコンテンツ（スクロール） */}
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '14px 16px' : '20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* 週次テーブル */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono, fontSize: isMobile ? 10 : 11 }}>
              <thead>
                <tr>
                  {['週','TEV','ステータス','確信度','判定','日経%','勝敗'].map((h, i) => (
                    <th key={h} style={{
                      padding: '7px 10px',
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
                  return (
                    <tr key={w.week} style={{ background: idx % 2 === 0 ? 'transparent' : (c.L ? 'rgba(0,80,160,0.025)' : 'rgba(0,200,255,0.018)') }}>
                      <td style={{ padding: '8px 10px', color: c.SUB, borderBottom: `1px solid ${c.RULE}`, whiteSpace: 'nowrap' }}>{w.week}</td>
                      <td style={{ padding: '8px 10px', color: c.TEXT, borderBottom: `1px solid ${c.RULE}`, textAlign: 'center', whiteSpace: 'nowrap' }}>{w.tev ?? '—'}</td>
                      <td style={{ padding: '8px 10px', color: c.SUB, borderBottom: `1px solid ${c.RULE}`, whiteSpace: 'nowrap' }}>{w.status ?? '—'}</td>
                      <td style={{ padding: '8px 10px', color: c.TEXT, borderBottom: `1px solid ${c.RULE}`, textAlign: 'center', whiteSpace: 'nowrap' }}>{w.confidence != null ? w.confidence + '%' : '—'}</td>
                      <td style={{ padding: '8px 10px', color: sigColor, borderBottom: `1px solid ${c.RULE}`, textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>{w.signal === 'bull' ? 'ブル' : w.signal === 'bear' ? 'ベア' : '中立'}</td>
                      <td style={{ padding: '8px 10px', color: nkColor, borderBottom: `1px solid ${c.RULE}`, textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {w.price_change_pct != null ? (w.price_change_pct > 0 ? '+' : '') + w.price_change_pct + '%' : '—'}
                      </td>
                      <td style={{ padding: '8px 10px', color: wlColor, borderBottom: `1px solid ${c.RULE}`, textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {w.win === null ? '—' : w.win ? '○' : '✗'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* モデル注記 */}
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', color: c.DIM, fontFamily: mono, marginBottom: 12 }}>モデル注記</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {notes.map((n, i) => (
                <div key={i} style={{
                  padding: '10px 0',
                  borderTop: `1px solid ${c.RULE}`,
                  borderBottom: i === notes.length - 1 ? `1px solid ${c.RULE}` : 'none',
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                }}>
                  <span style={{ fontSize: 9, fontFamily: mono, color: c.ACCENT, marginTop: 2, flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
                  <span style={{ fontSize: isMobile ? 11 : 12, color: c.SUB, lineHeight: 1.8, letterSpacing: '0.02em' }}>{n}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 小コンポーネント ─────────────────────────────────────

function Label({ text, c }: { text: string; c: C }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', color: c.ACCENT, flexShrink: 0, textShadow: c.L ? 'none' : c.GLOW }}>
      {text}
    </div>
  )
}

function LogButton({ c, onClick }: { c: C; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', padding: '10px 0',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      border: `1px solid ${c.TAGBDR}`, background: c.TAGBG,
      cursor: 'pointer', fontFamily: mono, fontSize: 10, fontWeight: 700,
      color: c.ACCENT, letterSpacing: '0.18em',
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
      </svg>
      週次ログ
    </button>
  )
}

function CyberTable({ head, aligns, rows, rowColors, c, isMobile }: {
  head: string[]
  aligns: ('left' | 'right' | 'center')[]
  rows: string[][]
  rowColors: (string | null)[][]
  c: C
  isMobile: boolean
}) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: isMobile ? 11 : 12 }}>
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={h} style={{
              padding: isMobile ? '5px 8px' : '6px 12px',
              textAlign: aligns[i], fontSize: 9, fontWeight: 700,
              color: c.DIM, letterSpacing: '0.08em',
              borderBottom: `1px solid ${c.RULE}`, whiteSpace: 'nowrap',
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
                  padding: isMobile ? '8px 8px' : '10px 12px',
                  textAlign: aligns[ci], color: col,
                  borderBottom: `1px solid ${c.RULE}`, whiteSpace: 'nowrap',
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
