// 地下室ページの動き（部品と分けてあるのは fast refresh の都合＝1ファイル1種類にするため）
//
// 🔵 動きは「スクロールして見えたものだけ、一度だけ」。全部が一斉に動くと目の置き場が無い
//    （波動の書と同じ作法＝`ChartPatternPanel` の useInView を踏襲）。
// 🔴 `prefers-reduced-motion` では動かさず、最初から結果を見せる。

import { useEffect, useRef, useState } from 'react'
import type React from 'react'

/** 動きを減らす設定なら、演出は出さずに結果だけ見せる */
export function reduceMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** スクロールして見えたか（一度きり） */
export function useInView<T extends HTMLElement>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    if (seen) return
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return }
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setSeen(true); io.disconnect() }
    }, { threshold: 0.25 })
    io.observe(el)
    return () => io.disconnect()
  }, [seen])
  return [ref, seen]
}

/** 0 →目標値へ駆け上がる。🔵 数字が主役なので、出るときに動かす */
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
