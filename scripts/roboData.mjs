// ──────────────────────────────────────────────────────────────────────────
// ぽいロボ 疑似トレード: 判断に渡すデータの読み込み
//
// 🔴 価格は Yahoo から日次で取る（fetch-jpx.mjs と同じ経路）。
// 🔴 需給は public/data/*.json（CI が直前のステップで更新済み）から読む。
//    ここでは計算せず、あるものを拾って要約するだけ。
// ──────────────────────────────────────────────────────────────────────────

import fs from 'node:fs'
import path from 'node:path'
import { UNIVERSE, computeIndicators } from '../src/utils/robotStrategy.mjs'

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }
export const DATA_DIR = path.resolve(process.cwd(), 'public/data')

/** public/data の JSON を読む（無ければ null。落とさない） */
export function readJson(name) {
  try {
    const p = path.join(DATA_DIR, name)
    if (!fs.existsSync(p)) return null
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

/** Yahoo から日次 OHLC を取る */
export async function fetchDaily(symbol, { range = '1y' } = {}) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${symbol}`)
  const j = await res.json()
  const r = j?.chart?.result?.[0]
  if (!r) throw new Error(`no result for ${symbol}`)
  const ts = r.timestamp ?? []
  const q = r.indicators?.quote?.[0] ?? {}
  const rows = []
  for (let i = 0; i < ts.length; i++) {
    if (q.close?.[i] == null) continue
    rows.push({
      date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
      open: q.open?.[i] ?? q.close[i],
      high: q.high?.[i] ?? q.close[i],
      low: q.low?.[i] ?? q.close[i],
      close: q.close[i],
    })
  }
  return rows
}

/** 日経225と対象4ETFの価格をまとめて取る。失敗した銘柄は null で返す（全体は止めない） */
export async function loadPrices() {
  const nk = computeIndicators(await fetchDaily('^N225'))

  const etf = {}
  for (const u of Object.values(UNIVERSE)) {
    try {
      const rows = await fetchDaily(`${u.code}.T`)
      etf[u.code] = { ...u, rows: computeIndicators(rows) }
    } catch (e) {
      etf[u.code] = { ...u, rows: null, error: e.message }
    }
  }
  return { nk, etf }
}

/** ETF の最終行から、プロンプト用の軽い特徴を作る */
export function etfFeatures(etf) {
  const out = {}
  for (const [code, v] of Object.entries(etf)) {
    if (!v.rows?.length) { out[code] = null; continue }
    const last = v.rows[v.rows.length - 1]
    const prev = v.rows[v.rows.length - 2]
    out[code] = {
      name: v.name,
      close: last.close,
      change1d: prev ? ((last.close - prev.close) / prev.close) * 100 : null,
      atr20: last.atr20,
    }
  }
  return out
}

/** 建てる価格（翌営業日の寄付きが取れないので、当日終値を執行の目安として使う） */
export function priceMap(etf) {
  const m = {}
  for (const [code, v] of Object.entries(etf)) {
    m[code] = v.rows?.length ? v.rows[v.rows.length - 1].close : null
  }
  return m
}

/**
 * 銘柄コード → 日次配列。損切りを価格の構造（スイング安値・キリ番）に
 * 合わせるために使う（`stopPrice` に渡す）。
 */
export function rowsMap(etf) {
  const m = {}
  for (const [code, v] of Object.entries(etf)) m[code] = v.rows ?? null
  return m
}

export function atrMap(etf) {
  const m = {}
  for (const [code, v] of Object.entries(etf)) {
    m[code] = v.rows?.length ? v.rows[v.rows.length - 1].atr20 : null
  }
  return m
}

// ── 需給の要約 ────────────────────────────────────────────────────────────

/**
 * public/data の JSON は共通で { updatedAt, data:[...] } の形。
 * 🔴 並び順がファイルによって違う（週次＝新しい順 / 日次＝古い順）ので、
 *    日付を見て最新行を選ぶ。位置決め打ちにしない。
 */
export function rowsOf(name) {
  const j = readJson(name)
  const arr = j?.data ?? j?.rows ?? (Array.isArray(j) ? j : null)
  return Array.isArray(arr) ? arr : []
}

/** 日付らしきキーを見て最新行を返す */
export function latestRow(rows) {
  if (!rows.length) return null
  const key = ['date', 'time'].find(k => k in rows[0]) ?? null
  if (!key) return rows[rows.length - 1]
  const norm = (v) => String(v ?? '').replace(/\//g, '-')
  return rows.reduce((best, r) => (norm(r[key]) > norm(best[key]) ? r : best), rows[0])
}

/**
 * public/data の各 JSON から、プロンプトに載せる需給の数字を拾う。
 * 🔴 取れないものは載せない（推測で埋めない）。
 */
export function summarizeSupply() {
  const s = {}

  // 信用（週次・新しい順）
  const margin = rowsOf('margin.json')
  const m = latestRow(margin)
  if (m) {
    s.marginRatio = m.ratio ?? (m.longBal && m.shortBal ? m.longBal / m.shortBal : null)
    const longs = margin.map(r => r.longBal).filter(v => typeof v === 'number')
    if (longs.length && m.longBal) {
      const peak = Math.max(...longs)
      if (peak > 0) s.marginLongPeakDrop = -((peak - m.longBal) / peak) * 100
    }
  }

  // 投資主体別（週次・億円）
  const inv = latestRow(rowsOf('investor.json'))
  if (inv) {
    s.foreignNet = inv.foreigner ?? null
    s.individualNet = inv.individual ?? null
  }

  // 海外投機筋（CFTC・週次）
  const cot = latestRow(rowsOf('cot_nikkei.json'))
  if (cot) s.cotNet = cot.nonCommNet ?? null

  // 空売り比率・騰落レシオ・裁定（週次）
  const ss = latestRow(rowsOf('short_sell.json'))
  if (ss) s.shortRatio = ss.ratio ?? null

  const ad = latestRow(rowsOf('advance_decline.json'))
  if (ad) s.adRatio = ad.ratio25 ?? null

  const arb = latestRow(rowsOf('arbitrage.json'))
  if (arb) s.arbitrageLong = arb.longBal ?? null

  // VIX（日次・古い順）
  const vix = latestRow(rowsOf('vix_daily.json'))
  if (vix) s.vix = vix.close ?? null

  // NT倍率（topix.json と日経から出す方が確実だが、無ければ載せない）
  const topix = latestRow(rowsOf('topix.json'))
  if (topix?.close) s.topixClose = topix.close

  // PCR（先物日次）
  const fut = latestRow(rowsOf('futures_daily.json'))
  if (fut) {
    s.pcr = fut.pcr ?? null
    s.futuresOi = fut.oi ?? null
  }

  return s
}

/** VIX の直近値（損切り倍率に使う）。取れなければ null */
export function latestVix() {
  const s = summarizeSupply()
  return s.vix ?? null
}
