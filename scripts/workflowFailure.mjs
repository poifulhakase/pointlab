// データ自動更新ワークフローの失敗を Discord（#エラー・異常）に流すための、通信しない部分。
//
// 🔴 なぜ要るか（2026-09-20）：`fetch-data.yml` の取得系ステップは
//    `continue-on-error: true` が付いていて、**落ちても誰にも知らされない**。
//    データが更新されないと ロボトレード は「7日以上古い」で止まるが、
//    止まった理由がどこにも出ないまま1週間気づけない経路だった。
//    握り潰した例外は静かな故障になるので、最後にまとめて通知する。
//
// 🔴 **skipped を失敗にしない**。土曜だけのステップは平日 `skipped` になるのが正常で、
//    これを失敗として数えると毎日赤が飛んで、本物の故障に気づけなくなる（狼少年）。

/** Discord #エラー・異常 の基調色（DISCORD.md 2章）。 */
export const COLOR_ERROR = 0xe74c3c

/**
 * GitHub Actions の `steps.<id>.outcome` を読んで、失敗したものだけ拾う。
 *
 * @param {Record<string, string>} outcomes {表示名: 'success'|'failure'|'skipped'|'cancelled'|''}
 * @returns {string[]} 失敗したステップの表示名
 */
export function failedSteps(outcomes) {
  return Object.entries(outcomes || {})
    .filter(([, outcome]) => String(outcome || '').trim() === 'failure')
    .map(([name]) => name)
}

/**
 * 通知する中身を組み立てる。失敗が無ければ `null`（＝送らない＝通知の静かさ）。
 *
 * @param {object} p
 * @param {Record<string, string>} p.outcomes ステップごとの outcome
 * @param {string} p.runUrl   実行ページのURL
 * @param {string} p.when     発生時刻（ISO文字列）
 * @returns {{embeds: object[]} | null}
 */
export function buildFailurePayload({ outcomes, runUrl, when }) {
  const failed = failedSteps(outcomes)
  if (failed.length === 0) return null

  // 🔴 鮮度チェックだけの失敗は「データが古い」、取得の失敗は「取りに行けなかった」で
  //    意味が違う。どちらも要対応だが、見出しで区別できるようにする。
  const onlyFreshness = failed.length === 1 && failed[0].includes('鮮度')
  const kind = onlyFreshness ? 'データ' : '取得'
  const title = onlyFreshness
    ? 'データが古い（鮮度チェックが落ちた）'
    : `データ自動更新で ${failed.length}ステップが失敗`

  return {
    embeds: [
      {
        title: `[${kind}] ${title}`,
        color: COLOR_ERROR,
        fields: [
          { name: '発生', value: String(when || ''), inline: true },
          // 🔵 状態は「要対応／自動復帰」のラベルで示す（依頼文は書かない・DISCORD.md 3.4）
          { name: '状態', value: '要対応', inline: true },
          { name: '落ちたステップ', value: failed.map((n) => `・${n}`).join('\n') },
          { name: '実行ログ', value: runUrl || '（URL不明）' },
        ],
        // 🔵 免責は付けない（2026-09-20・運用者の指示「トレードではない通知の場合は不要」）。
        //    ここは装置の稼働状況を伝えるだけで、相場や売買の中身を含まない。
      },
    ],
  }
}

/**
 * `名前=結果` を改行で並べた env 文字列を読む。
 * 🔵 YAML 側で組み立てた値をそのまま渡せるようにするため（シェルの引用を増やさない）。
 */
export function parseOutcomes(text) {
  const out = {}
  for (const line of String(text || '').split('\n')) {
    const i = line.indexOf('=')
    if (i <= 0) continue
    const name = line.slice(0, i).trim()
    if (name) out[name] = line.slice(i + 1).trim()
  }
  return out
}
