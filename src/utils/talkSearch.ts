/**
 * トークの過去メッセージ検索（2026-11-07 運用者）。
 *
 * 🔵 Firestore には全文検索が無いので、端末で文字列を突き合わせる。
 *    画面に読み込んである直近500件はすぐ探し、それより前は「さらに前を検索」で500件ずつ取りに行く。
 * 🔵 表記ゆれを吸収する：全角/半角（NFKC）・大文字/小文字・カタカナ/ひらがな を同じ扱いにする。
 *    例＝「ラーメン」で「らーめん」、「ＬＩＮＥ」で「line」も見つかる。
 * 🔵 空白で区切ると「全部を含む」（AND）検索。
 */

/** 1文字ずつ表記ゆれをそろえる（カタカナ→ひらがな・NFKC・小文字） */
function foldChar(ch: string): string {
  return ch
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
}

/**
 * 文字の区切り。🔴 半角カナの濁点・半濁点（ﾞﾟ）や結合用の濁点は**前の文字とまとめる**
 * （1文字ずつ NFKC すると「ｶﾞ」が「が」にならない）。
 */
const VOICED = new Set(['\uff9e', '\uff9f', '\u3099', '\u309a'])

function units(s: string): string[] {
  const out: string[] = []
  for (const ch of s) {
    if (out.length && VOICED.has(ch)) out[out.length - 1] += ch
    else out.push(ch)
  }
  return out
}

/** 文字列全体をそろえる */
export function foldText(s: string): string {
  return units(s).map(foldChar).join('')
}

/** 検索語を空白で分けて、そろえた形にする（空なら []） */
export function searchTerms(q: string): string[] {
  return foldText(q).split(/\s+/).filter(Boolean)
}

/**
 * 本文がすべての語を含むか。
 * @returns 最初に見つかった語の、元の本文での位置（含まないなら null）
 */
export function matchRange(text: string, terms: string[]): { start: number; end: number } | null {
  if (!terms.length || !text) return null
  // そろえた文字列と、元の本文の位置との対応を作る（NFKC で長さが変わる文字があるため）
  let folded = ''
  const pos: number[] = [] // folded の各位置 → 元の本文の位置
  const ends: number[] = [] // folded の各位置 → その文字の元の本文での終わり
  let i = 0
  for (const u of units(text)) {
    const f = foldChar(u)
    for (let k = 0; k < f.length; k++) { pos.push(i); ends.push(i + u.length) }
    folded += f
    i += u.length
  }
  let first: { start: number; end: number } | null = null
  for (const t of terms) {
    const at = folded.indexOf(t)
    if (at < 0) return null
    const start = pos[at]
    const end = ends[at + t.length - 1]
    if (!first || start < first.start) first = { start, end }
  }
  return first
}

export interface SearchHit<T> {
  m: T
  start: number
  end: number
}

/** 当てはまる発言を新しい順で返す。 */
export function searchMessages<T extends { text: string; at: number }>(rows: T[], q: string): SearchHit<T>[] {
  const terms = searchTerms(q)
  if (!terms.length) return []
  const hits: SearchHit<T>[] = []
  for (const m of rows) {
    const r = matchRange(m.text ?? '', terms)
    if (r) hits.push({ m, ...r })
  }
  return hits.sort((a, b) => b.m.at - a.m.at)
}

/**
 * 結果の一覧に出す抜き書き。見つかった語の前後を少しだけ見せる。
 * 長い本文は前を「…」で詰める＝語が必ず見える位置に来る。
 */
export function snippet(text: string, start: number, end: number, before = 14, after = 40): { pre: string; hit: string; post: string } {
  const flat = (s: string) => s.replace(/\s+/g, ' ')
  const from = Math.max(0, start - before)
  const to = Math.min(text.length, end + after)
  return {
    pre: (from > 0 ? '…' : '') + flat(text.slice(from, start)),
    hit: flat(text.slice(start, end)),
    post: flat(text.slice(end, to)) + (to < text.length ? '…' : ''),
  }
}
