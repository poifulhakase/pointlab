#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────
// Believe（第4次産業革命）の銘柄＝6954 ファナック / 6324 ハーモニックの日足を取って要約する。
//
// 🔴 **観測だけ**。ロボ口座の判断・売買対象には入れない（2026-08-16 ユーザー合意）。
// 🔴 Vercel の Functions 枠が上限なので**APIは増やせない**。既存の作法どおり
//    GitHub Actions で取って `public/data/poirobo_stocks.json` を配る。
//
// 使い方: node scripts/fetch-poirobo-stocks.mjs [--dry]
// ──────────────────────────────────────────────────────────────────────────

import fs from 'node:fs'
import path from 'node:path'

import { computeIndicators } from '../src/utils/robotStrategy.mjs'
import { summarizeStock } from '../src/utils/poiroboStockCalc.mjs'

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }
const DATA_DIR = path.resolve(process.cwd(), 'public/data')
const OUT = path.join(DATA_DIR, 'poirobo_stocks.json')
const DRY = process.argv.includes('--dry')

/** 🔴 銘柄を増やすときはここだけ足す（画面はこの順に出る） */
export const STOCKS = [
  { code: '6954', symbol: '6954.T', name: 'ファナック', kana: 'FANUC', note: '工作機械用CNCと産業用ロボット。受注と中国の設備投資に感応' },
  { code: '6324', symbol: '6324.T', name: 'ハーモニック・ドライブ・システムズ', kana: 'HARMONIC', note: '精密減速機（波動歯車装置）で世界シェア約50%。ロボットの関節そのもの' },
  { code: '285A', symbol: '285A.T', name: 'キオクシア', kana: 'KIOXIA', note: 'NANDフラッシュ。世界5〜6社の寡占。🔴 価格サイクル型で値動きが桁違いに荒い' },
]

/**
 * 🔵 **ものさし（AIの4層）**。この画面の主張＝
 *    「AIは考える・記憶・つなぐの3層にはもう値段が付いた。**動く側だけまだ**」を、
 *    毎営業日そのまま数字で確かめるために、各層の代表銘柄も測って並べる。
 * 🔴 これは比較用で、枠（採用銘柄）ではない。
 */
export const LAYERS = [
  { key: 'think', label: '考える', sub: '半導体・テスタ', code: '6857', symbol: '6857.T', name: 'アドバンテスト' },
  { key: 'memory', label: '記憶', sub: 'メモリ', code: '285A', symbol: '285A.T', name: 'キオクシア' },
  { key: 'connect', label: 'つなぐ', sub: '電線・光', code: '5803', symbol: '5803.T', name: 'フジクラ' },
  { key: 'move', label: '動く', sub: 'ロボット', code: '6954', symbol: '6954.T', name: 'ファナック', ours: true },
]

/** Yahoo の日足（出来高つき）。roboData の fetchDaily は出来高を返さないので別に持つ */
async function fetchDailyWithVolume(symbol, range = '2y') {
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
      volume: q.volume?.[i] ?? null,
    })
  }
  return rows
}

async function main() {
  console.log('=== ぽいロボ銘柄 ===')
  const index = computeIndicators(await fetchDailyWithVolume('^N225'))
  console.log(`[1] 日経225 ${index.length}本（〜${index[index.length - 1]?.date}）`)

  const stocks = []
  for (const s of STOCKS) {
    try {
      const rows = computeIndicators(await fetchDailyWithVolume(s.symbol))
      const sum = summarizeStock(rows, index)
      if (!sum) throw new Error('要約できなかった（本数不足）')
      stocks.push({ ...s, ...sum })
      console.log(`  ${s.code} ${s.name}: ${sum.close}円 ${sum.change_pct > 0 ? '+' : ''}${sum.change_pct}%`
        + ` / 25日乖離 ${sum.dev25_pct}% / β${sum.link.beta ?? '—'} 相関${sum.link.corr ?? '—'}`)
    } catch (e) {
      // 🔵 1銘柄が取れなくても全体は止めない（前回の値がそのまま残る）
      console.log(`  ⚠ ${s.code} ${s.name} は取れなかった（${e.message}）→ 飛ばす`)
    }
  }
  if (!stocks.length) { console.log('1銘柄も取れなかった → 何も書かない'); return }

  // ── ものさし（4層の比較）──
  const layers = []
  for (const l of LAYERS) {
    try {
      const rows = computeIndicators(await fetchDailyWithVolume(l.symbol))
      const sum = summarizeStock(rows, index)
      if (!sum) throw new Error('要約できなかった')
      layers.push({
        ...l,
        close: sum.close,
        rel12m: sum.momentum.ret_vs_index.m12,
        rel3m: sum.momentum.ret_vs_index.m3,
        ret12m: sum.momentum.ret.m12,
        from_52w_high_pct: sum.momentum.from_52w_high_pct,
      })
      console.log(`  [層] ${l.label}（${l.name}）対日経12M ${layers[layers.length - 1].rel12m}%`)
    } catch (e) {
      console.log(`  ⚠ [層] ${l.label} は取れなかった（${e.message}）`)
    }
  }

  const nkLast = index[index.length - 1]
  const nkPrev = index[index.length - 2]
  const out = {
    updatedAt: new Date().toISOString(),
    basis: 'Yahoo Finance の日足。連動（β・相関）は日経225との直近60営業日の日次リターンで計算',
    caveat: '🔴 観測用。ロボ口座の判断・売買対象には入っていない。',
    index: {
      code: 'N225',
      name: '日経平均',
      date: nkLast?.date ?? null,
      close: nkLast ? Math.round(nkLast.close * 10) / 10 : null,
      change_pct: nkPrev?.close
        ? Math.round(((nkLast.close - nkPrev.close) / nkPrev.close) * 10000) / 100
        : null,
      dev25_pct: nkLast?.dev25 == null ? null : Math.round(nkLast.dev25 * 100) / 100,
    },
    stocks,
    layers,
  }

  if (DRY) { console.log('[2] --dry のため書いていない'); return }
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8')
  console.log(`[2] 保存: ${path.relative(process.cwd(), OUT)}`)
  console.log('=== 完了 ===')
}

main().catch(e => { console.error(e); process.exit(1) })
