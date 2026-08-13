import { describe, it, expect } from 'vitest'
import { getRoboJobsForDate } from '../roboSchedule'

// 🔴 ここが崩れると「PCを開けておく時間」が出なくなる／休場日に出てしまう。
describe('getRoboJobsForDate', () => {
  const wed = new Date(2026, 7, 12)   // 水曜
  const sat = new Date(2026, 7, 15)   // 土曜
  const sun = new Date(2026, 7, 16)   // 日曜

  it('平日は判断・撮影・保存・データ更新2回が出る', () => {
    const jobs = getRoboJobsForDate(wed)
    expect(jobs.map(j => j.id)).toEqual(['judge', 'capture', 'archive', 'data1', 'data2'])
    expect(jobs.find(j => j.id === 'judge')?.startTime).toBe('15:00')
  })

  it('PCが要るのは撮影だけ', () => {
    const jobs = getRoboJobsForDate(wed)
    expect(jobs.filter(j => j.needsPc).map(j => j.id)).toEqual(['capture'])
  })

  it('土曜は週次だけ、日曜は何も無い', () => {
    expect(getRoboJobsForDate(sat).map(j => j.id)).toEqual(['weekly'])
    expect(getRoboJobsForDate(sun)).toEqual([])
  })

  it('休場日は平日でも動かない', () => {
    expect(getRoboJobsForDate(wed, () => true)).toEqual([])
    // 🔵 土曜の週次は市場と関係ないので、休場判定に関わらず出る
    expect(getRoboJobsForDate(sat, () => true).map(j => j.id)).toEqual(['weekly'])
  })
})
