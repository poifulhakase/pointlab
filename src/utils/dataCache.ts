// ── 統一データキャッシュ管理 ───────────────────────────────────────────────
// すべての poical-* データキャッシュの read / write / evict を一元管理する。
//
// 使い方:
//   import { fetchWithCache, getCachedUpdatedAt, purgeStaleDataCaches } from './dataCache'

// キャッシュ対象の全キー（purge 対象）
const DATA_CACHE_KEYS = [
  'poical-investor-data',
  'poical-margin-data',
  'poical-short-sell-data',
  'poical-ad-ratio-data',
  'poical-arbitrage-data',
  'poical-arbitrage-daily-data',
  'poical-cot-nikkei-v1',
  'poical-futures-daily-data',
  'poical-futures-oi-data',
  'poical-usdjpy-data',
  'poical-nas100-data',
  'poical-vix-data',
  'poical-vix-daily-data',
  'poical-nk-futures-price-v2',
  'poical-ns-ratio-data',
  'poical-nt-topix-data',
  'poical-nhk-news',
] as const

// 最終 fetch から EVICT_AFTER ms 経過したエントリを削除（7日）
const EVICT_AFTER = 7 * 24 * 60 * 60 * 1000

interface CacheEntry<T> {
  data:      T
  fetchedAt: number
  updatedAt?: string
}

function readEntry<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as CacheEntry<T>
  } catch { return null }
}

export function writeEntry<T>(key: string, data: T, updatedAt?: string): void {
  try {
    const entry: CacheEntry<T> = { data, fetchedAt: Date.now(), ...(updatedAt ? { updatedAt } : {}) }
    localStorage.setItem(key, JSON.stringify(entry))
  } catch { /* QuotaExceededError: キャッシュ書き込み失敗はサイレントに無視 */ }
}

/** キャッシュから updatedAt を返す（ネットワーク不要） */
export function getCachedUpdatedAt(key: string): string | null {
  return readEntry(key)?.updatedAt ?? null
}

/**
 * fetch + localStorage キャッシュの汎用ラッパー
 * - TTL 内ならキャッシュを即返す
 * - 期限切れなら fetcher を呼びキャッシュを更新
 * - fetcher 失敗時は stale キャッシュを返す（なければ throw）
 */
export async function fetchWithCache<T>(opts: {
  key:     string
  ttl:     number | (() => number)
  force?:  boolean
  fetcher: () => Promise<{ data: T; updatedAt?: string }>
}): Promise<T> {
  const { key, force = false, fetcher } = opts
  const ttl = typeof opts.ttl === 'function' ? opts.ttl() : opts.ttl

  let stale: T | null = null
  const entry = readEntry<T>(key)
  if (entry) {
    stale = entry.data
    if (!force && Date.now() - entry.fetchedAt <= ttl) return entry.data
  }

  try {
    const { data, updatedAt } = await fetcher()
    writeEntry(key, data, updatedAt)
    return data
  } catch (e) {
    if (stale) return stale
    throw e
  }
}

/**
 * 7日以上キャッシュされた古いデータエントリを削除する。
 * App 起動時に一度だけ呼ぶことで localStorage の肥大化を防ぐ。
 * ノート・設定・認証など永続データには触れない。
 */
export function purgeStaleDataCaches(): void {
  for (const key of DATA_CACHE_KEYS) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      // nhkNews は { ts, items } 形式なので ts も確認
      const entry = JSON.parse(raw) as { fetchedAt?: number; ts?: number }
      const fetchedAt = entry.fetchedAt ?? entry.ts ?? 0
      if (Date.now() - fetchedAt > EVICT_AFTER) {
        localStorage.removeItem(key)
      }
    } catch {
      localStorage.removeItem(key)
    }
  }
}
