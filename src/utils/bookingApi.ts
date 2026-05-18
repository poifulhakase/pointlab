import { auth } from './firebase'
import type { Slot, Booking, BookingStatus } from './bookingTypes'

const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

async function token(): Promise<string> {
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

async function getDoc(path: string): Promise<Record<string, unknown> | null> {
  const t   = await token()
  const res = await fetch(`${BASE}/${path}`, { headers: { Authorization: `Bearer ${t}` } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Firestore GET ${res.status}: ${path}`)
  const json = await res.json() as { fields?: Record<string, unknown> }
  return fromFields(json.fields ?? {})
}

async function listDocs(col: string): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  const t   = await token()
  const res = await fetch(`${BASE}/${col}`, { headers: { Authorization: `Bearer ${t}` } })
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

// ── Slot operations ────────────────────────────────────────────────────────

/** Fetch all available (unbooked) slots within the next 2 weeks */
export async function getAvailableSlots(): Promise<Slot[]> {
  const docs = await listDocs('slots')
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

/** User: request a booking for a slot */
export async function requestBooking(
  slotId: string,
  slotDate: string,
  slotTime: string,
  userId: string,
  userDisplayName: string,
  userEmail: string,
): Promise<string> {
  // Check 1-booking-per-user limit
  const existing = await getUserActiveBooking(userId)
  if (existing) throw new Error('LIMIT_EXCEEDED')

  // Mark slot as booked
  const slot = await getDoc(`slots/${slotId}`)
  if (!slot || slot.isBooked) throw new Error('SLOT_UNAVAILABLE')

  const now    = new Date().toISOString()
  const bookId = await createDoc('bookings', {
    userId,
    userDisplayName,
    userEmail,
    slotId,
    date:            slotDate,
    startTime:       slotTime,
    status:          'pending',
    adminMessage:    '',
    requestedAt:     now,
    updatedAt:       now,
  })

  await setDoc(`slots/${slotId}`, { ...slot, isBooked: true })
  return bookId
}

/** Get user's single active booking (pending or confirmed) */
export async function getUserActiveBooking(userId: string): Promise<Booking | null> {
  const docs = await listDocs('bookings')
  const active = docs.find(d => {
    const b = d.data as unknown as Booking
    return b.userId === userId &&
      (b.status === 'pending' || b.status === 'confirmed')
  })
  if (!active) return null
  return { id: active.id, ...active.data } as unknown as Booking
}

/** Get all bookings for a user (full history) */
export async function getUserBookings(userId: string): Promise<Booking[]> {
  const docs = await listDocs('bookings')
  return docs
    .filter(d => (d.data as unknown as Booking).userId === userId)
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

/** User or admin: cancel a booking */
export async function cancelBooking(
  booking: Booking,
  isAdmin: boolean,
): Promise<void> {
  const newStatus: BookingStatus = isAdmin ? 'cancelled_admin' : 'cancelled_user'
  await setDoc(`bookings/${booking.id}`, {
    ...booking,
    status:    newStatus,
    updatedAt: new Date().toISOString(),
  })
  // Free up the slot
  const slot = await getDoc(`slots/${booking.slotId}`)
  if (slot) {
    await setDoc(`slots/${booking.slotId}`, { ...slot, isBooked: false })
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
  await fetch('/api/send-booking-email', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })
}
