#!/usr/bin/env node
// 波動の書（ChartPatternPanel.tsx）を、AIに渡せるカタログJSONに書き出す（2026-08-13）
//
// 🔵 画面の文章を**唯一の情報源**にする。カタログを別に手書きすると、
//    図鑑を直したのにAIには古い説明が渡る、というズレが必ず起きる。
// 🔴 TSXを正規表現で読むので、データの書き方（`name:` / `title:` / `says:` / `body:` / `how:` / `detail:`）
//    を変えたら、ここも直すこと。件数が合わなければ気づけるよう、最後に巻ごとの数を出す。
//
// 使い方: node scripts/export-atlas.mjs [--out data/atlas/catalog.json]

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const SRC = 'src/components/ChartPatternPanel.tsx'

/** 巻の区切り＝データ配列の名前。表示順に並べる。 */
const VOLUMES = [
  { key: 'dow',    maki: '巻零・理', const: 'DOW',              note: 'ダウ理論の原則' },
  { key: 'lines',  maki: '巻零・理', const: 'LINES',            note: '線の引き方' },
  { key: 'candle', maki: '巻一・灯', const: 'CANDLES',          note: 'ローソク足の型（窓を含む）' },
  { key: 'form',   maki: '巻二・形', const: 'PATTERNS',         note: 'フォーメーション' },
  { key: 'wave',   maki: '巻三・波', const: 'CORRECTIONS',      note: 'エリオット・修正の型' },
  { key: 'wave',   maki: '巻三・波', const: 'ELLIOTT_VARIANTS', note: 'エリオット・推進の変形' },
  { key: 'wave',   maki: '巻三・波', const: 'HARMONICS',        note: 'ハーモニック' },
  { key: 'wave',   maki: '巻三・波', const: 'ICHI_WAVES',       note: '一目均衡表の波動論' },
  { key: 'vol',    maki: '巻四・力', const: 'VOLUMES',          note: '出来高の型' },
]

const src = readFileSync(SRC, 'utf8')

/** `const NAME ... = [ ... ]` の中身を取り出す（対応する ']' まで数える） */
function block(constName) {
  const m = new RegExp(`const ${constName}[^=]*=\\s*\\[`).exec(src)
  if (!m) throw new Error(`${constName} が見つかりません`)
  let i = m.index + m[0].length
  let depth = 1
  while (i < src.length && depth > 0) {
    const ch = src[i]
    if (ch === '[') depth++
    else if (ch === ']') depth--
    i++
  }
  return src.slice(m.index + m[0].length, i - 1)
}

/** 'あ' + 'い' のように分けて書かれた文字列を1本に戻す */
function readString(text, from) {
  let i = text.indexOf("'", from)
  if (i < 0) return null
  let out = ''
  for (;;) {
    let j = i + 1
    let buf = ''
    while (j < text.length && text[j] !== "'") { buf += text[j]; j++ }
    out += buf
    // 続きが `+ '...'` なら繋げる
    const rest = text.slice(j + 1)
    const cont = /^\s*\+\s*'/.exec(rest)
    if (!cont) return { value: out, end: j + 1 }
    i = j + 1 + cont[0].length - 1
  }
}

/** 1つの配列から項目を拾う。name か title で始まり、次の name/title までを1件とする。 */
function items(text) {
  const out = []
  const re = /\b(name|title):\s*'/g
  const heads = []
  let m
  while ((m = re.exec(text))) heads.push({ at: m.index, key: m[1] })
  heads.forEach((h, idx) => {
    const chunk = text.slice(h.at, idx + 1 < heads.length ? heads[idx + 1].at : text.length)
    const nameStr = readString(chunk, chunk.indexOf("'") - 1)
    const pick = key => {
      const k = new RegExp(`\\b${key}:\\s*'`).exec(chunk)
      return k ? readString(chunk, k.index + k[0].length - 1)?.value ?? null : null
    }
    out.push({
      name: nameStr?.value ?? '',
      says: pick('says') ?? pick('body') ?? '',
      how: pick('how') ?? pick('detail') ?? '',
      kind: pick('kind') ?? null,
      bars: pick('n') ?? null,
    })
  })
  return out.filter(v => v.name)
}

const entries = []
for (const v of VOLUMES) {
  for (const it of items(block(v.const))) {
    entries.push({
      id: `${v.key}-${entries.length + 1}`,
      maki: v.maki, group: v.note,
      name: it.name,
      // 🔴 図鑑の `**強調**` はそのまま渡さない（AIが記号として読む必要は無い）
      meaning: it.says.replace(/\*\*/g, ''),
      howToFind: it.how.replace(/\*\*/g, ''),
      ...(it.bars ? { bars: it.bars } : {}),
      ...(it.kind ? { kind: it.kind } : {}),
    })
  }
}

const out = process.argv.includes('--out')
  ? process.argv[process.argv.indexOf('--out') + 1]
  : 'data/atlas/catalog.json'
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify({ source: SRC, count: entries.length, entries }, null, 2))

const byMaki = {}
for (const e of entries) byMaki[e.maki] = (byMaki[e.maki] ?? 0) + 1
console.log(`\n波動の書 → ${out}`)
for (const [k, n] of Object.entries(byMaki)) console.log(`  ${k}  ${n} 点`)
console.log(`  合計 ${entries.length} 点\n`)
