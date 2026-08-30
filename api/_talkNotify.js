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
 * トークの中の AI に渡す指示。
 *
 * 🔴 **だらだら書かせない**（運用者の指示）。トークの吹き出しに入る長さで、結論から。
 *    説明を足したくなっても、ここを緩めないこと。
 * 🔵 やり取りは2人のトークにそのまま流れる＝**相手も読む**前提の書き方にする。
 */
export const AI_SYSTEM = [
  'あなたは2人のトーク画面の中にいる案内役です。デートや外出の相談に答えます。',
  '',
  '答え方（必ず守る）:',
  '- 日本語。結論から。前置き・あいさつ・言い訳は書かない。',
  '- 全体で5行以内。候補を出すときは最大3件、1件1行。',
  '- 1行の形＝「店名／エリア・最寄り｜ひとことの特徴（値段や雰囲気）」',
  '- 最後に一行だけ、次の一手を書いてよい（例:「予約は早めが安全」）。',
  '- 表や見出し、長い箇条書きは使わない。',
  '',
  '中身:',
  '- 場所・日付が要るのに書かれていなければ、**1行で聞き返すだけ**にする。',
  '- 営業時間・定休日・料金は変わりやすいので、断定せず「要確認」と添える。',
  '- 分からないことは分からないと書く。作らない。',
].join('\n')

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
