// 投資主体別先物手口データ
// データソース: /data/futures_participants.json (scripts/fetch-jpx.mjs で生成)
// 元データ: JPX公表「投資部門別売買高」日経225先物 週次
// コード: 60=外国人 / 23=信託銀行 / 11=生命保険 / 31=投資信託 / 51=個人 / 41=証券会社

export interface FuturesParticipantDayData {
  date:       string         // "2026-04-17" (週末金曜日)
  label:      string         // "4月第3週"
  foreign:    number | null  // 外国人 (code 60)  net = 買-売
  trustBank:  number | null  // 信託銀行 (code 23)
  lifeIns:    number | null  // 生命保険 (code 11) ※旧形式データでは null
  invTrust:   number | null  // 投資信託 (code 31)
  individual: number | null  // 個人 (code 51)     ※旧形式データでは null
  securities: number | null  // 証券会社 (code 41)
}

export interface MicroVector {
  netLots:    number
  direction:  'bull' | 'bear' | 'neutral'
  dayOverDay: number | null
}

export interface MicroVectors {
  trend:             MicroVector  // 外国人 + 信託銀行: スマートマネー方向
  gravity:           MicroVector  // 生命保険 + 投資信託: 機関投資家フロー
  noise:             MicroVector  // 個人 + 証券会社: 逆張り/ヘッジ
  sellPressureScore: number       // 0-100（絶対スコア）
  scorePercentile:   number       // 直近historyDays週中での百分位（高いほど売り圧力が強い）
  scoreMedian:       number       // 直近historyDays週の中央値
  historyDays:       number       // 比較に使った週数
  alertLevel:        'green' | 'yellow' | 'orange' | 'red'
}

interface CachedResponse {
  updatedAt: string
  data: FuturesParticipantDayData[]
}

const CACHE_KEY = 'poical-futures-participants-v2'
const CACHE_TTL = 24 * 60 * 60 * 1000

interface LocalCache {
  updatedAt: string
  data:      FuturesParticipantDayData[]
  fetchedAt: number
}

function writeCache(updatedAt: string, data: FuturesParticipantDayData[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ updatedAt, data, fetchedAt: Date.now() }))
  } catch { /* ignore */ }
}

export async function fetchFuturesParticipantsData(force = false): Promise<FuturesParticipantDayData[]> {
  let stale: FuturesParticipantDayData[] | null = null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const c = JSON.parse(raw) as LocalCache
      stale = c.data
      if (!force && Date.now() - c.fetchedAt <= CACHE_TTL) return c.data
    }
  } catch { /* ignore */ }

  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/futures_participants.json`, {
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

function direction(lots: number): 'bull' | 'bear' | 'neutral' {
  if (lots < -200) return 'bear'
  if (lots > 200)  return 'bull'
  return 'neutral'
}

function vsum(day: FuturesParticipantDayData, keys: (keyof FuturesParticipantDayData)[]): number {
  return keys.reduce((s, k) => {
    const v = day[k]
    return s + (typeof v === 'number' ? v : 0)
  }, 0)
}

// 1週分のスコアを計算（computeMicroVectors内でも履歴計算でも共用）
function computeRawScore(day: FuturesParticipantDayData): number {
  const tc = Math.min(Math.max(-vsum(day, ['foreign', 'trustBank']) / 80, 0), 40)
  const gc = Math.min(Math.max(-vsum(day, ['lifeIns', 'invTrust'])  / 60, 0), 40)
  const no = Math.min(Math.max( vsum(day, ['individual', 'securities']) / 100, 0), 20)
  return Math.round(Math.min(Math.max(tc + gc - no, 0), 100))
}

const SCORE_HISTORY_WEEKS = 26  // 約6ヶ月（取引週ベース）

export function computeMicroVectors(data: FuturesParticipantDayData[]): MicroVectors | null {
  if (data.length === 0) return null
  const cur  = data[0]
  const prev = data[1] ?? null

  const trendLots   = vsum(cur, ['foreign', 'trustBank'])
  const gravityLots = vsum(cur, ['lifeIns', 'invTrust'])
  const noiseLots   = vsum(cur, ['individual', 'securities'])

  const prevT = prev ? vsum(prev, ['foreign', 'trustBank']) : null
  const prevG = prev ? vsum(prev, ['lifeIns', 'invTrust'])  : null
  const prevN = prev ? vsum(prev, ['individual', 'securities']) : null

  // 直近N週のスコア分布を計算
  const history = data.slice(0, SCORE_HISTORY_WEEKS)
  const historyScores = history.map(computeRawScore)
  const sellPressureScore = historyScores[0]

  const sorted = [...historyScores].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const scoreMedian = sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid]

  const pastScores = historyScores.slice(1)
  const scorePercentile = pastScores.length > 0
    ? Math.round(pastScores.filter(s => s < sellPressureScore).length / pastScores.length * 100)
    : 50

  const alertLevel = (
    scorePercentile >= 85 ? 'red'    :
    scorePercentile >= 65 ? 'orange' :
    scorePercentile >= 50 ? 'yellow' : 'green'
  ) as MicroVectors['alertLevel']

  return {
    trend:   { netLots: trendLots,   direction: direction(trendLots),   dayOverDay: prevT !== null ? trendLots   - prevT : null },
    gravity: { netLots: gravityLots, direction: direction(gravityLots), dayOverDay: prevG !== null ? gravityLots - prevG : null },
    noise:   { netLots: noiseLots,   direction: direction(noiseLots),   dayOverDay: prevN !== null ? noiseLots   - prevN : null },
    sellPressureScore,
    scorePercentile,
    scoreMedian,
    historyDays: history.length,
    alertLevel,
  }
}
