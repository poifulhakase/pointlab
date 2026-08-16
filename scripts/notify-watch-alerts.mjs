#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────
// Believe / 監視銘柄の「色が付いた・外れた」をChatworkに知らせる。
//
// 🔴 **知らせるだけ**。銘柄の採否も枠の入れ替えも自動ではやらない
//    （AIに勝手にステータスを変えさせない、という約束どおり）。
// 🔴 **変化があった日だけ送る**。毎日同じ内容を送ると読まなくなる。
//
// 見ているのは2つ。
//   ① 200日線付近（±5%以内）… 購入時に考えることの2つ目
//   ② サポート圏（レンジ下限から+10%以内）… レンジ銘柄の買い検討ライン
//
// 使い方:
//   node scripts/notify-watch-alerts.mjs          … 変化があれば送る
//   node scripts/notify-watch-alerts.mjs --dry    … 送らずに内容を出す
// ──────────────────────────────────────────────────────────────────────────

import fs from 'node:fs'
import path from 'node:path'

import { sendMessage } from './chatwork.mjs'

const DATA_DIR = path.resolve(process.cwd(), 'public/data')
const SRC = path.join(DATA_DIR, 'poirobo_stocks.json')
const STATE = path.join(DATA_DIR, 'poirobo_watch_state.json')

const DRY = process.argv.includes('--dry')

/** 200日線付近とみなす幅（%）。🔴 先に決めた値。当たるように後から動かさない */
const NEAR_MA200 = 5
/** レンジ銘柄のサポート圏（レンジ下限から何%以内か）。🔴 15年安値ではなく実測の下限で見る */
const NEAR_FLOOR = 10

const readJson = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null)

function currentFlags(data) {
  /** @type {Record<string, {name:string, kind:string, note:string}>} */
  const on = {}

  // 枠（Believe の5銘柄）と監視銘柄＝200日線付近
  const both = [...(data.stocks ?? []), ...(data.watch ?? [])]
  for (const s of both) {
    const dev = s.dev200_pct
    if (dev == null) continue
    if (Math.abs(dev) <= NEAR_MA200) {
      on[`ma200:${s.code}`] = {
        name: `${s.code} ${s.name}`,
        kind: '200日線付近',
        note: `200日線から ${dev > 0 ? '+' : ''}${dev}%（株価 ${s.close?.toLocaleString?.() ?? s.close}）`,
      }
    }
  }

  // レンジ銘柄＝レンジ下限（直近5年で何度も止まっている帯）からの距離
  for (const r of data.ranges ?? []) {
    if (r.from_floor_pct == null) continue
    if (r.from_floor_pct <= NEAR_FLOOR) {
      on[`floor:${r.code}`] = {
        name: `${r.code} ${r.name}`,
        kind: 'サポート圏',
        note: `レンジ下限 ${r.floor} から +${r.from_floor_pct}%（5年で${r.floor_touches}回止まった水準・株価 ${r.close}）`,
      }
    }
  }
  return on
}

async function main() {
  const data = readJson(SRC)
  if (!data) { console.log('poirobo_stocks.json が無い → 何もしない'); return }

  const now = currentFlags(data)
  const prev = readJson(STATE)?.on ?? {}

  const entered = Object.keys(now).filter(k => !(k in prev))
  const left = Object.keys(prev).filter(k => !(k in now))

  console.log(`いま色が付いている: ${Object.keys(now).length}件 ／ 新しく付いた: ${entered.length} ／ 外れた: ${left.length}`)

  if (!entered.length && !left.length) {
    console.log('変化なし → 送らない')
    if (!DRY) fs.writeFileSync(STATE, JSON.stringify({ updatedAt: new Date().toISOString(), on: now }, null, 2) + '\n', 'utf8')
    return
  }

  const lines = ['[info][title]ぽいロボ 監視銘柄のお知らせ[/title]']
  if (entered.length) {
    lines.push('▼ 色が付きました')
    for (const k of entered) lines.push(`・${now[k].name}（${now[k].kind}）… ${now[k].note}`)
  }
  if (left.length) {
    if (entered.length) lines.push('')
    lines.push('▼ 外れました')
    for (const k of left) lines.push(`・${prev[k].name}（${prev[k].kind}）`)
  }
  lines.push('')
  lines.push('🔵 知らせるだけです。売買の判断はご自身で。')
  lines.push('[/info]')

  const message = lines.join('\n')
  await sendMessage(message, { dryRun: DRY })
  console.log(DRY ? '（--dry のため送っていない）' : '送信した')

  if (!DRY) {
    fs.writeFileSync(STATE, JSON.stringify({ updatedAt: new Date().toISOString(), on: now }, null, 2) + '\n', 'utf8')
    console.log(`状態を保存: ${path.relative(process.cwd(), STATE)}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
