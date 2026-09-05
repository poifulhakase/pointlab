#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────
// TARGET（歴史的サポート狙い）の画面データを作る。
//   → public/data/target_support.json
//
//   node scripts/build-target-support.mjs                  … キャッシュにある銘柄だけで作る（速い）
//   node scripts/build-target-support.mjs --fetch          … 足りない銘柄を取りに行く（初回は長い）
//   node scripts/build-target-support.mjs --fetch --refresh … キャッシュを無視して全部取り直す
//   node scripts/build-target-support.mjs --fetch --limit=800
//
// 🔴 **この画面は「勝てる」と言っていない**。2026-09-02 の実測（490銘柄×15年・27,809件）では
//    サポート帯で買っても、同じ日に全銘柄を買った平均に**負けていた**（20日 43.7% / 60日 41.9%）。
//    タッチ回数を増やしても改善しない。画面は「安値圏まで落ちた銘柄を**探す道具**」であって、
//    「ここで買えば上がる」ではない。caveat をデータに埋めてあるので画面から消さないこと。
//
// 🔴 帯の判定は `src/utils/supportBands.mjs` が単一情報源（検証スクリプトと同じ関数を呼ぶ）。
// 🔴 価格は**分割・配当調整済み**（adjclose 比を OHLC に掛けたもの）。素の板の値段とは少しずれる。
// ──────────────────────────────────────────────────────────────────────────

import fs from 'node:fs'
import path from 'node:path'
import { pivotLows, buildBands, DEFAULT_DEF } from '../src/utils/supportBands.mjs'
// 🔴 休場判定は marketCalendar.mjs が単一情報源（ここで曜日判定を書き直さない）
import { isMarketClosed, parseYmd, toYmd } from '../src/utils/marketCalendar.mjs'

const args = process.argv.slice(2)
const numArg = (k, d) => {
  const a = args.find(x => x.startsWith(`--${k}=`))
  return a ? Number(a.split('=')[1]) : d
}
const DO_FETCH = args.includes('--fetch')
const REFRESH = args.includes('--refresh')
const LIMIT = numArg('limit', Infinity)
const CONCURRENCY = numArg('concurrency', 6)

// 🔴 **日足を取れるだけ取る**（2026-09-05 に 15年 → 全期間へ）。
//    Yahoo の日足は「上場日」か「1999〜2000年」の遅いほうで止まる＝実測で平均 3,690本 → 5,678本。
//    🔴 `range=max` は**使わない**。日足を頼んでも月足（321本・granularity=1mo）が返ってきて、
//       「超長期は取れない」ように見える。期間で欲しいときは period1/period2 を渡すこと。
//    🔵 伸ばして変わるのは**現在値が帯から遠い銘柄**だけ（DeNA は帯まで +30.0% → +7.5%）。
//       近い銘柄の帯は動かない（実測16銘柄中12銘柄は同じ）。
const FROM_TS = Math.floor(new Date('1999-01-01').getTime() / 1000)

/** 画面に載せる範囲。帯より上に遠い銘柄は「接近」ですらないので落とす。 */
const MAX_GAP = numArg('gap', 20) / 100
/** 流動性の下限（直近60日の売買代金の中央値・万円）。NISA で回す前提なので薄い板は落とす。 */
const MIN_TURNOVER = numArg('turnover', 3000) * 10000

const CACHE = path.resolve(process.cwd(), '.cache/support-v2')
const OUT = path.resolve(process.cwd(), 'public/data/target_support.json')
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' }

// ── 主力（運用者が指定した銘柄・2026-09-05）────────────────────────────
// 🔴 ここは**スキャンの結果ではなく指名**。流動性や帯の有無で落とさず、必ず画面に出す
//    （帯が組めない銘柄は band: null で出す＝「まだ帯が無い」も情報なので隠さない）。
// 🔵 「東京衝機」は表記ゆれで、正しくは 7719 東京衡機。
const CORE = [
  { code: '3793', note: 'ゲーム・メディア。運用者の保有銘柄' },
  { code: '9337', note: 'インフルエンサーマーケティング' },
  { code: '3825', note: 'エネルギー・暗号資産。値動きが荒い' },
  { code: '2432', note: 'ゲーム・スポーツ・ライブストリーミング' },
  { code: '7719', note: '試験機・鉄道関連。板が薄い' },
  // 2026-09-05 追加（運用者の監視リストから）
  { code: '1379', note: 'きのこ生産の最大手' },
  { code: '9513', note: '電力卸（J-POWER）。値動きは穏やか' },
  { code: '3810', note: 'オンラインゲーム' },
  { code: '4575', note: '創薬バイオ。臨床の進み方で跳ねる' },
  { code: '2667', note: '医療・衛星画像システム。低位株' },
  { code: '3083', note: '小売' },
  { code: '3444', note: '試作板金・金属加工' },
  { code: '3776', note: 'データセンター・クラウド' },
  { code: '4588', note: '創薬バイオ。臨床の進み方で跳ねる' },
  { code: '5216', note: 'ガラス基板。低位株' },
  { code: '2437', note: '美術品オークション（Shinwa Wise）。出来高が薄く跳ねやすい' },
]

const DEF = {
  ...DEFAULT_DEF,
  W: numArg('pivot', DEFAULT_DEF.W),
  BAND: numArg('band', 3) / 100,
  MIN_TOUCH: numArg('touch', 3),
}

/** 直近の「引けが終わっている営業日」。これより古いキャッシュは取り直す。 */
function lastSettledTradingDay(now = new Date()) {
  const jst = new Date(now.getTime() + (9 * 60 + now.getTimezoneOffset()) * 60000)
  // 15:30 の大引け前なら、その日はまだ確定していない
  if (jst.getHours() < 16) jst.setDate(jst.getDate() - 1)
  while (isMarketClosed(jst)) jst.setDate(jst.getDate() - 1)
  return toYmd(jst)
}
const SETTLED = lastSettledTradingDay()

async function fetchDaily(code, force = DO_FETCH, { fresh = false } = {}) {
  const file = path.join(CACHE, `${code}.json`)
  if (!REFRESH && fs.existsSync(file)) {
    try {
      const j = JSON.parse(fs.readFileSync(file, 'utf8'))
      // 🔴 主力は毎日見る画面なので、古い終値のまま出さない（fresh=true で取り直す）
      const stale = fresh && j.length && j[j.length - 1].date < SETTLED
      if (Array.isArray(j) && j.length && !stale) return j
    } catch { /* 壊れていたら取り直す */ }
  }
  if (!force && !REFRESH) return null
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${code}.T?interval=1d&period1=${FROM_TS}&period2=${Math.floor(Date.now() / 1000)}`
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const j = await res.json()
  const r = j?.chart?.result?.[0]
  if (!r) throw new Error('no result')
  const ts = r.timestamp ?? []
  const q = r.indicators?.quote?.[0] ?? {}
  const adj = r.indicators?.adjclose?.[0]?.adjclose ?? null
  const rows = []
  for (let i = 0; i < ts.length; i++) {
    if (q.close?.[i] == null || q.low?.[i] == null) continue
    // 🔴 素の close で帯を作ると、分割日が −90%・併合日が +900% の安値として混ざる。
    const f = (adj?.[i] != null && q.close[i]) ? adj[i] / q.close[i] : 1
    rows.push({
      date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
      low: q.low[i] * f, high: (q.high?.[i] ?? q.close[i]) * f, close: q.close[i] * f,
      vol: q.volume?.[i] ?? 0,
    })
  }
  fs.mkdirSync(CACHE, { recursive: true })
  fs.writeFileSync(file, JSON.stringify(rows))
  return rows
}

/** 同時に何本か走らせる（Yahoo を叩きすぎない） */
async function pool(items, n, fn) {
  const out = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const k = i++
      try { out[k] = await fn(items[k]) } catch { out[k] = null }
    }
  }))
  return out
}

const median = a => {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const round = (v, d = 2) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(d)))

/** 系列が壊れていないか（調整しても1日±60%超が複数回あるものは捨てる） */
function sane(bars) {
  let bad = 0
  for (let i = 1; i < bars.length; i++) {
    const r = bars[i].close / bars[i - 1].close - 1
    if (!Number.isFinite(r) || Math.abs(r) > 0.6) bad++
    if (bad > 1) return false
  }
  return true
}

/** 1銘柄ぶんの「いまの状態」を作る。条件から外れたら null。 */
export function analyze(meta, bars, def = DEF, { maxGap = MAX_GAP, minGap = -0.25, minTurnover = MIN_TURNOVER, core = false } = {}) {
  // 🔵 主力（指名した銘柄）は、履歴が短くても板が薄くても落とさない。
  //    落とすと画面から黙って消える＝「見ているつもりで見ていない」状態になるため。
  if (!bars || !bars.length) return null
  if (!core && (bars.length < def.WARMUP + def.W + 10 || !sane(bars))) return null

  const last = bars[bars.length - 1]
  const turnover = median(bars.slice(-60).map(b => b.close * b.vol)) ?? 0
  if (!core && turnover < minTurnover) return null

  // 🔴 いちばん新しい安値は前後 W 本を見て決まる＝**W本前までしか確定しない**。
  //    画面でも同じ縛りを守る（確定していない安値で帯を作ると、検証と別物になる）。
  const pivots = pivotLows(bars, def.W).filter(i => i <= bars.length - 1 - def.W)
  const bands = pivots.length >= def.MIN_TOUCH ? buildBands(bars, pivots, def) : []

  // 現在値から見て「いま効いている帯」＝現在値にいちばん近い帯（帯の上限で比べる）。
  const withGap = bands
    .map(b => ({ ...b, top: b.price * (1 + def.BAND), bottom: b.price * (1 - def.BAND) }))
    .map(b => ({ ...b, gap: last.close / b.top - 1 }))
    .filter(b => b.gap <= maxGap)                 // 帯から上に遠いものは対象外
    .sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap))
  const band = withGap.find(b => b.gap >= minGap) ?? null   // 大きく割った帯は「効いていない」
  if (!band && !core) return null

  // 状態: 上から接近中 / 帯の中 / 大きく割った（研究の判定と同じ −10%）/ 帯が組めない
  const state = !band ? 'noband'
    : last.close > band.top ? 'near'
    : last.close >= band.price * 0.90 ? 'inside'
    : 'broken'

  // 帯に入ってから何日たったか（最後に帯の上にいた日の翌日から数える）
  let daysInside = 0
  if (band && state !== 'near') {
    daysInside = null
    for (let i = bars.length - 1; i >= 0; i--) {
      if (bars[i].close > band.top) { daysInside = bars.length - 1 - i; break }
    }
    if (daysInside == null) daysInside = bars.length   // ずっと帯の下＝古い帯
  }

  // 🔴 帯の中にいても「上から降りてきた」のと「下から上げてきた」のは別物。
  //    研究で数えたのは**上から降りてきて初めて帯に入った**事象だけ。
  //    下から上げてきた銘柄を同じ顔で並べると、支えではなく**戻り売りの帯**を支えと見誤る。
  const approach = !band ? null
    : state === 'near' ? 'above'
    : (daysInside != null && daysInside <= 250) ? 'from_above'
    : 'from_below'

  const at = n => bars[bars.length - 1 - n]?.close ?? null
  const win = bars.slice(-250)
  const hi52 = Math.max(...win.map(b => b.high))
  const lo52 = Math.min(...win.map(b => b.low))

  return {
    code: meta.code,
    name: meta.name,
    sector33: meta.sector33 ?? null,
    date: last.date,
    close: round(last.close, 1),
    band: band ? {
      price: round(band.price, 1),
      top: round(band.top, 1),
      bottom: round(band.bottom, 1),
      touches: band.touches,
      lastTouch: bars[band.lastIdx]?.date ?? null,
    } : null,
    gapPct: band ? round(band.gap * 100) : null,
    state,
    approach,
    daysInside,
    ret20: round((last.close / (at(20) ?? last.close) - 1) * 100),
    ret60: round((last.close / (at(60) ?? last.close) - 1) * 100),
    ret250: round((last.close / (at(250) ?? last.close) - 1) * 100),
    fromHighPct: round((last.close / hi52 - 1) * 100),
    fromLowPct: round((last.close / lo52 - 1) * 100),
    turnoverOku: round(turnover / 1e8, 1),
    // 🔵 需給ゲージ（信用残が何日分か）を出すのに要る＝20日平均出来高
    vol20: Math.round(bars.slice(-20).reduce((sum, b) => sum + (b.vol ?? 0), 0) / Math.min(20, bars.length)),
  }
}

/**
 * 主力カードのチャート用に、週足へ間引いた系列を作る（5年ぶん・約260点）。
 * 🔵 日足のまま載せると1銘柄で数千点＝JSON が太る。帯との位置関係を見るだけなら週足で足りる。
 */
function weeklySeries(bars, years = 5) {
  const from = bars.length - Math.round(years * 250)
  const win = bars.slice(Math.max(0, from))
  const out = []
  for (let i = 0; i < win.length; i += 5) {
    const chunk = win.slice(i, i + 5)
    if (!chunk.length) continue
    out.push({
      d: chunk[chunk.length - 1].date,
      c: round(chunk[chunk.length - 1].close, 1),
      l: round(Math.min(...chunk.map(b => b.low)), 1),
      h: round(Math.max(...chunk.map(b => b.high)), 1),
    })
  }
  return out
}

async function main() {
  const master = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/data/stock_master.json'), 'utf8'))
  const metaByCode = new Map(master.data.map(d => [d.code, d]))
  let codes = master.data.map(d => d.code).filter(c => /^[0-9]{4}$/.test(c))

  if (!DO_FETCH) {
    const have = new Set(fs.existsSync(CACHE) ? fs.readdirSync(CACHE).map(f => f.replace('.json', '')) : [])
    codes = codes.filter(c => have.has(c))
  }
  if (codes.length > LIMIT) codes = codes.slice(0, LIMIT)

  // 🔴 主力は指名なので、キャッシュに無ければ必ず取りに行く（--fetch が無くても）。
  const core = []
  for (const c of CORE) {
    const meta = metaByCode.get(c.code) ?? { code: c.code, name: c.code }
    let bars = null
    try {
      bars = await fetchDaily(c.code, true, { fresh: true })
    } catch (e) {
      console.log(`  [warn] ${c.code} ${meta.name} の取得に失敗: ${e.message}`)
    }
    if (!bars) continue
    // 🔴 指名した銘柄では帯の探し方を広げる。候補スキャンの枠（上に20%まで）は
    //    「もうすぐ帯に入る銘柄を拾う」ための枠で、名指しの銘柄に当てると
    //    高値圏の銘柄が軒並み「帯なし」になり、**どこまで落ちれば帯かが分からなくなる**。
    const row = analyze(meta, bars, DEF, { core: true, maxGap: 1.0, minGap: -0.5 })
    if (row) core.push({ ...row, note: c.note, series: weeklySeries(bars) })
  }

  console.log('=== TARGET データ生成 ===')
  console.log(`対象 ${codes.length}銘柄 / 帯±${DEF.BAND * 100}% タッチ${DEF.MIN_TOUCH}回以上 / ${REFRESH ? '全部取り直す' : DO_FETCH ? '不足ぶんは取得する' : 'キャッシュのみ'}`)

  let done = 0
  const coreCodes = new Set(CORE.map(c => c.code))
  const items = (await pool(codes.filter(c => !coreCodes.has(c)), CONCURRENCY, async code => {
    const bars = await fetchDaily(code)
    done++
    if (done % 100 === 0) process.stdout.write(`  ${done}/${codes.length}\r`)
    return bars ? analyze(metaByCode.get(code) ?? { code, name: code }, bars) : null
  })).filter(Boolean)

  // 帯に近い順（到達も接近も「帯からの距離」でそろえる）
  items.sort((a, b) => Math.abs(a.gapPct) - Math.abs(b.gapPct))

  const asOf = items.reduce((m, it) => (it.date > m ? it.date : m), '')
  const out = {
    updatedAt: new Date().toISOString(),
    asOf,
    def: { pivot: DEF.W, bandPct: DEF.BAND * 100, minTouch: DEF.MIN_TOUCH, sep: DEF.SEP, warmup: DEF.WARMUP },
    universe: codes.length,
    filters: { maxGapPct: MAX_GAP * 100, minTurnoverOku: MIN_TURNOVER / 1e8 },
    // 🔴 画面から消さないこと（測って負けている事実）
    caveat: '歴史的サポート帯は、実測（490銘柄×15年・27,809件）では同じ日に全銘柄を買った平均に負けていた（20日 43.7% / 60日 41.9%）。タッチ回数を増やしても良くならない。安値圏の銘柄を探す道具であって、上がる根拠ではない。',
    basis: '分割・配当調整済みの日足（Yahoo Finance・上場日または1999年まで遡れるだけ）。帯は前後20日で最安の安値を±3%でまとめ、60営業日以上あけて3回以上触れたものだけ採用。',
    core,
    items,
  }
  fs.writeFileSync(OUT, JSON.stringify(out))
  const count = s => items.filter(i => i.state === s).length
  console.log(`\n書き出し: ${path.relative(process.cwd(), OUT)}`)
  console.log(`  主力 ${core.length}銘柄（${core.map(c => `${c.name}=${c.state}`).join(' / ')}）`)
  console.log(`  候補: 到達（帯の中） ${count('inside')}件 / 接近 ${count('near')}件 / 割れ ${count('broken')}件 = 計 ${items.length}件`)
}

// 直接起動したときだけ走る（テストから import しても main が動かないように）
if (process.argv[1] && process.argv[1].endsWith('build-target-support.mjs')) {
  main().catch(e => { console.error(e); process.exit(1) })
}
