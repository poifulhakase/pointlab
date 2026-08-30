// POST /api/talk?a=notify   … 新着が出たことを LINE へ知らせる（相手のロック画面に出す）
// POST /api/talk?a=ai       … トークの中で AI に聞く（Web検索つき・お店や周辺情報の提案）
// POST /api/talk?a=webhook  … LINE の webhook。送り先ID（グループなら C…）を調べるためだけ
//
// 🔴 ぽいロボ本体とは無関係の間借り機能。使い終わったら消す（docs/talk-notify-setup.md）。
//
// 🔴 **1本の関数に束ねてある理由＝Vercel の Hobby は「1デプロイに関数12個まで」**。
//    分けると枠が足りずデプロイが丸ごと失敗する（2026-08-30 に実際に踏んだ）。
//    トーク関係の口を増やすときも、ファイルを増やさず `a=` を足すこと。
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
//   LINE_TARGET_ID            … 送り先。グループなら C…（a=webhook が教えてくれる）
//   TALK_ROOM_ID              … 通知を許す部屋ID（32桁の16進）
//   TALK_NOTIFY_BODY          … 'off' なら本文を載せず「新着があります」だけにする
//   TALK_NOTIFY_MIN_SEC       … 最短間隔の秒数（既定 90）
//   TALK_NOTIFY_MAX_PER_DAY   … 1日の上限（既定 60）
//   ANTHROPIC_API_KEY         … AI（?a=ai）用。ぽいロボの疑似トレードと同じ残高を使う
//   ANTHROPIC_WORKSPACE_ID    … 🔴 アカウント紐付け型の鍵では必須（`wrkspc_...`）

import Anthropic from '@anthropic-ai/sdk'
import admin from 'firebase-admin'
import rateLimit from './_ratelimit.js'
import { AI_SYSTEM, buildNotifyText, cleanAiText, isRoomId, splitMemory, withMemory } from './_talkNotify.js'

const LINE_PUSH = 'https://api.line.me/v2/bot/message/push'
const LINE_REPLY = 'https://api.line.me/v2/bot/message/reply'

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
  const action = String(req.query.a || 'notify')
  if (action === 'webhook') return webhook(req, res)
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  if (action === 'ai') return ai(req, res)
  return notify(req, res)
}

// ── 新着を LINE へ ───────────────────────────────────────────────

async function notify(req, res) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const target = process.env.LINE_TARGET_ID
  const room = process.env.TALK_ROOM_ID
  // 未設定＝この機能はまだ使っていない。黙って何もしない（画面側はこれで正常）
  if (!token || !target || !room) return res.status(204).end()

  const body = readBody(req)
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
    if (!(await rateLimit(db, key, 'notify_min', 1, minSec * 1000))) return res.status(204).end()
    if (!(await rateLimit(db, key, 'notify_day', maxPerDay, 24 * 60 * 60 * 1000))) return res.status(204).end()
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
      console.error('[talk] LINE push failed:', r.status)
      return res.status(502).json({ error: 'Notify failed' })
    }
  } catch (e) {
    console.error('[talk] LINE push error:', e?.message)
    return res.status(502).json({ error: 'Notify failed' })
  }

  return res.status(204).end()
}

// ── トークの中で AI に聞く ───────────────────────────────────────

/** 判断ではなく提案なので、深く考えさせない（速さと安さを取る）。 */
const AI_MODEL = 'claude-opus-5'
const AI_EFFORT = 'low'
/**
 * 1回の質問で許す検索の回数。増やすほど詳しくなるが、時間もお金もかかる。
 * 🔵 4→6 は営業時間・定休日まで調べさせるため（運用者の要望・2026-08-30）。
 */
const AI_MAX_SEARCHES = 6

/**
 * 🔴 使うのはぽいロボと同じ `ANTHROPIC_API_KEY`（残高も共用）。
 *    未設定なら 503 を返して画面に理由を出す（黙って壊れないように）。
 * 🔴 1回あたり十数円かかりうる（Web検索つき）。**部屋IDの照合＋回数制限**の両方を掛ける。
 */
async function ai(req, res) {
  const room = process.env.TALK_ROOM_ID
  const key = process.env.ANTHROPIC_API_KEY
  const body = readBody(req)

  if (!isRoomId(body.room) || (room && body.room !== room)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  if (!key) return res.status(503).json({ error: 'AIはまだ使えません（設定が要ります）' })

  const q = String(body.q || '').trim().slice(0, 500)
  if (!q) return res.status(400).json({ error: '質問が空です' })

  /**
   * 覚えていることの置き場。
   * 🔵 サーバー（Admin SDK）から読み書きするのでルールは通らない＝
   *    画面側から書き換えられない。編集画面は作らない（運用者の指示）。
   */
  let memRef = null
  let memory = ''
  try {
    const db = getDb()
    const rk = `talk_${String(body.room).slice(0, 8)}`
    if (!(await rateLimit(db, rk, 'ai_min', 3, 60 * 1000))) {
      return res.status(429).json({ error: '少し待ってからもう一度どうぞ' })
    }
    if (!(await rateLimit(db, rk, 'ai_day', 40, 24 * 60 * 60 * 1000))) {
      return res.status(429).json({ error: '今日はここまで（1日40回）' })
    }
    memRef = db.doc(`talkRooms/${body.room}`)
    memory = (await memRef.get()).data()?.aiMemory ?? ''
  } catch {
    // 回数も記憶も扱えない環境でも、質問そのものは通す
  }

  try {
    // 🔴 いま Console で作る鍵は「アカウント紐付け型」で、**ワークスペースIDのヘッダーが必須**。
    //    無いと 400 `anthropic-workspace-id is required...` で全部落ちる（2026-08-30 に踏んだ）。
    //    疑似トレードの古い鍵（レガシーのワークスペース鍵）は不要なので、あれば付ける形にする。
    const workspace = process.env.ANTHROPIC_WORKSPACE_ID
    const anthropic = new Anthropic({
      apiKey: key,
      ...(workspace ? { defaultHeaders: { 'anthropic-workspace-id': workspace } } : {}),
    })
    const r = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 2000,
      // 🔴 出力の形は縛らない。書き方は AI_SYSTEM（プロンプト）側で決める
      //    ＝運用者の方針「内容はプログラムで制御しすぎず、プロンプト制御にする」
      output_config: { effort: AI_EFFORT },
      system: withMemory(AI_SYSTEM, memory),
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: AI_MAX_SEARCHES }],
      messages: [{ role: 'user', content: q }],
    })

    // 🔴 content を読む前に stop_reason を見る（Opus 5 は安全分類器で断ることがある）
    if (r.stop_reason === 'refusal') {
      return res.status(200).json({ text: 'この質問には答えられませんでした。聞き方を変えてみてください。' })
    }
    // 中身はそのまま使う。表示が壊れる分（文字としての改行表記）だけ直す
    const whole = cleanAiText((r.content ?? []).filter(b => b.type === 'text').map(b => b.text).join('\n'))
    // 裏の記録（MEMORY: の行）を切り離す。画面には出さず、静かに覚え直す
    const { text, memory: updated } = splitMemory(whole)
    if (updated && memRef) {
      // 🔵 覚え直しに失敗しても答えは返す（記憶は落ちてよい）
      await memRef.set({ aiMemory: updated.slice(0, 1200), aiMemoryAt: Date.now() }, { merge: true })
        .catch(e => console.error('[talk/ai] memory save failed:', e?.message))
    }
    if (!text) return res.status(502).json({ error: 'AIの返事が空でした' })
    return res.status(200).json({ text })
  } catch (e) {
    console.error('[talk/ai] error:', e?.status, e?.message)
    // 🔵 種類（HTTPの番号）だけは返す。中身は返さない代わりに、これで切り分けができる
    //    （400=リクエストの形／401=鍵／429=上限／5xx=向こう側）
    return res.status(502).json({ error: 'AIに聞けませんでした', code: e?.status ?? 0 })
  }
}

// ── 送り先IDを調べるための webhook ───────────────────────────────

/**
 * 🔴 ここは通知を送らない。やることは「Bot が入っている場所のIDを、その場に返事する」だけ。
 *    返事には LINE が発行した replyToken が要る＝**偽の呼び出しでは何も起きない**
 *    （返事先を外から指定できないので、荒らしても無害）。
 */
async function webhook(req, res) {
  // LINE は登録時に疎通確認をするので、POST 以外でも 200 を返しておく
  if (req.method !== 'POST') return res.status(200).end()

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) return res.status(200).end()

  const events = Array.isArray(readBody(req).events) ? readBody(req).events : []
  for (const ev of events) {
    // グループに入った直後、または「id」と話しかけられたときだけ答える
    const asked = ev.type === 'join'
      || (ev.type === 'message' && ev.message?.type === 'text' && /^\s*id\s*$/i.test(ev.message.text || ''))
    if (!asked || !ev.replyToken) continue

    const src = ev.source || {}
    const id = src.groupId || src.roomId || src.userId || '(不明)'
    const kind = src.groupId ? 'グループ' : src.roomId ? '複数人トーク' : '1対1'

    try {
      await fetch(LINE_REPLY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          replyToken: ev.replyToken,
          messages: [{ type: 'text', text: `この場所のID（${kind}）\n${id}\n\nこれを LINE_TARGET_ID に設定してください。` }],
        }),
      })
    } catch (e) {
      console.error('[talk/webhook] reply error:', e?.message)
    }
  }

  // LINE には常に 200 を返す（失敗を返すと再送が続く）
  return res.status(200).end()
}

function readBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body) } catch { return {} }
  }
  return req.body || {}
}
