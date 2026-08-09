#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────
// ぽいロボ 疑似トレード: 実行本体
//
// 流れ（docs/robo-trade-design.md §3）
//   0. Chatwork から画像を取る（チャート・保有画面）※失敗しても止めない
//   1. 価格・需給を読む
//   2. 決定論ベースライン（対照群）のシグナルを出す ※記録のみ
//   3. 🔴 LLM に判断させる（本番判断）
//   4. 損切り値を決定論の純関数で確定し、口座に反映
//   5. robo_account.json / robo_logs/{date}.json を書く
//   6. Chatwork へ通知（hold の日も毎日）
//
// 使い方:
//   node scripts/robo-trade.mjs            … 本番（書き込み＋通知）
//   node scripts/robo-trade.mjs --dry      … 判断まで行い、書き込みと通知はしない
//   node scripts/robo-trade.mjs --no-llm   … LLM を呼ばず対照群の判断で通す（配線確認用）
// ──────────────────────────────────────────────────────────────────────────

import fs from 'node:fs'
import path from 'node:path'

import { baselineTimeline } from '../src/utils/robotStrategy.mjs'
import { loadPrices, etfFeatures, priceMap, atrMap, summarizeSupply, DATA_DIR } from './roboData.mjs'
import { buildPriceFeatures, buildRoboPrompt } from './roboPrompt.mjs'
import { decide, holdOnFailure, validateDecision, ROBO_MODEL, ROBO_EFFORT } from './llmDecide.mjs'
import {
  emptyAccount, applyDecision, applyStop, equityOf, pushEquity, recomputeStats,
} from './roboAccount.mjs'
import {
  fetchLatestImages, downloadFile, ageInDays, sendMessage, buildNotification,
} from './chatwork.mjs'

const ACCOUNT_PATH = path.join(DATA_DIR, 'robo_account.json')
const LOG_DIR = path.join(DATA_DIR, 'robo_logs')
const REAL_POS_PATH = path.join(DATA_DIR, 'real_position.json')

const args = process.argv.slice(2)
const DRY = args.includes('--dry')
const NO_LLM = args.includes('--no-llm')

const log = (s = '') => console.log(s)

function loadAccount() {
  try {
    if (fs.existsSync(ACCOUNT_PATH)) return JSON.parse(fs.readFileSync(ACCOUNT_PATH, 'utf8'))
  } catch (e) {
    log(`⚠ robo_account.json が読めなかった（${e.message}）→ 新規で始める`)
  }
  return emptyAccount({ decider: { type: 'llm', model: ROBO_MODEL, effort: ROBO_EFFORT } })
}

function saveJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8')
}

/** Chatwork から画像を取る。失敗しても null を返して判断は続ける */
async function loadImages() {
  if (!process.env.CHATWORK_API_TOKEN || !process.env.CHATWORK_ROOM_ID) {
    log('⚠ Chatwork の設定が無い → 画像なしで進む')
    return { chart: null, position: null, warnings: ['Chatwork 未設定のため画像なし'] }
  }
  const warnings = []
  try {
    const { chart, position } = await fetchLatestImages({})
    const out = { chart: null, position: null, warnings }

    if (chart) {
      try {
        out.chart = { ...(await downloadFile(chart.file_id ?? chart.fileId ?? chart.id)), ageDays: ageInDays(chart.upload_time) }
        if (out.chart.ageDays > 0) warnings.push(`チャート画像が${out.chart.ageDays}営業日前のものです`)
      } catch (e) { warnings.push(`チャート画像の取得に失敗: ${e.message}`) }
    } else {
      warnings.push('チャート画像が見つかりませんでした（数値だけで判断しています）')
    }

    if (position) {
      try {
        out.position = { ...(await downloadFile(position.file_id ?? position.fileId ?? position.id)), ageDays: ageInDays(position.upload_time) }
        if (out.position.ageDays > 0) warnings.push(`保有画面のキャプチャが${out.position.ageDays}営業日前のものです`)
      } catch (e) { warnings.push(`保有画面の取得に失敗: ${e.message}`) }
    }
    return out
  } catch (e) {
    log(`⚠ Chatwork から画像を取れなかった（${e.message}）→ 画像なしで進む`)
    return { chart: null, position: null, warnings: [`画像の取得に失敗: ${e.message}`] }
  }
}

async function main() {
  log('=== ぽいロボ 疑似トレード ===')
  if (DRY) log('（--dry: 書き込みと通知はしない）')
  if (NO_LLM) log('（--no-llm: LLM を呼ばず対照群の判断で通す）')

  // ── 1) 価格・需給 ──
  log('[1] 価格を取得...')
  const { nk, etf } = await loadPrices()
  const last = nk[nk.length - 1]
  const date = last.date
  log(`  日経225 ${date} 終値 ${Math.round(last.close).toLocaleString()}円`)
  for (const [code, v] of Object.entries(etf)) {
    if (!v.rows) log(`  ⚠ ${code} ${v.name}: 取得失敗（${v.error}）`)
  }

  const supply = summarizeSupply()
  const vix = supply.vix ?? null
  log(`[2] 需給を要約（${Object.keys(supply).length}項目・VIX ${vix ?? '不明'}）`)

  // ── 3) 対照群 ──
  const timeline = baselineTimeline(nk)
  const baseline = timeline[timeline.length - 1]
  log(`[3] 対照群: ${baseline.side ?? 'ノーポジ'}（${baseline.reason}）`)

  // ── 4) 画像 ──
  log('[4] Chatwork から画像を取得...')
  const images = await loadImages()
  log(`  チャート: ${images.chart ? `${images.chart.filename}（${images.chart.ageDays}日前）` : 'なし'}`)
  log(`  保有画面: ${images.position ? `${images.position.filename}（${images.position.ageDays}日前）` : 'なし'}`)

  // ── 5) 口座 ──
  let account = loadAccount()
  const prices = priceMap(etf)
  const atrs = atrMap(etf)
  const priceOf = (s) => prices[s] ?? null
  const atrOf = (s) => atrs[s] ?? null

  // 損切りの確認を先に行う
  const stopped = applyStop({ account, priceOf, date, execDate: date })
  account = stopped.account
  if (stopped.hit) log('[5] 🔴 損切りに触れたため決済した')

  const realPosition = (() => {
    try { return fs.existsSync(REAL_POS_PATH) ? JSON.parse(fs.readFileSync(REAL_POS_PATH, 'utf8')) : null } catch { return null }
  })()

  // ── 6) 判断 ──
  const prompt = buildRoboPrompt({
    priceFeatures: buildPriceFeatures(nk),
    etfFeatures: etfFeatures(etf),
    supply,
    baseline,
    account: { ...account, equity: equityOf(account, priceOf) },
    realPosition,
    images: {
      hasChart: !!images.chart, chartAgeDays: images.chart?.ageDays ?? null,
      hasPosition: !!images.position,
    },
  })

  let decision, llmResult = null
  if (NO_LLM) {
    decision = baseline.side
      ? { action: 'open', symbol: baseline.side === 'bull' ? '1570' : '1357', qty: 999, confidence_pct: 50, reason: `[--no-llm] 対照群: ${baseline.reason}`, counter: '—', user_note: '' }
      : holdOnFailure('--no-llm')
    log('[6] LLM を呼ばずに対照群の判断を使った')
  } else {
    log(`[6] LLM に判断させる（${ROBO_MODEL} / effort=${ROBO_EFFORT}）...`)
    const imgs = []
    if (images.chart) imgs.push({ base64: images.chart.base64, mediaType: images.chart.mediaType })
    if (images.position) imgs.push({ base64: images.position.base64, mediaType: images.position.mediaType })

    llmResult = await decide({ prompt, images: imgs })
    if (!llmResult.ok) {
      const why = llmResult.refusal ? `拒否（${llmResult.refusal.category ?? '理由不明'}）` : (llmResult.error ?? '不明')
      log(`  🔴 判断を取得できなかった: ${why}`)
      images.warnings.push(`LLM の判断を取得できませんでした（${why}）。本日は見送りとして記録しています。`)
      decision = holdOnFailure(why)
    } else {
      decision = llmResult.decision
      log(`  → ${decision.action} ${decision.symbol} ${decision.qty}口 確信度${decision.confidence_pct}%`)
    }
  }

  // 意味の整合チェック
  const v = validateDecision(decision)
  if (!v.valid) {
    log(`  ⚠ 判断を補正: ${v.issues.join(' / ')}`)
    for (const i of v.issues) images.warnings.push(`判断の補正: ${i}`)
  }
  decision = v.normalized ?? decision

  // ── 7) 口座に反映 ──
  const applied = applyDecision({ account, decision, priceOf, atrOf, vix, date, execDate: date })
  account = applied.account
  log(`[7] 口座への反映: ${applied.actions.join(', ')}`)

  account = pushEquity(account, date, equityOf(account, priceOf))
  account = recomputeStats(account)
  account.generated_at = new Date().toISOString()
  account.decider = { type: NO_LLM ? 'baseline' : 'llm', model: ROBO_MODEL, effort: ROBO_EFFORT }

  // ── 8) 保存 ──
  if (DRY) {
    log('[8] --dry のため書き込みなし')
  } else {
    saveJson(ACCOUNT_PATH, account)
    saveJson(path.join(LOG_DIR, `${date}.json`), {
      date,
      model: ROBO_MODEL,
      effort: ROBO_EFFORT,
      input: { prompt, supply, baseline, images: { chart: images.chart?.filename ?? null, position: images.position?.filename ?? null } },
      output: decision,
      validation: v.issues,
      raw_stop_reason: llmResult?.raw?.stop_reason ?? null,
      usage: llmResult?.usage ?? null,
    })
    log(`[8] 保存: robo_account.json / robo_logs/${date}.json`)
  }

  // ── 9) 通知 ──
  const message = buildNotification({
    date,
    decision,
    execPrice: decision.symbol !== 'none' ? priceOf(decision.symbol) : null,
    account: { ...account, equity: equityOf(account, priceOf) },
    baseline,
    stats: account.stats,
    warnings: images.warnings,
  })
  await sendMessage(message, { dryRun: DRY })
  log(DRY ? '[9] --dry のため通知なし（内容は上に表示）' : '[9] Chatwork へ通知した')

  log('=== 完了 ===')
}

main().catch(e => { console.error(e); process.exit(1) })
