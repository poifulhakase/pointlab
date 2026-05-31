import { useState, useEffect, useCallback } from 'react'
import type { User } from 'firebase/auth'
import { getUserActiveBooking, getAllBookings } from '../utils/bookingApi'
import type { BookingSlot } from '../utils/bookingTypes'
import { isAdminEmail } from '../utils/admin'
import { dateKey } from '../utils/jstDate'

/**
 * カレンダーに表示する予約（ぽいロボ コネクト）スロットの取得。
 * 管理者は全予約、一般ユーザーは自分のアクティブ予約のみ。
 */
export function useBooking(user: User | null) {
  const [bookingMap, setBookingMap] = useState<Map<string, BookingSlot[]>>(new Map())

  useEffect(() => {
    if (!user) { setBookingMap(new Map()); return }
    const fetchFn = isAdminEmail(user.email)
      ? getAllBookings()
      : getUserActiveBooking(user.uid).then(b => b ? [b] : [])
    fetchFn.then(bookings => {
      const map = new Map<string, BookingSlot[]>()
      for (const b of bookings) {
        if (b.status !== 'pending' && b.status !== 'confirmed') continue
        const slot: BookingSlot = {
          startTime: b.startTime,
          confirmed: b.status === 'confirmed',
          label: b.status === 'confirmed' ? 'コネクト確定' : 'コネクト（仮）',
        }
        const existing = map.get(b.date) ?? []
        existing.push(slot)
        map.set(b.date, existing)
      }
      setBookingMap(map)
    }).catch(() => {})
  }, [user])  

  const getBookingEvents = useCallback((d: Date): BookingSlot[] => {
    return bookingMap.get(dateKey(d)) ?? []
  }, [bookingMap])

  return { getBookingEvents }
}
