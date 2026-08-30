import { describe, it, expect } from 'vitest'
import { dayLabel, getRoomId, isSameDay, isTalkRoute, scaledSize } from '../talkRoom'

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

  describe('isTalkRoute / getRoomId', () => {
    // 🔴 ここが緩むと、ぽいロボ本体の代わりにトーク画面が出てしまう。
    //    形（#/t/ ＋ 32桁の16進）が完全に一致したときだけ通す。
    //    🔴 本物の部屋IDはコードにもテストにも書かない（合っているかはルールが弾く）。
    const SAMPLE = '0123456789abcdef0123456789abcdef'

    it('形が合っていれば true・IDを取り出せる', () => {
      window.location.hash = `#/t/${SAMPLE}`
      expect(isTalkRoute()).toBe(true)
      expect(getRoomId()).toBe(SAMPLE)
    })

    it('ハッシュが無ければ false', () => {
      window.location.hash = ''
      expect(isTalkRoute()).toBe(false)
      expect(getRoomId()).toBe('')
    })

    it('形が違えば false', () => {
      for (const h of ['#/t/', '#/talk', `#/t/${SAMPLE}x`, `#/t/${SAMPLE.slice(0, 31)}`, '#/t/ZZZZ']) {
        window.location.hash = h
        expect(isTalkRoute()).toBe(false)
        expect(getRoomId()).toBe('')
      }
    })

    it('大文字の16進は通さない（IDの表記ゆれで別の部屋になるのを防ぐ）', () => {
      window.location.hash = `#/t/${SAMPLE.toUpperCase()}`
      expect(isTalkRoute()).toBe(false)
    })
  })

  describe('scaledSize', () => {
    // 🔴 iPhone の写真（横向き・縦向き・Pro の 48MP）が、長辺の指定に収まること。
    it('長辺を指定の大きさに収める（縦横比は保つ）', () => {
      expect(scaledSize(4032, 3024, 1280)).toEqual({ w: 1280, h: 960 })
      expect(scaledSize(3024, 4032, 1280)).toEqual({ w: 960, h: 1280 })
      expect(scaledSize(8064, 6048, 1280)).toEqual({ w: 1280, h: 960 })
    })

    it('元が小さければ拡大しない', () => {
      expect(scaledSize(400, 300, 1280)).toEqual({ w: 400, h: 300 })
    })

    it('極端に細長くても 0px にはしない（canvas が作れなくなるため）', () => {
      expect(scaledSize(5000, 1, 1280)).toEqual({ w: 1280, h: 1 })
    })
  })
})
