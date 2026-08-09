// ロボ口座（疑似トレード）の表示。
// 🔴 表示は管理者のみ（ShieldView 側で isAdminEmail によって出し分ける。設計書 §10.2）。
// 🔴 この画面は読むだけ。売買の操作はしない（書き込むのは GitHub Actions）。
// 🔵 配色・演出は ぽいロボ系（サイバー調・シアン）に揃える。cyberTheme の cy() を使う。
import { useEffect, useState } from 'react'
import type React from 'react'
import { cy } from '../utils/cyberTheme'
import {
  fetchRoboAccount, symbolLabel, equityOf, totalReturnPct, followVsDiverge,
  ROBO_SYMBOLS, type RoboAccount, type RoboTrade, type FollowStat,
} from '../utils/roboAccount'
import { demoMode, demoAccount } from '../utils/roboDemo'

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
    // 🔵 デザイン確認用のデモモード（開発時のみ・?demo=1 / empty / loss）。
    //    本番ビルドでは demoMode() が常に null を返すのでこの枝は落ちる。
    const mode = demoMode()
    if (mode) {
      setAccount(demoAccount(mode))
      setLoading(false)
      return
    }
    fetchRoboAccount()
      .then(a => { if (alive) { setAccount(a); setLoading(false) } })
      .catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  // 🔵 デスクトップは3カラム（口座の状態／成績・資産推移／約定履歴）で、**画面内に収める**。
  //    他ページ（環境・現物など）と同じ3列構成。スクロールするのは約定履歴だけ。
  //    モバイルは従来どおり縦1本スクロール。
  const outer: React.CSSProperties = {
    flex: 1, minHeight: 0, position: 'relative',
    background: c.BG, backgroundImage: c.SCAN,
    display: 'flex', flexDirection: isMobile ? 'column' : 'row',
    overflow: isMobile ? 'auto' : 'hidden',
    fontFamily: c.FONT,
  }
  const col = (grow: number): React.CSSProperties => ({
    flex: isMobile ? 'none' : grow, minWidth: 0, minHeight: 0,
    // 🔴 デスクトップではカラム自体はスクロールさせない（画面内に収める）
    overflow: isMobile ? 'visible' : 'hidden',
    padding: isMobile ? 14 : 16,
    display: 'flex', flexDirection: 'column', gap: isMobile ? 14 : 10,
  })
  const divider: React.CSSProperties = isMobile
    ? { borderTop: `1px solid ${c.BORDER}` }
    : { borderLeft: `1px solid ${c.BORDER}` }
  const rightCol: React.CSSProperties = {
    ...col(1), ...divider,
    flex: isMobile ? 'none' : '0 0 400px',
  }
  // ローディング／未生成のときは1カラムで十分
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
  const fvd = followVsDiverge(account)

  return (
    <div style={outer}>
      <Keyframes />
      {theme === 'dark' && <>
        <div className="robo-dust" style={{ top: '18%', left: '12%', animationDelay: '0s' }} />
        <div className="robo-dust" style={{ top: '62%', left: '78%', animationDelay: '2.5s' }} />
        <div className="robo-dust" style={{ top: '40%', left: '46%', animationDelay: '5s' }} />
        <div className="robo-scan" />
      </>}

      {/* ══ 第1カラム: 口座の状態 ══ */}
      <div style={col(1)}>
      <Header c={c} status={pos ? 'IN POSITION' : 'NO POSITION'} live={!!pos} />

      {/* ── 評価額 ── */}
      <div className="robo-rise" style={panel(c, 0)}>
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
      <div className="robo-rise" style={panel(c, 70)}>
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

        {/* 直近の同期（あなたが実際にどう動いたか）*/}
        {lastDiv && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${c.BORDER}` }}>
            <div style={{ fontSize: 9.5, color: c.DIM, letterSpacing: '0.1em', marginBottom: 5 }}>
              LAST SYNC / あなたの保有の変化
              <span style={{ marginLeft: 8 }}>
                {lastDiv.date}{lastDiv.skipped ? ' · 同期は見送り' : lastDiv.matched ? ' · 一致' : ' · 実態に合わせて修正'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: c.DESC, lineHeight: 1.8 }}>{lastDiv.note}</div>
          </div>
        )}
      </div>

      {/* ── 資産推移（第1カラムの残りを埋める）── */}
      <div className="robo-rise" style={{ ...panel(c, 280), flex: isMobile ? 'none' : 1, minHeight: isMobile ? 140 : 0, display: 'flex', flexDirection: 'column' }}>
        <SectionTitle c={c} text="EQUITY CURVE / 資産推移" />
        <EquityCurve c={c} points={account.equity_curve} initial={account.initial_cash} theme={theme} />
      </div>
      </div>{/* /第1カラム */}

      {/* ══ 第2カラム: 成績 ══ */}
      <div style={{ ...col(1), ...divider }}>

      {/* ── 成績（対照群比較 ＋ 従った/外した を1枚に）── */}
      <div className="robo-rise" style={panel(c, 140)}>
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

      {/* ── 🔴 あなたの介入は効いているか（第2カラムの残りを埋める）── */}
      <div className="robo-rise" style={{ ...panel(c, 210), flex: isMobile ? 'none' : 1, minHeight: 0, overflowY: 'auto' }}>
        <SectionTitle c={c} text="YOUR CALL / 従った時 vs 外した時" />
        <FollowPanel c={c} data={fvd} theme={theme} />
      </div>
      </div>{/* /第2カラム */}

      {/* ══ 右カラム: 約定履歴（ここだけスクロールする）══ */}
      <div style={rightCol}>
        <div style={{
          position: 'relative', zIndex: 1, flexShrink: 0,
          fontSize: 11, fontWeight: 700, color: c.GREEN, letterSpacing: '0.12em',
          paddingBottom: 10, marginBottom: 12, borderBottom: `1px solid ${c.BORDER}`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>▌ TRADE LOG / 約定履歴</span>
          <span style={{ color: c.DIM, fontWeight: 400 }}>{account.trades.length}</span>
          <span style={{ flex: 1 }} />
          {account.trades.length > 5 && (
            <button
              onClick={() => setOpenLog(v => !v)}
              style={{
                cursor: 'pointer', background: 'none', border: `1px solid ${c.BORDER}`,
                borderRadius: 3, padding: '2px 8px', fontFamily: c.FONT,
                fontSize: 9.5, color: c.DIM, letterSpacing: '0.08em',
              }}
            >{openLog ? '直近5件' : 'すべて'}</button>
          )}
        </div>
        {account.trades.length === 0 ? (
          <div style={{ fontSize: 12.5, color: c.DESC, position: 'relative', zIndex: 1 }}>まだ約定はありません。</div>
        ) : (
          <div style={{
            position: 'relative', zIndex: 1,
            flex: 1, minHeight: 0, overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 14,
            paddingRight: 4,
          }}>
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

/**
 * 「AIに従った時」vs「外した時」。
 * 🔴 対照群比較が「AIは決定論ルールより上手いか」なら、こちらは
 *    **あなたの介入は効いているか**を測る。今日の同期仕様があるから出せる数字。
 */
function FollowPanel({ c, data, theme }: {
  c: ReturnType<typeof cy>
  data: ReturnType<typeof followVsDiverge>
  theme: 'dark' | 'light'
}) {
  const { followed, diverged } = data
  const up = theme === 'dark' ? '#ff6b6b' : '#dc2626'
  const down = theme === 'dark' ? '#4dabf7' : '#2563eb'

  if (!followed && !diverged) {
    return (
      <div style={{ fontSize: 11.5, color: c.DIM, lineHeight: 1.9 }}>
        まだ判定できません。<br />
        売買してキャプチャを投げるたびに、AIの判断どおりだったか／外したかが記録され、
        その後の成績がここに出ます。
      </div>
    )
  }

  const total = (followed?.n ?? 0) + (diverged?.n ?? 0)
  const cell = (s: FollowStat | null) => (
    <>
      <td style={{ ...tdBase(c), color: s ? (s.avgReturnPct >= 0 ? up : down) : c.DIM, fontWeight: 700 }}>
        {s ? `${s.avgReturnPct > 0 ? '+' : ''}${s.avgReturnPct.toFixed(2)}%` : '—'}
      </td>
      <td style={tdBase(c)}>{s ? `${Math.round(s.winRate * 100)}%` : '—'}</td>
      <td style={tdBase(c)}>{s ? `${s.n}回` : '—'}</td>
    </>
  )

  // どちらが良かったかの一言
  let verdict: { text: string; color: string } | null = null
  if (followed && diverged && total >= 4) {
    const d = followed.avgReturnPct - diverged.avgReturnPct
    verdict = Math.abs(d) < 0.3
      ? { text: 'いまのところ差はほとんどありません。', color: c.DIM }
      : d > 0
        ? { text: `AIに従ったほうが平均 ${d.toFixed(2)}ポイント良い結果でした。`, color: c.NOTICE }
        : { text: `あなたが外したほうが平均 ${Math.abs(d).toFixed(2)}ポイント良い結果でした。`, color: c.NOTICE }
  }

  return (
    <>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, fontFamily: c.FONT }}>
        <thead>
          <tr>
            {['', '平均リターン', '勝率', '回数'].map(h => (
              <th key={h} style={{ textAlign: h ? 'right' : 'left', padding: '5px 8px', fontSize: 10, color: c.DIM, fontWeight: 400, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...tdBase(c), textAlign: 'left', color: c.GREEN, fontWeight: 700, fontSize: 11 }}>AIに従った</td>
            {cell(followed)}
          </tr>
          <tr>
            <td style={{ ...tdBase(c), textAlign: 'left', color: c.DIM, fontSize: 11 }}>自分で外した</td>
            {cell(diverged)}
          </tr>
        </tbody>
      </table>
      <div style={{ marginTop: 8, fontSize: 10, color: verdict?.color ?? c.DIM, lineHeight: 1.8 }}>
        {verdict?.text}
        {total < 4 && <>まだ {total} 回ぶんしかありません。<b>数回では判断できません</b>。</>}
      </div>

      {/* 区間の内訳（何をした結果そうなったのか、を追えるようにする）*/}
      {data.segments.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${c.BORDER}` }}>
          <div style={{ fontSize: 9.5, color: c.DIM, letterSpacing: '0.1em', marginBottom: 8 }}>
            SEGMENTS / 区間の内訳
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {[...data.segments].reverse().map(s => (
              <div key={`${s.from}-${s.to}`} style={{
                borderLeft: `2px solid ${s.followed ? c.BORDBR : c.BORDER}`,
                paddingLeft: 9,
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 9.5, color: c.DIM, letterSpacing: '0.06em' }}>
                  <span>{s.from} → {s.to}</span>
                  <span style={{ color: s.followed ? c.GREEN : c.DIM }}>
                    {s.followed ? 'AIに従った' : '自分で外した'}
                  </span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: s.returnPct >= 0 ? up : down }}>
                    {s.returnPct > 0 ? '+' : ''}{s.returnPct.toFixed(2)}%
                  </span>
                </div>
                <div style={{ fontSize: 11, color: c.DESC, lineHeight: 1.7, marginTop: 2 }}>{s.note}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function tdBase(c: ReturnType<typeof cy>): React.CSSProperties {
  return {
    padding: '7px 8px', borderTop: `1px solid ${c.BORDER}`,
    textAlign: 'right', whiteSpace: 'nowrap', color: c.TXTCLR,
  }
}

/**
 * 資産推移。SVG で描く軽いスパークライン。
 * 🔵 ダイナミックに見せるため、面のグラデーション・線のグロー・先端の脈動を入れる。
 */
function EquityCurve({ c, points, initial, theme }: {
  c: ReturnType<typeof cy>
  points: { date: string; equity: number }[]
  initial: number
  theme: 'dark' | 'light'
}) {
  if (!points?.length) {
    return <div style={{ fontSize: 11, color: c.DIM }}>まだデータがありません。</div>
  }

  const W = 1000, H = 200, PAD = 6
  const vals = points.map(p => p.equity)
  const lo = Math.min(...vals, initial)
  const hi = Math.max(...vals, initial)
  const span = hi - lo || 1
  const x = (i: number) => (points.length === 1 ? W / 2 : PAD + (i / (points.length - 1)) * (W - PAD * 2))
  const y = (v: number) => PAD + (1 - (v - lo) / span) * (H - PAD * 2)

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.equity).toFixed(1)}`).join(' ')
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`
  const baseY = y(initial)

  const last = points[points.length - 1]
  const up = last.equity >= initial
  const stroke = up ? (theme === 'dark' ? '#ff6b6b' : '#dc2626') : (theme === 'dark' ? '#4dabf7' : '#2563eb')
  const id = up ? 'roboGradUp' : 'roboGradDown'

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
        style={{ width: '100%', flex: 1, minHeight: 90, overflow: 'visible' }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
          <filter id="roboGlow" x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* 元本のライン */}
        <line x1="0" y1={baseY} x2={W} y2={baseY} stroke={c.BORDER} strokeWidth="1" strokeDasharray="4 5" />
        {/* 面 */}
        <path d={area} fill={`url(#${id})`} />
        {/* 線 */}
        <path d={line} fill="none" stroke={stroke} strokeWidth="2.5"
          strokeLinejoin="round" strokeLinecap="round" filter="url(#roboGlow)"
          className="robo-draw" vectorEffect="non-scaling-stroke" />
        {/* 先端 */}
        <circle cx={x(points.length - 1)} cy={y(last.equity)} r="4"
          fill={stroke} className="robo-pulse" style={{ color: stroke }} />
      </svg>
      <div style={{
        display: 'flex', justifyContent: 'space-between', flexShrink: 0,
        fontSize: 9.5, color: c.DIM, letterSpacing: '0.06em', marginTop: 6,
      }}>
        <span>{points[0].date}</span>
        <span style={{ color: c.DIM }}>元本 {Math.round(initial).toLocaleString()}円</span>
        <span>{last.date}</span>
      </div>
    </div>
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

function panel(c: ReturnType<typeof cy>, delay = 0): React.CSSProperties {
  return {
    position: 'relative', zIndex: 1,
    border: `1px solid ${c.BORDER}`, borderRadius: 6,
    background: c.HDBG, padding: 14,
    animationDelay: `${delay}ms`,
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

      /* 資産推移の線を左から引く */
      @keyframes robo-draw { from { stroke-dashoffset: 2400; } to { stroke-dashoffset: 0; } }
      .robo-draw { stroke-dasharray: 2400; animation: robo-draw 1.6s ease-out both; }

      /* パネルの入場（下から浮かせる）。時差をつけて順に出す */
      @keyframes robo-rise {
        from { opacity: 0; transform: translate3d(0, 10px, 0); }
        to   { opacity: 1; transform: none; }
      }
      .robo-rise { animation: robo-rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both; }

      /* 数値のグロー（評価額など主役の数字） */
      @keyframes robo-sheen {
        0%, 100% { opacity: 1; }
        50%      { opacity: 0.82; }
      }
      .robo-sheen { animation: robo-sheen 3.4s ease-in-out infinite; }

      @media (prefers-reduced-motion: reduce) {
        .robo-dust, .robo-scan, .robo-pulse, .robo-draw, .robo-rise, .robo-sheen {
          animation: none !important;
        }
      }
    `}</style>
  )
}
