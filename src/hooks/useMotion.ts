// 画面共通の「動き」フック（地下室・モメンタム銘柄などで使い回す）。
//
// 🔵 見えたときに一度だけ動かす／数字は0から駆け上がる、の2つだけ。
// 🔴 `prefers-reduced-motion` では動かさず、最初から結果を見せる。

import { useEffect, useRef, useState } from 'react'
import type React from 'react'

/** 動きを減らす設定なら、演出は出さずに結果だけ見せる */
export function reduceMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** スクロールして見えたか（一度きり） */
export function useInView<T extends HTMLElement>(threshold = 0.25): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    if (seen) return
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return }
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setSeen(true); io.disconnect() }
    }, { threshold })
    io.observe(el)
    return () => io.disconnect()
  }, [seen, threshold])
  return [ref, seen]
}

/** 0 →目標値へ駆け上がる */
export function useCountUp(target: number, seen: boolean, ms = 1100): number {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!seen) return
    if (reduceMotion() || typeof requestAnimationFrame === 'undefined') { setV(target); return }
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      setV(target * (1 - Math.pow(1 - p, 3)))   // ease-out cubic
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [seen, target, ms])
  return v
}
