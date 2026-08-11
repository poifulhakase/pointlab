// ── プレビューモードのダミーデータ ──────────────────────────────────────
// 🔴 プレビューでは**実際のメモ・実際の売買判断を絶対に出さない**。ここの固定データだけを見せる。
// 🔵 日付は「今日から見た相対」で作る＝いつ見せても当月に予定が入っていて自然に見える。
//    （固定日にすると、月をまたいだ瞬間に空っぽのカレンダーを見せることになる）
import type { DayNote } from './noteStorage'
import type { StickyNote } from './stickyNotes'

function key(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function schedule(id: string, title: string, startTime: string, endTime: string) {
  return { id, title, startTime, endTime, alertMinutes: 0 }
}

/**
 * カレンダーに出るメモ・予定のダミー（プレビュー用）。
 * 🔵 「株のカレンダーとして何ができるか」が伝わる中身にしてある（作業メモ・チェック・振り返り）。
 */
export function previewNotes(): Record<string, Partial<DayNote>> {
  return {
    [key(0)]: {
      title: '需給チェック',
      memo: '外国人の売買動向を確認。\n先週の買い越しが続くかを見る。',
      schedules: [schedule('p1', '寄り前に需給を確認', '08:30', '09:00')],
    },
    [key(2)]: {
      title: 'SQ週の点検',
      memo: '建玉の整理。SQ週は値動きが荒くなりやすいので枚数を落とす。',
      schedules: [schedule('p2', '建玉の見直し', '15:00', '15:30')],
    },
    [key(-3)]: {
      title: '振り返り',
      memo: '25日線からの乖離が開いたところで手仕舞い。判断は早すぎず遅すぎず。',
      schedules: [],
    },
    [key(-8)]: {
      title: '決算の確認',
      memo: '保有セクターの決算を通しで確認。ガイダンスの上方修正が多い。',
      schedules: [schedule('p3', '決算まとめ読み', '20:00', '21:00')],
    },
  }
}

/** サイドバーのスティッキーメモのダミー。 */
export function previewStickyNotes(): StickyNote[] {
  return [
    { id: 'pv1', content: '押し目待ちに押し目なし\n無理に追わない', updatedAt: new Date().toISOString() },
    { id: 'pv2', content: '需給はすべてに優先する', updatedAt: new Date().toISOString() },
  ]
}
