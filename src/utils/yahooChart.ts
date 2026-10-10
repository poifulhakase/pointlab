import { isRecord, field, asArray, asNumber } from './validate'

// Yahoo Finance chart API（/v8/finance/chart/...）のレスポンスを検証して取り出す共通パーサ。
// 各データ取得 util が個別に `(json as any).chart.result[0]...` していた脆いパースを集約する。
export interface YahooChart {
  timestamps: number[]
  /** 取引所の UTC からの時差（秒）。日付にするときは timestamps に足す（為替＝ロンドン時間で夏は 3600） */
  gmtoffset: number
  open:   (number | null)[]
  high:   (number | null)[]
  low:    (number | null)[]
  close:  (number | null)[]
  volume: (number | null)[]
}

/** 不正な形なら null（呼び出し側でフォールバック/エラーにできる）。 */
export function parseYahooChart(json: unknown): YahooChart | null {
  const resultArr = asArray(field(field(json, 'chart'), 'result'))
  const r = resultArr[0]
  if (!isRecord(r)) return null

  const timestamps = asArray(field(r, 'timestamp'))
    .map(v => asNumber(v))
    .filter((n): n is number => n !== null)

  const quote = asArray(field(field(r, 'indicators'), 'quote'))[0]
  const series = (key: string): (number | null)[] => asArray(field(quote, key)).map(v => asNumber(v))

  return {
    timestamps,
    gmtoffset: asNumber(field(field(r, 'meta'), 'gmtoffset')) ?? 0,
    open:   series('open'),
    high:   series('high'),
    low:    series('low'),
    close:  series('close'),
    volume: series('volume'),
  }
}
