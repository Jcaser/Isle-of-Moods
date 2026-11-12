import { useEffect, useRef } from 'react'

/**
 * 海萤粒子场
 * - 缓慢上浮 + 正弦横摆，像夜里贴着海面飞的小光点
 * - 指针靠近时被轻轻推开并变亮，制造"你在影响这片海"的手感
 * - 点击 / 触摸生成一圈涟漪
 * - 全部在 Canvas 上绘制，使用预渲染 sprite，避免 shadowBlur 掉帧
 */

type Mote = {
  x: number
  y: number
  vy: number
  sway: number
  swayPhase: number
  size: number
  alpha: number
  sprite: number
}

type Ripple = { x: number; y: number; r: number; life: number; color: string }

const TINTS: [number, number, number][] = [
  [148, 205, 217],
  [196, 185, 236],
  [250, 226, 186],
  [176, 224, 214],
]

function makeSprite([r, g, b]: [number, number, number]) {
  const size = 64
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')
  if (!ctx) return c
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, `rgba(${r},${g},${b},1)`)
  grad.addColorStop(0.22, `rgba(${r},${g},${b},0.72)`)
  grad.addColorStop(0.55, `rgba(${r},${g},${b},0.18)`)
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  return c
}

export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const sprites = TINTS.map(makeSprite)

    let w = 0
    let h = 0
    let dpr = 1
    let motes: Mote[] = []
    const ripples: Ripple[] = []
    const pointer = { x: -999, y: -999, active: false }

    const build = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const density = w < 640 ? 16000 : 12000
      const count = Math.min(96, Math.max(24, Math.round((w * h) / density)))
      motes = Array.from({ length: count }, () => spawn())
    }

    const spawn = (fromBottom = true): Mote => ({
      x: Math.random() * w,
      y: fromBottom ? h + Math.random() * h * 0.35 : Math.random() * h,
      vy: 5 + Math.random() * 16,
      sway: 8 + Math.random() * 22,
      swayPhase: Math.random() * Math.PI * 2,
      size: 5 + Math.random() * 13,
      alpha: 0.22 + Math.random() * 0.5,
      sprite: Math.floor(Math.random() * TINTS.length),
    })

    let raf = 0
    let last = performance.now()
    let t = 0

    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      t += dt

      ctx.clearRect(0, 0, w, h)

      for (const m of motes) {
        if (!reduced) {
          m.y -= m.vy * dt
          m.swayPhase += dt * 0.7
        }
        const ox = Math.sin(m.swayPhase) * m.sway
        const px = m.x + ox

        // 指针交互：推开 + 提亮
        let boost = 0
        if (pointer.active) {
          const dx = px - pointer.x
          const dy = m.y - pointer.y
          const d2 = dx * dx + dy * dy
          const R = 170
          if (d2 < R * R) {
            const d = Math.sqrt(d2) || 1
            const force = (1 - d / R) * 42
            m.x += (dx / d) * force * dt
            m.y += (dy / d) * force * dt
            boost = (1 - d / R) * 0.65
          }
        }

        if (m.y < -40) {
          Object.assign(m, spawn(false), { y: h + 30, x: Math.random() * w })
        }
        if (m.x < -60) m.x = w + 40
        if (m.x > w + 60) m.x = -40

        const s = m.size
        const a = Math.min(1, m.alpha + boost + Math.sin(t * 1.4 + m.swayPhase) * 0.06)
        ctx.globalAlpha = Math.max(0, a)
        ctx.drawImage(sprites[m.sprite], px - s / 2, m.y - s / 2, s, s)
      }

      // 涟漪
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i]
        r.life -= dt
        r.r += dt * 210
        if (r.life <= 0) {
          ripples.splice(i, 1)
          continue
        }
        const p = r.life / 1.1
        ctx.globalAlpha = Math.max(0, p) * 0.42
        ctx.strokeStyle = `rgba(${r.color},1)`
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2)
        ctx.stroke()

        ctx.globalAlpha = Math.max(0, p) * 0.16
        ctx.beginPath()
        ctx.arc(r.x, r.y, r.r * 0.72, 0, Math.PI * 2)
        ctx.stroke()
      }

      ctx.globalAlpha = 1
      raf = requestAnimationFrame(draw)
    }

    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX
      pointer.y = e.clientY
      pointer.active = true
    }
    const onLeave = () => {
      pointer.active = false
      pointer.x = -999
      pointer.y = -999
    }
    const onDown = (e: PointerEvent) => {
      if (ripples.length > 5) ripples.shift()
      ripples.push({
        x: e.clientX,
        y: e.clientY,
        r: 6,
        life: 1.1,
        color: Math.random() > 0.55 ? '148,205,217' : '196,185,236',
      })
    }
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf)
      } else if (!reduced) {
        last = performance.now()
        raf = requestAnimationFrame(draw)
      }
    }

    build()
    if (reduced) {
      draw(performance.now())
      cancelAnimationFrame(raf)
    } else {
      raf = requestAnimationFrame(draw)
    }

    window.addEventListener('resize', build)
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointerleave', onLeave)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', build)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  )
}
