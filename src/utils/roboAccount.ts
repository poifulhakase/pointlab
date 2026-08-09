// ロボ口座（疑似トレード）の読み込み。
// 🔴 書き込みはしない。robo_account.json を書くのは GitHub Actions（scripts/robo-trade.mjs）だけ。
import { fetchWithCache } from './dataCache'

export type RoboTrade = {
  id: string
  decided_on: string
  executed_on: string
  side: 'buy' | 'sell'
  symbol: string
  qty: number
  price: number
  entry_price?: number
  pnl?: number
  confidence_pct?: number | null
  reason?: string | null
  counter?: string | null
  stop_price?: number | null
  stop_rule?: string | null
  exit_reason?: string
}

export type RoboPosition = {
  symbol: string
  qty: number
  avg_price: number
  stop_price: number | null
  stop_rule?: string | null
  opened_on?: string
}

export type RoboStats = {
  closed_trades: number
  win_rate: number | null
  expectancy: number | null
  max_drawdown_pct: number | null
  stop_then_reversed?: number
  baseline?: {
    win_rate: number | null
    expectancy: number | null
    max_drawdown_pct: number | null
  } | null
}

export type RoboDivergence = {
  date: string
  source_file_id: string | null
  /** 同期時点の評価額。「従った期間」「外した期間」のリターン計算に使う */
  equity?: number
  matched: boolean
  skipped?: boolean
  kind?: 'none' | 'same' | 'increased' | 'decreased' | 'closed' | 'opened' | 'switched'
  delta?: number
  note: string
}

export type RoboAccount = {
  generated_at: string | null
  logic_version: string
  decider: { type: string; model?: string; effort?: string } | null
  universe: string[]
  initial_cash: number
  cash: number
  trades: RoboTrade[]
  position: RoboPosition | null
  equity_curve: { date: string; equity: number }[]
  stats: RoboStats
  baseline: RoboStats | null
  divergences?: RoboDivergence[]
  last_synced_file_id?: string | null
}

const CACHE_KEY = 'poical-robo-account-v1'
const TTL = 30 * 60 * 1000

/** 銘柄コード → 表示名（設計書 §0.1 の4本） */
export const ROBO_SYMBOLS: Record<string, { label: string; side: 'bull' | 'bear'; leverage: 1 | 2 }> = {
  1321: { label: '日経225連動（ブル1倍）', side: 'bull', leverage: 1 },
  1570: { label: '日経レバレッジ（ブル2倍）', side: 'bull', leverage: 2 },
  1571: { label: '日経インバース（ベア1倍）', side: 'bear', leverage: 1 },
  1357: { label: '日経ダブルインバース（ベア2倍）', side: 'bear', leverage: 2 },
}

export function symbolLabel(code: string): string {
  return ROBO_SYMBOLS[code]?.label ?? code
}

export async function fetchRoboAccount(force = false): Promise<RoboAccount | null> {
  try {
    return await fetchWithCache<RoboAccount>({
      key: CACHE_KEY,
      ttl: TTL,
      force,
      fetcher: async () => {
        const res = await fetch(`${import.meta.env.BASE_URL}data/robo_account.json`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as RoboAccount
        return { data, updatedAt: data.generated_at ?? undefined }
      },
    })
  } catch {
    return null   // まだ生成されていない期間は静かに何も出さない
  }
}

/**
 * 評価額（現金＋建玉の時価）。
 * 🔴 現在値を渡さない場合は equity_curve の最新値を使う。
 *    建玉を簿価で評価すると含み損益がゼロに見えてしまうため
 *    （robo-trade.mjs が毎日、現在値で計算して equity_curve に積んでいる）。
 */
export function equityOf(a: RoboAccount, lastPrice?: number | null): number {
  if (lastPrice == null) {
    const snap = a.equity_curve?.[a.equity_curve.length - 1]
    if (snap?.equity != null) return snap.equity
  }
  if (!a.position || !a.position.qty) return a.cash
  return a.cash + a.position.qty * (lastPrice ?? a.position.avg_price)
}

/** 累計損益率 */
export function totalReturnPct(a: RoboAccount, lastPrice?: number | null): number {
  if (!a.initial_cash) return 0
  return (equityOf(a, lastPrice) / a.initial_cash - 1) * 100
}

/** 建玉の含み損益 */
export function unrealizedPnl(a: RoboAccount, lastPrice?: number | null): number | null {
  if (!a.position || !a.position.qty || lastPrice == null) return null
  return (lastPrice - a.position.avg_price) * a.position.qty
}

// ── 「AIに従った時」vs「外した時」の成績 ──────────────────────────────────
//
// 🔴 これは対照群比較と並ぶ、もう一つの答え合わせ。
//    対照群比較 = AIは決定論ルールより上手いか
//    これ       = **あなたの介入は効いているか**
//
// 仕組み: 同期のたびに divergences へ「AIの建玉」「実際の建玉」「その時点の評価額」が残る。
//    同期から次の同期までを1区間とし、区間の頭で
//      matched（AIの判断どおりだった）  → 「従った区間」
//      matched でない（あなたが外した）  → 「外した区間」
//    に振り分けて、区間リターンを比べる。

export type FollowStat = { n: number; avgReturnPct: number; winRate: number; totalPct: number }
export type FollowVsDiverge = {
  followed: FollowStat | null
  diverged: FollowStat | null
  segments: { from: string; to: string; followed: boolean; returnPct: number; note: string }[]
}

function equityOn(a: RoboAccount, date: string): number | null {
  const curve = a.equity_curve ?? []
  if (!curve.length) return null
  // その日以前で最も新しい点を採る（同期日が営業日スナップショットと一致しないことがある）
  let best: { date: string; equity: number } | null = null
  for (const p of curve) {
    if (p.date <= date && (!best || p.date > best.date)) best = p
  }
  return best?.equity ?? curve[0].equity
}

export function followVsDiverge(a: RoboAccount): FollowVsDiverge {
  const divs = (a.divergences ?? []).filter(d => !d.skipped)
  const curve = a.equity_curve ?? []
  const lastDate = curve.length ? curve[curve.length - 1].date : null

  const segments: FollowVsDiverge['segments'] = []
  for (let i = 0; i < divs.length; i++) {
    const from = divs[i]
    const toDate = divs[i + 1]?.date ?? lastDate
    if (!toDate || toDate <= from.date) continue

    const e0 = from.equity ?? equityOn(a, from.date)
    const e1 = equityOn(a, toDate)
    if (e0 == null || e1 == null || e0 <= 0) continue

    segments.push({
      from: from.date, to: toDate,
      followed: !!from.matched,
      returnPct: (e1 / e0 - 1) * 100,
      note: from.note,
    })
  }

  const agg = (list: typeof segments): FollowStat | null => {
    if (!list.length) return null
    const total = list.reduce((s, x) => s + x.returnPct, 0)
    return {
      n: list.length,
      avgReturnPct: total / list.length,
      winRate: list.filter(x => x.returnPct > 0).length / list.length,
      totalPct: total,
    }
  }

  return {
    followed: agg(segments.filter(s => s.followed)),
    diverged: agg(segments.filter(s => !s.followed)),
    segments,
  }
}
