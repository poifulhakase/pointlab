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
 * 連投を通知しないか（2026-09-06・運用者の指示）。
 *
 * 指示＝**同じ人が続けて投稿したときは、LINEへの通知は初回のみ**。**日を跨いだらリセット**。
 *
 * 🔴 「初回かどうか」を決めるのは**送る側の画面**（`isFirstOfStreak`）。
 *    通知APIは相手が画面を開いていないときだけ呼ばれるので、サーバー側だけで数えると
 *    「通知を経由しなかった相手の発言」が見えず、連投ではないものを連投と誤判定する。
 * 🔵 **古い画面（`first` を送ってこない版）は通す**＝フェイルオープン。
 *    通知は落ちてよいが、落とし方で本来の1通目まで消したくない。
 *
 * @param {unknown} first 画面から届いた「ひと続きの1通目か」
 * @returns {boolean} true＝送らない
 */
export function isStreakSuppressed(first) {
  return first === false
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
  '- 店を挙げるときは、1件をこの並びで書く（記号もこのまま。空行も入れる）:',
  '',
  '    店名／エリア・最寄り｜ひとことの特徴（値段や雰囲気）',
  '',
  '    使い方のひとこと（混み具合・向いている時間帯など。1行）',
  '',
  '    ▼ Google MAP',
  '    https://www.google.com/maps/search/?api=1&query=店名+エリア',
  '',
  '    営業10:30-22:00',
  '    不定休',
  '',
  '- 候補が複数のときは、この塊を空行で区切って並べる（最大3件）。',
  '- 営業時間・定休日が分からなければ、その2行は書かない（作らない）。',
  '- 🔴 1つの行は**1行で書き切る**。文の途中・「｜」の直後・記号の前後で改行しない。',
  '- 店名の行はスマホの2〜3行に収まる長さ。表や見出し、長い箇条書きは使わない。',
  '- 店を挙げないとき（聞き返しなど）は、この形は使わず1〜2行で答える。',
  '- 改行するときは本物の改行を書く。バックスラッシュ n のような文字を本文に書かない。',
  '',
  '場所の扱い（間違えやすいので必ず守る）:',
  '- 地名は書かれたとおりに扱う。似た名前の別の場所に置き換えない',
  '  （例:「横浜のみなとみらい」を「みらい平」にしない）。',
  '- 調べるときは都道府県や市を補う（例:「神奈川県 横浜市 みなとみらい」）。',
  '- 挙げる店が指定のエリアにあることを確かめる。違う土地の店は出さない。',
  '- 🔴 店の名前を聞かれたら**その店そのもの**を答える。入っている商業施設やビルの',
  '  説明にすり替えない（例:「梟書茶房 Esola池袋店」→ 施設の Esola池袋 ではなく喫茶店の方）。',
  '',
  '中身:',
  '- エリアが分かるなら聞き返さない。分からないときだけ1行で聞き返す。',
  '- 営業時間と定休日は調べて、分かった範囲で書く。**分からなければ書かない（作らない）**。',
  '- 🔴 「要確認」「変わる場合があります」のような**断り書きは書かない**',
  '  （参考として読むことは分かっている・運用者の指示）。',
  '- 分からないことは分からないと書く。作らない。',
  '',
  '覚えること:',
  '- 「覚えて」と言われたこと、次も役に立つ事実（呼び名・好み・苦手なもの・',
  '  アレルギー・住んでいる場所・記念日・行った店の感想など）は覚えておく。',
  '- 覚えていることは、次からの答えに自然に活かす。',
  '- 覚え直したときだけ、答えの**いちばん最後の行**に `MEMORY:` から始まる行を1つ足す。',
  '  その行には**更新後の記憶の全文**を、短い箇条書き（最大10項目・全体400字以内）で',
  '  「・」区切りの1行にまとめて書く。古い内容は整理して書き直してよい。',
  '- 🔴 この行は画面に出ない裏の記録。**覚えたことを本文で報告しない**',
  '  （「覚えました」などとは書かない）。変わっていなければ MEMORY 行は書かない。',
].join('\n')

/**
 * 覚えていることを、その回の指示にくっつける。
 * 🔵 中身の作り方はモデルに任せる。ここは**渡すだけ**。
 */
export function withMemory(system, memory) {
  const m = String(memory ?? '').trim()
  return m ? `${system}\n\n【いま覚えていること】\n${m}` : system
}

/**
 * 答えから、裏の記録（`MEMORY:` の行）を切り離す。
 *
 * 🔴 ここは**切り分けだけ**。何を覚えるかはモデルが決める（プロンプト側の仕事）。
 *    切り離しに失敗すると画面に裏の記録が出てしまうので、必ず通す。
 */
export function splitMemory(text) {
  const src = String(text ?? '')
  const lines = src.split('\n')
  const i = lines.findIndex(l => /^\s*MEMORY\s*[:：]/.test(l))
  if (i < 0) return { text: src.trim(), memory: '' }
  const memory = lines.slice(i).join(' ').replace(/^\s*MEMORY\s*[:：]\s*/, '').trim()
  return { text: lines.slice(0, i).join('\n').trim(), memory }
}

/**
 * AIの答えを表示できる形に整える。
 *
 * 🔴 **中身の作りはプロンプトに任せる**（運用者の方針「プログラムで制御しすぎない」）。
 *    ここでやるのは**表示が壊れる分だけ**を直す安全弁。件数や書き方は触らない。
 * 🔵 直すのは1つ＝モデルが改行のつもりで「バックスラッシュ＋n」という**文字そのもの**を
 *    書いてくることがあり、そのまま出すと吹き出しに並んで読めない（2026-08-30 に実際に出た）。
 */
export function cleanAiText(text) {
  return String(text ?? '')
    .replace(/\\r\\n|\\n|\\r/g, '\n')  // 文字としての改行表記 → 本物の改行
    // 🔵 句点や閉じ括弧の直前、区切りの「｜」の前後で改行してくることがある
    //    （「…です \n 。」「店名｜ \n 特徴」）。文が割れて読みにくいので、その改行だけ詰める。
    //    文そのものには触らない
    .replace(/\n+(?=[。、．，）」』】｜|])/g, '')
    .replace(/([｜|])[ \t]*\n+/g, '$1')
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

/**
 * 送った人によって宛先を振り分ける（2026-08-31 運用者の指示）。
 *
 * 🔴 **通知は「読ませたい相手のいる場所」へ送る**。
 *    - 自分が送った → **相手のいるグループ**（相手のロック画面に出したい）
 *    - 相手が送った → **自分とBotだけのグループ**（自分が気づきたい。相手に自分の発言の通知を見せない）
 *
 * 🔵 見分けは**表示名**。名前は端末ごとに自分で決める値なので、
 *    `selfNames` に複数（旧名・別端末の書き方）をカンマ区切りで持たせられるようにしてある。
 * 🔴 **知らない名前は「相手が送った」側に倒す**＝最悪でも自分に通知が来るだけで済む。
 *    逆に倒すと、名前を変えた瞬間から相手へ通知が飛び続ける。
 *
 * @param {object} p
 * @param {string} p.name        送った人の表示名
 * @param {string} p.selfNames   自分の表示名（カンマ区切り可・空なら振り分けなし）
 * @param {string} p.peerTarget  相手のいるグループのID
 * @param {string} p.selfTarget  自分とBotだけのグループのID
 * @returns {string} 送り先ID（空文字＝送らない）
 */
export function pickNotifyTarget({ name, selfNames, peerTarget, selfTarget }) {
  return pickNotifyRoute({ name, selfNames, peerTarget, selfTarget }).to
}

/**
 * 送り先と**送り方**を決める（2026-09-17）。
 *
 * 🔴 LINE の無料枠（月200通）を使い切った（2026-09-17）。自分あての通知を LINE から外し、
 *    **Chatwork の本人限定の部屋**へ送る＝LINE の枠は相手あてだけに使う（運用者の指示）。
 *    `selfChatworkRoom` があれば自分あては Chatwork、無ければこれまでどおり自分だけのグループへ。
 * 🆕 2026-09-18：投稿名義を**ハカセAI**（在庫作業担当・account 4094718）の鍵に替えた。
 *    自分の発言ではなくなるうえ `TALK_NOTIFY_CW_TO=5972360` のメンションが付くので、スマホ通知が鳴る。
 *    🔴 鍵は AutoFBA 本番の `AI_EMP_INVENTORY_TOKEN` と同じもの＝**あちらを再発行したらここも入れ替える**。
 *    ハカセAIが投稿先の部屋（331007558）のメンバーであることが前提。
 *
 * @param {object} p  pickNotifyTarget と同じ ＋ selfChatworkRoom（自分あての Chatwork の部屋ID）
 * @returns {{ via: 'line' | 'chatwork' | '', to: string }} to が空＝送らない
 */
export function pickNotifyRoute({ name, selfNames, peerTarget, selfTarget, selfChatworkRoom }) {
  const self = String(selfNames || '').split(',').map(s => s.trim()).filter(Boolean)
  // 自分の名前を決めていない＝振り分けない（これまでどおり1か所へ送る）
  if (!self.length) return peerTarget ? { via: 'line', to: peerTarget } : { via: '', to: '' }

  const who = String(name || '').trim()
  if (self.some(n => n === who)) {
    return peerTarget ? { via: 'line', to: peerTarget } : { via: '', to: '' }
  }
  const room = String(selfChatworkRoom || '').trim()
  if (/^\d+$/.test(room)) return { via: 'chatwork', to: room }
  return selfTarget ? { via: 'line', to: selfTarget } : { via: '', to: '' }
}

/**
 * 部屋を開くURLを組み立てる（2026-09-18・運用者の指示「部屋のリンクも送ってほしい」）。
 *
 * 🔴 URLの形は `<サイト>/calendar/#/t/<部屋ID>`（`src/utils/talkRoom.ts` の HASH_RE と対）。
 *    土台は**通知を叩いた画面のURL（Referer）から採る**＝ドメインやパスをここに書き写さないため。
 *    ハッシュは Referer に載らないので、部屋IDはサーバーが持っているものを付け直す。
 * 🔵 Referer が無いとき（curl での確認など）のために Host からの組み立ても持つ。
 * 🔴 **リンクを載せるのは自分あて（Chatwork・本人だけの部屋）だけ**。部屋IDは合言葉そのもので、
 *    知っている人は誰でも入れる。相手あての LINE には載せない（グループの他の人に見える）。
 *
 * @param {object} p
 * @param {string} p.referer 通知を叩いた画面のURL（`req.headers.referer`）
 * @param {string} p.host    リクエストのホスト（`req.headers.host`）
 * @param {string} p.room    部屋ID（32桁の16進）
 * @returns {string} URL（組み立てられなければ空文字）
 */
export function buildRoomUrl({ referer, host, room }) {
  if (!isRoomId(room)) return ''
  const base = baseFromReferer(referer) || baseFromHost(host)
  return base ? `${base}#/t/${room}` : ''
}

/** Referer から「検索文字とハッシュを落とした、/ で終わるURL」を作る。 */
function baseFromReferer(referer) {
  try {
    const u = new URL(String(referer || ''))
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return ''
    const path = u.pathname.endsWith('/') ? u.pathname : u.pathname.replace(/[^/]*$/, '')
    return `${u.origin}${path}`
  } catch {
    return ''
  }
}

/** Referer が無いときの土台。トークは `/calendar/` の下にいる。 */
function baseFromHost(host) {
  const h = String(host || '').trim()
  return /^[a-z0-9.-]+(:\d+)?$/i.test(h) ? `https://${h}/calendar/` : ''
}

/**
 * Chatwork に投稿する本文。宛先メンションを付けて、自分のスマホに通知を鳴らす。
 * 🆕 2026-09-18：部屋を開くURLを最後の行に足す（運用者の指示）。Chatwork は素のURLをリンクにする。
 * @param {string} text     通知の文面（buildNotifyText の結果）
 * @param {string} toId     メンション先のアカウントID（空ならメンションなし）
 * @param {string} url      部屋を開くURL（空なら付けない）
 */
export function buildChatworkBody(text, toId, url) {
  const id = String(toId || '').trim()
  const head = /^\d+$/.test(id) ? `[To:${id}]\n${text}` : text
  const link = String(url || '').trim()
  return link ? `${head}\n${link}` : head
}
