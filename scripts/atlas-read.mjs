#!/usr/bin/env node
// 波動の書を渡して、チャート画像から型を読み取らせる（2026-08-13）
//
// 🔴 **これは判断に混ぜない。影で走らせて記録するだけ。**
//    型を判断材料に足したら成績が悪くなる可能性が普通にある（ユーザー指摘）。
//    良くなるか悪くなるかは、記録を貯めて測ってから決める。
//    🔵 貯めた結果が良ければ、そのとき初めて判断側（robo-trade.mjs）に入れて正とする。
//
// 🔵 測るものは2つに分かれる。ここを混ぜないこと。
//    ① **読み取りの正しさ** … AIが挙げた型が本当にそこに在るか（`atlas-detect.mjs` の機械判定と突き合わせる）
//    ② **型の効き** … その型が出た後、相場が動いたか（地下室で測る）
//    ①が悪ければプロンプトの問題、②が悪ければ型そのものの問題。切り分けられるのが利点。
//
// 使い方:
//   node scripts/export-atlas.mjs                       … カタログを書き出す（先に1回）
//   node scripts/atlas-read.mjs --image .captures/chart_D_2026-08-13.png
//   node scripts/atlas-read.mjs --image ... --out data/atlas/reads/2026-08-13.json

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, extname } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { loadLocalEnv } from './loadLocalEnv.mjs'

loadLocalEnv()

const args = process.argv.slice(2)
const arg = (name, fallback = null) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : fallback
}

const IMAGE = arg('--image')
const OUT = arg('--out')
const CATALOG = arg('--catalog', 'data/atlas/catalog.json')
const MODEL = process.env.ATLAS_MODEL ?? 'claude-opus-5'
const TIMEFRAME = arg('--timeframe', '日足')

if (!IMAGE) {
  console.error('--image <チャート画像> を指定してください')
  process.exit(1)
}
if (!existsSync(CATALOG)) {
  console.error(`${CATALOG} がありません。先に node scripts/export-atlas.mjs を実行してください`)
  process.exit(1)
}

const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'))

// 🔴 カタログはそのまま貼らず、**AIが選ぶための最小限**に削る。
//    説明を全部入れると、読み取りではなく解説を書き始める。
const list = catalog.entries
  .map(e => `- [${e.id}] ${e.name}（${e.maki}）：${e.meaning} 見つけ方＝${e.howToFind}`)
  .join('\n')

const SYSTEM = `あなたはチャートの「形」だけを読む観測者です。売買の助言はしません。
渡された図鑑（波動の書）に載っている型だけを使い、画像の中に**実際に見えるもの**を挙げてください。

厳守すること:
- 図鑑に無い名前を作らない。挙げるのは id と name のみ。
- **何も無ければ空の配列を返す**。無理に見つけない。図鑑を渡されると何かを見つけたくなるが、それをしない。
- 価格の細かい数値は読まない（画像から正確には読めない）。位置は「直近◯本目あたり」で表す。
- 出来高が描かれていない画像では、巻四（出来高の型）を挙げない。
- 確からしさ（confidence）は 0〜1。**目視で言い切れるものだけ 0.7 以上**にする。`

const USER_TEXT = `これは日経225先物の${TIMEFRAME}チャートです。上が値動き、下の棒が出来高（無い場合もあります）。

図鑑（このリストの中からのみ選ぶこと）:
${list}

次のJSONだけを返してください（前後に文章を付けない）:
{
  "found": [
    { "id": "...", "name": "...", "where": "直近◯本目あたり", "confidence": 0.0, "why": "画像のどこを見てそう言えるか（1文）" }
  ],
  "overall": "全体の形を1文で（型の名前を使わずに書く）"
}`

const mime = extname(IMAGE).toLowerCase() === '.jpg' || extname(IMAGE).toLowerCase() === '.jpeg'
  ? 'image/jpeg' : 'image/png'

const anthropic = new Anthropic()   // ANTHROPIC_API_KEY を環境から読む

const res = await anthropic.messages.create({
  model: MODEL,
  max_tokens: 2000,
  system: SYSTEM,
  messages: [{
    role: 'user',
    content: [
      { type: 'image', source: { type: 'base64', media_type: mime, data: readFileSync(IMAGE).toString('base64') } },
      { type: 'text', text: USER_TEXT },
    ],
  }],
})

const text = res.content.filter(c => c.type === 'text').map(c => c.text).join('\n').trim()
let parsed = null
try {
  parsed = JSON.parse(text.replace(/^```json\s*|```$/g, '').trim())
} catch {
  console.error('JSONとして読めませんでした。生の返答:\n' + text)
  process.exit(1)
}

console.log(`\n■ ${IMAGE}（${TIMEFRAME}・${MODEL}）`)
console.log(`  全体: ${parsed.overall ?? '—'}`)
if (!parsed.found?.length) {
  console.log('  該当なし（図鑑の型は見当たらない）')
} else {
  for (const f of parsed.found) {
    const e = catalog.entries.find(x => x.id === f.id)
    const ng = e ? '' : ' 🔴 図鑑に無いID'
    console.log(`  ${String(Math.round((f.confidence ?? 0) * 100)).padStart(3)}%  ${f.name}${ng}  @${f.where ?? '—'}`)
    console.log(`        ${f.why ?? ''}`)
  }
}
console.log(`  （tokens in=${res.usage?.input_tokens} out=${res.usage?.output_tokens}）\n`)

if (OUT) {
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify({
    image: IMAGE, timeframe: TIMEFRAME, model: MODEL,
    catalogCount: catalog.count, result: parsed, usage: res.usage ?? null,
  }, null, 2))
  console.log(`→ ${OUT} に保存しました（判断には使わない・記録だけ）\n`)
}
