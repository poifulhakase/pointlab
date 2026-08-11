import type { KeyboardEvent } from 'react'

const DOW = ['日', '月', '火', '水', '木', '金', '土']

/**
 * キーボードで「押した」と見なす操作（Enter / Space）を拾うハンドラを作る。
 *
 * 🔴 `div` や `span` に `onClick` だけを付けると、**マウスでしか操作できない**。
 *    `role="button"` `tabIndex={0}` とこのハンドラを3点セットで付けること。
 * 🔵 Space は押した瞬間にページがスクロールするので `preventDefault()` で止める。
 * 🔵 入れ子のセル（セルの中の日付ボタン等）で二重に発火しないよう伝播も止める。
 */
export function activateOnKey(fn: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    e.stopPropagation()
    fn()
  }
}

/** 「8月12日（水）」＝読み上げ用の日付表記。 */
export function dateLabel(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日（${DOW[d.getDay()]}）`
}
