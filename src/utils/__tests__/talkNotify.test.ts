import { describe, it, expect } from 'vitest'
// @ts-expect-error api/ は素の JS（型定義を持たない）
import { buildNotifyText, isLineTarget, isRoomId } from '../../../api/_talkNotify.js'

/**
 * 一時トークルームの新着通知（LINE）の、通信しない部分。
 * 🔴 ここが緩むと「通知に本文が出ない設定なのに本文が出る」事故になるので、
 *    本文を出す／出さないの分岐は必ず固定しておく。
 */
describe('talk-notify', () => {
  describe('buildNotifyText', () => {
    const base = { name: 'なみ', text: '', hasImage: false, showBody: true }

    it('本文を載せる設定なら「名前：本文」', () => {
      expect(buildNotifyText({ ...base, text: 'いま駅ついた' })).toBe('なみ：いま駅ついた')
    })

    it('長い本文は切って「…」を付ける', () => {
      const long = 'あ'.repeat(80)
      expect(buildNotifyText({ ...base, text: long })).toBe(`なみ：${'あ'.repeat(60)}…`)
    })

    it('改行は1行に詰める（通知は1行しか読まれない）', () => {
      expect(buildNotifyText({ ...base, text: 'あ\nい' })).toBe('なみ：あ い')
    })

    it('写真だけなら写真と分かる文にする', () => {
      expect(buildNotifyText({ ...base, hasImage: true })).toBe('なみ から写真が届きました')
    })

    it('本文を載せない設定なら、中身は一切出さない', () => {
      const out = buildNotifyText({ ...base, text: '秘密の話', hasImage: true, showBody: false })
      expect(out).toBe('なみ から新着があります')
      expect(out).not.toContain('秘密')
    })

    it('名前が空でも文章として成立させる', () => {
      expect(buildNotifyText({ ...base, name: '  ', text: 'やあ' })).toBe('だれか：やあ')
    })
  })

  describe('isRoomId', () => {
    it('32桁の16進だけ通す', () => {
      expect(isRoomId('0123456789abcdef0123456789abcdef')).toBe(true)
      expect(isRoomId('0123456789ABCDEF0123456789ABCDEF')).toBe(false)
      expect(isRoomId('0123456789abcdef')).toBe(false)
      expect(isRoomId('')).toBe(false)
      expect(isRoomId(undefined)).toBe(false)
    })
  })

  describe('isLineTarget', () => {
    it('U/C/R で始まる33文字を通す', () => {
      expect(isLineTarget(`C${'0'.repeat(32)}`)).toBe(true)
      expect(isLineTarget(`U${'a'.repeat(32)}`)).toBe(true)
      expect(isLineTarget(`X${'0'.repeat(32)}`)).toBe(false)
      expect(isLineTarget('C123')).toBe(false)
    })
  })
})
