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

describe('previewData', () => {
  it('メモのダミーは「今日」を含む（月をまたいでも空にならない）', async () => {
    const { previewNotes } = await import('../previewData')
    const now = new Date()
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    expect(Object.keys(previewNotes())).toContain(key)
  })
})
