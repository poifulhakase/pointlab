import type React from 'react'
import type { User } from 'firebase/auth'
import { themeVars } from '../utils/themeVars'
import { cy } from '../utils/cyberTheme'
import { isAdminEmail } from '../utils/admin'
import { MarginKijitsuPanel } from './MarginKijitsuPanel'

// ──────────────────────────────────────────────────────────────────────────
// ロボ口座ビュー（内部識別子 'shield'・旧「エンジン」）
//
// 🔴 2026-09-16: **疑似トレード（ロボ口座）を廃止**（ユーザー指示「すべて空にしたい・機能も削除」）。
//    口座・成績・履歴のタブ、判断（Actions）、チャート撮影（タスクスケジューラ）、
//    Chatwork 通知、robo_account.json / robo_logs を消した。**キャラだけ残し**、
//    中身は「信用期日」（MarginKijitsuPanel）に置き換えた。
// 🔴 2026-08-09: 旧「ポジション分析」機能を削除（localStorage `poical-shield-memo` と
//    Firestore `users/{uid}/data/shieldMemo` は消していない）。
//
// 🔴 内部識別子 'shield' と このファイル名は据え置き（CLAUDE.md の不変ルール）。
// 🔴 表示は管理者のみ。
// ──────────────────────────────────────────────────────────────────────────
type Props = {
  theme: 'dark' | 'light'
  isMobile: boolean
  user: User | null
}

export function ShieldView({ theme, isMobile, user }: Props) {
  const tv = themeVars(theme)
  const c = cy(theme)

  return (
    <div style={{ ...s.wrap, ...tv }}>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {isAdminEmail(user?.email) ? (
          <MarginKijitsuPanel theme={theme} isMobile={isMobile} user={user} />
        ) : (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: c.BG, backgroundImage: c.SCAN, padding: 24,
          }}>
            <div style={{
              maxWidth: 420, textAlign: 'center',
              fontFamily: c.FONT, color: c.DESC, fontSize: 13, lineHeight: 2,
              border: `1px solid ${c.BORDER}`, borderRadius: 6, background: c.HDBG, padding: 20,
            }}>
              現在は開発者のみが閲覧できます。
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── スタイル ─────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 },
}
