import {
  collection, doc,
  onSnapshot, query, where,
} from 'firebase/firestore'
import { db } from './firebase'
import { restGetDoc, restListDocs, restSetDoc, restDeleteDoc } from './firestoreRest'
import type { DayNote } from './noteStorage'
import { isPendingDelete, removePendingDelete } from './noteStorage'
import { loadStickyNotes, saveStickyNotes, type StickyNote } from './stickyNotes'

// Firestore 構造: users/{uid}/notes/{YYYY-MM}
// 各ドキュメント: { [dateKey]: DayNote, _updatedAt: string }

const STORAGE_KEY = 'stock-cal-notes'
const SYNC_MONTHS = 24 // 保持する月数

type RawNotes = Record<string, Partial<DayNote>>

function loadLocal(): RawNotes {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } catch { return {} }
}

function saveLocal(notes: RawNotes): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
}

function notesCol(uid: string) {
  return collection(db, 'users', uid, 'notes')
}

function stickyNotesDocRef(uid: string) {
  return doc(db, 'users', uid, 'data', 'stickyNotes')
}

/** dateKey (YYYY-MM-DD) から月キー (YYYY-MM) を取得 */
function toMonthKey(dateKey: string): string {
  return dateKey.slice(0, 7)
}

/** 保持対象の月キー一覧（直近 SYNC_MONTHS ヶ月） */
function getValidMonthKeys(): Set<string> {
  const keys = new Set<string>()
  const now = new Date()
  for (let i = 0; i < SYNC_MONTHS; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    keys.add(`${y}-${m}`)
  }
  return keys
}

/** ローカルノートを月毎にグループ化 */
function groupByMonth(notes: RawNotes): Record<string, RawNotes> {
  const groups: Record<string, RawNotes> = {}
  for (const [key, note] of Object.entries(notes)) {
    const month = toMonthKey(key)
    if (!groups[month]) groups[month] = {}
    groups[month][key] = note
  }
  return groups
}

/**
 * ログイン時の初期同期。
 * - Firestore から直近24ヶ月を取得して localStorage とマージ（Firestore 優先）
 * - ローカルのみのノートを Firestore にアップロード
 * - 2年超の古いドキュメントを Firestore から削除
 */
export async function initialSync(uid: string): Promise<void> {
  const validMonths = getValidMonthKeys()

  const snapshot = await restListDocs(`users/${uid}/notes`)

  // 2年超の古いドキュメントを削除
  const deletions = snapshot
    .filter(d => !validMonths.has(d.id))
    .map(d => restDeleteDoc(`users/${uid}/notes/${d.id}`))
  await Promise.all(deletions)

  if (snapshot.length === 0) {
    // 初回ログイン: ローカルデータを Firestore にアップロード
    const local = loadLocal()
    const groups = groupByMonth(local)
    const uploads = Object.entries(groups)
      .filter(([month]) => validMonths.has(month))
      .map(([month, notes]) =>
        restSetDoc(`users/${uid}/notes/${month}`, { ...notes, _updatedAt: new Date().toISOString() })
      )
    await Promise.all(uploads)
    return
  }

  // 既存ユーザー: Firestore 優先でマージ
  const firestoreNotes: RawNotes = {}
  const firestoreByMonth: Record<string, RawNotes> = {}
  for (const d of snapshot) {
    if (!validMonths.has(d.id)) continue
    const { _updatedAt: _at, ...notes } = d.data() as Record<string, unknown>
    Object.assign(firestoreNotes, notes)
    firestoreByMonth[d.id] = notes as RawNotes
  }

  const local = loadLocal()

  // 有効期間外のローカルノートを除去
  const validLocal: RawNotes = {}
  for (const [key, note] of Object.entries(local)) {
    if (validMonths.has(toMonthKey(key))) validLocal[key] = note
  }

  // ローカルで削除済み（pendingDelete）のキーは Firestore から復元しない
  const filteredFirestoreNotes: RawNotes = {}
  for (const [key, note] of Object.entries(firestoreNotes)) {
    if (!isPendingDelete(key)) filteredFirestoreNotes[key] = note
  }

  const merged: RawNotes = { ...validLocal, ...filteredFirestoreNotes } // Firestore 優先
  saveLocal(merged)

  // ローカルのみのノートを月ドキュメント単位でマージアップロード
  const localOnlyByMonth = groupByMonth(
    Object.fromEntries(
      Object.entries(validLocal).filter(([key]) => !(key in firestoreNotes))
    )
  )
  const uploads = Object.entries(localOnlyByMonth).map(([month, localNotes]) => {
    const existingMonthNotes = firestoreByMonth[month] ?? {}
    return restSetDoc(`users/${uid}/notes/${month}`, {
      ...existingMonthNotes,
      ...localNotes,
      _updatedAt: new Date().toISOString(),
    })
  })
  await Promise.all(uploads)
}

/**
 * ノートを Firestore に保存（その月のローカルデータで上書き）。
 * localStorage への書き込みは noteStorage.saveNote が行う。
 */
export async function saveNoteToFirestore(uid: string, key: string, note: DayNote): Promise<void> {
  const month = toMonthKey(key)
  const local = loadLocal()
  const monthNotes: RawNotes = {}
  for (const [k, v] of Object.entries(local)) {
    if (toMonthKey(k) === month) monthNotes[k] = v
  }

  const isEmpty = !note.title.trim() && !note.memo.trim() &&
    note.checklist.length === 0 && (note.schedules?.length ?? 0) === 0

  if (!isEmpty) {
    monthNotes[key] = note
  }

  // フィールドマスクを使って送信フィールドを明示する。
  // マスクにあってボディにないフィールド（削除されたノートのキー）は
  // Firestore から削除される。マスクなし PATCH は「マージ」になるため
  // 削除したキーが Firestore に残り、リスナーが復活させてしまう。
  const fieldMask = [...Object.keys(monthNotes), '_updatedAt']
  if (isEmpty && !(key in monthNotes)) {
    fieldMask.push(key) // 削除対象キーをマスクに含めてFirestoreからも消す
  }

  await restSetDoc(
    `users/${uid}/notes/${month}`,
    { ...monthNotes, _updatedAt: new Date().toISOString() },
    fieldMask,
  )

  // Firestore への削除が確定したのでマーカーを解除
  if (isEmpty) removePendingDelete(key)
}

/**
 * 他デバイスからの変更を localStorage に反映するリアルタイムリスナー。
 * 直近24ヶ月のドキュメントのみ監視。hasPendingWrites はスキップ。
 */
export function subscribeToNotes(uid: string, onRemoteChange: () => void): () => void {
  const validMonths = getValidMonthKeys()
  const monthList = [...validMonths]

  // Firestore の `in` クエリは最大30件まで
  const q = query(notesCol(uid), where('__name__', 'in', monthList.slice(0, 30)))

  return onSnapshot(
    q,
    (snapshot) => {
      const local = loadLocal()
      let changed = false

      snapshot.docChanges().forEach(change => {
        if (change.doc.metadata.hasPendingWrites) return

        if (change.type === 'removed') return

        const { _updatedAt, ...notes } = change.doc.data()
        for (const [key, note] of Object.entries(notes)) {
          if (JSON.stringify(note) !== JSON.stringify(local[key] ?? {})) {
            local[key] = note as Partial<DayNote>
            changed = true
          }
        }
      })

      if (changed) {
        saveLocal(local)
        onRemoteChange()
      }
    },
    (error) => console.error('[Firestore] snapshot error:', error)
  )
}

// ── スティッキーメモ同期 ──────────────────────────────────

/**
 * ログイン時のスティッキーメモ初期同期。
 * Firestore優先でマージ。ローカルのみのメモを Firestore にアップロード。
 * 同期後のメモ配列を返す。
 */
export async function syncStickyNotesOnLogin(uid: string): Promise<StickyNote[]> {
  const snap = await restGetDoc(`users/${uid}/data/stickyNotes`)
  const local = loadStickyNotes()

  if (!snap.exists()) {
    if (local.length > 0) {
      await restSetDoc(`users/${uid}/data/stickyNotes`, { notes: local, updatedAt: new Date().toISOString() })
    }
    return local
  }

  const remote: StickyNote[] = (snap.data().notes as StickyNote[] | undefined) ?? []
  const remoteIds = new Set(remote.map(n => n.id))
  const localOnly = local.filter(n => !remoteIds.has(n.id))
  const merged = [...remote, ...localOnly].slice(0, 1) // 最大1件

  saveStickyNotes(merged)

  const needsWrite = localOnly.length > 0 || remote.length > 1
  if (needsWrite) {
    await restSetDoc(`users/${uid}/data/stickyNotes`, { notes: merged, updatedAt: new Date().toISOString() })
  }

  return merged
}

/** スティッキーメモを Firestore に保存 */
export async function saveStickyNotesToFirestore(uid: string, notes: StickyNote[]): Promise<void> {
  await restSetDoc(`users/${uid}/data/stickyNotes`, { notes, updatedAt: new Date().toISOString() })
}

/** 他デバイスからのスティッキーメモ変更を購読 */
export function subscribeToStickyNotes(uid: string, onChange: (notes: StickyNote[]) => void): () => void {
  return onSnapshot(
    stickyNotesDocRef(uid),
    (snap) => {
      if (!snap.exists() || snap.metadata.hasPendingWrites) return
      const notes: StickyNote[] = (snap.data().notes ?? []).slice(0, 1)
      saveStickyNotes(notes)
      onChange(notes)
    },
    (err) => console.error('[Firestore] sticky notes error:', err)
  )
}
