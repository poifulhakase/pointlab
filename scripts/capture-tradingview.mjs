#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────
// ぽいロボ 疑似トレード: TradingView のチャートを撮って Chatwork に投げる
//
// 🔴 これはローカルPCで動かすもの。GitHub Actions では動かない
//    （無人環境にログイン済みブラウザが無い。設計書 §11.5）。
//    判断・記録・通知はクラウド（Actions）のまま。ここは撮影と投稿だけ。
// 🔴 撮影に失敗しても判断は止まらない。画像が無ければ数値だけで判断される。
//
// 初回だけ手動ログインが必要:
//   node scripts/capture-tradingview.mjs --login
//   → ブラウザが開くのでログインし、完了したらターミナルで Enter
//   以降は userDataDir にセッションが残るので自動で撮れる
//
// 使い方:
//   node scripts/capture-tradingview.mjs           … 撮影して Chatwork へ投稿
//   node scripts/capture-tradingview.mjs --dry     … 撮るだけ（投稿しない）
//   node scripts/capture-tradingview.mjs --login   … 初回ログイン
// ──────────────────────────────────────────────────────────────────────────

import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

const args = process.argv.slice(2)
const DRY = args.includes('--dry')
const LOGIN = args.includes('--login')
// 休場日でも撮る（配線確認用）。ログイン時は判定そのものを飛ばす。
const FORCE = args.includes('--force') || LOGIN

// 🔴 ログイン状態はここに残る。.gitignore に入れてありコミットしない。
const USER_DATA_DIR = path.resolve(process.cwd(), '.tradingview-session')
const OUT_DIR = path.resolve(process.cwd(), '.captures')

// 管理者本人の保存済みレイアウト（セクター画面と同じもの）。日足で開く。
// 🔴 **ログイン不要の公開チャートを既定にする**（2026-08-10 変更）。
//    保存レイアウト（`/chart/ecEzo0V0/`）は**ログインしないと開けない**が、
//    Google は自動操作ブラウザからのログインを弾く（`Chrome for Testing` 判定）。
//    メール＋パスワードなら入れるが、**セッションが切れるたびに運用が止まる**。
//    公開チャートなら日足のローソクがそのまま撮れて、右にNI225/DJI/SPX/DXY/VIXの現値も入る。
//    🔵 代償＝保存レイアウトのインジケーター（BB等）は使えない。必要になったら
//       ログインして `ROBO_CHART_URL=https://jp.tradingview.com/chart/ecEzo0V0/?symbol=INDEX%3ANKY&interval=D`
//       に差し替える（`.env.local` に置けばよい）。
const CHART_URL = process.env.ROBO_CHART_URL
  ?? 'https://jp.tradingview.com/chart/?symbol=INDEX%3ANKY&interval=D'

const log = (s = '') => console.log(s)

async function loadPlaywright() {
  try {
    return await import('playwright')
  } catch {
    log('🔴 playwright が入っていません。ローカルで次を実行してください:')
    log('   npm install -D playwright')
    log('   npx playwright install chromium')
    process.exit(1)
  }
}

function waitEnter(message) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(message, () => { rl.close(); resolve() })
  })
}

async function main() {
  // ── 0) 営業日か（2026-08-10 追加）──
  // 🔴 東証が閉まっている日は撮らない。判断側（robo-trade）は休場日に何もしないので、
  //    撮っても使われないまま Chatwork に画像だけが積まれる。
  //    毎日16:00に自動実行する運用にしたので、ここで止めないと祝日ぶんが毎回流れる。
  // 🔵 判断側と同じ `marketStatus` を使う（休場判定の単一情報源）。
  if (!FORCE) {
    const { marketStatus, todayJst } = await import('./roboCalendar.mjs')
    const market = marketStatus(todayJst())
    if (!market.open) {
      log(`[0] ${market.date} は東証が休場（${market.reason}）→ 撮影しない`)
      return
    }
    log(`[0] ${market.date} は営業日`)
  }

  const { chromium } = await loadPlaywright()
  fs.mkdirSync(USER_DATA_DIR, { recursive: true })
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const ctx = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: !LOGIN,                        // ログイン時だけ画面を出す
    viewport: { width: 1600, height: 900 },
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
  })

  try {
    const page = ctx.pages()[0] ?? await ctx.newPage()
    log(`[1] チャートを開く: ${CHART_URL}`)
    await page.goto(CHART_URL, { waitUntil: 'domcontentloaded', timeout: 90000 })

    if (LOGIN) {
      log('')
      log('ブラウザで TradingView にログインしてください。')
      log('（ログイン済みならそのまま Enter を押してください）')
      await waitEnter('完了したら Enter → ')
      log('セッションを保存しました。次回からは自動で撮れます。')
      return
    }

    // チャートの描画を待つ。
    // 🔴 **canvas が出ないときは撮れていない**＝チャートが1本も描かれていない。
    //    以前は「撮れないより撮る」で先へ進めていたが、それだと**ログインが切れた日から毎日
    //    エラー画面を Chatwork へ投げ続ける**（平日16:00の自動実行にしたので毎日流れる）。
    //    AI はそれをチャートとして読むので、黙って判断が濁る。ここで止める。
    log('[2] 描画を待つ...')
    let drawn = true
    try {
      await page.waitForSelector('canvas', { timeout: 45000 })
    } catch {
      drawn = false
    }
    await page.waitForTimeout(8000)

    const date = new Date().toISOString().slice(0, 10)
    const file = path.join(OUT_DIR, `chart_${date}.png`)
    await page.screenshot({ path: file, fullPage: false })
    log(`[3] 撮影: ${file}`)

    // 🔴 ログイン切れの検知。
    //    以前は「ログイン」を含み「チャート」を含まないことを条件にしていたが、
    //    実際のエラー画面は「このチャートレイアウトを開くことができません…ログインする必要があります」で
    //    **両方の語を含むため検知をすり抜けた**（2026-08-10 の空撃ちで発覚）。
    //    文言に頼らず、**canvas が描かれたか**で判定する。
    const bodyText = (await page.textContent('body').catch(() => '')) ?? ''
    const blocked = /開くことができません|Can't open|ログインする必要があります/.test(bodyText)

    if (!drawn || blocked) {
      log('')
      log('  🔴 チャートが描かれていません（ログイン切れの可能性が高い）。')
      log('  🔴 中身が無い画像を投げると AI がそれを読んでしまうので、投稿しません。')
      log('     直し方: npm run capture-chart -- --login')
      log(`     撮れたものは確認用に残してあります: ${file}`)
      return
    }

    if (DRY) {
      log('[4] --dry のため投稿しない')
      return
    }

    const { uploadFile } = await import('./chatwork.mjs')
    await uploadFile({
      filePath: file,
      message: `[info][title]TradingView チャート ${date}[/title]ロボ口座の判断材料です（自動投稿）[/info]`,
    })
    log('[4] Chatwork へ投稿した')
  } finally {
    await ctx.close()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
