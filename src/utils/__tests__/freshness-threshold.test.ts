// 鮮度チェックの閾値が「短すぎる」方向に戻らないことを守るテスト。
//
// 🔴 なぜ要るか（2026-08-06）
//   `check-freshness.mjs` の週次ファイルの許容日数が **公表ラグを足し忘れて 12 日**になっており、
//   JPX が翌週分を公表する前に必ず鳴っていた（investor が「13日前・許容12日」で誤警報）。
//   誤警報を放置すると本物の停止を見逃す（オオカミ少年）ので、
//   「行間隔7日 + 実測の公表ラグ」を下回る閾値に戻ったら落とす。

import { describe, it, expect } from 'vitest'
// Vite の ?raw でスクリプト本体を文字列として取り込む（node:fs 不要＝app の型構成のまま）。
import src from '../../../scripts/check-freshness.mjs?raw'
// @ts-expect-error 型定義のない .mjs をテストから直接読む（スクリプトは JS のまま運用する）
import { holidaySlack, ageInDays, latestDateIn } from '../../../scripts/check-freshness.mjs'

/** EXPECT テーブルから { ファイル名: 許容日数 } を読む（スクリプトを実行せずに静的に見る）。 */
function readExpectTable(): Record<string, number> {
  const out: Record<string, number> = {}
  const re = /file:\s*'([^']+)'\s*,\s*maxAgeDays:\s*(\d+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) out[m[1]] = Number(m[2])
  return out
}

// 週末（金）→ 次の週末（金）＝7日。これに公表ラグが積み上がる。
const WEEKLY_ROW_GAP = 7

// git 履歴で実測した公表ラグ（最新行が更新されたコミット日 − その行の日付）の最大値。
const PUBLISH_LAG: Record<string, number> = {
  'investor.json': 8,          // JPX 投資部門別売買状況（実測 7〜8日）
  'margin.json': 7,            // 信用残・評価損益率（実測 5〜7日）
  'arbitrage.json': 6,         // 裁定残・週次（実測 5〜6日）
  'arbitrage_daily.json': 6,   // 同上（ファイル名は daily だが中身は週次）
}

describe('鮮度チェックの許容日数', () => {
  const table = readExpectTable()

  it('EXPECT テーブルが読める', () => {
    expect(Object.keys(table).length).toBeGreaterThan(10)
  })

  for (const [file, lag] of Object.entries(PUBLISH_LAG)) {
    it(`${file} は「行間隔${WEEKLY_ROW_GAP}日 + 公表ラグ${lag}日」以上を許容する`, () => {
      expect(table[file]).toBeDefined()
      expect(table[file]).toBeGreaterThanOrEqual(WEEKLY_ROW_GAP + lag)
    })
  }

  it('公表ラグを足し忘れた 12 日に戻っていない（誤警報の原因だった値）', () => {
    for (const file of Object.keys(PUBLISH_LAG)) {
      expect(table[file], `${file} が 12 日以下に戻っている`).toBeGreaterThan(12)
    }
  })
})

describe('年末年始スラック', () => {
  it('12/31〜1/3 の休場をまたぐ期間だけ +7 日される', () => {
    expect(holidaySlack(15, new Date('2026-01-05T00:00:00'))).toBe(7)
    expect(holidaySlack(15, new Date('2025-12-30T00:00:00'))).toBe(7)
    expect(holidaySlack(15, new Date('2026-01-20T00:00:00'))).toBe(7)
  })

  it('通常期は 0 日（通年で緩めない）', () => {
    expect(holidaySlack(15, new Date('2026-08-06T00:00:00'))).toBe(0)
    expect(holidaySlack(15, new Date('2026-01-21T00:00:00'))).toBe(0)
    expect(holidaySlack(15, new Date('2025-12-25T00:00:00'))).toBe(0)
  })

  it('月次公表もの（許容30日以上）は対象外', () => {
    expect(holidaySlack(45, new Date('2026-01-05T00:00:00'))).toBe(0)
  })

  it('年末年始に margin の実測ギャップ14日を吸収できる', () => {
    // 2026-01-09 の行で実際に 14 日空いた。許容 + スラックがこれを上回ること。
    const limit = readExpectTable()['margin.json'] + holidaySlack(15, new Date('2026-01-09T00:00:00'))
    expect(limit).toBeGreaterThanOrEqual(14 + 7) // 行間隔14 + 公表ラグ7
  })
})

describe('既存のヘルパー（並び順に依存しない）', () => {
  it('古い順・新しい順のどちらでも最大日付を採る', () => {
    const asc = [{ date: '2026/07/17' }, { date: '2026/07/24' }]
    const desc = [{ date: '2026/07/24' }, { date: '2026/07/17' }]
    expect(latestDateIn(asc).latest).toBe('2026/07/24')
    expect(latestDateIn(desc).latest).toBe('2026/07/24')
  })

  it('ageInDays は暦日で数える', () => {
    expect(ageInDays('2026/07/24', new Date('2026-08-06T00:00:00Z'))).toBe(13)
  })
})
