#!/usr/bin/env node
/**
 * 🏠 物件探しを「Claude Code を立ち上げたとき」に1日1回だけ自動で走らせる（2026-11-07 運用者）。
 *
 *   node scripts/property-auto.mjs          … SessionStart フックから呼ぶ。今日まだなら裏で --run を起動してすぐ戻る
 *   node scripts/property-auto.mjs --run    … 裏で動く本体。claude -p で docs/property-search.md の手順を実行
 *   node scripts/property-auto.mjs --status … 状態を見る
 *
 * 🔴 クラウドの定期実行・タスクスケジューラには載せない（運用者の指示）。起動していないと走らない。
 * 🔴 1日1回（日本時間の暦の日）。物件は2件まで（サーバー側でも1日2件）。
 * 🔵 状態は `.property-auto.json`（コミットしない）、ログは `.property-auto.log`。
 * 🔵 失敗したら「今日済み」にしない＝次に立ち上げたときにもう一度走る。
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, appendFileSync, openSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const STATE = resolve(ROOT, '.property-auto.json')
const LOG = resolve(ROOT, '.property-auto.log')
const RUN_TIMEOUT_MS = 40 * 60 * 1000 // 本体の上限（これを超えた「実行中」は止まったものとみなす）

const jstDay = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
const load = () => { try { return JSON.parse(readFileSync(STATE, 'utf8')) } catch { return {} } }
const save = s => writeFileSync(STATE, JSON.stringify(s, null, 2) + '\n')
const log = m => appendFileSync(LOG, `[${new Date().toISOString()}] ${m}\n`)

const PROMPT = `ぽいロボの🏠物件探しを、運用者が立ち上げ時に自動で頼んだ分として1回だけ実施する（運用者は見ていない）。
手順と条件の正は docs/property-search.md。必ず全部読んでから始める。
- 条件（2〜3階建・徒歩13分以内・築浅・三軒茶屋まで電車40分以内（乗り換え込み・池袋の条件は無い）・家賃20万以下（管理費込）・2SLDK以上）をすべて満たす物件だけ。60㎡以上・郊外中心・㎡単価の安い順で選ぶ。
- 「検索ワードの記録」と「次に探すときのメモ」を見て、前回と違う探し方をする。送った物件・外した物件は送らない。
- 詳細ページで募集中か、定期借家の期限（1年未満は外す）を確かめる。
- 最大2件。条件に合うものが無ければ送らなくてよい（無理に埋めない）。
- 物件JSONは scratch 用に .property-auto-today.json へ書き、node scripts/notify-property.mjs .property-auto-today.json で本文を確かめてから --send で送る。
- 429（1日の上限）なら今日は送らずに終える。上限のリセットはしない。
- 終わったら docs/property-search.md の「検索ワードの記録」に1行足し、残り候補を「次に探すときのメモ」に書き、そのファイルだけを git commit して push（コミットメッセージは docs(talk): で始める）。他のファイルには触らない。
- 最後に、送った物件（または送らなかった理由）を1〜3行で出力する。`

const args = process.argv.slice(2)

if (args.includes('--status')) {
  console.log(JSON.stringify({ today: jstDay(), ...load() }, null, 2))
  process.exit(0)
}

if (args.includes('--run')) {
  const s = load()
  log('開始')
  // 🔴 指示文は標準入力で渡す（Windows は shell 経由＝引数に入れると改行・括弧で壊れる）
  const r = spawnSync('claude', ['-p', '--permission-mode', 'bypassPermissions'], {
    cwd: ROOT,
    input: process.env.PROPERTY_AUTO_TEST ? 'OKとだけ答えて' : PROMPT, // TEST=配線の確認用（探さない）
    env: { ...process.env, POIROBO_PROPERTY_CHILD: '1' },
    encoding: 'utf8',
    shell: process.platform === 'win32', // claude は npm の .cmd
    timeout: RUN_TIMEOUT_MS,
    maxBuffer: 16 * 1024 * 1024,
  })
  log(`終了 code=${r.status}${r.error ? ` error=${r.error.message}` : ''}\n${(r.stdout || '').trim()}\n${(r.stderr || '').trim()}`)
  const next = { ...load(), running: null }
  if (r.status === 0) { next.lastRun = s.running?.day || jstDay(); next.lastResult = (r.stdout || '').trim().slice(-500) }
  else next.lastError = `${jstDay()} code=${r.status}`
  save(next)
  process.exit(0)
}

// ── SessionStart フック ──
// 自分が起動した claude -p の中ではもう一度走らせない
if (process.env.POIROBO_PROPERTY_CHILD) process.exit(0)
const s = load()
const today = jstDay()
if (s.lastRun === today) process.exit(0)
if (s.running && Date.now() - s.running.at < RUN_TIMEOUT_MS + 5 * 60 * 1000) process.exit(0)
if (!existsSync(resolve(ROOT, 'docs/property-search.md'))) process.exit(0)

save({ ...s, running: { day: today, at: Date.now() } })
const out = openSync(LOG, 'a')
const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--run'], {
  cwd: ROOT, detached: true, stdio: ['ignore', out, out], windowsHide: true,
})
child.unref()
console.log(JSON.stringify({ systemMessage: '🏠 今日の物件探しを裏で始めました（ぽいロボ・最大2件）' }))
