import { describe, expect, it } from 'vitest'
import { kindOf, strengthOf, wallpaperOf } from './talkWeather'

/**
 * 天気コードの読み替え（2026-09-13）。
 *
 * 🔴 ここを間違えると「雨なのに青空」が出る。表は WMO weather_code。
 */
describe('kindOf — WMO の天気コードを5種類に寄せる', () => {
  it('快晴は晴れ', () => {
    expect(kindOf(0)).toBe('sunny')
  })

  it('1〜3（晴れ時々くもり〜くもり）と霧はくもり', () => {
    expect(kindOf(1)).toBe('cloudy')
    expect(kindOf(3)).toBe('cloudy')
    expect(kindOf(45)).toBe('cloudy')
    expect(kindOf(48)).toBe('cloudy')
  })

  it('霧雨・雨・にわか雨は雨', () => {
    expect(kindOf(51)).toBe('rain')
    expect(kindOf(61)).toBe('rain')
    expect(kindOf(65)).toBe('rain')
    expect(kindOf(67)).toBe('rain')
    expect(kindOf(80)).toBe('rain')
    expect(kindOf(82)).toBe('rain')
  })

  it('雪とにわか雪は雪', () => {
    expect(kindOf(71)).toBe('snow')
    expect(kindOf(77)).toBe('snow')
    expect(kindOf(85)).toBe('snow')
    expect(kindOf(86)).toBe('snow')
  })

  it('95以上は雷', () => {
    expect(kindOf(95)).toBe('storm')
    expect(kindOf(99)).toBe('storm')
  })

  it('知らない値は晴れに落とす（画面を壊さない）', () => {
    expect(kindOf(-1)).toBe('sunny')
    expect(kindOf(120)).toBe('storm')   // 95以上の扱いに入る
  })
})

describe('wallpaperOf — 描ける3種類へ寄せる', () => {
  it('雪はくもり・雷は雨に寄せる（絵をまだ作っていないため）', () => {
    expect(wallpaperOf('snow')).toBe('cloudy')
    expect(wallpaperOf('storm')).toBe('rain')
  })

  it('採用した3つはそのまま', () => {
    expect(wallpaperOf('sunny')).toBe('sunny')
    expect(wallpaperOf('cloudy')).toBe('cloudy')
    expect(wallpaperOf('rain')).toBe('rain')
  })
})

describe('strengthOf — 雨脚の強さ', () => {
  it('霧雨と弱いにわか雨は弱い', () => {
    expect(strengthOf(51)).toBe('weak')
    expect(strengthOf(57)).toBe('weak')
    expect(strengthOf(80)).toBe('weak')
  })

  it('強い雨・大雪・雷雨は強い', () => {
    expect(strengthOf(65)).toBe('heavy')
    expect(strengthOf(82)).toBe('heavy')
    expect(strengthOf(75)).toBe('heavy')
    expect(strengthOf(95)).toBe('heavy')
  })

  it('それ以外はふつう', () => {
    expect(strengthOf(61)).toBe('normal')
    expect(strengthOf(63)).toBe('normal')
    expect(strengthOf(0)).toBe('normal')
  })
})
