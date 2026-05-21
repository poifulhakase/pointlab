// CFTC COT 日経225先物ポジションデータ
// データソース: /data/cot_nikkei.json (scripts/fetch-jpx.mjs で生成)
// 元データ: CFTC Legacy Financial Futures Only Report（週次・火曜基準・金曜公表・約3〜4日遅延）
// 3区分: Non-Commercial(投機筋) / Commercial(ヘッジャー) / Non-Reportable(小口)

import { fetchWithCache } from './dataCache'

export interface CotNikkeiWeekData {
  date:         string  // "2026-05-06" (火曜日基準日)
  label:        string  // "5月第2週"
  openInterest: number
  nonCommLong:  number
  nonCommShort: number
  nonCommNet:   number  // Long - Short
  commLong:     number
  commShort:    number
  commNet:      number
  nonReptLong:  number
  nonReptShort: number
  nonReptNet:   number
}

export interface CotVectors {
  nonComm:  { net: number; direction: 'bull' | 'bear' | 'neutral'; wow: number | null }
  comm:     { net: number; direction: 'bull' | 'bear' | 'neutral'; wow: number | null }
  nonRept:  { net: number; direction: 'bull' | 'bear' | 'neutral'; wow: number | null }
  sellPressureScore: number   // 0-100: NC売り越し圧力（高いほどベア寄り）
  scorePercentile:   number   // 過去N週中の百分位（高いほど売り圧力が強い）
  scoreMedian:       number   // 過去NC Netの中央値
  historyWeeks:      number
  alertLevel:        'green' | 'yellow' | 'orange' | 'red'
}

const CACHE_KEY = 'poical-cot-nikkei-v1'
const CACHE_TTL = 24 * 60 * 60 * 1000

export async function fetchCotNikkeiData(force = false): Promise<CotNikkeiWeekData[]> {
  return fetchWithCache({
    key: CACHE_KEY, ttl: CACHE_TTL, force, checkUpdatedAt: true,
    fetcher: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}data/cot_nikkei.json`, { signal: AbortSignal.timeout(10000), cache: 'no-cache' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as { updatedAt: string; data: CotNikkeiWeekData[] }
      if (!json.data?.length) throw new Error('データが空です')
      return { data: json.data, updatedAt: json.updatedAt }
    },
  })
}

function direction(net: number): 'bull' | 'bear' | 'neutral' {
  if (net > 5000)  return 'bull'
  if (net < -5000) return 'bear'
  return 'neutral'
}

export function calcCotVectors(data: CotNikkeiWeekData[]): CotVectors | null {
  if (data.length < 2) return null
  const cur  = data[0]
  const prev = data[1]

  // 売り圧力スコア: NC Short / OI * 100（0〜100）
  const score = cur.openInterest > 0
    ? Math.round(cur.nonCommShort / cur.openInterest * 10000) / 100
    : 0

  // 過去52週の百分位
  const scores = data.slice(0, 52).map(d =>
    d.openInterest > 0 ? d.nonCommShort / d.openInterest * 100 : 0
  )
  const sorted   = [...scores].sort((a, b) => a - b)
  const rank     = sorted.filter(s => s < score).length
  const pct      = Math.round(rank / sorted.length * 100)
  const median   = sorted[Math.floor(sorted.length / 2)] ?? 0

  const alertLevel: CotVectors['alertLevel'] =
    pct >= 75 ? 'red' : pct >= 55 ? 'orange' : pct >= 35 ? 'yellow' : 'green'

  return {
    nonComm:  { net: cur.nonCommNet,  direction: direction(cur.nonCommNet),  wow: cur.nonCommNet  - prev.nonCommNet  },
    comm:     { net: cur.commNet,     direction: direction(cur.commNet),     wow: cur.commNet     - prev.commNet     },
    nonRept:  { net: cur.nonReptNet,  direction: direction(cur.nonReptNet),  wow: cur.nonReptNet  - prev.nonReptNet  },
    sellPressureScore: score,
    scorePercentile:   pct,
    scoreMedian:       Math.round(median * 100) / 100,
    historyWeeks:      scores.length,
    alertLevel,
  }
}
