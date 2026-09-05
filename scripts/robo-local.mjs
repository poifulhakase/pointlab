#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────
// ぽいロボ 疑似トレード: このPCから 15:00 の判断を走らせる（タスクスケジューラ用）
//
// なぜローカルで動かすか（2026-08-31）:
//   判断の起動を GitHub Actions の cron（`0 4 * * 1-5`）に任せていたが、実測で
//     8/24〜8/26 … 15:00 ちょうど（正常）
//     8/27       … 23:51（約9時間遅れ）＝発注期限を過ぎ、注文を積めない日になった
//     8/28・8/31 … そもそも起動せず（通知なし）
//   となり、運用の約束（15:00 の通知を見て 15:25 までに引成で発注）が成立しなくなった。
//   チャート撮影（`poirobo-capture-chart`）は同じタスクスケジューラで遅延ゼロなので、
//   判断もそちらへ寄せる。GitHub 側は**保険として残す**。
//
// 二重に判断されない理由:
//   `robo-trade.mjs` は「その日のログが既にあれば何もしない」（2026-08-17 の二重実行防止）。
//   そのため、ここで記録を push しておけば、あとから Actions が遅れて起動しても素通りする。
//   🔴 **push まで含めて1つの仕事**。押し出さないと Actions 側は「まだ判断していない」と見える。
//
// 使い方:
//   node scripts/robo-local.mjs                 … 本番（判断＋通知＋記録の push）
//   node scripts/robo-local.mjs --dry --no-llm  … 配線確認（書き込み・通知・課金なし）
//   引数はそのまま robo-trade.mjs へ渡る。
// ──────────────────────────────────────────────────────────────────────────

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 記録として push する対象。🔴 手元の作りかけ（src/ など）は絶対に巻き込まない。 */
const RECORD_PATHS = [
  'public/data/robo_account.json',
  'public/data/robo_logs',
  'public/data/robo_calibration.json',
]

const log = (s = '') => console.log(s)

/** コマンドを1本流す。戻りは終了コードと標準出力（git の判定に使う）。 */
// 🔴 Windows で shell:true にすると、引数がクォートされずに繋がれる＝**空白で割れる**。
//    コミットメッセージ（空白入り）が pathspec 扱いになり、2026-09-02〜04 の記録が
//    3日ぶんコミットされず、Actions 側から「未判断」に見えて二重判断になった。
//    shell が要るのは npm（npm.cmd の解決）だけなので、git は shell 無しで回す。
function run(cmd, args, { quiet = false } = {}) {
  const shell = process.platform === 'win32' && cmd !== 'git'
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', shell })
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trimEnd()
  if (!quiet && out) log(out)
  return { code: r.status ?? 1, out }
}

log(`==================== ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} ====================`)

// 1) 先に本番の記録を取り込む（CI が 19:30 / 21:30 にデータを更新している）。
//    🔵 失敗しても判断は続ける＝**通知を止めない方を優先する**。
const pull = run('git', ['pull', '--ff-only'])
if (pull.code !== 0) log('[warn] git pull に失敗。作業ツリーの状態を確認してください（判断は続行します）')

// 2) 判断（本体）。ここが本番。
const passthrough = process.argv.slice(2)
const trade = run('npm', ['run', 'robo-trade', '--', ...passthrough])

// 3) 記録を push する。ここまでやって初めて Actions 側の二重実行が止まる。
run('git', ['add', ...RECORD_PATHS])
const staged = run('git', ['diff', '--cached', '--quiet'], { quiet: true })
if (staged.code === 0) {
  log('記録の変更なし（--dry か、すでに判断済み）')
} else {
  const commit = run('git', ['commit', '-m', 'chore(robo): 判断を記録（ローカル15:00）'])
  if (commit.code !== 0) {
    log('[warn] commit に失敗。記録は手元に残っている（次回の実行で載る）')
  } else {
    let push = run('git', ['push', 'origin', 'main'])
    if (push.code !== 0) {
      // 先に CI のデータ更新が入っていると push は弾かれる。記録だけを上に載せ直して再送する。
      // 🔴 ここで諦めると、記録が手元に取り残されたまま Actions が二度目の判断をする。
      log('[warn] push が弾かれた → rebase して再送する')
      const rebase = run('git', ['pull', '--rebase', 'origin', 'main'])
      if (rebase.code === 0) push = run('git', ['push', 'origin', 'main'])
    }
    if (push.code !== 0) log('[warn] push に失敗。🔴 記録が本番に載っていない＝Actions が二重判断する')
  }
}

log(`---- 判断の終了コード ${trade.code} ----`)
process.exit(trade.code)
