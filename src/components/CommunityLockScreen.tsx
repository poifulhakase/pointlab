import type { User } from 'firebase/auth'

type Props = {
  user:         User | null
  authLoading:  boolean
  memberLoading: boolean
}

const CY_BG     = 'linear-gradient(160deg, rgba(0,10,26,0.98) 0%, rgba(0,5,16,0.98) 100%)'
const CY_ACCENT = 'rgba(0,229,255,0.95)'
const CY_DIM    = 'rgba(0,229,255,0.55)'
const CY_FAINT  = 'rgba(0,229,255,0.28)'
const CY_FONT   = "'Courier New', Courier, monospace" as const

export function CommunityLockScreen({ user, authLoading, memberLoading }: Props) {
  const loading = authLoading || memberLoading

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: CY_BG,
      backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,229,255,0.012) 3px,rgba(0,229,255,0.012) 4px)',
      padding: '40px 24px',
      gap: 28,
    }}>
      {loading ? (
        /* ローディング */
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
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
            src={`${import.meta.env.BASE_URL}poirobo.png`}
            alt="ぽいロボ"
            style={{ width: 80, height: 80, objectFit: 'contain', opacity: 0.85 }}
          />

          {/* タイトル */}
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              fontFamily: CY_FONT, fontSize: 10, fontWeight: 700,
              letterSpacing: '0.22em', color: CY_DIM,
              textShadow: `0 0 10px ${CY_DIM}`,
            }}>
              COMMUNITY ACCESS REQUIRED
            </div>
            <div style={{
              fontSize: 18, fontWeight: 700, color: CY_ACCENT,
              textShadow: `0 0 20px rgba(0,229,255,0.4)`,
              letterSpacing: '0.04em',
            }}>
              コミュニティ限定機能
            </div>
          </div>

          {/* コーナーブラケット */}
          <div style={{
            position: 'relative',
            padding: '20px 24px',
            maxWidth: 320,
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
                  この機能は<span style={{ color: CY_ACCENT }}>ぽいロボ コミュニティ</span>の<br />
                  メンバー限定です。<br /><br />
                  右下の「ぽいロボ コネクト」から<br />
                  Googleログインしてください。
                </>
              ) : (
                <>
                  この機能は<span style={{ color: CY_ACCENT }}>ぽいロボ コミュニティ</span>の<br />
                  メンバー限定です。<br /><br />
                  note コミュニティに参加後、<br />
                  管理者にメールアドレスをご連絡ください。
                </>
              )}
            </div>
          </div>

          {/* ステータス */}
          <div style={{
            fontFamily: CY_FONT, fontSize: 9, color: 'rgba(0,229,255,0.35)',
            letterSpacing: '0.10em',
          }}>
            {!user ? '[ NOT AUTHENTICATED ]' : '[ ACCESS DENIED ]'}
          </div>
        </>
      )}
    </div>
  )
}
