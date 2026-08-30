// 一時トークルームの新着通知（LINE）で使う、通信しない部分だけ。
// `_` プレフィックスのため Vercel のルートとしては公開されない（共有モジュール）。
//
// 🔴 ぽいロボ本体とは無関係の間借り機能。片付けるときは talk-notify.js /
//    line-webhook.js / このファイル / talkRoom.ts の notifyPeer を一緒に消す。

/** 通知に載せる本文の最大文字数（LINEの通知は長いと切られるので、こちらで切る）。 */
export const MAX_BODY = 60

/**
 * 通知の文面を作る。
 *
 * @param {object} p
 * @param {string} p.name     送った人の表示名
 * @param {string} p.text     本文（空なら写真だけ）
 * @param {boolean} p.hasImage 写真が付いているか
 * @param {boolean} p.showBody 本文を載せるか（載せないと「新着1件」だけになる）
 * @returns {string}
 */
export function buildNotifyText({ name, text, hasImage, showBody }) {
  const who = (name || '').trim() || 'だれか'
  if (!showBody) return `${who} から新着があります`

  const body = (text || '').replace(/\s+/g, ' ').trim()
  if (body) {
    const cut = body.length > MAX_BODY ? `${body.slice(0, MAX_BODY)}…` : body
    return `${who}：${cut}`
  }
  return hasImage ? `${who} から写真が届きました` : `${who} から新着があります`
}

/**
 * 部屋IDの形（32桁の16進）。
 * 🔴 クライアントから来た値をそのまま使わない。形を見てから、設定の値と突き合わせる。
 */
export function isRoomId(v) {
  return typeof v === 'string' && /^[0-9a-f]{32}$/.test(v)
}

/**
 * LINE の宛先ID。ユーザー(U…)・グループ(C…)・複数人トーク(R…) のいずれか。
 * 通知先はサーバーの設定でしか決まらないが、設定ミスに早く気づくために形だけ見る。
 */
export function isLineTarget(v) {
  return typeof v === 'string' && /^[URC][0-9a-f]{32}$/.test(v)
}
