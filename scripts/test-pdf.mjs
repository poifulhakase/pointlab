import { readFileSync } from 'fs'
const pdfjsLib = await import('../node_modules/pdfjs-dist/legacy/build/pdf.mjs')
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  '../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
  import.meta.url
).href

const pdfPath = process.env.TEMP + '/jpx_daily_test/sif_dyr_20260430.pdf'

async function main() {
  const data = new Uint8Array(readFileSync(pdfPath))
  const pdf = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise

  const page = await pdf.getPage(1)
  const content = await page.getTextContent()
  const byY = new Map()
  for (const item of content.items) {
    if (!('str' in item) || !item.str.trim()) continue
    const y = Math.round(item.transform[5])
    if (!byY.has(y)) byY.set(y, [])
    byY.get(y).push({ x: Math.round(item.transform[4]), str: item.str.trim() })
  }
  for (const items of byY.values()) items.sort((a, b) => a.x - b.x)

  // ヘッダー行 y=576 のx座標を確認
  console.log('=== Header row y=576 x-positions ===')
  const hdr = byY.get(576) ?? []
  hdr.forEach(i => console.log(`  x=${i.x} "${i.str}"`))

  // データ行のx座標を確認（3行分）
  for (const y of [558, 536, 514, 492, 448]) {
    const row = byY.get(y) ?? []
    console.log(`\n=== Data row y=${y} ===`)
    row.forEach(i => console.log(`  x=${i.x} "${i.str}"`))
  }
}

main().catch(console.error)
