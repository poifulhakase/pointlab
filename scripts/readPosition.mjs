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

// 🔴 読む対象を4銘柄に絞る。個別株が並んでいるほど行ずれの誤読が起きやすいので、
//    「探して読む」範囲を最小にする（ユーザー指摘・2026-08-09）。
const PROMPT = `添付された**松井証券の保有株式（残高照会）**のスクリーンショットを読み取ってください。

🔴 **これは「いま何を何口持っているか」の画面です。取引履歴（約定履歴）ではありません。**
　 もし添付が取引履歴の画面だった場合は、positions を空にして note に「取引履歴の画面」と書いてください。
　 読み取るのは**保有数量**であって、約定した数量ではありません。

🔵 松井証券の保有株式画面は、1銘柄が1行で
　 「銘柄コード・銘柄名 / 保有数量 / 平均取得単価 / 現在値 / 評価損益 / 評価損益率」
　 の並びになっている。現物と信用が別の区分で表示されることがあるが、**現物の保有を読むこと**。

# 読み取る銘柄（この4つだけ）

  1321 … 日経225連動型上場投信（ブル1倍）
  1570 … 日経平均レバレッジ・インデックス連動型上場投信（ブル2倍）
  1571 … 日経平均インバース・インデックス連動型上場投信（ベア1倍）
  1357 … 日経平均ダブルインバース・インデックス連動型上場投信（ベア2倍）

🔴 **この4銘柄以外は読まないこと。** 個別株や他のETFが並んでいても明細は読まず、
　 件数だけ数えて other_holdings_count に入れてください。

# 読み取る項目（対象銘柄1つごと）

  symbol      … 銘柄コード（上の4つのいずれか）
  name        … 画面に表示されている銘柄名
  qty         … 保有数量（口数・株数）
  avg_price   … 平均取得単価
  last_price  … 現在値
  pnl         … 評価損益（円）
  pnl_pct     … 評価損益率（%）

# 🔴 守ること

・**画面に書かれている数字だけを読むこと。計算で補ったり、推測で埋めたりしない。**
・**行を取り違えないこと。** 銘柄コードと同じ行にある数字だけを、その銘柄の値として読む。
　 隣の行の数字を混ぜない。1行に収まっていない場合は読み取らず unreadable_fields に入れる。
・**桁を落とさないこと。** カンマ区切りに注意し、31,200 を 3,120 や 312,00 と読まない。
・**マイナス記号を見落とさないこと。** 損失は負の数で返す。
・読み取れなかった項目は unreadable_fields に「銘柄コード:項目名」の形で列挙し、値は 0 にする
　（0 が実際の値なのか読めなかったのかを区別するため）。
・対象4銘柄を1つも持っていなければ positions を空配列にする（他の銘柄があっても空でよい）。
・画面が保有一覧でない（別の画面・チャート等）場合も positions を空にし、note に書く。
・confidence は画面の鮮明さと読み取りの確からしさ（high / medium / low）。
　 少しでも自信が無ければ low にすること。low の場合その日の同期は見送られる。`

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
