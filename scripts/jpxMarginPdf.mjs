// JPX「銘柄別信用取引週末残高」（週次PDF）の読み取り（共通部品）。
//
// 使う側:
//   scripts/fetch-stock-margin.mjs   … 主力銘柄の需給ゲージ（直近5週）
//   scripts/archive-margin-weekly.mjs … 全銘柄を週ごとに貯める（信用期日の見立て用）
//
// 🔴 PDFの構造（罠）
//   表が**90度回転**して描画されている。つまり
//     ・同じ Y 座標 ＝ 表の「列」（同一項目が銘柄ぶん並ぶ）
//     ・同じ X 座標 ＝ 表の「行」（1銘柄のデータ）
//   そのため行を取るには X でまとめる。1pt丸めだと同一行が2つに割れるので ±3pt の許容幅を持たせる。
//
//   1行のセル並び（Y降順＝表の左から右）:
//     前週比,制度買残 / 前週比,一般買残 / 前週比,制度売残 / 前週比,一般売残 /
//     前週比,買残合計 / 前週比,売残合計 / ISIN / 新証券コード(4桁+0) / 株式種別 / 銘柄名
//   （買残合計 = 制度買残 + 一般買残 で検算できる）
//
// 🔴 PDFは1つ40MB近くある。**1つのPDFは1回だけ開き**、その中で必要な行を全部拾う。
// 🔴 JPXの公開ページに並ぶのは**直近5週だけ**で、古い週のPDFは消える（URLを推測しても404・2026-09-16 確認）。
//    過去分が欲しければ、公開されているうちに貯めるしかない。

export const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36' }
export const BASE = 'https://www.jpx.co.jp'
const INDEX = '/markets/statistics-equities/margin/05.html'

/** 新証券コード（4桁＋0）。英字入りの新しいコード（例 285A0）も含む。 */
const SEC_CODE_RE = /^[0-9][0-9A-Z]{3}0$/

/** 公開ページから週次PDFのパスを新しい順で返す */
export async function listWeeklyPdfs() {
  const res = await fetch(BASE + INDEX, { headers: UA, signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`JPXの一覧ページ取得に失敗: HTTP ${res.status}`)
  const html = await res.text()
  return [...html.matchAll(/href="([^"]*syumatsu[^"]*\.pdf)"/g)]
    .map(m => m[1])
    .sort()
    .reverse()
}

/** PDFのパスから週末日（YYYY-MM-DD）を取り出す。 */
export function weekOf(pdfPath) {
  const d = pdfPath.match(/syumatsu(\d{4})(\d{2})(\d{2})/)
  return d ? `${d[1]}-${d[2]}-${d[3]}` : null
}

let pdfjsLib
async function loadPdfjs() {
  if (pdfjsLib) return pdfjsLib
  pdfjsLib = await import('../node_modules/pdfjs-dist/legacy/build/pdf.mjs')
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    new URL('../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).href
  return pdfjsLib
}

const num = (s) => {
  if (s == null) return null
  const neg = s.includes('▲')                     // JPXの負数は「▲ 1,234」
  const v = parseFloat(s.replace(/[▲,\s]/g, ''))
  return Number.isFinite(v) ? (neg ? -v : v) : null
}

/** 1ページ・1銘柄ぶんの行を組み立てる（アンカー＝新証券コードのセル）。 */
function rowFromAnchor(items, anchor, secCode) {
  // 🔴 行は X でまとまる（表が回転しているため）。丸め誤差を吸収するため ±3pt。
  const cells = items
    .filter(i => Math.abs(i.x - anchor.x) <= 3)
    .sort((a, b) => b.y - a.y)
    .map(i => i.s)

  // 数値セルは先頭12個（前週比・残高の6ペア）。5番目のペアが買残合計、6番目が売残合計。
  const nums = cells.slice(0, 12).map(num)
  const name = cells.find(c => !/^[\d,▲\s]+$/.test(c) && !/^JP/.test(c) && !/株式$/.test(c) && c !== secCode) ?? ''

  if (nums.length < 12 || nums.some(v => v === null)) return null

  const [systemLongChg, systemLong, , negotiableLong, , systemShort, , negotiableShort,
         longChg, longBal, shortChg, shortBal] = nums

  // 検算：合計 = 制度 + 一般
  const consistent = systemLong + negotiableLong === longBal && systemShort + negotiableShort === shortBal

  // 🆕 2026-09-16：制度買残も返す＝制度信用は6か月が期日なので、買いが積み上がった週の半年後が売りの出尽くしの目安になる
  return {
    name, longBal, longChg, shortBal, shortChg,
    systemLong, systemLongChg, negotiableLong, systemShort, negotiableShort,
    consistent,
  }
}

async function openPdf(pdfPath) {
  const lib = await loadPdfjs()
  const buf = await (await fetch(BASE + pdfPath, { headers: UA, signal: AbortSignal.timeout(120000) })).arrayBuffer()
  return lib.getDocument({ data: new Uint8Array(buf), useSystemFonts: true }).promise
}

/**
 * 1つのPDFから行を抜く（PDFは1回しか開かない）。
 * @param {string} pdfPath
 * @param {string[] | null} secCodes 新証券コード（4桁+0）の配列。null なら**全銘柄**
 * @returns {Promise<Record<string, ReturnType<typeof rowFromAnchor> & { page: number }>>} 新証券コード → 行
 */
export async function extractFromPdf(pdfPath, secCodes = null) {
  const pdf = await openPdf(pdfPath)
  const want = secCodes ? new Set(secCodes) : null
  const out = {}

  for (let n = 1; n <= pdf.numPages && (!want || want.size > 0); n++) {
    const content = await (await pdf.getPage(n)).getTextContent()
    const items = content.items
      .filter(i => i.str && i.str.trim())
      .map(i => ({ x: i.transform[4], y: i.transform[5], s: i.str.trim() }))

    for (const item of items) {
      if (want ? !want.has(item.s) : !SEC_CODE_RE.test(item.s)) continue
      if (out[item.s]) continue
      const row = rowFromAnchor(items, item, item.s)
      if (row) {
        out[item.s] = { ...row, page: n }
        want?.delete(item.s)
      }
    }
  }

  return out
}
