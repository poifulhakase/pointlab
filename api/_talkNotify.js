// 一時トークルームの新着通知（LINE）と、トークの中のAIで使う、通信しない部分だけ。
// `_` プレフィックスのため Vercel のルートとしては公開されない（共有モジュール）。
//
// 🔴 ぽいロボ本体とは無関係の間借り機能。片付けるときは talk.js / このファイル /
//    talkRoom.ts の notifyPeer・askAi を一緒に消す。

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
 * 🔴 場所の縛りは実際の事故から足した（「横浜のみなとみらい」に対して
 *    茨城の「みらい平」の店を返してきた・2026-08-30）。
 */
export const AI_SYSTEM = [
  'あなたは2人のトーク画面の中にいる案内役です。デートや外出の相談に答えます。',
  '',
  '答え方（必ず守る）:',
  '- 日本語。結論から。前置き・あいさつ・言い訳は書かない。',
  '- lines に候補を最大3件。1件＝1つの文字列にまとめ、途中で改行しない。',
  '- 1件の形＝「店名／エリア・最寄り｜ひとことの特徴（値段や雰囲気）」',
  '- note は最後に添える一行（要確認や予約の目安）。要らなければ空文字。',
  '- 1件はスマホの2〜3行に収まる長さ。表や見出しは使わない。',
  '',
  '場所の扱い（間違えやすいので必ず守る）:',
  '- 地名は書かれたとおりに扱う。似た名前の別の場所に置き換えない',
  '  （例:「横浜のみなとみらい」を「みらい平」にしない）。',
  '- 調べるときは都道府県や市を補う（例:「神奈川県 横浜市 みなとみらい」）。',
  '- 挙げる店が指定のエリアにあることを確かめる。違う土地の店は出さない。',
  '',
  '中身:',
  '- エリアが分かるなら聞き返さない。分からないときだけ1行で聞き返す。',
  '- 営業時間・定休日・料金は変わりやすいので、断定せず「要確認」と添える。',
  '- 分からないことは分からないと書く。作らない。',
].join('\n')

/**
 * AIの答えの形。
 *
 * 🔴 文章のままだと**1行に収まらない**（文の途中で改行が入り、候補1件が3行に割れた）。
 *    行を配列で受け取り、**繋ぐのはこちら**にする＝「1件1行」を機械的に守れる。
 */
export const AI_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['lines'],
  properties: {
    lines: {
      type: 'array',
      maxItems: 3,
      items: { type: 'string' },
      description: '候補を1件1行で最大3つ。分からず聞き返すときは1行だけ入れる。改行は入れない。',
    },
    note: {
      type: 'string',
      description: '最後に添える一行（要確認・予約の目安など）。無ければ空文字。',
    },
  },
}

/**
 * 上の形 → 吹き出しに出す文章。
 * 各行の中の改行は潰す（1件1行を保つため）。
 */
export function joinAiAnswer(out) {
  const lines = Array.isArray(out?.lines) ? out.lines : []
  const rows = lines
    .map(l => String(l ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const note = String(out?.note ?? '').replace(/\s+/g, ' ').trim()
  return cleanAiText([...rows, note].filter(Boolean).join('\n'))
}

/**
 * AIの答えを表示できる形に整える。
 *
 * 🔴 モデルが改行のつもりで「バックスラッシュ＋n」という**文字そのもの**を書いてくることがあり、
 *    そのまま出すと吹き出しに並んで読めない（2026-08-30 に実際に出た）。
 *    プロンプトでも止めているが、**表示側で必ず直す**（プロンプトだけに頼らない）。
 */
export function cleanAiText(text) {
  return String(text ?? '')
    .replace(/\\r\\n|\\n|\\r/g, '\n')  // 文字としての改行表記 → 本物の改行
    .replace(/\n{3,}/g, '\n\n')        // 空行が続きすぎるのを詰める
    .replace(/[ \t]+\n/g, '\n')
    .trim()
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
