export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled_user'
  | 'cancelled_admin'
  | 'completed'

export interface Slot {
  id: string
  date: string      // YYYY-MM-DD
  startTime: string // HH:MM
  isBooked: boolean
  createdAt?: string
}

export interface Booking {
  id: string
  userId: string
  userDisplayName: string
  userEmail: string
  slotId: string
  date: string      // YYYY-MM-DD
  startTime: string // HH:MM
  status: BookingStatus
  adminMessage?: string
  requestedAt: string // ISO string
  updatedAt: string   // ISO string
}

export type CancelPolicy =
  | 'free'       // 48h+ before
  | 'warn'       // 24-48h before
  | 'forbidden'  // <24h before
  | 'always'     // pending or admin

/** Returns cancel policy for a booking */
export function getCancelPolicy(booking: Booking, isAdmin: boolean): CancelPolicy {
  if (isAdmin) return 'always'
  if (booking.status === 'pending') return 'always'
  if (booking.status !== 'confirmed') return 'forbidden'

  const sessionStart = new Date(`${booking.date}T${booking.startTime}:00+09:00`)
  const hoursUntil = (sessionStart.getTime() - Date.now()) / (1000 * 60 * 60)

  if (hoursUntil >= 48) return 'free'
  if (hoursUntil >= 24) return 'warn'
  return 'forbidden'
}

/** Returns true if the booking's session is happening right now (±15 min) */
export function isSessionNow(booking: Booking): boolean {
  const start = new Date(`${booking.date}T${booking.startTime}:00+09:00`)
  const end   = new Date(start.getTime() + 30 * 60 * 1000)
  const now   = new Date()
  // allow joining 5 min early
  return now >= new Date(start.getTime() - 5 * 60 * 1000) && now < end
}

/** Returns formatted date label e.g. "2026年5月20日 (水) 14:00" */
export function formatBookingLabel(booking: Booking): string {
  const d = new Date(`${booking.date}T${booking.startTime}:00+09:00`)
  const days = ['日', '月', '火', '水', '木', '金', '土']
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）${booking.startTime}`
}

export function statusLabel(status: BookingStatus): string {
  switch (status) {
    case 'pending':          return '承認待ち'
    case 'confirmed':        return '確定'
    case 'cancelled_user':   return 'キャンセル済'
    case 'cancelled_admin':  return 'キャンセル（博士）'
    case 'completed':        return '完了'
  }
}
