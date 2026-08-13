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
import { loadLocalEnv } from './loadLocalEnv.mjs'

// 🔴 **これが無いと平日16:00の自動実行で投稿できない**（2026-08-10 に踏んだ）。
//    撮影はローカルPCで動くので、GitHub Secrets は使えない。Chatwork のトークンと
//    ルームIDは `.env.local` から読む。判断側（robo-trade.mjs）と同じ読み方に揃える。
loadLocalEnv()

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
//
// 🔴 **シンボルは日経225先物（SGX:NK1!）**（2026-08-13 変更）。
//    現物指数（INDEX:NKY）には**出来高データが無い**ため、出来高が描けなかった。
//    波動の書の巻四（出来高の型）を読ませる以上、出来高の無い画像では意味が半分になる。
//    🔵 先物の出来高は現物の売買代金とは別物だが、「盛り上がったか・枯れたか」を見るには足りる。
const CHART_URL = process.env.ROBO_CHART_URL
  ?? 'https://jp.tradingview.com/chart/?symbol=SGX%3ANK1%21&interval=D'

// 🔴 **週足も撮る**（2026-08-11 追加・ユーザー判断）。
//    上位トレンドや抵抗ラインは幾何なので、数値にするより見せたほうが早い、という判断。
// 🔴 ただし**位置づけを間違えないこと**。画像から読んだものは過去に遡って再現できず、
//    **検証できない**。効いたか効かなかったかを永久に測れない材料なので、
//    「AIの読みの補助」までに留め、**検証したいものをチャートに任せない**。
//    仕組みで効かせたいもの（上位トレンドのフィルターなど）は数値で定義して測ること。
const WEEKLY_URL = process.env.ROBO_CHART_URL_W
  ?? CHART_URL.replace(/interval=[^&]*/, 'interval=W')

// 撮る対象。file 名の接尾辞と、Chatwork に出す名前。
const SHOTS = [
  { key: 'D', url: CHART_URL,  label: '日足' },
  { key: 'W', url: WEEKLY_URL, label: '週足' },
]

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

    const date = new Date().toISOString().slice(0, 10)
    const shots = []

    // 🔴 日足と週足を順に撮る。
    //    **canvas が出ないときは撮れていない**＝チャートが1本も描かれていない。
    //    以前は「撮れないより撮る」で先へ進めていたが、それだと**ログインが切れた日から毎日
    //    エラー画面を Chatwork へ投げ続ける**（平日の自動実行なので毎日流れる）。
    //    AI はそれをチャートとして読むので、黙って判断が濁る。ここで止める。
    for (const shot of SHOTS) {
      if (shot.url !== CHART_URL) {
        log(`[1] チャートを開く（${shot.label}）: ${shot.url}`)
        await page.goto(shot.url, { waitUntil: 'domcontentloaded', timeout: 90000 })
      }
      log(`[2] 描画を待つ（${shot.label}）...`)
      let drawn = true
      try {
        await page.waitForSelector('canvas', { timeout: 45000 })
      } catch {
        drawn = false
      }
      // 🔴 AIに読ませる画像なので、**チャート以外は写さない**（2026-08-13 ユーザー指示）。
      //    右のウォッチリストや左の描画ツールは判断材料にならないうえ、
      //    銘柄名や価格が並ぶぶん、AIがそちらを読みに行く余地を作る。
      // 🔵 表示を消したあと resize を投げるのは、TradingView が自前で幅を測り直して
      //    チャートを広げてくれるため（消すだけだと右に空白が残る）。
      await page.addStyleTag({
        content: `
          .layout__area--right, .widgetbar-wrap,
          .layout__area--left, [data-name="drawing-toolbar"] { display: none !important; }
        `,
      })
      await page.evaluate(() => window.dispatchEvent(new Event('resize')))

      await page.waitForTimeout(8000)

      const file = path.join(OUT_DIR, `chart_${shot.key}_${date}.png`)
      // 🔵 パネルを消しただけだとチャートは広がらず右に余白が残るので、
      //    **中央のチャート領域だけを切り出して**撮る。取れなければ全体にフォールバックする。
      const area = page.locator('.layout__area--center').first()
      let clipped = false
      try {
        if (await area.count()) { await area.screenshot({ path: file }); clipped = true }
      } catch { clipped = false }
      if (!clipped) await page.screenshot({ path: file, fullPage: false })
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
        log(`  🔴 チャートが描かれていません（${shot.label}・ログイン切れの可能性が高い）。`)
        log('  🔴 中身が無い画像を投げると AI がそれを読んでしまうので、投稿しません。')
        log('     直し方: npm run capture-chart -- --login')
        log(`     撮れたものは確認用に残してあります: ${file}`)
        return
      }
      shots.push({ ...shot, file })
    }

    if (DRY) {
      log(`[4] --dry のため投稿しない（${shots.length}枚 撮影済み）`)
      return
    }

    // 🔴 未設定のまま uploadFile に入ると分かりにくい例外で落ちる。
    //    自動実行では画面を誰も見ていないので、ここで理由をはっきり出して終わる。
    if (!process.env.CHATWORK_API_TOKEN || !process.env.CHATWORK_ROOM_ID) {
      log('')
      log('  🔴 Chatwork の設定が無いので投稿できません（撮影はできています）。')
      log('     .env.local に次の2行を足してください:')
      log('       CHATWORK_API_TOKEN=...')
      log('       CHATWORK_ROOM_ID=...')
      log('     🔵 GitHub Secrets は Actions 専用です。撮影はローカルPCで動くので届きません。')
      log(`     撮れたものはここにあります: ${shots.map(s => s.file).join(' / ')}`)
      return
    }

    const { uploadFile } = await import('./chatwork.mjs')
    for (const shot of shots) {
      await uploadFile({
        filePath: shot.file,
        message: `[info][title]TradingView ${shot.label} ${date}[/title]ロボ口座の判断材料です（自動投稿）[/info]`,
      })
    }
    log(`[4] Chatwork へ投稿した（${shots.length}枚）`)
  } finally {
    await ctx.close()
  }
}

main().catch(e => { console.error(e); process.exit(1) })
