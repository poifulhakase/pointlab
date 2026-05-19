import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Slot, Booking } from '../utils/bookingTypes'
import {
  getAllSlots,
  addSlot,
  deleteSlot,
  getAllBookings,
  confirmBooking,
  cancelBooking,
  completeBooking,
  sendBookingEmail,
} from '../utils/bookingApi'
import { formatBookingLabel, statusLabel, getCancelPolicy } from '../utils/bookingTypes'

type Props = {
  isOpen:       boolean
  theme:        'dark' | 'light'
  onClose:      () => void
  onConnectNow?: () => void
}

type Tab = 'bookings' | 'slots'

export function AdminBookingPanel({ isOpen, theme, onClose, onConnectNow }: Props) {
  const L = theme === 'light'
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

  const [tab,      setTab]      = useState<Tab>('bookings')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [slots,    setSlots]    = useState<Slot[]>([])
  const [loading,  setLoading]  = useState(false)
  const [busy,     setBusy]     = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  // new slot form
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
  const [newDate, setNewDate] = useState(today)
  const [newTime, setNewTime] = useState('10:00')

  // confirm modal
  const [confirmAction, setConfirmAction] = useState<null | {
    label: string
    msg:   string
    fn:    () => Promise<void>
  }>(null)
  const [adminMsg, setAdminMsg] = useState('')

  useEffect(() => {
    if (!isOpen) return
    load()
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) return
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (confirmAction) setConfirmAction(null); else onClose() } }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [isOpen, onClose, confirmAction])

  async function load() {
    setLoading(true)
    setErrorMsg('')
    try {
      const [b, s] = await Promise.all([getAllBookings(), getAllSlots()])
      setBookings(b)
      setSlots(s)
    } catch (e) {
      setErrorMsg(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function handleAddSlot() {
    if (!newDate || !newTime) return
    setBusy('add-slot')
    try {
      await addSlot(newDate, newTime)
      await load()
    } catch (e) {
      setErrorMsg(String(e))
    } finally {
      setBusy(null)
    }
  }

  async function handleDeleteSlot(slot: Slot) {
    if (slot.isBooked) { setErrorMsg('予約済みの枠は削除できません'); return }
    setBusy(`del-${slot.id}`)
    try {
      await deleteSlot(slot.id)
      await load()
    } catch (e) {
      setErrorMsg(String(e))
    } finally {
      setBusy(null)
    }
  }

  function askConfirm(label: string, msg: string, fn: () => Promise<void>) {
    setAdminMsg('')
    setConfirmAction({ label, msg, fn })
  }

  async function runConfirm() {
    if (!confirmAction) return
    setBusy('confirm-action')
    try {
      await confirmAction.fn()
      setConfirmAction(null)
      await load()
    } catch (e) {
      setErrorMsg(String(e))
    } finally {
      setBusy(null)
    }
  }

  function handleConfirmBooking(b: Booking) {
    askConfirm('予約を承認', `${formatBookingLabel(b)} の予約を承認しますか？`, async () => {
      await confirmBooking(b, adminMsg || undefined)
      const updated = { ...b, status: 'confirmed' as const, adminMessage: adminMsg || '' }
      sendBookingEmail({ type: 'confirm', booking: updated }).catch(() => {
        setErrorMsg('予約を承認しましたが、メール送信に失敗しました。')
      })
    })
  }

  function handleCancelBooking(b: Booking) {
    const policy = getCancelPolicy(b, true)
    if (policy === 'forbidden') return
    askConfirm('予約をキャンセル', `${formatBookingLabel(b)} の予約をキャンセルしますか？`, async () => {
      await cancelBooking(b, true)
      const updated = { ...b, status: 'cancelled_admin' as const, adminMessage: adminMsg || '' }
      sendBookingEmail({ type: 'cancel_admin', booking: updated }).catch(() => {
        setErrorMsg('キャンセルしましたが、メール送信に失敗しました。')
      })
    })
  }

  function handleComplete(b: Booking) {
    askConfirm('完了にする', `${formatBookingLabel(b)} を完了としてマークしますか？`, async () => {
      await completeBooking(b)
    })
  }

  const statusColor: Record<string, string> = {
    pending:         L ? 'rgba(180,120,0,0.90)'  : 'rgba(251,191,36,0.95)',
    confirmed:       L ? 'rgba(0,130,80,0.90)'   : 'rgba(52,211,153,0.95)',
    cancelled_user:  L ? 'rgba(150,50,50,0.70)'  : 'rgba(248,113,113,0.70)',
    cancelled_admin: L ? 'rgba(150,50,50,0.70)'  : 'rgba(248,113,113,0.70)',
    completed:       L ? 'rgba(80,80,80,0.60)'   : 'rgba(120,120,120,0.70)',
  }

  if (!isOpen) return null

  const btnBase: React.CSSProperties = {
    padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700,
    letterSpacing: '0.04em', border: `1px solid ${CY_BORDER}`, color: CY_ACCENT, whiteSpace: 'nowrap',
    background: L ? 'rgba(0,100,180,0.07)' : 'rgba(0,180,255,0.07)',
  }
  const btnDanger: React.CSSProperties = {
    ...btnBase,
    border: `1px solid ${L ? 'rgba(200,0,0,0.22)' : 'rgba(248,113,113,0.22)'}`,
    color:  L ? 'rgba(180,30,30,0.85)' : 'rgba(248,113,113,0.85)',
    background: L ? 'rgba(200,0,0,0.04)' : 'rgba(200,0,0,0.06)',
  }

  return createPortal(
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 900, background: L ? 'rgba(180,200,220,0.55)' : 'rgba(0,4,16,0.75)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />

      <div
        style={{
          position: 'fixed', top: '50%', left: '50%', zIndex: 901,
          transform: 'translate(-50%,-50%)',
          width: 'min(700px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 48px)',
          display: 'flex', flexDirection: 'column',
          background: CY_BG,
          border: `1px solid ${CY_BORDER}`,
          borderRadius: 16,
          boxShadow: '0 0 40px rgba(0,180,255,0.12), 0 24px 60px rgba(0,0,0,0.7)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '14px 18px 12px', borderBottom: `1px solid ${CY_FAINT2}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: CY_DOT, boxShadow: '0 0 8px rgba(0,242,255,0.9)' }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: CY_DIM, fontFamily: CY_FONT, letterSpacing: '0.2em' }}>ADMIN — BOOKING MANAGER</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {onConnectNow && (
              <button
                onClick={() => { onClose(); onConnectNow() }}
                style={{ ...btnBase, padding: '4px 12px', background: L ? 'rgba(0,120,200,0.12)' : 'rgba(0,180,255,0.12)' }}
              >
                ▶ 接続
              </button>
            )}
            <button onClick={load} disabled={loading} style={{ ...btnBase, padding: '4px 10px', opacity: loading ? 0.5 : 1 }}>
              {loading ? '...' : '↺ 更新'}
            </button>
            <button
              onClick={onClose}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, cursor: 'pointer', background: L ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)', border: `1px solid ${CY_FAINT2}`, color: CY_FAINT, padding: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${CY_FAINT2}`, flexShrink: 0 }}>
          {(['bookings', 'slots'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '9px 20px', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                letterSpacing: '0.12em', fontFamily: CY_FONT,
                background: 'none', border: 'none',
                borderBottom: tab === t ? `2px solid ${CY_ACCENT}` : '2px solid transparent',
                color: tab === t ? CY_ACCENT : CY_FAINT,
                transition: 'all 0.15s',
              }}
            >
              {t === 'bookings' ? '予約管理' : '枠設定'}
            </button>
          ))}
        </div>

        {/* Error banner */}
        {errorMsg && (
          <div style={{ padding: '8px 18px', background: L ? 'rgba(200,0,0,0.06)' : 'rgba(200,0,0,0.10)', borderBottom: `1px solid rgba(200,0,0,0.15)`, flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: L ? 'rgba(180,30,30,0.90)' : 'rgba(248,113,113,0.90)' }}>{errorMsg}</span>
            <button onClick={() => setErrorMsg('')} style={{ marginLeft: 12, fontSize: 11, color: CY_FAINT, background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '14px 18px' }}>

          {/* ── BOOKINGS tab ── */}
          {tab === 'bookings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {bookings.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: CY_FAINT, fontSize: 13, fontFamily: CY_FONT }}>予約はありません</div>
              )}
              {bookings.map(b => (
                <div
                  key={b.id}
                  style={{
                    padding: '12px 14px', borderRadius: 10,
                    background: L ? 'rgba(0,100,180,0.04)' : 'rgba(0,180,255,0.04)',
                    border: `1px solid ${CY_FAINT2}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: CY_ACCENT, fontFamily: CY_FONT, marginBottom: 3 }}>
                        {formatBookingLabel(b)}
                      </div>
                      <div style={{ fontSize: 11, color: CY_FAINT, fontFamily: CY_FONT }}>{b.userDisplayName} — {b.userEmail}</div>
                      {b.adminMessage && <div style={{ fontSize: 11, color: L ? 'rgba(0,80,140,0.80)' : 'rgba(140,210,255,0.75)', marginTop: 4 }}>💬 {b.adminMessage}</div>}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: statusColor[b.status] || CY_FAINT, fontFamily: CY_FONT, whiteSpace: 'nowrap', paddingTop: 2 }}>
                      ● {statusLabel(b.status)}
                    </span>
                  </div>
                  {/* Action buttons */}
                  {(b.status === 'pending' || b.status === 'confirmed') && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      {b.status === 'pending' && (
                        <button style={btnBase} disabled={busy === 'confirm-action'} onClick={() => handleConfirmBooking(b)}>
                          ✓ 承認
                        </button>
                      )}
                      {b.status === 'confirmed' && (
                        <button style={btnBase} disabled={busy === 'confirm-action'} onClick={() => handleComplete(b)}>
                          完了
                        </button>
                      )}
                      <button style={btnDanger} disabled={busy === 'confirm-action'} onClick={() => handleCancelBooking(b)}>
                        キャンセル
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── SLOTS tab ── */}
          {tab === 'slots' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Add slot form */}
              <div style={{ padding: '14px 16px', borderRadius: 10, background: L ? 'rgba(0,100,180,0.04)' : 'rgba(0,180,255,0.04)', border: `1px solid ${CY_FAINT2}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: CY_DIM, fontFamily: CY_FONT, letterSpacing: '0.14em', marginBottom: 12 }}>ADD SLOT</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="date"
                    value={newDate}
                    min={today}
                    onChange={e => setNewDate(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 7, border: `1px solid ${CY_BORDER}`, background: L ? 'rgba(255,255,255,0.80)' : 'rgba(0,20,40,0.60)', color: L ? 'rgba(0,40,100,0.90)' : CY_ACCENT, fontSize: 13, fontFamily: CY_FONT, outline: 'none' }}
                  />
                  <input
                    type="time"
                    value={newTime}
                    onChange={e => setNewTime(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 7, border: `1px solid ${CY_BORDER}`, background: L ? 'rgba(255,255,255,0.80)' : 'rgba(0,20,40,0.60)', color: L ? 'rgba(0,40,100,0.90)' : CY_ACCENT, fontSize: 13, fontFamily: CY_FONT, outline: 'none' }}
                  />
                  <button
                    onClick={handleAddSlot}
                    disabled={busy === 'add-slot'}
                    style={{ ...btnBase, padding: '7px 18px', opacity: busy === 'add-slot' ? 0.5 : 1 }}
                  >
                    {busy === 'add-slot' ? '追加中...' : '+ 追加'}
                  </button>
                </div>
              </div>

              {/* Slot list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {slots.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: CY_FAINT, fontSize: 13, fontFamily: CY_FONT }}>枠がありません</div>
                )}
                {slots.map(slot => {
                  const d    = new Date(`${slot.date}T${slot.startTime}:00+09:00`)
                  const days = ['日', '月', '火', '水', '木', '金', '土']
                  const lbl  = `${d.getMonth() + 1}/${d.getDate()}（${days[d.getDay()]}）${slot.startTime}`
                  return (
                    <div
                      key={slot.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                        borderRadius: 8, border: `1px solid ${CY_FAINT2}`,
                        background: slot.isBooked ? (L ? 'rgba(0,100,180,0.04)' : 'rgba(0,180,255,0.04)') : 'transparent',
                        opacity: slot.isBooked ? 0.65 : 1,
                      }}
                    >
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: CY_ACCENT, fontFamily: CY_FONT }}>{lbl}</span>
                      {slot.isBooked && <span style={{ fontSize: 10, color: L ? 'rgba(180,120,0,0.90)' : 'rgba(251,191,36,0.85)', fontFamily: CY_FONT, letterSpacing: '0.08em' }}>予約済</span>}
                      {!slot.isBooked && (
                        <button
                          onClick={() => handleDeleteSlot(slot)}
                          disabled={!!busy?.startsWith('del-')}
                          style={{ ...btnDanger, padding: '4px 10px' }}
                        >
                          削除
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirm action dialog */}
      {confirmAction && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 910, background: 'rgba(0,0,0,0.45)' }} onClick={() => setConfirmAction(null)} />
          <div
            style={{
              position: 'fixed', top: '50%', left: '50%', zIndex: 911,
              transform: 'translate(-50%,-50%)',
              width: 'min(380px, calc(100vw - 48px))',
              background: CY_BG, border: `1px solid ${CY_BORDER}`,
              borderRadius: 14, overflow: 'hidden',
              boxShadow: '0 0 32px rgba(0,180,255,0.15), 0 16px 40px rgba(0,0,0,0.65)',
              padding: '20px 20px 20px',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: CY_ACCENT, fontFamily: CY_FONT, marginBottom: 12 }}>{confirmAction.label}</div>
            <div style={{ fontSize: 13, color: CY_FAINT, lineHeight: 1.7, marginBottom: 16 }}>{confirmAction.msg}</div>
            <textarea
              placeholder="メッセージ（任意）"
              value={adminMsg}
              onChange={e => setAdminMsg(e.target.value)}
              rows={2}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 7, marginBottom: 14, resize: 'vertical',
                border: `1px solid ${CY_BORDER}`, background: L ? 'rgba(255,255,255,0.80)' : 'rgba(0,20,40,0.60)',
                color: L ? 'rgba(0,40,100,0.90)' : CY_ACCENT, fontSize: 13, fontFamily: CY_FONT, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmAction(null)} style={{ ...btnBase, flex: 1, padding: '9px 0', background: L ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)', border: L ? '1px solid rgba(0,0,0,0.12)' : '1px solid rgba(255,255,255,0.12)', color: L ? 'rgba(50,80,120,0.75)' : 'rgba(180,200,220,0.7)' }}>
                キャンセル
              </button>
              <button
                onClick={runConfirm}
                disabled={busy === 'confirm-action'}
                style={{ ...btnBase, flex: 1, padding: '9px 0', opacity: busy === 'confirm-action' ? 0.5 : 1 }}
              >
                {busy === 'confirm-action' ? '処理中...' : '実行する'}
              </button>
            </div>
          </div>
        </>
      )}
    </>,
    document.body,
  )
}
