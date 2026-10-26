import { useEffect, useMemo, useRef, useState } from 'react'
import styles from './TalkCalendar.module.css'
import {
  dateKey, dateLabel, deleteEvent, emptyDraft, groupByDate, monthCells, normalizeDraft, saveEvent,
  type EventDraft, type TalkEvent } from '../utils/talkCalendar'

/**
 * 2人のカレンダー（右上の📅で開く・2026-10-26）。
 *
 * 🔵 月のマス目＋選んだ日の予定。予定のある日に印。
 * 🔵 トークの長押し「カレンダーに追加」から来たときは、AI が読み取った内容で入力欄が開く（`incoming`）。
 * 🔴 保存は必ず本人が押す（AI は入力欄を埋めるだけ）。
 * 🔵 色はトーク画面の変数（--talk-*）をそのまま使う＝明るい／暗いに追従する。
 */
export function TalkCalendar({ events, myName, incoming, reading, onClose, onToast }: {
  events: TalkEvent[]
  myName: string
  /** 長押しから来た入力欄の中身（AI の読み取りが終わると差し替わる） */
  incoming: EventDraft | null
  /** AI が読み取り中 */
  reading: boolean
  onClose: () => void
  onToast: (msg: string) => void
}) {
  const today = dateKey(Date.now())
  const [view, setView] = useState(() => {
    const d = new Date()
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const [selected, setSelected] = useState(today)
  /** 開いている入力欄（id があれば編集） */
  const [edit, setEdit] = useState<{ id?: string; draft: EventDraft } | null>(null)
  const [saving, setSaving] = useState(false)
  /** 閉じた（保存した・やめた）長押し元のメッセージ。読み取りが後から返っても開き直さない */
  const closedSrc = useRef('')

  const closeEdit = () => setEdit(e => {
    if (e?.draft.src) closedSrc.current = e.draft.src
    return null
  })

  // 長押しから来たら、その日へ移って入力欄を開く（読み取り結果が来たら中身を差し替える）
  useEffect(() => {
    if (!incoming || (incoming.src && incoming.src === closedSrc.current)) return
    setEdit({ draft: incoming })
    const [y, m] = incoming.date.split('-').map(Number)
    if (y && m) {
      setView({ y, m: m - 1 })
      setSelected(incoming.date)
    }
  }, [incoming])

  const byDate = useMemo(() => groupByDate(events), [events])
  const cells = useMemo(() => monthCells(view.y, view.m), [view])
  const dayEvents = byDate.get(selected) ?? []

  const move = (delta: number) => setView(v => {
    const d = new Date(v.y, v.m + delta, 1)
    return { y: d.getFullYear(), m: d.getMonth() }
  })

  const set = (k: keyof EventDraft, v: string) => setEdit(e => (e ? { ...e, draft: { ...e.draft, [k]: v } } : e))

  const save = async () => {
    if (!edit || saving) return
    if (!normalizeDraft(edit.draft)) { onToast('日付と用件を入れてください'); return }
    setSaving(true)
    try {
      await saveEvent(edit.draft, myName, edit.id)
      setSelected(edit.draft.date)
      const [y, m] = edit.draft.date.split('-').map(Number)
      setView({ y, m: m - 1 })
      closeEdit()
      onToast('カレンダーに入れました')
    } catch (e) {
      onToast(e instanceof Error ? e.message : '保存できませんでした')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirmDelete()) return
    try { await deleteEvent(id); closeEdit(); onToast('消しました') } catch { onToast('消せませんでした') }
  }

  return (
    <div className={styles.cal}>
      <header className={styles.head}>
        <button className={styles.nav} onClick={() => move(-1)} aria-label="前の月">‹</button>
        <button className={styles.month} onClick={() => {
          const d = new Date(); setView({ y: d.getFullYear(), m: d.getMonth() }); setSelected(today)
        }}>{view.y}年{view.m + 1}月</button>
        <button className={styles.nav} onClick={() => move(1)} aria-label="次の月">›</button>
        <button className={styles.close} onClick={onClose} aria-label="カレンダーを閉じる">✕</button>
      </header>

      <div className={styles.week}>
        {['日', '月', '火', '水', '木', '金', '土'].map((w, i) => (
          <span key={w} className={i === 0 ? styles.sun : i === 6 ? styles.sat : ''}>{w}</span>
        ))}
      </div>
      <div className={styles.grid}>
        {cells.map((c, i) => {
          const list = byDate.get(c.key) ?? []
          return (
            <button
              key={c.key}
              className={[
                styles.cell,
                c.inMonth ? '' : styles.out,
                c.key === today ? styles.today : '',
                c.key === selected ? styles.sel : '',
                i % 7 === 0 ? styles.sun : i % 7 === 6 ? styles.sat : '',
              ].join(' ')}
              onClick={() => setSelected(c.key)}
            >
              <span className={styles.num}>{c.day}</span>
              {list.slice(0, 2).map(e => <span key={e.id} className={styles.chip}>{e.title}</span>)}
              {list.length > 2 && <span className={styles.more}>+{list.length - 2}</span>}
            </button>
          )
        })}
      </div>

      <section className={styles.day}>
        <div className={styles.dayHead}>
          <span>{dateLabel(selected)}</span>
          <button className={styles.add} onClick={() => setEdit({ draft: emptyDraft(selected) })}>＋ 予定を入れる</button>
        </div>
        {dayEvents.length === 0 && <p className={styles.none}>予定はありません</p>}
        {dayEvents.map(e => (
          <button key={e.id} className={styles.item} onClick={() => setEdit({ id: e.id, draft: { ...e } })}>
            <span className={styles.time}>{e.time || '終日'}</span>
            <span className={styles.body}>
              <b>{e.title}</b>
              {e.place && <span>📍 {e.place}</span>}
              {e.memo && <span className={styles.memo}>{e.memo}</span>}
            </span>
          </button>
        ))}
      </section>

      {edit && (
        <>
          <div className={styles.scrim} onClick={() => { if (!saving) closeEdit() }} />
          <div className={styles.editor}>
            <div className={styles.edHead}>
              <span>{edit.id ? '予定を直す' : '予定を入れる'}</span>
              {reading && !edit.id && <span className={styles.reading}>AIが読み取り中…</span>}
            </div>
            <label>日付<input type="date" value={edit.draft.date} onChange={e => set('date', e.target.value)} /></label>
            <label>時刻<input type="time" value={edit.draft.time} onChange={e => set('time', e.target.value)} /></label>
            <label>用件<input value={edit.draft.title} maxLength={60} placeholder="例：ディナー" onChange={e => set('title', e.target.value)} /></label>
            <label>場所<input value={edit.draft.place} maxLength={80} placeholder="お店の名前など" onChange={e => set('place', e.target.value)} /></label>
            <label>URL<input type="url" value={edit.draft.url} placeholder="https://" onChange={e => set('url', e.target.value)} /></label>
            <label>メモ<textarea rows={2} value={edit.draft.memo} maxLength={300} placeholder="人数・予約名など" onChange={e => set('memo', e.target.value)} /></label>
            {edit.id && edit.draft.url && (
              <a className={styles.link} href={edit.draft.url} target="_blank" rel="noopener noreferrer">お店のページを開く ↗</a>
            )}
            <div className={styles.edBtns}>
              {edit.id && <button className={styles.danger} onClick={() => void remove(edit.id!)}>消す</button>}
              <button className={styles.cancel} onClick={closeEdit} disabled={saving}>やめる</button>
              <button className={styles.save} onClick={() => void save()} disabled={saving}>{saving ? '保存中…' : '保存'}</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** 消す前の確認。🔵 2人の予定なので、押し間違いで消えないように1回聞く */
function confirmDelete(): boolean {
  try { return window.confirm('この予定を消しますか？') } catch { return true }
}
