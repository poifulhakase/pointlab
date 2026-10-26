/**
 * トークルームの「2人のカレンダー」（2026-10-26）。
 *
 * 🔵 予約したデート・お店を月のカレンダーに置く。保存先はトークと同じ部屋の `events`。
 * 🔴 **AI が勝手に予定を入れることはしない**。追加は必ず本人の操作（長押し→追加／＋）。
 *    AI はメッセージから日付・時刻・お店を読み取って**入力欄を埋めるだけ**。
 * 🔵 書き込みは REST・読み取りは onSnapshot（`talkRoom.ts` と同じ理由）。
 */
import { getRoomId, randomId, restDeleteDoc, restWriteDoc, roomDocPath } from './talkRoom'

export interface TalkEvent {
  id: string
  /** 日付（`2026-10-31`・日本時間の暦日） */
  date: string
  /** 時刻（`19:30`）。決まっていなければ空 */
  time: string
  title: string
  place: string
  /** お店のページなど */
  url: string
  memo: string
  /** 入れた人の表示名 */
  by: string
  /** 入れた時刻（ミリ秒） */
  at: number
  /** 元にしたメッセージのID（長押しから入れたとき） */
  src?: string
}

/** 入力欄の中身（id・by・at は保存時に付ける）。 */
export type EventDraft = Pick<TalkEvent, 'date' | 'time' | 'title' | 'place' | 'url' | 'memo'> & { src?: string }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/

/** ミリ秒 → `2026-10-31`（端末の暦日）。 */
export function dateKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 空の入力欄（日付だけ入れておく）。 */
export function emptyDraft(date: string): EventDraft {
  return { date, time: '', title: '', place: '', url: '', memo: '' }
}

/**
 * 月のマス目（日曜はじまり・6週固定＝月によって高さが変わらない）。
 * 前後の月の日も `inMonth: false` で入れる（薄く出す）。
 */
export function monthCells(year: number, month: number): { key: string; day: number; inMonth: boolean }[] {
  const first = new Date(year, month, 1)
  const start = new Date(year, month, 1 - first.getDay())
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    return { key: dateKey(d.getTime()), day: d.getDate(), inMonth: d.getMonth() === month }
  })
}

/** 日付ごとにまとめる（各日の中は時刻順・時刻なしは先頭）。 */
export function groupByDate(events: TalkEvent[]): Map<string, TalkEvent[]> {
  const map = new Map<string, TalkEvent[]>()
  for (const e of events) {
    const list = map.get(e.date) ?? []
    list.push(e)
    map.set(e.date, list)
  }
  for (const list of map.values()) list.sort((a, b) => a.time.localeCompare(b.time) || a.at - b.at)
  return map
}

/** 「10月31日(土)」。 */
export function dateLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const week = ['日', '月', '火', '水', '木', '金', '土'][new Date(y, m - 1, d).getDay()]
  return `${m}月${d}日(${week})`
}

/** 入力欄の中身を保存できる形に整える（日付が無い・用件が無いときは null）。 */
export function normalizeDraft(d: EventDraft): EventDraft | null {
  const date = d.date.trim()
  const title = d.title.trim().slice(0, 60)
  if (!DATE_RE.test(date) || !title) return null
  const time = d.time.trim()
  const url = d.url.trim()
  return {
    date,
    time: TIME_RE.test(time) ? time.padStart(5, '0') : '',
    title,
    place: d.place.trim().slice(0, 80),
    url: /^https?:\/\//.test(url) ? url.slice(0, 500) : '',
    memo: d.memo.trim().slice(0, 300),
    ...(d.src ? { src: d.src } : {}),
  }
}

// ── 読み書き ────────────────────────────────────────────────────────

/** 予定を保存する（id があれば上書き）。 */
export async function saveEvent(draft: EventDraft, by: string, id?: string): Promise<void> {
  const ok = normalizeDraft(draft)
  if (!ok) throw new Error('日付と用件を入れてください')
  const eid = id ?? `${Date.now()}_${randomId().slice(0, 6)}`
  await restWriteDoc(`${roomDocPath()}/events/${eid}`, { ...ok, by, at: Date.now() })
}

export async function deleteEvent(id: string): Promise<void> {
  await restDeleteDoc(`${roomDocPath()}/events/${id}`)
}

/** 予定を全部購読する（2人の予定なので件数は少ない）。 */
export async function watchEvents(cb: (rows: TalkEvent[]) => void): Promise<() => void> {
  const [{ collection, onSnapshot }, { getDb }] = await Promise.all([
    import('firebase/firestore'),
    import('./firebase'),
  ])
  const db = await getDb()
  return onSnapshot(collection(db, roomDocPath(), 'events'), snap => {
    cb(snap.docs.map(d => {
      const v = d.data() as Partial<TalkEvent>
      return {
        id: d.id, date: v.date ?? '', time: v.time ?? '', title: v.title ?? '', place: v.place ?? '',
        url: v.url ?? '', memo: v.memo ?? '', by: v.by ?? '', at: Number(v.at ?? 0),
        ...(v.src ? { src: v.src } : {}),
      }
    }))
  }, () => { /* 通信が切れても画面は保つ */ })
}

/**
 * メッセージから予定を読み取って入力欄を埋める（`api/talk.js` の `a=event`）。
 * 🔵 読み取れなかった項目は空のまま返る。失敗したら日付だけ入った入力欄で続ける（呼び出し側）。
 */
export async function readEventFromText(text: string, at: number): Promise<Partial<EventDraft>> {
  const res = await fetch('/api/talk?a=event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room: getRoomId(), text, at }),
  })
  const data = await res.json().catch(() => ({})) as { event?: Partial<EventDraft>; error?: string }
  if (!res.ok || !data.event) throw new Error(data.error || '読み取れませんでした')
  return data.event
}
