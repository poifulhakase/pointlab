// 個別銘柄の信用残（週次）。
//
// 🔴 書き込むのは `scripts/fetch-stock-margin.mjs --json`（JPXの週次PDF）だけ。
// 🔵 **週1回しか動かない**データなので、キャッシュは長め（3時間）。
// 🔵 2026-09-05: ロボット銘柄（Future）を畳んだので `poiroboStocks.ts` から独立させた。
//    取る銘柄は `public/data/target_support.json` の主力（TARGET）に付いていく。

import { fetchWithCache } from './dataCache'

export type StockMarginWeek = { w: string; long: number; longChg: number; short: number; shortChg: number }

export type StockMarginData = {
  updatedAt: string
  source: string
  note: string
  weeks: string[]
  missing: string[]
  stocks: Record<string, { name: string; history: StockMarginWeek[] }>
}

const MARGIN_CACHE_KEY = 'poical-stock-margin-v1'
const MARGIN_TTL = 3 * 60 * 60 * 1000

export async function fetchStockMargin(force = false): Promise<StockMarginData | null> {
  try {
    return await fetchWithCache<StockMarginData>({
      key: MARGIN_CACHE_KEY,
      ttl: MARGIN_TTL,
      force,
      fetcher: async () => {
        const res = await fetch(`${import.meta.env.BASE_URL}data/stock_margin.json`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as StockMarginData
        return { data, updatedAt: data.updatedAt }
      },
    })
  } catch {
    return null   // 取れない週は需給ゲージを出さないだけ（他の表示は止めない）
  }
}
