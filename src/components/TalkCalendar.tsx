import { useEffect, useMemo, useRef, useState } from 'react'
import styles from './TalkCalendar.module.css'
import { IconClose, IconHome, IconLeft, IconMap, IconPlus, IconRight } from './TalkIcons'
import {
  dateKey, dateLabel, deleteEvent, emptyDraft, groupByDate, monthCells, normalizeDraft, saveEvent,
  type EventDraft, type TalkEvent } from '../utils/talkCalendar'
import { hideProperty, mapUrl, shortDate, watchProperties, type TalkProperty } from '../utils/talkProperty'

/**
 * 2人のカレンダー（右上の📅で開く・2026-10-26）。
 *
 * 🔵 月のマス目を画面いっぱいに出し、日付を押すとその日の予定が下から出る（2026-11-07）。
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
  /** 選んだ日の予定（下から出す）。月の表は画面いっぱいに使う（2026-11-07） */
  const [dayOpen, setDayOpen] = useState(false)
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
      setDayOpen(true)
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
        <button className={styles.nav} onClick={() => move(-1)} aria-label="前の月"><IconLeft /></button>
        <button className={styles.month} onClick={() => {
          const d = new Date(); setView({ y: d.getFullYear(), m: d.getMonth() }); setSelected(today)
        }}>{view.y}年{view.m + 1}月</button>
        <button className={styles.nav} onClick={() => move(1)} aria-label="次の月"><IconRight /></button>
        <button className={styles.close} onClick={onClose} aria-label="カレンダーを閉じる"><IconClose size={20} /></button>
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
              onClick={() => { setSelected(c.key); setDayOpen(true) }}
            >
              <span className={styles.num}>{c.day}</span>
              {list.slice(0, 4).map(e => <span key={e.id} className={styles.chip}>{e.time ? `${e.time} ` : ''}{e.title}</span>)}
              {list.length > 4 && <span className={styles.more}>+{list.length - 4}</span>}
            </button>
          )
        })}
      </div>

      {/* 🔵 月の表は画面いっぱい（2026-11-07 運用者）。選んだ日の予定は下から出す */}
      {dayOpen && <div className={styles.dayScrim} onClick={() => setDayOpen(false)} />}
      {dayOpen && <section className={styles.day}>
        <div className={styles.dayHead}>
          <span>{dateLabel(selected)}</span>
          <button className={styles.add} onClick={() => setEdit({ draft: emptyDraft(selected) })}><IconPlus size={16} /> 予定を入れる</button>
          <button className={styles.nav} onClick={() => setDayOpen(false)} aria-label="この日を閉じる"><IconClose size={18} /></button>
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
      </section>}

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

/**
 * 🏠 通知した物件のパネル（トーク上部の📅の左で開く・2026-11-03）。
 * 🔵 見た目はカレンダーの入力欄と同じ（下から出す）ので、この CSS を使い回す。
 */
export function TalkProperties({ onClose, onToast }: { onClose: () => void; onToast: (msg: string) => void }) {
  return (
    <>
      <div className={styles.scrim} onClick={onClose} />
      <div className={styles.editor}>
        <div className={styles.edHead}>
          <span className={styles.edTitle}><IconHome size={18} /> 通知した物件</span>
          <button className={styles.nav} onClick={onClose} aria-label="物件の一覧を閉じる"><IconClose size={18} /></button>
        </div>
        <PropertyList onToast={onToast} />
      </div>
    </>
  )
}

/**
 * 通知した物件の一覧（🏠を開いたときだけ購読する）。
 * 🔵 タップで物件ページを開く。✕ で一覧から隠す。
 * 🔴 隠しても「通知済み」の記録は残る＝同じ物件はもう通知されない。
 */
function PropertyList({ onToast }: { onToast: (msg: string) => void }) {
  const [rows, setRows] = useState<TalkProperty[] | null>(null)

  useEffect(() => {
    let unsub: (() => void) | undefined
    let alive = true
    watchProperties(r => { if (alive) setRows(r) }).then(u => { if (alive) unsub = u; else u() })
    return () => { alive = false; unsub?.() }
  }, [])

  const remove = async (p: TalkProperty) => {
    if (!confirmDelete('この物件を一覧から消しますか？（同じ物件はもう届きません）')) return
    try { await hideProperty(p.id); onToast('消しました') } catch { onToast('消せませんでした') }
  }

  if (!rows) return <p className={styles.none}>読み込み中…</p>
  if (rows.length === 0) return <p className={styles.none}>まだ通知した物件はありません</p>
  return (
    <div className={styles.props}>
      {rows.map(p => (
        <div key={p.id} className={styles.prop}>
          <a className={styles.propBody} href={p.url} target="_blank" rel="noopener noreferrer">
            <b>{p.title}</b>
            {(p.price || p.layout) && <span>{[p.price, p.layout].filter(Boolean).join('・')}</span>}
            {p.access && <span>🚉 {p.access}</span>}
            {p.address && <span>📍 {p.address}</span>}
            {p.memo && <span className={styles.memo}>{p.memo}</span>}
            <span className={styles.propDate}>{shortDate(p.at)}{p.notified ? '' : '・LINE未送信'}</span>
          </a>
          <a className={styles.nav} href={mapUrl(p)} target="_blank" rel="noopener noreferrer" aria-label="地図で見る"><IconMap size={18} /></a>
          <button className={styles.nav} onClick={() => void remove(p)} aria-label="この物件を消す"><IconClose size={16} /></button>
        </div>
      ))}
    </div>
  )
}

/** 消す前の確認。🔵 2人の予定なので、押し間違いで消えないように1回聞く */
function confirmDelete(msg = 'この予定を消しますか？'): boolean {
  try { return window.confirm(msg) } catch { return true }
}
