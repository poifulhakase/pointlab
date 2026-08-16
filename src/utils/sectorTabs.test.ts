import { describe, it, expect } from 'vitest'
import panelSource from '../components/SectorPanel.tsx?raw'
import appSource from '../App.tsx?raw'
import { SECTOR_TABS, SECTOR_LABELS } from './sectorTabs'

describe('周期画面のタブ', () => {
  it('並びは サイクル → 探す', () => {
    expect([...SECTOR_TABS]).toEqual(['sector', 'stock'])
    // 🔴 2026-08-16 改称（Believe の 主力／その他 と横並びにするため）
    expect(SECTOR_TABS.map(t => SECTOR_LABELS[t])).toEqual(['サイクル', '探す'])
  })

  // 🔴 「探す」は**スマホだけ**。PC は3列とも並んでいるので、出すと押せないタブが増えるだけになる。
  it('「探す」はスマホのときだけ出す', () => {
    expect(appSource).toContain("...(isMobile ? [{ key: 'find'")
  })

  // 🔴 隠すのは display。作り直すと検索欄の入力やAIの結果がタブ移動で消える。
  it('パネルは display で出し分けている（作り直さない）', () => {
    expect(panelSource).toContain("display: showSector ? 'flex' : 'none'")
    expect(panelSource).toContain("display: showStock ? 'flex' : 'none'")
  })
})
