#!/usr/bin/env node
// 東証が開いているかを**終了コード**で返す（0＝営業日／1＝休場）。
//
// 🔵 何のために：GitHub Actions で「休場日は待たずに終わる」ため。
//    判断は 15:00 JST ちょうどに出したいので早めに起動して待つ作りにしたが、
//    休場判定を待ったあとに行うと、**祝日でも2時間ランナーを占有してから
//    『何もしない』と分かる**ことになる。待つ前にここで打ち切る。
//
//   node scripts/market-open.mjs   … 営業日なら 0、休場なら 1
import { marketStatus, todayJst } from './roboCalendar.mjs'

const s = marketStatus(todayJst())
console.log(s.open ? `${s.date} は営業日` : `${s.date} は東証が休場（${s.reason}）`)
process.exit(s.open ? 0 : 1)
