import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { fetchMaintenanceState, readMaintenanceCache } from '../maintenanceState'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('readMaintenanceCache', () => {
  it('returns OFF default when no cache', () => {
    expect(readMaintenanceCache()).toEqual({ enabled: false, message: '' })
  })

  it('returns cached value', () => {
    localStorage.setItem('poical-maintenance', JSON.stringify({ enabled: true, message: 'x' }))
    expect(readMaintenanceCache()).toEqual({ enabled: true, message: 'x' })
  })

  it('returns default on malformed cache', () => {
    localStorage.setItem('poical-maintenance', '{not json')
    expect(readMaintenanceCache()).toEqual({ enabled: false, message: '' })
  })
})

describe('fetchMaintenanceState', () => {
  it('parses Firestore fields and caches the result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ fields: { enabled: { booleanValue: true }, message: { stringValue: 'メンテ中' } } }),
    }))
    const state = await fetchMaintenanceState()
    expect(state).toEqual({ enabled: true, message: 'メンテ中' })
    expect(JSON.parse(localStorage.getItem('poical-maintenance')!)).toEqual({ enabled: true, message: 'メンテ中' })
  })

  it('treats missing fields as OFF', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
    expect(await fetchMaintenanceState()).toEqual({ enabled: false, message: '' })
  })

  it('fails open (returns cache) on non-ok response', async () => {
    localStorage.setItem('poical-maintenance', JSON.stringify({ enabled: true, message: 'cached' }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }))
    expect(await fetchMaintenanceState()).toEqual({ enabled: true, message: 'cached' })
  })

  it('fails open (returns default) on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    expect(await fetchMaintenanceState()).toEqual({ enabled: false, message: '' })
  })
})

describe('admin constant', () => {
  it('isAdminEmail matches only the admin address', async () => {
    const { isAdminEmail, ADMIN_EMAIL } = await import('../admin')
    expect(isAdminEmail(ADMIN_EMAIL)).toBe(true)
    expect(isAdminEmail('someone@example.com')).toBe(false)
    expect(isAdminEmail(null)).toBe(false)
    expect(isAdminEmail(undefined)).toBe(false)
  })
})
