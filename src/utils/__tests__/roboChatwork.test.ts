import { describe, it, expect } from 'vitest'
// @ts-expect-error — .mjs に型定義は無い
import { buildNotification, isImage, ageInDays } from '../../../scripts/chatwork.mjs'

const base = {
  date: '2026-08-10',
  decision: {
    action: 'open', symbol: '1570', qty: 30, confidence_pct: 65,
    reason: '価格が25日線の上でトレンドは上昇。20日高値を更新中。',
    counter: '25日線を明確に割ったら読みが外れる。',
    user_note: '',
  },
  execPrice: 31200,
  account: { position: { symbol: '1570', qty: 30, avg_price: 31200, stop_price: 29800 }, equity: 1002400 },
  baseline: { side: 'bull' },
}

describe('isImage', () => {
  it('画像の拡張子を見分ける', () => {
    expect(isImage('chart.png')).toBe(true)
    expect(isImage('IMG_1234.JPG')).toBe(true)
    expect(isImage('report.pdf')).toBe(false)
    expect(isImage(undefined)).toBe(false)
  })
})

describe('ageInDays', () => {
  const now = new Date('2026-08-10T12:00:00Z').getTime()
  it('何日前かを出す', () => {
    const threeDaysAgo = Math.floor(now / 1000) - 3 * 86400
    expect(ageInDays(threeDaysAgo, now)).toBe(3)
  })
  it('当日は 0', () => {
    expect(ageInDays(Math.floor(now / 1000) - 3600, now)).toBe(0)
  })
  it('値が無ければ null', () => {
    expect(ageInDays(null, now)).toBe(null)
  })
})

describe('buildNotification', () => {
  it('新規建てのときは銘柄と口数が見出しに出る', () => {
    const m = buildNotification(base)
    expect(m).toContain('新規建て')
    expect(m).toContain('1570')
    expect(m).toContain('30口')
  })

  it('🔴 反証（この判断が外れるとき）を必ず載せる', () => {
    const m = buildNotification(base)
    expect(m).toContain('この判断が外れるとき')
    expect(m).toContain('25日線を明確に割ったら')
  })

  it('理由が本文に入る', () => {
    const m = buildNotification(base)
    expect(m).toContain('価格が25日線の上で')
  })

  it('🔴 hold の日も通知を作る（毎日送るため）', () => {
    const m = buildNotification({ ...base, decision: { ...base.decision, action: 'hold', symbol: 'none', qty: 0 } })
    expect(m).toContain('見送り')
    expect(m).toContain('この判断が外れるとき')
  })

  it('対照群の判断を併記する', () => {
    const m = buildNotification(base)
    expect(m).toContain('対照群')
    expect(m).toContain('ブル')
  })

  it('保有が無ければ「保有: なし」と出す', () => {
    const m = buildNotification({ ...base, account: { position: null, equity: 1000000 } })
    expect(m).toContain('保有: なし')
  })

  it('成績はロボと対照群を並べて出す', () => {
    const m = buildNotification({
      ...base,
      stats: {
        closed_trades: 12, win_rate: 0.5, expectancy: 1250, max_drawdown_pct: -8.4,
        baseline: { win_rate: 0.42, expectancy: 800, max_drawdown_pct: -9.1 },
      },
    })
    expect(m).toContain('ロボ:')
    expect(m).toContain('対照群:')
  })

  it('user_note があれば「あなたの保有について」を出す', () => {
    const m = buildNotification({ ...base, decision: { ...base.decision, user_note: 'ロボと逆向きです' } })
    expect(m).toContain('あなたの保有について')
    expect(m).toContain('ロボと逆向き')
  })

  it('注意事項があれば列挙する（画像が古い等）', () => {
    const m = buildNotification({ ...base, warnings: ['保有画面のキャプチャが5営業日前です'] })
    expect(m).toContain('注意')
    expect(m).toContain('5営業日前')
  })

  it('Chatwork の info タグで囲まれている', () => {
    const m = buildNotification(base)
    expect(m.startsWith('[info][title]')).toBe(true)
    expect(m.trimEnd().endsWith('[/info]')).toBe(true)
  })
})
