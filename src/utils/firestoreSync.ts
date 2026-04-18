import {
  collection, doc, getDocs, setDoc, deleteDoc,
  onSnapshot, query, where, getDoc,
} from 'firebase/firestore'
import { db } from './firebase'
import type { DayNote } from './noteStorage'

type Channel = { id: string; name: string }

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

function monthDocRef(uid: string, monthKey: string) {
  return doc(db, 'users', uid, 'notes', monthKey)
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

  // Firestore の全ドキュメントを取得（月ドキュメント一覧）
  const snapshot = await getDocs(notesCol(uid))

  // 2年超の古いドキュメントを削除
  const deletions: Promise<void>[] = []
  snapshot.forEach(d => {
    if (!validMonths.has(d.id)) {
      deletions.push(deleteDoc(monthDocRef(uid, d.id)))
    }
  })
  await Promise.all(deletions)

  if (snapshot.empty) {
    // 初回ログイン: ローカルデータを Firestore にアップロード
    const local = loadLocal()
    const groups = groupByMonth(local)
    const uploads = Object.entries(groups)
      .filter(([month]) => validMonths.has(month))
      .map(([month, notes]) =>
        setDoc(monthDocRef(uid, month), { ...notes, _updatedAt: new Date().toISOString() })
      )
    await Promise.all(uploads)
    return
  }

  // 既存ユーザー: Firestore 優先でマージ
  const firestoreNotes: RawNotes = {}
  snapshot.forEach(d => {
    if (!validMonths.has(d.id)) return
    const { _updatedAt, ...notes } = d.data()
    Object.assign(firestoreNotes, notes)
  })

  const local = loadLocal()

  // 有効期間外のローカルノートを除去
  const validLocal: RawNotes = {}
  for (const [key, note] of Object.entries(local)) {
    if (validMonths.has(toMonthKey(key))) validLocal[key] = note
  }

  const merged: RawNotes = { ...validLocal, ...firestoreNotes } // Firestore 優先
  saveLocal(merged)

  // ローカルのみのノートを Firestore にアップロード
  const localOnlyByMonth = groupByMonth(
    Object.fromEntries(
      Object.entries(validLocal).filter(([key]) => !(key in firestoreNotes))
    )
  )
  const uploads = Object.entries(localOnlyByMonth).map(([month, notes]) =>
    setDoc(monthDocRef(uid, month), { ...notes, _updatedAt: new Date().toISOString() }, { merge: true })
  )
  await Promise.all(uploads)
}

/**
 * ノートを Firestore に保存（その月のドキュメントをマージ更新）。
 * localStorage への書き込みは noteStorage.saveNote が行う。
 */
export async function saveNoteToFirestore(uid: string, key: string, note: DayNote): Promise<void> {
  const month = toMonthKey(key)
  const isEmpty = !note.title.trim() && !note.memo.trim() &&
    note.checklist.length === 0 && !note.scheduled

  if (isEmpty) {
    // フィールド削除: FieldValue.delete() の代わりにローカルの全データで上書き
    const local = loadLocal()
    const monthNotes: RawNotes = {}
    for (const [k, v] of Object.entries(local)) {
      if (toMonthKey(k) === month) monthNotes[k] = v
    }
    await setDoc(monthDocRef(uid, month), { ...monthNotes, _updatedAt: new Date().toISOString() })
  } else {
    await setDoc(
      monthDocRef(uid, month),
      { [key]: note, _updatedAt: new Date().toISOString() },
      { merge: true }
    )
  }
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

// ── YouTube チャンネル同期 ────────────────────────────────

const CHANNELS_KEY = 'poical-yt-channels'

function channelsDoc(uid: string) {
  return doc(db, 'users', uid, 'data', 'channels')
}

function loadLocalChannels(): Channel[] {
  try { return JSON.parse(localStorage.getItem(CHANNELS_KEY) ?? '[]') } catch { return [] }
}

/**
 * ログイン時のチャンネル初期同期。
 * Firestoreにデータがあれば Firestore 優先でマージ、なければローカルをアップロード。
 */
export async function syncChannelsOnLogin(uid: string): Promise<void> {
  const snap = await getDoc(channelsDoc(uid))
  const local = loadLocalChannels()

  if (!snap.exists()) {
    if (local.length > 0) {
      await setDoc(channelsDoc(uid), { channels: local, updatedAt: new Date().toISOString() })
    }
    return
  }

  const firestoreChannels: Channel[] = snap.data().channels ?? []

  // Firestore 優先。ローカルのみのチャンネルを末尾に追加
  const firestoreIds = new Set(firestoreChannels.map(c => c.id))
  const localOnly = local.filter(c => !firestoreIds.has(c.id))
  const merged = [...firestoreChannels, ...localOnly]

  localStorage.setItem(CHANNELS_KEY, JSON.stringify(merged))

  if (localOnly.length > 0) {
    await setDoc(channelsDoc(uid), { channels: merged, updatedAt: new Date().toISOString() })
  }
}

/** チャンネルリストを Firestore に保存 */
export async function saveChannelsToFirestore(uid: string, channels: Channel[]): Promise<void> {
  await setDoc(channelsDoc(uid), { channels, updatedAt: new Date().toISOString() })
}
