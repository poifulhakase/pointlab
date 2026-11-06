import { describe, expect, it } from 'vitest'
import { foldText, matchRange, searchMessages, searchTerms, snippet } from './talkSearch'

const m = (text: string, at: number) => ({ id: String(at), text, at })

describe('talkSearch', () => {
  it('カタカナ/ひらがな・全角/半角・大文字/小文字をそろえる', () => {
    expect(foldText('ラーメン')).toBe('らーめん')
    expect(foldText('ＬＩＮＥ ﾃｽﾄ')).toBe('line てすと')
  })

  it('空白で区切ると全部を含むものだけ（AND）', () => {
    const rows = [m('明日 池袋でランチ', 1), m('池袋の物件', 2), m('ランチどうする？', 3)]
    expect(searchMessages(rows, '池袋 ランチ').map(h => h.m.at)).toEqual([1])
  })

  it('新しい順に並べる・空の検索語は何も返さない', () => {
    const rows = [m('ねこ', 1), m('ネコ', 3), m('猫', 2), m('ねこ', 5)]
    expect(searchMessages(rows, 'ねこ').map(h => h.m.at)).toEqual([5, 3, 1])
    expect(searchMessages(rows, '  ')).toEqual([])
    expect(searchTerms(' a  b ')).toEqual(['a', 'b'])
  })

  it('見つかった位置は元の本文の位置で返す（半角カナで長さが変わっても）', () => {
    const text = 'ｶﾞｽ代は来週ガス会社へ'
    const r = matchRange(text, searchTerms('がす'))!
    expect(text.slice(r.start, r.end)).toBe('ｶﾞｽ')
    const t2 = '😀 東久留米の家'
    const r2 = matchRange(t2, searchTerms('東久留米'))!
    expect(t2.slice(r2.start, r2.end)).toBe('東久留米')
  })

  it('本文が無い発言（画像だけ）は当たらない', () => {
    expect(searchMessages([m('', 1)], 'a')).toEqual([])
  })

  it('抜き書きは語の前後だけ・詰めたら…', () => {
    const text = 'あ'.repeat(30) + '池袋' + 'い'.repeat(60)
    const s = snippet(text, 30, 32)
    expect(s.hit).toBe('池袋')
    expect(s.pre.startsWith('…')).toBe(true)
    expect(s.post.endsWith('…')).toBe(true)
    expect(snippet('改行\nあり', 0, 2)).toEqual({ pre: '', hit: '改行', post: ' あり' })
  })
})
