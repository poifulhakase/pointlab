import type React from 'react'
import type { User } from 'firebase/auth'
import { themeVars } from '../utils/themeVars'
import { cy } from '../utils/cyberTheme'
import { isAdminEmail } from '../utils/admin'
import { RoboAccountPanel } from './RoboAccountPanel'
import { demoMode } from '../utils/roboDemo'
import type { EngineTabKey } from '../utils/engineTabs'

// ──────────────────────────────────────────────────────────────────────────
// エンジン（ポジション）ビュー
//
// 🔴 2026-08-09: 旧「ポジション分析」機能（AIにプロンプトを渡して出口を判断させる道具）を
//    削除し、疑似トレード（ロボ口座）で置き換えた（ユーザー指示・仕様書 §3 の削除タスク）。
//    削除したもの: ShieldPanel / MemoPanel / SHIELD_PROMPT_TEMPLATE / buildShieldData /
//                  SHIELD_STATUS_LINES と、それらを呼ぶ配線。
//    🔴 localStorage `poical-shield-memo` と Firestore `users/{uid}/data/shieldMemo` は
//       **消していない**（過去のレポートを失わせないため。読み出し口を落としただけ）。
//
// 🔴 内部識別子 'shield' と このファイル名は据え置き（CLAUDE.md の不変ルール）。
// 🔴 ロボ口座の表示は管理者のみ（robo_account.json は公開データのため。設計書 §10.2）。
// ──────────────────────────────────────────────────────────────────────────
type Props = {
  theme: 'dark' | 'light'
  isMobile: boolean
  user: User | null
  /** 表示するタブ（ロボ口座／成績／履歴）。並び順は engineTabs.ts が単一情報源。 */
  engineTab?: EngineTabKey
}

export function ShieldView({ theme, isMobile, user, engineTab }: Props) {
  const tv = themeVars(theme)
  const c = cy(theme)

  return (
    <div style={{ ...s.wrap, ...tv }}>
      <div style={{
        flex: 1, minHeight: 0, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        // 浮いているタブとフッターに中身の末尾が隠れないための逃げ
        paddingBottom: isMobile ? 130 : 0,
      }}>
        {/* 🔵 デザイン確認時（開発時の ?demo=...）は未ログインでも中身を出す。
            demoMode() は本番ビルドでは常に null なので、この枝は落ちる。 */}
        {isAdminEmail(user?.email) || demoMode() ? (
          <RoboAccountPanel theme={theme} isMobile={isMobile} engineTab={engineTab} />
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
              <div style={{ color: c.GREEN, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', marginBottom: 10 }}>
                ▌ ROBO ACCOUNT
              </div>
              日経平均ブル／ベアの疑似トレードを記録している画面です。<br />
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
