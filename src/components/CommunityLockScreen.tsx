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

// ── ゴーストUI: ぼかしチャートライン用パス（適当な相場っぽい曲線） ────
const GHOST_LINE_1 = 'M0,180 L60,160 L120,170 L180,140 L240,150 L300,110 L360,130 L420,90 L480,100 L540,70 L600,80'
const GHOST_LINE_2 = 'M0,140 L60,150 L120,120 L180,130 L240,100 L300,120 L360,90 L420,100 L480,70 L540,80 L600,50'
const GHOST_BARS = [0.3, 0.55, 0.4, 0.7, 0.45, 0.85, 0.6, 0.5, 0.75, 0.9, 0.65, 0.8, 0.55, 0.7, 0.5, 0.85, 0.6, 0.75]

export function CommunityLockScreen({ user, authLoading, memberLoading }: Props) {
  const loading = authLoading || memberLoading

  return (
    <div style={{
      flex: 1, position: 'relative',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: CY_BG,
      backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,229,255,0.012) 3px,rgba(0,229,255,0.012) 4px)',
      padding: '40px 24px',
      gap: 28,
      overflow: 'hidden',
    }}>
      {/* ── ゴーストUI（ぼかし背景） ────────────────────────── */}
      {!loading && (
        <div style={{
          position: 'absolute', inset: 0,
          pointerEvents: 'none',
          filter: 'blur(8px)',
          opacity: 0.45,
          zIndex: 0,
        }}>
          {/* グリッド */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `
              linear-gradient(to right, ${CY_FAINT} 1px, transparent 1px),
              linear-gradient(to bottom, ${CY_FAINT} 1px, transparent 1px)
            `,
            backgroundSize: '80px 60px',
            opacity: 0.18,
          }} />

          {/* チャート曲線（上部） */}
          <svg
            viewBox="0 0 600 200"
            preserveAspectRatio="none"
            style={{ position: 'absolute', top: '5%', left: 0, width: '100%', height: '28%' }}
          >
            <path d={GHOST_LINE_1} fill="none" stroke={CY_ACCENT} strokeWidth="2" opacity="0.7" />
            <path d={GHOST_LINE_1} fill="none" stroke={CY_ACCENT} strokeWidth="4" opacity="0.3" />
            <path d={GHOST_LINE_2} fill="none" stroke="rgba(96,200,140,0.8)" strokeWidth="2" opacity="0.5" />
          </svg>

          {/* チャート曲線（下部） */}
          <svg
            viewBox="0 0 600 200"
            preserveAspectRatio="none"
            style={{ position: 'absolute', bottom: '8%', left: 0, width: '100%', height: '20%' }}
          >
            <path d={GHOST_LINE_2} fill="none" stroke={CY_ACCENT} strokeWidth="2" opacity="0.5" />
          </svg>

          {/* バーチャート（左下） */}
          <div style={{
            position: 'absolute', bottom: '15%', left: '5%', width: '38%', height: '22%',
            display: 'flex', alignItems: 'flex-end', gap: '2%',
          }}>
            {GHOST_BARS.map((h, i) => (
              <div key={i} style={{
                flex: 1, height: `${h * 100}%`,
                background: i % 2 === 0 ? 'rgba(96,200,140,0.5)' : 'rgba(255,120,100,0.5)',
                borderRadius: '2px 2px 0 0',
              }} />
            ))}
          </div>

          {/* テーブル行（右側） */}
          <div style={{
            position: 'absolute', top: '38%', right: '5%', width: '32%',
            display: 'flex', flexDirection: 'column', gap: '8px',
          }}>
            {[...Array(8)].map((_, i) => (
              <div key={i} style={{
                display: 'flex', gap: '8px', height: 14, alignItems: 'center',
              }}>
                <div style={{ width: '28%', height: 10, background: CY_DIM, borderRadius: 2, opacity: 0.7 }} />
                <div style={{ width: '22%', height: 10, background: CY_ACCENT, borderRadius: 2, opacity: 0.5 }} />
                <div style={{ width: '20%', height: 10, background: CY_FAINT, borderRadius: 2, opacity: 0.7 }} />
                <div style={{ flex: 1, height: 10, background: i % 3 === 0 ? 'rgba(255,120,100,0.45)' : 'rgba(96,200,140,0.45)', borderRadius: 2 }} />
              </div>
            ))}
          </div>

          {/* 数字風ノイズ（左上） */}
          <div style={{
            position: 'absolute', top: '8%', left: '6%',
            fontFamily: CY_FONT, fontSize: 12, color: CY_ACCENT, opacity: 0.6,
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <div>VIX  14.8 ▲ +0.42</div>
            <div>NS    7.85 ▼ -0.03</div>
            <div>PCR   1.18 ▲ +0.05</div>
            <div>OI   197K ▲ +2.1%</div>
          </div>
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
            src={`${import.meta.env.BASE_URL}poirobo.png`}
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
            background: 'rgba(0,10,26,0.55)',
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
                  右下の「ぽいロボ コネクト」から<br />
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
