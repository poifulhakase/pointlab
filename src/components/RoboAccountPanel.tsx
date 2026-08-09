// ロボ口座（疑似トレード）の表示。
// 🔴 表示は管理者のみ（ShieldView 側で isAdminEmail によって出し分ける。設計書 §10.2）。
// 🔴 この画面は読むだけ。売買の操作はしない（書き込むのは GitHub Actions）。
// 🔵 配色・演出は ぽいロボ系（サイバー調・シアン）に揃える。cyberTheme の cy() を使う。
import { useEffect, useState } from 'react'
import type React from 'react'
import { cy } from '../utils/cyberTheme'
import {
  fetchRoboAccount, symbolLabel, equityOf, totalReturnPct,
  ROBO_SYMBOLS, type RoboAccount, type RoboTrade,
} from '../utils/roboAccount'

type Props = { theme: 'dark' | 'light'; isMobile: boolean }

const yen = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v).toLocaleString()}`)
const pct = (v: number | null | undefined, d = 1) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(d)}%`)

export function RoboAccountPanel({ theme, isMobile }: Props) {
  const [account, setAccount] = useState<RoboAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [openLog, setOpenLog] = useState(false)
  const c = cy(theme)

  useEffect(() => {
    let alive = true
    fetchRoboAccount()
      .then(a => { if (alive) { setAccount(a); setLoading(false) } })
      .catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const shell: React.CSSProperties = {
    flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative',
    background: c.BG, backgroundImage: c.SCAN,
    padding: isMobile ? 14 : 18,
    display: 'flex', flexDirection: 'column', gap: 14,
    fontFamily: c.FONT,
  }

  if (loading) {
    return (
      <div style={shell}>
        <Keyframes />
        <div style={{ color: c.DIM, fontSize: 12, letterSpacing: '0.1em' }}>
          <span className="robo-blink">▌</span> ACCOUNT DATA ....... 読込中
        </div>
      </div>
    )
  }

  if (!account) {
    return (
      <div style={shell}>
        <Keyframes />
        <Header c={c} status="STANDBY" />
        <div style={{ ...panel(c), color: c.DESC, fontSize: 13, lineHeight: 1.9 }}>
          まだ記録がありません。<br />
          毎営業日の引け後に判断が実行されると、ここに建玉と成績が出ます。
        </div>
      </div>
    )
  }

  const pos = account.position
  const equity = equityOf(account)
  const ret = totalReturnPct(account)
  const st = account.stats
  const bl = st?.baseline ?? account.baseline
  const closed = account.trades.filter(t => t.side === 'sell' && t.exit_reason !== 'sync')
  const recent = [...account.trades].reverse().slice(0, openLog ? 100 : 5)
  const lastDiv = account.divergences?.length ? account.divergences[account.divergences.length - 1] : null
  const side = pos ? ROBO_SYMBOLS[pos.symbol]?.side : null

  return (
    <div style={shell}>
      <Keyframes />
      {theme === 'dark' && <>
        <div className="robo-dust" style={{ top: '18%', left: '12%', animationDelay: '0s' }} />
        <div className="robo-dust" style={{ top: '62%', left: '78%', animationDelay: '2.5s' }} />
        <div className="robo-dust" style={{ top: '40%', left: '46%', animationDelay: '5s' }} />
        <div className="robo-scan" />
      </>}

      <Header c={c} status={pos ? 'IN POSITION' : 'NO POSITION'} live={!!pos} />

      {/* ── 評価額 ── */}
      <div style={panel(c)}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
          gap: 14,
        }}>
          <Metric c={c} label="EQUITY / 評価額" value={yen(equity)} unit="円" big />
          <Metric c={c} label="TOTAL RETURN" value={pct(ret, 2)}
            color={ret >= 0 ? (theme === 'dark' ? '#ff6b6b' : '#dc2626') : (theme === 'dark' ? '#4dabf7' : '#2563eb')} big />
          <Metric c={c} label="CASH / 現金" value={yen(account.cash)} unit="円" />
        </div>
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${c.BORDER}`, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 10, color: c.DIM, letterSpacing: '0.06em' }}>
          <span>DECIDER: {account.decider?.type === 'llm' ? `AI / ${account.decider.model ?? '—'}` : 'BASELINE'}</span>
          {account.decider?.effort && <span>EFFORT: {account.decider.effort.toUpperCase()}</span>}
          {account.generated_at && <span>UPDATED: {new Date(account.generated_at).toLocaleString('ja-JP')}</span>}
        </div>
      </div>

      {/* ── 建玉 ── */}
      <div style={panel(c)}>
        <SectionTitle c={c} text="POSITION / 建玉" />
        {pos && pos.qty > 0 ? (
          <>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '5px 12px', borderRadius: 4, marginBottom: 12,
              border: `1px solid ${c.BORDBR}`, background: c.HDBG,
              boxShadow: `0 0 12px ${c.FAINT}`,
            }}>
              <span className="robo-pulse" style={{
                width: 7, height: 7, borderRadius: '50%',
                background: side === 'bear' ? '#4dabf7' : '#ff6b6b',
              }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: c.GREEN, letterSpacing: '0.06em' }}>
                {pos.symbol} {symbolLabel(pos.symbol)}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 14 }}>
              <Metric c={c} label="QTY / 数量" value={String(pos.qty)} unit="口" />
              <Metric c={c} label="AVG / 平均取得" value={yen(pos.avg_price)} unit="円" />
              <Metric c={c} label="STOP / 損切り" value={yen(pos.stop_price)} unit="円" sub={pos.stop_rule ?? undefined} />
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: c.DESC, lineHeight: 1.9 }}>
            保有なし
            <div style={{ fontSize: 11, color: c.DIM, marginTop: 4 }}>
              半分以上の日は持たないのが、この戦略の正常な姿です。
            </div>
          </div>
        )}
      </div>

      {/* ── 直近の同期（あなたの売買） ── */}
      {lastDiv && (
        <div style={panel(c)}>
          <SectionTitle c={c} text="LAST SYNC / あなたの保有の変化" />
          <div style={{ fontSize: 12.5, color: c.DESC, lineHeight: 1.9 }}>{lastDiv.note}</div>
          <div style={{ fontSize: 10, color: c.DIM, marginTop: 6, letterSpacing: '0.06em' }}>
            {lastDiv.date}{lastDiv.skipped ? ' / 同期は見送り' : lastDiv.matched ? ' / 一致' : ' / 実態に合わせて修正'}
          </div>
        </div>
      )}

      {/* ── 成績 ── */}
      <div style={panel(c)}>
        <SectionTitle c={c} text={`PERFORMANCE / 成績（決着 ${closed.length} 件）`} />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, fontFamily: c.FONT }}>
            <thead>
              <tr>
                {['', '勝率', '期待値', '最大DD'].map(h => (
                  <th key={h} style={{ textAlign: h ? 'right' : 'left', padding: '5px 8px', fontSize: 10, color: c.DIM, fontWeight: 400, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Row c={c} name="ROBO / AI" data={st} strong />
              <Row c={c} name="BASELINE / 対照群" data={bl} />
            </tbody>
          </table>
        </div>
        <ProgressToJudgement c={c} n={closed.length} />
      </div>

      {/* ── 約定履歴 ── */}
      <div style={panel(c)}>
        <button
          onClick={() => setOpenLog(v => !v)}
          style={{
            width: '100%', textAlign: 'left', cursor: 'pointer', background: 'none', border: 'none',
            padding: 0, marginBottom: 10, fontFamily: c.FONT,
            fontSize: 11, fontWeight: 700, color: c.GREEN, letterSpacing: '0.12em',
          }}
        >
          ▌ TRADE LOG / 約定履歴（{account.trades.length}）{openLog ? ' ▲' : ' ▼'}
        </button>
        {account.trades.length === 0 ? (
          <div style={{ fontSize: 12.5, color: c.DESC }}>まだ約定はありません。</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recent.map(t => <TradeRow key={t.id} t={t} c={c} theme={theme} />)}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 部品 ──────────────────────────────────────────────

function Header({ c, status, live }: { c: ReturnType<typeof cy>; status: string; live?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      paddingBottom: 10, borderBottom: `1px solid ${c.BORDER}`, position: 'relative', zIndex: 1,
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" />
        <path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" />
      </svg>
      <span style={{ fontSize: 12, fontWeight: 700, color: c.GREEN, letterSpacing: '0.12em' }}>ROBO ACCOUNT</span>
      <span style={{ flex: 1 }} />
      <span className={live ? 'robo-pulse' : undefined} style={{
        width: 6, height: 6, borderRadius: '50%', background: c.GREEN, boxShadow: `0 0 6px ${c.GREEN}`,
      }} />
      <span style={{ fontSize: 10, color: c.DIM, letterSpacing: '0.14em' }}>{status}</span>
    </div>
  )
}

function SectionTitle({ c, text }: { c: ReturnType<typeof cy>; text: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: c.GREEN, letterSpacing: '0.12em', marginBottom: 12 }}>
      ▌ {text}
    </div>
  )
}

function Metric({ c, label, value, unit, sub, color, big }: {
  c: ReturnType<typeof cy>; label: string; value: string; unit?: string; sub?: string; color?: string; big?: boolean
}) {
  return (
    <div>
      <div style={{ fontSize: 9.5, color: c.DIM, letterSpacing: '0.1em' }}>{label}</div>
      <div style={{ marginTop: 3, display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{
          fontSize: big ? 22 : 16, fontWeight: 700,
          color: color ?? c.TXTCLR,
          textShadow: color ? `0 0 14px ${color}55` : undefined,
          letterSpacing: '0.02em',
        }}>{value}</span>
        {unit && <span style={{ fontSize: 10, color: c.DIM }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: 9.5, color: c.DIM, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function Row({ c, name, data, strong }: {
  c: ReturnType<typeof cy>
  name: string
  data?: { win_rate: number | null; expectancy: number | null; max_drawdown_pct: number | null } | null
  strong?: boolean
}) {
  const td: React.CSSProperties = {
    padding: '7px 8px', borderTop: `1px solid ${c.BORDER}`, textAlign: 'right', whiteSpace: 'nowrap',
    color: strong ? c.TXTCLR : c.DIM,
  }
  return (
    <tr>
      <td style={{ ...td, textAlign: 'left', color: strong ? c.GREEN : c.DIM, fontWeight: strong ? 700 : 400, fontSize: 11 }}>{name}</td>
      <td style={td}>{data?.win_rate == null ? '—' : `${Math.round(data.win_rate * 100)}%`}</td>
      <td style={td}>{data?.expectancy == null ? '—' : `${Math.round(data.expectancy).toLocaleString()}円`}</td>
      <td style={td}>{pct(data?.max_drawdown_pct)}</td>
    </tr>
  )
}

/** 判定（30件）までの進み具合をバーで見せる */
function ProgressToJudgement({ c, n }: { c: ReturnType<typeof cy>; n: number }) {
  const goal = 30
  const ratio = Math.min(1, n / goal)
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ height: 3, background: c.FAINT, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          width: `${ratio * 100}%`, height: '100%', background: c.GREEN,
          boxShadow: `0 0 8px ${c.GREEN}`, transition: 'width 0.6s ease',
        }} />
      </div>
      <div style={{ marginTop: 7, fontSize: 10, color: c.DIM, lineHeight: 1.8, letterSpacing: '0.04em' }}>
        判定は {goal} 件から{n < goal && `（あと ${goal - n} 件）`}。期待値がプラスで、かつ対照群を上回っていれば継続。<br />
        勝率34〜40%が正常です。<span style={{ color: c.NOTICE }}>勝率ではなく期待値とドローダウン</span>で見てください。
      </div>
    </div>
  )
}

function TradeRow({ t, c, theme }: { t: RoboTrade; c: ReturnType<typeof cy>; theme: 'dark' | 'light' }) {
  const isBuy = t.side === 'buy'
  const win = (t.pnl ?? 0) >= 0
  const accent = isBuy ? c.GREEN : (win ? (theme === 'dark' ? '#ff6b6b' : '#dc2626') : (theme === 'dark' ? '#4dabf7' : '#2563eb'))
  return (
    <div style={{ borderLeft: `2px solid ${accent}`, paddingLeft: 11 }}>
      <div style={{ fontSize: 11, color: c.DIM, letterSpacing: '0.04em' }}>
        {t.executed_on ?? t.decided_on}
        <span style={{ color: accent, fontWeight: 700, marginLeft: 8 }}>{isBuy ? 'OPEN' : 'CLOSE'}</span>
        <span style={{ marginLeft: 8, color: c.TXTCLR }}>{t.symbol} {symbolLabel(t.symbol)}</span>
        <span style={{ marginLeft: 8 }}>{t.qty}口 @{yen(t.price)}</span>
        {t.pnl != null && (
          <span style={{ marginLeft: 8, color: accent, fontWeight: 700 }}>
            {t.pnl >= 0 ? '+' : ''}{Math.round(t.pnl).toLocaleString()}円
          </span>
        )}
        {t.exit_reason === 'stop' && <span style={{ marginLeft: 6, color: c.NOTICE }}>[損切り]</span>}
        {t.exit_reason === 'sync' && <span style={{ marginLeft: 6, color: c.DIM }}>[実保有に同期]</span>}
      </div>
      {t.reason && <div style={{ fontSize: 12, marginTop: 4, color: c.DESC, lineHeight: 1.8 }}>{t.reason}</div>}
      {t.counter && (
        <div style={{ fontSize: 11, marginTop: 3, color: c.DIM, lineHeight: 1.8 }}>
          ▸ 外れる条件: {t.counter}
        </div>
      )}
      {t.confidence_pct != null && (
        <div style={{ fontSize: 10, marginTop: 3, color: c.DIM, letterSpacing: '0.06em' }}>CONFIDENCE {t.confidence_pct}%</div>
      )}
    </div>
  )
}

function panel(c: ReturnType<typeof cy>): React.CSSProperties {
  return {
    position: 'relative', zIndex: 1,
    border: `1px solid ${c.BORDER}`, borderRadius: 6,
    background: c.HDBG, padding: 14,
  }
}

/** ぽいロボ系の演出（ShieldView と同じ作り） */
function Keyframes() {
  return (
    <style>{`
      @keyframes robo-dust {
        0%   { transform: translate(0,0);        opacity: 0; }
        10%  { opacity: 0.55; }
        90%  { opacity: 0.55; }
        100% { transform: translate(28px,-46px); opacity: 0; }
      }
      .robo-dust {
        position: absolute; width: 2px; height: 2px; border-radius: 50%;
        background: rgba(0,229,255,0.7); box-shadow: 0 0 5px rgba(0,229,255,0.85);
        animation: robo-dust 11s linear infinite; pointer-events: none; z-index: 0;
      }
      @keyframes robo-scan {
        0%   { transform: translateY(-100%); }
        100% { transform: translateY(1400%); }
      }
      .robo-scan {
        position: absolute; left: 0; right: 0; height: 42px; top: 0;
        background: linear-gradient(180deg, transparent, rgba(0,229,255,0.05), transparent);
        animation: robo-scan 9s linear infinite; pointer-events: none; z-index: 0;
      }
      @keyframes robo-pulse {
        0%, 100% { opacity: 1;   box-shadow: 0 0 6px currentColor; }
        50%      { opacity: 0.4; box-shadow: 0 0 14px currentColor; }
      }
      .robo-pulse { animation: robo-pulse 1.8s ease-in-out infinite; }
      @keyframes robo-blink { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }
      .robo-blink { animation: robo-blink 1s step-end infinite; }
    `}</style>
  )
}
