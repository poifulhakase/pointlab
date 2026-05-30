import { describe, it, expect } from 'vitest'
import { toFields, fromFields } from '../firestoreRest'

// toFields/fromFields は Firestore REST の値表現と JS 値を相互変換する手書きシリアライザ。
// 全 Firestore 書き込みがこれを経由するため、往復で値が壊れないことを担保する。
function roundTrip(obj: Record<string, unknown>): Record<string, unknown> {
  return fromFields(toFields(obj))
}

describe('firestoreRest serializer round-trip', () => {
  it('preserves strings', () => {
    expect(roundTrip({ a: 'hello', b: '' })).toEqual({ a: 'hello', b: '' })
  })

  it('preserves integers and floats', () => {
    expect(roundTrip({ i: 42, neg: -7, zero: 0, f: 1.5, fneg: -3.25 }))
      .toEqual({ i: 42, neg: -7, zero: 0, f: 1.5, fneg: -3.25 })
  })

  it('preserves booleans', () => {
    expect(roundTrip({ t: true, f: false })).toEqual({ t: true, f: false })
  })

  it('preserves null', () => {
    expect(roundTrip({ n: null })).toEqual({ n: null })
  })

  it('converts undefined to null (documented lossy behavior)', () => {
    expect(roundTrip({ u: undefined })).toEqual({ u: null })
  })

  it('preserves nested objects', () => {
    const obj = { meta: { enabled: true, count: 3, label: 'x', inner: { deep: 1.25 } } }
    expect(roundTrip(obj)).toEqual(obj)
  })

  it('preserves arrays of primitives', () => {
    const obj = { arr: [1, 2, 3], strs: ['a', 'b'], mixed: [1, 'two', true, null] }
    expect(roundTrip(obj)).toEqual(obj)
  })

  it('preserves arrays of objects', () => {
    const obj = { notes: [{ id: 1, text: 'a' }, { id: 2, text: 'b', done: false }] }
    expect(roundTrip(obj)).toEqual(obj)
  })

  it('handles a realistic memo document', () => {
    const obj = { text: '## 2026-05-30\n\nテスト本文', updatedAt: '2026-05-30T12:00:00.000Z' }
    expect(roundTrip(obj)).toEqual(obj)
  })

  it('handles the maintenance config document', () => {
    const obj = { enabled: true, message: 'メンテナンス中', updatedAt: '2026-05-30T00:00:00.000Z' }
    expect(roundTrip(obj)).toEqual(obj)
  })
})
