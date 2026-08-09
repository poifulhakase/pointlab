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

// 🔴 ログイン状態はここに残る。.gitignore に入れてありコミットしない。
const USER_DATA_DIR = path.resolve(process.cwd(), '.tradingview-session')
const OUT_DIR = path.resolve(process.cwd(), '.captures')

// 管理者本人の保存済みレイアウト（セクター画面と同じもの）。日足で開く。
const CHART_URL = process.env.ROBO_CHART_URL
  ?? 'https://jp.tradingview.com/chart/ecEzo0V0/?symbol=INDEX%3ANKY&interval=D'

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

    // チャートの描画を待つ。要素が出ないときも一定時間で進む（撮れないより撮る）
    log('[2] 描画を待つ...')
    try {
      await page.waitForSelector('canvas', { timeout: 45000 })
    } catch {
      log('  ⚠ canvas が見つからないまま進む（ログイン切れの可能性）')
    }
    await page.waitForTimeout(8000)

    const date = new Date().toISOString().slice(0, 10)
    const file = path.join(OUT_DIR, `chart_${date}.png`)
    await page.screenshot({ path: file, fullPage: false })
    log(`[3] 撮影: ${file}`)

    // ログイン切れの検知（撮れてはいるが中身がログイン画面のことがある）
    const bodyText = await page.textContent('body').catch(() => '')
    if (/ログイン|Sign in|Log in/.test(bodyText ?? '') && !/チャート|Chart/.test(bodyText ?? '')) {
      log('  🔴 ログイン画面が写っている可能性があります。`--login` で入り直してください。')
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
