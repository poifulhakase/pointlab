// ── プレビューモード ────────────────────────────────────────────────
// 会員限定ページを「中身はダミー・閲覧だけ」で見せるモード（2026-08-12 追加）。
//
// 入り方: https://pointlab.vercel.app/stock-calendar/?preview=poirobo-preview-9f3a
//   🔴 合言葉が一致したときだけ有効。`?preview=1` のような当てずっぽうでは入れない。
//   🔵 一度入ったら sessionStorage に控えるので、画面を移動して URL からパラメータが
//      消えても続く。**タブを閉じると切れる**（次に見せるときはリンクを渡し直す）。
//
// このモードで変わること:
//   ① 会員限定ページ（カレンダー / ロボ口座 / ブンセキ / コネクト）が開ける
//   ② 個人のデータ（メモ・スティッキーメモ・ロボ口座）は**固定のダミー**になる
//      ＝ 実際のメモや実際の売買判断は絶対に出さない
//   ③ **書き込み・送信は全部無効**（保存・予約・問い合わせ・通知登録・ログイン）
//      押しても何も起きず、右下に理由が出る
//
// 🔵 市場データ（価格・需給・イベント＝ public/data/*.json）は**実物のまま**。
//    もともと誰でも取得できる公開データで、ここを差し替えると画面が意味をなさなくなるため
//    （2026-08-12 ユーザー判断）。

/** 合言葉。変えるときはここ1か所（配ったリンクは使えなくなる）。 */
const PREVIEW_TOKEN = 'poirobo-preview-9f3a'

const SS_KEY = 'poirobo-preview'

/**
 * プレビューモードか。
 *
 * 🔵 モジュール読み込み時に1回だけ判定して固定する＝描画のたびに URL を読み直さない。
 *    そのため「途中でプレビューに入る／抜ける」は起きない（リロードで切り替わる）。
 */
const active: boolean = (() => {
  if (typeof window === 'undefined') return false
  try {
    const q = new URLSearchParams(window.location.search).get('preview')
    if (q !== null) {
      const ok = q === PREVIEW_TOKEN
      // 合言葉が違うときは黙って通常表示（「違う」と教えると総当たりの手がかりになる）
      if (ok) sessionStorage.setItem(SS_KEY, '1')
      else return sessionStorage.getItem(SS_KEY) === '1'
      return true
    }
    return sessionStorage.getItem(SS_KEY) === '1'
  } catch {
    return false
  }
})()

export function isPreviewMode(): boolean {
  return active
}

/** 配るリンク（合言葉つき）。案内文やコピー用。 */
export function previewUrl(base = 'https://pointlab.vercel.app/stock-calendar/'): string {
  return `${base}?preview=${PREVIEW_TOKEN}`
}

/**
 * 書き込みを止めたときに理由を出す（画面右下・2.8秒）。
 *
 * 🔴 押しても**何も起きない**と壊れているように見える。止めた理由を必ず出す。
 * 🔵 React の外から呼べるように DOM を直接触る＝どの画面からでも1行で使えるようにするため。
 */
export function notifyPreviewBlocked(message = 'プレビューでは保存・送信はできません'): void {
  if (typeof document === 'undefined') return
  const id = 'poirobo-preview-toast'
  document.getElementById(id)?.remove()

  const el = document.createElement('div')
  el.id = id
  el.textContent = message
  el.setAttribute('role', 'status')     // 読み上げにも届くように
  el.style.cssText = [
    'position:fixed', 'right:16px', 'bottom:88px', 'z-index:100000',
    'max-width:min(88vw,360px)', 'padding:10px 14px', 'border-radius:10px',
    'background:rgba(20,22,35,0.94)', 'color:rgba(255,255,255,0.95)',
    'border:1px solid rgba(0,229,255,0.45)', 'font-size:12.5px', 'line-height:1.6',
    'box-shadow:0 8px 24px rgba(0,0,0,0.4)', 'pointer-events:none',
  ].join(';')
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 2800)
}

/**
 * 書き込み処理の入口に置くガード。
 *
 * ```ts
 * if (blockedInPreview('メモは保存できません')) return
 * ```
 * @returns プレビュー中なら true（呼び出し側はそこで止める）
 */
export function blockedInPreview(message?: string): boolean {
  if (!active) return false
  notifyPreviewBlocked(message)
  return true
}
