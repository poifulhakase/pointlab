// 外部データ境界（API/JSON）の軽量ランタイム検証ヘルパー（依存なし）。
// 目的: `as any` での手探りパースをやめ、壊れたデータを「検知可能な失敗」に変える。
// zod 等を導入せず最小限に留める（バンドル増を避ける）。新しい fetcher はここを使うこと。

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** number として取り出す。数値でなければ fallback（既定 null）。NaN/Infinity は不可。 */
export function asNumber(v: unknown, fallback: number | null = null): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

/** string として取り出す。文字列でなければ fallback（既定 ''）。 */
export function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

/** boolean として取り出す。真偽値でなければ fallback（既定 false）。 */
export function asBoolean(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback
}

/** 配列として取り出す。配列でなければ空配列。 */
export function asArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : []
}

/** record のフィールドを取り出す（record でなければ undefined）。 */
export function field(v: unknown, key: string): unknown {
  return isRecord(v) ? v[key] : undefined
}
