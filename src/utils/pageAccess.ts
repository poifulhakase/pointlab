/**
 * ページを開いてよいかの判定（純粋関数・単一情報源）。
 *
 * 🔴 なぜ関数に切り出すか＝**権限の判定を画面のあちこちに書かない**ため。
 *    2026-08-22 に「ロボ口座・地下室は管理者限定」に変えたとき、判定が
 *    ①フッターのタブ ②画面の描画 ③リダイレクト の3か所に必要になった。
 *    条件を書き写すと、どれか1つを直し忘れたときに**見えてはいけない画面が開く**。
 */

/**
 * 🔴 **管理者だけが開けるページ**（2026-08-22 ユーザー指示）。
 *
 * - `shield`（ロボ口座）＝疑似トレードの検証中の口座。判断の精度を測っている最中
 * - `daytrade` / `swing`（地下室）＝検証途中の生の記録
 *
 * 🔴 **会員にも見せない**。それまでは会員限定だったが、ユーザー判断で一段上げた。
 */
export const ADMIN_ONLY_VIEWS: readonly string[] = ['shield', 'daytrade', 'swing']

export function isAdminOnlyView(view: string): boolean {
  return ADMIN_ONLY_VIEWS.includes(view)
}

/**
 * 管理者限定ページを開いてよいか。
 *
 * 🔵 「非メンバーとして確認」中は**管理者でも閉じる**＝他の人にどう見えるかを確かめるための機能なので、
 *    ここだけ素通りすると確認にならない。
 * 🔴 一時公開フラグ・デモ・プレビューでは開かない（会員限定より一段強いゲートとして扱う）。
 */
export function canOpenAdminPages(opts: { isAdminUser: boolean; previewAsNonMember: boolean }): boolean {
  return opts.isAdminUser && !opts.previewAsNonMember
}
