// ──────────────────────────────────────────────────────────────────────────
// ぽいロボ 疑似トレード: Claude API 呼び出し（★ LLM が最終判断）
//
// 🔴 設計上の前提（docs/robo-trade-design.md §1 論点3）
//    LLM が最終判断者。同一入力でも出力がぶれるためバックテストできない。
//    その代償を埋めるために、ここでは次を必ず守る:
//      ① 出力を Structured Outputs で固定する（形のぶれをなくす）
//      ② 判断器の指紋（モデルID・effort）を返り値に含める
//      ③ 入力と出力を丸ごと呼び出し元へ返す（robo_logs に残すため）
//      ④ refusal を握りつぶさない（拒否された日は hold として記録し、通知する）
//
// 🔴 temperature / top_p は claude-opus-5 では使えない（400 になる）。
//    「毎回同じ判断にする」手段は無い。ぶれは前提として記録で担保する。
// ──────────────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk'
import { ROBO_OUTPUT_SCHEMA } from './roboPrompt.mjs'

export const ROBO_MODEL = 'claude-opus-5'
export const ROBO_EFFORT = 'high'   // 判断の質が価格に直結するので既定は high

/** 画像を Claude の content ブロックにする */
function imageBlock({ base64, mediaType }) {
  return {
    type: 'image',
    source: { type: 'base64', media_type: mediaType, data: base64 },
  }
}

/**
 * LLM に判断させる。
 *
 * @param {object}   p
 * @param {string}   p.prompt   buildRoboPrompt() の出力
 * @param {Array}    p.images   [{ base64, mediaType, label }] 省略可
 * @param {string}   p.model    省略時 ROBO_MODEL
 * @param {string}   p.effort   省略時 ROBO_EFFORT
 * @param {object}   p.client   テスト用に差し替え可能
 * @returns {Promise<{ ok, decision, refusal, model, effort, usage, raw }>}
 */
export async function decide({
  prompt,
  images = [],
  model = ROBO_MODEL,
  effort = ROBO_EFFORT,
  client,
} = {}) {
  if (!prompt) throw new Error('prompt is required')

  const anthropic = client ?? new Anthropic()   // ANTHROPIC_API_KEY を環境から読む

  // 画像はテキストより前に置く（Claude は画像→指示の順が読みやすい）
  // 🔴 ラベルを画像の直前に入れる（2026-08-13）。日足・週足・保有画面を並べて渡すので、
  //    名札が無いと**どれが何か分からず取り違える**。
  const content = [
    ...images.flatMap((img) => (
      img.label ? [{ type: 'text', text: `【${img.label}】` }, imageBlock(img)] : [imageBlock(img)]
    )),
    { type: 'text', text: prompt },
  ]

  // 🔴 max_tokens は thinking + 本文の合計。adaptive thinking が既定で入るので広めに取る。
  const res = await anthropic.messages.create({
    model,
    max_tokens: 16000,
    output_config: {
      effort,
      format: { type: 'json_schema', schema: ROBO_OUTPUT_SCHEMA },
    },
    messages: [{ role: 'user', content }],
  })

  // 🔴 content を読む前に必ず stop_reason を見る（Opus 5 は安全分類器で拒否しうる）
  if (res.stop_reason === 'refusal') {
    return {
      ok: false,
      refusal: {
        category: res.stop_details?.category ?? null,
        explanation: res.stop_details?.explanation ?? null,
      },
      decision: null,
      model, effort,
      usage: res.usage ?? null,
      raw: res,
    }
  }

  if (res.stop_reason === 'max_tokens') {
    return {
      ok: false,
      refusal: null,
      error: 'max_tokens に達して出力が切れた（max_tokens を上げるか effort を下げる）',
      decision: null,
      model, effort,
      usage: res.usage ?? null,
      raw: res,
    }
  }

  const text = (res.content ?? []).find(b => b.type === 'text')?.text
  if (!text) {
    return {
      ok: false, refusal: null, error: 'テキストブロックが返らなかった',
      decision: null, model, effort, usage: res.usage ?? null, raw: res,
    }
  }

  let decision
  try {
    decision = JSON.parse(text)
  } catch {
    return {
      ok: false, refusal: null, error: `JSON として読めなかった: ${text.slice(0, 200)}`,
      decision: null, model, effort, usage: res.usage ?? null, raw: res,
    }
  }

  return {
    ok: true,
    refusal: null,
    decision,
    model, effort,
    usage: res.usage ?? null,
    raw: res,
  }
}

/**
 * 判断が取れなかった日の既定値。
 * 🔴 決定論の結果で埋めない。判断器が違うものを同じ成績表に混ぜないため。
 */
export function holdOnFailure(note) {
  return {
    action: 'hold',
    symbol: 'none',
    qty: 0,
    confidence_pct: 0,
    reason: `判断を取得できなかったため見送り（${note}）`,
    counter: '—',
    user_note: '',
  }
}

/**
 * 判断結果の妥当性チェック。スキーマは形しか保証しないので、意味の整合はここで見る。
 * 返り値: { valid, issues: string[], normalized }
 */
export function validateDecision(d) {
  const issues = []
  if (!d) return { valid: false, issues: ['判断が空'], normalized: null }

  const n = { ...d }

  if (n.action === 'open' && n.symbol === 'none') {
    issues.push('open なのに銘柄が none → hold に落とす')
    n.action = 'hold'; n.qty = 0
  }
  if (n.action === 'hold' || n.action === 'close') {
    if (n.qty !== 0) { issues.push(`${n.action} なのに qty=${n.qty} → 0 に落とす`); n.qty = 0 }
    if (n.action === 'hold' && n.symbol !== 'none') { issues.push('hold なのに銘柄指定 → none に落とす'); n.symbol = 'none' }
  }
  if (n.action === 'open' && (!Number.isFinite(n.qty) || n.qty <= 0)) {
    issues.push(`open なのに qty=${n.qty} → hold に落とす`)
    n.action = 'hold'; n.symbol = 'none'; n.qty = 0
  }
  const c = Number(n.confidence_pct)
  if (!Number.isFinite(c) || c < 0 || c > 100) {
    issues.push(`確信度が範囲外（${n.confidence_pct}）→ 50 に丸める`)
    n.confidence_pct = 50
  }
  if (!n.reason || String(n.reason).trim().length < 5) issues.push('reason が短すぎる（記録の価値が下がる）')
  if (!n.counter || String(n.counter).trim().length < 3) issues.push('counter（反証）が空。負け筋が記録されない')

  return { valid: issues.length === 0, issues, normalized: n }
}
