import { describe, it, expect } from 'vitest'
// Vite の ?raw でルールファイルを文字列として取り込む（node:fs 不要＝app の型構成のまま）。
import rules from '../../../firestore.rules?raw'
import { ADMIN_EMAIL } from '../admin'

// 管理者メールは複数レイヤー（クライアント admin.ts / Firestore ルール / サーバー env）に
// 分散せざるを得ない（ルールは env 参照不可・リテラル必須）。
// このテストは admin.ts ↔ firestore.rules の齟齬（drift）を CI で検知し、
// 片方だけ変更して権限が静かに壊れる事故を防ぐ。
describe('管理者メールの設定 drift 検知', () => {
  it('firestore.rules が admin.ts の ADMIN_EMAIL と一致する', () => {
    expect(rules).toContain(ADMIN_EMAIL)
  })

  it('firestore.rules 内のメールリテラルは isAdmin() の1箇所のみ（重複の再混入を防ぐ）', () => {
    const occurrences = rules.split(ADMIN_EMAIL).length - 1
    expect(occurrences).toBe(1)
  })

  it('firestore.rules に isAdmin() ヘルパーが定義されている', () => {
    expect(rules).toMatch(/function\s+isAdmin\s*\(\s*\)/)
  })
})
