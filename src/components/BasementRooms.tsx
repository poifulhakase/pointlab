// 地下室（部屋を左右に並べて滑らせる）。
//
// 🔴 **地下室はひとつの場所**（2026-08-16 ユーザー指示）。デイ／スイングは
//    別ページではなく**同じ部屋の並び**として、左右のスライドで行き来する。
//    右上の切替ボタンは廃止＝画面の中で動かす。
// 🔵 操作は4通り＝①スワイプ／ドラッグ（指でもマウスでも）②画面端の矢印
//    ③キーボード ← →  ④ページ末尾の「隣の部屋」カード。
// 🔴 壁・電球・ヘッダーは**ここが持つ**。部屋ごとに持つと、移動のたびに壁まで描き直されて
//    「同じ部屋の中を歩いている」感じが消える。
// 🔴 動きは派手にするが `prefers-reduced-motion` では全部止める。

import { useCallback, useEffect, useRef, useState } from 'react'
import type React from 'react'
import {
  basementColors, basementVeil, BASEMENT_MONO, BASEMENT_ROOMS, type BasementRoomKey,
} from './basementTheme'
import { BasementKeyframes, BasementBackdrop } from './basementKit'
import { reduceMotion } from './basementHooks'
import { DaytradeRoom } from './DaytradeResearchView'
import { SwingRoom } from './SwingResearchView'

type Props = {
  theme: 'dark' | 'light'
  isMobile: boolean
  /** いま見せる部屋。🔴 単一情報源は App の ViewMode（2026-08-16 に内部stateから移した） */
  room: BasementRoomKey
  /** 部屋が変わったとき（スワイプ・矢印・隣の部屋カード・右下のタブ） */
  onRoomChange: (key: BasementRoomKey) => void
  onClose: () => void
}

/** 部屋の中身。`BASEMENT_ROOMS` と同じ並びで持つ */
const ROOM_BODY: Record<BasementRoomKey, typeof DaytradeRoom> = {
  daytrade: DaytradeRoom,
  swing: SwingRoom,
}

/** これ以上ドラッグしたら隣へ移る（px） */
const SWIPE_PX = 70
/** 移動アニメーションの長さ。演出（電球の揺れ・光の走り）と合わせる */
const SLIDE_MS = 620

export default function BasementRooms({ theme, isMobile, room: roomKey, onRoomChange, onClose }: Props) {
  const c = basementColors(theme)
  const n = BASEMENT_ROOMS.length
  const idx = Math.max(0, BASEMENT_ROOMS.findIndex(r => r.key === roomKey))
  /** ドラッグ中の追従量（px）。null＝ドラッグしていない */
  const [drag, setDrag] = useState<number | null>(null)
  /** 移動中フラグ（電球を揺らし、光を走らせる） */
  const [moving, setMoving] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const pad = isMobile ? 14 : 24
  const mono = BASEMENT_MONO
  const room = BASEMENT_ROOMS[idx]

  const go = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(n - 1, next))
    const key = BASEMENT_ROOMS[clamped]?.key
    if (!key || key === roomKey) return
    setMoving(m => m + 1)
    onRoomChange(key)
  }, [n, roomKey, onRoomChange])

  const goKey = useCallback((key: BasementRoomKey) => {
    go(BASEMENT_ROOMS.findIndex(r => r.key === key))
  }, [go])

  // 移動の余韻（演出用のクラスを外す）
  useEffect(() => {
    if (!moving) return
    const t = setTimeout(() => setMoving(0), SLIDE_MS + 320)
    return () => clearTimeout(t)
  }, [moving])

  // キーボード ← →
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(idx - 1)
      else if (e.key === 'ArrowRight') go(idx + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, idx])

  // ── 指／マウスのドラッグ ───────────────────────────────
  // 🔴 縦スクロールを邪魔しないため、**最初の動きで軸を決めて**横のときだけ追従する。
  const gesture = useRef<{ x: number; y: number; axis: 'x' | 'y' | null; id: number | null }>({
    x: 0, y: 0, axis: null, id: null,
  })

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    gesture.current = { x: e.clientX, y: e.clientY, axis: null, id: e.pointerId }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current
    if (g.id !== e.pointerId) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (!g.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    }
    if (g.axis !== 'x') return
    // 端では引っぱりを重くする（これ以上は無いことを手で分からせる）
    const atEdge = (dx > 0 && idx === 0) || (dx < 0 && idx === n - 1)
    setDrag(atEdge ? dx * 0.25 : dx)
  }
  const endGesture = () => {
    const d = drag
    gesture.current = { x: 0, y: 0, axis: null, id: null }
    setDrag(null)
    if (d == null) return
    if (d <= -SWIPE_PX) go(idx + 1)
    else if (d >= SWIPE_PX) go(idx - 1)
  }

  const dragging = drag != null
  const width = wrapRef.current?.clientWidth ?? 1
  // トラックは n 画面ぶんの幅。1画面 ＝ (100 / n)%
  const shift = -idx * (100 / n)
  const dragPct = dragging ? (drag! / width) * (100 / n) : 0

  return (
    <div ref={wrapRef} style={{
      flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden',
      background: c.bg, color: c.text,
      touchAction: 'pan-y',
    }}>
      <BasementKeyframes />
      <BasementBackdrop c={c} jolt={moving > 0} />

      {/* ヘッダー（部屋をまたいで動かない） */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 4,
        ...basementVeil(c.dark), borderBottom: `1px solid ${c.border}`,
        padding: `${pad / 2}px ${pad}px`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: mono, fontSize: isMobile ? 10 : 11, letterSpacing: '0.14em', color: c.accent }}>
          <span aria-hidden className="bsmt-glow" style={{
            width: 8, height: 8, borderRadius: '50%', background: '#ffd79a',
            boxShadow: '0 0 8px 3px rgba(255,205,130,0.5)', display: 'inline-block',
          }} />
          {/* 🔵 部屋の名前はスライドに合わせて差し替わる */}
          地下室 / {room.label}
        </div>
        <button type="button" onClick={onClose} aria-label="閉じる"
          style={{ width: 30, height: 30, borderRadius: 6, border: `1px solid ${c.border}`, background: 'transparent', color: c.text, cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>×</button>
      </div>

      {/* 部屋の並び（左右に滑る） */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        // 🔵 マウスで引っぱっている間は文字が選択されないようにする
        style={{ position: 'absolute', inset: 0, overflow: 'hidden', userSelect: dragging ? 'none' : undefined }}
      >
        <div style={{
          display: 'flex', width: `${n * 100}%`, height: '100%',
          transform: `translateX(${shift + dragPct}%)`,
          transition: dragging || reduceMotion() ? 'none' : `transform ${SLIDE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        }}>
          {BASEMENT_ROOMS.map((r, i) => {
            const Body = ROOM_BODY[r.key]
            const active = i === idx
            return (
              <div key={r.key} style={{
                width: `${100 / n}%`, flexShrink: 0, height: '100%',
                overflowY: 'auto', overflowX: 'hidden',
                // 🔵 奥行き＝いない部屋は少し縮んで沈む（隣の部屋を覗いている感じにする）
                transform: active || reduceMotion() ? 'none' : 'scale(0.94)',
                filter: active || reduceMotion() ? 'none' : 'brightness(0.55)',
                transition: `transform ${SLIDE_MS}ms cubic-bezier(0.22, 1, 0.36, 1), filter ${SLIDE_MS}ms ease`,
                paddingTop: isMobile ? 46 : 52,
                paddingBottom: isMobile ? 92 : 74,
              }}>
                <Body c={c} isMobile={isMobile} onSwitchRoom={goKey} />
              </div>
            )
          })}
        </div>
      </div>

      {/* 端の矢印（PC）。🔵 行き先の部屋名を添える */}
      {!isMobile && BASEMENT_ROOMS.map((r, i) => {
        if (i === idx) return null
        const left = i < idx
        return (
          <button
            key={r.key}
            type="button"
            onClick={() => go(i)}
            aria-label={`${r.label}へ`}
            style={{
              position: 'absolute', top: '50%', [left ? 'left' : 'right']: 14,
              transform: 'translateY(-50%)', zIndex: 4,
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 14px', borderRadius: 999,
              border: `1px solid ${c.border}`, background: c.card, backdropFilter: 'blur(8px)',
              color: c.accent, cursor: 'pointer', fontFamily: mono, fontSize: 11, letterSpacing: '0.08em',
              boxShadow: c.dark ? '0 10px 26px rgba(0,0,0,0.45)' : '0 8px 20px rgba(90,78,58,0.10)',
            }}
          >
            {left && <span aria-hidden style={{ fontSize: 15 }}>←</span>}
            {r.short}
            {!left && <span aria-hidden style={{ fontSize: 15 }}>→</span>}
          </button>
        )
      })}

      {/* 現在地（下・中央）。押しても移れる */}
      <div style={{
        position: 'absolute', left: '50%', bottom: isMobile ? 62 : 18, transform: 'translateX(-50%)',
        zIndex: 4, display: 'flex', alignItems: 'center', gap: 10,
        padding: '7px 12px', borderRadius: 999,
        border: `1px solid ${c.border}`, ...basementVeil(c.dark),
      }}>
        {BASEMENT_ROOMS.map((r, i) => {
          const on = i === idx
          return (
            <button key={r.key} type="button" onClick={() => go(i)} aria-current={on ? 'page' : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                border: 'none', background: 'transparent', cursor: on ? 'default' : 'pointer',
                fontFamily: mono, fontSize: isMobile ? 9.5 : 10.5, letterSpacing: '0.08em',
                color: on ? c.accent : c.sub, padding: 0,
              }}>
              <span aria-hidden style={{
                width: on ? 18 : 6, height: 6, borderRadius: 999,
                background: on ? c.accent : c.border,
                boxShadow: on && c.dark ? `0 0 10px ${c.accent}88` : 'none',
                transition: 'width 320ms ease, background 320ms ease',
              }} />
              {isMobile ? r.short : r.label}
            </button>
          )
        })}
      </div>

      {/* 移動の演出＝光が横に走る（部屋を移るときだけ） */}
      {moving > 0 && !reduceMotion() && (
        <div key={moving} aria-hidden className="bsmt-wipe" style={{
          position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none',
          background: `linear-gradient(105deg, transparent 38%, rgba(255,205,130,${c.dark ? 0.16 : 0.22}) 50%, transparent 62%)`,
        }} />
      )}
    </div>
  )
}
