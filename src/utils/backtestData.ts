const BASE = import.meta.env.BASE_URL + 'data/backtest_results.json'

export type WeeklyEntry = {
  week: string
  tev: number | null
  status: string | null
  confidence: number | null
  decay: number | null
  signal: 'bull' | 'bear' | 'neutral'
  nk_close: number | null
  price_change_pct: number | null
  win: boolean | null
}

type ConfBucket = {
  label: string
  n: number
  wins: number
  win_rate: number | null
}

type StatusBucket = {
  n: number
  wins: number
  win_rate: number | null
}

export type BacktestSummary = {
  total_weeks: number
  signal_weeks: number
  bull_signals: number
  bear_signals: number
  neutral_signals: number
  bull_wins: number
  bear_wins: number
  bull_win_rate: number | null
  bear_win_rate: number | null
  overall_win_rate: number | null
  by_status: Record<string, StatusBucket>
  by_confidence: { high: ConfBucket; mid: ConfBucket }
}

export type BacktestResult = {
  computed_at: string
  data_range: { from: string | null; to: string | null }
  notes: string[]
  summary: BacktestSummary
  weekly_log: WeeklyEntry[]
}

let cache: BacktestResult | null = null

export async function fetchBacktestResult(): Promise<BacktestResult | null> {
  if (cache) return cache
  try {
    const res = await fetch(BASE + '?t=' + Date.now())
    if (!res.ok) return null
    cache = await res.json() as BacktestResult
    return cache
  } catch {
    return null
  }
}
