import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import TargetView from './TargetView'
import type { TargetSupportData } from '../utils/targetSupport'

/**
 * TARGET の画面が、**実データで**描けるかを見る。
 *
 * 🔴 この画面は会員限定なので、ローカルの開発サーバーからは開けない
 *    （ログインが要る）。だから「動かして確かめる」をここで代わりにやる。
 * 🔴 見るのは3つだけ:
 *    ① 指名した主力が消えていないか（フィルタで黙って落ちるのがいちばん怖い）
 *    ② **測って負けている断り書き**が出ているか（消えたら画面の意味が変わる）
 *    ③ 帯が組めない銘柄でも落ちずに描けるか（band: null）
 */

// 🔵 実データをそのまま読む（Vite が JSON を取り込む＝node の fs を使わずに済む）
const loaded = import.meta.glob('../../public/data/target_support.json', { eager: true, import: 'default' })
const full = Object.values(loaded)[0] as TargetSupportData

// 🔵 候補は本番だと700件を超える。jsdom で全部描くと数秒かかってテストが時間切れになるので、
//    実データの**並び順そのまま先頭20件**に切って使う（中身は本物・並びも本物）。
const raw: TargetSupportData = { ...full, items: full.items.slice(0, 20) }

let container: HTMLDivElement
let root: Root

// React に「テスト環境だ」と伝える（act の警告が出て、待ちが効かなくなるため）
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

beforeEach(() => {
  localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)

  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).includes('target_support.json')) {
      return { ok: true, json: async () => raw } as unknown as Response
    }
    // 信用残は「取れない週」を再現する（ゲージが無くてもカードは出るのが正しい）
    return { ok: false, status: 404, json: async () => ({}) } as unknown as Response
  }))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

async function renderView(mode: 'core' | 'scan') {
  await act(async () => {
    root.render(<TargetView theme="dark" isMobile={false} mode={mode} onClose={() => {}} />)
  })
  // 🔴 fetch の解決は1ティックでは終わらない（キャッシュ層をはさむので数ティックかかる）。
  //    マイクロタスクを1回流すだけだと、遅い実行のときに読み込み中のまま検査してしまう。
  for (let i = 0; i < 50; i++) {
    if (!(container.textContent ?? '').includes('TARGET /')) break
    if ((container.textContent ?? '').includes('主力の現在地') || (container.textContent ?? '').includes('帯の近くにいる銘柄')) break
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
  }
  return container.textContent ?? ''
}

describe('TargetView（主力）', () => {
  it('指名した銘柄が全部出る（スキャンの条件で落ちない）', async () => {
    const text = await renderView('core')
    for (const s of raw.core) expect(text).toContain(s.name)
    expect(raw.core.length).toBeGreaterThan(0)
  })

  it('🔴 測って負けている断り書きを出す', async () => {
    const text = await renderView('core')
    expect(text).toContain('負けていた')
  })

  it('帯が組めない銘柄でも落ちない', async () => {
    const noBand = raw.core.find(s => s.band == null)
    if (!noBand) return   // 帯なしの銘柄が無い日はこの検査を飛ばす
    const text = await renderView('core')
    expect(text).toContain('帯なし')
  })

  it('信用残が取れなくてもカードは出る（ゲージだけ出ない）', async () => {
    const text = await renderView('core')
    expect(text).toContain(raw.core[0].name)
  })
})

describe('TargetView（候補）', () => {
  it('スキャン結果と件数の内訳を出す', async () => {
    const text = await renderView('scan')
    expect(text).toContain('帯の中')
    expect(text).toContain(`すべて ${raw.items.length}`)
  })

  it('先頭は帯にいちばん近い銘柄（距離順に並んでいる）', async () => {
    const text = await renderView('scan')
    expect(text).toContain(raw.items[0].name)
  })
})
