// 管理者アカウントの単一情報源（クライアント側）。
// 以前は App.tsx / SupportView / JitsiPanel など各所にハードコードされていた。
// 注意: Firestore セキュリティルール（firestore.rules）には別途同じメールが記載されている。
// 変更時は firestore.rules と api/*.js（ADMIN_UID / ADMIN_EMAIL 環境変数）も合わせて確認すること。
//
// 複数管理者（副管理者・bus factor 対策）に対応するため配列で保持する。
// 副管理者を追加する場合はこの配列に追記する（クライアント判定用。サーバー側は環境変数を別途更新）。
export const ADMIN_EMAILS = [
  'sushi.ramen.unajyu@gmail.com',
] as const

/** 後方互換: 主管理者メール（配列の先頭）。 */
export const ADMIN_EMAIL = ADMIN_EMAILS[0]

/** 与えられたメールが管理者かどうか。null/undefined は false。 */
export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && (ADMIN_EMAILS as readonly string[]).includes(email)
}
