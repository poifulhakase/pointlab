import { auth } from './firebase'

const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

async function getToken(): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  return user.getIdToken()
}

function fromValue(v: Record<string, unknown>): unknown {
  if ('nullValue' in v) return null
  if ('booleanValue' in v) return v.booleanValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('stringValue' in v) return v.stringValue
  if ('arrayValue' in v) {
    const arr = (v.arrayValue as { values?: unknown[] }).values ?? []
    return arr.map(item => fromValue(item as Record<string, unknown>))
  }
  if ('mapValue' in v) {
    const fields = (v.mapValue as { fields?: Record<string, unknown> }).fields ?? {}
    return fromFields(fields)
  }
  return null
}

function fromFields(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([k, val]) => [k, fromValue(val as Record<string, unknown>)])
  )
}

export interface RestDocSnapshot {
  exists: () => boolean
  data: () => Record<string, unknown>
}

export interface RestDocItem {
  id: string
  data: () => Record<string, unknown>
}

export async function restGetDoc(path: string): Promise<RestDocSnapshot> {
  const token = await getToken()
  const res = await fetch(`${BASE}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 404) return { exists: () => false, data: () => ({}) }
  if (!res.ok) throw new Error(`Firestore REST ${res.status}: ${path}`)
  const json = await res.json() as { fields?: Record<string, unknown> }
  const parsed = fromFields(json.fields ?? {})
  return { exists: () => true, data: () => parsed }
}

export async function restListDocs(collectionPath: string): Promise<RestDocItem[]> {
  const token = await getToken()
  const res = await fetch(`${BASE}/${collectionPath}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Firestore REST ${res.status}: ${collectionPath}`)
  const json = await res.json() as { documents?: Array<{ name: string; fields?: Record<string, unknown> }> }
  const docs = json.documents ?? []
  return docs.map(doc => ({
    id: doc.name.split('/').pop()!,
    data: () => fromFields(doc.fields ?? {}),
  }))
}

function toValue(v: unknown): unknown {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return { integerValue: String(v) }
    return { doubleValue: v }
  }
  if (typeof v === 'string') return { stringValue: v }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } }
  if (typeof v === 'object') return { mapValue: { fields: toFields(v as Record<string, unknown>) } }
  return { nullValue: null }
}

function toFields(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toValue(v)]))
}

export async function restSetDoc(
  path: string,
  data: Record<string, unknown>,
  fieldMask?: string[],
): Promise<void> {
  const token = await getToken()
  // fieldMask を指定するとマスク内のフィールドのみ更新/削除。
  // マスクにあってボディにないフィールドは Firestore から削除される。
  // 指定しない場合は PATCH のマージ挙動（既存フィールドが残る）。
  let url = `${BASE}/${path}`
  if (fieldMask && fieldMask.length > 0) {
    url += '?' + fieldMask.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&')
  }
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: toFields(data) }),
  })
  if (!res.ok) throw new Error(`Firestore REST PATCH ${res.status}: ${path}`)
}

export async function restDeleteDoc(path: string): Promise<void> {
  const token = await getToken()
  const res = await fetch(`${BASE}/${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok && res.status !== 404) throw new Error(`Firestore REST DELETE ${res.status}: ${path}`)
}
