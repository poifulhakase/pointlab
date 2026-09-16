import { describe, it, expect } from 'vitest'
import { getRoboJobsForDate } from '../roboSchedule'

// 🔴 ここが崩れると「PCを開けておく時間」が出なくなる／休場日に出てしまう。
describe('getRoboJobsForDate', () => {
  const wed = new Date(2026, 7, 12)   // 水曜
  const sat = new Date(2026, 7, 15)   // 土曜
  const sun = new Date(2026, 7, 16)   // 日曜

  // 🔴 2026-09-16：ロボ口座の廃止で「判断」「撮影」を外した
  it('平日は保存・データ更新2回が出る（判断・撮影は無い）', () => {
    const jobs = getRoboJobsForDate(wed)
    expect(jobs.map(j => j.id)).toEqual(['archive', 'data1', 'data2'])
  })

  it('PCを開けておく予定は無い', () => {
    expect(getRoboJobsForDate(wed).filter(j => j.needsPc)).toEqual([])
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
