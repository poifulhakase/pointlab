import { describe, it, expect } from 'vitest'
import quantViewSource from '../components/QuantView.tsx?raw'
import appSource from '../App.tsx?raw'
import { QUANT_TABS, QUANT_LABELS } from './quantTabs'

/**
 * シールド画面のタブは「ボタンの並び」と「パネルのDOM順」が一致していないといけない。
 *
 * 🔴 ここが1つでもズレると、内容は正しく出るのに**スライドが左右逆に動く**
 *    （2026-08-11 ユーザー指摘：周期はボタンが右端なのにDOMが2番目で、先物→周期が左へ戻っていた）。
 *    さらにズレ方によっては**別のパネルが表示される**（2026-08-09 に発生）。
 * 🔵 目で見て気づきにくいので、ソースを読んで機械的に固定する。
 */
describe('シールド画面のタブの並び', () => {
  /** QuantView の JSX に出てくる showTab('xxx') を、書いてある順に拾う＝パネルのDOM順。 */
  const domOrder = [...quantViewSource.matchAll(/showTab\('([a-z]+)'\)/g)].map(m => m[1])

  it('パネルのDOM順がタブの並び順と一致する', () => {
    expect(domOrder).toEqual([...QUANT_TABS])
  })

  it('パネルは1タブにつき1つだけ書かれている', () => {
    // 同じ showTab が2回出てくると、上のDOM順の判定がすり抜ける
    expect(new Set(domOrder).size).toBe(domOrder.length)
  })

  it('全タブに名前が付いている', () => {
    for (const t of QUANT_TABS) {
      expect(QUANT_LABELS[t], `${t} の名前が無い`).toBeTruthy()
    }
  })

  it('並び順を2か所で持たない（App.tsx は共通定義を読む）', () => {
    // 🔴 App.tsx に配列リテラルが復活したら、また別々に持つことになる
    expect(appSource).toContain("from './utils/quantTabs'")
    expect(appSource).not.toMatch(/const QUANT_TABS\s*=\s*\[/)
  })
})
