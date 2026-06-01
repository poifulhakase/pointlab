import { getAuthInstance } from './firebase'
import type { Slot, Booking } from './bookingTypes'

const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

async function token(): Promise<string> {
  const auth = await getAuthInstance()
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  return user.getIdToken()
}

// ── Firestore value helpers ────────────────────────────────────────────────

function fromVal(v: Record<string, unknown>): unknown {
  if ('nullValue'    in v) return null
  if ('booleanValue' in v) return v.booleanValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue'  in v) return v.doubleValue
  if ('stringValue'  in v) return v.stringValue
  if ('timestampValue' in v) return v.timestampValue
  if ('arrayValue'   in v) {
    const arr = (v.arrayValue as { values?: unknown[] }).values ?? []
    return arr.map(i => fromVal(i as Record<string, unknown>))
  }
  if ('mapValue' in v) {
    const f = (v.mapValue as { fields?: Record<string, unknown> }).fields ?? {}
    return fromFields(f)
  }
  return null
}

function fromFields(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([k, val]) => [k, fromVal(val as Record<string, unknown>)])
  )
}

function toVal(v: unknown): unknown {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return { integerValue: String(v) }
    return { doubleValue: v }
  }
  if (typeof v === 'string') return { stringValue: v }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toVal) } }
  if (typeof v === 'object') return { mapValue: { fields: toFields(v as Record<string, unknown>) } }
  return { nullValue: null }
}

function toFields(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toVal(v)]))
}

// ── Generic REST helpers ───────────────────────────────────────────────────

async function listDocs(col: string, noAuth = false): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  const headers: Record<string, string> = {}
  if (!noAuth) {
    headers['Authorization'] = `Bearer ${await token()}`
  }
  const res = await fetch(`${BASE}/${col}`, { headers })
  if (!res.ok) throw new Error(`Firestore LIST ${res.status}: ${col}`)
  const json = await res.json() as { documents?: Array<{ name: string; fields?: Record<string, unknown> }> }
  return (json.documents ?? []).map(d => ({
    id:   d.name.split('/').pop()!,
    data: fromFields(d.fields ?? {}),
  }))
}

async function setDoc(path: string, data: Record<string, unknown>): Promise<void> {
  const t   = await token()
  const res = await fetch(`${BASE}/${path}`, {
    method:  'PATCH',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fields: toFields(data) }),
  })
  if (!res.ok) throw new Error(`Firestore PATCH ${res.status}: ${path}`)
}

async function createDoc(col: string, data: Record<string, unknown>): Promise<string> {
  const t   = await token()
  const res = await fetch(`${BASE}/${col}`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fields: toFields(data) }),
  })
  if (!res.ok) throw new Error(`Firestore POST ${res.status}: ${col}`)
  const json = await res.json() as { name: string }
  return json.name.split('/').pop()!
}

async function deleteDoc(path: string): Promise<void> {
  const t   = await token()
  const res = await fetch(`${BASE}/${path}`, {
    method:  'DELETE',
    headers: { Authorization: `Bearer ${t}` },
  })
  if (!res.ok && res.status !== 404) throw new Error(`Firestore DELETE ${res.status}: ${path}`)
}

/** runQuery でコレクションをフィールド等値条件でサーバー側フィルタリング */
async function queryDocs(
  col: string,
  field: string,
  value: string,
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  const t   = await token()
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`
  const res = await fetch(url, {
    method:  'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: col }],
        where: {
          fieldFilter: {
            field: { fieldPath: field },
            op:    'EQUAL',
            value: { stringValue: value },
          },
        },
      },
    }),
  })
  if (!res.ok) throw new Error(`Firestore QUERY ${res.status}: ${col}`)
  const json = await res.json() as Array<{ document?: { name: string; fields?: Record<string, unknown> } }>
  return json
    .filter(item => item.document)
    .map(item => ({
      id:   item.document!.name.split('/').pop()!,
      data: fromFields(item.document!.fields ?? {}),
    }))
}

// ── Slot operations ────────────────────────────────────────────────────────

/** Fetch all available (unbooked) slots within the next 2 weeks — works without login */
export async function getAvailableSlots(): Promise<Slot[]> {
  const auth = await getAuthInstance()
  const docs = await listDocs('slots', !auth.currentUser)
  const now   = new Date()
  const limit = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

  return docs
    .map(d => ({ id: d.id, ...d.data } as unknown as Slot))
    .filter(s => {
      if (s.isBooked) return false
      const dt = new Date(`${s.date}T${s.startTime}:00+09:00`)
      return dt > now && dt <= limit
    })
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
}

/** Admin: add a slot */
export async function addSlot(date: string, startTime: string): Promise<string> {
  return createDoc('slots', {
    date,
    startTime,
    isBooked:  false,
    createdAt: new Date().toISOString(),
  })
}

/** Admin: delete a slot (must not be booked) */
export async function deleteSlot(slotId: string): Promise<void> {
  await deleteDoc(`slots/${slotId}`)
}

/** Admin: get all slots (including booked ones) */
export async function getAllSlots(): Promise<Slot[]> {
  const docs = await listDocs('slots')
  return docs
    .map(d => ({ id: d.id, ...d.data } as unknown as Slot))
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))
}

// ── Booking operations ─────────────────────────────────────────────────────

/** User: request a booking for a slot (server-side で slot 更新を実行) */
export async function requestBooking(
  slotId: string,
  _slotDate: string,
  _slotTime: string,
  _userId: string,
  userDisplayName: string,
  userEmail: string,
): Promise<string> {
  const auth = await getAuthInstance()
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  const idToken = await user.getIdToken()

  const res = await fetch('/api/create-booking', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ idToken, slotId, userDisplayName, userEmail }),
  })
  const json = await res.json() as { ok?: boolean; bookingId?: string; error?: string }
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
  return json.bookingId!
}

/** Get user's single active booking (pending or confirmed) */
export async function getUserActiveBooking(userId: string): Promise<Booking | null> {
  const docs = await queryDocs('bookings', 'userId', userId)
  const active = docs.find(d => {
    const b = d.data as unknown as Booking
    return b.status === 'pending' || b.status === 'confirmed'
  })
  if (!active) return null
  return { id: active.id, ...active.data } as unknown as Booking
}

/** Get all bookings for a user (full history) */
export async function getUserBookings(userId: string): Promise<Booking[]> {
  const docs = await queryDocs('bookings', 'userId', userId)
  return docs
    .map(d => ({ id: d.id, ...d.data } as unknown as Booking))
    .sort((a, b) => (b.requestedAt ?? '').localeCompare(a.requestedAt ?? ''))
}

/** Admin: get all bookings */
export async function getAllBookings(): Promise<Booking[]> {
  const docs = await listDocs('bookings')
  return docs
    .map(d => ({ id: d.id, ...d.data } as unknown as Booking))
    .sort((a, b) => (b.requestedAt ?? '').localeCompare(a.requestedAt ?? ''))
}

/**
 * User or admin: cancel a booking.
 * スロット解放を含めサーバー側（Admin SDK）で実行する。
 * 以前はクライアントが直接 slots.isBooked を書いていたため改ざんの穴があった。
 */
export async function cancelBooking(
  booking: Booking,
  _isAdmin: boolean,
): Promise<void> {
  const auth = await getAuthInstance()
  const user = auth.currentUser
  if (!user) throw new Error('Not authenticated')
  const idToken = await user.getIdToken()

  const res = await fetch('/api/cancel-booking', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ idToken, bookingId: booking.id }),
  })
  if (!res.ok) {
    const json = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(json.error ?? `HTTP ${res.status}`)
  }
}

/** Admin: confirm a booking */
export async function confirmBooking(booking: Booking, adminMessage?: string): Promise<void> {
  await setDoc(`bookings/${booking.id}`, {
    ...booking,
    status:       'confirmed',
    adminMessage: adminMessage ?? '',
    updatedAt:    new Date().toISOString(),
  })
}

/** Admin: mark booking as completed */
export async function completeBooking(booking: Booking): Promise<void> {
  await setDoc(`bookings/${booking.id}`, {
    ...booking,
    status:    'completed',
    updatedAt: new Date().toISOString(),
  })
}

// ── Email notification ─────────────────────────────────────────────────────

export async function sendBookingEmail(payload: {
  type: 'request' | 'confirm' | 'cancel_user' | 'cancel_admin'
  booking: Booking
}): Promise<void> {
  const res = await fetch('/api/send-booking-email', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText)
    throw new Error(`HTTP ${res.status}: ${detail}`)
  }
}

export async function sendBookingPush(payload: {
  type: 'request' | 'confirm' | 'cancel_user' | 'cancel_admin'
  booking: Booking
}): Promise<void> {
  await fetch('/api/send-booking-push', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })
}
