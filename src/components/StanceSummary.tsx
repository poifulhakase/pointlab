import { useState } from 'react'
import type { MarketStance } from '../utils/marketStance'

/**
 * 「結論」を主役に置く共通の枠（2026-08-22 新設）。
 *
 * 🔴 運用者の指示＝「圧倒的に明快で、結論が主軸になっている状態にしたい」。
 *    それまでの画面は**数字の表が主役**で、結論はどこにも書かれていなかった。
 *
 * 設計の柱は3つ:
 *   ① **結論は予測ではなく「いまの位置」**（状態＋歴史的な分位）。
 *      2026-08-22 の検証で方向は当てられないと分かったので、当てにいく文言は置かない
 *   ② **却下された読みは書かない**（下ヒゲ＝買い／買残の積み上がり＝売り 等）
 *   ③ **数字は消さず、主役から降ろす**（この枠の下に畳んで残す）
 *
 * 🔵 ブンセキ・Future・ロボ口座で同じ形にするため、部品として切り出してある。
 */

type Props = {
  theme: 'dark' | 'light'
  isMobile: boolean
  stance: MarketStance
  /** 「▼ 数字を全部見る」で開く中身。省略すると開閉ボタンを出さない */
  children?: React.ReactNode
  /** 開閉の見出し（既定＝数字を全部見る） */
  detailLabel?: string
}

export function StanceSummary({ theme, isMobile, stance, children, detailLabel = '数字を全部見る' }: Props) {
  const [open, setOpen] = useState(false)
  const dark = theme === 'dark'
  const c = {
    text: 'var(--text)',
    sub: 'var(--text-sub)',
    dim: 'var(--text-dim)',
    line: 'var(--border-dim)',
    card: dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.96)',
    accent: dark ? '#00e5ff' : '#0369a1',
    notice: dark ? '#fbbf24' : '#b45309',
  }

  return (
    <section
      style={{
        border: `1px solid ${c.line}`, borderRadius: 12, background: c.card,
        padding: isMobile ? '16px 16px 14px' : '22px 26px 18px',
        display: 'flex', flexDirection: 'column', gap: isMobile ? 12 : 14,
      }}
    >
      {/* 結論（この画面でいちばん大きい文字） */}
      <div>
        <div style={{ fontSize: 10, letterSpacing: '0.18em', color: c.accent, marginBottom: 8 }}>
          いまはこういう状態
        </div>
        <h2 style={{
          margin: 0, fontSize: isMobile ? 18 : 24, fontWeight: 800, lineHeight: 1.5,
          color: c.text, letterSpacing: '0.01em',
        }}>
          {stance.headline}
        </h2>
      </div>

      {/* 3本の柱 */}
      {stance.lines.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {stance.lines.map(l => (
            <div key={l.label} style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{
                flexShrink: 0, width: 34, fontSize: 11, fontWeight: 700,
                color: c.accent, letterSpacing: '0.08em',
              }}>{l.label}</span>
              <span style={{ fontSize: isMobile ? 12.5 : 13.5, color: c.sub, lineHeight: 1.7 }}>{l.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* 気をつけること（規律。予測ではない） */}
      {stance.cautions.length > 0 && (
        <div style={{ borderTop: `1px solid ${c.line}`, paddingTop: 11, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {stance.cautions.map((t, i) => (
            <div key={i} style={{ fontSize: isMobile ? 11.5 : 12, color: c.dim, lineHeight: 1.75 }}>
              <span style={{ color: c.notice }}>⚠</span> {t}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {stance.asOf && (
          <span style={{ fontSize: 10, color: c.dim, letterSpacing: '0.04em' }}>{stance.asOf} 時点</span>
        )}
        {children && (
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            style={{
              marginLeft: 'auto', border: `1px solid ${c.line}`, background: 'transparent',
              color: c.sub, borderRadius: 7, padding: '5px 11px', fontSize: 11, cursor: 'pointer',
            }}
            aria-expanded={open}
          >
            {open ? '▲ 数字を閉じる' : `▼ ${detailLabel}`}
          </button>
        )}
      </div>

      {children && open && (
        <div style={{ borderTop: `1px solid ${c.line}`, paddingTop: 12 }}>{children}</div>
      )}
    </section>
  )
}
