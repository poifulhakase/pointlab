#!/usr/bin/env node
// 「デッドキャットバウンス」か「モメンタム発生」かの実測（R&D・コミット対象外想定）
//
// 問い: 25日線から大きく下に離れた状態から急反発したとき、その後どうなったか。
//   ・デッドキャットバウンス＝戻したあと**反発前の安値を割り込む**
//   ・モメンタム発生＝**25日線を回復して維持**し、20営業日後も上にいる
//
// 現在（2026-07-31）の状況をそのまま条件にする:
//   ・25日線乖離が -7% 以下まで下げた局面
//   ・その安値から **2〜3営業日で +5%以上** 戻した
//
// 使い方: node scripts/analyze-deadcat-vs-momentum.mjs

const PERIOD2 = Math.floor(Date.now() / 1000)
const PERIOD1 = PERIOD2 - 21 * 365 * 24 * 3600 // 約21年

async function fetchDaily(symbol = '%5EN225') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${PERIOD1}&period2=${PERIOD2}&interval=1d`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; stock-calendar/1.0)' },
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const j = await res.json()
  const r = j?.chart?.result?.[0]
  const ts = r.timestamp ?? []
  const q = r.indicators?.quote?.[0] ?? {}
  const rows = []
  for (let i = 0; i < ts.length; i++) {
    if (q.close?.[i] == null || q.low?.[i] == null) continue
    rows.push({
      date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
      close: q.close[i],
      low: q.low[i],
      high: q.high[i],
    })
  }
  return rows
}

const DEV_THRESHOLD = -7 // 25日線乖離(%)がこれ以下＝深く売られた状態
const BOUNCE_MIN = 5     // 直近安値からの戻り(%)がこれ以上＝急反発
const BOUNCE_DAYS = 3    // 何営業日以内の戻りを見るか
const HORIZON = 20       // 判定期間（営業日）
const COOLDOWN = 20      // 同じ局面を二重に数えない間隔

function analyze(rows, label) {
  // 25日線と乖離率
  for (let i = 0; i < rows.length; i++) {
    if (i < 24) continue
    let s = 0
    for (let k = i - 24; k <= i; k++) s += rows[k].close
    rows[i].ma25 = s / 25
    rows[i].dev = (rows[i].close / rows[i].ma25 - 1) * 100
  }

  const signals = []
  let lastSignal = -999

  for (let i = 25; i < rows.length - HORIZON; i++) {
    if (i - lastSignal < COOLDOWN) continue

    // 直近 BOUNCE_DAYS 日の安値（＝反発の起点）
    let lowIdx = i
    for (let k = i - BOUNCE_DAYS; k <= i; k++) {
      if (k >= 0 && rows[k].low < rows[lowIdx].low) lowIdx = k
    }
    const bounceLow = rows[lowIdx].low
    const bounce = (rows[i].close / bounceLow - 1) * 100

    // 起点の日が「深く売られた状態」だったか
    const devAtLow = rows[lowIdx].dev
    if (devAtLow == null || devAtLow > DEV_THRESHOLD) continue
    if (bounce < BOUNCE_MIN) continue

    // 判定
    const fut = rows.slice(i + 1, i + 1 + HORIZON)
    const brokeLow = fut.some(r => r.low < bounceLow)              // 安値割れ＝デッドキャット
    const last = fut[fut.length - 1]
    const aboveMa = last.ma25 != null && last.close > last.ma25     // 25日線を回復して維持
    const ret20 = (last.close / rows[i].close - 1) * 100

    // 🔴 「安値を試すか」と「20日後に下げているか」は別の問い。両方を測る。
    const r = (c) => (rows[i + c].close / rows[i].close - 1) * 100
    const worst = Math.min(...fut.map(x => (x.low / rows[i].close - 1) * 100))   // 期間中の最大下落幅
    const best  = Math.max(...fut.map(x => (x.high / rows[i].close - 1) * 100))  // 期間中の最大上昇幅

    signals.push({
      date: rows[i].date, lowDate: rows[lowIdx].date,
      devAtLow: +devAtLow.toFixed(1), bounce: +bounce.toFixed(1),
      brokeLow, aboveMa,
      ret5: +r(4).toFixed(1), ret10: +r(9).toFixed(1), ret20: +ret20.toFixed(1),
      worst: +worst.toFixed(1), best: +best.toFixed(1),
    })
    lastSignal = i
  }

  const n = signals.length
  const dead = signals.filter(s => s.brokeLow)
  const momo = signals.filter(s => !s.brokeLow && s.aboveMa)
  const other = signals.filter(s => !s.brokeLow && !s.aboveMa)
  const med = a => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)] }

  console.log(`\n===== ${label} =====`)
  console.log(`対象期間: ${rows[0].date} 〜 ${rows[rows.length - 1].date}（${rows.length}営業日）`)
  console.log(`条件: 25日線乖離 ${DEV_THRESHOLD}% 以下の安値から ${BOUNCE_DAYS}営業日以内に +${BOUNCE_MIN}% 以上の反発`)
  console.log(`該当: ${n}件（判定は先${HORIZON}営業日）\n`)
  if (!n) return
  console.log(`  ① 反発前の安値を割った（デッドキャットバウンス）      : ${dead.length}件 = ${(dead.length / n * 100).toFixed(0)}%`)
  console.log(`  ② 安値を守り25日線も回復して維持（モメンタム発生）    : ${momo.length}件 = ${(momo.length / n * 100).toFixed(0)}%`)
  console.log(`  ③ 安値は守ったが25日線の下でもみ合い                  : ${other.length}件 = ${(other.length / n * 100).toFixed(0)}%`)
  console.log(`\n  20営業日後リターンの中央値: 全体 ${med(signals.map(s => s.ret20))}% ／ ①${med(dead.map(s => s.ret20))}% ／ ②${med(momo.map(s => s.ret20))}%`)
  // 🔴 中央値だけ見ると「尾」が消える。上振れがどこまで伸びたかを分位で出す。
  const q = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.min(s.length - 1, Math.floor(s.length * p))] * 10) / 10 }
  const momoCases = signals.filter(s => !s.brokeLow && s.aboveMa)
  console.log('\n  --- 上振れの大きさ（20営業日後リターンの分布） ---')
  for (const [name, g] of [['全ケース', signals], ['②モメンタム発生のみ', momoCases]]) {
    if (!g.length) continue
    const r = g.map(s => s.ret20)
    console.log(`   ${name.padEnd(22)} 下位25% ${q(r, 0.25)}% ／ 中央 ${q(r, 0.5)}% ／ 上位25% ${q(r, 0.75)}% ／ 最大 ${q(r, 0.99)}%`)
  }
  console.log(`   ＋10%以上に伸びた割合: 全体 ${Math.round(signals.filter(s => s.ret20 >= 10).length / signals.length * 100)}%`
    + `／②のうち ${momoCases.length ? Math.round(momoCases.filter(s => s.ret20 >= 10).length / momoCases.length * 100) : 0}%`)

  // 🔴 「一度は下を試す」と「N日後に下げている」は別問題。混同すると判断を誤る。
  const below = a => a.length ? Math.round(a.filter(v => v < 0).length / a.length * 100) : 0
  const shallow = signals.filter(s => s.devAtLow > -10)
  for (const [name, g] of [['全体', signals], ['浅め(-7〜-10%)', shallow]]) {
    if (!g.length) continue
    console.log(`\n  --- ${name}：反発した日の終値と比べて「下げていた」割合 ---`)
    console.log(`   5日後 ${below(g.map(s => s.ret5))}%   10日後 ${below(g.map(s => s.ret10))}%   20日後 ${below(g.map(s => s.ret20))}%`)
    console.log(`   期間中の値動き（中央値）: 最大下落 ${med(g.map(s => s.worst))}% ／ 最大上昇 +${med(g.map(s => s.best))}%`)
    console.log(`   20日後リターン中央値 ${med(g.map(s => s.ret20))}%`)
  }

  // 🔴 下落の「深さ」で分ける。浅い下落からの反発と、暴落からの反発は別物のはず。
  console.log('\n  --- 下落の深さ別（起点の25日線乖離） ---')
  for (const [name, lo, hi] of [['浅め (-7〜-10%)', -10, -7], ['深い (-10%以下)', -999, -10]]) {
    const g = signals.filter(s => s.devAtLow > lo && s.devAtLow <= hi)
    if (!g.length) { console.log(`  ${name}: 該当なし`); continue }
    const d = g.filter(s => s.brokeLow).length
    const m = g.filter(s => !s.brokeLow && s.aboveMa).length
    console.log(`  ${name}: ${g.length}件 → ①安値割れ ${(d / g.length * 100).toFixed(0)}% ／ ②回復維持 ${(m / g.length * 100).toFixed(0)}% ／ 20日後中央値 ${med(g.map(s => s.ret20))}%`)
  }

  console.log('\n  --- 個別（新しい順・直近10件） ---')
  for (const s of signals.slice(-10).reverse()) {
    const tag = s.brokeLow ? '① 安値割れ' : (s.aboveMa ? '② 回復維持' : '③ もみ合い')
    console.log(`  ${s.date}  安値${s.lowDate}(乖離${s.devAtLow}%) 反発+${s.bounce}%  → ${tag}  20日後 ${s.ret20 > 0 ? '+' : ''}${s.ret20}%`)
  }
}

const rows = await fetchDaily('%5EN225')
analyze(rows, '日経平均（^N225・21年）')

try {
  const sox = await fetchDaily('%5ESOX')
  analyze(sox, 'フィラデルフィア半導体（^SOX・21年）')
} catch (e) {
  console.warn('\n⚠ SOX取得に失敗:', e.message)
}
