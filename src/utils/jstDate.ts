// JST（Asia/Tokyo）の日付・時刻ユーティリティ。
// 従来は `new Date(Date.now() + 9*3600*1000).toISOString()` の手動オフセットが各所に散在し、
// 日付境界（深夜0時前後）で off-by-one の懸念があった。Intl でタイムゾーンを明示して正確に求める。

/** JST の今日の日付キー "YYYY-MM-DD"。 */
export function jstTodayKey(): string {
  // en-CA ロケールは YYYY-MM-DD 形式を返す
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

/** JST の現在時刻 "YYYY-MM-DD HH:MM:SS"。 */
export function jstTimestamp(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date())
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`
}
