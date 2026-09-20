import { describe, it, expect } from 'vitest'
// @ts-expect-error scripts/ は素の JS（型定義を持たない）
import { buildFailurePayload, failedSteps, parseOutcomes } from '../../../scripts/workflowFailure.mjs'

/**
 * データ自動更新ワークフローの失敗通知（`.github/workflows/fetch-data.yml`）。
 *
 * 🔴 ここが緩むと**静かな故障**に戻る。取得系ステップは continue-on-error なので、
 *    落ちても誰にも知らされないまま「7日以上古い」で ロボトレード が止まる。
 * 🔴 同時に、skipped を失敗として数えると毎日赤が飛んで狼少年になる。
 *    「拾いすぎない・落としすぎない」の両方を固定する。
 */
describe('workflow-failure', () => {
  describe('failedSteps', () => {
    it('failure だけ拾う', () => {
      expect(failedSteps({ A: 'failure', B: 'success' })).toEqual(['A'])
    })

    it('🔴 skipped を失敗にしない（土曜だけのステップは平日 skipped が正常）', () => {
      expect(failedSteps({ A: 'skipped', B: 'success', C: '', D: 'cancelled' })).toEqual([])
    })

    it('空でも落ちない', () => {
      expect(failedSteps({})).toEqual([])
      expect(failedSteps(undefined)).toEqual([])
    })
  })

  describe('parseOutcomes', () => {
    it('名前=結果 を改行で並べたものを読む', () => {
      expect(parseOutcomes('データ取得=failure\nバックテスト=skipped\n')).toEqual({
        データ取得: 'failure',
        バックテスト: 'skipped',
      })
    })

    it('空行や = の無い行は捨てる', () => {
      expect(parseOutcomes('\n  \nごみ\nA=success')).toEqual({ A: 'success' })
    })
  })

  describe('buildFailurePayload', () => {
    const base = { runUrl: 'https://example.test/run/1', when: '2026-09-20 11:00 UTC' }

    it('🔵 失敗が無ければ送らない（通知の静かさ）', () => {
      expect(buildFailurePayload({ ...base, outcomes: { A: 'success', B: 'skipped' } }))
        .toBeNull()
    })

    it('落ちたステップを並べ、実行ログのURLを付ける', () => {
      const payload = buildFailurePayload({
        ...base,
        outcomes: { データ取得: 'failure', TARGET生成: 'failure', バックテスト: 'skipped' },
      })
      const embed = payload!.embeds[0] as { title: string; fields: { name: string; value: string }[] }
      expect(embed.title).toBe('[取得] データ自動更新で 2ステップが失敗')
      const steps = embed.fields.find((f) => f.name === '落ちたステップ')!.value
      expect(steps).toContain('・データ取得')
      expect(steps).toContain('・TARGET生成')
      expect(steps).not.toContain('バックテスト')      // skipped は載せない
      expect(embed.fields.find((f) => f.name === '実行ログ')!.value).toBe(base.runUrl)
    })

    it('状態ラベルを出す（「ご確認ください」のような依頼文は書かない）', () => {
      const payload = buildFailurePayload({ ...base, outcomes: { データ取得: 'failure' } })
      const embed = payload!.embeds[0] as { fields: { name: string; value: string }[] }
      expect(embed.fields.find((f) => f.name === '状態')!.value).toBe('要対応')
      const text = JSON.stringify(payload)
      expect(text).not.toContain('ご確認')
      expect(text).not.toContain('お願い')
    })

    it('鮮度チェックだけの失敗は「データが古い」と見出しを分ける', () => {
      const payload = buildFailurePayload({
        ...base, outcomes: { データ鮮度チェック: 'failure', データ取得: 'success' },
      })
      const embed = payload!.embeds[0] as { title: string }
      expect(embed.title).toBe('[データ] データが古い（鮮度チェックが落ちた）')
    })
  })
})
