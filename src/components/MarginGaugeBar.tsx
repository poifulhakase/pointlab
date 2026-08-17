// 需給ゲージ（信用残の「重い／軽い」）を小さなバーで出す。2026-08-17 追加。
//
// 🔴 出すのは**状態の記述だけ**（アプリ全体の方針＝命令・推奨をしない）。
//    「重い」＝上値に戻り売りが控えている状態、という事実の言い換えに留める。
// 🔵 人が知りたいのは水準より**向き**（軽くなってきたか）なので、矢印を必ず添える。

import type { MarginGauge } from '../utils/marginGauge'
import { cy } from '../utils/cyberTheme'

type Props = {
  gauge: MarginGauge | null
  theme: 'dark' | 'light'
  /** 省スペース版（一覧の行に埋める） */
  compact?: boolean
}

/** 重さの色。軽い＝青（抜けやすい）／重い＝オレンジ〜赤（上値に蓋） */
function colorOf(level: MarginGauge['level'], theme: 'dark' | 'light') {
  const dark = theme === 'dark'
  switch (level) {
    case 'very_heavy': return dark ? '#ff5c7a' : '#d63b5c'
    case 'heavy':      return dark ? '#ffa14a' : '#d97a1f'
    case 'normal':     return dark ? '#8fa3b8' : '#6b7c8f'
    default:           return dark ? '#00e5ff' : '#2b8fa8'
  }
}

/** 踏み上げ余地の色。上げ方向に効く材料なので、重さ（オレンジ〜赤）とは別の色にする */
const SQUEEZE_COLOR = (theme: 'dark' | 'light') => (theme === 'dark' ? '#7ee787' : '#1a7f37')

const TREND_MARK: Record<MarginGauge['trend'], string> = {
  lighter: '↓',
  flat: '→',
  heavier: '↑',
}

export function MarginGaugeBar({ gauge, theme, compact = false }: Props) {
  const c = cy(theme)
  if (!gauge) {
    // 🔴 データが無いときに「ふつう」と出さない（無いことを黙って埋めない）
    return <span style={{ fontSize: compact ? 10 : 11, color: c.DIM }}>需給データなし</span>
  }

  const color = colorOf(gauge.level, theme)
  const trendColor = gauge.trend === 'lighter' ? (theme === 'dark' ? '#00e5ff' : '#2b8fa8')
    : gauge.trend === 'heavier' ? (theme === 'dark' ? '#ffa14a' : '#d97a1f')
      : c.DIM

  return (
    <span
      title={`${gauge.note}\n（JPX「銘柄別信用取引週末残高」より。上値の重さの目安で、売買の推奨ではありません）`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
    >
      <span style={{ fontSize: compact ? 10 : 11, color: c.DIM }}>需給</span>

      {/* 目盛り＝0（軽い）〜100（重い） */}
      <span
        aria-hidden
        style={{
          position: 'relative',
          width: compact ? 44 : 64,
          height: compact ? 5 : 6,
          borderRadius: 999,
          background: theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            position: 'absolute', inset: 0, width: `${gauge.score}%`,
            background: color, borderRadius: 999,
            boxShadow: theme === 'dark' ? `0 0 8px ${color}66` : 'none',
          }}
        />
      </span>

      <span style={{ fontSize: compact ? 10 : 11, color, fontWeight: 700 }}>{gauge.label}</span>
      <span style={{ fontSize: compact ? 10 : 11, color: trendColor }}>
        {TREND_MARK[gauge.trend]} {compact ? '' : gauge.trendLabel}
      </span>

      {/* 🔴 「軽い」の中身を出し分ける（2026-08-17 ユーザー指摘）。
          売り方が残っている軽さ＝上昇時に買い戻しが入る側。閑散な軽さとは意味が違う。 */}
      {gauge.squeeze !== 'none' && (
        <span style={{
          padding: compact ? '1px 6px' : '2px 8px', borderRadius: 999,
          border: `1px solid ${SQUEEZE_COLOR(theme)}`,
          color: SQUEEZE_COLOR(theme), fontSize: compact ? 9 : 10, fontWeight: 800, whiteSpace: 'nowrap',
        }}>
          {gauge.squeeze === 'strong' ? '踏み上げ余地' : '売り方あり'}
        </span>
      )}
    </span>
  )
}

export default MarginGaugeBar
