// 証券会社別先物手口データ
// データソース: /data/futures_participants.json (scripts/fetch-jpx.mjs で生成)
// 元データ: JPX公表「証券会社別先物別売買高（ネット枚数）」日経225先物 日次

export interface FuturesParticipantDayData {
  date:     string        // "2026-04-24"
  label:    string        // "4/24"
  GS:       number | null // Goldman Sachs net lots (buy - sell)
  JPM:      number | null // JPMorgan
  AMRO:     number | null // ABN AMRO
  SG:       number | null // Société Générale
  Barclays: number | null // Barclays
  BNP:      number | null // BNP Paribas (Barclaysと排他、通常どちらか)
  Nomura:   number | null // 野村証券
}

export interface MicroVector {
  netLots:    number
  direction:  'bull' | 'bear' | 'neutral'
  dayOverDay: number | null
}

export interface MicroVectors {
  trend:             MicroVector  // GS + JPM: 海外勢コンセンサス
  gravity:           MicroVector  // SG + Barclays + BNP: 裁定解消圧力
  noise:             MicroVector  // AMRO + 野村: 攪乱・逆張り
  sellPressureScore: number       // 0-100（絶対スコア）
  scorePercentile:   number       // 直近historyDays日中での百分位（高いほど売り圧力が強い）
  scoreMedian:       number       // 直近historyDays日の中央値
  historyDays:       number       // 比較に使った日数
  alertLevel:        'green' | 'yellow' | 'orange' | 'red'
}

interface CachedResponse {
  updatedAt: string
  data: FuturesParticipantDayData[]
}

const CACHE_KEY = 'poical-futures-participants-data'
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

// 1日分のスコアを計算（computeMicroVectors内でも履歴計算でも共用）
function computeRawScore(day: FuturesParticipantDayData): number {
  const tc = Math.min(Math.max(-vsum(day, ['GS', 'JPM'])                 / 50,  0), 40)
  const gc = Math.min(Math.max(-vsum(day, ['SG', 'Barclays', 'BNP'])     / 50,  0), 40)
  const no = Math.min(Math.max( vsum(day, ['AMRO', 'Nomura'])             / 100, 0), 20)
  return Math.round(Math.min(Math.max(tc + gc - no, 0), 100))
}

const SCORE_HISTORY_DAYS = 65  // 約3ヶ月（取引日ベース）

export function computeMicroVectors(data: FuturesParticipantDayData[]): MicroVectors | null {
  if (data.length === 0) return null
  const cur  = data[0]
  const prev = data[1] ?? null

  const trendLots   = vsum(cur, ['GS', 'JPM'])
  const gravityLots = vsum(cur, ['SG', 'Barclays', 'BNP'])
  const noiseLots   = vsum(cur, ['AMRO', 'Nomura'])

  const prevT = prev ? vsum(prev, ['GS', 'JPM'])             : null
  const prevG = prev ? vsum(prev, ['SG', 'Barclays', 'BNP']) : null
  const prevN = prev ? vsum(prev, ['AMRO', 'Nomura'])         : null

  // 直近3ヶ月分のスコア分布を計算
  const history = data.slice(0, SCORE_HISTORY_DAYS)
  const historyScores = history.map(computeRawScore)
  const sellPressureScore = historyScores[0]  // 今日

  // 中央値（今日を含む全履歴）
  const sorted = [...historyScores].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const scoreMedian = sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid]

  // 百分位: 今日のスコアが過去N-1日の中で何%ile か
  const pastScores = historyScores.slice(1)
  const scorePercentile = pastScores.length > 0
    ? Math.round(pastScores.filter(s => s < sellPressureScore).length / pastScores.length * 100)
    : 50

  // アラートレベル: 固定閾値→パーセンタイルベース
  // 上位15%以上=red / 上位35%以上=orange / 上位50%以上=yellow / それ以下=green
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
