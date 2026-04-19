const KEY = 'poical-sticky-notes'

export interface StickyNote {
  id: string
  content: string
  updatedAt: string
}

export function loadStickyNotes(): StickyNote[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

export function saveStickyNotes(notes: StickyNote[]): void {
  localStorage.setItem(KEY, JSON.stringify(notes))
}

export function newStickyNote(): StickyNote {
  return { id: Date.now().toString(), content: '', updatedAt: new Date().toISOString() }
}
