import { describe, it, expect } from 'vitest'
import { ADMIN_ONLY_VIEWS, isAdminOnlyView, canOpenAdminPages } from '../pageAccess'

/**
 * 🔴 権限のテスト。ここが緩むと**見えてはいけない画面が会員に開く**。
 *    2026-08-22 にユーザー指示で「ロボ口座・地下室（デイ/スイング）は管理者限定」へ変更した
 *    （それまでロボ口座は会員限定・地下室はゲートすら無かった）。
 */
describe('管理者限定ページ', () => {
  it('対象は ロボ口座・デイトレード・スイングトレード の3つ', () => {
    expect([...ADMIN_ONLY_VIEWS].sort()).toEqual(['daytrade', 'shield', 'swing'])
  })

  it('管理者は開ける', () => {
    expect(canOpenAdminPages({ isAdminUser: true, previewAsNonMember: false })).toBe(true)
  })

  // 🔴 いちばん守りたい行。会員＝管理者ではない
  it('会員でも開けない（管理者でなければ不可）', () => {
    expect(canOpenAdminPages({ isAdminUser: false, previewAsNonMember: false })).toBe(false)
  })

  // 🔵 「非メンバーとして確認」中は管理者でも閉じる＝そうしないと確認にならない
  it('非メンバーとして確認している間は、管理者でも開けない', () => {
    expect(canOpenAdminPages({ isAdminUser: true, previewAsNonMember: true })).toBe(false)
  })

  it('会員限定ページ（カレンダー・ブンセキ等）は管理者限定に含めない', () => {
    for (const v of ['month', 'week', 'day', 'quant', 'momentum', 'watch', 'sector', 'support', 'chart']) {
      expect(isAdminOnlyView(v)).toBe(false)
    }
  })

  it('管理者限定のビュー名を判定できる', () => {
    expect(isAdminOnlyView('shield')).toBe(true)
    expect(isAdminOnlyView('daytrade')).toBe(true)
    expect(isAdminOnlyView('swing')).toBe(true)
  })
})
