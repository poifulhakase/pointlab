import { describe, it, expect } from 'vitest'
import panelSource from '../components/RoboAccountPanel.tsx?raw'
import appSource from '../App.tsx?raw'
import { ENGINE_TABS, ENGINE_LABELS } from './engineTabs'

/**
 * エンジン画面（ロボ口座）のタブ。
 *
 * 🔴 シールド画面と同じ壊れ方を繰り返さないための固定。
 *    パネルを書く順とタブの並び順がズレると、内容は正しいのに
 *    **スライドが左右逆に動く**（2026-08-11 にシールドで実際に起きた）。
 */
describe('エンジン画面のタブ', () => {
  it('タブは ロボ口座 / 成績 / 履歴 の3枚', () => {
    expect([...ENGINE_TABS]).toEqual(['account', 'perf', 'log'])
    expect(ENGINE_TABS.map(t => ENGINE_LABELS[t])).toEqual(['ロボ口座', '成績', '履歴'])
  })

  it('面を書いた順がタブの並び順と一致する', () => {
    // 面の見出しコメント（══ ① … ══）を書いた順に拾う
    const order = [...panelSource.matchAll(/══ [①②③] ([^（(]+)/g)].map(m => m[1].trim())
    expect(order).toEqual(['ロボ口座', '成績', '履歴'])
  })

  it('スライダーの移動量が並び順から計算されている', () => {
    // 🔴 index を手で書くと、タブを増やしたときに必ずズレる
    expect(panelSource).toContain('ENGINE_TABS.indexOf(engineTab)')
    expect(panelSource).toContain('translateX(-${tabIndex * (100 / tabCount)}%)')
  })

  it('並び順を2か所で持たない（App.tsx は共通定義を読む）', () => {
    expect(appSource).toContain("from './utils/engineTabs'")
    expect(appSource).not.toMatch(/const ENGINE_TABS\s*=\s*\[/)
  })
})
