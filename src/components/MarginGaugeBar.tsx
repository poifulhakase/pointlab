// 需給ゲージ（信用残の「重い／軽い」）。2026-08-17 追加・同日ダイナミック化。
//
// 🔴 出すのは**状態の記述だけ**（アプリ全体の方針＝命令・推奨をしない）。
//    「重い」＝上値に戻り売りが控えている状態、という事実の言い換えに留める。
// 🔵 ぽいロボの世界観は**宇宙×物理**。需給の重さ＝「質量」として、計器のように見せる。
//    ・目盛りは 軽い(左) → 重い(右) のグラデーション
//    ・現在値は脈打つ指針、**1週前の位置に残像**を置いて「どこから動いてきたか」を出す
//    ・踏み上げ余地（売り方が残っている）は、上向きに流れる光で「燃料がある」ことを示す
// 🔴 動きは `prefers-reduced-motion` で必ず止める（アプリ全体の約束）。

import type { MarginGauge } from '../utils/marginGauge'
import { cy } from '../utils/cyberTheme'

type Props = {
  gauge: MarginGauge | null
  theme: 'dark' | 'light'
  /** 省スペース版（一覧の行に埋める） */
  compact?: boolean
}

/** 重さの色。軽い＝シアン（抜けやすい）／重い＝オレンジ〜赤（上値に蓋） */
function colorOf(level: MarginGauge['level'], theme: 'dark' | 'light') {
  const dark = theme === 'dark'
  switch (level) {
    case 'very_heavy': return dark ? '#ff5c7a' : '#d63b5c'
    case 'heavy':      return dark ? '#ffa14a' : '#d97a1f'
    case 'normal':     return dark ? '#9fb3c8' : '#5b6d80'
    default:           return dark ? '#00e5ff' : '#0369a1'
  }
}

/** 踏み上げ余地の色。上げ方向に効く材料なので、重さ（オレンジ〜赤）とは別の色にする */
const SQUEEZE_COLOR = (theme: 'dark' | 'light') => (theme === 'dark' ? '#7ee787' : '#1a7f37')

export function MarginGaugeStyles() {
  return (
    <style>{`
      @keyframes mg-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
      @keyframes mg-needle { 0%,100% { box-shadow: 0 0 6px 1px currentColor; } 50% { box-shadow: 0 0 14px 3px currentColor; } }
      @keyframes mg-scan { 0% { transform: translateX(-120%); } 100% { transform: translateX(320%); } }
      @keyframes mg-fuel { 0% { background-position: 0 0; } 100% { background-position: 0 -14px; } }
      .mg-fill   { transform-origin: left center; animation: mg-fill 900ms cubic-bezier(.2,.9,.25,1) both; }
      .mg-needle { animation: mg-needle 2.6s ease-in-out infinite; }
      .mg-scan   { animation: mg-scan 3.4s linear infinite; }
      .mg-fuel   { animation: mg-fuel .9s linear infinite; }
      /* 🆕 2026-08-22：将来的に売られる残の棒が下から伸びる（運用者の要望「ダイナミックに」） */
      @keyframes nmt-grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
      .nmt-bar { transform-origin: bottom center; animation: nmt-grow 700ms cubic-bezier(.2,.9,.25,1) both; }
      @media (prefers-reduced-motion: reduce) {
        .mg-fill, .mg-needle, .mg-scan, .mg-fuel, .nmt-bar { animation: none !important; }
        .mg-fill { transform: none !important; }
      }
    `}</style>
  )
}

export function MarginGaugeBar({ gauge, theme, compact = false }: Props) {
  const c = cy(theme)
  const dark = theme === 'dark'

  // 🔵 点数を数字で出すのはやめた（2026-08-22）。「14」だけ見ても意味が読めないため。
  //    バーの指針は残してあるので、位置の感覚は目で取れる。内訳は説明文（note）にある。

  if (!gauge) {
    // 🔴 データが無いときに「ふつう」と出さない（無いことを黙って埋めない）
    return <span style={{ fontSize: compact ? 10 : 11, color: c.DIM }}>需給データなし</span>
  }

  const color = colorOf(gauge.level, theme)
  const squeezeColor = SQUEEZE_COLOR(theme)

  const W = compact ? 92 : 150          // 目盛りの幅
  const H = compact ? 8 : 12            // 目盛りの高さ
  const moved = gauge.prevScore != null && Math.abs(gauge.score - gauge.prevScore) >= 2

  return (
    <span
      title={`${gauge.note}\n（JPX「銘柄別信用取引週末残高」より。上値の重さの目安で、売買の推奨ではありません）`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: compact ? 7 : 10,
        whiteSpace: 'nowrap', fontFamily: c.FONT,
      }}
    >
      <span style={{
        fontSize: compact ? 8.5 : 9, letterSpacing: '0.18em', color: c.DIM,
      }}>需給</span>

      {/* 計器本体 */}
      <span
        aria-hidden
        style={{
          position: 'relative', width: W, height: H, borderRadius: 999,
          border: `1px solid ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(3,105,161,0.20)'}`,
          background: dark
            ? 'linear-gradient(90deg, rgba(0,229,255,0.10), rgba(255,255,255,0.04) 45%, rgba(255,92,122,0.12))'
            : 'linear-gradient(90deg, rgba(3,105,161,0.10), rgba(0,0,0,0.04) 45%, rgba(214,59,92,0.12))',
          overflow: 'hidden', flexShrink: 0,
        }}
      >
        {/* 走査線（生きている感じ）。踏み上げ余地があるときは緑で流す */}
        <span className="mg-scan" style={{
          position: 'absolute', top: 0, bottom: 0, width: '22%',
          background: `linear-gradient(90deg, transparent, ${gauge.squeeze !== 'none' ? squeezeColor : color}22, transparent)`,
        }} />

        {/* 現在の重さ（左から伸びる） */}
        <span className="mg-fill" style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: `${gauge.score}%`,
          background: `linear-gradient(90deg, ${color}55, ${color})`,
          boxShadow: dark ? `0 0 12px ${color}77` : 'none',
        }} />

        {/* 1週前の位置＝残像。ここから動いてきたことが一目で分かる */}
        {moved && (
          <span style={{
            position: 'absolute', top: -1, bottom: -1, left: `calc(${gauge.prevScore}% - 1px)`,
            width: 2, background: dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.30)',
          }} />
        )}

        {/* 指針（脈打つ） */}
        <span className="mg-needle" style={{
          position: 'absolute', top: -2, bottom: -2, left: `calc(${gauge.score}% - 1.5px)`,
          width: 3, borderRadius: 2, background: color, color,
        }} />

        {/* 踏み上げ余地＝上向きの流れ（燃料が残っている） */}
        {gauge.squeeze !== 'none' && (
          <span className="mg-fuel" style={{
            position: 'absolute', inset: 0, opacity: gauge.squeeze === 'strong' ? 0.5 : 0.28,
            backgroundImage: `repeating-linear-gradient(0deg, ${squeezeColor}, ${squeezeColor} 1px, transparent 1px, transparent 7px)`,
            backgroundSize: '100% 14px',
          }} />
        )}
      </span>

      {/* 🔴 1行で言い切る（2026-08-22・運用者の指摘）。
          それまでは「14 軽い ▸ 重くなってきた （踏み上げ余地）」と判定が3つ並び、
          軽いのか重いのか読めなかった。点数と内訳は説明文（note）に残してある。 */}
      {/* 🔴 省スペース版（候補一覧）では**文字を出さない**（2026-08-22・運用者の指摘
          「横にはみ出す／視覚的に見せる方向がいい」）。要約はバーの title に残るので
          カーソルを当てれば読める。 */}
      {!compact && (
        <span style={{ fontSize: 11.5, color, fontWeight: 700, letterSpacing: '0.01em' }}>
          {gauge.summary}
        </span>
      )}
    </span>
  )
}

export default MarginGaugeBar
