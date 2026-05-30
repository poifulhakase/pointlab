import { describe, it, expect } from 'vitest'
import { buildNewsPrompt, buildUpcomingEventsText } from '../newsPrompt'

describe('buildUpcomingEventsText', () => {
  it('returns a non-empty string', () => {
    const text = buildUpcomingEventsText(5)
    expect(typeof text).toBe('string')
    expect(text.length).toBeGreaterThan(0)
  })

  it('returns "イベントなし" or dated lines', () => {
    const text = buildUpcomingEventsText(5)
    // 各行は「YYYY-MM-DD（曜）: ...」形式、またはイベントなし
    const ok = text === 'イベントなし' || /\d{4}-\d{2}-\d{2}（.）:/.test(text)
    expect(ok).toBe(true)
  })
})

describe('buildNewsPrompt', () => {
  const ts = '2026-05-30 12:00:00'
  const events = '2026-06-02（火）: FOMC'
  const tev = 'エンジンレポート日付：2026-05-29\n強持続'

  it('embeds the timestamp, events and TEV state', () => {
    const p = buildNewsPrompt(ts, events, tev)
    expect(p).toContain(ts)
    expect(p).toContain(events)
    expect(p).toContain(tev)
  })

  it('includes the required output sections', () => {
    const p = buildNewsPrompt(ts, events, tev)
    expect(p).toContain('ぽいロボ イベント予測')
    expect(p).toContain('【分析対象イベント】')
    expect(p).toContain('【事前判断】')
    expect(p).toContain('【参照需給状態】')
  })

  it('instructs no-markdown output', () => {
    const p = buildNewsPrompt(ts, events, tev)
    expect(p).toContain('マークダウン記号')
  })
})
