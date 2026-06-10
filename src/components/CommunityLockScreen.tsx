import type { User } from 'firebase/auth'
import { QuantSkeleton, ChartSkeleton, ShieldSkeleton, CalendarSkeleton } from './LockSkeletons'

export type LockedView = 'calendar' | 'chart' | 'quant' | 'shield'

type Props = {
  user:          User | null
  authLoading:   boolean
  memberLoading: boolean
  view?:         LockedView
  /** 未ログイン時に「研究室でログイン」ボタンから呼ぶ（研究室へ遷移） */
  onGoToConnect?: () => void
}

const CY_BG     = 'linear-gradient(160deg, rgba(0,10,26,0.98) 0%, rgba(0,5,16,0.98) 100%)'
const CY_ACCENT = 'rgba(0,229,255,0.95)'
const CY_DIM    = 'rgba(0,229,255,0.55)'
const CY_FAINT  = 'rgba(0,229,255,0.28)'
const CY_FONT   = "'Courier New', Courier, monospace" as const

function SkeletonFor({ view }: { view: LockedView }) {
  switch (view) {
    case 'quant':    return <QuantSkeleton />
    case 'chart':    return <ChartSkeleton />
    case 'shield':   return <ShieldSkeleton />
    case 'calendar': return <CalendarSkeleton />
  }
}

export function CommunityLockScreen({ user, authLoading, memberLoading, view = 'quant', onGoToConnect }: Props) {
  const loading = authLoading || memberLoading

  return (
    <div style={{
      flex: 1, position: 'relative',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: CY_BG,
      padding: '40px 24px',
      gap: 28,
      overflow: 'hidden',
      userSelect: 'none', WebkitUserSelect: 'none',
    }}>
      {/* ── 背景：実UIスケルトン（ぼかし） ──────────────────── */}
      {!loading && (
        <div style={{
          position: 'absolute', inset: 0,
          pointerEvents: 'none',
          filter: 'blur(9px)',
          opacity: 0.55,
          zIndex: 0,
        }}>
          <SkeletonFor view={view} />
        </div>
      )}

      {/* ── スキャンライン ────────────────────────────────────── */}
      {!loading && (
        <div style={{
          position: 'absolute', inset: 0,
          pointerEvents: 'none', zIndex: 1, overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', left: 0, right: 0, height: '30%',
            background: `linear-gradient(to bottom, transparent 0%, rgba(0,229,255,0.06) 50%, transparent 100%)`,
            animation: 'lockSweep 6s linear infinite',
          }} />
        </div>
      )}

      {/* ── 前面コンテンツ ──────────────────────────────────── */}
      <style>{`
        @keyframes lockSweep { from { transform: translateY(-100%); } to { transform: translateY(400%); } }
        @keyframes lockPulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
      `}</style>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, zIndex: 2 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            border: `2px solid ${CY_FAINT}`,
            borderTopColor: CY_ACCENT,
            animation: 'spin 0.9s linear infinite',
          }} />
          <span style={{ fontFamily: CY_FONT, fontSize: 10, color: CY_DIM, letterSpacing: '0.12em' }}>
            CHECKING ACCESS...
          </span>
        </div>
      ) : (
        <>
          {/* ぽいロボ画像 */}
          <img
            src={`${import.meta.env.BASE_URL}poirobo.webp`}
            alt="ぽいロボ"
            style={{
              width: 80, height: 80, objectFit: 'contain',
              opacity: 0.95, zIndex: 2,
              filter: `drop-shadow(0 0 20px rgba(0,229,255,0.5))`,
            }}
          />

          {/* タイトル */}
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10, zIndex: 2 }}>
            <div style={{
              fontFamily: CY_FONT, fontSize: 10, fontWeight: 700,
              letterSpacing: '0.22em', color: CY_DIM,
              textShadow: `0 0 10px ${CY_DIM}`,
              animation: 'lockPulse 2.5s ease-in-out infinite',
            }}>
              COMMUNITY ACCESS REQUIRED
            </div>
            <div style={{
              fontSize: 18, fontWeight: 700, color: CY_ACCENT,
              textShadow: `0 0 20px rgba(0,229,255,0.6)`,
              letterSpacing: '0.04em',
            }}>
              コミュニティ限定機能
            </div>
          </div>

          {/* コーナーブラケット */}
          <div style={{
            position: 'relative',
            padding: '20px 24px',
            maxWidth: 320, zIndex: 2,
            background: 'rgba(0,10,26,0.65)',
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
          }}>
            {/* 四隅ブラケット */}
            {[
              { top: 0, left: 0, borderTop: `1.5px solid ${CY_FAINT}`, borderLeft: `1.5px solid ${CY_FAINT}` },
              { top: 0, right: 0, borderTop: `1.5px solid ${CY_FAINT}`, borderRight: `1.5px solid ${CY_FAINT}` },
              { bottom: 0, left: 0, borderBottom: `1.5px solid ${CY_FAINT}`, borderLeft: `1.5px solid ${CY_FAINT}` },
              { bottom: 0, right: 0, borderBottom: `1.5px solid ${CY_FAINT}`, borderRight: `1.5px solid ${CY_FAINT}` },
            ].map((s, i) => (
              <div key={i} style={{ position: 'absolute', width: 14, height: 14, ...s }} />
            ))}

            <div style={{
              fontFamily: CY_FONT, fontSize: 11, color: CY_DIM,
              lineHeight: 1.85, textAlign: 'center', letterSpacing: '0.03em',
            }}>
              {!user ? (
                <>
                  この機能は<span style={{ color: CY_ACCENT }}>ぽいんとらぼ</span>の<br />
                  メンバー限定です。<br /><br />
                  下の<span style={{ color: CY_ACCENT }}>「研究室でログイン」</span>から<br />
                  Googleログインしてください。
                </>
              ) : (
                <>
                  この機能は<span style={{ color: CY_ACCENT }}>ぽいんとらぼ</span>の<br />
                  メンバー限定です。<br /><br />
                  note コミュニティに参加後、<br />
                  ログインに使用する<span style={{ color: CY_ACCENT }}>Googleアカウントの<br />
                  メールアドレス</span>を管理者にご連絡ください。
                </>
              )}
            </div>
          </div>

          {/* 研究室へのログイン導線（未ログイン時のみ） */}
          {!user && onGoToConnect && (
            <button
              onClick={onGoToConnect}
              style={{
                zIndex: 2, cursor: 'pointer',
                fontFamily: CY_FONT, fontSize: 12, fontWeight: 700,
                letterSpacing: '0.06em', color: CY_ACCENT,
                padding: '10px 22px', borderRadius: 8,
                background: 'rgba(0,229,255,0.10)',
                border: `1px solid ${CY_DIM}`,
                textShadow: `0 0 10px rgba(0,229,255,0.5)`,
                boxShadow: `0 0 16px rgba(0,229,255,0.18)`,
                transition: 'background 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,229,255,0.18)'; e.currentTarget.style.boxShadow = '0 0 22px rgba(0,229,255,0.32)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,229,255,0.10)'; e.currentTarget.style.boxShadow = '0 0 16px rgba(0,229,255,0.18)' }}
            >
              研究室でログイン →
            </button>
          )}

          {/* ステータス */}
          <div style={{
            fontFamily: CY_FONT, fontSize: 9, color: 'rgba(0,229,255,0.45)',
            letterSpacing: '0.10em', zIndex: 2,
            animation: 'lockPulse 1.5s ease-in-out infinite',
          }}>
            {!user ? '[ NOT AUTHENTICATED ]' : '[ ACCESS DENIED ]'}
          </div>
        </>
      )}
    </div>
  )
}
