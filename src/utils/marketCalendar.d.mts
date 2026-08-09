export function isNationalHoliday(date: Date): boolean
export function isMarketClosed(date: Date): boolean
export function isNYSEWeekdayHoliday(date: Date): boolean
export function getClosedReason(date: Date): string | null
export function parseYmd(s: string): Date
export function toYmd(date: Date): string
export function closedLabel(date: Date): string | null
export function nextBusinessDay(date: Date): Date
export function upcomingBusinessDays(date: Date, n: number): Date[]
