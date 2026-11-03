import { describe, it, expect } from 'vitest'
// @ts-expect-error api/ は素の JS（型定義を持たない）
import { buildPropertyText, normalizeProperty, propertyKey, propertySameKey } from '../../../api/_talkNotify.js'
import { sortProperties, toProperty } from '../talkProperty'

// 🔵 本番は sha1。テストでは「入力が同じなら同じ・違えば違う」が分かれば足りる（末尾の差も先頭24桁に出るよう反転）
const sha1 = (s: string) => [...s].map(c => c.charCodeAt(0).toString(16)).join('').split('').reverse().join('')
const base = { title: '〇〇ハイツ 302', url: 'https://example.com/b/123/' }

describe('物件のお知らせ（🏠）', () => {
  it('URL と名前が無いものは通知しない', () => {
    expect(normalizeProperty({ title: 'x' })).toBeNull()
    expect(normalizeProperty({ url: 'https://a.jp/1' })).toBeNull()
    expect(normalizeProperty({ title: 'x', url: 'javascript:alert(1)' })).toBeNull()
    expect(normalizeProperty(null)).toBeNull()
  })

  it('文字列以外は空にし、長さを切る', () => {
    const p = normalizeProperty({ ...base, price: 125000, memo: 'あ'.repeat(400) })
    expect(p.price).toBe('')
    expect(p.memo).toHaveLength(300)
  })

  it('同じ物件は計測パラメータ・末尾/・#が違っても同じID', () => {
    const a = propertyKey('https://Example.com/b/123/', sha1)
    expect(propertyKey('https://example.com/b/123?utm_source=x#top', sha1)).toBe(a)
    expect(propertyKey('https://example.com/b/124', sha1)).not.toBe(a)
    expect(propertyKey('https://example.com/b/123?id=9', sha1)).not.toBe(a)
  })

  it('別サイトの同じ物件＝物件名と間取りの表記ゆれをそろえて同じ鍵', () => {
    const a = propertySameKey({ title: 'パークハイツ西東京 302', layout: '2LDK', address: '' })
    expect(propertySameKey({ title: 'ﾊﾟｰｸﾊｲﾂ西東京302', layout: '２ＬＤＫ', address: 'x' })).toBe(a)
    expect(propertySameKey({ title: 'パークハイツ西東京 303', layout: '2LDK', address: '' })).not.toBe(a)
    expect(propertySameKey({ title: 'ハイツ', layout: '2LDK', address: '' })).toBe('')
  })

  it('LINE の本文に部屋のURLは入らず、空の行は詰める', () => {
    const t = buildPropertyText(normalizeProperty({ ...base, price: '12万円', access: '駅 徒歩5分' }))
    expect(t).toBe('🏠 物件のお知らせ\n〇〇ハイツ 302\n12万円\n駅 徒歩5分\nhttps://example.com/b/123/')
    expect(t).not.toMatch(/talk|#\//)
  })

  it('一覧は隠したものを除いて新しい順・足りない項目は空', () => {
    const rows = [toProperty('a', { title: '古い', at: 1 }), toProperty('b', { title: '新しい', at: 2, notified: true }), toProperty('c', { at: 3, hidden: true })]
    expect(sortProperties(rows).map(r => r.id)).toEqual(['b', 'a'])
    expect(rows[0]).toMatchObject({ url: '', notified: false })
  })
})
