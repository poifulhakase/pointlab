// 管理者アカウントの単一情報源（クライアント側）。
// 以前は App.tsx / SupportView / JitsiPanel など各所にハードコードされていた。
//
// 管理者メールは構造上3レイヤーに分かれる（完全な単一化は不可）:
//   - クライアント: この admin.ts（1箇所）
//   - サーバー API: Vercel env の ADMIN_EMAIL / ADMIN_UID（api/*.js はすべて env 参照・ハードコードなし）
//   - Firestore ルール: firestore.rules の isAdmin()（env 参照不可のためリテラル・1箇所に集約済み）
// この admin.ts ↔ firestore.rules の齟齬は admin-drift.test.ts が CI で検知する。
// 変更時は ①この定数 ②firestore.rules の isAdmin() ③Vercel env を更新し、rules を再デプロイする。
//
// 単一管理者運用。副管理者（複数管理者）は上記3レイヤーまで一貫配線が要るため、
// 必要になった時点で全層をまとめて対応する。
export const ADMIN_EMAIL = 'sushi.ramen.unajyu@gmail.com'

/** 与えられたメールが管理者かどうか。null/undefined は false。 */
export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && email === ADMIN_EMAIL
}
