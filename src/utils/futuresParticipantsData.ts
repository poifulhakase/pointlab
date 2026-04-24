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
  sellPressureScore: number       // 0-100
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

function readCache(): LocalCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as LocalCache
    if (Date.now() - c.fetchedAt > CACHE_TTL) return null
    return c
  } catch { return null }
}

function writeCache(updatedAt: string, data: FuturesParticipantDayData[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ updatedAt, data, fetchedAt: Date.now() }))
  } catch { /* ignore */ }
}

export async function fetchFuturesParticipantsData(force = false): Promise<FuturesParticipantDayData[]> {
  if (!force) {
    const cached = readCache()
    if (cached) return cached.data
  }
  const res = await fetch(`${import.meta.env.BASE_URL}data/futures_participants.json`, {
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json: CachedResponse = await res.json()
  if (!json.data || json.data.length === 0) throw new Error('データが空です')
  writeCache(json.updatedAt, json.data)
  return json.data
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

export function computeMicroVectors(data: FuturesParticipantDayData[]): MicroVectors | null {
  if (data.length === 0) return null
  const cur  = data[0]
  const prev = data[1] ?? null

  const trendLots   = vsum(cur, ['GS', 'JPM'])
  const gravityLots = vsum(cur, ['SG', 'Barclays', 'BNP'])
  const noiseLots   = vsum(cur, ['AMRO', 'Nomura'])

  const prevT = prev ? vsum(prev, ['GS', 'JPM'])                      : null
  const prevG = prev ? vsum(prev, ['SG', 'Barclays', 'BNP'])          : null
  const prevN = prev ? vsum(prev, ['AMRO', 'Nomura'])                  : null

  // 売り圧力スコア 0-100
  // 海外大口 + 裁定売り の売り越しがスコアを上げ、個人逆張り の買い越しが緩衝
  const tc = Math.min(Math.max(-trendLots   / 50, 0), 40)
  const gc = Math.min(Math.max(-gravityLots / 50, 0), 40)
  const no = Math.min(Math.max( noiseLots   / 100, 0), 20)
  const sellPressureScore = Math.round(Math.min(Math.max(tc + gc - no, 0), 100))

  const alertLevel = (
    sellPressureScore >= 70 ? 'red'    :
    sellPressureScore >= 50 ? 'orange' :
    sellPressureScore >= 30 ? 'yellow' : 'green'
  ) as MicroVectors['alertLevel']

  return {
    trend:   { netLots: trendLots,   direction: direction(trendLots),   dayOverDay: prevT !== null ? trendLots   - prevT : null },
    gravity: { netLots: gravityLots, direction: direction(gravityLots), dayOverDay: prevG !== null ? gravityLots - prevG : null },
    noise:   { netLots: noiseLots,   direction: direction(noiseLots),   dayOverDay: prevN !== null ? noiseLots   - prevN : null },
    sellPressureScore,
    alertLevel,
  }
}
