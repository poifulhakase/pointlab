// ロボ口座画面の中身＝信用期日（2026-09-16 新設・ロボ口座の疑似トレードは廃止）。
//
// 左：ぽいロボ（キャラ）＋ 銘柄コードの入力 ／ 右：登録した銘柄のチャート（削除・更新できる）。
// 🔴 表示は管理者のみ（ShieldView 側で出し分ける）。
// 🔵 登録するのは**銘柄コードだけ**（Firestore `users/{uid}/data/marginKijitsu`）。
//    チャートは開くたびに最新のデータで描く＝「更新」は株価と信用残を取り直すだけ。
import { useCallback, useEffect, useState } from 'react'
import type React from 'react'
import type { User } from 'firebase/auth'
import { cy } from '../utils/cyberTheme'
import { PoiroboPixel } from './PoiroboPixel'
import { MarginKijitsuChart } from './MarginKijitsuChart'
import { restGetDoc, restSetDoc } from '../utils/firestoreRest'
import {
  findRuns, loadMarginIndex, loadMarginNames, loadMarginSeries, loadWeeklyBars, normalizeCode, MIN_WEEKS,
  type MarginRun, type MarginWeek, type WeeklyBar,
} from '../utils/marginKijitsu'

type Props = { theme: 'dark' | 'light'; isMobile: boolean; user: User | null }

type Entry = { code: string; name: string; addedAt: string; updatedAt: string }

type CardState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; bars: WeeklyBar[]; margin: MarginWeek[]; runs: MarginRun[]; weeks: number }

const docPath = (uid: string) => `users/${uid}/data/marginKijitsu`
const nowIso = () => new Date().toISOString()
const fmtTime = (iso: string) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function MarginKijitsuPanel({ theme, isMobile, user }: Props) {
  const c = cy(theme)
  const uid = user?.uid ?? null
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [cards, setCards] = useState<Record<string, CardState>>({})
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  const [stock, setStock] = useState<{ weeks: string[] } | null>(null)

  const save = useCallback(async (next: Entry[]) => {
    setEntries(next)
    if (uid) await restSetDoc(docPath(uid), { entries: next, updatedAt: nowIso() })
  }, [uid])

  const loadCard = useCallback(async (code: string, force = false) => {
    setCards((m) => ({ ...m, [code]: { status: 'loading' } }))
    try {
      const [bars, { weeks, series }] = await Promise.all([loadWeeklyBars(code, force), loadMarginSeries(code, force)])
      setCards((m) => ({ ...m, [code]: { status: 'ready', bars, margin: series, weeks, runs: findRuns(series, bars) } }))
    } catch (e) {
      setCards((m) => ({ ...m, [code]: { status: 'error', message: e instanceof Error ? e.message : '読み込めませんでした' } }))
    }
  }, [])

  // 登録済みの銘柄を読む
  useEffect(() => {
    let alive = true
    loadMarginIndex().then((i) => { if (alive) setStock(i) }).catch(() => {})
    if (!uid) { setEntries([]); return }
    restGetDoc(docPath(uid))
      .then((snap) => {
        if (!alive) return
        const list = (snap.exists() ? (snap.data().entries as Entry[] | undefined) : undefined) ?? []
        setEntries(list)
        list.forEach((e) => loadCard(e.code))
      })
      .catch(() => { if (alive) { setEntries([]); setMessage({ text: '登録済みの銘柄を読み込めませんでした', error: true }) } })
    return () => { alive = false }
  }, [uid, loadCard])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!entries || busy) return
    const code = normalizeCode(input)
    if (!code) { setMessage({ text: '銘柄コードは4桁で入れてください（例 7013）', error: true }); return }
    if (entries.some((x) => x.code === code)) {
      setMessage({ text: `${code} は登録済みです。最新にするなら「更新」を押してください`, error: true })
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      const names = await loadMarginNames()
      await loadWeeklyBars(code)   // 株価が無いコードは登録しない
      const name = names[code] ?? ''
      const entry: Entry = { code, name, addedAt: nowIso(), updatedAt: nowIso() }
      await save([entry, ...entries])
      setInput('')
      setMessage({
        text: name
          ? `${code} ${name} を登録しました`
          : `${code} を登録しました（信用残のデータがありません。信用取引の対象外かもしれません）`,
        error: !name,
      })
      loadCard(code)
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : '登録できませんでした', error: true })
    } finally {
      setBusy(false)
    }
  }

  const remove = async (code: string) => {
    if (!entries) return
    await save(entries.filter((x) => x.code !== code))
    setCards((m) => { const n = { ...m }; delete n[code]; return n })
  }

  const refresh = async (code: string) => {
    if (!entries) return
    await loadCard(code, true)
    loadMarginIndex().then(setStock).catch(() => {})
    await save(entries.map((x) => (x.code === code ? { ...x, updatedAt: nowIso() } : x)))
  }

  const weeksText = stock?.weeks.length
    ? `${stock.weeks[0].replace(/-/g, '/')} 〜 ${stock.weeks[stock.weeks.length - 1].slice(5).replace('-', '/')}（${stock.weeks.length}週）`
    : '—'

  const btn: React.CSSProperties = {
    cursor: 'pointer', background: 'none', border: `1px solid ${c.BORDER}`, borderRadius: 4,
    padding: '4px 10px', fontFamily: c.FONT, fontSize: 11, color: c.DESC, letterSpacing: '0.06em',
  }

  const form = (
    <form onSubmit={add} style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 320 }}>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="銘柄コード（例 7013）"
        inputMode="text"
        aria-label="銘柄コード"
        maxLength={4}
        style={{
          flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 4,
          border: `1px solid ${c.BORDBR}`, background: c.TAREA, color: c.TXTCLR,
          fontFamily: c.FONT, fontSize: 14, letterSpacing: '0.1em', outline: 'none',
        }}
      />
      <button type="submit" disabled={busy || !entries} style={{
        ...btn, border: `1px solid ${c.GREEN}`, color: c.GREEN, fontWeight: 700,
        padding: '8px 14px', opacity: busy ? 0.5 : 1,
      }}>{busy ? '作成中…' : '作成'}</button>
    </form>
  )

  const left = (
    <div style={{
      width: isMobile ? '100%' : 500, flexShrink: 0, minHeight: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: isMobile ? 12 : 22, padding: isMobile ? '16px 14px 10px' : 24,
      borderRight: isMobile ? 'none' : `1px solid ${c.BORDER}`,
      borderBottom: isMobile ? `1px solid ${c.BORDER}` : 'none',
    }}>
      {/* 🔴 サイズは24の倍数にする。端数だと1ドットが割り切れず、行ごとに継ぎ目が出る（2026-08-11 に踏んだ） */}
      <PoiroboPixel size={isMobile ? 96 : 216} animate alt="" />
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.24em', color: c.GREEN,
          textShadow: theme === 'dark' ? `0 0 10px ${c.GREEN}55` : 'none',
        }}>MARGIN CYCLE / 信用期日</div>
        <div style={{ marginTop: 8, fontSize: 11, color: c.DESC, lineHeight: 1.9 }}>
          銘柄コードを入れると、信用買いが積み上がった期間と<br />
          その6か月後（制度信用の期日の目安）をチャートにします
        </div>
      </div>
      {form}
      {message && (
        <div role="status" style={{ fontSize: 11, color: message.error ? '#ff8a80' : c.GREEN, textAlign: 'center', maxWidth: 360 }}>
          {message.text}
        </div>
      )}
      <div style={{ fontSize: 10, color: c.DIM, lineHeight: 1.8, textAlign: 'center' }}>
        信用残（JPX 週次）の蓄積 {weeksText}<br />
        毎週たまっていき、それ以前の期間は判定できません
      </div>
    </div>
  )

  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', flexDirection: isMobile ? 'column' : 'row',
      background: c.BG, backgroundImage: c.SCAN, fontFamily: c.FONT, overflow: isMobile ? 'auto' : 'hidden',
    }}>
      {left}
      <div style={{
        flex: 1, minWidth: 0, minHeight: 0, overflowY: isMobile ? 'visible' : 'auto',
        padding: isMobile ? 14 : 16, paddingBottom: isMobile ? 130 : 70,
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        {entries === null ? (
          <div style={{ fontSize: 12, color: c.DIM }}>読み込み中…</div>
        ) : entries.length === 0 ? (
          <div style={{
            margin: 'auto', fontSize: 12.5, color: c.DESC, textAlign: 'center', lineHeight: 2,
            border: `1px dashed ${c.BORDER}`, borderRadius: 6, padding: 24,
          }}>
            まだ登録した銘柄はありません。<br />左の欄に銘柄コードを入れて「作成」を押してください。
          </div>
        ) : entries.map((e) => (
          <Card key={e.code} entry={e} state={cards[e.code]} c={c} theme={theme} btn={btn}
            onRefresh={() => refresh(e.code)} onRemove={() => remove(e.code)} />
        ))}
      </div>
    </div>
  )
}

function Card({ entry, state, c, theme, btn, onRefresh, onRemove }: {
  entry: Entry
  state: CardState | undefined
  c: ReturnType<typeof cy>
  theme: 'dark' | 'light'
  btn: React.CSSProperties
  onRefresh: () => void
  onRemove: () => void
}) {
  const [confirm, setConfirm] = useState(false)
  const loading = !state || state.status === 'loading'
  const ready = state?.status === 'ready' ? state : null

  return (
    <section style={{
      flexShrink: 0, border: `1px solid ${c.BORDER}`, borderRadius: 6, background: c.HDBG, padding: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: c.GREEN, letterSpacing: '0.08em' }}>
          ▌ {entry.code} {entry.name}
        </span>
        <span style={{ fontSize: 10, color: c.DIM }}>更新 {fmtTime(entry.updatedAt)}</span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={onRefresh} disabled={loading} style={{ ...btn, opacity: loading ? 0.5 : 1 }}>
          {loading ? '読み込み中…' : '更新'}
        </button>
        {confirm ? (
          <>
            <button type="button" onClick={onRemove} style={{ ...btn, borderColor: '#ff8a80', color: '#ff8a80' }}>削除する</button>
            <button type="button" onClick={() => setConfirm(false)} style={btn}>やめる</button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} style={btn}>削除</button>
        )}
      </div>

      {state?.status === 'error' && <div style={{ fontSize: 12, color: '#ff8a80' }}>{state.message}</div>}
      {loading && <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: c.DIM }}>チャートを作っています…</div>}
      {ready && (
        <>
          <MarginKijitsuChart bars={ready.bars} margin={ready.margin} runs={ready.runs} c={c} theme={theme} />
          <Summary ready={ready} c={c} />
        </>
      )}
    </section>
  )
}

function Summary({ ready, c }: { ready: Extract<CardState, { status: 'ready' }>; c: ReturnType<typeof cy> }) {
  const { margin, runs, weeks } = ready
  const last = margin[margin.length - 1]
  const line: React.CSSProperties = { fontSize: 11.5, color: c.DESC, lineHeight: 1.9 }
  const man = (v: number) => `${Math.round(v / 1000) / 10}万株`

  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {margin.length === 0 ? (
        <div style={line}>信用残のデータがありません（信用取引の対象外か、まだ蓄積されていません）。</div>
      ) : (
        <div style={line}>
          最新 {last.w.slice(5).replace('-', '/')}：制度買残 {man(last.sysLong)}・一般買残 {man(last.genLong)}
          {last.sysShort + last.genShort > 0 && `・倍率 ${((last.sysLong + last.genLong) / (last.sysShort + last.genShort)).toFixed(1)}倍`}
        </div>
      )}
      {runs.length > 0 ? runs.map((r) => (
        <div key={r.from} style={line}>
          <span style={{ color: '#ef5350' }}>悪化 {r.from.slice(5).replace('-', '/')}〜{r.to.slice(5).replace('-', '/')}（{r.weeks}週）</span>
          ：制度買残 {man(r.sysLongFrom)}→{man(r.sysLongTo)}・株価 {r.closeFrom.toLocaleString()}→{r.closeTo.toLocaleString()}
          <span style={{ color: '#82b1ff' }}> ／ 期日の目安 {r.kijitsuFrom.replace(/-/g, '/')}〜{r.kijitsuTo.slice(5).replace('-', '/')}</span>
        </div>
      )) : margin.length > 0 && (
        <div style={line}>
          {weeks < MIN_WEEKS + 1
            ? `データが${weeks}週分しかないため、悪化期間はまだ判定できません（${MIN_WEEKS}週以上続いた悪化を探します）。`
            : `蓄積した${weeks}週の中に、${MIN_WEEKS}週以上続いた悪化はありません。`}
        </div>
      )}
      <div style={{ fontSize: 10, color: c.DIM, marginTop: 2 }}>
        赤＝制度買残が増え株価が下がった週が{MIN_WEEKS}週以上続いた期間 ／ 青＝その6か月後（休場日は前の営業日）。状態の記述で、売買の推奨ではありません。
      </div>
    </div>
  )
}
