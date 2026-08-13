// 影の判断（2026-08-13）
//
// 🔵 何のためか＝「材料を減らしたら成績はどうなるか」を、本番を壊さずに測るため。
//    ユーザーの問い＝**チャートだけで判断させたら、いまのやり方に勝つのか**。
//    答えは貯めてからでないと出ないので、同じ日に3通りの判断を出して記録し、
//    実際に建てるのは本番（現行）だけにする。
//
//    ① 本番      … 需給＋価格＋チャート（robo-trade.mjs 本体）
//    ② チャートのみ … 日足・週足の画像だけ。数値は一切渡さない
//    ③ 数値のみ   … 需給＋価格。チャートは渡さない
//
// 🔴 影は**口座にも注文にも通知にも触らない**。記録だけ。
//    失敗しても本番を止めない（例外はここで飲み、警告として返す）。
//
// 🔴 ②は**過去に遡って再現できない**（当時のチャート画像が無いと同じ入力を作れない）。
//    だから貯める以外に測る道がない。30トレード貯まるまで比較しない。
//
// 🔵 30件貯まったら `scripts/compare-shadows.mjs`（未作成）で3通りの勝率・損益を並べる。

import { decide, validateDecision } from './llmDecide.mjs'

/** チャートだけ渡すときの指示。数値が無いので、数値を前提にした言い回しを避ける。 */
const CHART_ONLY_PROMPT = `あなたは日経平均の翌営業日の建玉を決めます。渡されたのは**チャート画像だけ**です。
需給データも価格の数値も渡していません。**画像から読めることだけ**で判断してください。

- 建てられるのは 1570（ブル1倍）／1357（ベア1倍）のどちらか、または見送り。
- 数量は 10 口を上限に、確信度に応じて決めてください。
- 画像から正確な価格は読めないので、価格の数値には言及しないでください。
- 判断できないと感じたら、遠慮なく見送り（none）にしてください。`

/**
 * 影の判断を2本走らせる。
 *
 * @param {object} p
 * @param {string} p.prompt  本番と同じプロンプト（③で使う）
 * @param {Array}  p.images  本番と同じ画像リスト（②で使う。保有画面は除く）
 * @param {Function} p.log
 * @returns {Promise<{ chart_only: object|null, numbers_only: object|null, errors: string[] }>}
 */
export async function runShadowDecisions({ prompt, images = [], log = () => {} } = {}) {
  const errors = []
  // 🔴 保有画面は「いま何を持っているか」であって相場の材料ではないので、影では渡さない。
  const charts = images.filter(i => (i.label ?? '').includes('チャート'))

  const one = async (name, args) => {
    try {
      const r = await decide(args)
      if (!r.ok) {
        errors.push(`${name}: ${r.refusal ? '拒否' : (r.error ?? '不明')}`)
        return null
      }
      const v = validateDecision(r.decision)
      const d = v.normalized ?? r.decision
      log(`  影(${name}): ${d.action} ${d.symbol ?? '—'} ${d.qty ?? 0}口 確信度${d.confidence_pct ?? '—'}%`)
      return { decision: d, validation: v.issues, usage: r.usage ?? null, model: r.model, effort: r.effort }
    } catch (e) {
      errors.push(`${name}: ${e.message}`)
      return null
    }
  }

  const chart_only = charts.length
    ? await one('チャートのみ', { prompt: CHART_ONLY_PROMPT, images: charts })
    : (errors.push('チャートのみ: 画像が無いので走らせていない'), null)

  const numbers_only = await one('数値のみ', { prompt, images: [] })

  return { chart_only, numbers_only, errors }
}
