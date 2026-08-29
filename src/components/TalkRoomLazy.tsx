import { lazy } from 'react'

/**
 * 一時トークルームの遅延読み込み口。
 *
 * main.tsx に lazy() を直接置くと Fast Refresh の警告が出る（コンポーネントの
 * 定義とエントリーポイントが同居するため）ので、1枚だけ挟んでいる。
 * 🔴 本体を初期バンドルに入れないための分割でもある（普段の利用者はダウンロードしない）。
 */
export const TalkRoomLazy = lazy(() =>
  import('./TalkRoom').then(m => ({ default: m.TalkRoom }))
)
