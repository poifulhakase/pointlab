// 管理者アカウントの単一情報源（クライアント側）。
// 以前は App.tsx / SupportView / JitsiPanel など各所にハードコードされていた。
// 注意: Firestore セキュリティルール（firestore.rules）と api/*.js（ADMIN_UID / ADMIN_EMAIL 環境変数）
// にも同じメールが記載されている。変更時はそれらも合わせて更新すること。
//
// 単一管理者運用。副管理者（複数管理者）は firestore.rules / API env まで一貫して
// 配線しないと中途半端になるため、必要になった時点で全層をまとめて対応する。
export const ADMIN_EMAIL = 'sushi.ramen.unajyu@gmail.com'

/** 与えられたメールが管理者かどうか。null/undefined は false。 */
export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && email === ADMIN_EMAIL
}
