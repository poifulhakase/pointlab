import { describe, it, expect } from 'vitest'
import {
  addMonths, toBusinessDayBack, closeOfWeek, findRuns, normalizeCode,
  type MarginWeek, type WeeklyBar,
} from '../marginKijitsu'

const noHoliday = (d: Date) => d.getDay() === 0 || d.getDay() === 6

// 週足（月曜始まり）と、その週の金曜の信用残を作る
function weeks(start: string, closes: number[], sysLongs: number[]) {
  const [y, m, d] = start.split('-').map(Number)
  const bars: WeeklyBar[] = []
  const margin: MarginWeek[] = []
  closes.forEach((c, i) => {
    const mon = new Date(y, m - 1, d + i * 7)
    const fri = new Date(y, m - 1, d + i * 7 + 4)
    const f = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
    bars.push({ date: f(mon), open: c, high: c, low: c, close: c })
    margin.push({ w: f(fri), sysLong: sysLongs[i], genLong: 0, sysShort: 0, genShort: 0 })
  })
  return { bars, margin }
}

describe('addMonths', () => {
  it('同じ日／無ければ月末', () => {
    expect(addMonths('2026-03-30', 6)).toBe('2026-09-30')
    expect(addMonths('2026-08-31', 6)).toBe('2027-02-28')
    expect(addMonths('2026-05-15', 6)).toBe('2026-11-15')
  })
})

describe('toBusinessDayBack', () => {
  it('土日は前の金曜へ', () => {
    expect(toBusinessDayBack('2026-11-15', noHoliday)).toBe('2026-11-13')
    expect(toBusinessDayBack('2026-09-30', noHoliday)).toBe('2026-09-30')
  })
  it('祝日も寄せる（既定は東証の休場判定）', () => {
    // 2026-09-22（国民の休日）・09-21（敬老の日）→ 09-18（金）
    expect(toBusinessDayBack('2026-09-22')).toBe('2026-09-18')
  })
})

describe('closeOfWeek', () => {
  it('週末日を含む週足の終値', () => {
    const bars: WeeklyBar[] = [
      { date: '2026-09-07', open: 1, high: 1, low: 1, close: 100 },
      { date: '2026-09-14', open: 1, high: 1, low: 1, close: 200 },
    ]
    expect(closeOfWeek('2026-09-11', bars)).toBe(100)
    expect(closeOfWeek('2026-09-18', bars)).toBe(200)
    expect(closeOfWeek('2026-09-25', bars)).toBeNull()
  })
})

describe('findRuns', () => {
  it('IHI の3/30〜5/15 と同じ形＝6週続いた悪化を1つの期間にする', () => {
    //                      基準  悪化×6（買残↑・株価↓）                  回復
    const { bars, margin } = weeks('2026-03-23',
      [3500, 3400, 3303, 3120, 2995, 2880, 2685, 2761],
      [16.2, 16.4, 18.5, 20.2, 21.6, 22.4, 26.7, 24.8])
    const runs = findRuns(margin, bars, { closed: noHoliday })
    expect(runs).toHaveLength(1)
    expect(runs[0]).toMatchObject({
      from: '2026-03-30', to: '2026-05-08', weeks: 6,
      sysLongFrom: 16.2, sysLongTo: 26.7, closeFrom: 3500, closeTo: 2685,
      kijitsuFrom: '2026-09-30', kijitsuTo: '2026-11-06',
    })
  })

  it('3週に届かない悪化は出さない', () => {
    const { bars, margin } = weeks('2026-08-03', [100, 90, 95, 85, 80, 90], [1, 2, 1, 2, 3, 2])
    expect(findRuns(margin, bars, { closed: noHoliday })).toEqual([])
    expect(findRuns(margin, bars, { closed: noHoliday, minWeeks: 2 })).toHaveLength(1)
  })

  it('買残が増えても株価が上がった週は悪化にしない', () => {
    const { bars, margin } = weeks('2026-08-03', [100, 110, 120, 130], [1, 2, 3, 4])
    expect(findRuns(margin, bars, { closed: noHoliday, minWeeks: 1 })).toEqual([])
  })

  it('データが2週より空いたら連続とみなさない', () => {
    const { bars, margin } = weeks('2026-08-03', [100, 90, 80, 70, 60, 50], [1, 2, 3, 4, 5, 6])
    margin.splice(2, 2)   // 3・4週目が欠けた
    expect(findRuns(margin, bars, { closed: noHoliday, minWeeks: 2 })).toEqual([])
  })

  it('株価が無い週は判定しない', () => {
    const { margin } = weeks('2026-08-03', [100, 90, 80, 70], [1, 2, 3, 4])
    expect(findRuns(margin, [], { closed: noHoliday, minWeeks: 1 })).toEqual([])
  })
})

describe('normalizeCode', () => {
  it('4桁・英字入り・全角を受ける', () => {
    expect(normalizeCode(' 7013 ')).toBe('7013')
    expect(normalizeCode('285a')).toBe('285A')
    expect(normalizeCode('７０１３')).toBe('7013')
    expect(normalizeCode('701')).toBeNull()
    expect(normalizeCode('70130')).toBeNull()
  })
})
