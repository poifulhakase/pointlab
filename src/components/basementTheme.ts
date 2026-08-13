// 地下室ページの共通配色（デイトレード／スイングトレードで同じ見た目にする）
//
// 🔵 コンクリートの壁に裸電球ひとつ。青い研究室ではなく、
//    「まだ人に見せる形になっていない研究が置いてある場所」の暖色＋薄暗さ。
// 🔴 ページが増えたときに色がバラけないよう、ここ1か所に置く。

export function basementColors(theme: 'dark' | 'light') {
  const dark = theme === 'dark'
  return {
    dark,
    bg: dark ? '#0b0c0e' : '#efece7',
    card: dark ? 'rgba(255,255,255,0.035)' : '#fff',
    border: dark ? 'rgba(255,205,130,0.16)' : '#ddd6c9',
    text: dark ? '#e6e0d5' : '#26221c',
    sub: dark ? '#9c9488' : '#5f584e',
    accent: dark ? '#ffd79a' : '#8a5a12',
    no: dark ? '#8a8378' : '#6b6459',
    trap: dark ? '#f0a94a' : '#a8650f',
    ok: dark ? '#8fd6a0' : '#2f7d46',
  }
}

export const BASEMENT_MONO = "'Consolas','SF Mono',ui-monospace,monospace"

/** コンクリートの目地（薄く敷くだけ。読みやすさを壊さない） */
export function concreteStyle(dark: boolean): React.CSSProperties {
  const line = dark ? 'rgba(255,255,255,0.028)' : 'rgba(0,0,0,0.035)'
  return {
    position: 'fixed', inset: 0, pointerEvents: 'none', opacity: dark ? 1 : 0.6,
    backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
    backgroundSize: '72px 34px',
  }
}

/** 裸電球の光（上からぼんやり） */
export const BULB_GLOW: React.CSSProperties = {
  position: 'fixed', left: '50%', top: 0, width: '120%', height: '52%',
  transform: 'translateX(-50%)', pointerEvents: 'none',
  background: 'radial-gradient(46% 60% at 50% 0%, rgba(255,205,130,0.16) 0%, rgba(255,205,130,0.05) 45%, transparent 74%)',
}
