import { describe, it, expect, vi } from 'vitest'
import type { KeyboardEvent } from 'react'
import { activateOnKey, dateLabel } from '../a11y'

/** React の KeyboardEvent の代わり（必要なところだけ持つ）。 */
function keyEvent(key: string) {
  return {
    key,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as KeyboardEvent & { preventDefault: ReturnType<typeof vi.fn>; stopPropagation: ReturnType<typeof vi.fn> }
}

describe('activateOnKey', () => {
  it('Enter と Space で実行する（マウスが使えなくても押せるようにするため）', () => {
    const fn = vi.fn()
    const handler = activateOnKey(fn)

    handler(keyEvent('Enter'))
    handler(keyEvent(' '))

    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('Space はページのスクロールを止める', () => {
    // 🔴 止めないと、押した瞬間に画面が下へ動いてしまう
    const e = keyEvent(' ')
    activateOnKey(vi.fn())(e)
    expect(e.preventDefault).toHaveBeenCalled()
  })

  it('入れ子のセルで二重に動かないよう伝播を止める', () => {
    const e = keyEvent('Enter')
    activateOnKey(vi.fn())(e)
    expect(e.stopPropagation).toHaveBeenCalled()
  })

  it('それ以外のキーでは何もしない（Tab移動やショートカットを邪魔しない）', () => {
    const fn = vi.fn()
    const handler = activateOnKey(fn)
    const tab = keyEvent('Tab')

    handler(tab)
    handler(keyEvent('a'))
    handler(keyEvent('Escape'))

    expect(fn).not.toHaveBeenCalled()
    expect(tab.preventDefault).not.toHaveBeenCalled()
  })
})

describe('dateLabel', () => {
  it('読み上げ用に曜日まで含める', () => {
    expect(dateLabel(new Date(2026, 7, 12))).toBe('8月12日（水）')
    expect(dateLabel(new Date(2026, 0, 1))).toBe('1月1日（木）')
  })
})
