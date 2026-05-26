import { useEffect, useState, useRef, lazy, Suspense } from 'react'
import type { ConnectUser }  from './JitsiPanel'

const NoteView            = lazy(() => import('./NoteView').then(m => ({ default: m.NoteView })))
const PoiroboAboutPanel   = lazy(() => import('./PoiroboAboutPanel').then(m => ({ default: m.PoiroboAboutPanel })))
const BookingModal        = lazy(() => import('./BookingModal').then(m => ({ default: m.BookingModal })))
const AdminBookingPanel   = lazy(() => import('./AdminBookingPanel').then(m => ({ default: m.AdminBookingPanel })))

type Props = {
  theme: 'dark' | 'light'
  isMobile: boolean
  user?: ConnectUser | null
  isConnected?: boolean
  onStartConnect?: () => void
  onOpenManual?: () => void
  onOpenLegal?: () => void
  onOpenBacktest?: () => void
  onOpenEvals?: () => void
  onNavigate?: (view: 'month' | 'chart' | 'quant') => void
  onOpenSettings?: () => void
  onOpenAccount?: () => void
  onToggleTheme?: () => void
  syncStatus?: string
  onOpenSpec?: () => void
  onPoiroboChange?: (open: boolean) => void
  pushEnabled?: boolean
  onTogglePush?: () => void
}

function ViewLoader() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        border: '3px solid rgba(255,255,255,0.15)',
        borderTopColor: 'rgba(255,255,255,0.7)',
        animation: 'spin 0.7s linear infinite',
      }} />
    </div>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}
function DataIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 0 3-3h7z"/>
    </svg>
  )
}
function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  )
}
function RobotMenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="13" rx="2"/>
      <path d="M12 8V5"/><circle cx="12" cy="4" r="1.2"/>
      <circle cx="8.5" cy="14" r="1.2" fill="currentColor" stroke="none"/>
      <circle cx="15.5" cy="14" r="1.2" fill="currentColor" stroke="none"/>
      <path d="M9 18h6"/>
    </svg>
  )
}

// ── Menu data ──────────────────────────────────────────────────────────────
type MenuView = 'month' | 'chart' | 'quant' | 'note' | null
type MenuItem = { id: string; label: string; sub: string; accent: string; glow: string; view: MenuView; icon: React.ReactNode }

const MENU_ITEMS: MenuItem[] = [
  { id: 'poirobo',  label: 'Poirobo',  sub: 'ぽいロボとは？', accent: '#34d399', glow: 'rgba(52,211,153,0.45)',  view: null, icon: <RobotMenuIcon /> },
  { id: 'data',     label: 'Data',     sub: '資料',           accent: '#a78bfa', glow: 'rgba(167,139,250,0.45)', view: null, icon: <DataIcon />      },
  { id: 'settings', label: 'Settings', sub: '設定',           accent: '#fbbf24', glow: 'rgba(251,191,36,0.45)',  view: null, icon: <GearIcon />      },
  { id: 'contact',  label: 'Contact',  sub: 'お問い合わせ',   accent: '#f472b6', glow: 'rgba(244,114,182,0.45)', view: null, icon: <MailIcon />      },
]

// ── Contact Form ──────────────────────────────────────────────────────────
const FORM_ACTION   = 'https://docs.google.com/forms/d/e/1FAIpQLSfAwqrLssbR0EKh19J3m634gvJtggSbTrl7wDYjWGc3K4-j0A/formResponse'
const ENTRY_TYPE    = 'entry.557781178'
const ENTRY_CONTENT = 'entry.1905599788'

const RADIO_OPTIONS = [
  { value: 'individual', label: '個人のお客様', formValue: '個人のお客様' },
  { value: 'corporate',  label: '法人のお客様', formValue: '法人のお客様' },
  { value: 'other',      label: 'その他',       formValue: 'その他'       },
] as const

type RadioValue = typeof RADIO_OPTIONS[number]['value'] | ''

function ContactForm({ theme }: { theme: 'dark' | 'light' }) {
  const [customerType, setCustomerType] = useState<RadioValue>('')
  const [otherText,    setOtherText]    = useState('')
  const [content,      setContent]      = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')

  const errColor = theme === 'light' ? '#dc2626' : '#f87171'
  const canSubmit = customerType !== '' && content.trim().length > 0

  const handleSubmit = async () => {
    if (!canSubmit || status === 'sending') return
    setStatus('sending')
    const typeFormValue = customerType === 'other'
      ? (otherText.trim() || 'その他')
      : (RADIO_OPTIONS.find(o => o.value === customerType)?.formValue ?? '')
    try {
      await fetch(FORM_ACTION, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          [ENTRY_TYPE]:    typeFormValue,
          [ENTRY_CONTENT]: content.trim(),
        }).toString(),
      })
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  const baseInput: React.CSSProperties = {
    background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 8,
    color: 'var(--text)', fontSize: 13, padding: '9px 12px', outline: 'none',
    width: '100%', boxSizing: 'border-box', fontFamily: 'inherit',
    transition: 'border-color 0.18s',
  }

  if (status === 'done') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '52px 24px', gap: 18 }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(100,120,200,0.15)',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--view-btn-active-color)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.04em' }}>送信しました</div>
          <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.75 }}>
            お問い合わせを送信しました。内容を確認後、ご連絡いたします。<br/>
            <span style={{ fontSize: 11, opacity: 0.65 }}>※通信状況によっては届いていない場合があります。</span>
          </div>
        </div>
        <button
          onClick={() => { setStatus('idle'); setCustomerType(''); setOtherText(''); setContent('') }}
          style={{
            marginTop: 6, padding: '8px 22px', borderRadius: 8, cursor: 'pointer',
            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
            color: 'var(--text-sub)', fontSize: 12, fontWeight: 600,
          }}
        >
          別の内容を送る
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.72 }}>
        ご要望・ご意見・バグ報告など、お気軽にお送りください。
      </p>

      {/* お客様種別 */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
          お客様種別 <span style={{ color: errColor, marginLeft: 2 }}>*</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {RADIO_OPTIONS.map(opt => (
            <label
              key={opt.value}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 14px', borderRadius: 10, cursor: 'pointer',
                background: customerType === opt.value ? 'var(--view-btn-active-bg)' : 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                transition: 'background 0.15s',
              }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${customerType === opt.value ? 'var(--view-btn-active-color)' : 'var(--glass-border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}>
                {customerType === opt.value && (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--view-btn-active-color)' }} />
                )}
              </div>
              <input type="radio" name="customerType" value={opt.value}
                checked={customerType === opt.value}
                onChange={() => setCustomerType(opt.value)}
                style={{ display: 'none' }} />
              <span style={{
                fontSize: 13,
                color: customerType === opt.value ? 'var(--view-btn-active-color)' : 'var(--text-sub)',
                fontWeight: customerType === opt.value ? 600 : 400,
              }}>
                {opt.label}
              </span>
            </label>
          ))}
          {customerType === 'other' && (
            <input
              type="text"
              placeholder="詳しく教えてください（任意）"
              value={otherText}
              onChange={e => setOtherText(e.target.value)}
              style={{ ...baseInput, marginTop: 2 }}
            />
          )}
        </div>
      </section>

      {/* お問い合わせの内容 */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
          お問い合わせの内容 <span style={{ color: errColor, marginLeft: 2 }}>*</span>
        </div>
        <textarea
          rows={6}
          placeholder="ご要望・バグ報告・ご意見をご自由にどうぞ"
          value={content}
          onChange={e => setContent(e.target.value)}
          style={{ ...baseInput, resize: 'vertical', minHeight: 120 }}
        />
        <span style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'right' }}>{content.length} 文字</span>
      </section>

      {status === 'error' && (
        <p style={{ margin: 0, fontSize: 12, color: errColor }}>
          送信に失敗しました。時間をおいて再度お試しください。
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit || status === 'sending'}
        style={{
          alignSelf: 'flex-end',
          padding: '9px 24px', borderRadius: 8,
          ...(canSubmit
            ? { background: 'var(--view-btn-active-bg)', color: 'var(--view-btn-active-color)', border: '1px solid transparent', boxShadow: '0 2px 8px rgba(100,120,200,0.15)' }
            : { background: 'transparent', color: 'var(--text-sub)', border: '1px solid var(--glass-border)' }),
          fontSize: 13, fontWeight: 600, letterSpacing: '0.06em',
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          transition: 'all 0.15s',
          opacity: status === 'sending' ? 0.65 : 1,
        }}
      >
        {status === 'sending' ? '送信中...' : '送信する →'}
      </button>
    </div>
  )
}

// ── Floating particles ────────────────────────────────────────────────────
const LAB_PARTICLES: { left: string; top: string; size: number; dur: number; delay: number; op: number; anim: string }[] = [
  { left: '7%',  top: '88%', size: 3, dur: 24, delay: 0,    op: 0.34, anim: 'labDrift1' },
  { left: '21%', top: '70%', size: 2, dur: 30, delay: -6,   op: 0.24, anim: 'labDrift2' },
  { left: '38%', top: '92%', size: 4, dur: 21, delay: -12,  op: 0.28, anim: 'labDrift1' },
  { left: '55%', top: '78%', size: 2, dur: 33, delay: -8,   op: 0.20, anim: 'labDrift2' },
  { left: '64%', top: '60%', size: 3, dur: 26, delay: -17,  op: 0.28, anim: 'labDrift1' },
  { left: '79%', top: '85%', size: 2, dur: 19, delay: -3,   op: 0.22, anim: 'labDrift2' },
  { left: '14%', top: '45%', size: 3, dur: 28, delay: -10,  op: 0.18, anim: 'labDrift1' },
  { left: '47%', top: '35%', size: 2, dur: 22, delay: -20,  op: 0.20, anim: 'labDrift2' },
  { left: '72%', top: '65%', size: 3, dur: 27, delay: -14,  op: 0.24, anim: 'labDrift1' },
  { left: '89%', top: '50%', size: 2, dur: 23, delay: -7,   op: 0.18, anim: 'labDrift2' },
  { left: '30%', top: '95%', size: 2, dur: 31, delay: -4,   op: 0.26, anim: 'labDrift1' },
  { left: '58%', top: '42%', size: 3, dur: 25, delay: -16,  op: 0.15, anim: 'labDrift2' },
  { left: '3%',  top: '75%', size: 2, dur: 29, delay: -2,   op: 0.22, anim: 'labDrift2' },
  { left: '16%', top: '97%', size: 3, dur: 20, delay: -9,   op: 0.30, anim: 'labDrift1' },
  { left: '27%', top: '55%', size: 2, dur: 35, delay: -13,  op: 0.18, anim: 'labDrift2' },
  { left: '43%', top: '82%', size: 3, dur: 23, delay: -5,   op: 0.26, anim: 'labDrift1' },
  { left: '50%', top: '48%', size: 2, dur: 27, delay: -19,  op: 0.16, anim: 'labDrift2' },
  { left: '61%', top: '90%', size: 4, dur: 22, delay: -11,  op: 0.28, anim: 'labDrift1' },
  { left: '75%', top: '38%', size: 2, dur: 32, delay: -15,  op: 0.16, anim: 'labDrift2' },
  { left: '83%', top: '72%', size: 3, dur: 21, delay: -1,   op: 0.24, anim: 'labDrift1' },
  { left: '93%', top: '62%', size: 2, dur: 26, delay: -8,   op: 0.18, anim: 'labDrift2' },
  { left: '10%', top: '28%', size: 2, dur: 34, delay: -22,  op: 0.14, anim: 'labDrift1' },
  { left: '35%', top: '18%', size: 3, dur: 29, delay: -17,  op: 0.14, anim: 'labDrift2' },
  { left: '68%', top: '25%', size: 2, dur: 24, delay: -24,  op: 0.12, anim: 'labDrift1' },
  { left: '5%',  top: '58%', size: 2, dur: 28, delay: -18,  op: 0.20, anim: 'labDrift2' },
  { left: '42%', top: '12%', size: 2, dur: 36, delay: -26,  op: 0.12, anim: 'labDrift1' },
  { left: '85%', top: '30%', size: 3, dur: 23, delay: -21,  op: 0.16, anim: 'labDrift2' },
  { left: '25%', top: '83%', size: 2, dur: 20, delay: -11,  op: 0.24, anim: 'labDrift1' },
  { left: '52%', top: '20%', size: 2, dur: 31, delay: -28,  op: 0.13, anim: 'labDrift2' },
  { left: '96%', top: '80%', size: 3, dur: 25, delay: -5,   op: 0.20, anim: 'labDrift1' },
]

// ── メインビュー ────────────────────────────────────────────────────────────
export function SupportView({ theme, isMobile, user, isConnected = false, onStartConnect, onOpenManual, onOpenLegal, onOpenBacktest, onOpenEvals, onOpenSettings: _onOpenSettings, onOpenAccount, onToggleTheme, syncStatus = '', onOpenSpec, onPoiroboChange, pushEnabled = false, onTogglePush }: Props) {
  const ADMIN_EMAIL = 'sushi.ramen.unajyu@gmail.com'
  const isAdmin     = user?.email === ADMIN_EMAIL

  const [visible,       setVisible]       = useState(false)
  const [bookingOpen,   setBookingOpen]   = useState(false)
  const [adminOpen,     setAdminOpen]     = useState(false)
  const [ripples,       setRipples]       = useState<{ id: number; x: number; y: number }[]>([])
  const [activeDrawer,   setActiveDrawer]   = useState<'data' | 'contact' | 'settings' | null>(null)
  const [drawerVisible,  setDrawerVisible]  = useState(false)
  const [showPoirobo,   setShowPoirobo]   = useState(false)

  const rippleIdRef = useRef(0)
  const menuRef     = useRef<HTMLDivElement>(null)

  const PENDING_KEY = 'poical-pending-connect'

  // ログイン成功後に自動で予約モーダルを開く（リダイレクト方式でも機能するよう sessionStorage で永続化）
  useEffect(() => {
    if (user && sessionStorage.getItem(PENDING_KEY)) {
      sessionStorage.removeItem(PENDING_KEY)
      setBookingOpen(true)
    }
  }, [user])

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true))
    })
    return () => cancelAnimationFrame(id)
  }, [])

  const DATA_RETURN_KEY = 'poical-return-data-drawer'

  const openDrawer = (type: 'data' | 'contact' | 'settings') => {
    setActiveDrawer(type)
    requestAnimationFrame(() => requestAnimationFrame(() => setDrawerVisible(true)))
  }

  const closeDrawer = () => {
    setDrawerVisible(false)
    setTimeout(() => setActiveDrawer(null), 320)
  }

  // DATA ドロワー経由でサブページに遷移した場合、戻ったときに DATA ドロワーを再表示
  useEffect(() => {
    if (sessionStorage.getItem(DATA_RETURN_KEY)) {
      sessionStorage.removeItem(DATA_RETURN_KEY)
      openDrawer('data')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRipple = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isConnected) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const id = ++rippleIdRef.current
    setRipples(prev => [...prev, { id, x, y }])
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 1000)
  }


  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', userSelect: 'none' }} onPointerDown={handleRipple}>
      <style>{`
        @keyframes supportKenBurns {
          0%   { transform: scale(1.08); }
          100% { transform: scale(1.00); }
        }
        @keyframes supportRipple {
          0%   { transform: translate(-50%,-50%) scale(0); opacity: 1; }
          70%  { opacity: 0.4; }
          100% { transform: translate(-50%,-50%) scale(1); opacity: 0; }
        }

        /* ── Menu ── */
        .menu3d-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .menu3d-item {
          opacity: 0;
          animation: menu3dEnter 0.50s cubic-bezier(0.2,0,0.1,1) forwards;
        }
        @keyframes menu3dEnter {
          from { opacity: 0; transform: translateX(-52px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        .menu3d-btn {
          position: relative;
          display: flex;
          align-items: center;
          width: 270px;
          height: 76px;
          padding: 0;
          border: 2px solid rgba(0,205,255,0.45);
          border-radius: 6px 20px 6px 20px;
          background: rgba(2,12,28,0.42);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          cursor: pointer;
          transform: scale(1.00);
          transition: transform 0.20s ease,
                      box-shadow 0.20s ease,
                      border-color 0.20s ease;
          overflow: visible;
          box-shadow:
            0 0 14px rgba(0,205,255,0.22),
            0 0 32px rgba(0,205,255,0.08),
            inset 0 1px 0 rgba(255,255,255,0.06),
            0 4px 20px rgba(0,0,0,0.45);
        }

        .menu3d-btn:hover {
          transform: scale(1.03);
          border-color: rgba(0,235,255,0.70);
          box-shadow:
            0 0 30px rgba(0,225,255,0.72),
            0 0 65px rgba(0,225,255,0.26),
            inset 0 1px 0 rgba(255,255,255,0.18),
            0 12px 30px rgba(0,0,0,0.45);
        }

        .menu3d-btn:active {
          transform: scale(0.98);
        }

        /* Corner brackets */
        .menu3d-tl,
        .menu3d-br {
          position: absolute;
          width: 13px;
          height: 13px;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.22s ease, transform 0.30s cubic-bezier(0.2,0,0.1,1);
        }
        .menu3d-tl {
          top: 4px; left: 4px;
          border-top: 2px solid rgba(50,200,255,0.90);
          border-left: 2px solid rgba(50,200,255,0.90);
          border-radius: 2px 0 0 0;
          transform: translate(-5px, -5px);
        }
        .menu3d-br {
          bottom: 4px; right: 4px;
          border-bottom: 2px solid rgba(50,200,255,0.90);
          border-right: 2px solid rgba(50,200,255,0.90);
          border-radius: 0 0 2px 0;
          transform: translate(5px, 5px);
        }
        .menu3d-btn:hover .menu3d-tl {
          opacity: 1;
          transform: translate(0, 0);
        }
        .menu3d-btn:hover .menu3d-br {
          opacity: 1;
          transform: translate(0, 0);
        }

        /* Icon area */
        .menu3d-icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 58px;
          height: 76px;
          flex-shrink: 0;
          color: var(--accent);
          filter: drop-shadow(0 0 5px var(--glow));
          transition: filter 0.28s ease;
        }
        .menu3d-btn:hover .menu3d-icon-wrap {
          filter: drop-shadow(0 0 12px var(--glow));
        }

        /* Divider */
        .menu3d-divider {
          width: 1px;
          height: 36px;
          background: rgba(50,180,255,0.20);
          flex-shrink: 0;
        }

        /* Labels */
        .menu3d-labels {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: center;
          flex: 1;
          padding: 0 18px;
          gap: 5px;
          min-width: 0;
        }
        .menu3d-label {
          color: #ffffff;
          font-size: 15px;
          font-weight: 800;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          line-height: 1;
          white-space: nowrap;
        }
        .menu3d-sub {
          color: rgba(180,230,255,0.85);
          font-size: 11px;
          letter-spacing: 0.06em;
          line-height: 1;
          white-space: nowrap;
        }

        /* Header */
        .menu3d-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 24px;
        }
        .menu3d-header-label {
          color: rgba(100,210,255,0.60);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          text-shadow: 0 0 10px rgba(100,210,255,0.40);
        }
        .menu3d-header-line {
          flex: 1;
          height: 1px;
          background: linear-gradient(to right, rgba(50,180,255,0.55) 0%, transparent 75%);
          max-width: 130px;
        }


        /* ── Mobile menu overrides（2カラムグリッド・横並び） ── */
        .menu3d-mobile .menu3d-list {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .menu3d-mobile .menu3d-btn {
          width: 100%;
          height: 64px;
          flex-direction: row;
          justify-content: flex-start;
          align-items: center;
          padding: 0;
          background: rgba(2,12,28,0.82);
          box-shadow:
            0 0 14px rgba(0,205,255,0.22),
            0 0 32px rgba(0,205,255,0.08),
            inset 0 1px 0 rgba(255,255,255,0.06),
            0 4px 20px rgba(0,0,0,0.65);
        }
        .menu3d-mobile .menu3d-divider {
          display: flex;
          height: 29px;
          flex-shrink: 0;
        }
        .menu3d-mobile .menu3d-icon-wrap {
          width: 46px;
          height: 64px;
          margin-bottom: 0;
          flex-shrink: 0;
        }
        .menu3d-mobile .menu3d-labels {
          flex: 1;
          align-items: flex-start;
          padding: 0 8px 0 10px;
          gap: 5px;
          min-width: 0;
        }
        .menu3d-mobile .menu3d-label { font-size: 11px; letter-spacing: 0.12em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .menu3d-mobile .menu3d-sub   { font-size: 9px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .menu3d-mobile .menu3d-header { margin-bottom: 14px; }

        /* ── Light mode overrides ── */
        .menu3d-light .menu3d-btn {
          background: rgba(214,233,255,0.82);
          border-color: rgba(0,120,200,0.40);
          box-shadow:
            0 0 14px rgba(0,120,200,0.15),
            0 0 32px rgba(0,120,200,0.06),
            inset 0 1px 0 rgba(255,255,255,0.80),
            0 4px 20px rgba(0,0,0,0.10);
        }
        .menu3d-light .menu3d-btn:hover {
          border-color: rgba(0,140,220,0.65);
          box-shadow:
            0 0 24px rgba(0,140,220,0.35),
            0 0 50px rgba(0,140,220,0.12),
            inset 0 1px 0 rgba(255,255,255,0.90),
            0 8px 24px rgba(0,0,0,0.12);
        }
        .menu3d-light .menu3d-label { color: rgba(10,20,60,0.90) !important; }
        .menu3d-light .menu3d-sub   { color: rgba(30,60,120,0.70) !important; }
        .menu3d-light .menu3d-header-label { color: rgba(0,60,140,0.65); text-shadow: none; }
        .menu3d-light .menu3d-header-line  { background: linear-gradient(to right, rgba(0,120,200,0.40) 0%, transparent 75%); }
        .menu3d-light .menu3d-divider      { background: rgba(0,100,180,0.18); }
        .menu3d-light .menu3d-tl { border-color: rgba(0,140,220,0.80); }
        .menu3d-light .menu3d-br { border-color: rgba(0,140,220,0.80); }

        /* ── Connect button ── */
        @keyframes slow-rotate { to { transform: rotate(360deg); } }
        @keyframes cyberTooltipFlicker {
          0%, 60%       { opacity: 0; }
          61%           { opacity: 0.6; }
          62%           { opacity: 0;   }
          63%, 95%      { opacity: 1;   }
          96%           { opacity: 0.2; }
          97%           { opacity: 1;   }
          98%           { opacity: 0;   }
          100%          { opacity: 0;   }
        }
        @keyframes text-subtle-poyon {
          0%   { transform: translateY(0) scale(1); }
          40%  { transform: translateY(-4px) scale(1.03); }
          70%  { transform: translateY(1px) scale(0.99); }
          100% { transform: translateY(0) scale(1); }
        }
        .poyon-connect-area {
          position: relative;
          width: clamp(130px, 30vw, 180px); height: clamp(130px, 30vw, 180px);
          display: flex; justify-content: center; align-items: center;
          cursor: pointer; -webkit-tap-highlight-color: transparent;
        }
        .poyon-scanner-ring {
          position: absolute; width: 110%; height: 110%;
          border: 1px solid rgba(0,242,255,0.2); border-radius: 50%;
          animation: slow-rotate 15s linear infinite; pointer-events: none;
        }
        .poyon-main-core {
          position: relative; width: 90%; height: 90%;
          background: rgba(8,12,16,0.92);
          border: 1px solid rgba(0,242,255,0.45); border-radius: 50%;
          display: flex; flex-direction: column; justify-content: center; align-items: center;
          box-shadow: inset 0 0 25px rgba(0,242,255,0.3);
          transition: all 0.4s cubic-bezier(0.175,0.885,0.32,1.275);
          backdrop-filter: blur(8px); overflow: hidden;
        }
        .poyon-connect-area:hover .poyon-main-core {
          transform: scale(1.05); border-color: #00f2ff;
          box-shadow: 0 0 30px rgba(0,242,255,0.4), inset 0 0 20px rgba(0,242,255,0.3);
        }
        .poyon-connect-area:active .poyon-main-core {
          transform: scale(0.92) translateY(3px); filter: brightness(1.2); transition: 0.1s;
        }
        .poyon-image-mask {
          width: 40%; height: 40%; border-radius: 50%; overflow: hidden;
          margin-bottom: 5px; transform: translateY(-4px); background-color: #080c10;
        }
        .poyon-doctor-image {
          width: auto; height: 110%;
          filter: sepia(1) hue-rotate(150deg) saturate(1.2) brightness(0.7) contrast(1.1);
          transition: 0.4s ease; opacity: 0.8;
        }
        .poyon-connect-area:hover .poyon-doctor-image {
          filter: sepia(1) hue-rotate(150deg) saturate(1.6) brightness(0.9) contrast(1.1);
          opacity: 1; transform: scale(1.05);
        }
        .poyon-text-main {
          font-size: clamp(9px,2.5vw,12px); font-weight: 900;
          color: #f0f8ff; text-shadow: 0 0 10px #00f2ff; text-align: center;
        }
        .poyon-text-sub {
          font-size: clamp(6px,1.5vw,8px); color: #00f2ff;
          font-weight: bold; margin-top: 3px; text-align: center;
        }
        .poyon-connect-area:hover .poyon-text-wrap {
          animation: text-subtle-poyon 0.5s cubic-bezier(0.25,1,0.5,1) forwards;
        }

        /* ── Light mode: poyon button ── */
        .poyon-light .poyon-scanner-ring {
          border-color: rgba(0,100,180,0.28);
        }
        .poyon-light .poyon-main-core {
          background: rgba(230,243,255,0.90);
          border-color: rgba(0,100,180,0.50);
          box-shadow: inset 0 0 20px rgba(0,100,180,0.12);
        }
        .poyon-light .poyon-connect-area:hover .poyon-main-core {
          border-color: rgba(0,140,220,0.80);
          box-shadow: 0 0 24px rgba(0,120,200,0.28), inset 0 0 14px rgba(0,100,180,0.14);
        }
        .poyon-light .poyon-image-mask {
          background-color: rgba(210,232,255,0.85);
        }
        .poyon-light .poyon-doctor-image {
          filter: none;
          opacity: 0.88;
        }
        .poyon-light .poyon-connect-area:hover .poyon-doctor-image {
          filter: none;
          opacity: 1;
        }
        .poyon-light .poyon-text-main {
          color: rgba(10,30,80,0.90);
          text-shadow: 0 0 8px rgba(0,120,200,0.20);
        }
        .poyon-light .poyon-text-sub {
          color: rgba(0,100,180,0.80);
        }

        /* ── Lab floating particles ── */
        @keyframes labDrift1 {
          0%   { transform: translate(0px, 0px);     opacity: 0; }
          8%   { opacity: 1; }
          30%  { transform: translate(13px, -24vh);  }
          65%  { transform: translate(-8px, -51vh);  }
          92%  { opacity: 0.7; }
          100% { transform: translate(5px, -72vh);   opacity: 0; }
        }
        @keyframes labDrift2 {
          0%   { transform: translate(0px, 0px);     opacity: 0; }
          8%   { opacity: 1; }
          35%  { transform: translate(-15px, -27vh); }
          60%  { transform: translate(9px, -47vh);   }
          92%  { opacity: 0.6; }
          100% { transform: translate(-4px, -70vh);  opacity: 0; }
        }
      `}</style>

      {/* 背景画像 */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url(${import.meta.env.BASE_URL}support-room.webp)`,
        backgroundSize: 'cover',
        backgroundPosition: isMobile ? '72% top' : 'center top',
        opacity: visible ? 1 : 0,
        animation: visible ? 'supportKenBurns 4s cubic-bezier(0.4,0,0.2,1) forwards' : 'none',
        transition: 'opacity 1.6s ease',
        zIndex: 0,
      }} />

      {/* ライトモード用 白オーバーレイ */}
      {theme === 'light' && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(240,248,255,0.62)',
          pointerEvents: 'none', zIndex: 1,
        }} />
      )}

      {/* 下部グラデーション */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 160,
        background: theme === 'light'
          ? 'linear-gradient(to bottom, transparent 0%, rgba(220,235,255,0.80) 100%)'
          : 'linear-gradient(to bottom, transparent 0%, rgba(8,20,40,0.75) 100%)',
        pointerEvents: 'none', zIndex: 1,
      }} />


      {/* 波紋 */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
        {ripples.map(r => (
          <div key={r.id} style={{
            position: 'absolute', left: r.x, top: r.y,
            width: 700, height: 700, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(180,230,255,0.55) 0%, rgba(103,232,249,0.28) 35%, transparent 68%)',
            animation: 'supportRipple 1s cubic-bezier(0.2,0.6,0.4,1) forwards',
            pointerEvents: 'none',
          }} />
        ))}
      </div>

      {/* コンテンツ */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>

        {/* ━━ 研究室 ━━ */}
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>

          {/* 浮遊粒子 */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            {LAB_PARTICLES.map((p, i) => (
              <div key={i} style={{
                position: 'absolute',
                left: p.left, top: p.top,
                width: p.size, height: p.size,
                borderRadius: '50%',
                background: theme === 'dark' ? 'rgba(180,225,255,0.88)' : 'rgba(20,60,140,0.72)',
                opacity: p.op,
                animation: `${p.anim} ${p.dur}s linear ${p.delay}s infinite`,
              }} />
            ))}
          </div>

          <div
            ref={menuRef}
            className={[isMobile ? 'menu3d-mobile' : '', theme === 'light' ? 'menu3d-light' : ''].filter(Boolean).join(' ') || undefined}
            style={isMobile
              ? { position: 'absolute', top: 28, left: 16, right: 16 }
              : { position: 'absolute', top: 36, left: 32 }
            }
          >
            {/* ヘッダー */}
            <div className="menu3d-header">
              <span className="menu3d-header-label">Navigate</span>
              <span className="menu3d-header-line" />
            </div>

            {/* メニューリスト */}
            <ul className="menu3d-list">
              {MENU_ITEMS.map((item, i) => (
                <li
                  key={item.id}
                  className="menu3d-item"
                  style={{
                    '--accent': item.accent,
                    '--glow':   item.glow,
                    animationDelay: `${i * 85 + 120}ms`,
                  } as React.CSSProperties}
                >
                  <button
                    className="menu3d-btn"
                    onClick={() => {
                      if (item.id === 'settings') { openDrawer('settings'); return }
                      if (item.id === 'data')     { openDrawer('data');    return }
                      if (item.id === 'contact')  { openDrawer('contact'); return }
                      if (item.id === 'poirobo')  { setShowPoirobo(true); onPoiroboChange?.(true); return }
                    }}
                  >
                    <span className="menu3d-tl" />
                    <span className="menu3d-br" />
                    <span className="menu3d-icon-wrap">{item.icon}</span>
                    <span className="menu3d-divider" />
                    <span className="menu3d-labels">
                      <span className="menu3d-label" style={{ color: '#ffffff' }}>{item.label}</span>
                      <span className="menu3d-sub" style={{ color: 'rgba(190,235,255,0.88)' }}>{item.sub}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

      </div>

      {/* 予約モーダル */}
      {bookingOpen && !isAdmin && (
        <Suspense fallback={null}>
          <BookingModal
            isOpen={bookingOpen}
            theme={theme}
            userId={user?.uid}
            userName={user?.displayName ?? 'ユーザー'}
            userEmail={user?.email ?? ''}
            onClose={() => setBookingOpen(false)}
            onConnectNow={() => { setBookingOpen(false); onStartConnect?.() }}
            onOpenLogin={() => { setBookingOpen(false); onOpenAccount?.() }}
          />
        </Suspense>
      )}

      {/* 管理者パネル */}
      {adminOpen && isAdmin && (
        <Suspense fallback={null}>
          <AdminBookingPanel
            isOpen={adminOpen}
            theme={theme}
            onClose={() => setAdminOpen(false)}
            onConnectNow={() => { setAdminOpen(false); onStartConnect?.() }}
          />
        </Suspense>
      )}

      {/* ━━ DATA / CONTACT ドロワー ━━ */}
      {activeDrawer && (
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 40,
            background: drawerVisible ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0)',
            transition: 'background 0.32s ease',
            backdropFilter: drawerVisible ? 'blur(2px)' : 'none',
            WebkitBackdropFilter: drawerVisible ? 'blur(2px)' : 'none',
          }}
          onClick={closeDrawer}
        >
          <div
            style={{
              position: 'absolute',
              top: 0, right: 0, bottom: 0,
              width: isMobile ? '100%' : 500,
              background: theme === 'light' ? 'rgba(245,250,255,0.97)' : 'rgba(6,12,26,0.97)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderLeft: isMobile ? 'none' : theme === 'light' ? '1px solid rgba(0,100,180,0.18)' : '1px solid rgba(0,200,255,0.15)',
              boxShadow: theme === 'light' ? '-12px 0 48px rgba(0,0,0,0.12)' : '-12px 0 48px rgba(0,0,0,0.55)',
              transform: drawerVisible ? 'translateX(0)' : 'translateX(100%)',
              transition: 'transform 0.32s cubic-bezier(0.4,0,0.2,1)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* ドロワーヘッダー */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 16px',
              borderBottom: theme === 'light' ? '1px solid rgba(0,100,180,0.15)' : '1px solid rgba(0,200,255,0.12)',
              background: theme === 'light' ? 'rgba(220,235,255,0.90)' : 'rgba(0,8,20,0.85)',
              flexShrink: 0,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: theme === 'light' ? 'rgba(0,100,200,0.7)' : 'rgba(0,220,255,0.7)', boxShadow: theme === 'light' ? '0 0 7px rgba(0,100,200,0.5)' : '0 0 7px rgba(0,220,255,0.9)', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 10, fontWeight: 700, color: theme === 'light' ? 'rgba(0,60,140,0.80)' : 'rgba(80,200,255,0.85)', letterSpacing: '0.22em' }}>
                {activeDrawer === 'data' ? 'DATA / 資料'
                  : activeDrawer === 'contact' ? 'CONTACT / お問い合わせ'
                  : 'SETTINGS / 設定'}
              </span>
              <button
                onClick={closeDrawer}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: 7,
                  border: theme === 'light' ? '1px solid rgba(0,100,180,0.25)' : '1px solid rgba(0,200,255,0.2)',
                  background: theme === 'light' ? 'rgba(0,100,180,0.08)' : 'rgba(0,200,255,0.06)',
                  color: theme === 'light' ? 'rgba(0,80,160,0.70)' : 'rgba(0,200,255,0.65)', cursor: 'pointer',
                }}
                aria-label="閉じる"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* コンテンツ */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {activeDrawer === 'data' && (
                <Suspense fallback={<ViewLoader />}>
                  <NoteView theme={theme} isMobile={isMobile}
                    onOpenManual={() => { sessionStorage.setItem(DATA_RETURN_KEY, '1'); onOpenManual?.() }}
                    onOpenLegal={() => { sessionStorage.setItem(DATA_RETURN_KEY, '1'); onOpenLegal?.() }}
                    onOpenBacktest={() => { sessionStorage.setItem(DATA_RETURN_KEY, '1'); onOpenBacktest?.() }}
                    onOpenEvals={() => { sessionStorage.setItem(DATA_RETURN_KEY, '1'); onOpenEvals?.() }}
                  />
                </Suspense>
              )}
              {activeDrawer === 'contact' && (
                <ContactForm theme={theme} />
              )}
              {activeDrawer === 'settings' && (
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 24 }}>

                  {/* アカウント */}
                  <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>アカウント</div>
                    <button
                      onClick={() => { closeDrawer(); onOpenAccount?.() }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                        background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                        transition: 'background 0.15s', textAlign: 'left',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        {user?.photoURL
                          ? <img src={user.photoURL} alt="" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} referrerPolicy="no-referrer" />
                          : <span style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-sub)' }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            </span>
                        }
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {user ? (user.displayName ?? user.email ?? 'アカウント') : 'Googleでログイン'}
                          </span>
                          {user && (
                            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                              {syncStatus === 'synced' ? '同期済み' : syncStatus === 'syncing' ? '同期中...' : (user.email ?? '')}
                            </span>
                          )}
                        </span>
                      </span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-dim)', flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  </section>

                  {/* 通知 */}
                  <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>通知</div>
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: 10,
                        cursor: user ? 'pointer' : 'default', opacity: user ? 1 : 0.5,
                        background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                        transition: 'background 0.15s',
                      }}
                      onClick={user ? onTogglePush : undefined}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: pushEnabled && user ? 'rgba(96,165,250,0.15)' : 'var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={pushEnabled && user ? 'rgba(96,165,250,0.9)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                          </svg>
                        </span>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>プッシュ通知</span>
                          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                            {!user ? 'ログインが必要です' : pushEnabled ? 'ON — 前日 12:30 に通知' : 'OFF'}
                          </span>
                        </span>
                      </span>
                      <span style={{
                        width: 40, height: 22, borderRadius: 11, flexShrink: 0,
                        background: pushEnabled && user ? 'rgba(96,165,250,0.85)' : 'var(--glass-border)',
                        position: 'relative', transition: 'background 0.2s',
                        display: 'inline-block',
                      }}>
                        <span style={{
                          position: 'absolute', top: 3, left: pushEnabled && user ? 21 : 3,
                          width: 16, height: 16, borderRadius: '50%',
                          background: 'white', transition: 'left 0.2s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        }} />
                      </span>
                    </div>
                  </section>

                  {/* 表示 */}
                  <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>表示</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {(['light', 'dark'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => { if (theme !== t) onToggleTheme?.() }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                            cursor: 'pointer', transition: 'all 0.15s',
                            ...(theme === t
                              ? { background: 'var(--view-btn-active-bg)', color: 'var(--view-btn-active-color)', border: '1px solid transparent', boxShadow: '0 2px 8px rgba(100,120,200,0.15)' }
                              : { background: 'transparent', color: 'var(--text-sub)', border: '1px solid var(--glass-border)' }),
                          }}
                        >
                          {t === 'light'
                            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                          }
                          {t === 'light' ? 'ライト' : 'ダーク'}
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* 開発者（管理者のみ） */}
                  {isAdmin && (
                    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>開発者</div>
                      <button
                        onClick={() => { closeDrawer(); onOpenSpec?.() }}
                        style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-sub)', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}
                      >
                        システム仕様を開く
                      </button>
                    </section>
                  )}

                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ぽいロボとは？パネル */}
      {showPoirobo && (
        <Suspense fallback={<ViewLoader />}>
          <PoiroboAboutPanel
            theme={theme}
            isMobile={isMobile}
            onBack={() => { setShowPoirobo(false); onPoiroboChange?.(false) }}
          />
        </Suspense>
      )}

      {/* コネクトボタン（接続中・ぽいロボページ表示中は非表示） */}
      {!isConnected && !showPoirobo && (
        <div className={theme === 'light' ? 'poyon-light' : undefined} style={{ position: 'absolute', bottom: isMobile ? 20 : 28, right: isMobile ? 16 : 28, zIndex: 20, transform: isMobile ? 'scale(1.44)' : 'scale(1.2)', transformOrigin: 'bottom right' }}>
          {!isMobile && <div style={{
            position: 'absolute', bottom: 'calc(100% + 12px)', right: 0, width: 220,
            padding: '14px 16px',
            background: theme === 'light' ? 'rgba(235,246,255,0.97)' : 'rgba(0,25,35,0.95)',
            border: theme === 'light' ? '1px solid rgba(0,120,200,0.35)' : '1px solid rgba(0,242,255,0.3)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            pointerEvents: 'none',
            animation: 'cyberTooltipFlicker 11s linear infinite',
          }}>
            <span style={{ position: 'absolute', top: -1, left: -1, width: 20, height: 20,
              borderTop: theme === 'light' ? '2px solid rgba(0,120,200,0.80)' : '2px solid #00f2ff',
              borderLeft: theme === 'light' ? '2px solid rgba(0,120,200,0.80)' : '2px solid #00f2ff' }} />
            <span style={{ position: 'absolute', bottom: -1, right: -1, width: 20, height: 20,
              borderBottom: theme === 'light' ? '2px solid rgba(0,120,200,0.80)' : '2px solid #00f2ff',
              borderRight: theme === 'light' ? '2px solid rgba(0,120,200,0.80)' : '2px solid #00f2ff' }} />
            <span style={{ display: 'block', fontSize: 9,
              color: theme === 'light' ? 'rgba(0,80,160,0.85)' : '#00f2ff', fontWeight: 700,
              letterSpacing: '0.15em', marginBottom: 8,
              borderBottom: theme === 'light' ? '1px solid rgba(0,120,200,0.18)' : '1px solid rgba(0,242,255,0.2)', paddingBottom: 4 }}>
              POIROBO_CONNECT_v2.0
            </span>
            <div style={{ fontSize: 12, color: theme === 'light' ? 'rgba(10,30,80,0.85)' : '#f0f8ff', lineHeight: 1.6 }}>
              ぽいふる博士と音声通話・画面共有ができます。
              <span style={{ display: 'block', fontSize: 10, color: theme === 'light' ? 'rgba(0,100,180,0.80)' : '#00f2ff', opacity: 0.8, marginTop: 6 }}>
                接続プロトコル：SECURE_SYNC
              </span>
            </div>
          </div>}
          <div
            className="poyon-connect-area"
            onClick={() => {
              if (isAdmin) { setAdminOpen(true); return }
              setBookingOpen(true)
            }}
          >
            <div className="poyon-scanner-ring" />
            <div className="poyon-main-core">
              <div className="poyon-image-mask">
                <img src={`${import.meta.env.BASE_URL}hakase.webp`} className="poyon-doctor-image" alt="博士" draggable={false} />
              </div>
              <div className="poyon-text-wrap">
                <div className="poyon-text-main">ぽいロボ コネクト</div>
                <div className="poyon-text-sub">
                  {isAdmin ? '予約管理' : 'ぽいふる博士と接続'}
                </div>
                {!user && (
                  <div style={{ fontSize: 9, color: 'rgba(0,242,255,0.55)', marginTop: 3, letterSpacing: '0.05em' }}>
                    Googleログインが必要です
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
