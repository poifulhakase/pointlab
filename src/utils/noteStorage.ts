export type CheckItem = {
  id: string
  text: string
  done: boolean
}

export type ScheduleEntry = {
  id: string
  title: string
  startTime: string   // 'HH:MM'
  endTime: string     // 'HH:MM'
  alertMinutes: number
}

export type DayNote = {
  title: string
  memo: string
  checklist: CheckItem[]
  schedules?: ScheduleEntry[]
  // Legacy fields (読み込み時のみ参照・新規保存では使わない)
  startTime?: string
  endTime?: string
  scheduled?: boolean
  alertMinutes?: number
}

const STORAGE_KEY = 'stock-cal-notes'
const PENDING_DELETES_KEY = 'poical-pending-deletes'

// ── 削除保留マーカー ──────────────────────────────────────────────────────
// ノートを削除したが Firestore への反映がまだ完了していないキーを記録する。
// initialSync でこのキーを持つエントリは Firestore から復元しない。

function loadPendingDeletesObj(): Record<string, number> {
  try {
    const obj = JSON.parse(localStorage.getItem(PENDING_DELETES_KEY) ?? '{}') as Record<string, number>
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000 // 30日以上前のものは自動削除
    const cleaned: Record<string, number> = {}
    let hasOld = false
    for (const [k, ts] of Object.entries(obj)) {
      if (ts > cutoff) cleaned[k] = ts
      else hasOld = true
    }
    if (hasOld) localStorage.setItem(PENDING_DELETES_KEY, JSON.stringify(cleaned))
    return cleaned
  } catch { return {} }
}

function addPendingDelete(key: string): void {
  const obj = loadPendingDeletesObj()
  obj[key] = Date.now()
  localStorage.setItem(PENDING_DELETES_KEY, JSON.stringify(obj))
}

export function removePendingDelete(key: string): void {
  const obj = loadPendingDeletesObj()
  delete obj[key]
  localStorage.setItem(PENDING_DELETES_KEY, JSON.stringify(obj))
}

export function isPendingDelete(key: string): boolean {
  return key in loadPendingDeletesObj()
}

export function dateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function load(): Record<string, Partial<DayNote>> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } catch { return {} }
}

function migrateLegacySchedules(stored: Partial<DayNote>): ScheduleEntry[] {
  const existing = stored.schedules ?? []
  if (existing.length > 0) return existing
  if (stored.scheduled && stored.startTime) {
    return [{
      id: 'legacy',
      title: stored.title ?? '',
      startTime: stored.startTime,
      endTime: stored.endTime ?? '',
      alertMinutes: stored.alertMinutes ?? 0,
    }]
  }
  return []
}

export function getNote(date: Date): DayNote {
  const stored = load()[dateKey(date)] ?? {}
  return {
    title: stored.title ?? '',
    memo: stored.memo ?? '',
    checklist: stored.checklist ?? [],
    schedules: migrateLegacySchedules(stored),
  }
}

export function saveNote(date: Date, note: DayNote): void {
  const all = load()
  const k = dateKey(date)
  const hasContent = note.title.trim() || note.memo.trim() || note.checklist.length > 0
  const hasSchedules = (note.schedules?.length ?? 0) > 0
  if (!hasContent && !hasSchedules) {
    delete all[k]
    addPendingDelete(k)
  } else {
    all[k] = {
      title: note.title,
      memo: note.memo,
      checklist: note.checklist,
      schedules: note.schedules ?? [],
    }
    removePendingDelete(k)
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
}

export type NoteMapEntry = {
  title: string
  schedules: ScheduleEntry[]
  // Legacy compat（useNotifications / App.tsx で参照）
  startTime: string
  endTime: string
  scheduled: boolean
  alertMinutes: number
}

export function getAllNoteData(): Map<string, NoteMapEntry> {
  const all = load()
  const map = new Map<string, NoteMapEntry>()
  for (const [key, note] of Object.entries(all)) {
    const hasContent = note.title?.trim() || note.memo?.trim() || (note.checklist?.length ?? 0) > 0
    const schedules = migrateLegacySchedules(note)
    if (hasContent || schedules.length > 0) {
      map.set(key, {
        title: note.title ?? '',
        schedules,
        startTime: schedules[0]?.startTime ?? note.startTime ?? '',
        endTime: schedules[0]?.endTime ?? note.endTime ?? '',
        scheduled: schedules.length > 0 || (note.scheduled ?? false),
        alertMinutes: schedules[0]?.alertMinutes ?? note.alertMinutes ?? 0,
      })
    }
  }
  return map
}
