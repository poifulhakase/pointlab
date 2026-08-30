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

/**
 * 部屋のIDは**コードに書かない**。URL から読む。
 *
 * 🔴 ぽいロボは公開サイトなので、IDを定数で持つと**配信されるJSを読むだけで部屋に入れてしまう**
 *    （最初そう作ってしまい、本番のバンドルに出ているのを確認して直した）。
 *    Firestore のセキュリティルールはクライアントに配られないため、
 *    **正しいIDを知っているのは「URL」と「ルール」だけ**という状態にできる。
 *    ここが通すのは形（32桁の16進）だけで、合っているかどうかはルールが弾く。
 */
const HASH_RE = /^#\/t\/([0-9a-f]{32})$/

/** いま開いているURLがトークルームの形か（main.tsx の分岐で使う）。 */
export function isTalkRoute(): boolean {
  return typeof window !== 'undefined' && HASH_RE.test(window.location.hash)
}

/** URLから部屋IDを取り出す（形が違えば空文字）。 */
export function getRoomId(): string {
  if (typeof window === 'undefined') return ''
  return window.location.hash.match(HASH_RE)?.[1] ?? ''
}

function roomPath(): string {
  return `talkRooms/${getRoomId()}`
}

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
  /** 返信先のメッセージID（引用をタップして元へ飛ぶのに使う） */
  re?: string
  /**
   * 返信先の名前と本文の抜き書き。
   * 🔴 ID だけにしない。相手が取り消したり、500件より前に流れると**引用が空になる**ため、
   *    送った時点の内容を写して持たせる（引用は「その時こう言った」の記録でよい）。
   */
  reName?: string
  reText?: string
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

/**
 * 画像1枚で 700KB 前後を送るので、電波が細いと**返事が返らないまま止まる**ことがある。
 * 待ち続けると「送信中」のままになって送り直しもできないため、時間を切って失敗にする
 * （失敗にすれば吹き出しに「再送」が出る）。
 */
const WRITE_TIMEOUT_MS = 45_000

async function restWrite(path: string, data: Record<string, unknown>): Promise<void> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), WRITE_TIMEOUT_MS)
  try {
    const res = await fetch(`${BASE}/${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: toFields(data) }),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`Firestore ${res.status}`)
  } catch (e) {
    if (ctrl.signal.aborted) throw new Error('送信が時間内に終わりませんでした')
    throw e
  } finally {
    clearTimeout(timer)
  }
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
    await restWrite(`${roomPath()}/images/${imgId}`, { d: image.data, at: msg.at })
  }
  await restWrite(`${roomPath()}/messages/${id}`, {
    uid: msg.uid, name: msg.name, text: msg.text, at: msg.at,
    ...(imgId ? { img: imgId, w: msg.w ?? 0, h: msg.h ?? 0 } : {}),
    ...(msg.re ? { re: msg.re, reName: msg.reName ?? '', reText: msg.reText ?? '' } : {}),
  })
  return id
}

/** 自分が送ったものを取り消す（画像も一緒に消す）。 */
export async function deleteMessage(m: TalkMessage): Promise<void> {
  if (m.img) {
    await restDelete(`${roomPath()}/images/${m.img}`).catch(() => { /* 画像だけ消し損ねても本体は消す */ })
  }
  await restDelete(`${roomPath()}/messages/${m.id}`)
}

/**
 * 新着が出たことを相手のLINEへ知らせる（`api/talk.js`）。
 *
 * 🔵 Firestore にサーバー側のトリガーが無いので、**送った側のブラウザから叩く**。
 * 🔵 サーバー側が未設定のうちは何も起きない（204 が返る）。
 * 🔴 通知が落ちても本体は動かす。ここで例外を投げないこと。
 */
export async function notifyPeer(msg: { name: string; text: string; hasImage: boolean }): Promise<void> {
  try {
    await fetch('/api/talk?a=notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: getRoomId(), ...msg }),
    })
  } catch { /* 通知は落ちてよい */ }
}

/**
 * トークの中で AI に聞く（`api/talk.js` の `a=ai`）。Web検索つきで、店や周辺情報を調べて答える。
 *
 * 🔴 質問も答えも**そのままトークに流す**（2人とも読める）ので、ここでは文章を返すだけ。
 *    投稿は呼び出し側が `sendMessage` でやる。
 */
export async function askAi(q: string): Promise<string> {
  const res = await fetch('/api/talk?a=ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room: getRoomId(), q }),
  })
  const data = await res.json().catch(() => ({})) as { text?: string; error?: string }
  if (!res.ok || !data.text) throw new Error(data.error || 'AIに聞けませんでした')
  return data.text
}

/** AI の発言に使う識別子（吹き出しを相手側に出すため、自分のIDとは必ず別にする）。 */
export const AI_UID = 'ai-assistant'
export const AI_NAME = '🤖 AI'

/** 自分の在席と既読の位置を書き込む。 */
export async function touchMember(uid: string, name: string, read: number): Promise<void> {
  await restWrite(`${roomPath()}/members/${uid}`, { name, at: Date.now(), read })
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
  const q = query(collection(db, roomPath(), 'messages'), orderBy('at'), limitToLast(500))
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
  return onSnapshot(collection(db, roomPath(), 'members'), snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<TalkMember, 'id'>) })))
  }, () => { /* 同上 */ })
}

/**
 * 画像を1枚だけ取りに行く（表示に入ったときに初めて読む）。
 * メッセージ一覧に画像本体を混ぜると、遡るたびに全部読み直して重くなるため分けている。
 */
export async function fetchImage(imgId: string): Promise<string | null> {
  const res = await fetch(`${BASE}/${roomPath()}/images/${imgId}`)
  if (!res.ok) return null
  const json = await res.json() as { fields?: { d?: { stringValue?: string } } }
  return json.fields?.d?.stringValue ?? null
}

// ── 画像の縮小（送る前にブラウザ側でやる） ───────────────────────────

/** Firestore の1ドキュメント上限は約1MB。データURLはここまでに収める。 */
const MAX_DATA_URL = 700_000
/** 長辺の候補。上から試して、収まらなければ小さくする。 */
const EDGES = [1280, 960, 720]
const QUALITIES = [0.82, 0.7, 0.6, 0.5, 0.4]
/** <img> の読み込みが返ってこないときに諦める時間。 */
const DECODE_TIMEOUT_MS = 20_000

/** 長辺を `edge` に収めたときの寸法。 */
export function scaledSize(w: number, h: number, edge: number): { w: number; h: number } {
  const scale = Math.min(1, edge / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) }
}

/**
 * 画像ファイルを「長辺1280px以内・JPEG」に落とす。
 *
 * 🔴 iPhone の写真は HEIC のことがあり、そのまま送ると相手の Chrome で表示できない。
 *    Safari は HEIC を描画できるので、**送る側のブラウザで JPEG に変換**してしまうのが確実。
 *    ついでに軽くなるので、通信量と1MB制限の両方に効く。
 *
 * 🔴 2026-08-30：**iPhone(Safari) で写真が送れない**という report を受けて、
 *    落ちどころを1つに絞らず「順に試して、どれかが通れば送れる」形に変えた。
 *    ① createImageBitmap → ② `<img>`（HEIC や巨大写真の保険）→ ③ 変換せずそのまま
 *    🔵 iOS は 48MP(Pro の写真)のような大きい画像で **canvas が真っ白になる**ことがあり、
 *       例外は出ない＝「送れたのに白い」になる。描いたあと中身が空かどうかを見て次の手に回す。
 */
export async function shrinkImage(file: File): Promise<{ data: string; w: number; h: number }> {
  let reason: unknown = null

  for (const via of ['bitmap', 'img'] as const) {
    let src: ImageBitmap | HTMLImageElement | null = null
    try {
      src = via === 'bitmap' ? await loadBitmap(file) : await loadImgElement(file)
      if (!src) continue
      const out = renderToJpeg(src)
      if (out) return out
    } catch (e) {
      reason ??= e
    } finally {
      if (src && 'close' in src) src.close()
    }
  }

  // ③ 変換できなくても、元が小さくて相手も開ける形式ならそのまま送る
  const raw = await readAsDataUrl(file).catch(() => null)
  if (raw && raw.length <= MAX_DATA_URL && /^data:image\/(jpeg|png|gif|webp);/i.test(raw)) {
    return { data: raw, w: 0, h: 0 }
  }

  if (raw && raw.length > MAX_DATA_URL) throw new Error('この写真は大きすぎて送れませんでした')
  throw new Error(reason instanceof Error ? reason.message : 'この写真は読めませんでした')
}

/** canvas に描いて JPEG のデータURLにする。描けなかった（真っ白）ときは null。 */
function renderToJpeg(src: ImageBitmap | HTMLImageElement): { data: string; w: number; h: number } | null {
  const sw = 'naturalWidth' in src ? src.naturalWidth : src.width
  const sh = 'naturalHeight' in src ? src.naturalHeight : src.height
  if (!sw || !sh) return null

  for (const edge of EDGES) {
    const { w, h } = scaledSize(sw, sh, edge)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('この端末では画像を処理できませんでした')
    // 透明の写真（PNG）を JPEG にすると黒くなるので、下地を白で塗っておく
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(src, 0, 0, w, h)
    if (isBlank(ctx, w, h)) return null

    for (const q of QUALITIES) {
      const data = canvas.toDataURL('image/jpeg', q)
      // 大きすぎて canvas を書き出せないと 'data:,' が返る端末がある
      if (!data.startsWith('data:image/jpeg')) return null
      if (data.length <= MAX_DATA_URL) return { data, w, h }
    }
  }
  return null
}

/**
 * canvas の中身が空か（＝描けていないか）。
 * 下地を白で塗ってあるので、**白のままなら描けていない**とみなせる。
 */
function isBlank(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  let px: Uint8ClampedArray
  try {
    px = ctx.getImageData(0, 0, w, h).data
  } catch {
    return false // 読めないなら判定しない（描けている前提で進む）
  }
  // 全画素は重いので、格子状に間引いて見る
  const step = Math.max(1, Math.floor(Math.min(w, h) / 32)) * 4
  for (let i = 0; i < px.length; i += step) {
    if (px[i] !== 255 || px[i + 1] !== 255 || px[i + 2] !== 255) return false
  }
  return true
}

/** File → ImageBitmap（向きは EXIF に合わせる）。使えない環境では null。 */
async function loadBitmap(file: File): Promise<ImageBitmap | null> {
  if (!('createImageBitmap' in window)) return null
  try {
    // 🔵 imageOrientation を指定しないと、横向きで撮った写真が回ったまま送られる
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return null // HEIC 等で落ちることがある（<img> 側で拾う）
  }
}

/** File → <img>。Safari はここで HEIC も読める。 */
async function loadImgElement(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      const timer = setTimeout(() => reject(new Error('この写真は読み込みに時間がかかりすぎました')), DECODE_TIMEOUT_MS)
      img.onload = () => { clearTimeout(timer); resolve(img) }
      img.onerror = () => { clearTimeout(timer); reject(new Error('この写真は読めませんでした')) }
      img.src = url
    })
  } finally {
    // 画像は canvas に描き終わっているので、ここで解放してよい
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}

/** File → データURL（変換せず、そのまま）。 */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result ?? ''))
    r.onerror = () => reject(new Error('この写真は読めませんでした'))
    r.readAsDataURL(file)
  })
}

// ── 相手の状態 ──────────────────────────────────────────────────────

/**
 * 相手（自分以外）の在席と既読の位置。
 *
 * 🔴 2026-08-30：**既読が付かない**の原因。ログインしないので `uid` は端末（localStorage）単位で、
 *    ブラウザを変えたり履歴を消したりすると**同じ人の記録が増える**（実際 2人の部屋に4件あった）。
 *    「自分以外の最初の1件」を採っていたため、**古い方を掴んで既読が止まっていた**。
 *    → 自分以外のうち **一番進んでいる既読**・**一番新しい在席** を採る。
 *
 * 🔵 自分の別端末は表示名で除く（2人の部屋なので、同じ名前＝自分の別端末とみなす）。
 *    ここを外すと、自分でPCとスマホから開いただけで「既読」が付いてしまう。
 */
export function peerState(members: TalkMember[], uid: string, myName: string):
  { name: string; at: number; read: number } | null {
  const others = members.filter(m => m.id !== uid && m.name !== myName)
  if (others.length === 0) return null
  const latest = others.reduce((a, b) => ((b.at ?? 0) > (a.at ?? 0) ? b : a))
  return {
    name: latest.name,
    at: others.reduce((max, m) => Math.max(max, m.at ?? 0), 0),
    read: others.reduce((max, m) => Math.max(max, m.read ?? 0), 0),
  }
}

// ── 表示の小物 ──────────────────────────────────────────────────────

/**
 * 引用に出す本文の抜き書き（改行は詰めて1行にする）。
 * 画像だけの発言には出す文字が無いので「写真」と書く。
 */
export function quoteText(m: Pick<TalkMessage, 'text' | 'img'>, max = 60): string {
  const t = (m.text ?? '').replace(/\s+/g, ' ').trim()
  if (t) return t.length > max ? `${t.slice(0, max)}…` : t
  return m.img ? '写真' : ''
}

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
