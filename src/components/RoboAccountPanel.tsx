// ロボ口座（疑似トレード）の表示。
// 🔴 表示は管理者のみ（App.tsx 側で isAdminEmail によって出し分ける。設計書 §10.2）。
// 🔴 この画面は読むだけ。売買の操作はしない（書き込むのは GitHub Actions）。
import { useEffect, useState } from 'react'
import type React from 'react'
import {
  fetchRoboAccount, symbolLabel, equityOf, totalReturnPct,
  type RoboAccount, type RoboTrade,
} from '../utils/roboAccount'

type Props = { theme: 'dark' | 'light'; isMobile: boolean }

const yen = (v: number | null | undefined) =>
  v == null ? '—' : `${Math.round(v).toLocaleString()}円`
const pct = (v: number | null | undefined, digits = 1) =>
  v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(digits)}%`

export function RoboAccountPanel({ theme, isMobile }: Props) {
  const [account, setAccount] = useState<RoboAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [openLog, setOpenLog] = useState(false)

  useEffect(() => {
    let alive = true
    fetchRoboAccount()
      .then(a => { if (alive) { setAccount(a); setLoading(false) } })
      .catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const c = {
    text: 'var(--text)',
    sub: 'var(--text-sub)',
    dim: 'var(--text-dim)',
    border: 'var(--border-dim)',
    panel: theme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
    up: '#ef4444',
    down: '#3b82f6',
  }

  if (loading) {
    return <div style={{ ...s.wrap, color: c.dim }}>読み込み中…</div>
  }

  if (!account) {
    return (
      <div style={{ ...s.wrap, color: c.sub }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, color: c.text }}>ロボ口座</div>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8 }}>
          まだ記録がありません。<br />
          毎営業日の引け後に判断が実行されると、ここに建玉と成績が出ます。
        </p>
      </div>
    )
  }

  const pos = account.position
  const equity = equityOf(account)
  const ret = totalReturnPct(account)
  const st = account.stats
  const bl = st?.baseline ?? account.baseline

  const closed = account.trades.filter(t => t.side === 'sell')
  const recent = [...account.trades].reverse().slice(0, openLog ? 100 : 5)

  return (
    <div style={{ ...s.wrap, color: c.text }}>
      {/* ── 上部: 合計損益 ── */}
      <div style={{ ...s.card, background: c.panel, borderColor: c.border }}>
        <div style={{ display: 'flex', gap: isMobile ? 16 : 32, flexWrap: 'wrap' }}>
          <Stat label="評価額" value={yen(equity)} />
          <Stat label="累計損益" value={pct(ret, 2)} color={ret >= 0 ? c.up : c.down} />
          <Stat label="現金" value={yen(account.cash)} />
          <Stat label="判断器" value={account.decider?.type === 'llm' ? `AI（${account.decider.model ?? '—'}）` : '対照群'} small />
        </div>
        {account.generated_at && (
          <div style={{ marginTop: 8, fontSize: 11, color: c.dim }}>
            最終更新: {new Date(account.generated_at).toLocaleString('ja-JP')}
          </div>
        )}
      </div>

      {/* ── メイン: 建玉 ── */}
      <div style={{ ...s.card, background: c.panel, borderColor: c.border }}>
        <div style={s.head}>建玉</div>
        {pos && pos.qty > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 12 }}>
            <Stat label="銘柄" value={`${pos.symbol}`} sub={symbolLabel(pos.symbol)} />
            <Stat label="数量" value={`${pos.qty}口`} />
            <Stat label="平均取得" value={yen(pos.avg_price)} />
            <Stat label="損切り" value={yen(pos.stop_price)} sub={pos.stop_rule ?? undefined} />
          </div>
        ) : (
          <div style={{ fontSize: 13, color: c.sub }}>
            保有なし
            <div style={{ fontSize: 11, color: c.dim, marginTop: 4 }}>
              半分以上の日は持たないのが、この戦略の正常な姿です。
            </div>
          </div>
        )}
      </div>

      {/* ── 成績（ロボ vs 対照群）── */}
      <div style={{ ...s.card, background: c.panel, borderColor: c.border }}>
        <div style={s.head}>成績（決着した {st?.closed_trades ?? 0} 件）</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}></th>
                <th style={s.th}>勝率</th>
                <th style={s.th}>期待値</th>
                <th style={s.th}>最大DD</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...s.td, fontWeight: 700 }}>ロボ（AI）</td>
                <td style={s.td}>{st?.win_rate == null ? '—' : `${Math.round(st.win_rate * 100)}%`}</td>
                <td style={s.td}>{yen(st?.expectancy)}</td>
                <td style={s.td}>{pct(st?.max_drawdown_pct)}</td>
              </tr>
              <tr>
                <td style={{ ...s.td, color: c.sub }}>対照群（決定論）</td>
                <td style={{ ...s.td, color: c.sub }}>{bl?.win_rate == null ? '—' : `${Math.round(bl.win_rate * 100)}%`}</td>
                <td style={{ ...s.td, color: c.sub }}>{yen(bl?.expectancy)}</td>
                <td style={{ ...s.td, color: c.sub }}>{pct(bl?.max_drawdown_pct)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: c.dim, lineHeight: 1.8 }}>
          🔴 判定は <b>30件</b>から。期待値がプラスで、かつ対照群を上回っていれば継続。
          {closed.length < 30 && <>（あと {30 - closed.length} 件）</>}
          <br />
          勝率34〜40%が正常です。勝率ではなく<b>期待値とドローダウン</b>で見てください。
        </div>
      </div>

      {/* ── 下部: 約定履歴 ── */}
      <div style={{ ...s.card, background: c.panel, borderColor: c.border }}>
        <button
          onClick={() => setOpenLog(v => !v)}
          style={{ ...s.head, width: '100%', textAlign: 'left', cursor: 'pointer', background: 'none', border: 'none', color: 'inherit', padding: 0 }}
        >
          約定履歴（{account.trades.length}件）{openLog ? ' ▲' : ' ▼'}
        </button>
        {account.trades.length === 0 ? (
          <div style={{ fontSize: 13, color: c.sub }}>まだ約定はありません。</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
            {recent.map(t => <TradeRow key={t.id} t={t} c={c} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function TradeRow({ t, c }: { t: RoboTrade; c: Record<string, string> }) {
  const isBuy = t.side === 'buy'
  return (
    <div style={{ borderLeft: `3px solid ${isBuy ? c.up : c.down}`, paddingLeft: 10 }}>
      <div style={{ fontSize: 12, color: c.sub }}>
        {t.executed_on ?? t.decided_on}
        <b style={{ color: isBuy ? c.up : c.down }}>{isBuy ? '新規' : '手仕舞い'}</b>
        {t.symbol} {symbolLabel(t.symbol)} / {t.qty}口 @{yen(t.price)}
        {t.pnl != null && (
          <span style={{ marginLeft: 8, color: t.pnl >= 0 ? c.up : c.down }}>
            {t.pnl >= 0 ? '+' : ''}{Math.round(t.pnl).toLocaleString()}円
          </span>
        )}
        {t.exit_reason === 'stop' && <span style={{ marginLeft: 6, color: c.down }}>（損切り）</span>}
      </div>
      {t.reason && <div style={{ fontSize: 12, marginTop: 3, lineHeight: 1.7 }}>{t.reason}</div>}
      {t.counter && (
        <div style={{ fontSize: 11, marginTop: 3, color: c.dim, lineHeight: 1.7 }}>
          外れる条件: {t.counter}
        </div>
      )}
      {t.confidence_pct != null && (
        <div style={{ fontSize: 11, marginTop: 2, color: c.dim }}>確信度 {t.confidence_pct}%</div>
      )}
    </div>
  )
}

function Stat({ label, value, sub, color, small }: {
  label: string; value: string; sub?: string; color?: string; small?: boolean
}) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{label}</div>
      <div style={{ fontSize: small ? 13 : 18, fontWeight: 700, color: color ?? 'inherit', marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap: { flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 },
  card: { border: '1px solid', borderRadius: 10, padding: 14 },
  head: { fontSize: 13, fontWeight: 700, marginBottom: 10 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '6px 10px', fontSize: 11, color: 'var(--text-dim)', fontWeight: 500, whiteSpace: 'nowrap' },
  td: { padding: '6px 10px', borderTop: '1px solid var(--border-dim)', whiteSpace: 'nowrap' },
}
