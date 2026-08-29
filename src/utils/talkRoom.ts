/**
 * 一時トークルーム（LINE が使えない相手との、期間限定のやり取り用）。
 *
 * 🔴 **ぽいロボ本体とは無関係の間借り**。ナビ・リンク・サイトマップのどこにも出さず、
 *    秘密のハッシュ（`#/t/<ROOM_ID>`）を直接開いたときだけ `main.tsx` が描画する。
 *    App.tsx（ぽいロボ本体）は一切マウントされないので、既存画面への影響はない。
 *
 * 🔴 **ログインしない**。守りは「部屋IDを知っていること」だけで、Firestore ルールも
 *    `talkRooms/<ROOM_ID>` 配下だけを無認証で許可している（かつ期限つき）。
 *    重要な内容を置かない前提の割り切り。片付けるときは
 *    ①ルールの talkRooms ブロック削除 ②Firestore のコレクション削除 ③このファイルと
 *    TalkRoom.tsx / main.tsx の分岐を削除、の3つ。
 *
 * 🔵 読み取りは SDK の onSnapshot（リアルタイム）、書き込みは REST。
 *    この環境では SDK の書き込みがハングする実績があるため（firestoreRest.ts と同じ理由）。
 *    ただし REST の共通実装は ID トークン必須なので、ここでは**認証なし版**を持つ。
 */

const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

/** 部屋のID＝そのまま鍵。変えるときは firestore.rules の talkRooms ブロックも一緒に変える。 */
export const ROOM_ID = 'd9a0bd2484b7b12af28ffa164f141507'

/** この接頭辞で始まるハッシュのときだけトーク画面を出す。 */
export const TALK_HASH = `#/t/${ROOM_ID}`

/** いま開いているURLがトークルームか（main.tsx の分岐で使う）。 */
export function isTalkRoute(): boolean {
  return typeof window !== 'undefined' && window.location.hash === TALK_HASH
}

const ROOM_PATH = `talkRooms/${ROOM_ID}`

// ── 型 ──────────────────────────────────────────────────────────────

export interface TalkMessage {
  id: string
  /** 送った端末のID（ログインしないので端末単位。localStorage に保存） */
  uid: string
  name: string
  text: string
  /** 送信時刻（ミリ秒）。並び順のキーでもある */
  at: number
  /** 画像を添えたときの画像ドキュメントID */
  img?: string
  /** 画像の縦横（読み込み前に場所を確保して、画面がガタつかないようにする） */
  w?: number
  h?: number
}

export interface TalkMember {
  id: string
  name: string
  /** 最後に画面を開いていた時刻（ミリ秒） */
  at: number
  /** ここまで読んだ、というメッセージの時刻（ミリ秒） */
  read: number
}

// ── 端末ID・表示名（localStorage） ───────────────────────────────────

const KEY_UID = 'talk.uid'
const KEY_NAME = 'talk.name'
const KEY_SOUND = 'talk.sound'

/** この端末のID。無ければ作って覚える。 */
export function getUid(): string {
  let uid = ''
  try {
    uid = localStorage.getItem(KEY_UID) ?? ''
  } catch { /* プライベートモード等で読めないことがある */ }
  if (!uid) {
    uid = randomId()
    try { localStorage.setItem(KEY_UID, uid) } catch { /* 保存できなくても動く（毎回別人になるだけ） */ }
  }
  return uid
}

export function getName(): string {
  try { return localStorage.getItem(KEY_NAME) ?? '' } catch { return '' }
}

export function setName(name: string): void {
  try { localStorage.setItem(KEY_NAME, name) } catch { /* 保存できなくても続行 */ }
}

export function getSoundOn(): boolean {
  try { return localStorage.getItem(KEY_SOUND) !== 'off' } catch { return true }
}

export function setSoundOn(on: boolean): void {
  try { localStorage.setItem(KEY_SOUND, on ? 'on' : 'off') } catch { /* 同上 */ }
}

/** 衝突しない程度のランダムID。 */
export function randomId(): string {
  const a = new Uint8Array(12)
  crypto.getRandomValues(a)
  return Array.from(a, b => b.toString(16).padStart(2, '0')).join('')
}

// ── Firestore REST（認証なし） ───────────────────────────────────────

/** JS の値 → Firestore REST の値表現。使うのは文字列・数値だけ。 */
function toFields(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue
    if (typeof v === 'number') {
      out[k] = Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
    } else if (typeof v === 'boolean') {
      out[k] = { booleanValue: v }
    } else {
      out[k] = { stringValue: String(v) }
    }
  }
  return out
}

async function restWrite(path: string, data: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${BASE}/${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFields(data) }),
  })
  if (!res.ok) throw new Error(`Firestore ${res.status}`)
}

async function restDelete(path: string): Promise<void> {
  const res = await fetch(`${BASE}/${path}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) throw new Error(`Firestore ${res.status}`)
}

// ── 書き込み ────────────────────────────────────────────────────────

/**
 * メッセージを送る。画像があれば先に画像ドキュメントを作ってから参照させる。
 * （逆順だと、画像がまだ無い状態のメッセージが相手に一瞬見える）
 */
export async function sendMessage(msg: Omit<TalkMessage, 'id'>, image?: { data: string }): Promise<string> {
  const id = `${msg.at}_${randomId().slice(0, 6)}`
  let imgId: string | undefined
  if (image) {
    imgId = randomId()
    await restWrite(`${ROOM_PATH}/images/${imgId}`, { d: image.data, at: msg.at })
  }
  await restWrite(`${ROOM_PATH}/messages/${id}`, {
    uid: msg.uid, name: msg.name, text: msg.text, at: msg.at,
    ...(imgId ? { img: imgId, w: msg.w ?? 0, h: msg.h ?? 0 } : {}),
  })
  return id
}

/** 自分が送ったものを取り消す（画像も一緒に消す）。 */
export async function deleteMessage(m: TalkMessage): Promise<void> {
  if (m.img) {
    await restDelete(`${ROOM_PATH}/images/${m.img}`).catch(() => { /* 画像だけ消し損ねても本体は消す */ })
  }
  await restDelete(`${ROOM_PATH}/messages/${m.id}`)
}

/** 自分の在席と既読の位置を書き込む。 */
export async function touchMember(uid: string, name: string, read: number): Promise<void> {
  await restWrite(`${ROOM_PATH}/members/${uid}`, { name, at: Date.now(), read })
}

// ── 読み取り（リアルタイム） ─────────────────────────────────────────

type Unsub = () => void

/** メッセージを時系列で購読する。直近 500 件だけ見る（1ヶ月の2人なら十分）。 */
export async function watchMessages(cb: (rows: TalkMessage[]) => void): Promise<Unsub> {
  const [{ collection, query, orderBy, limitToLast, onSnapshot }, { getDb }] = await Promise.all([
    import('firebase/firestore'),
    import('./firebase'),
  ])
  const db = await getDb()
  const q = query(collection(db, ROOM_PATH, 'messages'), orderBy('at'), limitToLast(500))
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<TalkMessage, 'id'>) })))
  }, () => { /* 通信が切れても画面は保つ（再接続はSDKに任せる） */ })
}

/** 相手の在席・既読を購読する。 */
export async function watchMembers(cb: (rows: TalkMember[]) => void): Promise<Unsub> {
  const [{ collection, onSnapshot }, { getDb }] = await Promise.all([
    import('firebase/firestore'),
    import('./firebase'),
  ])
  const db = await getDb()
  return onSnapshot(collection(db, ROOM_PATH, 'members'), snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<TalkMember, 'id'>) })))
  }, () => { /* 同上 */ })
}

/**
 * 画像を1枚だけ取りに行く（表示に入ったときに初めて読む）。
 * メッセージ一覧に画像本体を混ぜると、遡るたびに全部読み直して重くなるため分けている。
 */
export async function fetchImage(imgId: string): Promise<string | null> {
  const res = await fetch(`${BASE}/${ROOM_PATH}/images/${imgId}`)
  if (!res.ok) return null
  const json = await res.json() as { fields?: { d?: { stringValue?: string } } }
  return json.fields?.d?.stringValue ?? null
}

// ── 画像の縮小（送る前にブラウザ側でやる） ───────────────────────────

/** Firestore の1ドキュメント上限は約1MB。データURLはここまでに収める。 */
const MAX_DATA_URL = 700_000
const MAX_EDGE = 1280

/**
 * 画像ファイルを「長辺1280px以内・JPEG」に落とす。
 *
 * 🔴 iPhone の写真は HEIC のことがあり、そのまま送ると相手の Chrome で表示できない。
 *    Safari は HEIC を描画できるので、**送る側のブラウザで JPEG に変換**してしまうのが確実。
 *    ついでに軽くなるので、通信量と1MB制限の両方に効く。
 */
export async function shrinkImage(file: File): Promise<{ data: string; w: number; h: number }> {
  const bitmap = await loadImage(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('画像を処理できませんでした')
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h)

  // 上限に収まるまで画質を落とす（それでも大きい写真は稀にあるため）
  for (const q of [0.82, 0.7, 0.6, 0.5, 0.4]) {
    const data = canvas.toDataURL('image/jpeg', q)
    if (data.length <= MAX_DATA_URL) return { data, w, h }
  }
  throw new Error('画像が大きすぎます')
}

/** File → 描画できる画像。createImageBitmap が使えない環境では <img> に落とす。 */
async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file)
    } catch { /* HEIC 等でここが落ちることがあるので <img> にフォールバック */ }
  }
  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('この画像は読めませんでした'))
      img.src = url
    })
  } finally {
    // 画像は canvas に描き終わっているので、ここで解放してよい
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}

// ── 表示の小物 ──────────────────────────────────────────────────────

/** 「9:05」形式。 */
export function timeLabel(ms: number): string {
  const d = new Date(ms)
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 日付の区切り帯に出す文字（今日・昨日は言葉で出す）。 */
export function dayLabel(ms: number, now = Date.now()): string {
  const d = new Date(ms)
  const key = (t: Date) => `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}`
  const today = new Date(now)
  const yest = new Date(now - 86_400_000)
  if (key(d) === key(today)) return '今日'
  if (key(d) === key(yest)) return '昨日'
  const week = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
  return `${d.getMonth() + 1}月${d.getDate()}日(${week})`
}

/** 同じ日か（日付の区切りを入れる判定）。 */
export function isSameDay(a: number, b: number): boolean {
  const x = new Date(a), y = new Date(b)
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
}
