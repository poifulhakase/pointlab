/**
 * 東証（東京証券取引所）の休場日判定。
 *
 * 🔴 実装は `marketCalendar.mjs` にある（単一情報源）。
 *    Node スクリプト（scripts/robo-trade.mjs）が同じ判定を使うため、
 *    ロジックは .mjs 側に置き、ここは型付きの入口だけにしている。
 *    休場条件を変えるときは marketCalendar.mjs を直すこと。
 */
export {
  isNationalHoliday,
  isMarketClosed,
  isNYSEWeekdayHoliday,
  getClosedReason,
} from './marketCalendar.mjs'
