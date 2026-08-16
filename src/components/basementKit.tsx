// 地下室ページの共通部品（デイトレード／スイングトレードで同じ動き・同じ形にする）
//
// 🔴 このページ群の書き方＝**結論が先、数字が主役、説明は書かない**（2026-08-16 ユーザー指示）。
//    部品もその形に寄せてある：判定スタンプ → 特大の数字 → 判定の一覧、の3種類しかない。
// 🔵 動きは「スクロールして見えたものだけ、一度だけ」。全部が一斉に動くと目の置き場が無い
//    （波動の書と同じ作法＝`ChartPatternPanel` の useInView を踏襲）。
// 🔴 画像は使わない。CSS と SVG だけ。`prefers-reduced-motion` で止まる。

import type React from 'react'
import { BASEMENT_MONO, BASEMENT_ROOMS, type BasementRoomKey, type basementColors } from './basementTheme'
import { useInView, useCountUp } from './basementHooks'

type C = ReturnType<typeof basementColors>

/**
 * 地下室の背景（壁・光・埃）。ページの最背面に1枚だけ敷く。
 *
 * 🔴 画像は使わない。CSS のグラデーションと SVG だけで作る（`prefers-reduced-motion` で揺れは止まる）。
 * 🔵 重ねているもの＝①コンクリートの地色 ②粒子（feTurbulence の粉っぽさ）③打ち継ぎの目地
 *    ④壁のシミ ⑤吊り下げた裸電球と光の筋 ⑥舞う埃 ⑦四隅を沈めるビネット。
 * 🔴 **読みやすさが先**。どの層も薄く、ライトテーマではさらに弱くする
 *    （明るい地下室＝窓のない資料室くらいの感じに留める）。
 */
export function BasementBackdrop({ c }: { c: C }) {
  const d = c.dark
  const layer: React.CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none' }
  // 粒子（コンクリートの粉っぽさ）。SVG フィルタをそのまま背景に敷く
  const grain = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)'/%3E%3C/svg%3E\")"
  const joint = d ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.045)'

  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
      {/* ① 地色（電球の下だけ暖かく、足元は沈む） */}
      <div style={{
        ...layer,
        background: d
          ? 'radial-gradient(120% 70% at 50% -8%, rgba(255,205,130,0.16) 0%, rgba(255,190,120,0.05) 38%, transparent 66%), linear-gradient(180deg, #101012 0%, #0b0c0e 46%, #08090a 100%)'
          : 'radial-gradient(120% 70% at 50% -8%, rgba(255,205,130,0.30) 0%, rgba(255,205,130,0.10) 38%, transparent 66%), linear-gradient(180deg, #f3f0eb 0%, #efece7 52%, #e4dfd6 100%)',
      }} />

      {/* ② 粒子 */}
      <div style={{
        ...layer, backgroundImage: grain, backgroundSize: '180px 180px',
        opacity: d ? 0.05 : 0.035, mixBlendMode: d ? 'overlay' : 'multiply',
      }} />

      {/* ③ 打ち継ぎの目地（コンクリートブロック） */}
      <div style={{
        ...layer,
        backgroundImage: `linear-gradient(${joint} 1px, transparent 1px), linear-gradient(90deg, ${joint} 1px, transparent 1px)`,
        backgroundSize: '112px 56px',
      }} />
      {/* 目地の凹みに落ちる影（1本だけずらして重ねる） */}
      <div style={{
        ...layer,
        backgroundImage: `linear-gradient(${d ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.05)'} 1px, transparent 1px)`,
        backgroundSize: '112px 56px', backgroundPosition: '0 1px',
      }} />

      {/* ④ 壁のシミ（にじみ。位置は固定＝毎回同じ地下室に見えるように） */}
      {[
        { top: '12%', left: '6%', w: 260, h: 150 },
        { top: '58%', left: '72%', w: 300, h: 190 },
        { top: '82%', left: '18%', w: 220, h: 120 },
      ].map((s, i) => (
        <div key={i} style={{
          position: 'absolute', top: s.top, left: s.left, width: s.w, height: s.h,
          borderRadius: '50%', filter: 'blur(38px)',
          background: d ? 'rgba(0,0,0,0.5)' : 'rgba(120,100,70,0.10)',
        }} />
      ))}

      {/* ⑤ 吊り下げた裸電球（右上）と、そこから落ちる光の筋 */}
      <div style={{ position: 'absolute', top: 0, right: 'clamp(18px, 9vw, 190px)', width: 150, height: 320 }}>
        {/* 光の筋（円錐） */}
        <div className="bsmt-glow" style={{
          position: 'absolute', top: 96, left: '50%', width: 560, height: '82vh',
          transform: 'translateX(-50%)',
          clipPath: 'polygon(46% 0%, 54% 0%, 100% 100%, 0% 100%)',
          // 🔵 縁をぼかす＝スポットライトではなく、埃を含んだ空気に光が散っている感じにする
          filter: 'blur(14px)',
          background: `linear-gradient(180deg, rgba(255,205,130,${d ? 0.15 : 0.22}) 0%, rgba(255,205,130,0) 80%)`,
        }} />
        <svg width="150" height="200" viewBox="0 0 150 200" style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}>
          <g className="bsmt-lamp">
            {/* コード */}
            <line x1="75" y1="-40" x2="75" y2="72" stroke={d ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.28)'} strokeWidth="1.5" />
            {/* ソケット */}
            <rect x="69" y="70" width="12" height="16" rx="2" fill={d ? '#3a332a' : '#6b6052'} />
            {/* 電球 */}
            <circle cx="75" cy="99" r="12" fill={d ? 'rgba(255,214,150,0.92)' : 'rgba(255,222,168,0.95)'} />
            <circle cx="75" cy="99" r="12" fill="none" stroke={d ? 'rgba(255,236,200,0.6)' : 'rgba(160,120,50,0.35)'} strokeWidth="1" />
            {/* フィラメント */}
            <path d="M71 100 l2.5 -5 l2 5 l2.5 -5" fill="none" stroke={d ? 'rgba(120,70,10,0.55)' : 'rgba(120,70,10,0.4)'} strokeWidth="1.2" strokeLinecap="round" />
            {/* 電球まわりのにじみ */}
            <circle className="bsmt-glow" cx="75" cy="99" r="34" fill={`rgba(255,205,130,${d ? 0.2 : 0.26})`} style={{ filter: 'blur(14px)' }} />
          </g>
        </svg>
      </div>

      {/* ⑥ 舞う埃（光の筋の中だけ・数は控えめ） */}
      {[
        { left: '62%', top: '34%', delay: '0s' },
        { left: '70%', top: '52%', delay: '1.6s' },
        { left: '78%', top: '41%', delay: '3.1s' },
        { left: '66%', top: '68%', delay: '4.4s' },
        { left: '84%', top: '60%', delay: '5.8s' },
      ].map((p, i) => (
        <span key={i} className="bsmt-dust" style={{
          position: 'absolute', left: p.left, top: p.top, animationDelay: p.delay,
          width: 2.5, height: 2.5, borderRadius: '50%',
          background: d ? 'rgba(255,225,180,0.75)' : 'rgba(150,120,60,0.5)',
          boxShadow: d ? '0 0 6px rgba(255,205,130,0.7)' : 'none',
        }} />
      ))}

      {/* ⑦ ビネット（四隅を沈める＝窓のない部屋） */}
      <div style={{
        ...layer,
        background: d
          ? 'radial-gradient(125% 100% at 50% 14%, transparent 46%, rgba(0,0,0,0.5) 100%)'
          : 'radial-gradient(125% 100% at 50% 14%, transparent 50%, rgba(60,50,35,0.14) 100%)',
      }} />

      {/* ⑧ 足元（床との境。うっすら線が入るだけ） */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: '22vh',
        background: d
          ? 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.45) 100%)'
          : 'linear-gradient(180deg, transparent 0%, rgba(90,78,58,0.14) 100%)',
        borderBottom: `1px solid ${d ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}`,
      }} />
    </div>
  )
}

/**
 * 部屋の切替（ヘッダーに置く）。
 * 🔵 地下室は**ひと続きの場所**なので、いま居る部屋と隣の部屋を常に出す。
 *    毎回 DATA まで戻らないと行き来できないと、2ページが別々のものに見える（2026-08-16 ユーザー指摘）。
 */
export function BasementRoomSwitch({ c, isMobile, current, onSwitch }: {
  c: C; isMobile: boolean
  current: BasementRoomKey
  onSwitch: (key: BasementRoomKey) => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 2, padding: 2,
      border: `1px solid ${c.border}`, borderRadius: 999,
      background: c.dark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.5)',
    }}>
      {BASEMENT_ROOMS.map(r => {
        const on = r.key === current
        return (
          <button
            key={r.key}
            type="button"
            onClick={() => { if (!on) onSwitch(r.key) }}
            aria-current={on ? 'page' : undefined}
            style={{
              cursor: on ? 'default' : 'pointer',
              border: 'none', borderRadius: 999,
              padding: isMobile ? '4px 10px' : '5px 14px',
              fontFamily: BASEMENT_MONO, fontSize: isMobile ? 10 : 11, letterSpacing: '0.08em',
              color: on ? (c.dark ? '#1b1610' : '#fff') : c.sub,
              background: on ? c.accent : 'transparent',
              boxShadow: on && c.dark ? `0 0 14px ${c.accent}55` : 'none',
              transition: 'background 0.18s, color 0.18s',
            }}
          >{isMobile ? r.short : r.label}</button>
        )
      })}
    </div>
  )
}

/**
 * 隣の部屋へ（ページ末尾）。
 * 🔵 押すと隣の判定がそのまま出るので、読み終わりがそのまま次の入口になる。
 */
export function BasementNextRoom({ c, isMobile, current, onSwitch }: {
  c: C; isMobile: boolean
  current: BasementRoomKey
  onSwitch: (key: BasementRoomKey) => void
}) {
  const [ref, seen] = useInView<HTMLButtonElement>()
  const i = BASEMENT_ROOMS.findIndex(r => r.key === current)
  const next = BASEMENT_ROOMS[(i + 1) % BASEMENT_ROOMS.length]
  if (!next || next.key === current) return null
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onSwitch(next.key)}
      className={seen ? 'bsmt-rise' : undefined}
      style={{
        opacity: seen ? undefined : 0,
        display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 18, width: '100%',
        marginTop: 26, padding: isMobile ? '16px 14px' : '20px 22px',
        border: `1px solid ${c.border}`, borderLeft: `3px solid ${c.accent}`, borderRadius: 12,
        background: c.card, backdropFilter: 'blur(8px)', cursor: 'pointer', textAlign: 'left',
        boxShadow: c.dark ? '0 12px 26px rgba(0,0,0,0.4)' : '0 8px 20px rgba(90,78,58,0.08)',
      }}
    >
      <span aria-hidden style={{
        fontSize: isMobile ? 28 : 38, fontWeight: 900, lineHeight: 1,
        color: c.accent, flexShrink: 0,
      }}>{next.mark}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontFamily: BASEMENT_MONO, fontSize: 10, letterSpacing: '0.28em', color: c.sub }}>
          NEXT ROOM
        </span>
        <span style={{ display: 'block', marginTop: 4, fontSize: isMobile ? 14 : 17, fontWeight: 800, color: c.text }}>
          {next.label}
        </span>
        <span style={{ display: 'block', marginTop: 3, fontSize: isMobile ? 11.5 : 12.5, color: c.sub, lineHeight: 1.7 }}>
          {next.verdict}
        </span>
      </span>
      <span aria-hidden style={{ marginLeft: 'auto', color: c.accent, fontSize: 20, flexShrink: 0 }}>→</span>
    </button>
  )
}

/**
 * 判定スタンプ（ページの頭に1枚）。
 * 🔴 いちばん上で**結論を言い切る**ための枠。説明は書かない。
 * 背景に巨大な一文字（× / ○）が流れ込み、判定文が打ち込まれる。
 */
export function VerdictHero({ c, isMobile, mark, tone, verdict, note }: {
  c: C; isMobile: boolean
  /** 背景に出す巨大な一文字 */
  mark: string
  tone: 'no' | 'ok' | 'trap'
  /** 判定（言い切る短文） */
  verdict: string
  /** 添える1行（数字だけ。文章にしない） */
  note?: string
}) {
  const [ref, seen] = useInView<HTMLDivElement>()
  const color = tone === 'ok' ? c.ok : tone === 'trap' ? c.trap : c.no
  return (
    <div ref={ref} style={{
      position: 'relative', overflow: 'hidden',
      border: `1px solid ${c.border}`, borderRadius: 14, background: c.card,
      backdropFilter: 'blur(8px)',
      boxShadow: c.dark ? '0 18px 40px rgba(0,0,0,0.45)' : '0 12px 30px rgba(90,78,58,0.10)',
      padding: isMobile ? '26px 18px' : '44px 34px', marginBottom: 14,
    }}>
      {/* 巨大な一文字（背景）*/}
      <div aria-hidden className={seen ? 'bsmt-ghost' : undefined} style={{
        position: 'absolute', right: isMobile ? -10 : 18, top: '50%',
        transform: 'translateY(-50%)', opacity: 0,
        fontSize: isMobile ? 190 : 300, lineHeight: 1, fontWeight: 900,
        color, pointerEvents: 'none', userSelect: 'none',
      }}>{mark}</div>

      <div style={{ position: 'relative' }}>
        <div style={{ fontFamily: BASEMENT_MONO, fontSize: 10, letterSpacing: '0.3em', color: c.sub, marginBottom: 10 }}>
          VERDICT
        </div>
        <div className={seen ? 'bsmt-stamp' : undefined} style={{
          opacity: seen ? undefined : 0,
          fontSize: isMobile ? 26 : 40, fontWeight: 900, lineHeight: 1.25,
          letterSpacing: '-0.01em', color,
          textShadow: c.dark ? `0 0 34px ${color}44` : 'none',
        }}>{verdict}</div>
        {note && (
          <div className={seen ? 'bsmt-rise' : undefined} style={{
            opacity: seen ? undefined : 0, animationDelay: '260ms',
            marginTop: 12, fontFamily: BASEMENT_MONO,
            fontSize: isMobile ? 12 : 14, color: c.text, letterSpacing: '0.04em',
          }}>{note}</div>
        )}
      </div>
    </div>
  )
}

/**
 * 特大の数字（結論を数字1つで言う）。
 * 🔵 見えたところで 0 から駆け上がる。単位・符号は前後に置く。
 */
export function BigStat({ c, isMobile, value, decimals = 2, prefix = '', suffix = '', label, tone, delay = 0 }: {
  c: C; isMobile: boolean
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
  label: string
  tone?: 'ok' | 'no' | 'trap'
  delay?: number
}) {
  const [ref, seen] = useInView<HTMLDivElement>()
  const v = useCountUp(value, seen)
  const color = tone === 'ok' ? c.ok : tone === 'trap' ? c.trap : tone === 'no' ? c.no : c.accent
  return (
    <div ref={ref} className={seen ? 'bsmt-rise' : undefined} style={{
      opacity: seen ? undefined : 0, animationDelay: `${delay}ms`,
      border: `1px solid ${c.border}`, borderRadius: 12, background: c.card,
      backdropFilter: 'blur(8px)',
      boxShadow: c.dark ? '0 12px 26px rgba(0,0,0,0.4)' : '0 8px 20px rgba(90,78,58,0.08)',
      padding: isMobile ? '16px 14px' : '20px 18px',
      display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0,
    }}>
      <div style={{
        fontFamily: BASEMENT_MONO, fontWeight: 800, color,
        fontSize: isMobile ? 30 : 40, lineHeight: 1.05, letterSpacing: '-0.02em',
        textShadow: c.dark ? `0 0 26px ${color}33` : 'none',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'clip',
      }}>
        {prefix}{v.toFixed(decimals)}{suffix}
      </div>
      <div style={{ fontSize: isMobile ? 11 : 12, color: c.sub, lineHeight: 1.6 }}>{label}</div>
    </div>
  )
}

/** 特大の数字を横に並べる枠（スマホは2列） */
export function StatGrid({ isMobile, cols, children }: {
  isMobile: boolean; cols: number; children: React.ReactNode
}) {
  return (
    <div style={{
      display: 'grid', gap: 10,
      gridTemplateColumns: isMobile ? 'repeat(2, minmax(0,1fr))' : `repeat(${cols}, minmax(0,1fr))`,
    }}>{children}</div>
  )
}

export type JudgeRow = {
  /** 判定（× 効かない ／ ⚠ 罠 ／ ● 効く） */
  verdict: 'no' | 'trap' | 'ok'
  label: string
  /** 数字（右に出す。文章にしない） */
  value: string
  /** 0〜1。強さのバー（t値や勝率などの目安）。省略可 */
  strength?: number
}

/**
 * 判定の一覧。
 * 🔵 見えた行から順に（stagger で）出て、強さのバーが伸びる。
 * 🔴 ここも**説明は書かない**。ラベルと数字だけ。
 */
export function JudgeList({ c, isMobile, rows }: { c: C; isMobile: boolean; rows: JudgeRow[] }) {
  const [ref, seen] = useInView<HTMLDivElement>()
  const mark = (v: JudgeRow['verdict']) => (v === 'ok' ? '●' : v === 'trap' ? '⚠' : '×')
  const color = (v: JudgeRow['verdict']) => (v === 'ok' ? c.ok : v === 'trap' ? c.trap : c.no)
  return (
    <div ref={ref} style={{
      border: `1px solid ${c.border}`, borderRadius: 12, overflow: 'hidden',
      background: c.card, backdropFilter: 'blur(8px)',
    }}>
      {rows.map((r, i) => (
        <div key={r.label} className={seen ? 'bsmt-rise' : undefined} style={{
          opacity: seen ? undefined : 0, animationDelay: `${i * 70}ms`,
          position: 'relative',
          padding: '12px 14px',
          background: i % 2 ? 'transparent' : (c.dark ? 'rgba(255,255,255,0.028)' : 'rgba(0,0,0,0.022)'),
          borderTop: i ? `1px solid ${c.border}` : 'none',
          display: 'flex', flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 4 : 14, alignItems: isMobile ? 'flex-start' : 'center',
        }}>
          <div style={{ flex: '1 1 auto', minWidth: 0, fontSize: isMobile ? 12.5 : 13.5, fontWeight: 700, lineHeight: 1.6 }}>
            <span style={{ color: color(r.verdict), marginRight: 8, fontSize: 14 }}>{mark(r.verdict)}</span>
            {r.label}
          </div>
          <div style={{
            flex: isMobile ? undefined : '0 0 auto', fontFamily: BASEMENT_MONO,
            fontSize: isMobile ? 11.5 : 12.5, color: c.text, whiteSpace: 'nowrap',
          }}>{r.value}</div>
          {r.strength != null && (
            <div aria-hidden style={{
              position: 'absolute', left: 0, bottom: 0, height: 2,
              width: seen ? `${Math.max(2, Math.min(1, r.strength) * 100)}%` : 0,
              background: color(r.verdict), opacity: 0.55,
              transition: 'width 900ms cubic-bezier(0.2,0.8,0.2,1)',
              transitionDelay: `${i * 70}ms`,
            }} />
          )}
        </div>
      ))}
    </div>
  )
}

/** 見出し（1語〜数語。ここも説明は書かない） */
export function BasementHead({ c, isMobile, children }: { c: C; isMobile: boolean; children: React.ReactNode }) {
  return (
    <h3 style={{
      fontSize: isMobile ? 11 : 12, fontWeight: 800, color: c.sub,
      letterSpacing: '0.28em', margin: '30px 0 12px', fontFamily: BASEMENT_MONO,
    }}>{children}</h3>
  )
}

/** 地下室の演出（両ページで同じものを使う） */
export function BasementKeyframes() {
  return (
    <style>{`
      @keyframes bsmt-rise {
        from { opacity: 0; transform: translateY(14px); }
        to   { opacity: 1; transform: none; }
      }
      .bsmt-rise { animation: bsmt-rise 620ms cubic-bezier(0.2,0.8,0.2,1) both; }

      /* 判定を打ち込む（スタンプ）*/
      @keyframes bsmt-stamp {
        0%   { opacity: 0; transform: scale(1.5) rotate(-4deg); filter: blur(6px); }
        60%  { opacity: 1; transform: scale(0.97) rotate(0.6deg); filter: blur(0); }
        100% { opacity: 1; transform: none; }
      }
      .bsmt-stamp { animation: bsmt-stamp 620ms cubic-bezier(0.2,0.9,0.2,1) both; }

      /* 背景の巨大な一文字が流れ込む */
      @keyframes bsmt-ghost {
        from { opacity: 0;    transform: translate(70px,-50%) scale(1.25); }
        to   { opacity: 0.13; transform: translate(0,-50%) scale(1); }
      }
      .bsmt-ghost { animation: bsmt-ghost 1200ms cubic-bezier(0.2,0.8,0.2,1) both; }

      /* 🔵 裸電球のゆらぎ（.bsmt-glow / bsmt-flicker）は index.css にある。ここでは定義しない */

      @media (prefers-reduced-motion: reduce) {
        .bsmt-rise, .bsmt-stamp { animation: none !important; opacity: 1 !important; transform: none !important; }
        .bsmt-ghost { animation: none !important; opacity: 0.13 !important; transform: translateY(-50%) !important; }
      }
    `}</style>
  )
}
