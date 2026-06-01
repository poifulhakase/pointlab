#!/usr/bin/env node
/**
 * 予約システム API レベル E2E テスト
 * ───────────────────────────────────────────────────────────────────────────
 * 本番（または指定の）デプロイの予約サーバー API を「通し」で検証する：
 *   1. テスト用ユーザーを Admin SDK で発行 → idToken を取得
 *   2. テスト用スロットを Firestore に作成（Admin SDK・ルールをバイパス）
 *   3. /api/create-booking で予約作成 → スロットがロックされ予約が pending になるか
 *   4. 同一ユーザーで2件目を予約 → 「同時1件まで」で 409 LIMIT_EXCEEDED になるか
 *   5. /api/cancel-booking でキャンセル → 予約が cancelled_user・スロットが解放されるか
 *   6. 後始末：作成したテスト予約 / スロット / レート制限カウンタ / ユーザーを削除
 *
 * 通知（メール・プッシュ）は発火させない（create/cancel-booking のみを叩く）。
 * テストデータは finally で必ず削除する。
 *
 * 必要な認証情報：
 *   サービスアカウント JSON（Admin SDK 用） … 次のいずれかで渡す:
 *     --sa <path> / 環境変数 GOOGLE_APPLICATION_CREDENTIALS / FIREBASE_SERVICE_ACCOUNT(インライン)
 *     ※ `vercel env pull` は Sensitive 値を空で返すので、Firebase Console で取得した
 *       JSON ファイルを --sa で渡すのが確実。
 *   VITE_FIREBASE_API_KEY … Web API キー（カスタムトークン→idToken 交換用）。.env.local にあり
 * 任意：
 *   E2E_BASE_URL          … 既定 https://pointlab.vercel.app
 *
 * 実行例：
 *   # API キー等は .env.local / .env.e2e.local から読む。サービスアカウントは JSON ファイルで渡す
 *   npm run e2e:booking -- --sa "C:\\path\\to\\pointlab-96310-xxxxx.json"
 *
 * オプション：
 *   --sa <path>  サービスアカウント JSON のパス
 *   --keep       後始末をスキップ（デバッグ用）
 */

import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'

const BASE   = process.env.E2E_BASE_URL || 'https://pointlab.vercel.app'
const ORIGIN = 'https://pointlab.vercel.app' // create/cancel-booking は Origin 検証あり
// Vercel 保存値の末尾に \r\n 等のゴミが混入していても、Firebase Web キー（AIza + 35文字）
// だけを抽出する。trim では取り切れない（リテラルの \r\n は文字 r/n を含むため）。
const _rawKey = process.env.VITE_FIREBASE_API_KEY || ''
const _keyMatch = _rawKey.match(/AIza[0-9A-Za-z_-]{35}/)
const API_KEY = _keyMatch ? _keyMatch[0] : _rawKey.trim()
const KEEP    = process.argv.includes('--keep')

// サービスアカウントの解決順:
//   1) FIREBASE_SERVICE_ACCOUNT（インライン JSON・非空）
//   2) --sa <path> で指定した JSON ファイル
//   3) GOOGLE_APPLICATION_CREDENTIALS のファイルパス
// ※ `vercel env pull` は Sensitive な値を空で返すため、ローカルでは通常 JSON ファイル指定になる。
function loadServiceAccount() {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT
  if (inline && inline.trim()) {
    try { return JSON.parse(inline) }
    catch (e) { throw new Error('FIREBASE_SERVICE_ACCOUNT の JSON 解析に失敗: ' + e.message) }
  }
  const argIdx = process.argv.indexOf('--sa')
  const saPath = (argIdx !== -1 ? process.argv[argIdx + 1] : null) || process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (saPath && saPath.trim()) {
    try { return JSON.parse(readFileSync(saPath, 'utf8')) }
    catch (e) { throw new Error(`サービスアカウント JSON の読み込みに失敗 (${saPath}): ` + e.message) }
  }
  return null
}

// ── 簡易アサート ───────────────────────────────────────────────────────────
let passed = 0
let failed = 0
function check(label, cond, detail = '') {
  if (cond) { passed++; console.log(`  \x1b[32m✓\x1b[0m ${label}`) }
  else      { failed++; console.log(`  \x1b[31m✗ ${label}\x1b[0m${detail ? ` — ${detail}` : ''}`) }
}

// ── 環境チェック ───────────────────────────────────────────────────────────
function requireEnv() {
  let sa = null
  try { sa = loadServiceAccount() } catch (e) { console.error(`\x1b[31m${e.message}\x1b[0m`); process.exit(2) }
  if (!sa || !API_KEY) {
    console.error('\x1b[31m認証情報が不足しています\x1b[0m')
    if (!sa) {
      console.error('  ・サービスアカウント未指定。vercel env pull は Sensitive 値を空で返すため、')
      console.error('    Firebase Console で取得した JSON ファイルを次のいずれかで渡してください:')
      console.error('      --sa <service-account.json のパス>')
      console.error('      または環境変数 GOOGLE_APPLICATION_CREDENTIALS / FIREBASE_SERVICE_ACCOUNT')
    }
    if (!API_KEY) console.error('  ・VITE_FIREBASE_API_KEY が未設定（.env.e2e.local または .env.local に含まれます）')
    console.error('\n  例: npm run e2e:booking -- --sa "C:\\path\\to\\pointlab-96310-xxxxx.json"')
    process.exit(2)
  }
  return sa
}

// ── API 呼び出し（idToken は body に入れる仕様） ────────────────────────────
async function callApi(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body:    JSON.stringify(body),
  })
  let json = {}
  try { json = await res.json() } catch { /* 空ボディ */ }
  return { status: res.status, ok: res.ok, json }
}

// ── カスタムトークン → idToken 交換 ────────────────────────────────────────
async function mintIdToken(uid) {
  const customToken = await admin.auth().createCustomToken(uid)
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  )
  const json = await res.json()
  if (!res.ok) throw new Error('signInWithCustomToken 失敗: ' + JSON.stringify(json))
  return json.idToken
}

// JST の日付文字列（YYYY-MM-DD）を daysAhead 日後で生成
function jstDateStr(daysAhead) {
  return new Date(Date.now() + 9 * 3600_000 + daysAhead * 86400_000).toISOString().slice(0, 10)
}

async function main() {
  const serviceAccount = requireEnv()
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
  const db = admin.firestore()

  const stamp = Date.now()
  const uid   = `e2e-test-${stamp}`
  const date  = jstDateStr(3) // 3日後（2週間枠内・確実に未来）

  // 後始末対象を記録
  const created = { uid, slotA: null, slotB: null, bookingId: null }

  console.log(`\n▶ 予約システム E2E（対象: ${BASE}）`)
  console.log(`  テストユーザー: ${uid} / テスト日: ${date}\n`)

  try {
    // 0) idToken 取得
    const idToken = await mintIdToken(uid)
    check('テスト用 idToken を取得', !!idToken)

    // 1) テストスロット A / B を作成（Admin SDK・ルールバイパス）
    const slotARef = db.collection('slots').doc()
    const slotBRef = db.collection('slots').doc()
    created.slotA = slotARef.id
    created.slotB = slotBRef.id
    await slotARef.set({ date, startTime: '10:00', isBooked: false, createdAt: new Date().toISOString() })
    await slotBRef.set({ date, startTime: '11:00', isBooked: false, createdAt: new Date().toISOString() })
    check('テストスロット A / B を作成', true)

    // 2) 予約作成（スロット A）
    const r1 = await callApi('/api/create-booking', {
      idToken, slotId: created.slotA, userDisplayName: 'E2Eテスト', userEmail: 'e2e@example.com',
    })
    check('create-booking が 200 を返す', r1.status === 200, `status=${r1.status} body=${JSON.stringify(r1.json)}`)
    created.bookingId = r1.json.bookingId
    check('bookingId が返る', !!created.bookingId)

    // 3) Firestore 状態を検証（予約=pending / スロットA=ロック）
    if (created.bookingId) {
      const bSnap = await db.collection('bookings').doc(created.bookingId).get()
      check('予約ドキュメントが pending で作成された',
        bSnap.exists && bSnap.data().status === 'pending' && bSnap.data().userId === uid,
        `data=${JSON.stringify(bSnap.data())}`)
    }
    const slotAAfter = await slotARef.get()
    check('スロット A が isBooked=true にロックされた', slotAAfter.data()?.isBooked === true)

    // 4) 二重予約防止（同一ユーザーで2件目 → 409 LIMIT_EXCEEDED）
    const r2 = await callApi('/api/create-booking', {
      idToken, slotId: created.slotB, userDisplayName: 'E2Eテスト', userEmail: 'e2e@example.com',
    })
    check('2件目の予約が 409 LIMIT_EXCEEDED で拒否される',
      r2.status === 409 && r2.json.error === 'LIMIT_EXCEEDED',
      `status=${r2.status} body=${JSON.stringify(r2.json)}`)
    const slotBAfter = await slotBRef.get()
    check('拒否されたスロット B はロックされていない', slotBAfter.data()?.isBooked === false)

    // 5) キャンセル
    const r3 = await callApi('/api/cancel-booking', { idToken, bookingId: created.bookingId })
    check('cancel-booking が 200 を返す', r3.status === 200, `status=${r3.status} body=${JSON.stringify(r3.json)}`)

    // 6) キャンセル後の状態検証（予約=cancelled_user / スロットA=解放）
    if (created.bookingId) {
      const bSnap2 = await db.collection('bookings').doc(created.bookingId).get()
      check('予約が cancelled_user になった', bSnap2.data()?.status === 'cancelled_user',
        `status=${bSnap2.data()?.status}`)
    }
    const slotAReleased = await slotARef.get()
    check('スロット A が解放された（isBooked=false）', slotAReleased.data()?.isBooked === false)
  } catch (e) {
    failed++
    console.log(`  \x1b[31m✗ 例外: ${e.message}\x1b[0m`)
  } finally {
    // ── 後始末 ───────────────────────────────────────────────────────────
    if (KEEP) {
      console.log('\n(--keep 指定のため後始末をスキップしました)')
    } else {
      console.log('\n▶ 後始末')
      const db = admin.firestore()
      const safeDel = async (label, fn) => { try { await fn(); console.log(`  ✓ ${label}`) } catch (e) { console.log(`  ! ${label} 失敗: ${e.message}`) } }
      if (created.bookingId) await safeDel('テスト予約を削除', () => db.collection('bookings').doc(created.bookingId).delete())
      if (created.slotA)     await safeDel('テストスロット A を削除', () => db.collection('slots').doc(created.slotA).delete())
      if (created.slotB)     await safeDel('テストスロット B を削除', () => db.collection('slots').doc(created.slotB).delete())
      await safeDel('レート制限カウンタを削除', async () => {
        await db.collection('rateLimits').doc(`${uid}__create-booking`).delete()
        await db.collection('rateLimits').doc(`${uid}__cancel-booking`).delete()
      })
      await safeDel('テストユーザーを削除', () => admin.auth().deleteUser(uid))
    }

    console.log(`\n─────────────────────────────`)
    console.log(`結果: \x1b[32m${passed} passed\x1b[0m / ${failed ? `\x1b[31m${failed} failed\x1b[0m` : '0 failed'}`)
    console.log(`─────────────────────────────\n`)
    process.exit(failed ? 1 : 0)
  }
}

main()
