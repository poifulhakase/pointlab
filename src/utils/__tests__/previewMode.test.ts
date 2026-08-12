import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

/**
 * プレビューモードの入り方。
 *
 * 🔴 `isPreviewMode()` は**モジュール読み込み時に1回だけ**判定する（描画のたびに URL を読まない）。
 *    そのためテストでは毎回 `vi.resetModules()` して読み込み直す。
 */
const TOKEN = 'poirobo-preview-9f3a'
const SS_KEY = 'poirobo-preview'

function setSearch(search: string) {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...window.location, search },
  })
}

async function loadFresh() {
  vi.resetModules()
  return await import('../previewMode')
}

describe('previewMode', () => {
  beforeEach(() => {
    sessionStorage.clear()
    setSearch('')
  })
  afterEach(() => {
    document.getElementById('poirobo-preview-toast')?.remove()
  })

  it('合言葉つきのURLで入れる', async () => {
    setSearch(`?preview=${TOKEN}`)
    const m = await loadFresh()
    expect(m.isPreviewMode()).toBe(true)
  })

  it('合言葉が違うときは入れない（当てずっぽうを弾く）', async () => {
    setSearch('?preview=1')
    const m = await loadFresh()
    expect(m.isPreviewMode()).toBe(false)
    expect(sessionStorage.getItem(SS_KEY)).toBeNull()
  })

  it('パラメータが無くてもタブの中では続く（画面遷移で消えても切れない）', async () => {
    sessionStorage.setItem(SS_KEY, '1')
    const m = await loadFresh()
    expect(m.isPreviewMode()).toBe(true)
  })

  it('通常のURLでは無効', async () => {
    const m = await loadFresh()
    expect(m.isPreviewMode()).toBe(false)
  })

  it('配布用リンクに合言葉が入る', async () => {
    const m = await loadFresh()
    expect(m.previewUrl('https://example.com/')).toBe(`https://example.com/?preview=${TOKEN}`)
  })

  describe('blockedInPreview', () => {
    it('プレビュー中は止めて、理由を画面に出す', async () => {
      setSearch(`?preview=${TOKEN}`)
      const m = await loadFresh()

      expect(m.blockedInPreview('保存できません')).toBe(true)
      // 🔴 押しても何も起きないと壊れて見えるので、理由が必ず出ること
      const toast = document.getElementById('poirobo-preview-toast')
      expect(toast?.textContent).toBe('保存できません')
      expect(toast?.getAttribute('role')).toBe('status') // 読み上げにも届く
    })

    it('通常時は素通りする（何も出さない）', async () => {
      const m = await loadFresh()
      expect(m.blockedInPreview('保存できません')).toBe(false)
      expect(document.getElementById('poirobo-preview-toast')).toBeNull()
    })
  })
})

describe('プレビュー中のメモ', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    setSearch(`?preview=${TOKEN}`)
  })

  it('端末に本物のメモが入っていても出さない（ダミーだけ見せる）', async () => {
    localStorage.setItem('stock-cal-notes', JSON.stringify({
      '2026-01-05': { title: '本物のメモ', memo: '見せてはいけない', schedules: [] },
    }))
    vi.resetModules()
    const { getAllNoteData } = await import('../noteStorage')

    const all = JSON.stringify([...getAllNoteData().values()])
    expect(all).not.toContain('本物のメモ')
    expect(all).toContain('需給チェック')   // ダミー側の中身
  })

  it('保存しても端末には何も書かない', async () => {
    vi.resetModules()
    const { saveNote } = await import('../noteStorage')

    saveNote(new Date(2026, 7, 13), { title: 'テスト', memo: 'テスト', schedules: [] })

    expect(localStorage.getItem('stock-cal-notes')).toBeNull()
  })
})

describe('プレビュー中の需給データ', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    setSearch(`?preview=${TOKEN}`)
  })

  it('本物を取りに行かず、ダミーを返す', async () => {
    vi.resetModules()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { fetchWithCache } = await import('../dataCache')

    const rows = await fetchWithCache<{ ratio: number }[]>({
      key: 'poical-margin-data-v2',
      ttl: 1000,
      fetcher: async () => { throw new Error('本物を取りに行ってはいけない') },
    })

    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0].ratio).toBeGreaterThan(0)
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('キャッシュに書かない（通常表示に戻したとき偽の数字が残らない）', async () => {
    vi.resetModules()
    const { fetchWithCache } = await import('../dataCache')

    await fetchWithCache({
      key: 'poical-investor-data',
      ttl: 1000,
      fetcher: async () => ({ data: [] }),
    })

    expect(localStorage.getItem('poical-investor-data')).toBeNull()
  })

  it('何度呼んでも同じ数字（開き直すたびに変わらない）', async () => {
    const { PREVIEW_BY_CACHE_KEY } = await import('../previewMarketData')
    for (const [key, make] of Object.entries(PREVIEW_BY_CACHE_KEY)) {
      expect(JSON.stringify(make()), `${key} は呼ぶたびに変わってはいけない`).toBe(JSON.stringify(make()))
    }
  })

  it('登録した全キーが中身のあるデータを返す', async () => {
    const { PREVIEW_BY_CACHE_KEY } = await import('../previewMarketData')
    // 🔴 空配列を返すと画面が「データなし」になり、ダミーを足した意味がなくなる
    for (const [key, make] of Object.entries(PREVIEW_BY_CACHE_KEY)) {
      const v = make()
      if (Array.isArray(v)) expect(v.length, `${key} が空`).toBeGreaterThan(0)
      else expect(v, `${key} が空`).toBeTruthy()
    }
  })

  it('ダミーに無いキーは実データの取得へ通す', async () => {
    vi.resetModules()
    const { fetchWithCache } = await import('../dataCache')

    // 🔵 ニュース見出しはダミーにしていない（公開情報で、隠す意味がないため）
    const v = await fetchWithCache({
      key: 'poical-nhk-news',
      ttl: 1000,
      fetcher: async () => ({ data: 'real' }),
    })

    expect(v).toBe('real')
  })
})

describe('プレビュー中のカレンダーは今月だけ', () => {
  it('同じ月の日付は通す', async () => {
    const { isWithinPreviewRange } = await import('../../hooks/useCalendar')
    const today = new Date(2026, 7, 12)
    expect(isWithinPreviewRange(new Date(2026, 7, 1), today)).toBe(true)
    expect(isWithinPreviewRange(new Date(2026, 7, 31), today)).toBe(true)
  })

  it('前月・翌月・翌年の同じ月は止める', async () => {
    const { isWithinPreviewRange } = await import('../../hooks/useCalendar')
    const today = new Date(2026, 7, 12)
    expect(isWithinPreviewRange(new Date(2026, 6, 31), today)).toBe(false)
    expect(isWithinPreviewRange(new Date(2026, 8, 1), today)).toBe(false)
    expect(isWithinPreviewRange(new Date(2027, 7, 12), today)).toBe(false)
  })
})

describe('previewData', () => {
  it('メモのダミーは「今日」を含む（月をまたいでも空にならない）', async () => {
    const { previewNotes } = await import('../previewData')
    const now = new Date()
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    expect(Object.keys(previewNotes())).toContain(key)
  })
})
