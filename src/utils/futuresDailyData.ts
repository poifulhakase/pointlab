// 先物日次データ（OI・取引高）
// データソース: /data/futures_daily.json (scripts/fetch-jpx.mjs で生成)
// JPX日報PDF (sif_dyr_YYYYMMDD.pdf) から毎営業日 16:31 頃更新

export interface FuturesDayData {
  date:   string  // "2026/04/30"
  volume: number  // 取引高（枚）- 日経225先物 全限月合計
  oi:     number  // 建玉残高（枚）- 日経225先物 全限月合計
}

const CACHE_KEY = 'poical-futures-daily-data'
const CACHE_TTL = 6 * 60 * 60 * 1000 // 6時間

export async function fetchFuturesDailyData(force = false): Promise<FuturesDayData[]> {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const c = JSON.parse(raw) as { updatedAt: string; data: FuturesDayData[]; fetchedAt: number }
      if (!force && Date.now() - c.fetchedAt <= CACHE_TTL) return c.data
    }
  } catch { /* ignore */ }

  const res = await fetch(`${import.meta.env.BASE_URL}data/futures_daily.json`, {
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json() as { updatedAt: string; data: FuturesDayData[] }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...json, fetchedAt: Date.now() }))
  } catch { /* ignore */ }
  return json.data
}
