// POST /api/line-webhook
// LINE の webhook。**送り先ID（グループなら C…）を調べるためだけ**に置いている。
//
// 🔴 ここは通知を送らない。やることは「Bot が入っている場所のIDを、その場に返事する」だけ。
//    返事には LINE が発行した replyToken が要る＝**偽の呼び出しでは何も起きない**
//    （返事先を外から指定できないので、荒らしても無害）。
//
// 使い方（詳しくは docs/talk-notify-setup.md）:
//   1. LINE Developers のチャネルに Webhook URL として
//      https://pointlab.vercel.app/api/line-webhook を登録して有効にする
//   2. Bot をグループに招待する（または1:1で「id」と送る）
//   3. Bot が「この場所のID: C...」と返すので、その値を Vercel の LINE_TARGET_ID に入れる
//   4. 調べ終わったら Webhook は切ってよい（通知の送信には要らない）

const LINE_REPLY = 'https://api.line.me/v2/bot/message/reply'

export default async function handler(req, res) {
  // LINE は登録時に疎通確認をするので、POST 以外でも 200 を返しておく
  if (req.method !== 'POST') return res.status(200).end()

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) return res.status(200).end()

  const body = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {})
  const events = Array.isArray(body.events) ? body.events : []

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
      console.error('[line-webhook] reply error:', e?.message)
    }
  }

  // LINE には常に 200 を返す（失敗を返すと再送が続く）
  return res.status(200).end()
}

function safeParse(s) {
  try { return JSON.parse(s) } catch { return {} }
}
