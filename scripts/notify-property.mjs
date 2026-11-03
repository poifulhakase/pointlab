#!/usr/bin/env node
/**
 * 見つけた物件をトークの🏠に保存し、LINEグループ（ひろ・なみ）へ知らせる（2026-11-03）。
 *
 *   node scripts/notify-property.mjs <物件.json>            … 重複を確かめて、送る本文を出すだけ（送らない）
 *   node scripts/notify-property.mjs <物件.json> --send     … 本当に保存＋通知する
 *   node scripts/notify-property.mjs <物件.json> --send --silent … 保存だけ（LINEに送らない）
 *
 * 物件.json は1件のオブジェクトか配列（その日の1〜2件をまとめる。address は地図リンクに使う）：
 *   { "title": "〇〇マンション 302", "url": "https://...", "price": "12.5万円（管理費込）",
 *     "layout": "2LDK・55㎡", "access": "〇〇駅 徒歩7分", "address": "", "memo": "条件に合う理由", "query": "検索ワード" }
 *
 * 🔵 叩く先は本番の `/api/talk?a=property`（LINE の鍵は Vercel にしか無い）。
 * 🔵 部屋IDは `firestore.rules` の `inTalkRoom` から読む（書き写さない）。
 * 🔴 LINE の無料枠は月200通（1件＝2人で2通）。サーバー側でも1日2件まで。
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

// 🔵 その日の物件はまとめて1回で送る＝LINE には「本日の物件紹介」1通で届く
const r = await fetch(`${BASE}/api/talk?a=property`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ room, properties: list, dryRun: !send, silent }),
})
const j = await r.json().catch(() => ({}))
for (const x of j.results ?? []) {
  console.log(x.dup ? `- ${x.title}: 通知済み（${x.by === 'name' ? '物件名＋間取りが同じ' : '同じURL'}・飛ばした）` : `○ ${x.title}`)
}
if (!r.ok) {
  console.log(`✗ ${r.status} ${j.error ?? ''}`)
  process.exitCode = 1
} else if (!send) {
  console.log(j.text ? `\n--- 送る本文（--send で送る）---\n${j.text}` : '\n新しい物件はありません')
} else {
  console.log(j.notified ? '✓ 保存＋LINEに「本日の物件紹介」を送った' : (silent ? '✓ 保存だけ（通知なし）' : '△ 保存した・LINEは送れず（または新しい物件なし）'))
}
