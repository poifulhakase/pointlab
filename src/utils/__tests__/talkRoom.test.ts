import { describe, it, expect } from 'vitest'
import { dayLabel, isSameDay, isTalkRoute, TALK_HASH } from '../talkRoom'

/**
 * 一時トークルームの表示まわり（純粋な部分だけ）。
 * 通信・Firestore は触らない。
 */
describe('talkRoom', () => {
  describe('dayLabel', () => {
    const now = new Date(2026, 7, 29, 12, 0).getTime() // 2026-08-29(土) 12:00

    it('今日は「今日」と出す', () => {
      expect(dayLabel(new Date(2026, 7, 29, 8, 30).getTime(), now)).toBe('今日')
    })

    it('前日は「昨日」と出す', () => {
      expect(dayLabel(new Date(2026, 7, 28, 23, 59).getTime(), now)).toBe('昨日')
    })

    it('それ以前は曜日つきの日付', () => {
      expect(dayLabel(new Date(2026, 7, 27, 10, 0).getTime(), now)).toBe('8月27日(木)')
    })

    it('日付が変わっていれば時刻が近くても別の日', () => {
      // 23:59 と 0:01 は 2分差でも「昨日」と「今日」に分かれる
      expect(dayLabel(new Date(2026, 7, 28, 23, 59).getTime(), now)).toBe('昨日')
      expect(dayLabel(new Date(2026, 7, 29, 0, 1).getTime(), now)).toBe('今日')
    })
  })

  describe('isSameDay', () => {
    it('同じ日なら true', () => {
      expect(isSameDay(new Date(2026, 7, 29, 0, 0).getTime(), new Date(2026, 7, 29, 23, 59).getTime())).toBe(true)
    })

    it('日をまたいだら false', () => {
      expect(isSameDay(new Date(2026, 7, 29, 23, 59).getTime(), new Date(2026, 7, 30, 0, 0).getTime())).toBe(false)
    })

    it('1年違いの同じ月日は false', () => {
      expect(isSameDay(new Date(2026, 7, 29).getTime(), new Date(2025, 7, 29).getTime())).toBe(false)
    })
  })

  describe('isTalkRoute', () => {
    // 🔴 ここが緩むと、ぽいロボ本体の代わりにトーク画面が出てしまう。
    //    「完全一致のときだけ」を守る。
    it('秘密のハッシュのときだけ true', () => {
      window.location.hash = TALK_HASH
      expect(isTalkRoute()).toBe(true)
    })

    it('ハッシュが無ければ false', () => {
      window.location.hash = ''
      expect(isTalkRoute()).toBe(false)
    })

    it('似ているだけのハッシュは false', () => {
      window.location.hash = '#/t/'
      expect(isTalkRoute()).toBe(false)
      window.location.hash = `${TALK_HASH}x`
      expect(isTalkRoute()).toBe(false)
      window.location.hash = '#/talk'
      expect(isTalkRoute()).toBe(false)
    })
  })
})
