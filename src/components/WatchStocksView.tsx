// Believe ＞ その他の監視銘柄（別ページ）。
//
// 🔴 **枠（5銘柄）ではない**。フィジカルAI／AIの4層に関わる会社を、数字だけ並べて置く場所。
// 🔴 観測だけ。売買の推奨ではない。
// 🔵 **購入時に考えることのふたつ目＝200日線付近か**を、この一覧でも色で示す（±5%以内）。
// 🔵 チャートは持たない（配信を軽くするため。見たくなったら枠に入れる）。

import { useEffect, useMemo, useState } from 'react'
import { cy } from '../utils/cyberTheme'
import { fetchPoiroboStocks, type WatchStock } from '../utils/poiroboStocks'
import { PoiroboLoader } from './PoiroboLoader'

type Props = { theme: 'dark' | 'light'; isMobile: boolean; onClose: () => void }
type C = ReturnType<typeof cy>

const pct = (v: number | null | undefined, d = 1) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(d)}%`)

/** 並べ方。🔵 既定は「200日線に近い順」＝購入時に考える2つ目の基準で並ぶ */
const SORTS = [
  { key: 'near', label: '200日線に近い順' },
  { key: 'ret12m', label: '12ヶ月が強い順' },
  { key: 'fromHigh', label: '高値から遠い順' },
] as const
type SortKey = typeof SORTS[number]['key']

export default function WatchStocksView({ theme, isMobile, onClose }: Props) {
  const c = cy(theme)
  const dark = theme === 'dark'
  const [rows, setRows] = useState<WatchStock[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortKey>('near')

  useEffect(() => {
    let alive = true
    fetchPoiroboStocks()
      .then(d => { if (alive) { setRows(d?.watch ?? []); setLoading(false) } })
      .catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const sorted = useMemo(() => {
    const list = [...(rows ?? [])]
    if (sort === 'near') list.sort((a, b) => Math.abs(a.dev200_pct ?? 999) - Math.abs(b.dev200_pct ?? 999))
    if (sort === 'ret12m') list.sort((a, b) => (b.ret12m ?? -999) - (a.ret12m ?? -999))
    if (sort === 'fromHigh') list.sort((a, b) => (a.from_52w_high_pct ?? 0) - (b.from_52w_high_pct ?? 0))
    return list
  }, [rows, sort])

  const pad = isMobile ? 20 : 28

  return (
    <div style={{
      flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative',
      background: c.BG, backgroundImage: c.SCAN, color: c.TXTCLR, fontFamily: c.FONT,
    }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 6,
        background: dark ? 'rgba(5,14,26,0.82)' : 'rgba(240,247,255,0.86)',
        backdropFilter: 'blur(12px)', borderBottom: `1px solid ${c.BORDER}`,
        padding: `${pad / 2}px ${pad}px`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <span style={{ fontSize: isMobile ? 10 : 11, letterSpacing: '0.2em', color: c.GREEN, whiteSpace: 'nowrap' }}>
          WATCH / その他の監視銘柄
        </span>
        <button type="button" onClick={onClose} aria-label="戻る"
          style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 6, border: `1px solid ${c.BORDER}`, background: 'transparent', color: c.TXTCLR, cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>
      </div>

      {loading && <div style={{ padding: 40 }}><PoiroboLoader label="WATCH" /></div>}

      {!loading && (
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: `${isMobile ? 26 : 34}px ${pad}px ${isMobile ? 140 : 70}px` }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 30, fontWeight: 900, color: c.GREEN, lineHeight: 1.4 }}>
            その他の監視銘柄
          </h1>
          <p style={{ margin: '14px 0 0', fontSize: isMobile ? 12 : 13, color: c.DESC, lineHeight: 2 }}>
            枠には入れていないが、同じ物差しで見ている会社。
            <b style={{ color: c.GREEN }}>200日線付近</b>のものは色が変わります。
          </p>

          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', margin: `${isMobile ? 22 : 24}px 0 16px` }}>
            {SORTS.map(o => {
              const on = o.key === sort
              return (
                <button key={o.key} type="button" onClick={() => setSort(o.key)}
                  style={{
                    cursor: on ? 'default' : 'pointer', border: `1px solid ${on ? c.BORDBR : c.BORDER}`,
                    background: on ? c.HDBG : 'transparent', color: on ? c.GREEN : c.DIM,
                    borderRadius: 999, padding: isMobile ? '6px 14px' : '5px 14px',
                    fontFamily: c.FONT, fontSize: isMobile ? 10.5 : 10,
                  }}>{o.label}</button>
              )
            })}
          </div>

          <div style={{ display: 'grid', gap: isMobile ? 10 : 8 }}>
            {sorted.map(w => {
              const near = w.dev200_pct != null && Math.abs(w.dev200_pct) <= 5
              return (
                <div key={w.code} style={{
                  border: `1px solid ${near ? c.BORDBR : c.BORDER}`, borderRadius: 12,
                  background: near ? c.HDBG : c.TAREA,
                  boxShadow: near && dark ? `0 0 22px ${c.GREEN}18` : 'none',
                  padding: isMobile ? '14px 14px' : '12px 16px',
                  display: 'flex', flexDirection: isMobile ? 'column' : 'row',
                  gap: isMobile ? 8 : 14, alignItems: isMobile ? 'flex-start' : 'center',
                }}>
                  <div style={{ flex: isMobile ? undefined : '0 0 230px', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{
                      padding: '2px 7px', borderRadius: 999, border: `1px solid ${c.BORDER}`,
                      fontSize: 9.5, color: c.DIM,
                    }}>{w.code}</span>
                    <span style={{ fontSize: isMobile ? 14 : 14, fontWeight: 800 }}>{w.name}</span>
                    <span style={{ fontSize: 9.5, color: c.DIM }}>{w.layer}</span>
                  </div>

                  <div style={{
                    flex: 1, display: 'grid',
                    gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                    gap: isMobile ? 10 : 8, width: '100%',
                  }}>
                    <Cell c={c} label="株価" value={w.close != null ? w.close.toLocaleString() : '—'} />
                    <Cell c={c} label="12ヶ月" value={pct(w.ret12m)} />
                    <Cell c={c} label="52週高値から" value={pct(w.from_52w_high_pct)} />
                    <Cell c={c} label="200日線から" value={pct(w.dev200_pct)} strong={near} />
                  </div>

                  {near && (
                    <span style={{
                      flexShrink: 0, padding: '3px 10px', borderRadius: 999,
                      border: `1px solid ${c.GREEN}`, background: `${c.GREEN}22`,
                      fontSize: 9.5, fontWeight: 800, color: c.GREEN, whiteSpace: 'nowrap',
                    }}>200日線付近</span>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: 24, fontSize: isMobile ? 10 : 10.5, color: c.DIM, lineHeight: 1.9 }}>
            研究の記録であり、売買の推奨ではありません。
          </div>
        </div>
      )}
    </div>
  )
}

function Cell({ c, label, value, strong }: { c: C; label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: c.DIM, letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ marginTop: 3, fontSize: 14, fontWeight: 800, color: strong ? c.GREEN : c.TXTCLR }}>{value}</div>
    </div>
  )
}
