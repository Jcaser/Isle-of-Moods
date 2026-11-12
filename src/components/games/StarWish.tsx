import { useEffect, useRef, useState } from 'react'
import { fitCanvas, pointerPos, rand } from '../../lib/canvas'
import { sfx } from '../../lib/sfx'
import { Icon } from '../Icons'

type Star = { x: number; y: number; r: number; phase: number; speed: number }
type Wish = { id: string; x: number; y: number; text: string; rise: number; phase: number }
type Meteor = { x: number; y: number; vx: number; vy: number; life: number }

const KEY = 'sereneisle.v1.wishes'

/** 星光许愿：点一处夜空，把一句话交给它 */
export function StarWish() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null)
  const [count, setCount] = useState(0)
  const pendingRef = useRef<{ x: number; y: number } | null>(null)
  const sizeRef = useRef({ w: 1, h: 1 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const init = fitCanvas(canvas)
    let ctx = init.ctx as CanvasRenderingContext2D
    let w = init.w
    let h = init.h
    sizeRef.current = { w, h }

    const bg: Star[] = Array.from({ length: 150 }, () => ({
      x: Math.random(),
      y: rand(0, 0.92),
      r: rand(0.5, 1.7),
      phase: rand(0, Math.PI * 2),
      speed: rand(0.6, 2),
    }))

    const wishes: Wish[] = []
    let meteors: Meteor[] = []
    let t = 0
    let raf = 0
    let last = performance.now()
    let meteorTimer = 2.4

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.045)
      last = now
      t += dt

      // 夜空
      const sky = ctx.createLinearGradient(0, 0, w * 0.4, h)
      sky.addColorStop(0, '#1a2340')
      sky.addColorStop(0.55, '#232c4e')
      sky.addColorStop(1, '#323759')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, w, h)

      // 银河
      const milky = ctx.createRadialGradient(w * 0.72, h * 0.18, 10, w * 0.72, h * 0.18, w * 0.6)
      milky.addColorStop(0, 'rgba(160,180,240,0.16)')
      milky.addColorStop(1, 'rgba(160,180,240,0)')
      ctx.fillStyle = milky
      ctx.fillRect(0, 0, w, h)

      // 背景星
      for (const s of bg) {
        const a = 0.32 + Math.sin(t * s.speed + s.phase) * 0.3
        ctx.beginPath()
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0.05, a)})`
        ctx.fill()
      }

      // 流星
      meteorTimer -= dt
      if (meteorTimer < 0) {
        meteorTimer = rand(4, 9)
        meteors.push({ x: rand(w * 0.3, w), y: rand(-20, h * 0.3), vx: -rand(220, 380), vy: rand(120, 210), life: 1 })
      }
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i]
        m.life -= dt * 0.9
        m.x += m.vx * dt
        m.y += m.vy * dt
        if (m.life <= 0) {
          meteors.splice(i, 1)
          continue
        }
        const g = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 0.14, m.y - m.vy * 0.14)
        g.addColorStop(0, `rgba(255,255,255,${m.life})`)
        g.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.strokeStyle = g
        ctx.lineWidth = 1.8
        ctx.beginPath()
        ctx.moveTo(m.x, m.y)
        ctx.lineTo(m.x - m.vx * 0.14, m.y - m.vy * 0.14)
        ctx.stroke()
      }

      // 许愿星
      for (const wish of wishes) {
        if (wish.rise < 1) wish.rise = Math.min(1, wish.rise + dt * 0.75)
        const p = wish.rise
        const ease = 1 - (1 - p) ** 3
        const y = h * 0.92 + (wish.y - h * 0.92) * ease
        const x = wish.x
        const tw = 0.75 + Math.sin(t * 2 + wish.phase) * 0.25

        // 拖尾
        if (p < 1) {
          const grad = ctx.createLinearGradient(x, y + 40 * (1 - p), x, y)
          grad.addColorStop(0, 'rgba(255,236,170,0)')
          grad.addColorStop(1, 'rgba(255,236,170,0.5)')
          ctx.strokeStyle = grad
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(x, y + 40 * (1 - p))
          ctx.lineTo(x, y)
          ctx.stroke()
        }

        const halo = ctx.createRadialGradient(x, y, 0, x, y, 26)
        halo.addColorStop(0, `rgba(255,242,190,${0.55 * tw})`)
        halo.addColorStop(0.35, `rgba(255,224,150,${0.18 * tw})`)
        halo.addColorStop(1, 'rgba(255,224,150,0)')
        ctx.fillStyle = halo
        ctx.beginPath()
        ctx.arc(x, y, 26, 0, Math.PI * 2)
        ctx.fill()

        ctx.save()
        ctx.translate(x, y)
        ctx.scale(tw, tw)
        ctx.beginPath()
        for (let i = 0; i < 8; i++) {
          const ang = (Math.PI / 4) * i - Math.PI / 2
          const rad = i % 2 === 0 ? 7.6 : 2.6
          const px = Math.cos(ang) * rad
          const py = Math.sin(ang) * rad
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.closePath()
        ctx.fillStyle = '#fff4cc'
        ctx.fill()
        ctx.restore()

        ctx.font = '400 11.5px "PingFang SC", system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillStyle = `rgba(255,248,224,${0.55 * p})`
        ctx.fillText(wish.text.slice(0, 22), x, y + 22)
      }

      // 当前待写位置
      if (pendingRef.current) {
        const { x, y } = pendingRef.current
        const pulse = 0.5 + Math.sin(t * 3) * 0.3
        ctx.beginPath()
        ctx.arc(x, y, 12 + pulse * 6, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255,236,170,${pulse})`
        ctx.lineWidth = 1.2
        ctx.setLineDash([3, 4])
        ctx.stroke()
        ctx.setLineDash([])
      }

      raf = requestAnimationFrame(loop)
    }

    const onDown = (e: PointerEvent) => {
      const p = pointerPos(canvas, e)
      if (p.y > h * 0.86) return
      pendingRef.current = p
      setPending(p)
      window.setTimeout(() => inputRef.current?.focus(), 40)
      sfx.plink()
    }

    canvas.addEventListener('pointerdown', onDown)
    raf = requestAnimationFrame(loop)

    const ro = new ResizeObserver(() => {
      const next = fitCanvas(canvas)
      ctx = next.ctx as CanvasRenderingContext2D
      w = next.w
      h = next.h
      sizeRef.current = { w, h }
    })
    ro.observe(canvas)

    // 把提交函数挂到实例上，供 React 层调用
    ;(canvas as HTMLCanvasElement & { __pushWish?: (text: string) => void }).__pushWish = (text: string) => {
      const p = pendingRef.current ?? { x: w / 2, y: h * 0.4 }
      wishes.push({ id: Math.random().toString(36).slice(2), x: p.x, y: p.y, text, rise: 0, phase: rand(0, 6) })
      pendingRef.current = null
      setPending(null)
      setCount((c) => c + 1)
      sfx.chime()
    }

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
    }
  }, [])

  const submit = () => {
    const text = draft.trim()
    if (!text) return
    const canvas = canvasRef.current as (HTMLCanvasElement & { __pushWish?: (t: string) => void }) | null
    canvas?.__pushWish?.(text)
    try {
      const raw = localStorage.getItem(KEY)
      const list = raw ? (JSON.parse(raw) as { text: string; ts: number }[]) : []
      localStorage.setItem(KEY, JSON.stringify([{ text, ts: Date.now() }, ...list].slice(0, 50)))
    } catch {
      /* 忽略 */
    }
    setDraft('')
  }

  return (
    <div>
      <div className="relative h-[300px] overflow-hidden rounded-4xl bg-[#1a2340] sm:h-[380px]">
        <canvas ref={canvasRef} className="game-canvas h-full w-full" aria-label="星光许愿：点击夜空写下想放下的话" />

        <div className="pointer-events-none absolute left-4 top-4">
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10.5px] tracking-[0.12em] text-white/75 backdrop-blur">
            {pending ? '就在这盏位置，写一句' : '点一下夜空，选一颗星'}
          </span>
        </div>

        <div className="absolute inset-x-3 bottom-3">
          <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-2 backdrop-blur">
            <Icon name="feather" size={14} className="shrink-0 text-white/60" />
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
              }}
              maxLength={22}
              placeholder={pending ? '写一句想放下的话…' : '先在画布上点一处位置'}
              className="min-w-0 flex-1 bg-transparent text-[13px] text-white/90 outline-none placeholder:text-white/35"
              aria-label="写下你的愿望"
            />
            <button
              onClick={submit}
              disabled={!draft.trim() || !pending}
              className="shrink-0 rounded-full bg-white/85 px-3 py-1 text-[11.5px] font-medium text-ink-900 transition disabled:opacity-40"
            >
              放飞
            </button>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-[11.5px] leading-relaxed text-ink-400">
          写下的字只留在你自己这台设备里，关掉页面它也不会被谁看到。
        </p>
        <span className="chip">
          <Icon name="sparkles" size={12} />
          已点亮 {count || 0} 颗
        </span>
      </div>
    </div>
  )
}
