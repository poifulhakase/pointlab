import { isPreviewMode } from './previewMode'
import { previewStickyNotes } from './previewData'

const KEY = 'poical-sticky-notes'

export interface StickyNote {
  id: string
  content: string
  updatedAt: string
}

export function loadStickyNotes(): StickyNote[] {
  // 🔴 プレビューでは実際のメモを読まない（固定のダミーだけ見せる）
  if (isPreviewMode()) return previewStickyNotes()
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

export function saveStickyNotes(notes: StickyNote[]): void {
  // 🔵 黙って捨てる（理由は追加・削除の操作をしたときに出す＝Sidebar 側）
  if (isPreviewMode()) return
  localStorage.setItem(KEY, JSON.stringify(notes))
}

export function newStickyNote(): StickyNote {
  return { id: Date.now().toString(), content: '', updatedAt: new Date().toISOString() }
}
