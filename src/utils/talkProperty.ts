/**
 * トークルームの「通知した物件」（カレンダー左上の🏠・2026-11-03）。
 *
 * 🔵 物件は Claude が検索して見つけ、`scripts/notify-property.mjs` → `api/talk.js?a=property` で
 *    部屋の `properties` に保存＋LINEグループへ通知する。画面は**読む・消すだけ**（作るのはサーバー）。
 */
import { restWriteDoc, roomDocPath } from './talkRoom'

export interface TalkProperty {
  id: string
  title: string
  url: string
  /** 家賃・価格（サイトの表記のまま） */
  price: string
  /** 間取り・広さ */
  layout: string
  /** 最寄り駅・徒歩 */
  access: string
  address: string
  /** 条件に合うと判断した理由 */
  memo: string
  /** 見つけたときの検索ワード */
  query: string
  /** 通知した時刻（ミリ秒） */
  at: number
  /** LINEに届いたか */
  notified: boolean
  /** 一覧から隠した（記録は残す＝同じ物件はもう通知されない） */
  hidden: boolean
}

/** Firestore の生データ → 画面の形（足りない項目は空）。 */
export function toProperty(id: string, v: Partial<TalkProperty>): TalkProperty {
  const s = (x: unknown) => (typeof x === 'string' ? x : '')
  return {
    id, title: s(v.title), url: s(v.url), price: s(v.price), layout: s(v.layout), access: s(v.access),
    address: s(v.address), memo: s(v.memo), query: s(v.query), at: Number(v.at ?? 0), notified: v.notified === true, hidden: v.hidden === true,
  }
}

/** 隠したものを除いて新しい順。 */
export function sortProperties(rows: TalkProperty[]): TalkProperty[] {
  return rows.filter(r => !r.hidden).sort((a, b) => b.at - a.at)
}

/** Googleマップの検索リンク（住所があれば住所・無ければ物件名）。`api/_talkNotify.js` の propertyMapUrl と同じ作り。 */
export function mapUrl(p: Pick<TalkProperty, 'title' | 'address'>): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address || p.title)}`
}

/** 「11/3」。 */
export function shortDate(ms: number): string {
  const d = new Date(ms)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** 一覧から隠す。🔴 消さない（消すと同じ物件がまた通知される）。 */
export async function hideProperty(id: string): Promise<void> {
  await restWriteDoc(`${roomDocPath()}/properties/${id}`, { hidden: true }, ['hidden'])
}

/** 物件を全部購読する。 */
export async function watchProperties(cb: (rows: TalkProperty[]) => void): Promise<() => void> {
  const [{ collection, onSnapshot }, { getDb }] = await Promise.all([
    import('firebase/firestore'),
    import('./firebase'),
  ])
  const db = await getDb()
  return onSnapshot(collection(db, roomDocPath(), 'properties'), snap => {
    cb(sortProperties(snap.docs.map(d => toProperty(d.id, d.data() as Partial<TalkProperty>))))
  }, () => { /* 通信が切れても画面は保つ */ })
}
