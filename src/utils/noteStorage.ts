export type CheckItem = {
  id: string
  text: string
  done: boolean
}

export type DayNote = {
  title: string
  memo: string
  checklist: CheckItem[]
  startTime: string    // 'HH:MM' or ''
  endTime: string      // 'HH:MM' or ''
  scheduled?: boolean  // スケジュール（時間軸）に表示するか
  alertMinutes?: number // アラート（0=なし, 5/10/15/30/60）
}

const STORAGE_KEY = 'stock-cal-notes'

export function dateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function load(): Record<string, Partial<DayNote>> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } catch { return {} }
}

export function getNote(date: Date): DayNote {
  const stored = load()[dateKey(date)] ?? {}
  return { title: '', memo: '', checklist: [], startTime: '', endTime: '', ...stored }
}

export function saveNote(date: Date, note: DayNote): void {
  const all = load()
  const k = dateKey(date)
  const hasContent = note.title.trim() || note.memo.trim() || note.checklist.length > 0
  // コンテンツなし・未スケジュールの場合は時刻だけのノートとして保存しない
  const empty = !hasContent && !note.scheduled
  if (empty) { delete all[k] } else { all[k] = note }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export type NoteMapEntry = {
  title: string
  startTime: string
  endTime: string
  scheduled: boolean
  alertMinutes: number
}

/** dateKey → NoteMapEntry のマップ（ノートがある日付のみ） */
export function getAllNoteData(): Map<string, NoteMapEntry> {
  const all = load()
  const map = new Map<string, NoteMapEntry>()
  for (const [key, note] of Object.entries(all)) {
    const hasContent = note.title?.trim() || note.memo?.trim() ||
      (note.checklist?.length ?? 0) > 0 || note.startTime
    if (hasContent) {
      map.set(key, {
        title: note.title ?? '',
        startTime: note.startTime ?? '',
        endTime: note.endTime ?? '',
        scheduled: note.scheduled ?? false,
        alertMinutes: note.alertMinutes ?? 0,
      })
    }
  }
  return map
}
