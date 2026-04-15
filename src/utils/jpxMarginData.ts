// 信用取引残高データ
// データソース: /data/margin.json (scripts/fetch-jpx.mjs で生成)

export interface MarginWeekData {
  date:      string          // "2026/04/03"
  label:     string          // "4月第1週"
  longBal:   number          // 買い残（百万円）
  shortBal:  number          // 売り残（百万円）
  ratio:     number          // 信用倍率
  evalRatio: number | null   // 信用評価損益率（%）
}

interface CachedResponse {
  updatedAt: string
  data: MarginWeekData[]
}

export async function fetchMarginData(): Promise<MarginWeekData[]> {
  const res = await fetch('/data/margin.json', {
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`データファイルが見つかりません (HTTP ${res.status})\nnpm run fetch-data を実行してください`)
  const json: CachedResponse = await res.json()
  if (!json.data || json.data.length === 0) throw new Error('データが空です')
  return json.data
}
