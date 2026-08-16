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
  { code: '6857', symbol: '6857.T', name: 'アドバンテスト', kana: 'ADVANTEST', note: '半導体テスタで実質2社寡占。AIチップが複雑になるほど検査需要が増える' },
  { code: '5803', symbol: '5803.T', name: 'フジクラ', kana: 'FUJIKURA', note: 'データセンター向けの光ケーブルと融着接続。🔴 独占は5枠でいちばん薄い' },
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

/**
 * その他の監視銘柄（別ページ）。
 * 🔵 枠には入れていないが、フィジカルAI／AIの4層に関わる会社を並べて置く。
 * 🔴 **チャート用の系列は持たない**（数字だけ）＝1銘柄あたり数百バイトに収め、配信を軽くする。
 */
export const WATCH = [
  { code: '6506', name: '安川電機', layer: '動く' },
  { code: '6268', name: 'ナブテスコ', layer: '動く' },
  { code: '6481', name: 'THK', layer: '動く' },
  { code: '6479', name: 'ミネベアミツミ', layer: '動く' },
  { code: '6471', name: '日本精工', layer: '動く' },
  { code: '6472', name: 'NTN', layer: '動く' },
  { code: '6861', name: 'キーエンス', layer: '感じる' },
  { code: '6645', name: 'オムロン', layer: '感じる' },
  { code: '7729', name: '東京精密', layer: '感じる' },
  { code: '6273', name: 'SMC', layer: '動く' },
  { code: '6383', name: 'ダイフク', layer: '運ぶ' },
  { code: '6141', name: 'DMG森精機', layer: '動く' },
  { code: '6301', name: 'コマツ', layer: '動く' },
  { code: '6503', name: '三菱電機', layer: '動く' },
  { code: '6594', name: 'ニデック', layer: '動く' },
  { code: '8035', name: '東京エレクトロン', layer: '考える' },
  { code: '6146', name: 'ディスコ', layer: '考える' },
  { code: '5801', name: '古河電工', layer: 'つなぐ' },
  { code: '5802', name: '住友電工', layer: 'つなぐ' },
]

/**
 * レンジ銘柄（歴史的サポート狙い）。
 * 🔴 **枠でも「見立て」銘柄でもない**。値動きが規則的なレンジに見えるものを集めただけで、
 *    会社の中身は判断材料にしていない（2026-08-16 ユーザー指示）。
 * 🔵 だから見るのは**15年の週足と、その安値からの距離**だけ。歴史的な下値に近づいたら検討する、という使い方。
 */
export const RANGE_WATCH = [
  { code: '2432', name: 'ディー・エヌ・エー' },
  { code: '3793', name: 'ドリコム' },
  { code: '3825', name: 'リミックスポイント' },
]

/** Yahoo の週足（長期のレンジを見る用）。15年ぶんでも約780本に収まる */
async function fetchWeekly(symbol, range = '15y') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1wk&range=${range}`
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
      high: q.high?.[i] ?? q.close[i],
      low: q.low?.[i] ?? q.close[i],
      close: q.close[i],
    })
  }
  return rows
}

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

  // ── その他の監視銘柄（数字だけ）──
  const watch = []
  for (const w of WATCH) {
    try {
      const rows = computeIndicators(await fetchDailyWithVolume(`${w.code}.T`, '2y'))
      const sum = summarizeStock(rows, index)
      if (!sum) throw new Error('要約できなかった')
      watch.push({
        code: w.code, name: w.name, layer: w.layer,
        close: sum.close, change_pct: sum.change_pct,
        ret12m: sum.momentum.ret.m12, ret3m: sum.momentum.ret.m3,
        from_52w_high_pct: sum.momentum.from_52w_high_pct,
        dev200_pct: sum.dev200_pct,
        above_ma200: sum.momentum.above_ma200, ma200_up: sum.momentum.ma200_up,
        // 🔵 チャートしか見ない使い方なので、監視銘柄にも線を持たせる。
        //    1年ぶんを3本に1本へ間引く（見た目は変わらず、容量は1/3）。
        series: sum.series.slice(-250).filter((_, i) => i % 3 === 0).map(p => ({ d: p.d, c: p.c, m200: p.m200 })),
      })
    } catch (e) {
      console.log(`  ⚠ [監視] ${w.code} ${w.name} は取れなかった（${e.message}）`)
    }
  }
  console.log(`[3] その他の監視銘柄 ${watch.length}件`)

  // ── レンジ銘柄（15年の週足）──
  const ranges = []
  for (const w of RANGE_WATCH) {
    try {
      const rows = await fetchWeekly(`${w.code}.T`)
      if (rows.length < 50) throw new Error('本数不足')
      const last = rows[rows.length - 1]
      const prev = rows[rows.length - 2]
      const low = Math.min(...rows.map(r => r.low))
      const high = Math.max(...rows.map(r => r.high))
      const r1 = (v) => Math.round(v * 10) / 10

      // 🔴 **レンジ下限は「15年の絶対安値」ではなく、直近5年で何度も止まっている帯**で測る
      //    （2026-08-16 ユーザーと確認）。何年も前に一度だけ付けた暴落安値は、
      //    実際のレンジ取引では機能しないため。
      const recent = rows.slice(-260)                 // 直近5年ぶんの週足
      const quantile = (arr, q) => {
        const a = [...arr].sort((x, y) => x - y)
        if (!a.length) return null
        const i = Math.min(a.length - 1, Math.max(0, Math.round((a.length - 1) * q)))
        return a[i]
      }
      const floor = quantile(recent.map(r => r.low), 0.15)
      const ceil = quantile(recent.map(r => r.high), 0.85)
      // その帯（+5%以内）で何回止まったか＝サポートとしての信用度
      const touches = floor ? recent.filter(r => r.low <= floor * 1.05).length : 0
      ranges.push({
        code: w.code, name: w.name,
        from: rows[0].date, to: last.date,
        close: r1(last.close),
        change_pct: prev?.close ? Math.round(((last.close - prev.close) / prev.close) * 10000) / 100 : null,
        low15y: r1(low), high15y: r1(high),
        // 歴史的な下値からどれだけ上にいるか（参考。最終防衛ライン）
        from_low_pct: Math.round(((last.close - low) / low) * 1000) / 10,
        from_high_pct: Math.round(((last.close - high) / high) * 1000) / 10,
        // 🔵 実際に効くレンジの上下（直近5年）と、下限からの距離・止まった回数
        floor: floor ? r1(floor) : null,
        ceil: ceil ? r1(ceil) : null,
        from_floor_pct: floor ? Math.round(((last.close - floor) / floor) * 1000) / 10 : null,
        floor_touches: touches,
        series: rows.map(r => ({ d: r.date, c: r1(r.close) })),
      })
      const x = ranges[ranges.length - 1]
      console.log(`  [レンジ] ${w.code} ${w.name}: ${x.close}円 / レンジ下限 ${x.floor}（+${x.from_floor_pct}%・5年で${x.floor_touches}回）/ 15年安値 ${x.low15y}`)
    } catch (e) {
      console.log(`  ⚠ [レンジ] ${w.code} ${w.name} は取れなかった（${e.message}）`)
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
    watch,
    ranges,
  }

  if (DRY) { console.log('[2] --dry のため書いていない'); return }
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8')
  console.log(`[2] 保存: ${path.relative(process.cwd(), OUT)}`)
  console.log('=== 完了 ===')
}

main().catch(e => { console.error(e); process.exit(1) })
