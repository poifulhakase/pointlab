/**
 * トーク画面の線アイコン（2026-11-07 運用者「絵文字っぽいアイコンは少しださい・モダンに」）。
 * 🔵 ライブラリは足さずに SVG を直書き（数が少ない・バンドルを増やさない）。
 *    色は currentColor＝ボタンの文字色に追従（明るい／暗い の切り替えにそのまま付いてくる）。
 */
import type { ReactNode, SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 22, children, ...rest }: P & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const IconSearch = (p: P) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>
export const IconHome = (p: P) => <Svg {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9v11h14V9" /><path d="M10 20v-6h4v6" /></Svg>
export const IconCalendar = (p: P) => <Svg {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></Svg>
export const IconMore = (p: P) => <Svg {...p}><circle cx="5" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="19" cy="12" r="1.2" fill="currentColor" /></Svg>
export const IconUp = (p: P) => <Svg {...p}><path d="m6 15 6-6 6 6" /></Svg>
export const IconDown = (p: P) => <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>
export const IconLeft = (p: P) => <Svg {...p}><path d="m15 6-6 6 6 6" /></Svg>
export const IconRight = (p: P) => <Svg {...p}><path d="m9 6 6 6-6 6" /></Svg>
export const IconClose = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>
export const IconImage = (p: P) => <Svg {...p}><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="9" cy="10" r="1.6" /><path d="m20.5 16-4.5-4.5L6 19.5" /></Svg>
export const IconSend = (p: P) => <Svg {...p}><path d="M21 3 10.5 13.5" /><path d="M21 3l-6.5 18-4-7.5L3 9.5 21 3Z" /></Svg>
export const IconMap = (p: P) => <Svg {...p}><path d="M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0 1 13 0c0 4.9-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.3" /></Svg>
export const IconPlus = (p: P) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
