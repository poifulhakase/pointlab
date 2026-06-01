import { describe, it, expect } from 'vitest'
import {
  getCancelPolicy, isSessionNow, formatBookingLabel, statusLabel,
  type Booking, type BookingStatus,
} from '../bookingTypes'

// 任意の Date を JST の wall-clock（date=YYYY-MM-DD / time=HH:MM）に変換する。
// `${date}T${time}:00+09:00` で元の瞬間（分精度）を再構成できる＝TZ非依存にテストできる。
function jstParts(t: Date): { date: string; time: string } {
  const j = new Date(t.getTime() + 9 * 3600_000)
  const iso = j.toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) }
}

const BASE: Booking = {
  id: 'b1', userId: 'u1', userDisplayName: 'テスト', userEmail: 't@example.com',
  slotId: 's1', date: '2026-05-20', startTime: '14:00', status: 'confirmed',
  requestedAt: '2026-05-01T00:00:00.000Z', updatedAt: '2026-05-01T00:00:00.000Z',
}

/** いま から hours 時間後にセッション開始の予約を作る（getCancelPolicy/isSessionNow は絶対時刻比較なのでTZ非依存） */
function bookingAt(hoursFromNow: number, status: BookingStatus = 'confirmed'): Booking {
  const { date, time } = jstParts(new Date(Date.now() + hoursFromNow * 3600_000))
  return { ...BASE, status, date, startTime: time }
}

describe('getCancelPolicy', () => {
  it('管理者は状態・時間に関わらず常時キャンセル可（always）', () => {
    expect(getCancelPolicy(bookingAt(1, 'confirmed'), true)).toBe('always')
    expect(getCancelPolicy(bookingAt(1, 'pending'), true)).toBe('always')
    expect(getCancelPolicy(bookingAt(-100, 'completed'), true)).toBe('always')
  })

  it('pending は本人でも常時キャンセル可（always）', () => {
    expect(getCancelPolicy(bookingAt(1, 'pending'), false)).toBe('always')
    expect(getCancelPolicy(bookingAt(100, 'pending'), false)).toBe('always')
  })

  it('confirmed 以外（cancelled/completed）は forbidden', () => {
    expect(getCancelPolicy(bookingAt(100, 'cancelled_user'), false)).toBe('forbidden')
    expect(getCancelPolicy(bookingAt(100, 'cancelled_admin'), false)).toBe('forbidden')
    expect(getCancelPolicy(bookingAt(100, 'completed'), false)).toBe('forbidden')
  })

  it('confirmed: 48h以上前は free', () => {
    expect(getCancelPolicy(bookingAt(50, 'confirmed'), false)).toBe('free')
    expect(getCancelPolicy(bookingAt(72, 'confirmed'), false)).toBe('free')
  })

  it('confirmed: 24〜48h前は warn', () => {
    expect(getCancelPolicy(bookingAt(36, 'confirmed'), false)).toBe('warn')
    expect(getCancelPolicy(bookingAt(25, 'confirmed'), false)).toBe('warn')
  })

  it('confirmed: 24h未満（過去含む）は forbidden', () => {
    expect(getCancelPolicy(bookingAt(12, 'confirmed'), false)).toBe('forbidden')
    expect(getCancelPolicy(bookingAt(1, 'confirmed'), false)).toBe('forbidden')
    expect(getCancelPolicy(bookingAt(-5, 'confirmed'), false)).toBe('forbidden')
  })
})

describe('isSessionNow', () => {
  it('開始時刻ちょうど（現在）はセッション中', () => {
    expect(isSessionNow(bookingAt(0))).toBe(true)
  })

  it('開始10分後（30分枠内）はセッション中', () => {
    expect(isSessionNow(bookingAt(-10 / 60))).toBe(true)
  })

  it('開始1時間前は未開始（5分前入室より早い）', () => {
    expect(isSessionNow(bookingAt(1))).toBe(false)
  })

  it('開始1時間後（30分枠終了済み）はセッション外', () => {
    expect(isSessionNow(bookingAt(-1))).toBe(false)
  })
})

describe('statusLabel', () => {
  it('全ステータスを日本語ラベルに変換', () => {
    expect(statusLabel('pending')).toBe('承認待ち')
    expect(statusLabel('confirmed')).toBe('確定')
    expect(statusLabel('cancelled_user')).toBe('キャンセル済')
    expect(statusLabel('cancelled_admin')).toBe('キャンセル（博士）')
    expect(statusLabel('completed')).toBe('完了')
  })
})

describe('formatBookingLabel', () => {
  // 昼間(14:00 JST = 05:00 UTC)なので UTC/JST いずれのランナーでも暦日が一致する
  it('年月日と開始時刻を含む整形ラベルを返す', () => {
    const label = formatBookingLabel({ ...BASE, date: '2026-05-20', startTime: '14:00' })
    expect(label).toContain('2026年5月20日')
    expect(label).toContain('14:00')
    expect(label).toMatch(/（[日月火水木金土]）/)
  })
})
