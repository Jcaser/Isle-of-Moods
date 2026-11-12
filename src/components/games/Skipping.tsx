import { useEffect, useRef, useState } from 'react'
import { fitCanvas, pointerPos, rand } from '../../lib/canvas'
import { sfx } from '../../lib/sfx'
import { Icon } from '../Icons'

type Ripple = { x: number; y: number; r: number; life: number }
type Drop = { x: number; y: number; vx: number; vy: number; life: number }

/** 打水漂：按住蓄力，松手让石头贴着水面弹几下 */
export function Skipping() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [skips, setSkips] = useState(0)
  const [best, setBest] = useState(0)
  const [hint, setHint] = useState('按住蓄力，松手扔出去')
  const [charging, setCharging] = useState(false)
  const [powerUi, setPowerUi] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const init = fitCanvas(canvas)
    let ctx = init.ctx as CanvasRenderingContext2D
    let w = init.w
    let h = init.h

    let waterY = h * 0.68
    let stone = { x: 78, y: waterY - 26, vx: 0, vy: 0, rot: 0, flying: false, sinking: false }
    let ripples: Ripple[] = []
    let drops: Drop[] = []
    let power = 0
    let powerDir = 1
    let holding = false
    let skipsLocal = 0
    let sinkTimer = 0
    let t = 0
    let raf = 0
    let last = performance.now()
    let scale = 1

    const resetStone = () => {
      stone = { x: 78, y: waterY - 26, vx: 0, vy: 0, rot: 0, flying: false, sinking: false }
      skipsLocal = 0
      setSkips(0)
      setHint('按住蓄力，松手扔出去')
    }

    const launch = () => {
      const p = Math.max(0.12, power)
      stone.vx = (4.2 + p * 7.4) * scale
      stone.vy = -(1.4 + p * 3.6) * scale
      stone.flying = true
      stone.sinking = false
      skipsLocal = 0
      setSkips(0)
      sfx.whoosh()
      setHint('让它贴着水面飞…')
    }

    const drawScene = () => {
      // 天空
      const sky = ctx.createLinearGradient(0, 0, 0, waterY)
      sky.addColorStop(0, '#ecf8fb')
      sky.addColorStop(0.5, '#ddeff5')
      sky.addColorStop(1, '#cde7f0')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, w, waterY)

      // 远山
      ctx.beginPath()
      ctx.moveTo(0, waterY)
      ctx.quadraticCurveTo(w * 0.16, waterY - 46, w * 0.34, waterY - 8)
      ctx.quadraticCurveTo(w * 0.46, waterY - 40, w * 0.58, waterY - 10)
      ctx.lineTo(w * 0.58, waterY)
      ctx.closePath()
      ctx.fillStyle = 'rgba(164,198,208,0.55)'
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(w * 0.52, waterY)
      ctx.quadraticCurveTo(w * 0.7, waterY - 58, w * 0.86, waterY - 6)
      ctx.lineTo(w, waterY)
      ctx.closePath()
      ctx.fillStyle = 'rgba(150,188,200,0.45)'
      ctx.fill()

      // 水面
      const sea = ctx.createLinearGradient(0, waterY, 0, h)
      sea.addColorStop(0, '#b6dce7')
      sea.addColorStop(0.45, '#99cddd')
      sea.addColorStop(1, '#7fbacc')
      ctx.fillStyle = sea
      ctx.fillRect(0, waterY, w, h - waterY)

      // 水纹
      for (let i = 0; i < 9; i++) {
        const y = waterY + 8 + i * ((h - waterY) / 9)
        ctx.beginPath()
        ctx.moveTo(0, y)
        for (let x = 0; x <= w; x += 40) {
          ctx.quadraticCurveTo(x + 20, y + Math.sin((x + t * 60 + i * 30) / 90) * 2.4, x + 40, y)
        }
        ctx.strokeStyle = `rgba(255,255,255,${0.36 - i * 0.026})`
        ctx.lineWidth = 1.4
        ctx.stroke()
      }

      // 太阳倒影
      const gl = ctx.createLinearGradient(w * 0.15, waterY, w * 0.15, h)
      gl.addColorStop(0, 'rgba(255,248,214,0.5)')
      gl.addColorStop(1, 'rgba(255,248,214,0)')
      ctx.fillStyle = gl
      ctx.fillRect(w * 0.05, waterY, w * 0.2, h - waterY)
    }

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.04)
      last = now
      t += dt

      if (holding) {
        power += powerDir * dt * 1.35
        if (power >= 1) {
          power = 1
          powerDir = -1
        }
        if (power <= 0.08) {
          power = 0.08
          powerDir = 1
        }
        setPowerUi(power)
      }

      drawScene()

      // 涟漪
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i]
        r.life -= dt
        r.r += dt * 130
        if (r.life <= 0) {
          ripples.splice(i, 1)
          continue
        }
        const a = Math.max(0, r.life / 1.4)
        ctx.beginPath()
        ctx.ellipse(r.x, r.y, r.r, r.r * 0.3, 0, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255,255,255,${a * 0.75})`
        ctx.lineWidth = 1.6
        ctx.stroke()
        ctx.beginPath()
        ctx.ellipse(r.x, r.y, r.r * 0.66, r.r * 0.2, 0, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255,255,255,${a * 0.4})`
        ctx.lineWidth = 1.1
        ctx.stroke()
      }

      // 水花
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]
        d.life -= dt
        if (d.life <= 0) {
          drops.splice(i, 1)
          continue
        }
        d.vy += 420 * dt
        d.x += d.vx * dt
        d.y += d.vy * dt
        ctx.beginPath()
        ctx.arc(d.x, d.y, 1.9, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${Math.min(1, d.life * 2)})`
        ctx.fill()
      }

      // 石头物理
      if (stone.flying) {
        stone.vy += 620 * dt
        stone.x += stone.vx * dt
        stone.y += stone.vy * dt
        stone.rot += dt * 9

        if (stone.y > waterY && stone.vy > 0 && !stone.sinking) {
          stone.y = waterY
          const speed = Math.hypot(stone.vx, stone.vy) / scale
          if (speed > 1.6 && skipsLocal < 12) {
            stone.vy = -Math.abs(stone.vy) * 0.56
            stone.vx *= 0.87
            stone.y = waterY - 2
            skipsLocal += 1
            setSkips(skipsLocal)
            ripples.push({ x: stone.x, y: waterY, r: 6, life: 1.4 })
            for (let i = 0; i < 10; i++) {
              drops.push({ x: stone.x, y: waterY - 2, vx: rand(-70, 70), vy: rand(-150, -40), life: rand(0.3, 0.7) })
            }
            sfx.splash()
            if (skipsLocal >= 5) setHint('漂亮，这一下弹得很远')
          } else {
            stone.sinking = true
            sinkTimer = 0
            ripples.push({ x: stone.x, y: waterY, r: 10, life: 1.6 })
            if (skipsLocal > 0) {
              sfx.plink()
              setBest((b) => (skipsLocal > b ? skipsLocal : b))
              setHint(skipsLocal >= 5 ? `${skipsLocal} 下，已经很厉害了` : '再来一次，力道再稳一点')
            } else {
              setHint('石头沉了，下次蓄力久一点')
            }
          }
        }

        if (stone.sinking) {
          sinkTimer += dt
          stone.y += 26 * dt
          if (sinkTimer > 1.1) resetStone()
        }

        if (stone.x > w + 40) resetStone()
      }

      // 石头
      const hover = !stone.flying ? Math.sin(t * 2) * 2 : 0
      ctx.save()
      ctx.translate(stone.x, stone.y + hover)
      ctx.rotate(stone.rot)
      ctx.beginPath()
      ctx.ellipse(0, 0, 13, 5.6, 0, 0, Math.PI * 2)
      ctx.fillStyle = stone.sinking ? 'rgba(150,168,176,0.75)' : '#9aa7ae'
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(-2, -1.4, 7, 2, 0.3, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.fill()
      ctx.restore()

      // 蓄力提示环
      if (holding) {
        ctx.beginPath()
        ctx.arc(stone.x, stone.y + hover, 26 + power * 14, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(74,151,170,${0.25 + power * 0.4})`
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // 轨迹预测
      if (holding) {
        ctx.beginPath()
        let px = stone.x
        let py = stone.y
        let vx = (4.2 + power * 7.4) * scale
        let vy = -(1.4 + power * 3.6) * scale
        ctx.moveTo(px, py)
        for (let i = 0; i < 26; i++) {
          vy += 620 * 0.035
          px += vx * 0.035
          py += vy * 0.035
          if (py > waterY) break
          ctx.lineTo(px, py)
        }
        ctx.strokeStyle = 'rgba(74,151,170,0.28)'
        ctx.lineWidth = 1.6
        ctx.setLineDash([3, 5])
        ctx.stroke()
        ctx.setLineDash([])
      }

      raf = requestAnimationFrame(loop)
    }

    const down = (e: PointerEvent) => {
      if (stone.flying) return
      holding = true
      setCharging(true)
      power = 0.08
      powerDir = 1
      canvas.setPointerCapture?.(e.pointerId)
    }
    const up = () => {
      if (!holding) return
      holding = false
      setCharging(false)
      launch()
    }

    canvas.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)

    const ro = new ResizeObserver(() => {
      const next = fitCanvas(canvas)
      ctx = next.ctx as CanvasRenderingContext2D
      w = next.w
      h = next.h
      waterY = h * 0.68
      scale = Math.max(0.7, Math.min(1.4, w / 700))
      resetStone()
    })
    ro.observe(canvas)
    scale = Math.max(0.7, Math.min(1.4, w / 700))

    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
    }
  }, [])

  return (
    <div>
      <div className="relative h-[300px] overflow-hidden rounded-4xl bg-[#e4f4f8] sm:h-[380px]">
        <canvas ref={canvasRef} className="game-canvas h-full w-full" aria-label="打水漂：按住蓄力，松手扔出石头" />

        <div className="pointer-events-none absolute right-4 top-4 flex flex-col items-end gap-1.5">
          <span className="sticker">
            这一投 <span className="tnum font-semibold text-ink-900">{skips}</span> 下
          </span>
          <span className="sticker">
            纪录 <span className="tnum font-semibold text-ink-900">{best}</span> 下
          </span>
        </div>

        {/* 力度条 */}
        <div className="pointer-events-none absolute bottom-4 left-4 flex items-end gap-2">
          <div className="flex h-24 w-2.5 flex-col justify-end overflow-hidden rounded-full bg-white/60">
            <div
              className="w-full rounded-full bg-gradient-to-t from-sea-400 to-lav-300 transition-[height] duration-75"
              style={{ height: `${(charging ? powerUi : 0) * 100}%` }}
            />
          </div>
          <p className="mb-1 text-[10px] tracking-[0.14em] text-ink-500">POWER</p>
        </div>

        <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-center text-[11.5px] text-sea-700/80">
          {hint}
        </p>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-[11.5px] leading-relaxed text-ink-400">
          蓄力条来回摆动，在中间偏上松手最容易弹出好成绩。
        </p>
        <span className="chip">
          <Icon name="wave" size={12} />
          最多 12 下
        </span>
      </div>
    </div>
  )
}
