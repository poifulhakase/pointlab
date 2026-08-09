// ──────────────────────────────────────────────────────────────────────────
// ぽいロボ 疑似トレード: 実保有キャプチャの読み取り（Claude の vision）
//
// 🔴 ロボ口座（robo_account.json）とは別ファイルに保存する。
//    同期させると「AIの判断が良かったのか、人の介入が良かったのか」が
//    分離できなくなり、Go/No-Go も対照群比較も意味を失う（設計書 §11.5）。
// 🔴 読めなかった項目は推測で埋めない。unreadable_fields に列挙する。
// ──────────────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk'

export const READ_MODEL = 'claude-opus-5'

export const POSITION_SCHEMA = {
  type: 'object',
  properties: {
    positions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },       // 銘柄コード。読めなければ空文字
          name: { type: 'string' },
          qty: { type: 'integer' },
          avg_price: { type: 'number' },
          last_price: { type: 'number' },
          pnl: { type: 'number' },
          pnl_pct: { type: 'number' },
        },
        required: ['symbol', 'name', 'qty', 'avg_price', 'last_price', 'pnl', 'pnl_pct'],
        additionalProperties: false,
      },
    },
    unreadable_fields: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    note: { type: 'string' },
  },
  required: ['positions', 'unreadable_fields', 'confidence', 'note'],
  additionalProperties: false,
}

const PROMPT = `添付された証券口座の保有画面のスクリーンショットから、保有中の建玉を読み取ってください。

読み取る項目（1銘柄ごと）:
  symbol      … 銘柄コード（4桁の数字。画面に無ければ空文字）
  name        … 銘柄名
  qty         … 保有数量（口数・株数）
  avg_price   … 平均取得単価
  last_price  … 現在値
  pnl         … 評価損益（円）
  pnl_pct     … 評価損益率（%）

🔴 守ること
・**画面に書かれている数字だけを読むこと。計算で補ったり、推測で埋めたりしない。**
・読み取れなかった項目があれば unreadable_fields に「銘柄名:項目名」の形で列挙する。
  その項目の値は 0 にしておく（0 が実際の値なのか読めなかったのかは unreadable_fields で判断する）。
・保有が1件も無い画面なら positions を空配列にする。
・画面が保有一覧でない（別の画面・チャート等）場合も positions を空にし、note にその旨を書く。
・confidence は画面の鮮明さと読み取りの確からしさ（high / medium / low）。`

/**
 * 保有画面のキャプチャを読み取る。
 * @param {object} p { base64, mediaType, client }
 * @returns {Promise<{ ok, result, error }>}
 */
export async function readPositionImage({ base64, mediaType = 'image/jpeg', client } = {}) {
  if (!base64) return { ok: false, result: null, error: '画像が無い' }

  const anthropic = client ?? new Anthropic()
  const res = await anthropic.messages.create({
    model: READ_MODEL,
    max_tokens: 8000,
    output_config: {
      effort: 'medium',                                   // 読み取りは深い推論を要しない
      format: { type: 'json_schema', schema: POSITION_SCHEMA },
    },
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: PROMPT },
      ],
    }],
  })

  if (res.stop_reason === 'refusal') {
    return { ok: false, result: null, error: `拒否（${res.stop_details?.category ?? '理由不明'}）` }
  }
  const text = (res.content ?? []).find(b => b.type === 'text')?.text
  if (!text) return { ok: false, result: null, error: 'テキストが返らなかった' }

  try {
    return { ok: true, result: JSON.parse(text), error: null }
  } catch {
    return { ok: false, result: null, error: `JSON として読めなかった: ${text.slice(0, 150)}` }
  }
}

/**
 * 読み取り結果を real_position.json の形に整える。
 * 🔴 captured_at と age_days を必ず入れる（古い情報を新しい情報として扱わせないため）。
 */
export function toRealPosition({ result, uploadTime, filename, ageDays }) {
  return {
    captured_at: uploadTime ? new Date(uploadTime * 1000).toISOString() : null,
    age_days: ageDays ?? null,
    source: 'chatwork',
    source_filename: filename ?? null,
    positions: result?.positions ?? [],
    unreadable_fields: result?.unreadable_fields ?? [],
    confidence: result?.confidence ?? 'low',
    note: result?.note ?? '',
    read_at: new Date().toISOString(),
  }
}

/** 読み取り結果の妥当性を見る（数字の辻褄が合わないものを警告として返す） */
export function checkRealPosition(rp) {
  const warnings = []
  if (!rp) return warnings
  if (rp.confidence === 'low') warnings.push('保有画面の読み取り精度が低いと判定されました')
  if (rp.unreadable_fields?.length) warnings.push(`保有画面で読み取れなかった項目: ${rp.unreadable_fields.join(', ')}`)
  if (rp.age_days != null && rp.age_days >= 5) warnings.push(`保有画面のキャプチャが${rp.age_days}営業日前のものです`)

  for (const p of rp.positions ?? []) {
    // 損益率と、単価差から計算した率が大きく食い違っていたら疑う
    if (p.avg_price > 0 && p.last_price > 0 && Number.isFinite(p.pnl_pct)) {
      const calc = ((p.last_price - p.avg_price) / p.avg_price) * 100
      if (Math.abs(calc - p.pnl_pct) > 3) {
        warnings.push(`${p.name || p.symbol}: 損益率の読み取りが怪しい（画面 ${p.pnl_pct}% / 単価から計算 ${Math.round(calc * 10) / 10}%）`)
      }
    }
  }
  return warnings
}
