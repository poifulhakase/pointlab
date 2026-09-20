// データ自動更新ワークフローの失敗を Discord（#エラー・異常）へ送る。
//
//   node scripts/notify-workflow-failure.mjs
//
// 環境変数:
//   DISCORD_WEBHOOK_ERRORS … #エラー・異常 の Webhook URL（GitHub Secrets）
//   STEP_OUTCOMES          … `名前=結果` を改行で並べたもの（fetch-data.yml が組み立てる）
//   RUN_URL                … 実行ページのURL
//
// 🔴 ここで落ちてもワークフローを失敗させない（通知は落ちてよい）。
//    通知の失敗でデータ更新まで赤くすると、本物の故障と見分けがつかなくなる。
// 🔵 Webhook 未設定の間は黙って何もしない（設定前でもワークフローが壊れない）。

import { buildFailurePayload, parseOutcomes } from './workflowFailure.mjs'

const webhook = (process.env.DISCORD_WEBHOOK_ERRORS || '').trim()
const outcomes = parseOutcomes(process.env.STEP_OUTCOMES)
const payload = buildFailurePayload({
  outcomes,
  runUrl: process.env.RUN_URL || '',
  when: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
})

if (!payload) {
  console.log('落ちたステップなし。通知しない。')
  process.exit(0)
}
if (!webhook) {
  // 🔴 黙って終わらない。「設定していないから飛ばした」とログに残す
  console.log('🔵 DISCORD_WEBHOOK_ERRORS が未設定なので送らない。落ちたステップ:')
  console.log(JSON.stringify(outcomes, null, 1))
  process.exit(0)
}

try {
  // 🔴 `?wait=true` で送る＝返ってくる message_id を実行ログに残すため。
  //    Webhook は**自分の投稿を一覧できない**（読み取り権限が無い）ので、
  //    あとで消したくなったときに id が無いと Discord の画面で手で探すしかない。
  const res = await fetch(`${webhook}?wait=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'ぽいロボ｜異常', ...payload }),
  })
  if (!res.ok) {
    // 🔵 Webhook URL は実質パスワード。失敗しても status だけ出す（URLは出さない）
    console.log(`🔴 Discord への通知に失敗: ${res.status}`)
  } else {
    const sent = await res.json().catch(() => ({}))
    console.log(`Discord へ通知した。message_id=${sent?.id ?? '不明'}`)
  }
} catch (e) {
  console.log(`🔴 Discord への通知でエラー: ${e?.message}`)
}
