#!/usr/bin/env node
// 組み合わせ構造の3シナリオ・モデル（R&D・全て“仮定”＝後で調整可）
// A現物(高配当/優待/バリュー)＋現金クッション＋B信用ロング(プレイブック)＋ベア保険、を
// 強気年/フラット年/−35%暴落 で評価し、暴落時の委託保証金維持率(追証)もチェック。
// 使い方: node scripts/model-portfolio.mjs

const yen = n => '¥' + Math.round(n).toLocaleString()
const pct = n => (n >= 0 ? '+' : '') + (Math.round(n * 1000) / 10) + '%'

// ── 共通パラメータ（仮定・調整可）──
const OWN   = 10_000_000   // 自己資金
const A     = 8_000_000    // A現物(高配当/優待/バリュー)
const CASH  = 2_000_000    // 現金クッション
const BEAR  = 2_000_000    // ベア保険(薄く・2倍ETF想定)
const KAKEME = 0.8         // 代用掛け目
const MAINT  = 0.25        // 追証ライン(維持率25%)
const KINRI  = 0.027       // 信用買い金利/年
const TAX    = 0.20        // 信用損益への課税(簡易・利益にのみ)
const A_INCOME = 0.05      // A配当3.5%+優待1.5%

// シナリオ別の動き（仮定）
const SC = {
  '強気年(日経+20%)':   { Acap: +0.12, B: +0.20, bear: -0.30 },  // バリューはβ0.6/ベア2倍は出血
  'フラット年(日経0%)': { Acap:  0.00, B: +0.08, bear: -0.12 },  // レンジ・ベアは減価
  '暴落(日経-35%)':     { Acap: -0.245, B: -0.18, bear: +0.70 }, // Aはβ0.7で-24.5%/Bはトレンド退出で-18%/ベア2倍+70%
}

function evalYear(Bnotional, sc, useBear) {
  const bearN = useBear ? BEAR : 0
  const aInc = A * A_INCOME
  const aCap = A * sc.Acap
  const bGross = Bnotional * sc.B
  const bInt = -Bnotional * KINRI
  const bearPL = bearN * sc.bear
  let trading = bGross + bInt + bearPL
  const tradingAfterTax = trading > 0 ? trading * (1 - TAX) : trading
  const total = aInc + aCap + tradingAfterTax
  return { total, ret: total / OWN, aInc, aCap, bGross, bInt, bearPL }
}

// 暴落トラフでの委託保証金維持率
function maintRate(Bnotional, useBear) {
  const bearN = useBear ? BEAR : 0
  const sc = SC['暴落(日経-35%)']
  const aTrough = A * (1 + sc.Acap)                 // A評価額(下落後)
  const margin = CASH + aTrough * KAKEME            // 現金+代用×掛け目
  const tategyokuPL = Bnotional * sc.B + bearN * sc.bear  // 建玉評価損益
  const tategyoku = Bnotional + bearN
  return (margin + tategyokuPL) / tategyoku
}

function report(label, Bnotional) {
  console.log(`\n========== ${label}：B信用ロング ${yen(Bnotional)}（自己資金の${(Bnotional/OWN).toFixed(1)}倍）==========`)
  for (const [name, sc] of Object.entries(SC)) {
    const r = evalYear(Bnotional, sc, true)
    console.log(`  ${name.padEnd(18)} 年間リターン ${pct(r.ret).padStart(7)}  (A収入${yen(r.aInc)} A値上${yen(r.aCap)} B${yen(r.bGross)} 金利${yen(r.bInt)} ベア${yen(r.bearPL)})`)
  }
  const mWith = maintRate(Bnotional, true)
  const mNo = maintRate(Bnotional, false)
  const ok = mWith >= MAINT
  console.log(`  ── 暴落時 委託保証金維持率：${(mWith*100).toFixed(1)}% （ベア保険なしだと ${(mNo*100).toFixed(1)}%）／追証ライン${MAINT*100}%`)
  console.log(`     → ${ok ? '✅ 生存（追証なし）' : '🔴 追証発生＝強制ロスカット＝退場'}`)
}

console.log(`自己資金${yen(OWN)} ＝ A現物${yen(A)} ＋ 現金クッション${yen(CASH)} ／ ベア保険${yen(BEAR)}（薄く）`)
console.log(`仮定：A収入${A_INCOME*100}%・掛け目${KAKEME}・金利${KINRI*100}%・税${TAX*100}%・追証${MAINT*100}%`)

report('【守】保守的レバ', 14_000_000)   // B=1.4倍
report('【攻】50%狙いレバ', 26_000_000)  // B=2.6倍

console.log('\n※全て仮定値。強気年のA+12%/B+20%は“良い年”の数字。暴落のA-24.5%(β0.7)/B-18%も仮定。')
console.log('※維持率=(現金+代用評価×掛け目+建玉評価損益)/建玉。掛け目は暴落で切られる前提だと更に厳しい。')
