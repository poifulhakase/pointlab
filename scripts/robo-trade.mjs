#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────
// ぽいロボ 疑似トレード: 実行本体
//
// 流れ（docs/robo-trade-design.md §3）
//   0. 東証の営業日か確認する（休場なら何もしない）
//   0b. Chatwork から画像を取る（チャート・保有画面）※失敗しても止めない
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
//   node scripts/robo-trade.mjs --force    … 休場日でも走らせる（配線確認用・本番では付けない）
// ──────────────────────────────────────────────────────────────────────────

import fs from 'node:fs'
import path from 'node:path'

import { loadLocalEnv } from './loadLocalEnv.mjs'
import { baselineTimeline } from '../src/utils/robotStrategy.mjs'
import { loadPrices, etfFeatures, priceMap, atrMap, rowsMap, summarizeSupply, DATA_DIR } from './roboData.mjs'
import { buildPriceFeatures, buildRoboPrompt } from './roboPrompt.mjs'
import { decide, holdOnFailure, validateDecision, ROBO_MODEL, ROBO_EFFORT } from './llmDecide.mjs'
import {
  emptyAccount, applyDecision, applyStop, applyTrail, equityOf, pushEquity, recomputeStats, syncWithReal,
} from './roboAccount.mjs'
import {
  fetchLatestImages, downloadFile, ageInDays, sendMessage, buildNotification,
} from './chatwork.mjs'
import { readPositionImage, toRealPosition, checkRealPosition } from './readPosition.mjs'
import { validateRealPosition } from './roboAccount.mjs'
import { marketStatus, upcomingEventsText, eventNear, todayJst } from './roboCalendar.mjs'

// ローカルで試すとき用に `.env.local` を読む（Actions では無いので何も起きない）。
// 🔵 Anthropic / Chatwork のクライアントは呼び出し時に process.env を見るので、ここで間に合う。
const LOCAL_ENV_KEYS = loadLocalEnv()

const ACCOUNT_PATH = path.join(DATA_DIR, 'robo_account.json')
const LOG_DIR = path.join(DATA_DIR, 'robo_logs')
const REAL_POS_PATH = path.join(DATA_DIR, 'real_position.json')

const args = process.argv.slice(2)
const DRY = args.includes('--dry')
const NO_LLM = args.includes('--no-llm')
// 🔴 休場日でも強制的に走らせる（配線確認用）。本番では付けない
const FORCE = args.includes('--force')

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
  // 🔵 読み込んだ「キー名」だけ出す。値は絶対に出さない（作業ログに残るため）
  if (LOCAL_ENV_KEYS.length) log(`（.env.local から読み込み: ${LOCAL_ENV_KEYS.join(', ')}）`)

  // ── 0) 営業日かどうか ──
  // 🔴 東証が閉まっている日は、判断も口座の更新も通知もしない。
  //    休場日に「本日はhold」と通知が来ると、判断した日と何もしなかった日が
  //    区別できなくなり、成績の分母が壊れる。
  const market = marketStatus(todayJst())
  if (!market.open && !FORCE) {
    log(`[0] ${market.date} は東証が休場（${market.reason}）→ 何もしない`)
    log('=== 完了（休場） ===')
    return
  }
  if (!market.open && FORCE) log(`[0] ⚠ ${market.date} は休場（${market.reason}）だが --force のため続行`)
  else log(`[0] ${market.date} は営業日`)

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
  const rowsByCode = rowsMap(etf)
  const priceOf = (s) => prices[s] ?? null
  const atrOf = (s) => atrs[s] ?? null
  const rowsOf = (s) => rowsByCode[s] ?? null

  // 🔴 ATR は過去の値幅なので、イベント前は**まだ広がっていない**。
  //    FOMC・日銀・米CPI・雇用統計・SQ が2営業日内にある日は損切りを少し広げる。
  const nearEvent = await eventNear()
  if (nearEvent) log('[5] 🔵 2営業日内に大きなイベントあり → 損切りを広めに取る')

  // 損切りの確認を先に行う
  const stopped = applyStop({ account, priceOf, date, execDate: date })
  account = stopped.account
  if (stopped.hit) log('[5] 🔴 損切りに触れたため決済した')

  // 損切りを引き上げる（トレーリング）。
  // 🔴 **確認の後**に行う。今日引き上げた線が効くのは明日から。
  // 🔵 利確はしない。利が乗ったぶんだけ「負けない位置」へ線を寄せるだけ。
  const trailed = applyTrail({ account, priceOf, atrOf, rowsOf, vix, eventNear: nearEvent })
  account = trailed.account
  if (trailed.raised) log(`[5] 🔵 損切りを引き上げた（${trailed.from ?? '—'} → ${trailed.to}）`)

  // ── 5b) 実保有の読み取り ──
  // 🔴 ロボ口座とは別ファイル。同期させると AI の成績と人の介入が分離できなくなる。
  let realPosition = (() => {
    try { return fs.existsSync(REAL_POS_PATH) ? JSON.parse(fs.readFileSync(REAL_POS_PATH, 'utf8')) : null } catch { return null }
  })()

  // 🔴 キャプチャは「売買した日だけ」投稿される運用（ユーザー決定・2026-08-09）。
  //    そのため Chatwork の直近画像は、売買していない日には前回の画像が残っている。
  //    同じ画像で二度同期すると口座が壊れるので、file_id で必ず弾く。
  const posFileId = images.position ? String(images.position.fileId) : null
  const alreadySynced = posFileId != null && String(account.last_synced_file_id ?? '') === posFileId
  let syncDiff = null

  if (images.position && !NO_LLM && !alreadySynced) {
    log('[5b] 保有画面を読み取る...')
    try {
      const r = await readPositionImage({ base64: images.position.base64, mediaType: images.position.mediaType })
      if (r.ok) {
        realPosition = toRealPosition({
          result: r.result,
          uploadTime: images.position.uploadTime,
          filename: images.position.filename,
          ageDays: images.position.ageDays,
        })
        log(`  → ${realPosition.positions.length}件（確度 ${realPosition.confidence}）`)
        images.warnings.push(...checkRealPosition(realPosition))
        if (!DRY) saveJson(REAL_POS_PATH, realPosition)

        // 🔴 ロボ口座を実保有に合わせる（ユーザー決定）。差分は divergences に残す。
        // 🔴 AI の自己申告（confidence）だけに頼らず、実際の価格と突き合わせて桁誤りを弾く
        const issues = validateRealPosition({ positions: realPosition.positions, priceOf, cash: account.initial_cash })
        if (issues.length) {
          log(`  🔴 読み取りが価格と合わない → 同期しない: ${issues.join(' / ')}`)
          images.warnings.push(...issues.map(i => `保有画面の読み取りに疑いあり（同期は見送り）: ${i}`))
        } else if (realPosition.confidence === 'low') {
          log('  ⚠ 読み取りの確度が低いため同期しない（誤った残高で上書きしないため）')
          images.warnings.push('読み取りの確度が低かったため、口座の同期は見送りました')
        } else {
          const sync = syncWithReal({ account, realPosition, priceOf, date, sourceFileId: posFileId })
          account = sync.account
          syncDiff = sync.diff
          log(`  ${sync.diff.matched ? '同期' : '🔴 同期'}: ${sync.diff.note}`)
        }
      } else {
        log(`  ⚠ 読み取り失敗: ${r.error}`)
        images.warnings.push(`保有画面の読み取りに失敗しました（${r.error}）`)
      }
    } catch (e) {
      log(`  ⚠ 読み取りで例外: ${e.message}`)
      images.warnings.push(`保有画面の読み取りで問題が起きました（${e.message}）`)
    }
  } else if (alreadySynced) {
    log('[5b] 保有画面は前回と同じ画像 → 同期しない（売買が無かった日）')
  }

  // ── 6) 判断 ──
  // イベント（FOMC・日銀・CPI…）を渡す。取れなくても止めない
  const events = await upcomingEventsText(todayJst(), 5)
  if (events) log(`[5c] 今後5営業日のイベントを添付\n${events}`)
  else images.warnings.push('イベントカレンダーを読めませんでした（イベント無しで判断しています）')

  const prompt = buildRoboPrompt({
    priceFeatures: buildPriceFeatures(nk),
    etfFeatures: etfFeatures(etf),
    supply,
    baseline,
    events,
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
  const applied = applyDecision({ account, decision, priceOf, atrOf, rowsOf, vix, eventNear: nearEvent, date, execDate: date })
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
    syncDiff,
    warnings: images.warnings,
  })
  await sendMessage(message, { dryRun: DRY })
  log(DRY ? '[9] --dry のため通知なし（内容は上に表示）' : '[9] Chatwork へ通知した')

  log('=== 完了 ===')
}

main().catch(e => { console.error(e); process.exit(1) })
