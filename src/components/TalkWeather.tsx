import { useEffect, useRef } from 'react'
import styles from './TalkWeather.module.css'
import type { Wallpaper } from '../utils/talkWeather'

/**
 * トークの壁紙を「いまの天気」で描く（2026-09-13 新設・運用者の採用＝晴れ・くもり・雨）。
 *
 * 🔵 canvas 1枚に全部描く。画像は1枚も持たないので、読み込みも容量も増えない。
 * 🔴 会話の下に敷くだけの飾り。取れない・描けないときは**何も描かない**（単色の壁紙が出る）。
 *
 * 見た目の決めごと（プレビューで運用者と詰めたもの）:
 *   - 晴れ＝上が濃い青→下が淡い水色。**積雲は画面の下半分**（会話は下に溜まるので上に置かない）
 *   - 雲は「平らな底＋大小の膨らみ」を重ねて作る。🔴 ぼかした楕円だと**四角い霧**に見える
 *   - くもり＝厚みの違う雲の層が4枚、別々の速さで流れる
 *   - 雨＝**窓ガラスに付いた水滴**。細かい粒＋ときどき下へ流れる大粒。夜は奥に街明かりがぼける
 */

type Props = {
  wallpaper: Wallpaper
  /** 昼か（晴れの太陽と月を分ける）。 */
  day: boolean
  /** 雨の強さ。粒の数と流れる頻度に効く。 */
  strength: 'weak' | 'normal' | 'heavy'
  /** 暗い配色か。 */
  dark: boolean
}

type Cloud = { img: HTMLCanvasElement, x: number, y: number, w: number, h: number, v: number, a: number }
type Drop = { x: number, y: number, r: number, e: number }
type Runner = Drop & { v: number, tail: number }
type Light = { x: number, y: number, r: number, c: string, a: number }

const STRENGTH: Record<Props['strength'], number> = { weak: 0.6, normal: 1, heavy: 1.7 }

function rnd(a: number, b: number): number {
  return a + Math.random() * (b - a)
}

/**
 * 雲を1枚描いて返す（平らな底＋6〜9個の膨らみ＋上下の陰影）。
 *
 * 🔴 陰影を外すとのっぺりして紙に見える。立体に見えるのは「上が白く底が灰色」だから。
 */
function cloudSprite(w: number, h: number, dark: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(2, Math.round(w))
  c.height = Math.max(2, Math.round(h))
  const g = c.getContext('2d')
  if (!g) return c

  const base = h * 0.84
  const n = 6 + Math.floor(Math.random() * 4)

  g.fillStyle = '#ffffff'
  g.beginPath()
  g.moveTo(w * 0.10, base)
  g.lineTo(w * 0.90, base)
  g.lineTo(w * 0.90, base - h * 0.13)
  g.lineTo(w * 0.10, base - h * 0.13)
  g.closePath()
  g.fill()

  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const bell = Math.sin(Math.PI * t)          // 中央ほど高く大きく
    const r = h * (0.14 + 0.30 * bell * rnd(0.7, 1.25))
    const x = w * (0.12 + 0.76 * t) + rnd(-w * 0.03, w * 0.03)
    const y = base - r * rnd(0.5, 1.0)
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fill()
  }

  g.globalCompositeOperation = 'source-atop'
  const lg = g.createLinearGradient(0, base - h * 0.8, 0, base + h * 0.04)
  if (dark) {
    lg.addColorStop(0, '#4a5a72')
    lg.addColorStop(0.6, '#35435a')
    lg.addColorStop(1, '#232e40')
  } else {
    lg.addColorStop(0, '#ffffff')
    lg.addColorStop(0.55, '#f4f9ff')
    lg.addColorStop(1, '#c2d4e8')
  }
  g.fillStyle = lg
  g.fillRect(0, 0, w, h)
  g.globalCompositeOperation = 'source-over'
  return c
}

export function TalkWeather({ wallpaper, day, strength, dark }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return

    const quiet = window.matchMedia('(prefers-reduced-motion: reduce)')
    const power = STRENGTH[strength]

    let W = 0
    let H = 0
    let clouds: Cloud[] = []
    let drops: Drop[] = []
    let runners: Runner[] = []
    let lights: Light[] = []
    let last = 0
    let raf = 0

    function seed() {
      const cvv = ref.current
      if (!cvv) return
      const r = cvv.getBoundingClientRect()
      if (!r.width || !r.height) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = r.width
      H = r.height
      cvv.width = Math.round(W * dpr)
      cvv.height = Math.round(H * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)

      if (wallpaper === 'rain') {
        lights = []
        for (let i = 0; i < 26; i++) {
          lights.push({
            x: rnd(0, W),
            y: H * (0.5 + Math.random() * 0.48),
            r: rnd(H * 0.018, H * 0.05),
            c: ['255,196,92', '255,224,150', '255,166,70', '208,226,255'][Math.floor(Math.random() * 4)],
            a: rnd(0.18, 0.5),
          })
        }
        drops = []
        const n = Math.round(120 * power)
        for (let j = 0; j < n; j++) {
          // 🔴 粒は**上のほうだけ**。会話は下に溜まるので、そこに置くと読みにくくなる
          drops.push({ x: rnd(0, W), y: rnd(0, H * 0.66), r: rnd(0.8, 2.6), e: rnd(1, 1.5) })
        }
        runners = []
        return
      }

      const plan = wallpaper === 'sunny'
        ? [
            { w: W * 0.92, h: H * 0.20, y: H * 0.46, v: 1.5, a: dark ? 0.5 : 0.98 },
            { w: W * 0.68, h: H * 0.15, y: H * 0.62, v: 1.0, a: dark ? 0.4 : 0.9 },
            { w: W * 1.10, h: H * 0.22, y: H * 0.72, v: 2.1, a: dark ? 0.35 : 0.82 },
            { w: W * 0.54, h: H * 0.12, y: H * 0.88, v: 0.7, a: dark ? 0.3 : 0.6 },
          ]
        : [
            { w: W * 1.30, h: H * 0.42, y: -H * 0.06, v: 1.2, a: dark ? 0.4 : 0.8 },
            { w: W * 1.00, h: H * 0.34, y: H * 0.20, v: 0.8, a: dark ? 0.3 : 0.62 },
            { w: W * 1.50, h: H * 0.46, y: H * 0.44, v: 1.8, a: dark ? 0.26 : 0.5 },
            { w: W * 0.90, h: H * 0.30, y: H * 0.74, v: 0.6, a: dark ? 0.2 : 0.34 },
          ]

      clouds = plan.map((c, i) => ({
        img: cloudSprite(c.w, c.h, dark),
        w: c.w,
        h: c.h,
        y: c.y,
        v: c.v,
        a: c.a,
        x: -c.w + (W + c.w) * ((i * 0.37 + 0.15) % 1),
      }))
    }

    function sky() {
      const g = ctx!.createLinearGradient(0, 0, 0, H)
      if (wallpaper === 'cloudy') {
        if (dark) {
          g.addColorStop(0, '#10161d'); g.addColorStop(0.42, '#1a222b')
          g.addColorStop(0.74, '#232c36'); g.addColorStop(1, '#2a333d')
        } else {
          g.addColorStop(0, '#7e8d9c'); g.addColorStop(0.38, '#97a5b2')
          g.addColorStop(0.7, '#b3bdc7'); g.addColorStop(1, '#c6ced6')
        }
      } else if (dark) {
        g.addColorStop(0, '#050b16'); g.addColorStop(0.45, '#0c1728')
        g.addColorStop(0.8, '#16273c'); g.addColorStop(1, '#1e3350')
      } else {
        g.addColorStop(0, '#2b87dd'); g.addColorStop(0.33, '#5fb0ef')
        g.addColorStop(0.66, '#a5d3f7'); g.addColorStop(1, '#dcf0fd')
      }
      ctx!.fillStyle = g
      ctx!.fillRect(0, 0, W, H)
    }

    /** 晴れのときの太陽（夜は月）。 */
    function orb() {
      const x = W * 0.78
      const y = H * 0.13
      const r = day ? Math.min(W, H) * 0.30 : Math.min(W, H) * 0.075
      const g = ctx!.createRadialGradient(x, y, 0, x, y, r)
      if (day) {
        g.addColorStop(0, 'rgba(255,255,255,1)')
        g.addColorStop(0.2, 'rgba(255,253,242,0.95)')
        g.addColorStop(0.4, 'rgba(255,255,255,0.55)')
        g.addColorStop(0.72, 'rgba(255,255,255,0.12)')
        g.addColorStop(1, 'rgba(255,255,255,0)')
      } else {
        g.addColorStop(0, 'rgba(255,255,255,0.95)')
        g.addColorStop(0.45, 'rgba(228,238,251,0.7)')
        g.addColorStop(1, 'rgba(201,220,242,0)')
      }
      ctx!.fillStyle = g
      ctx!.beginPath()
      ctx!.arc(x, y, r, 0, Math.PI * 2)
      ctx!.fill()
    }

    function drawDrop(x: number, y: number, r: number, e: number) {
      ctx!.save()
      ctx!.translate(x, y)
      ctx!.scale(1, e)
      const g = ctx!.createRadialGradient(-r * 0.34, -r * 0.4, r * 0.08, 0, 0, r)
      g.addColorStop(0, dark ? 'rgba(255,255,255,0.46)' : 'rgba(255,255,255,0.72)')
      g.addColorStop(0.42, dark ? 'rgba(186,208,228,0.13)' : 'rgba(255,255,255,0.2)')
      g.addColorStop(1, 'rgba(255,255,255,0.03)')
      ctx!.fillStyle = g
      ctx!.beginPath()
      ctx!.arc(0, 0, r, 0, Math.PI * 2)
      ctx!.fill()
      ctx!.strokeStyle = dark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.42)'
      ctx!.lineWidth = Math.max(0.4, r * 0.16)
      ctx!.beginPath()
      ctx!.arc(0, 0, r * 0.9, 0.75, 2.45)
      ctx!.stroke()
      ctx!.restore()
    }

    function rain(dt: number, moving: boolean) {
      const g = ctx!.createLinearGradient(0, 0, 0, H)
      if (dark) {
        g.addColorStop(0, '#141c24'); g.addColorStop(0.55, '#16202b'); g.addColorStop(1, '#1d2730')
      } else {
        g.addColorStop(0, '#7f95a8'); g.addColorStop(0.6, '#8a9dae'); g.addColorStop(1, '#94a5b3')
      }
      ctx!.fillStyle = g
      ctx!.fillRect(0, 0, W, H)

      for (const b of lights) {
        const a = dark ? b.a : b.a * 0.22
        const rg = ctx!.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r)
        rg.addColorStop(0, `rgba(${b.c},${a})`)
        rg.addColorStop(0.6, `rgba(${b.c},${a * 0.45})`)
        rg.addColorStop(1, `rgba(${b.c},0)`)
        ctx!.fillStyle = rg
        ctx!.beginPath()
        ctx!.arc(b.x, b.y, b.r, 0, Math.PI * 2)
        ctx!.fill()
      }

      if (moving && Math.random() < dt * 2.2 * power) {
        runners.push({ x: rnd(W * 0.06, W * 0.94), y: rnd(-10, H * 0.2), r: rnd(2.8, 5.2), e: 1.35, v: rnd(26, 70), tail: 0 })
      }

      for (let i = runners.length - 1; i >= 0; i--) {
        const d = runners[i]
        if (moving) {
          d.y += d.v * dt
          d.v += 34 * dt
          d.tail += d.v * dt
          if (Math.random() < dt * 12) {
            drops.push({ x: d.x + rnd(-1.4, 1.4), y: d.y - rnd(2, 10), r: rnd(0.7, 1.7), e: 1.1 })
            if (drops.length > 260) drops.shift()
          }
        }
        const len = Math.min(d.tail, H * 0.34)
        if (len > 4) {
          const lg = ctx!.createLinearGradient(d.x, d.y - len, d.x, d.y)
          lg.addColorStop(0, 'rgba(255,255,255,0)')
          lg.addColorStop(1, dark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.34)')
          ctx!.strokeStyle = lg
          ctx!.lineWidth = d.r * 0.72
          ctx!.lineCap = 'round'
          ctx!.beginPath()
          ctx!.moveTo(d.x, d.y - len)
          ctx!.lineTo(d.x, d.y)
          ctx!.stroke()
        }
        drawDrop(d.x, d.y, d.r, d.e)
        if (d.y > H + 12) runners.splice(i, 1)
      }

      for (const p of drops) drawDrop(p.x, p.y, p.r, p.e)
    }

    function frame(t: number) {
      raf = requestAnimationFrame(frame)
      const dt = Math.min((t - last) / 1000, 0.05)
      last = t
      if (!W) { seed(); return }
      // 🔵 裏に回っている間は描かない（電池のため）
      if (document.hidden) return

      const moving = !quiet.matches
      if (wallpaper === 'rain') { rain(dt, moving); return }

      sky()
      if (wallpaper === 'sunny') orb()
      for (const c of clouds) {
        if (moving) {
          c.x += c.v * dt
          if (c.x > W + 4) c.x = -c.w - 4
        }
        ctx!.globalAlpha = c.a
        ctx!.drawImage(c.img, c.x, c.y, c.w, c.h)
      }
      ctx!.globalAlpha = 1
    }

    seed()
    raf = requestAnimationFrame(t => { last = t; frame(t) })

    const onResize = () => seed()
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [wallpaper, day, strength, dark])

  return (
    <div className={styles.layer} aria-hidden="true">
      <canvas ref={ref} />
    </div>
  )
}
