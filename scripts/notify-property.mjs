#!/usr/bin/env node
/**
 * 見つけた物件をトークの🏠に保存し、LINEグループ（ひろ・なみ）へ知らせる（2026-11-03）。
 *
 *   node scripts/notify-property.mjs <物件.json>            … 重複を確かめて、送る本文を出すだけ（送らない）
 *   node scripts/notify-property.mjs <物件.json> --send     … 本当に保存＋通知する
 *   node scripts/notify-property.mjs <物件.json> --send --silent … 保存だけ（LINEに送らない）
 *
 * 物件.json は1件のオブジェクトか配列：
 *   { "title": "〇〇マンション 302", "url": "https://...", "price": "12.5万円（管理費込）",
 *     "layout": "2LDK・55㎡", "access": "〇〇駅 徒歩7分", "address": "", "memo": "条件に合う理由", "query": "検索ワード" }
 *
 * 🔵 叩く先は本番の `/api/talk?a=property`（LINE の鍵は Vercel にしか無い）。
 * 🔵 部屋IDは `firestore.rules` の `inTalkRoom` から読む（書き写さない）。
 * 🔴 LINE の無料枠は月200通（1件＝2人で2通）。サーバー側でも1日10件まで。
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.env.TALK_BASE_URL || 'https://pointlab.vercel.app'

const args = process.argv.slice(2)
const file = args.find(a => !a.startsWith('--'))
const send = args.includes('--send')
const silent = args.includes('--silent')
if (!file) {
  console.error('使い方: node scripts/notify-property.mjs <物件.json> [--send] [--silent]')
  process.exit(1)
}

const rules = readFileSync(resolve(ROOT, 'firestore.rules'), 'utf8')
const room = process.env.TALK_ROOM_ID || rules.match(/roomId == '([0-9a-f]{32})'/)?.[1]
if (!room) { console.error('部屋IDが見つかりません（firestore.rules の inTalkRoom）'); process.exit(1) }

const raw = JSON.parse(readFileSync(resolve(file), 'utf8'))
const list = Array.isArray(raw) ? raw : [raw]

let failed = 0
for (const property of list) {
  const r = await fetch(`${BASE}/api/talk?a=property`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room, property, dryRun: !send, silent }),
  })
  const j = await r.json().catch(() => ({}))
  const name = property?.title ?? '(名前なし)'
  if (!r.ok) { failed++; console.log(`✗ ${name}: ${r.status} ${j.error ?? ''}`); continue }
  if (j.dup) { console.log(`- ${name}: 通知済み（${j.by === 'name' ? '物件名＋間取りが同じ' : '同じURL'}・飛ばした）`); continue }
  if (!send) { console.log(`○ ${name}: 未通知（--send で送る）\n${j.text}\n`); continue }
  console.log(`✓ ${name}: 保存${j.notified ? '＋LINE通知' : (silent ? '（通知なし）' : '・LINEは送れず')}`)
}
process.exit(failed ? 1 : 0)
