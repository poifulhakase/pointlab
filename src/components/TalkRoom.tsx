import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import styles from './TalkRoom.module.css'
import {
  dayLabel, deleteMessage, fetchImage, getName, getSoundOn, getUid, isSameDay,
  AI_NAME, AI_UID, askAi, errorStatus, getPass, linkify, notifyPeer, peerState, quoteText, randomId,
  registerDevice, sendMessage,
  setName as saveName, setSoundOn, shrinkImage, timeLabel,
  touchMember, watchMembers, watchMessages,
  type TalkMember, type TalkMessage,, canRemember } from '../utils/talkRoom'

/**
 * 一時トークルーム（LINE風）。
 *
 * 🔴 ぽいロボ本体とは無関係。秘密のハッシュを直接開いたときだけ `main.tsx` が描画する
 *    （ナビ・リンクからは辿り着けない）。詳しくは `utils/talkRoom.ts` の頭に書いてある。
 *
 * 使い勝手で押さえたところ：
 *   - 送った瞬間に自分の画面には出る（通信の返事を待たない）。失敗したら送り直せる
 *   - 一番下にいるときだけ自動で追従。遡っている最中は勝手に飛ばず「新しいメッセージ↓」を出す
 *   - iPhone のキーボードで入力欄が隠れない（visualViewport に追従）
 *   - 画像は送る前にブラウザで縮小＋JPEG化（HEIC で相手に映らない事故を防ぐ）
 *   - 相手が読んだら自分の吹き出しに「既読」
 */

/** 相手が「いま開いている」とみなす時間。 */
const ONLINE_MS = 70_000
/** 在席を知らせる間隔。 */
const HEARTBEAT_MS = 25_000

const EMOJIS = [
  '😀', '😂', '🥹', '😊', '😍', '🤔', '😅', '😭', '😱', '😴',
  '👍', '🙏', '👏', '🙌', '💪', '✋', '👌', '🤝', '🫡', '✌️',
  '❤️', '💦', '✨', '🎉', '🔥', '⭐', '🌸', '☀️', '☔', '🌙',
  '🍺', '🍚', '☕', '🍰', '🚗', '🚃', '🏠', '💰', '📷', '⏰',
  '⭕', '❌', '❓', '❗', '💤', '🆗', '🈵', '🉐', '🐶', '🐱',
]

interface Pending {
  id: string
  msg: TalkMessage
  image?: { data: string }
  failed?: boolean
}

export function TalkRoom() {
  const uid = useMemo(() => getUid(), [])
  const [name, setNameState] = useState(() => getName())
  const [nameInput, setNameInput] = useState('')
  const [messages, setMessages] = useState<TalkMessage[]>([])
  const [members, setMembers] = useState<TalkMember[]>([])
  const [pending, setPending] = useState<Pending[]>([])
  const [text, setText] = useState('')
  const [picked, setPicked] = useState<{ id: string; data: string; w: number; h: number }[]>([])
  const [sending, setSending] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [sound, setSound] = useState(() => getSoundOn())
  const [viewer, setViewer] = useState<string | null>(null)
  /** 長押しで開く操作の一覧（返信・コピー・取り消し） */
  const [acting, setActing] = useState<TalkMessage | null>(null)
  /** 返信先。送るときに引用として持たせる */
  const [replyTo, setReplyTo] = useState<{ id: string; name: string; text: string } | null>(null)
  /** 引用から飛んだ先を一瞬光らせる */
  const [flash, setFlash] = useState('')
  /** AIに聞くモード（丸ボタンで入り切りする） */
  const [aiMode, setAiMode] = useState(false)
  /** AIの返事を待っている間の表示 */
  const [aiWaiting, setAiWaiting] = useState(false)
  /** この端末は書き込みを許されていない（ルールの顔ぶれに入っていない） */
  const [blocked, setBlocked] = useState(false)
  /** 締め出されたときに入れてもらう合言葉 */
  const [passInput, setPassInput] = useState('')
  const [passError, setPassError] = useState('')
  const [passBusy, setPassBusy] = useState(false)
  const [atBottom, setAtBottom] = useState(true)
  const [unseen, setUnseen] = useState(0)
  const [toast, setToast] = useState('')

  const listRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const firstLoad = useRef(true)
  const lastCount = useRef(0)

  // ── 購読 ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!name) return
    let unsubM: (() => void) | undefined
    let unsubP: (() => void) | undefined
    watchMessages(rows => setMessages(rows)).then(u => { unsubM = u })
    watchMembers(rows => setMembers(rows)).then(u => { unsubP = u })
    return () => { unsubM?.(); unsubP?.() }
  }, [name])

  // 在席と既読を知らせる（開いている間だけ）
  const lastAt = messages.length ? messages[messages.length - 1].at : 0
  useEffect(() => {
    if (!name) return
    const ping = () => {
      if (document.visibilityState !== 'visible') return
      touchMember(uid, name, lastAt).catch(async e => {
        if (errorStatus(e) !== 403) return
        // 🔵 403 でも、合言葉を覚えていれば**黙って登録し直す**（再入力を求めない）。
        //    端末IDだけが変わった場合はこれで自動復帰する。
        const saved = getPass()
        if (saved && await registerDevice(uid, saved).catch(() => false)) {
          touchMember(uid, name, lastAt).catch(() => { /* それでも駄目なら次のpingで拾う */ })
          return
        }
        // 🔴 合言葉も無い＝入れてもらうしかない
        setBlocked(true)
      })
    }
    ping()
    const t = setInterval(ping, HEARTBEAT_MS)
    document.addEventListener('visibilitychange', ping)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', ping) }
  }, [uid, name, lastAt])

  // ── 新着の扱い（自動追従・音・タイトル） ─────────────────────────
  useEffect(() => {
    const added = messages.length - lastCount.current
    lastCount.current = messages.length
    if (firstLoad.current) {
      firstLoad.current = false
      scrollToBottom('auto')
      return
    }
    if (added <= 0) return

    const last = messages[messages.length - 1]
    const mine = last?.uid === uid
    if (mine || atBottom) {
      scrollToBottom('smooth')
    } else {
      setUnseen(n => n + added)
    }
    if (!mine && (document.visibilityState !== 'visible' || !atBottom) && sound) beep()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages])

  useEffect(() => {
    document.title = unseen > 0 ? `(${unseen}) トーク` : 'トーク'
  }, [unseen])

  // Esc で開いているものを閉じる（PC）
  useEffect(() => {
    if (!emojiOpen && !menuOpen && !viewer && !acting && !replyTo) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // 開いているものから順に1つずつ閉じる（返信の下書きは最後）
      if (acting) { setActing(null); return }
      if (viewer) { setViewer(null); return }
      if (menuOpen) { setMenuOpen(false); return }
      if (emojiOpen) { setEmojiOpen(false); return }
      setReplyTo(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [emojiOpen, menuOpen, viewer, acting, replyTo])

  /** 引用をタップしたら、元の発言へ飛んで一瞬光らせる。 */
  const jumpTo = (id: string) => {
    const el = listRef.current?.querySelector(`[data-mid="${CSS.escape(id)}"]`)
    if (!el) { show('元の発言はもう見つかりません'); return }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setFlash(id)
    setTimeout(() => setFlash(f => (f === id ? '' : f)), 1400)
  }

  /**
   * 🔴 開いた直後に一番下まで行かない問題（運用者の指摘）。
   *    1回だけ `scrollTo` しても、そのあと**画像や折り返しで高さが伸びる**ので途中で止まる。
   *    そこで開いてしばらくの間は、少し間隔をあけて下へ張り付け続ける。
   *    自分でスクロールしたら（触った時点で）やめる＝勝手に引き戻されない。
   */
  useEffect(() => {
    if (!name) return
    const el = listRef.current
    if (!el) return
    let stop = false
    const pin = () => { if (!stop) el.scrollTop = el.scrollHeight }
    const timer = setInterval(pin, 120)
    const done = () => { stop = true; clearInterval(timer) }
    const end = setTimeout(done, 2500)
    el.addEventListener('pointerdown', done)
    el.addEventListener('wheel', done, { passive: true })
    el.addEventListener('touchmove', done, { passive: true })
    return () => {
      done()
      clearTimeout(end)
      el.removeEventListener('pointerdown', done)
      el.removeEventListener('wheel', done)
      el.removeEventListener('touchmove', done)
    }
  }, [name])

  // iPhone：キーボードが出ても入力欄が隠れないように、見えている高さに合わせる
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const fit = () => {
      document.documentElement.style.setProperty('--talk-vh', `${vv.height}px`)
      if (atBottom) scrollToBottom('auto')
    }
    fit()
    vv.addEventListener('resize', fit)
    vv.addEventListener('scroll', fit)
    return () => { vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit) }
  }, [atBottom])

  const scrollToBottom = (behavior: ScrollBehavior) => {
    requestAnimationFrame(() => {
      const el = listRef.current
      if (!el) return
      el.scrollTo({ top: el.scrollHeight, behavior })
      setUnseen(0)
    })
  }

  const onScroll = () => {
    const el = listRef.current
    if (!el) return
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    setAtBottom(bottom)
    if (bottom) setUnseen(0)
  }

  // ── 送る ───────────────────────────────────────────────────────
  const canSend = (text.trim() !== '' || picked.length > 0) && !sending

  /**
   * AIに聞く。
   * 🔵 質問も答えも**そのままトークに流す**（運用者の指示）。相手にも見えるので、
   *    後から読み返したときに「何を聞いて何が返ったか」が残る。
   */
  const askAndPost = useCallback(async (q: string) => {
    setSending(true)
    setText('')
    if (taRef.current) taRef.current.style.height = 'auto'
    try {
      await sendMessage({ uid, name, text: q, at: Date.now(), toAi: true })
    } catch {
      show('送れませんでした')
      setSending(false)
      return
    }
    scrollToBottom('smooth')
    setAiWaiting(true)
    try {
      const answer = await askAi(q)
      await sendMessage({ uid: AI_UID, name: AI_NAME, text: answer, at: Date.now() })
    } catch (e) {
      show(e instanceof Error ? e.message : 'AIに聞けませんでした')
    } finally {
      setAiWaiting(false)
      setSending(false)
      scrollToBottom('smooth')
    }
  }, [uid, name])

  const doSend = useCallback(async () => {
    const body = text.trim()
    if (!body && picked.length === 0) return
    if (aiMode && body && picked.length === 0) { void askAndPost(body); return }
    setSending(true)
    setText('')
    const shots = picked
    setPicked([])
    if (taRef.current) taRef.current.style.height = 'auto'

    // 返信は1通にだけ付ける（写真を何枚も送っても、引用が並ばないように）
    const quote = replyTo
    setReplyTo(null)
    const withQuote = quote ? { re: quote.id, reName: quote.name, reText: quote.text } : {}

    // 画像がある場合は「1枚＝1通」。テキストは最後の1通に添える（LINEと同じ並び）
    const jobs: { msg: TalkMessage; image?: { data: string } }[] = []
    shots.forEach((s, i) => {
      const withText = !body ? false : i === shots.length - 1
      jobs.push({
        msg: {
          id: '', uid, name, at: Date.now() + i,
          text: withText ? body : '', w: s.w, h: s.h, img: 'pending',
          // 文字があればその1通に、写真だけなら1枚目に付ける
          ...((withText || (!body && i === 0)) ? withQuote : {}),
        },
        image: { data: s.data },
      })
    })
    if (shots.length === 0) {
      jobs.push({ msg: { id: '', uid, name, at: Date.now(), text: body, ...withQuote } })
    }

    for (const job of jobs) {
      const pid = randomId()
      setPending(p => [...p, { id: pid, msg: { ...job.msg, id: pid }, image: job.image }])
      try {
        await sendMessage(job.msg, job.image)
        setPending(p => p.filter(x => x.id !== pid))
      } catch (e) {
        if (errorStatus(e) === 403) setBlocked(true)
        setPending(p => p.map(x => (x.id === pid ? { ...x, failed: true } : x)))
      }
    }
    setSending(false)
    scrollToBottom('smooth')

    // 🔵 相手が画面を開いていないときだけ、LINEへ「新着があります」を送る
    //    （開いている間に鳴らすと、会話中ずっと鳴りっぱなしになる）
    const p = peerState(members, uid, name)
    const away = !p || Date.now() - p.at >= ONLINE_MS
    if (away) void notifyPeer({ name, text: body, hasImage: shots.length > 0 })
  }, [text, picked, uid, name, replyTo, members, aiMode, askAndPost])

  const retry = async (p: Pending) => {
    setPending(list => list.map(x => (x.id === p.id ? { ...x, failed: false } : x)))
    try {
      await sendMessage(p.msg, p.image)
      setPending(list => list.filter(x => x.id !== p.id))
    } catch {
      setPending(list => list.map(x => (x.id === p.id ? { ...x, failed: true } : x)))
      show('送れませんでした。電波を確認してください')
    }
  }

  // ── 画像を選ぶ ─────────────────────────────────────────────────
  /**
   * 🔵 開く前に値を空にする。同じ写真を続けて選んだとき、値が同じだと
   *    change が起きず「選んだのに何も出ない」になるため（iPhone で起きやすい）。
   */
  const openPicker = () => {
    if (fileRef.current) fileRef.current.value = ''
    fileRef.current?.click()
  }

  const onPick = async (files: FileList | null) => {
    if (!files?.length) return
    const list = Array.from(files).slice(0, 4)
    // 大きい写真は変換に時間がかかる。待たされている理由が分かるようにしておく
    if (list.length > 0) show('写真を読み込んでいます…')
    for (const f of list) {
      try {
        const s = await shrinkImage(f)
        setPicked(p => [...p, { id: randomId(), ...s }])
        setToast('')
      } catch (e) {
        show(e instanceof Error ? e.message : 'この写真は読めませんでした')
      }
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const show = (m: string) => {
    setToast(m)
    setTimeout(() => setToast(''), 2600)
  }

  // ── 表示のための組み立て ───────────────────────────────────────
  // 🔴 同じ人の古い記録が混ざるので「最初の1件」ではなく一番進んだものを採る（peerState 参照）
  const peer = useMemo(() => peerState(members, uid, name), [members, uid, name])
  const peerOnline = peer ? Date.now() - peer.at < ONLINE_MS : false
  /** 相手がここまで読んだ、という時刻。自分の吹き出しの「既読」判定に使う */
  const peerRead = peer?.read ?? 0

  const rows = useMemo(() => {
    const all: (TalkMessage & { pendingId?: string; failed?: boolean })[] = [
      ...messages,
      ...pending.map(p => ({ ...p.msg, pendingId: p.id, failed: p.failed })),
    ]
    return all.sort((a, b) => a.at - b.at)
  }, [messages, pending])

  // ── この端末は使えません ───────────────────────────────────────
  // 🔴 やり取りしている2人の端末以外はブロックする（運用者の指示・2026-08-30）。
  //    身元は端末IDだけなので、許す一覧は Firestore のルール側に置いてある
  //    （クライアントに書くと公開JSに出てしまうため）。
  if (blocked) {
    const unlock = async () => {
      const p = passInput.trim()
      if (!p || passBusy) return
      setPassBusy(true)
      setPassError('')
      try {
        if (await registerDevice(uid, p)) {
          // 登録できた＝この端末は以後書ける。購読し直すため読み込み直す
          location.reload()
          return
        }
        setPassError('合言葉が違います')
      } catch {
        setPassError('通信できませんでした。電波を確認してください')
      } finally {
        setPassBusy(false)
      }
    }
    return (
      <div className={styles.gate}>
        <div className={styles.gateBox}>
          <div className={styles.gateIcon}>🔑</div>
          <h1 className={styles.gateTitle}>合言葉を入れてください</h1>
          <p className={styles.gateLead}>
            この端末はまだ登録されていません。<br />
            合言葉を入れると、次からは入力なしで使えます。
          </p>
          <input
            className={styles.gateInput}
            value={passInput}
            onChange={e => setPassInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void unlock() }}
            placeholder="あいことば"
            enterKeyHint="go"
            autoComplete="off"
          />
          {passError && <p className={styles.gateError}>{passError}</p>}
          {/* 🔴 保存できない端末は、合言葉を入れても次に開くとまた聞かれる（無限ループ）。
              原因はブラウザの設定なので、ここで先に伝える（2026-08-31 に実際に起きた）。 */}
          {!canRemember() && (
            <p className={styles.gateError}>
              このブラウザは<strong>この端末を覚えられない設定</strong>です（プライベートブラウズ、
              またはサイトデータの保存がオフ）。そのままだと次に開いたとき、また合言葉を聞かれます。<br />
              ふつうのタブ（プライベートでない）で開くか、設定でサイトデータの保存を許可してください。
            </p>
          )}
          <button className={styles.gateBtn} onClick={() => void unlock()} disabled={!passInput.trim() || passBusy}>
            {passBusy ? '確認中…' : '入る'}
          </button>
        </div>
      </div>
    )
  }

  // ── 名前を入れる画面 ───────────────────────────────────────────
  if (!name) {
    const start = () => {
      const n = nameInput.trim().slice(0, 20)
      if (!n) return
      saveName(n)
      setNameState(n)
    }
    return (
      <div className={styles.gate}>
        <div className={styles.gateBox}>
          <div className={styles.gateIcon}>💬</div>
          <h1 className={styles.gateTitle}>トーク</h1>
          <p className={styles.gateLead}>表示する名前を入れてください。<br />あとから変えられます。</p>
          <input
            className={styles.gateInput}
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') start() }}
            maxLength={20}
            placeholder="なまえ"
            enterKeyHint="go"
            autoComplete="off"
            autoFocus
          />
          <button className={styles.gateBtn} onClick={start} disabled={!nameInput.trim()}>はじめる</button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.bar}>
        <div className={styles.barTitle}>
          <span className={styles.barName}>{peer?.name ?? 'トーク'}</span>
          {peer && <span className={styles.barSub}>{peerOnline ? 'オンライン' : `最終 ${timeLabel(peer.at)}`}</span>}
        </div>
        <button className={styles.barBtn} onClick={() => setMenuOpen(v => !v)} aria-label="メニュー">⋯</button>
      </header>

      {/* 🔵 スタンプを開いたまま一覧を触ったら閉じる（入力欄は覆わないので、文字は続けて打てる） */}
      <div
        className={styles.list}
        ref={listRef}
        onScroll={onScroll}
        onPointerDown={() => { if (emojiOpen) setEmojiOpen(false) }}
      >
        {rows.length === 0 && (
          <p className={styles.empty}>まだメッセージはありません。<br />下の欄から送ってみてください。</p>
        )}
        {rows.map((m, i) => {
          const prev = rows[i - 1]
          const newDay = !prev || !isSameDay(prev.at, m.at)
          const mine = m.uid === uid
          // 同じ人が続けて送ったときは、時刻を最後の1つだけに出す（LINEと同じ）
          const next = rows[i + 1]
          const tail = !next || next.uid !== m.uid || !isSameDay(next.at, m.at)
          return (
            <div key={m.pendingId ?? m.id} data-mid={m.id}>
              {newDay && <div className={styles.day}><span>{dayLabel(m.at)}</span></div>}
              <Row
                m={m}
                mine={mine}
                tail={tail}
                showName={!mine && (!prev || prev.uid !== m.uid || newDay)}
                read={mine && !m.pendingId && peerRead >= m.at}
                flash={flash === m.id}
                isAi={m.uid === AI_UID}
                onImageShown={() => { if (atBottom) scrollToBottom('auto') }}
                onImage={setViewer}
                onRetry={m.failed ? () => { const p = pending.find(x => x.id === m.pendingId); if (p) retry(p) } : undefined}
                onHold={!m.pendingId ? () => setActing(m) : undefined}
                onJump={jumpTo}
              />
            </div>
          )
        })}
      </div>

      {aiWaiting && <div className={styles.aiWait}>🤖 調べています…</div>}

      {!atBottom && unseen > 0 && (
        <button className={styles.jump} onClick={() => scrollToBottom('smooth')}>
          新しいメッセージ {unseen} ↓
        </button>
      )}

      {picked.length > 0 && (
        <div className={styles.picked}>
          {picked.map(p => (
            <div key={p.id} className={styles.pickedItem}>
              <img src={p.data} alt="" />
              <button onClick={() => setPicked(list => list.filter(x => x.id !== p.id))} aria-label="外す">✕</button>
            </div>
          ))}
        </div>
      )}

      {emojiOpen && (
        <div className={styles.emoji}>
          {/* 🔵 開きっぱなしで閉じ方が分からない、という声。閉じ方を3つ用意した：
                 ①この「閉じる」 ②メッセージ一覧のどこかを触る ③Esc（PC） */}
          <div className={styles.emojiHead}>
            <span>スタンプ</span>
            <button onClick={() => setEmojiOpen(false)} aria-label="スタンプを閉じる">閉じる ✕</button>
          </div>
          <div className={styles.emojiGrid}>
            {EMOJIS.map(e => (
              <button key={e} onClick={() => { setText(t => t + e); taRef.current?.focus() }}>{e}</button>
            ))}
          </div>
        </div>
      )}

      {aiMode && (
        <div className={styles.aiBar}>
          <span>AIに聞く（Web検索つき）・やり取りは2人に見えます</span>
          <button onClick={() => setAiMode(false)} aria-label="やめる">✕</button>
        </div>
      )}

      {replyTo && (
        <div className={styles.replyBar}>
          <div className={styles.replyBody}>
            <span className={styles.replyName}>{replyTo.name} に返信</span>
            <span className={styles.replyText}>{replyTo.text}</span>
          </div>
          <button onClick={() => setReplyTo(null)} aria-label="返信をやめる">✕</button>
        </div>
      )}

      <footer className={styles.foot}>
        {/* 🔵 左下のAIボタン。押すと「AIに聞くモード」に入る（もう一度押すと戻る） */}
        <button
          className={`${styles.aiBtn} ${aiMode ? styles.aiOn : ''}`}
          onClick={() => setAiMode(v => !v)}
          aria-label="AIに聞く"
          aria-pressed={aiMode}
        >AI</button>
        <button className={styles.iconBtn} onClick={openPicker} aria-label="画像を送る">🖼️</button>
        <button className={styles.iconBtn} onClick={() => setEmojiOpen(v => !v)} aria-label="絵文字">😀</button>
        <textarea
          ref={taRef}
          className={styles.input}
          value={text}
          rows={1}
          placeholder={aiMode ? '例：渋谷 夜 静かめの居酒屋' : 'メッセージ'}
          onChange={e => {
            setText(e.target.value)
            const el = e.target
            el.style.height = 'auto'
            el.style.height = `${Math.min(el.scrollHeight, 120)}px`
          }}
          onKeyDown={e => {
            // PCは Enter で送信・Shift+Enter で改行。スマホは改行のまま（送信は➤）
            if (e.key === 'Enter' && !e.shiftKey && !isTouch()) {
              e.preventDefault()
              void doSend()
            }
          }}
        />
        <button className={styles.sendBtn} onClick={() => void doSend()} disabled={!canSend} aria-label="送信">➤</button>
        {/*
          🔴 `hidden`（display:none）にすると **iPhone(Safari) で写真の選択が開かないことがある**。
             画面の外に置いて「存在はする」状態にしておく。accept も HEIC/HEIF を明示して、
             ファイルアプリから選んだときに選択できない事故を防ぐ。
        */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,image/heic,image/heif"
          multiple
          className={styles.fileInput}
          tabIndex={-1}
          onChange={e => void onPick(e.target.files)}
        />
      </footer>

      {menuOpen && (
        <>
          <div className={styles.scrim} onClick={() => setMenuOpen(false)} />
          <div className={styles.menu}>
            <button onClick={() => {
              const n = prompt('表示する名前', name)?.trim().slice(0, 20)
              if (n) { saveName(n); setNameState(n); touchMember(uid, n, lastAt).catch(() => {}) }
              setMenuOpen(false)
            }}>名前を変える</button>
            <button onClick={() => { const v = !sound; setSound(v); setSoundOn(v); setMenuOpen(false) }}>
              新着の音：{sound ? 'オン' : 'オフ'}
            </button>
            <button className={styles.menuClose} onClick={() => setMenuOpen(false)}>閉じる</button>
          </div>
        </>
      )}

      {/* 長押し（PCは右クリック）で出る操作の一覧 */}
      {acting && (
        <>
          <div className={styles.scrim} onClick={() => setActing(null)} />
          <div className={styles.sheet}>
            <div className={styles.actingQuote}>{quoteText(acting, 40) || '（写真）'}</div>
            <button onClick={() => {
              setReplyTo({ id: acting.id, name: acting.name, text: quoteText(acting, 60) })
              setActing(null)
              taRef.current?.focus()
            }}>返信する</button>
            {acting.text && (
              <button onClick={() => {
                navigator.clipboard?.writeText(acting.text)
                  .then(() => show('コピーしました'))
                  .catch(() => show('コピーできませんでした'))
                setActing(null)
              }}>文字をコピー</button>
            )}
            {acting.uid === uid && (
              <button className={styles.menuDanger} onClick={async () => {
                const target = acting
                setActing(null)
                try { await deleteMessage(target) } catch { show('取り消せませんでした') }
              }}>取り消す</button>
            )}
            <button className={styles.menuClose} onClick={() => setActing(null)}>閉じる</button>
          </div>
        </>
      )}

      {viewer && (
        <div className={styles.viewer} onClick={() => setViewer(null)}>
          <img src={viewer} alt="" />
          <button className={styles.viewerClose} aria-label="閉じる">✕</button>
        </div>
      )}

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  )
}

/** 長押しとみなす時間。これより長く押していて、指がほとんど動いていなければ操作の一覧を出す。 */
const HOLD_MS = 450
/** 指が動いたらスクロールとみなす距離。 */
const HOLD_SLOP = 10

/** 1行ぶんの吹き出し。 */
function Row({ m, mine, tail, showName, read, flash, isAi, onImage, onImageShown, onRetry, onHold, onJump }: {
  m: TalkMessage & { pendingId?: string; failed?: boolean }
  mine: boolean
  tail: boolean
  showName: boolean
  read: boolean
  flash: boolean
  /** AIの発言（人の発言と見分けが付くよう、色も名札も変える） */
  isAi: boolean
  /** 画像が実際に表示されたとき（高さが増えるので、下にいるなら追いかける） */
  onImageShown: () => void
  onImage: (src: string) => void
  onRetry?: () => void
  onHold?: () => void
  onJump: (id: string) => void
}) {
  const [src, setSrc] = useState<string | null>(null)
  const hold = useRef<{ timer: number; x: number; y: number } | null>(null)
  /** 長押しで一覧を出した直後の指離しを、ふつうの押下として扱わないための印 */
  const held = useRef(false)

  const holdStart = (e: ReactPointerEvent) => {
    if (!onHold) return
    held.current = false
    const timer = window.setTimeout(() => { hold.current = null; held.current = true; onHold() }, HOLD_MS)
    hold.current = { timer, x: e.clientX, y: e.clientY }
  }

  /** 長押しの直後なら、写真の拡大や引用の移動は起こさない。 */
  const afterHold = () => {
    if (!held.current) return false
    held.current = false
    return true
  }
  const holdCancel = () => {
    if (!hold.current) return
    clearTimeout(hold.current.timer)
    hold.current = null
  }
  const holdMove = (e: ReactPointerEvent) => {
    const h = hold.current
    if (!h) return
    // スクロールしようとしただけで開かないように、少しでも動いたらやめる
    if (Math.abs(e.clientX - h.x) > HOLD_SLOP || Math.abs(e.clientY - h.y) > HOLD_SLOP) holdCancel()
  }

  useEffect(() => {
    if (!m.img) return
    // 送信中は手元のデータURLがそのまま入っている（pending）。確定後は取りに行く
    if (m.img === 'pending') return
    let alive = true
    fetchImage(m.img).then(d => { if (alive) setSrc(d) })
    return () => { alive = false }
  }, [m.img])

  const ratio = m.w && m.h ? m.h / m.w : undefined
  const meta = (
    <div className={styles.meta}>
      {m.failed ? (
        <button className={styles.retry} onClick={onRetry}>送れませんでした・再送</button>
      ) : m.pendingId ? (
        <span className={styles.sending}>送信中</span>
      ) : (
        <>
          {read && <span className={styles.read}>既読</span>}
          <span>{timeLabel(m.at)}</span>
        </>
      )}
    </div>
  )

  return (
    <div className={`${styles.row} ${mine ? styles.mine : styles.theirs} ${isAi ? styles.aiMsg : ''} ${m.toAi ? styles.askRow : ''}`}>
      {showName && (
        <div className={styles.who}>
          {isAi ? <span className={styles.aiTag}>AI が調べました</span> : m.name}
        </div>
      )}
      <div className={styles.line}>
        {isAi && <span className={styles.aiFace}>AI</span>}
        {mine && tail && meta}
        <div
          className={`${styles.bubbleWrap} ${flash ? styles.flash : ''}`}
          onContextMenu={onHold ? e => { e.preventDefault(); holdCancel(); onHold() } : undefined}
          onPointerDown={holdStart}
          onPointerUp={holdCancel}
          onPointerMove={holdMove}
          onPointerCancel={holdCancel}
          onPointerLeave={holdCancel}
        >
          {/* 🔵 引用は背景に溶けやすいので、引用と本文を1枚の枠で囲って「返信」だと分かるようにする */}
          {/* 🔵 AIに聞いた発言は、相手への発言と見分けが付くように名札を出す */}
          {m.toAi && <div className={styles.toAi}>AI に質問</div>}
          <div className={m.re ? styles.replied : styles.plain}>
            {m.re && (
              <button className={styles.quote} onClick={() => { if (!afterHold()) onJump(m.re!) }}>
                <span className={styles.quoteName}>↩ {m.reName}</span>
                <span className={styles.quoteText}>{m.reText}</span>
              </button>
            )}
            {m.img ? (
              <div
                className={styles.photo}
                style={ratio ? { aspectRatio: `${m.w} / ${m.h}` } : undefined}
                onClick={() => { if (!afterHold() && src) onImage(src) }}
              >
                {src ? <img src={src} alt="" onLoad={onImageShown} /> : <div className={styles.photoWait} />}
              </div>
            ) : null}
            {m.text && (
              <div className={styles.bubble}>
                {/* URL のところだけ押せるようにする（AIが付けるGoogleマップのリンク用） */}
                {linkify(m.text).map((part, i) => (
                  part.url
                    ? <a key={i} href={part.url} target="_blank" rel="noopener noreferrer">{part.text}</a>
                    : <span key={i}>{part.text}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        {!mine && tail && meta}
      </div>
    </div>
  )
}

function isTouch(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
}

/** 新着の短い音（音声ファイルを持たずに鳴らす）。 */
function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.06, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.25)
    setTimeout(() => ctx.close(), 600)
  } catch { /* 音が鳴らせない環境でも本体は動く */ }
}
