import { useEffect, useRef, useState } from 'react'
import { fitCanvas, pointerPos, rand } from '../../lib/canvas'
import { sfx } from '../../lib/sfx'
import { Icon } from '../Icons'

type Bubble = {
  x: number
  y: number
  r: number
  vy: number
  sway: number
  phase: number
  hue: number
  spin: number
}

type Shard = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  size: number
  color: string
}

const HUES = [188, 205, 262, 278, 32]

export function Bubbles() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [score, setScore] = useState(0)
  const [hint, setHint] = useState('按住拖动，或者一颗一颗点掉')
  const scoreRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const init = fitCanvas(canvas)
    let ctx = init.ctx as CanvasRenderingContext2D
    let w = init.w
    let h = init.h

    let bubbles: Bubble[] = []
    let shards: Shard[] = []
    let raf = 0
    let last = performance.now()
    let t = 0
    let pressed = false

    const spawn = (fromBottom = true): Bubble => {
      const r = rand(16, 40)
      return {
        x: rand(r + 8, w - r - 8),
        y: fromBottom ? h + rand(10, h * 0.7) : rand(-h * 0.4, h),
        r,
        vy: rand(14, 40) * (r / 30),
        sway: rand(6, 22),
        phase: rand(0, Math.PI * 2),
        hue: HUES[Math.floor(Math.random() * HUES.length)],
        spin: rand(-0.4, 0.4),
      }
    }

    const fill = () => {
      while (bubbles.length < 16) {
        const b = spawn(false)
        bubbles.push({ ...b, y: rand(h * 0.08, h * 0.92) })
      }
    }
    fill()

    const burst = (x: number, y: number, force = 1) => {
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i]
        const dx = x - b.x
        const dy = y - b.y
        if (dx * dx + dy * dy < (b.r + 10) * (b.r + 10)) {
          bubbles.splice(i, 1)
          for (let k = 0; k < 16; k++) {
            const a = rand(0, Math.PI * 2)
            const sp = rand(40, 210) * force
            shards.push({
              x: b.x + Math.cos(a) * b.r * 0.6,
              y: b.y + Math.sin(a) * b.r * 0.6,
              vx: Math.cos(a) * sp,
              vy: Math.sin(a) * sp - 40,
              life: rand(0.35, 0.8),
              size: rand(1.4, 4),
              color: `hsla(${b.hue},78%,${rand(62, 84)}%,`,
            })
          }
          bubbles.push(spawn())
          scoreRef.current += 1
          setScore(scoreRef.current)
          sfx.pop(scoreRef.current % 8)
          if (scoreRef.current === 12) setHint('手感不错，再爆几颗')
          if (scoreRef.current === 30) setHint('差不多够松了，随时可以停')
          return
        }
      }
    }

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.045)
      last = now
      t += dt
      ctx.clearRect(0, 0, w, h)

      // 水面光带
      const wave = ctx.createLinearGradient(0, h * 0.2, 0, h)
      wave.addColorStop(0, 'rgba(255,255,255,0)')
      wave.addColorStop(1, 'rgba(214,240,247,0.45)')
      ctx.fillStyle = wave
      ctx.fillRect(0, 0, w, h)

      for (const b of bubbles) {
        b.y -= b.vy * dt
        b.phase += dt * 0.9
        b.spin += dt * 0.4
        if (b.y + b.r < -30) {
          Object.assign(b, spawn(true), { y: h + b.r * 2 })
        }

        const x = b.x + Math.sin(b.phase) * b.sway
        const wob = 1 + Math.sin(b.phase * 1.6) * 0.045
        const rx = b.r * wob
        const ry = b.r / wob

        const g = ctx.createRadialGradient(x - rx * 0.32, b.y - ry * 0.34, rx * 0.08, x, b.y, rx)
        g.addColorStop(0, 'rgba(255,255,255,0.95)')
        g.addColorStop(0.32, `hsla(${b.hue},72%,82%,0.5)`)
        g.addColorStop(0.78, `hsla(${b.hue},68%,74%,0.16)`)
        g.addColorStop(1, `hsla(${b.hue},72%,88%,0.02)`)
        ctx.beginPath()
        ctx.ellipse(x, b.y, rx, ry, 0, 0, Math.PI * 2)
        ctx.fillStyle = g
        ctx.fill()
        ctx.strokeStyle = `hsla(${b.hue},70%,90%,0.75)`
        ctx.lineWidth = 1.1
        ctx.stroke()

        // 高光
        ctx.beginPath()
        ctx.ellipse(x - rx * 0.34, b.y - ry * 0.36, rx * 0.17, ry * 0.12, -0.5, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.fill()

        // 底部薄光
        ctx.beginPath()
        ctx.ellipse(x + rx * 0.2, b.y + ry * 0.55, rx * 0.4, ry * 0.14, 0.3, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${b.hue},80%,95%,0.35)`
        ctx.fill()
      }

      for (let i = shards.length - 1; i >= 0; i--) {
        const s = shards[i]
        s.life -= dt
        if (s.life <= 0) {
          shards.splice(i, 1)
          continue
        }
        s.vy += 320 * dt
        s.vx *= 0.985
        s.x += s.vx * dt
        s.y += s.vy * dt
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
        ctx.fillStyle = `${s.color}${Math.min(1, s.life * 1.6)})`
        ctx.fill()
      }

      if (pressed) {
        ctx.beginPath()
        ctx.arc(lastX, lastY, 22, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'
        ctx.lineWidth = 2
        ctx.stroke()
      }

      raf = requestAnimationFrame(loop)
    }

    let lastX = -100
    let lastY = -100
    let isDown = false

    const down = (e: PointerEvent) => {
      isDown = true
      pressed = true
      const p = pointerPos(canvas, e)
      lastX = p.x
      lastY = p.y
      burst(p.x, p.y)
    }
    const move = (e: PointerEvent) => {
      const p = pointerPos(canvas, e)
      lastX = p.x
      lastY = p.y
      if (isDown) burst(p.x, p.y, 0.9)
    }
    const up = () => {
      isDown = false
      pressed = false
    }
    const leave = () => {
      isDown = false
      pressed = false
    }

    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    canvas.addEventListener('pointerleave', leave)

    const ro = new ResizeObserver(() => {
      const next = fitCanvas(canvas)
      ctx = next.ctx as CanvasRenderingContext2D
      w = next.w
      h = next.h
      bubbles = []
      fill()
    })
    ro.observe(canvas)

    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerleave', leave)
      window.removeEventListener('pointerup', up)
    }
  }, [])

  return (
    <div className="relative">
      <div className="relative h-[300px] overflow-hidden rounded-4xl bg-gradient-to-b from-[#eff9fb] via-[#e2f3f8] to-[#cfe9f1] sm:h-[380px]">
        <canvas ref={canvasRef} className="game-canvas h-full w-full" aria-label="潮汐泡泡：点击爆破漂浮的泡泡" />
        <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2">
          <span className="sticker">
            <Icon name="sparkles" size={12} />
            已爆破 <span className="tnum font-semibold text-ink-900">{score}</span>
          </span>
        </div>
        <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-center text-[11.5px] text-sea-600/80">
          {hint}
        </p>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-[11.5px] leading-relaxed text-ink-400">
          泡泡没有目标数。爆够了就停，这也是一种练习。
        </p>
        <button
          onClick={() => {
            setScore(0)
            scoreRef.current = 0
            setHint('按住拖动，或者一颗一颗点掉')
          }}
          className="btn-quiet text-[11.5px]"
        >
          <Icon name="refresh" size={13} />
          重新开始
        </button>
      </div>
    </div>
  )
}
