// 投資主体別売買動向データ
// データソース: /data/investor.json (scripts/fetch-jpx.mjs で生成)

export interface InvestorWeekData {
  date:       string  // "2026/04/03"
  label:      string  // "4月第1週"
  foreigner:  number  // 海外投資家 差引（百万円）
  individual: number  // 個人 差引（百万円）
  trustBank:  number  // 信託銀行 差引（百万円）
  securities: number  // 証券自己 差引（百万円）
}

interface CachedResponse {
  updatedAt: string
  data: InvestorWeekData[]
}

export async function fetchInvestorData(): Promise<InvestorWeekData[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/investor.json`, {
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error(`データファイルが見つかりません (HTTP ${res.status})\nnpm run fetch-data を実行してください`)
  const json: CachedResponse = await res.json()
  if (!json.data || json.data.length === 0) throw new Error('データが空です')
  return json.data
}
