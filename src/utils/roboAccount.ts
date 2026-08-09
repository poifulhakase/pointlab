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

/** 評価額（現金＋建玉の時価）。現在値が無ければ簿価で代用する */
export function equityOf(a: RoboAccount, lastPrice?: number | null): number {
  if (!a.position || !a.position.qty) return a.cash
  const px = lastPrice ?? a.position.avg_price
  return a.cash + a.position.qty * px
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
