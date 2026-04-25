// ガンマプロファイルパネル（GEX 分布チャート）
// QuantView の マクロ需給 右カラム下段に表示

import { type GammaProfileResult } from '../utils/gammaProfileData'

// ── SVG バーチャート ──────────────────────────────
export function GammaProfileChart({ profile, theme }: { profile: GammaProfileResult; theme: 'dark' | 'light' }) {
  const isDark   = theme === 'dark'
  const { bars, spot, gammaFlip } = profile

  if (bars.length === 0) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 11 }}>データなし</div>
  }

  const LABEL_H  = 14
  const PAD_V    = 4
  const VIEW_H   = 200
  const BAR_AREA = VIEW_H - LABEL_H - PAD_V
  const MID_Y    = PAD_V + BAR_AREA / 2
  const maxAbs   = Math.max(...bars.map(b => Math.abs(b.gex)), 0.001)
  const n        = bars.length
  const BAR_W    = 10
  const VIEW_W   = n * BAR_W

  const posColor  = isDark ? 'rgba(96,200,140,0.80)'   : 'rgba(22,163,74,0.72)'
  const negColor  = isDark ? 'rgba(255,100,80,0.80)'   : 'rgba(200,50,30,0.72)'
  const spotColor = isDark ? 'rgba(251,191,36,0.95)'   : 'rgba(161,120,0,0.95)'
  const flipColor = isDark ? 'rgba(180,120,250,0.90)'  : 'rgba(120,60,200,0.90)'
  const zeroColor = isDark ? 'rgba(255,255,255,0.15)'  : 'rgba(0,0,0,0.12)'
  const txtColor  = isDark ? 'rgba(150,155,175,0.75)'  : 'rgba(60,65,90,0.70)'

  const spotIdx = bars.reduce(
    (best, b, i) => Math.abs(b.strike - spot) < Math.abs(bars[best].strike - spot) ? i : best,
    0,
  )
  const flipIdx = gammaFlip != null ? bars.findIndex(b => b.strike === gammaFlip) : -1
  const labelStep = Math.max(1, Math.ceil(n / 8))

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      {/* ゼロライン */}
      <line x1="0" y1={MID_Y} x2={VIEW_W} y2={MID_Y} stroke={zeroColor} strokeWidth="0.8" />

      {/* GEX バー */}
      {bars.map((bar, i) => {
        const barH = (Math.abs(bar.gex) / maxAbs) * (BAR_AREA / 2 - PAD_V * 2)
        const isPos = bar.gex >= 0
        const barY  = isPos ? MID_Y - barH : MID_Y
        return (
          <rect key={bar.strike}
            x={i * BAR_W + 0.5} y={barY}
            width={BAR_W - 1} height={Math.max(barH, 0.5)}
            fill={isPos ? posColor : negColor}
          />
        )
      })}

      {/* スポット価格ライン（黄色破線） */}
      {spotIdx >= 0 && (
        <line
          x1={spotIdx * BAR_W + BAR_W / 2} y1={PAD_V}
          x2={spotIdx * BAR_W + BAR_W / 2} y2={BAR_AREA + PAD_V}
          stroke={spotColor} strokeWidth="1.2" strokeDasharray="4,3"
        />
      )}

      {/* ガンマフリップライン（紫破線） */}
      {flipIdx >= 0 && (
        <line
          x1={flipIdx * BAR_W + BAR_W / 2} y1={PAD_V}
          x2={flipIdx * BAR_W + BAR_W / 2} y2={BAR_AREA + PAD_V}
          stroke={flipColor} strokeWidth="1" strokeDasharray="2,3"
        />
      )}

      {/* ストライクラベル */}
      {bars.map((bar, i) => {
        if (i % labelStep !== 0 && i !== bars.length - 1) return null
        return (
          <text key={bar.strike}
            x={i * BAR_W + BAR_W / 2} y={VIEW_H - 2}
            fontSize="7.5" textAnchor="middle" fill={txtColor}
          >
            {(bar.strike / 1000).toFixed(1)}k
          </text>
        )
      })}
    </svg>
  )
}

// ── パネル（ヘッダー＋チャート＋サマリー） ────────────
export function GammaPanel({ gammaData, gammaLoading, gammaError, onGammaReload, theme }: {
  gammaData:     GammaProfileResult | null
  gammaLoading:  boolean
  gammaError:    string
  onGammaReload: () => void
  theme:         'dark' | 'light'
}) {
  const isDark = theme === 'dark'

  const regime      = gammaData ? (gammaData.netGex >= 0 ? 'positive' : 'negative') : null
  const regimeLabel = regime === 'positive' ? '正ガンマ域（安定）' : regime === 'negative' ? '負ガンマ域（不安定）' : '—'
  const regimeColor = regime === 'positive'
    ? (isDark ? 'rgba(96,200,140,0.95)' : 'rgba(22,130,80,0.9)')
    : regime === 'negative'
      ? (isDark ? 'rgba(255,120,100,0.95)' : 'rgba(200,50,30,0.9)')
      : 'var(--text-dim)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* パネルヘッダー */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 14px', flexShrink: 0, gap: 8,
        borderBottom: '1px solid var(--border-dim)',
        userSelect: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text)', overflow: 'hidden' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
          <span style={{ whiteSpace: 'nowrap' }}>ガンマプロファイル</span>
          <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-sub)', marginLeft: 2 }}>GEX分布（期近）</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {gammaData && (
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
              {gammaData.updatedAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 更新
            </span>
          )}
          <button
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600,
              color: 'var(--text-sub)', background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)', cursor: 'pointer',
            }}
            onClick={onGammaReload}
            disabled={gammaLoading}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
              style={{ transform: gammaLoading ? 'rotate(360deg)' : undefined, transition: gammaLoading ? 'transform 1s linear infinite' : undefined }}>
              <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            {gammaLoading ? '取得中…' : '更新'}
          </button>
        </div>
      </div>

      {/* チャートエリア */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
        {gammaLoading && !gammaData ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, height: '100%' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid var(--border-dim)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ color: 'var(--text-sub)', fontSize: 13 }}>取得中…</span>
          </div>
        ) : gammaError && !gammaData ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '12px 16px', height: '100%' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,100,80,0.7)" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span style={{ color: 'var(--text-sub)', fontSize: 12, maxWidth: 280, textAlign: 'center', lineHeight: 1.5 }}>{gammaError}</span>
            <button
              style={{ padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--accent-glass)', border: '1px solid var(--accent)', color: '#fff', cursor: 'pointer' }}
              onClick={onGammaReload}
            >
              再試行
            </button>
          </div>
        ) : gammaData ? (
          <GammaProfileChart profile={gammaData} theme={theme} />
        ) : null}
      </div>

      {/* サマリー行 */}
      {gammaData && (
        <div style={{
          flexShrink: 0,
          borderTop: '1px solid var(--border-dim)',
          padding: '7px 14px 10px',
          display: 'flex', flexWrap: 'wrap', gap: '6px 20px',
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            スポット <strong style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{gammaData.spot.toLocaleString()}</strong>
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            限月 <strong style={{ color: 'var(--text-sub)' }}>{gammaData.expiryLabel}</strong>
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            フリップ <strong style={{
              color: isDark ? 'rgba(180,120,250,0.95)' : 'rgba(120,60,200,0.95)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {gammaData.gammaFlip != null ? gammaData.gammaFlip.toLocaleString() : '—'}
            </strong>
          </span>
          <span style={{ fontSize: 11, color: regimeColor, fontWeight: 600 }}>{regimeLabel}</span>
          <div style={{ width: '100%', display: 'flex', gap: 12, fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>
            <span style={{ color: isDark ? 'rgba(251,191,36,0.8)' : 'rgba(161,120,0,0.8)' }}>— スポット</span>
            <span style={{ color: isDark ? 'rgba(180,120,250,0.8)' : 'rgba(120,60,200,0.8)' }}>-- ガンマフリップ</span>
            <span style={{ color: isDark ? 'rgba(96,200,140,0.8)'  : 'rgba(22,163,74,0.7)'  }}>■ 正GEX（安定化）</span>
            <span style={{ color: isDark ? 'rgba(255,100,80,0.8)'  : 'rgba(200,50,30,0.7)'  }}>■ 負GEX（不安定化）</span>
          </div>
        </div>
      )}
    </div>
  )
}
