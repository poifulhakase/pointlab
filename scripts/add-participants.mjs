#!/usr/bin/env node
/**
 * 日次手口データ手動追加スクリプト
 *
 * 使い方:
 *   node scripts/add-participants.mjs <date> [firm=value ...]
 *
 * 例:
 *   node scripts/add-participants.mjs 2026-04-25 GS=-1500 JPM=-900 AMRO=300 SG=-1200 Barclays=-800 Nomura=450
 *   node scripts/add-participants.mjs 2026-04-28 GS=-2100 JPM=-1200 SG=-1800 Barclays=-600 AMRO=180 Nomura=720
 *
 * 指定しなかった firm は null になります（BNP は通常 Barclays と排他）
 * --dry  : ファイルを保存せず確認のみ
 * --list : 現在のデータ一覧を表示
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FILE = join(__dirname, '..', 'public', 'data', 'futures_participants.json')

const FIRMS = ['GS', 'JPM', 'AMRO', 'SG', 'Barclays', 'BNP', 'Nomura']

function load() {
  try {
    return JSON.parse(readFileSync(FILE, 'utf-8'))
  } catch {
    return { updatedAt: new Date().toISOString(), data: [] }
  }
}

function makeLabel(dateStr) {
  const [, m, d] = dateStr.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}

const args = process.argv.slice(2)

// --list
if (args.includes('--list')) {
  const { data } = load()
  console.log(`\n現在のデータ (${data.length}件):\n`)
  console.log('日付       '.padEnd(12) + FIRMS.join('       ').replace(/\s+/g, '  '))
  data.forEach(r => {
    const vals = FIRMS.map(f => (r[f] != null ? String(r[f]) : 'null').padStart(7)).join(' ')
    console.log(`${r.date}  ${vals}`)
  })
  process.exit(0)
}

const isDry = args.includes('--dry')
const cleanArgs = args.filter(a => a !== '--dry')

if (cleanArgs.length === 0) {
  console.error(`
使い方: node scripts/add-participants.mjs <YYYY-MM-DD> [firm=value ...]

例:
  node scripts/add-participants.mjs 2026-04-25 GS=-1500 JPM=-900 AMRO=300 SG=-1200 Barclays=-800 Nomura=450

オプション:
  --dry   保存せず確認のみ
  --list  現在のデータ一覧表示
`)
  process.exit(1)
}

const dateStr = cleanArgs[0]
if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
  console.error('日付フォーマットエラー: YYYY-MM-DD 形式で指定してください')
  process.exit(1)
}

const firmValues = {}
for (const arg of cleanArgs.slice(1)) {
  const [key, val] = arg.split('=')
  if (!FIRMS.includes(key)) {
    console.warn(`⚠ 不明な firm: ${key} (無視します)`)
    continue
  }
  const n = parseInt(val)
  if (isNaN(n)) {
    console.warn(`⚠ ${key} の値が数値ではありません: ${val} (null にします)`)
    firmValues[key] = null
  } else {
    firmValues[key] = n
  }
}

const newRow = {
  date:     dateStr,
  label:    makeLabel(dateStr),
  GS:       firmValues['GS']       ?? null,
  JPM:      firmValues['JPM']      ?? null,
  AMRO:     firmValues['AMRO']     ?? null,
  SG:       firmValues['SG']       ?? null,
  Barclays: firmValues['Barclays'] ?? null,
  BNP:      firmValues['BNP']      ?? null,
  Nomura:   firmValues['Nomura']   ?? null,
}

console.log('\n追加するデータ:')
console.log(JSON.stringify(newRow, null, 2))

const existing = load()
const alreadyExists = existing.data.some(r => r.date === dateStr)
if (alreadyExists) {
  console.warn(`\n⚠ ${dateStr} のデータが既に存在します。上書きします。`)
  existing.data = existing.data.filter(r => r.date !== dateStr)
}

// 降順（最新が先頭）で挿入
existing.data.unshift(newRow)
existing.data.sort((a, b) => b.date.localeCompare(a.date))
existing.updatedAt = new Date().toISOString()

if (isDry) {
  console.log('\n[DRY RUN] ファイルは保存されませんでした。')
  console.log(`保存後の件数: ${existing.data.length}件`)
  console.log(`最新: ${existing.data[0].date}  最古: ${existing.data[existing.data.length - 1].date}`)
} else {
  writeFileSync(FILE, JSON.stringify(existing, null, 2))
  console.log(`\n✓ ${FILE} を更新しました (${existing.data.length}件)`)
  console.log(`  最新: ${existing.data[0].date}  最古: ${existing.data[existing.data.length - 1].date}`)
  console.log('\n次のステップ: git add + commit + push で本番に反映')
}
