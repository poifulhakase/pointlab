// 予約通知API（メール／プッシュ）の入口ガード。
//
// 🔴 ここは「誰でもメールを送れた」不具合の再発防止テスト（2026-08-16）。
//    とくに **本文の userEmail を宛先にしない** ことを固定する。
//    ここが緩むと、任意のアドレスに「ぽいロボ」名義のメールを送れる踏み台になる。

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
// @ts-expect-error — api/*.js に型定義は無い（サーバー側は素の JS）
import { authorizeBookingNotify } from '../../../api/_bookingAuth.js'

type Gate = {
  error?: string
  status?: number
  uid?: string
  isAdmin?: boolean
  booking?: { userEmail: string; userDisplayName: string; adminMessage: string; date: string }
}

const SERVER_BOOKING = {
  userId: 'user-1',
  userDisplayName: '本人',
  userEmail: 'owner@example.com',
  date: '2026-09-01',
  startTime: '20:00',
  status: 'pending',
  adminMessage: '',
}

/** Firestore の代わり。予約1件だけ持つ */
function fakeDb(exists = true) {
  return {
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists, data: () => SERVER_BOOKING }),
      }),
    }),
    // レート制限は別テスト。ここでは常に通す（rateLimit は例外時フェイルオープン）
    runTransaction: async () => { throw new Error('skip rate limit') },
  }
}

/** idToken 検証の代わり */
function fakeAuth(decoded: { uid: string; email?: string } | null) {
  return {
    verifyIdToken: async () => {
      if (!decoded) throw new Error('invalid')
      return decoded
    },
  }
}

const reqWith = (tokenPresent = true) => ({
  headers: tokenPresent ? { authorization: 'Bearer dummy' } : {},
})

/** 攻撃者が差し込んでくる想定の本文（宛先を自分に書き換えている） */
const ATTACKER_BODY = {
  type: 'request',
  booking: {
    id: 'book-1',
    userEmail: 'attacker@evil.example',
    userDisplayName: '<script>',
    date: '2099-01-01',
    adminMessage: '好きな文面',
  },
}

const call = (args: Record<string, unknown>): Promise<Gate> =>
  authorizeBookingNotify({ action: 'test', ...args }) as Promise<Gate>

describe('authorizeBookingNotify', () => {
  // 🔵 `process` を直接触ると本番ビルド側の tsc（node の型を入れていない）が落ちるので
  //    vitest の stubEnv を使う。
  beforeEach(() => {
    vi.stubEnv('ADMIN_UID', 'admin-uid')
    vi.stubEnv('ADMIN_EMAIL', 'admin@example.com')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('トークンが無ければ 401', async () => {
    const r = await call({
      req: reqWith(false), db: fakeDb(), auth: fakeAuth({ uid: 'user-1' }), body: ATTACKER_BODY,
    })
    expect(r.status).toBe(401)
  })

  it('トークンが不正なら 401', async () => {
    const r = await call({
      req: reqWith(), db: fakeDb(), auth: fakeAuth(null), body: ATTACKER_BODY,
    })
    expect(r.status).toBe(401)
  })

  it('🔴 宛先は本文ではなく予約ドキュメントから取る（踏み台にできない）', async () => {
    const r = await call({
      req: reqWith(), db: fakeDb(), auth: fakeAuth({ uid: 'user-1' }), body: ATTACKER_BODY,
    })
    expect(r.error).toBeUndefined()
    expect(r.booking?.userEmail).toBe('owner@example.com')
    expect(r.booking?.userDisplayName).toBe('本人')
    expect(r.booking?.date).toBe('2026-09-01')
    // 一般ユーザーが管理者の一言を差し込むこともできない
    expect(r.booking?.adminMessage).toBe('')
  })

  it('他人の予約には送れない（403）', async () => {
    const r = await call({
      req: reqWith(), db: fakeDb(), auth: fakeAuth({ uid: 'someone-else' }), body: ATTACKER_BODY,
    })
    expect(r.status).toBe(403)
  })

  it('confirm / cancel_admin は管理者だけ（403）', async () => {
    for (const type of ['confirm', 'cancel_admin']) {
      const r = await call({
        req: reqWith(), db: fakeDb(), auth: fakeAuth({ uid: 'user-1' }),
        body: { ...ATTACKER_BODY, type },
      })
      expect(r.status).toBe(403)
    }
  })

  it('管理者は confirm を送れて、一言も通る', async () => {
    const r = await call({
      req: reqWith(), db: fakeDb(), auth: fakeAuth({ uid: 'admin-uid', email: 'admin@example.com' }),
      body: { ...ATTACKER_BODY, type: 'confirm', booking: { id: 'book-1', adminMessage: 'お待ちしています' } },
    })
    expect(r.isAdmin).toBe(true)
    expect(r.booking?.adminMessage).toBe('お待ちしています')
    expect(r.booking?.userEmail).toBe('owner@example.com')
  })

  it('知らない種類は 400', async () => {
    const r = await call({
      req: reqWith(), db: fakeDb(), auth: fakeAuth({ uid: 'user-1' }),
      body: { ...ATTACKER_BODY, type: 'anything' },
    })
    expect(r.status).toBe(400)
  })

  it('予約IDが無ければ 400 / 予約が無ければ 404', async () => {
    const noId = await call({
      req: reqWith(), db: fakeDb(), auth: fakeAuth({ uid: 'user-1' }),
      body: { type: 'request', booking: { userEmail: 'x@example.com' } },
    })
    expect(noId.status).toBe(400)

    const missing = await call({
      req: reqWith(), db: fakeDb(false), auth: fakeAuth({ uid: 'user-1' }), body: ATTACKER_BODY,
    })
    expect(missing.status).toBe(404)
  })

  it('レート制限に掛かったら 429', async () => {
    const db = { ...fakeDb(), runTransaction: async () => false }
    const r = await call({
      req: reqWith(), db, auth: fakeAuth({ uid: 'user-1' }), body: ATTACKER_BODY,
    })
    expect(r.status).toBe(429)
  })
})
