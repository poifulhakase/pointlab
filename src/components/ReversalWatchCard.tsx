// 反転臨界モニター（🔒 管理者専用・PCのみ・研究室の右上に表示）
//
// 「いまのトレンドと逆方向への転換」がどれだけ近づいているかを6条件で観測する。
// 判定ロジックは utils/reversalWatch.ts（純粋関数・テスト済み）に置き、ここは表示だけ。
//
// 🔴 売買の指示は出さない。「条件を満たした／満たしていない」という観測事実のみを並べる。

import { useEffect, useState } from 'react'
import { buildReversalWatch, type ReversalWatch } from '../utils/reversalWatch'
import { fetchNkFuturesPriceData } from '../utils/nkFuturesPriceData'
import { fetchMarginData }         from '../utils/jpxMarginData'
import { fetchShortSellData }      from '../utils/shortSellData'
import { fetchVixDailyData }       from '../utils/vixData'
import { fetchInvestorData }       from '../utils/jpxInvestorData'
import { fetchNtRatioData }        from '../utils/ntRatioData'
import { fetchAdvanceDeclineData } from '../utils/advanceDeclineData'

interface Props {
  theme: 'dark' | 'light'
}

export function ReversalWatchCard({ theme }: Props) {
  const [watch, setWatch] = useState<ReversalWatch | null>(null)
  const [open,  setOpen]  = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        // 🔴 force=true でキャッシュを無視する。
        //    localStorage のキャッシュが残っていると、日足だけ数日前の版が返り
        //    「基準日が項目ごとにズレる」ことが実機で起きた（2026-07-28）。
        //    このカードは管理者1人しか開かないため、毎回取り直しても負荷にならない。
        const [daily, margin, ss, vix, inv, nt, ad] = await Promise.all([
          fetchNkFuturesPriceData(true),
          fetchMarginData(true),
          fetchShortSellData(true),
          fetchVixDailyData(true),
          fetchInvestorData(true),
          fetchNtRatioData(true),
          fetchAdvanceDeclineData(true),
        ])
        if (alive) setWatch(buildReversalWatch(daily, margin, ss, vix, inv, nt, ad))
      } catch {
        if (alive) setError(true)
      }
    })()
    return () => { alive = false }
  }, [])

  const light = theme === 'light'
  const fg    = light ? '#1f2937' : '#e8f0ff'
  const sub   = light ? '#5b6b80' : '#8fa6c4'
  const border = light ? 'rgba(120,150,190,0.35)' : 'rgba(120,180,255,0.28)'
  const bg    = light ? 'rgba(248,251,255,0.92)' : 'rgba(8,16,32,0.86)'

  if (error) return null

  const heading = watch
    ? (watch.trend === 'down' ? '上昇転換の条件' : '下降転換の条件')
    : '読み込み中'

  // 点灯数に応じた色（0〜1=静穏 / 2〜3=兆候 / 4以上=臨界）
  const accent = !watch ? sub
    : watch.lit >= 4 ? '#ff6b6b'
    : watch.lit >= 2 ? '#ffc078'
    : '#4dd4c0'

  return (
    <div
      style={{
        position: 'absolute', top: 36, right: 32, zIndex: 30,
        width: open ? 420 : 260,
        padding: '12px 14px',
        borderRadius: 12,
        border: `1px solid ${border}`,
        background: bg,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        color: fg,
        fontSize: 12,
        lineHeight: 1.6,
        boxShadow: light ? '0 4px 18px rgba(80,120,170,0.16)' : '0 4px 22px rgba(0,0,0,0.42)',
        transition: 'width 0.25s ease',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', background: 'none', border: 'none', padding: 0,
          color: fg, cursor: 'pointer', font: 'inherit',
        }}
        aria-expanded={open}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, letterSpacing: '0.02em' }}>
          <span aria-hidden>🔄</span>反転臨界モニター
        </span>
        <span style={{ fontSize: 11, color: sub }}>{open ? '閉じる ▲' : '詳細 ▼'}</span>
      </button>

      {!watch ? (
        <div style={{ marginTop: 8, color: sub }}>読み込み中…</div>
      ) : (
        <>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: accent, fontVariantNumeric: 'tabular-nums' }}>
              {watch.lit} / {watch.total}
            </span>
            <span style={{ color: sub }}>{heading}</span>
          </div>

          <div style={{ color: sub, fontSize: 11 }}>
            {watch.trendNote}
            {watch.asOf ? `／日足 ${watch.asOf}` : ''}
          </div>

          {/* 🔴 日足が古いと、トレンド判定と価格構造が過去の姿のままになる。黙って古くならないよう明示する */}
          {watch.staleDays !== null && watch.staleDays >= 4 && (
            <div style={{ color: '#ff6b6b', fontSize: 11, marginTop: 2 }}>
              ⚠ 日足データが {watch.staleDays}日前のままです（トレンド判定・価格構造が古い可能性）
            </div>
          )}

          {/* 点灯状況のドット（閉じている時の要約） */}
          <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
            {watch.items.map(it => (
              <span
                key={it.key}
                title={`${it.label}：${it.lit ? '点灯' : '未達'}`}
                style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: it.lit ? accent : (light ? 'rgba(120,150,190,0.25)' : 'rgba(140,170,210,0.22)'),
                  boxShadow: it.lit ? `0 0 8px ${accent}` : 'none',
                }}
              />
            ))}
          </div>

          {open && (
            <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
              {watch.items.map(it => (
                <div key={it.key} style={{ borderTop: `1px solid ${border}`, paddingTop: 7 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: it.lit ? accent : sub }}>{it.lit ? '●' : '○'}</span>
                    <span style={{ fontWeight: 600 }}>{it.label}</span>
                    <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{it.value}</span>
                  </div>
                  <div style={{ color: sub, fontSize: 11, paddingLeft: 18 }}>{it.criteria}</div>
                </div>
              ))}
              <div style={{ color: sub, fontSize: 10.5, borderTop: `1px solid ${border}`, paddingTop: 7 }}>
                観測された事実のみを表示しています。売買の判断を示すものではありません。
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
