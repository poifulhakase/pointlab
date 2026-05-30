import { describe, it, expect } from 'vitest'
import { isRecord, asNumber, asString, asBoolean, asArray, field } from '../validate'

describe('validate helpers', () => {
  it('isRecord distinguishes plain objects', () => {
    expect(isRecord({})).toBe(true)
    expect(isRecord({ a: 1 })).toBe(true)
    expect(isRecord([])).toBe(false)
    expect(isRecord(null)).toBe(false)
    expect(isRecord('x')).toBe(false)
  })

  it('asNumber accepts finite numbers and numeric strings', () => {
    expect(asNumber(42)).toBe(42)
    expect(asNumber('3.5')).toBe(3.5)
    expect(asNumber(NaN)).toBe(null)
    expect(asNumber(Infinity)).toBe(null)
    expect(asNumber('abc')).toBe(null)
    expect(asNumber(undefined, 0)).toBe(0)
  })

  it('asString / asBoolean fall back on wrong types', () => {
    expect(asString('hi')).toBe('hi')
    expect(asString(123)).toBe('')
    expect(asBoolean(true)).toBe(true)
    expect(asBoolean('true')).toBe(false)
    expect(asBoolean(undefined, true)).toBe(true)
  })

  it('asArray returns [] for non-arrays', () => {
    expect(asArray([1, 2])).toEqual([1, 2])
    expect(asArray('x')).toEqual([])
    expect(asArray(null)).toEqual([])
  })

  it('field extracts nested record fields safely', () => {
    const json = { fields: { enabled: { booleanValue: true } } }
    expect(field(field(field(json, 'fields'), 'enabled'), 'booleanValue')).toBe(true)
    expect(field(null, 'x')).toBe(undefined)
    expect(field('str', 'x')).toBe(undefined)
  })
})
