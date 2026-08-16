// 地下室ページの共通部品（デイトレード／スイングトレードで同じ動き・同じ形にする）
//
// 🔴 このページ群の書き方＝**結論が先、数字が主役、説明は書かない**（2026-08-16 ユーザー指示）。
//    部品もその形に寄せてある：判定スタンプ → 特大の数字 → 判定の一覧、の3種類しかない。
// 🔵 動きは「スクロールして見えたものだけ、一度だけ」。全部が一斉に動くと目の置き場が無い
//    （波動の書と同じ作法＝`ChartPatternPanel` の useInView を踏襲）。
// 🔴 画像は使わない。CSS と SVG だけ。`prefers-reduced-motion` で止まる。

import type React from 'react'
import { BASEMENT_MONO, type basementColors } from './basementTheme'
import { useInView, useCountUp } from './basementHooks'

type C = ReturnType<typeof basementColors>

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
    <div ref={ref} style={{ border: `1px solid ${c.border}`, borderRadius: 12, overflow: 'hidden' }}>
      {rows.map((r, i) => (
        <div key={r.label} className={seen ? 'bsmt-rise' : undefined} style={{
          opacity: seen ? undefined : 0, animationDelay: `${i * 70}ms`,
          position: 'relative',
          padding: '12px 14px', background: i % 2 ? 'transparent' : c.card,
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
