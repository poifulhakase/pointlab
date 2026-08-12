// 空売り比率データ
// データソース: /data/short_sell.json (scripts/fetch-jpx.mjs で生成)

import { fetchWithCache } from './dataCache'

export interface ShortSellWeekData {
  date:  string  // "2026/04/03"
  label: string  // "4月第1週"
  ratio: number  // 空売り比率（%）
}

/**
 * 日次の空売り比率（2026-08-12 追加）。
 *
 * 🔵 元データが日次なので日次のまま持つ。週次（上）は「その週の最終営業日の値」なので、
 *    週の途中の山（例：45%台へ跳ねた日）は日次でしか見えない。
 * 🔴 `ratio` は東証の定義どおり **価格規制なし＋価格規制あり**の合計。
 *    2026-08-12 まで別の列を読んでいて 7〜16 ポイント低い値を出していた（scripts/shortSell.mjs 参照）。
 */
export interface ShortSellDayData {
  date:         string  // "2026/08/10"
  ratio:        number  // 合計（%）
  unrestricted: number  // 価格規制なし（%）
  restricted:   number  // 価格規制あり（%）
}

const CACHE_KEY = 'poical-short-sell-data'
const CACHE_TTL = 24 * 60 * 60 * 1000

export async function fetchShortSellData(force = false): Promise<ShortSellWeekData[]> {
  return fetchWithCache({
    key: CACHE_KEY, ttl: CACHE_TTL, force,
    fetcher: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}data/short_sell.json`, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) throw new Error(`データファイルが見つかりません (HTTP ${res.status})\nnpm run fetch-data を実行してください`)
      const json = await res.json() as { updatedAt: string; data: ShortSellWeekData[] }
      if (!json.data?.length) throw new Error('データが空です')
      return { data: json.data, updatedAt: json.updatedAt }
    },
  })
}

/**
 * 日次の空売り比率（同じファイルの `daily`）。
 * 🔵 週次と同じファイルなので、取得は1回で済む（キャッシュは別キー）。
 * 🔵 古いファイル（`daily` が無い版）でも落とさず空配列を返す。
 */
export async function fetchShortSellDaily(force = false): Promise<ShortSellDayData[]> {
  return fetchWithCache({
    key: 'poical-short-sell-daily',
    ttl: CACHE_TTL,
    force,
    fetcher: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}data/short_sell.json`, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) throw new Error(`データファイルが見つかりません (HTTP ${res.status})`)
      const json = await res.json() as { updatedAt: string; daily?: ShortSellDayData[] }
      return { data: json.daily ?? [], updatedAt: json.updatedAt }
    },
  })
}
