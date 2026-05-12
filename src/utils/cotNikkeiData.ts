// CFTC COT 日経225先物ポジションデータ
// データソース: /data/cot_nikkei.json (scripts/fetch-jpx.mjs で生成)
// 元データ: CFTC Legacy Financial Futures Only Report（週次・火曜基準・金曜公表・約3〜4日遅延）
// 3区分: Non-Commercial(投機筋) / Commercial(ヘッジャー) / Non-Reportable(小口)

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

interface CachedResponse {
  updatedAt: string
  data: CotNikkeiWeekData[]
}

const CACHE_KEY = 'poical-cot-nikkei-v1'
const CACHE_TTL = 24 * 60 * 60 * 1000

interface LocalCache {
  updatedAt: string
  data:      CotNikkeiWeekData[]
  fetchedAt: number
}

function writeCache(updatedAt: string, data: CotNikkeiWeekData[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ updatedAt, data, fetchedAt: Date.now() }))
  } catch { /* ignore */ }
}

export async function fetchCotNikkeiData(force = false): Promise<CotNikkeiWeekData[]> {
  let stale: CotNikkeiWeekData[] | null = null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const c = JSON.parse(raw) as LocalCache
      stale = c.data
      if (!force && Date.now() - c.fetchedAt <= CACHE_TTL) return c.data
    }
  } catch { /* ignore */ }

  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/cot_nikkei.json`, {
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json: CachedResponse = await res.json()
    if (!json.data || json.data.length === 0) throw new Error('データが空です')
    writeCache(json.updatedAt, json.data)
    return json.data
  } catch (e) {
    if (stale) return stale
    throw e
  }
}

function direction(net: number): 'bull' | 'bear' | 'neutral' {
  if (net > 5000)  return 'bull'
  if (net < -5000) return 'bear'
  return 'neutral'
}

const COT_HISTORY_WEEKS = 26

export function computeCotVectors(data: CotNikkeiWeekData[]): CotVectors | null {
  if (data.length === 0) return null
  const cur  = data[0]
  const prev = data[1] ?? null

  const history  = data.slice(0, COT_HISTORY_WEEKS)
  const ncNets   = history.map(d => d.nonCommNet)
  const curNcNet = ncNets[0]

  // scorePercentile: 現在のNC Netが過去何%より低いか（低い=売り越し寄り=高い売り圧力）
  const pastNcNets = ncNets.slice(1)
  const bullPct = pastNcNets.length > 0
    ? Math.round(pastNcNets.filter(n => n < curNcNet).length / pastNcNets.length * 100)
    : 50
  const sellPressureScore = 100 - bullPct

  const sorted = [...pastNcNets].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const scoreMedian = sorted.length > 0
    ? (sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid])
    : 0

  const alertLevel = (
    sellPressureScore >= 85 ? 'red'    :
    sellPressureScore >= 65 ? 'orange' :
    sellPressureScore >= 50 ? 'yellow' : 'green'
  ) as CotVectors['alertLevel']

  return {
    nonComm: { net: cur.nonCommNet, direction: direction(cur.nonCommNet), wow: prev ? cur.nonCommNet - prev.nonCommNet : null },
    comm:    { net: cur.commNet,    direction: direction(cur.commNet),    wow: prev ? cur.commNet    - prev.commNet    : null },
    nonRept: { net: cur.nonReptNet, direction: direction(cur.nonReptNet), wow: prev ? cur.nonReptNet - prev.nonReptNet : null },
    sellPressureScore,
    scorePercentile: sellPressureScore,
    scoreMedian,
    historyWeeks: history.length,
    alertLevel,
  }
}
