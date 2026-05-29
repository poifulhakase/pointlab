import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fetchWithCache, writeEntry, getCachedUpdatedAt, purgeStaleDataCaches } from '../dataCache'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('fetchWithCache', () => {
  it('calls fetcher on cache miss', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: [1, 2, 3] })
    const result = await fetchWithCache({ key: 'test-key', ttl: 60_000, fetcher })
    expect(fetcher).toHaveBeenCalledOnce()
    expect(result).toEqual([1, 2, 3])
  })

  it('returns cached data within TTL without calling fetcher', async () => {
    writeEntry('test-key', [1, 2, 3])
    const fetcher = vi.fn().mockResolvedValue({ data: [4, 5, 6] })
    const result = await fetchWithCache({ key: 'test-key', ttl: 60_000, fetcher })
    expect(fetcher).not.toHaveBeenCalled()
    expect(result).toEqual([1, 2, 3])
  })

  it('calls fetcher when cache is expired', async () => {
    const staleEntry = { data: ['old'], fetchedAt: Date.now() - 120_000 }
    localStorage.setItem('test-key', JSON.stringify(staleEntry))
    const fetcher = vi.fn().mockResolvedValue({ data: ['new'] })
    const result = await fetchWithCache({ key: 'test-key', ttl: 60_000, fetcher })
    expect(fetcher).toHaveBeenCalledOnce()
    expect(result).toEqual(['new'])
  })

  it('returns stale data when fetcher throws and stale exists', async () => {
    const staleEntry = { data: ['stale'], fetchedAt: Date.now() - 120_000 }
    localStorage.setItem('test-key', JSON.stringify(staleEntry))
    const fetcher = vi.fn().mockRejectedValue(new Error('network error'))
    const result = await fetchWithCache({ key: 'test-key', ttl: 60_000, fetcher })
    expect(result).toEqual(['stale'])
  })

  it('throws when fetcher fails and no stale cache exists', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('network error'))
    await expect(fetchWithCache({ key: 'test-key', ttl: 60_000, fetcher })).rejects.toThrow('network error')
  })

  it('force=true bypasses TTL and calls fetcher', async () => {
    writeEntry('test-key', ['cached'])
    const fetcher = vi.fn().mockResolvedValue({ data: ['fresh'] })
    const result = await fetchWithCache({ key: 'test-key', ttl: 60_000, force: true, fetcher })
    expect(fetcher).toHaveBeenCalledOnce()
    expect(result).toEqual(['fresh'])
  })

  it('checkUpdatedAt: skips fetch when updatedAt unchanged', async () => {
    writeEntry('test-key', ['cached'], '2026-01-01T00:00:00Z')
    // 60秒以内ではない（SESSION_MS = 60000ms）- stale なので fetch 試みる
    const staleEntry = { data: ['cached'], fetchedAt: Date.now() - 90_000, updatedAt: '2026-01-01T00:00:00Z' }
    localStorage.setItem('test-key', JSON.stringify(staleEntry))
    const fetcher = vi.fn().mockResolvedValue({ data: ['new'], updatedAt: '2026-01-01T00:00:00Z' })
    const result = await fetchWithCache({ key: 'test-key', ttl: 60_000, checkUpdatedAt: true, fetcher })
    // updatedAt 同一なのでキャッシュデータが返る
    expect(result).toEqual(['cached'])
  })
})

describe('getCachedUpdatedAt', () => {
  it('returns updatedAt from cached entry', () => {
    writeEntry('test-key', [], '2026-05-29T00:00:00Z')
    expect(getCachedUpdatedAt('test-key')).toBe('2026-05-29T00:00:00Z')
  })

  it('returns null when no cache', () => {
    expect(getCachedUpdatedAt('no-such-key')).toBeNull()
  })
})

describe('purgeStaleDataCaches', () => {
  it('removes entries older than 7 days', () => {
    const oldEntry = { data: [], fetchedAt: Date.now() - 8 * 24 * 60 * 60 * 1000 }
    localStorage.setItem('poical-vix-data', JSON.stringify(oldEntry))
    purgeStaleDataCaches()
    expect(localStorage.getItem('poical-vix-data')).toBeNull()
  })

  it('keeps entries newer than 7 days', () => {
    const freshEntry = { data: [1], fetchedAt: Date.now() - 60_000 }
    localStorage.setItem('poical-vix-data', JSON.stringify(freshEntry))
    purgeStaleDataCaches()
    expect(localStorage.getItem('poical-vix-data')).not.toBeNull()
  })

  it('removes entries with invalid JSON', () => {
    localStorage.setItem('poical-vix-data', 'not-json')
    purgeStaleDataCaches()
    expect(localStorage.getItem('poical-vix-data')).toBeNull()
  })

  it('does not touch unrelated localStorage keys', () => {
    localStorage.setItem('stock-cal-notes', '{"2026-01-01":{}}')
    purgeStaleDataCaches()
    expect(localStorage.getItem('stock-cal-notes')).not.toBeNull()
  })
})
