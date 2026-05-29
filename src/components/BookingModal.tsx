import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Slot, Booking } from '../utils/bookingTypes'
import {
  getAvailableSlots,
  getUserActiveBooking,
  requestBooking,
  cancelBooking,
  sendBookingEmail,
  sendBookingPush,
} from '../utils/bookingApi'
import { getCancelPolicy, isSessionNow, formatBookingLabel, statusLabel } from '../utils/bookingTypes'

type Props = {
  isOpen:       boolean
  theme:        'dark' | 'light'
  userId?:      string   // undefined = not logged in
  userName?:    string
  userEmail?:   string
  onClose:      () => void
  onConnectNow: () => void
  onOpenLogin?: () => void  // called when login is required
}

type Screen =
  | 'loading'
  | 'has_booking'  // user has active booking
  | 'slot_list'    // pick a slot
  | 'confirm_book' // confirm booking
  | 'booked'       // just booked
  | 'error'

export function BookingModal({ isOpen, theme, userId, userName, userEmail, onClose, onConnectNow, onOpenLogin }: Props) {
  const L = theme === 'light'
  const [screen,        setScreen]        = useState<Screen>('loading')
  const [slots,         setSlots]         = useState<Slot[]>([])
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null)
  const [selectedSlot,  setSelectedSlot]  = useState<Slot | null>(null)
  const [busy,          setBusy]          = useState(false)
  const [errorMsg,      setErrorMsg]      = useState('')

  // color palette
  const CY_ACCENT = L ? 'rgba(3,105,161,0.95)'  : 'rgba(0,230,255,0.95)'
  const CY_DIM    = L ? 'rgba(0,60,140,0.80)'   : 'rgba(0,220,255,0.80)'
  const CY_FAINT  = L ? 'rgba(30,80,160,0.65)'  : 'rgba(180,220,255,0.65)'
  const CY_BORDER = L ? 'rgba(0,100,180,0.35)'  : 'rgba(0,242,255,0.35)'
  const CY_FAINT2 = L ? 'rgba(0,100,180,0.15)'  : 'rgba(0,200,255,0.12)'
  const CY_DOT    = L ? 'rgba(0,120,200,0.7)'   : 'rgba(0,242,255,0.7)'
  const CY_BG     = L
    ? 'linear-gradient(160deg, rgba(238,248,255,0.99) 0%, rgba(228,242,255,0.99) 100%)'
    : 'linear-gradient(160deg, rgba(0,12,32,0.98) 0%, rgba(0,6,20,0.98) 100%)'
  const CY_FONT   = 'monospace' as const

  const statusColor: Record<string, string> = {
    pending:         L ? 'rgba(180,120,0,0.90)'  : 'rgba(251,191,36,0.95)',
    confirmed:       L ? 'rgba(0,130,80,0.90)'   : 'rgba(52,211,153,0.95)',
    cancelled_user:  L ? 'rgba(180,40,40,0.80)'  : 'rgba(248,113,113,0.85)',
    cancelled_admin: L ? 'rgba(180,40,40,0.80)'  : 'rgba(248,113,113,0.85)',
    completed:       L ? 'rgba(80,80,80,0.70)'   : 'rgba(150,150,150,0.70)',
  }

  useEffect(() => {
    if (!isOpen) return
    load()
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [isOpen, onClose])

  async function load() {
    setScreen('loading')
    setErrorMsg('')
    try {
      const avail = await getAvailableSlots()
      setSlots(avail)
      if (userId) {
        const active = await getUserActiveBooking(userId)
        setActiveBooking(active)
        setScreen(active ? 'has_booking' : 'slot_list')
      } else {
        setScreen('slot_list')
      }
      // ログイン後に選択枠を復元
      const pending = sessionStorage.getItem('poical-pending-slot')
      if (pending) {
        try {
          const saved: Slot = JSON.parse(pending)
          const match = avail.find(s => s.id === saved.id)
          if (match) setSelectedSlot(match)
        } catch { /* noop */ }
        sessionStorage.removeItem('poical-pending-slot')
      }
    } catch (e) {
      setErrorMsg(String(e))
      setScreen('error')
    }
  }

  async function handleBook() {
    if (!selectedSlot) return
    if (!userId || !userName || !userEmail) {
      sessionStorage.setItem('poical-pending-connect', '1')
      sessionStorage.setItem('poical-pending-slot', JSON.stringify(selectedSlot))
      onOpenLogin?.()
      onClose()
      return
    }
    setBusy(true)
    try {
      const bookId = await requestBooking(
        selectedSlot.id, selectedSlot.date, selectedSlot.startTime,
        userId, userName, userEmail,
      )
      // fire-and-forget email
      const newBooking: Booking = {
        id: bookId,
        userId, userDisplayName: userName, userEmail,
        slotId: selectedSlot.id,
        date: selectedSlot.date, startTime: selectedSlot.startTime,
        status: 'pending',
        adminMessage: '',
        requestedAt: new Date().toISOString(),
        updatedAt:   new Date().toISOString(),
      }
      sendBookingEmail({ type: 'request', booking: newBooking }).catch(() => {})
      sendBookingPush({ type: 'request', booking: newBooking }).catch(() => {})
      setActiveBooking(newBooking)
      setScreen('booked')
    } catch (e) {
      const msg = String(e)
      if (msg.includes('LIMIT_EXCEEDED')) {
        setErrorMsg('すでに予約が存在します。1件のみ予約可能です。')
      } else if (msg.includes('SLOT_UNAVAILABLE')) {
        setErrorMsg('この枠は既に埋まっています。別の枠を選んでください。')
      } else {
        setErrorMsg(msg)
      }
      setScreen('error')
    } finally {
      setBusy(false)
    }
  }

  async function handleCancel() {
    if (!activeBooking) return
    const policy = getCancelPolicy(activeBooking, false)
    if (policy === 'forbidden') return
    setBusy(true)
    try {
      await cancelBooking(activeBooking, false)
      sendBookingEmail({ type: 'cancel_user', booking: activeBooking }).catch(() => {})
      sendBookingPush({ type: 'cancel_user', booking: activeBooking }).catch(() => {})
      await load()
    } catch (e) {
      setErrorMsg(String(e))
      setScreen('error')
    } finally {
      setBusy(false)
    }
  }

  function downloadIcs() {
    if (!activeBooking) return
    const { date, startTime, id, userDisplayName } = activeBooking
    const params = new URLSearchParams({ date, startTime, bookingId: id, name: userDisplayName })
    window.open(`/api/booking-ics?${params}`, '_blank')
  }

  if (!isOpen) return null

  // ── Shared panel container ──────────────────────────────────────────────
  const panel = (content: React.ReactNode) => createPortal(
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 900, background: L ? 'rgba(180,200,220,0.55)' : 'rgba(0,4,16,0.75)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'fixed', top: '50%', left: '50%', zIndex: 901,
          transform: 'translate(-50%,-50%)',
          width: 'min(480px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 48px)',
          display: 'flex', flexDirection: 'column',
          background: CY_BG,
          border: `1px solid ${CY_BORDER}`,
          borderRadius: 16,
          boxShadow: '0 0 40px rgba(0,180,255,0.12), 0 24px 60px rgba(0,0,0,0.7)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="予約"
      >
        {/* Header */}
        <div style={{ padding: '14px 18px 12px', borderBottom: `1px solid ${CY_FAINT2}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: CY_DOT, boxShadow: '0 0 8px rgba(0,242,255,0.9)', flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: CY_DIM, fontFamily: CY_FONT, letterSpacing: '0.2em' }}>POIROBO CONNECT</span>
          </div>
          <button
            onClick={onClose}
            aria-label="閉じる"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, cursor: 'pointer', background: L ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)', border: `1px solid ${CY_FAINT2}`, color: CY_FAINT, padding: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        {content}
      </div>
    </>,
    document.body,
  )

  // ── Loading ──────────────────────────────────────────────────────────────
  if (screen === 'loading') return panel(
    <div style={{ padding: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: `2.5px solid ${CY_FAINT2}`, borderTopColor: CY_ACCENT, animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  // ── Error ────────────────────────────────────────────────────────────────
  if (screen === 'error') return panel(
    <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: L ? 'rgba(200,40,40,0.85)' : 'rgba(248,113,113,0.90)', textAlign: 'center' }}>{errorMsg || 'エラーが発生しました'}</span>
      <button onClick={load} style={{ padding: '8px 22px', borderRadius: 8, cursor: 'pointer', background: L ? 'rgba(0,100,180,0.12)' : 'rgba(0,180,255,0.10)', border: `1px solid ${CY_BORDER}`, color: CY_ACCENT, fontSize: 13, fontWeight: 600 }}>再試行</button>
    </div>
  )

  // ── Has active booking ───────────────────────────────────────────────────
  if (screen === 'has_booking' && activeBooking) {
    const policy  = getCancelPolicy(activeBooking, false)
    const nowSession = isSessionNow(activeBooking)
    return panel(
      <div style={{ padding: '20px 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* status badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: statusColor[activeBooking.status] || CY_FAINT, fontFamily: CY_FONT }}>
            ● {statusLabel(activeBooking.status).toUpperCase()}
          </span>
        </div>

        {/* booking detail card */}
        <div style={{ background: L ? 'rgba(0,100,180,0.05)' : 'rgba(0,180,255,0.05)', border: `1px solid ${CY_FAINT2}`, borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: CY_ACCENT, fontFamily: CY_FONT, letterSpacing: '0.03em' }}>
            {formatBookingLabel(activeBooking)}
          </div>
          <div style={{ fontSize: 11, color: CY_FAINT, marginTop: 6, fontFamily: CY_FONT }}>30分セッション</div>
          {activeBooking.adminMessage && (
            <div style={{ fontSize: 12, color: L ? 'rgba(0,80,140,0.85)' : 'rgba(140,210,255,0.85)', marginTop: 10, lineHeight: 1.6 }}>
              💬 {activeBooking.adminMessage}
            </div>
          )}
        </div>

        {/* connect now button (confirmed + session is active) */}
        {activeBooking.status === 'confirmed' && nowSession && (
          <button
            onClick={() => { onClose(); onConnectNow() }}
            style={{
              padding: '12px 0', borderRadius: 10, cursor: 'pointer', width: '100%',
              background: L ? 'linear-gradient(135deg, rgba(0,120,200,0.18) 0%, rgba(0,80,160,0.14) 100%)' : 'linear-gradient(135deg, rgba(0,160,255,0.25) 0%, rgba(0,100,200,0.18) 100%)',
              border: `1px solid rgba(0,200,255,0.5)`,
              color: CY_ACCENT, fontSize: 14, fontWeight: 700, letterSpacing: '0.06em',
              boxShadow: '0 0 16px rgba(0,180,255,0.15)',
            }}
          >
            今すぐ接続する →
          </button>
        )}

        {/* waiting message */}
        {activeBooking.status === 'confirmed' && !nowSession && (
          <div style={{ fontSize: 12, color: CY_FAINT, textAlign: 'center', lineHeight: 1.7, fontFamily: CY_FONT }}>
            セッション開始5分前になると<br />「今すぐ接続する」が表示されます。
          </div>
        )}
        {activeBooking.status === 'pending' && (
          <div style={{ fontSize: 12, color: L ? 'rgba(140,100,0,0.80)' : 'rgba(251,191,36,0.80)', textAlign: 'center', lineHeight: 1.7 }}>
            ぽいふる博士の承認をお待ちください。<br />承認されるとメールでお知らせします。
          </div>
        )}

        {/* .ics download */}
        {(activeBooking.status === 'pending' || activeBooking.status === 'confirmed') && (
          <button
            onClick={downloadIcs}
            style={{
              padding: '8px 0', borderRadius: 8, cursor: 'pointer', width: '100%',
              background: L ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${CY_FAINT2}`,
              color: CY_FAINT, fontSize: 12, fontWeight: 600, letterSpacing: '0.04em',
            }}
          >
            カレンダーに追加（.ics）
          </button>
        )}

        {/* cancel button */}
        <div style={{ borderTop: `1px solid ${CY_FAINT2}`, paddingTop: 14 }}>
          {policy === 'warn' && (
            <div style={{ fontSize: 11, color: L ? 'rgba(180,80,0,0.80)' : 'rgba(251,191,36,0.75)', marginBottom: 10, lineHeight: 1.6 }}>
              ⚠ 直前のキャンセルはご遠慮ください。
            </div>
          )}
          {policy === 'forbidden' ? (
            <div style={{ fontSize: 11, color: CY_FAINT, textAlign: 'center', lineHeight: 1.6 }}>
              開始24時間前を過ぎているためキャンセルできません。<br />
              変更が必要な場合はお問い合わせください。
            </div>
          ) : (
            <button
              onClick={handleCancel}
              disabled={busy}
              style={{
                padding: '8px 0', borderRadius: 8, cursor: busy ? 'wait' : 'pointer', width: '100%',
                background: L ? 'rgba(200,0,0,0.04)' : 'rgba(200,0,0,0.06)',
                border: `1px solid ${L ? 'rgba(200,0,0,0.22)' : 'rgba(248,113,113,0.22)'}`,
                color: L ? 'rgba(180,30,30,0.85)' : 'rgba(248,113,113,0.85)', fontSize: 12, fontWeight: 600, letterSpacing: '0.04em',
                opacity: busy ? 0.5 : 1,
              }}
            >
              {busy ? '処理中...' : '予約をキャンセル'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Slot list ────────────────────────────────────────────────────────────
  if (screen === 'slot_list') {
    // group by date
    const byDate: Record<string, Slot[]> = {}
    for (const s of slots) {
      if (!byDate[s.date]) byDate[s.date] = []
      byDate[s.date].push(s)
    }
    const days = ['日', '月', '火', '水', '木', '金', '土']

    return panel(
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ padding: '10px 18px 12px', borderBottom: `1px solid ${CY_FAINT2}`, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: CY_FAINT, fontFamily: CY_FONT, letterSpacing: '0.04em', lineHeight: 1.7 }}>
            空き枠を選んでご予約ください（30分固定・1件まで）
          </span>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '14px 18px' }}>
          {slots.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: CY_FAINT, fontSize: 13, fontFamily: CY_FONT }}>
              現在空き枠がありません。<br />またご確認ください。
            </div>
          ) : (
            Object.entries(byDate).map(([date, daySlots]) => {
              const d = new Date(`${date}T00:00:00+09:00`)
              const dateLabel = `${d.getMonth() + 1}/${d.getDate()}（${days[d.getDay()]}）`
              return (
                <div key={date} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: CY_DIM, fontFamily: CY_FONT, marginBottom: 8 }}>
                    {dateLabel.toUpperCase()}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {daySlots.map(slot => (
                      <button
                        key={slot.id}
                        onClick={() => { setSelectedSlot(slot); setScreen('confirm_book') }}
                        style={{
                          padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
                          background: L ? 'rgba(0,100,180,0.06)' : 'rgba(0,180,255,0.06)',
                          border: `1px solid ${CY_BORDER}`,
                          color: CY_ACCENT, fontSize: 13, fontWeight: 700, fontFamily: CY_FONT, letterSpacing: '0.04em',
                          transition: 'all 0.15s',
                        }}
                      >
                        {slot.startTime}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    )
  }

  // ── Confirm booking ──────────────────────────────────────────────────────
  if (screen === 'confirm_book' && selectedSlot) {
    const d    = new Date(`${selectedSlot.date}T${selectedSlot.startTime}:00+09:00`)
    const days = ['日', '月', '火', '水', '木', '金', '土']
    const lbl  = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）${selectedSlot.startTime}`

    return panel(
      <div style={{ padding: '20px 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: CY_FAINT, fontFamily: CY_FONT, marginBottom: 12 }}>以下の日時で予約申請しますか？</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: CY_ACCENT, fontFamily: CY_FONT, letterSpacing: '0.03em' }}>{lbl}</div>
          <div style={{ fontSize: 11, color: CY_FAINT, marginTop: 6, fontFamily: CY_FONT }}>30分セッション</div>
        </div>
        <div style={{ fontSize: 12, color: L ? 'rgba(30,60,120,0.65)' : 'rgba(180,210,240,0.65)', lineHeight: 1.7, textAlign: 'center' }}>
          申請後、ぽいふる博士が内容を確認して承認します。<br />
          承認されるとメールでお知らせします。
        </div>
        {!userId && (
          <div style={{ fontSize: 12, color: L ? 'rgba(180,120,0,0.85)' : 'rgba(251,191,36,0.85)', textAlign: 'center', lineHeight: 1.6, padding: '8px 12px', border: `1px solid ${L ? 'rgba(180,120,0,0.20)' : 'rgba(251,191,36,0.20)'}`, borderRadius: 8 }}>
            ⚠ 申請にはGoogleログインが必要です。<br />次の画面でログインしてください。
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button
            onClick={() => setScreen('slot_list')}
            style={{ flex: 1, padding: '10px 0', borderRadius: 9, cursor: 'pointer', background: L ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)', border: L ? '1px solid rgba(0,0,0,0.12)' : '1px solid rgba(255,255,255,0.12)', color: L ? 'rgba(50,80,120,0.75)' : 'rgba(180,200,220,0.7)', fontSize: 13, fontWeight: 600 }}
          >
            戻る
          </button>
          <button
            onClick={handleBook}
            disabled={busy}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 9, cursor: busy ? 'wait' : 'pointer',
              background: L ? 'linear-gradient(135deg, rgba(0,120,200,0.18) 0%, rgba(0,80,160,0.14) 100%)' : 'linear-gradient(135deg, rgba(0,160,255,0.25) 0%, rgba(0,100,200,0.18) 100%)',
              border: `1px solid rgba(0,200,255,0.5)`,
              color: CY_ACCENT, fontSize: 13, fontWeight: 700, letterSpacing: '0.06em',
              boxShadow: '0 0 16px rgba(0,180,255,0.15)',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? '申請中...' : '予約を申請する'}
          </button>
        </div>
      </div>
    )
  }

  // ── Booked confirmation ──────────────────────────────────────────────────
  if (screen === 'booked' && activeBooking) {
    return panel(
      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', border: `2px solid ${L ? 'rgba(0,120,200,0.55)' : 'rgba(0,220,255,0.55)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={CY_ACCENT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: CY_ACCENT, fontFamily: CY_FONT, marginBottom: 8 }}>予約申請を受け付けました</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: L ? 'rgba(0,60,140,0.90)' : 'rgba(180,220,255,0.90)', fontFamily: CY_FONT }}>{formatBookingLabel(activeBooking)}</div>
          <div style={{ fontSize: 12, color: CY_FAINT, marginTop: 8, lineHeight: 1.7 }}>
            承認メールをお待ちください。<br />カレンダーに追加しておくと便利です。
          </div>
        </div>
        <button
          onClick={downloadIcs}
          style={{
            padding: '8px 24px', borderRadius: 8, cursor: 'pointer',
            background: L ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${CY_FAINT2}`,
            color: CY_FAINT, fontSize: 12, fontWeight: 600,
          }}
        >
          カレンダーに追加（.ics）
        </button>
        <button
          onClick={onClose}
          style={{
            padding: '10px 32px', borderRadius: 9, cursor: 'pointer',
            background: L ? 'linear-gradient(135deg, rgba(0,120,200,0.18) 0%, rgba(0,80,160,0.14) 100%)' : 'linear-gradient(135deg, rgba(0,160,255,0.25) 0%, rgba(0,100,200,0.18) 100%)',
            border: `1px solid rgba(0,200,255,0.5)`,
            color: CY_ACCENT, fontSize: 13, fontWeight: 700, letterSpacing: '0.06em',
          }}
        >
          閉じる
        </button>
      </div>
    )
  }

  return null
}
