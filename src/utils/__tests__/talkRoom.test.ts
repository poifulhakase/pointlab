import { describe, it, expect } from 'vitest'
import { dayLabel, getRoomId, isSameDay, isTalkRoute, linkify, peerState, quoteText, scaledSize } from '../talkRoom'

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

  describe('peerState', () => {
    // 🔴 端末やブラウザが変わると uid が増える＝同じ人の古い記録が残る。
    //    「自分以外の最初の1件」を採ると古い方を掴んで既読が止まる（2026-08-30 の不具合）。
    const M = (id: string, name: string, at: number, read: number) => ({ id, name, at, read })

    it('同じ人の記録が複数あっても、一番進んだ既読を採る', () => {
      const members = [
        M('aaa', 'あいて', 1000, 500),   // 古い端末
        M('bbb', 'あいて', 9000, 8000),  // いま使っている端末
        M('zzz', 'わたし', 9500, 9400),  // 自分
      ]
      expect(peerState(members, 'zzz', 'わたし')).toEqual({ name: 'あいて', at: 9000, read: 8000 })
    })

    it('自分の別端末（同じ表示名）は相手に数えない', () => {
      const members = [M('zzz', 'わたし', 9500, 9400), M('yyy', 'わたし', 9000, 9000)]
      expect(peerState(members, 'zzz', 'わたし')).toBeNull()
    })

    it('相手がまだ来ていなければ null', () => {
      expect(peerState([], 'zzz', 'わたし')).toBeNull()
    })

    it('表示名は最後に開いていた端末のものを採る', () => {
      const members = [M('aaa', '旧なまえ', 1000, 500), M('bbb', '新なまえ', 9000, 700)]
      expect(peerState(members, 'zzz', 'わたし')?.name).toBe('新なまえ')
    })
  })

  describe('quoteText', () => {
    it('改行や連続した空白は1行に詰める（引用は1行で出すため）', () => {
      expect(quoteText({ text: 'あ\nい  う' })).toBe('あ い う')
    })

    it('長い本文は切って「…」を付ける', () => {
      expect(quoteText({ text: 'あ'.repeat(80) }, 10)).toBe(`${'あ'.repeat(10)}…`)
    })

    it('ちょうどの長さでは「…」を付けない', () => {
      expect(quoteText({ text: 'あ'.repeat(10) }, 10)).toBe('あ'.repeat(10))
    })

    it('文字が無く画像だけなら「写真」', () => {
      expect(quoteText({ text: '', img: 'abc' })).toBe('写真')
      expect(quoteText({ text: '   ', img: 'abc' })).toBe('写真')
    })

    it('文字も画像も無ければ空', () => {
      expect(quoteText({ text: '' })).toBe('')
    })
  })

  describe('linkify', () => {
    // 🔵 AIが店を挙げるとき、行末に Googleマップの検索URL が付く。押せるようにするための切り分け。
    it('URLの部分だけ切り出す', () => {
      const parts = linkify('A店 https://example.com/a です')
      expect(parts.map(p => p.text)).toEqual(['A店 ', 'https://example.com/a', ' です'])
      expect(parts[1].url).toBe('https://example.com/a')
      expect(parts[0].url).toBeUndefined()
    })

    it('URLが無ければそのまま1つ', () => {
      expect(linkify('ふつうの文')).toEqual([{ text: 'ふつうの文' }])
    })

    it('文末の句点はリンクに含めない', () => {
      const parts = linkify('見て https://example.com/a。')
      expect(parts[1].url).toBe('https://example.com/a')
      expect(parts[2].text).toBe('。')
    })

    it('複数のURLを拾う', () => {
      const parts = linkify('https://a.example/1 と https://b.example/2')
      expect(parts.filter(p => p.url).length).toBe(2)
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
