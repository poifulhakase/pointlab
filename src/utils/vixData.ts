// VIX（恐怖指数）週次データ
// データソース: /data/vix.json (scripts/fetch-jpx.mjs で生成)

export interface VixWeekData {
  date:       string   // "2026/04/11"
  close:      number   // 終値
  change:     number | null  // 前週比（ポイント）
  changePct:  number | null  // 前週比（%）
}

interface CachedResponse {
  updatedAt: string
  data: VixWeekData[]
}

export async function fetchVixData(): Promise<VixWeekData[]> {
  const res = await fetch('/data/vix.json', {
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`データファイルが見つかりません (HTTP ${res.status})\nnpm run fetch-data を実行してください`)
  const json: CachedResponse = await res.json()
  if (!json.data || json.data.length === 0) throw new Error('データが空です')
  return json.data
}
