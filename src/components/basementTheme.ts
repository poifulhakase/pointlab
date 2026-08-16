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
    // 🔵 壁の質感（BasementBackdrop）の上に置くので、カードは**少し沈んだ半透明**にする。
    //    透け過ぎると目地とシミが文字の裏を通り、読みにくくなる（2026-08-16）。
    card: dark ? 'rgba(18,17,16,0.62)' : 'rgba(255,255,255,0.86)',
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

/**
 * 地下室にある部屋（＝ページ）の一覧。
 * 🔴 **ここが単一情報源**（2026-08-16）。部屋を増やすときは1行足すだけで、
 *    ヘッダーの切替も「隣の部屋」も自動で追従する。
 * 🔵 `verdict` は各ページの判定スタンプと**同じ短文**にすること（別のことを言うと部屋が別物に見える）。
 * 🔵 `key` は App の ViewMode と同じ文字列にしてある（そのまま画面切替に渡せる）。
 */
export const BASEMENT_ROOMS = [
  { key: 'daytrade', label: 'デイトレード', short: 'デイ', mark: '×', verdict: '日計りの根拠は、見つからなかった。' },
  { key: 'swing', label: 'スイングトレード', short: 'スイング', mark: '○', verdict: 'ルールとしては成立している。AIが上回るかは未判定。' },
] as const

export type BasementRoomKey = typeof BASEMENT_ROOMS[number]['key']

/**
 * 上に浮かせる帯（ヘッダー）の地。
 * 🔵 背景（`BasementBackdrop`）の壁が透けるように、不透明色ではなく半透明＋ぼかしにする
 *    （2026-08-16。不透明だと壁の質感がヘッダーの所だけ切れて見える）。
 */
export function basementVeil(dark: boolean): React.CSSProperties {
  return {
    background: dark ? 'rgba(11,12,14,0.78)' : 'rgba(239,236,231,0.82)',
    backdropFilter: 'blur(10px)',
  }
}
