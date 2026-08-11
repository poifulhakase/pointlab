// ──────────────────────────────────────────────────────────────────────────
// ぽいロボ 疑似トレード: Chatwork 連携（通知の送信 ＋ 画像の受け取り）
//
// 🔴 実行主体は GitHub Actions。Vercel の API ルートは経由しない
//    （経路が1本短く、漏洩面も小さい。設計書 §9）。
// 🔴 宛先は運用者本人のルーム1つだけ（法務判断・設計書 §10.1）。
//    room_id / token は環境変数（GitHub Secrets）から読む。コードに書かない。
// ──────────────────────────────────────────────────────────────────────────

const API = 'https://api.chatwork.com/v2'

function need(name) {
  const v = process.env[name]
  if (!v) throw new Error(`環境変数 ${name} が設定されていない`)
  return v
}

async function call(path, { method = 'GET', body, token, raw = false } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'X-ChatWorkToken': token ?? need('CHATWORK_API_TOKEN'),
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body,
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Chatwork ${method} ${path} → HTTP ${res.status} ${text.slice(0, 200)}`)
  }
  if (raw) return res
  // 🔴 Chatwork は「該当なし」を 204 No Content（本文が空）で返す。
  //    ファイルが1枚も無いルームで /files を叩くとこれに当たるので、
  //    そのまま res.json() すると Unexpected end of JSON input で落ちる。
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

// ── 送信 ──────────────────────────────────────────────────────────────────

/**
 * メッセージを送る。
 * @param {string} message 本文
 * @param {object} opts { roomId, token, dryRun }
 */
export async function sendMessage(message, { roomId, token, dryRun = false } = {}) {
  // 🔴 dry-run では宛先を要求しない（設定が無い環境でも配線を確認できるように）
  if (dryRun) {
    const room = roomId ?? process.env.CHATWORK_ROOM_ID ?? '(未設定)'
    console.log(`--- [dry-run] Chatwork room=${room} へ送信する内容 ---`)
    console.log(message)
    console.log('--- ここまで ---')
    return { dryRun: true, message }
  }
  const room = roomId ?? need('CHATWORK_ROOM_ID')
  const body = new URLSearchParams({ body: message }).toString()
  return call(`/rooms/${room}/messages`, { method: 'POST', body, token })
}

/**
 * ファイルを投稿する（ローカルの撮影スクリプトから使う）。
 * 🔴 Chatwork のファイル投稿は multipart/form-data。JSON ではない。
 */
export async function uploadFile({ filePath, message = '', roomId, token } = {}) {
  const fs = await import('node:fs')
  const path = await import('node:path')
  if (!fs.existsSync(filePath)) throw new Error(`ファイルが無い: ${filePath}`)

  const room = roomId ?? need('CHATWORK_ROOM_ID')
  const buf = fs.readFileSync(filePath)
  const name = path.basename(filePath)

  const form = new FormData()
  form.append('file', new Blob([buf]), name)
  if (message) form.append('message', message)

  const res = await fetch(`${API}/rooms/${room}/files`, {
    method: 'POST',
    headers: { 'X-ChatWorkToken': token ?? need('CHATWORK_API_TOKEN') },
    body: form,
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Chatwork ファイル投稿に失敗 HTTP ${res.status} ${text.slice(0, 200)}`)
  }
  return res.json()
}

// ── 受け取り（画像）────────────────────────────────────────────────────────

/**
 * ルームのファイル一覧を新しい順で返す。
 * 🔴 Chatwork の files API は download_url を含まないので、個別に取り直す必要がある。
 */
export async function listFiles({ roomId, token, accountId } = {}) {
  const room = roomId ?? need('CHATWORK_ROOM_ID')
  const q = accountId ? `?account_id=${encodeURIComponent(accountId)}` : ''
  const files = await call(`/rooms/${room}/files${q}`, { token })
  return (files ?? []).sort((a, b) => (b.upload_time ?? 0) - (a.upload_time ?? 0))
}

/**
 * ファイルを取得して base64 で返す。
 * 🔴 ダウンロードURLは短時間で失効するので、取得したらその場で使う（保存しない）。
 */
export async function downloadFile(fileId, { roomId, token } = {}) {
  const room = roomId ?? need('CHATWORK_ROOM_ID')
  const meta = await call(`/rooms/${room}/files/${fileId}?create_download_url=1`, { token })
  if (!meta?.download_url) throw new Error(`download_url が得られなかった (file_id=${fileId})`)

  const res = await fetch(meta.download_url, { signal: AbortSignal.timeout(60000) })
  if (!res.ok) throw new Error(`ファイル取得に失敗 HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())

  return {
    fileId,
    filename: meta.filename ?? '',
    uploadTime: meta.upload_time ?? null,
    mediaType: guessMediaType(meta.filename ?? ''),
    base64: buf.toString('base64'),
    bytes: buf.length,
  }
}

function guessMediaType(filename) {
  const ext = String(filename).toLowerCase().split('.').pop()
  if (ext === 'png') return 'image/png'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'webp') return 'image/webp'
  return 'image/jpeg'
}

/** 画像として扱える拡張子か */
export function isImage(filename) {
  return /\.(png|jpe?g|gif|webp)$/i.test(String(filename ?? ''))
}

/**
 * 直近の画像を用途別に拾う。
 *
 * 🔴 ファイル名で用途を見分ける。運用者が投稿するとき、
 *    チャートには「chart」または「tv」、保有画面には「position」または「hold」を
 *    ファイル名に含める運用にする。判別できないものは「保有画面」として扱う
 *    （証券アプリのキャプチャをそのまま投げる方が多いため）。
 *
 * @returns {{ chart: object|null, position: object|null }}
 */
export async function fetchLatestImages({ roomId, token, maxAgeDays = 10 } = {}) {
  const files = await listFiles({ roomId, token })
  const now = Math.floor(Date.now() / 1000)
  const limit = maxAgeDays * 86400

  let chart = null
  let position = null
  for (const f of files) {
    if (!isImage(f.filename)) continue
    if (f.upload_time && now - f.upload_time > limit) break   // 新しい順なので打ち切ってよい
    const name = String(f.filename).toLowerCase()
    const isChart = /chart|tv|tradingview|チャート/.test(name)
    if (isChart) { if (!chart) chart = f }
    else if (!position) position = f
    if (chart && position) break
  }
  return { chart, position }
}

/** upload_time（秒）から「何日前か」を出す */
export function ageInDays(uploadTime, now = Date.now()) {
  if (!uploadTime) return null
  return Math.max(0, Math.floor((now / 1000 - uploadTime) / 86400))
}

// ── 通知の本文づくり ──────────────────────────────────────────────────────

const SIDE_LABEL = {
  1321: 'ブル1倍（1321 日経225連動）',
  1570: 'ブル2倍（1570 日経レバレッジ）',
  1571: 'ベア1倍（1571 日経インバース）',
  1357: 'ベア2倍（1357 日経ダブルインバース）',
}

/**
 * 毎日の通知本文を組み立てる。
 * 🔴 hold の日も毎日送る（ユーザー決定・2026-08-09）。
 * 🔴 反証（counter）を必ず載せる。判断を鵜呑みにさせないため。
 */
export function buildNotification({ date, decision, execPrice, account, baseline, stats, syncDiff, warnings = [] }) {
  const d = decision ?? {}
  const head = d.action === 'open'
    ? `【ロボ口座】${SIDE_LABEL[d.symbol] ?? d.symbol} を ${d.qty}口 新規建て`
    : d.action === 'close'
      ? `【ロボ口座】${SIDE_LABEL[d.symbol] ?? d.symbol} を手仕舞い`
      : '【ロボ口座】本日は見送り（ポジションなし）'

  const lines = [`[info][title]${head}[/title]`]
  lines.push(`日付: ${date}`)
  if (d.action !== 'hold' && execPrice != null) lines.push(`🔴 執行: 本日の引成（MOC）で発注してください。15:25まで（15:00時点 ${Math.round(execPrice).toLocaleString()}円）`)
  lines.push(`確信度: ${d.confidence_pct ?? '—'}%`)
  lines.push('')
  lines.push(`■ 理由`)
  lines.push(String(d.reason ?? '—'))
  lines.push('')
  lines.push(`■ この判断が外れるとき`)
  lines.push(String(d.counter ?? '—'))

  if (d.user_note) {
    lines.push('')
    lines.push('■ あなたの保有について')
    lines.push(String(d.user_note))
  }

  // 🔴 前回からの変化（あなたが実際にどう動いたか）を先に見せる。
  //    「どれだけ減ったか・増えたか・新規で建てたか」が一目で分かるように。
  if (syncDiff) {
    lines.push('')
    lines.push('■ あなたの保有の変化（前回のキャプチャから）')
    lines.push(syncDiff.note ?? '—')
    if (syncDiff.skipped) lines.push('※ 判断がつかないため口座の同期は見送りました')
  }

  if (baseline) {
    const bl = baseline.side === 'bull' ? 'ブル' : baseline.side === 'bear' ? 'ベア' : 'ノーポジ'
    lines.push('')
    lines.push(`■ 決定論ルール（対照群）: ${bl}`)
  }

  const p = account?.position
  lines.push('')
  lines.push('■ 口座')
  lines.push(p && p.qty > 0
    ? `保有: ${SIDE_LABEL[p.symbol] ?? p.symbol} ${p.qty}口／平均 ${Math.round(p.avg_price).toLocaleString()}円／損切り ${Math.round(p.stop_price).toLocaleString()}円`
    : '保有: なし')
  if (account?.equity != null) lines.push(`評価額: ${Math.round(account.equity).toLocaleString()}円`)
  // 🔴 判断した日には約定していない（買えるのは翌朝の寄り付き）。
  //    ここを書かないと「注文したのに口座が変わっていない」と読めてしまう。
  if (account?.pending?.decision && account.pending.decision.action !== 'hold') {
    lines.push(`本日の引成で執行予定: ${account.pending.decision.action === 'open'
      ? `${SIDE_LABEL[account.pending.decision.symbol] ?? account.pending.decision.symbol} を ${account.pending.decision.qty}口`
      : '手仕舞い'}`)
  }
  if (account?.pending?.stop_exit) lines.push('本日の引成で損切り手仕舞い')

  if (stats?.closed_trades) {
    lines.push('')
    lines.push(`■ 成績（${stats.closed_trades}件）`)
    lines.push(`ロボ: 勝率 ${Math.round((stats.win_rate ?? 0) * 100)}%／期待値 ${Math.round(stats.expectancy ?? 0).toLocaleString()}円／最大DD ${stats.max_drawdown_pct ?? '—'}%`)
    if (stats.baseline) {
      lines.push(`対照群: 勝率 ${Math.round((stats.baseline.win_rate ?? 0) * 100)}%／期待値 ${Math.round(stats.baseline.expectancy ?? 0).toLocaleString()}円／最大DD ${stats.baseline.max_drawdown_pct ?? '—'}%`)
    }
  }

  if (warnings.length) {
    lines.push('')
    lines.push('■ 注意')
    for (const w of warnings) lines.push(`・${w}`)
  }

  lines.push('[/info]')
  return lines.join('\n')
}
