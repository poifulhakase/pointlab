// POST /api/talk-notify
// 一時トークルームに新着が出たことを LINE へ知らせる（相手のロック画面に出す）。
//
// 🔴 ぽいロボ本体とは無関係の間借り機能。使い終わったら消す（docs/talk-notify-setup.md）。
//
// 設計の要点：
//   - Firestore にサーバー側のトリガーが無い（Cloud Functions は有料プラン）ため、
//     **送った側のブラウザから叩く**。届かなくても本体は動く（通知は落ちてよい）。
//   - 宛先は **サーバーの環境変数に固定**。外から宛先は指定できない＝
//     エンドポイントを知られても「決まった宛先に通知が飛ぶ」以上のことは起きない。
//   - それでも鳴らし放題は困るので、Firestore 越しに**最短間隔と1日の上限**を掛ける。
//   - 環境変数が無い間は**何もせず 204**（設定前でも画面が壊れないように）。
//
// 必要な環境変数（Vercel）:
//   LINE_CHANNEL_ACCESS_TOKEN … Messaging API のチャネルアクセストークン（長期）
//   LINE_TARGET_ID            … 送り先。グループなら C…（line-webhook が教えてくれる）
//   TALK_ROOM_ID              … 通知を許す部屋ID（32桁の16進）
//   TALK_NOTIFY_BODY          … 'off' なら本文を載せず「新着があります」だけにする
//   TALK_NOTIFY_MIN_SEC       … 最短間隔の秒数（既定 90）
//   TALK_NOTIFY_MAX_PER_DAY   … 1日の上限（既定 60）

import admin from 'firebase-admin'
import rateLimit from './_ratelimit.js'
import { buildNotifyText, isRoomId } from './_talkNotify.js'

const LINE_PUSH = 'https://api.line.me/v2/bot/message/push'

// Firebase Admin は遅延初期化（env 不備でモジュール読み込み時にクラッシュさせない）。
let _db = null
function getDb() {
  if (!_db) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set')
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) })
    }
    _db = admin.firestore()
  }
  return _db
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const target = process.env.LINE_TARGET_ID
  const room = process.env.TALK_ROOM_ID
  // 未設定＝この機能はまだ使っていない。黙って何もしない（画面側はこれで正常）
  if (!token || !target || !room) return res.status(204).end()

  const body = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {})
  if (!isRoomId(body.room) || body.room !== room) {
    // 部屋が違う＝この口を叩いてよい相手ではない。中身は教えない
    return res.status(403).json({ error: 'Forbidden' })
  }

  // 連投を1通にまとめる＋鳴らし過ぎを防ぐ。判定できないときは通す（通知は落ちてよいが、
  // 落とし方で本来の1通目まで消したくない）
  const minSec = Number(process.env.TALK_NOTIFY_MIN_SEC || 90)
  const maxPerDay = Number(process.env.TALK_NOTIFY_MAX_PER_DAY || 60)
  try {
    const db = getDb()
    const key = `talk_${room.slice(0, 8)}`
    const soon = !(await rateLimit(db, key, 'notify_min', 1, minSec * 1000))
    if (soon) return res.status(204).end() // さっき送ったばかり＝今回は黙る
    const over = !(await rateLimit(db, key, 'notify_day', maxPerDay, 24 * 60 * 60 * 1000))
    if (over) return res.status(204).end()
  } catch {
    // Firestore が使えない環境でも通知そのものは動かす
  }

  const text = buildNotifyText({
    name: String(body.name || '').slice(0, 20),
    text: String(body.text || ''),
    hasImage: Boolean(body.hasImage),
    showBody: process.env.TALK_NOTIFY_BODY !== 'off',
  })

  try {
    const r = await fetch(LINE_PUSH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to: target, messages: [{ type: 'text', text }] }),
    })
    if (!r.ok) {
      // 🔵 LINE の返事はそのまま返さない（トークンや宛先の手がかりを外に出さない）
      console.error('[talk-notify] LINE push failed:', r.status)
      return res.status(502).json({ error: 'Notify failed' })
    }
  } catch (e) {
    console.error('[talk-notify] LINE push error:', e?.message)
    return res.status(502).json({ error: 'Notify failed' })
  }

  return res.status(204).end()
}

function safeParse(s) {
  try { return JSON.parse(s) } catch { return {} }
}
