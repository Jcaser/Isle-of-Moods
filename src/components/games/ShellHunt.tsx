import { useCallback, useEffect, useRef, useState } from 'react'
import { fitCanvas, pointerPos, rand } from '../../lib/canvas'
import { sfx } from '../../lib/sfx'
import { Icon } from '../Icons'

const NOTES = [
  '此刻，不用做任何事。',
  '你已经比昨天多撑了一天。',
  '把贝壳留下，把担心放回海里。',
  '慢一点，也算在往前走。',
]

type Shell = { x: number; y: number; size: number; rot: number; tone: string; kind: 'shell' | 'star' }

const TONES = ['#f08e75', '#f6c98f', '#c3a2e8', '#f2c85c', '#e79a7f']

function makeShells(): Shell[] {
  return Array.from({ length: 7 }, (_, i) => ({
    x: rand(8, 88),
    y: rand(16, 80),
    size: rand(20, 30),
    rot: rand(-40, 40),
    tone: TONES[Math.floor(rand(0, TONES.length))],
    kind: i % 3 === 2 ? 'star' : 'shell',
  }))
}

/** 在沙滩上刮开沙子，找回藏在下面的东西 */
export function ShellHunt() {
  const sandRef = useRef<HTMLCanvasElement | null>(null)
  const [progress, setProgress] = useState(0)
  const [, setFound] = useState(0)
  const [done, setDone] = useState(false)
  const [note, setNote] = useState(NOTES[0])
  const [shells, setShells] = useState<Shell[]>(makeShells)
  const drawing = useRef(false)
  const last = useRef({ x: 0, y: 0 })
  const doneRef = useRef(false)

  const paintSand = useCallback(() => {
    const canvas = sandRef.current
    if (!canvas) return
    const r = fitCanvas(canvas)
    const ctx = r.ctx
    if (!ctx) return
    const W = r.w
    const H = r.h
    // 上一次擦除后合成模式仍是 destination-out，重绘前必须切回来
    ctx.globalCompositeOperation = 'source-over'

    const g = ctx.createLinearGradient(0, 0, W * 0.4, H)
    g.addColorStop(0, '#f7ead4')
    g.addColorStop(0.5, '#efdfc4')
    g.addColorStop(1, '#e7d3b4')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)

    // 沙粒
    for (let i = 0; i < 2600; i++) {
      const x = Math.random() * W
      const y = Math.random() * H
      const a = rand(0.02, 0.09)
      ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(160,124,88,${a})`
      ctx.fillRect(x, y, rand(1, 2.2), rand(1, 2.2))
    }

    // 耙过的纹路
    for (let i = 0; i < 11; i++) {
      const y0 = (H / 11) * i + rand(-8, 8)
      ctx.beginPath()
      ctx.moveTo(-20, y0)
      for (let x = 0; x <= W + 20; x += 34) {
        ctx.quadraticCurveTo(x + 17, y0 + rand(-4, 4), x + 34, y0)
      }
      ctx.strokeStyle = `rgba(168,134,96,${rand(0.05, 0.13)})`
      ctx.lineWidth = rand(1, 2.4)
      ctx.stroke()
    }

    for (let i = 0; i < 40; i++) {
      ctx.beginPath()
      ctx.arc(rand(0, W), rand(0, H), rand(0.8, 2), 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(150,120,90,0.18)'
      ctx.fill()
    }
  }, [])

  useEffect(() => {
    const sand = sandRef.current
    if (!sand) return

    let raf = requestAnimationFrame(() => paintSand())
    const ro = new ResizeObserver(() => paintSand())
    ro.observe(sand)

    const ctx = sand.getContext('2d')
    if (!ctx) return

    // 用缩略图采样计算擦除比例，避免每次读取全尺寸像素
    const probe = document.createElement('canvas')
    probe.width = 64
    probe.height = 64
    const pctx = probe.getContext('2d')

    let lastProbe = 0
    const measure = () => {
      if (!pctx) return
      pctx.clearRect(0, 0, 64, 64)
      pctx.drawImage(sand, 0, 0, 64, 64)
      const data = pctx.getImageData(0, 0, 64, 64).data
      let clear = 0
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 30) clear++
      }
      const p = clear / (64 * 64)
      setProgress(p)
      if (p > 0.4 && !doneRef.current) {
        doneRef.current = true
        setDone(true)
        sfx.chime()
      }
    }

    const scratch = (e: PointerEvent) => {
      const p = pointerPos(sand, e)
      ctx.globalCompositeOperation = 'destination-out'
      // destination-out 的擦除强度取决于绘制颜色的 alpha，
      // 必须用完全不透明的颜色，否则只会擦出半透明的雾
      ctx.fillStyle = '#000'
      ctx.strokeStyle = '#000'
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 54
      ctx.beginPath()
      ctx.moveTo(last.current.x, last.current.y)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(p.x, p.y, 27, 0, Math.PI * 2)
      ctx.fill()
      last.current = p

      const now = performance.now()
      if (now - lastProbe > 320) {
        lastProbe = now
        measure()
        setFound((f) => (Math.random() > 0.84 ? f + 1 : f))
        sfx.tick()
      }
    }

    const down = (e: PointerEvent) => {
      drawing.current = true
      last.current = pointerPos(sand, e)
      scratch(e)
    }
    const move = (e: PointerEvent) => {
      if (drawing.current) scratch(e)
    }
    const up = () => {
      drawing.current = false
      measure()
    }

    sand.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      sand.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [paintSand])

  const reset = () => {
    setNote(NOTES[Math.floor(Math.random() * NOTES.length)])
    setShells(makeShells())
    setProgress(0)
    setDone(false)
    setFound(0)
    doneRef.current = false
    paintSand()
  }

  return (
    <div>
      <div className="relative h-[300px] overflow-hidden rounded-4xl border border-white/70 sm:h-[380px]">
        {/* 下层：湿沙、贝壳与那句话 */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#d8bd93] via-[#c9aa7c] to-[#b6915f]">
          <div className="absolute inset-0 opacity-60 [background:radial-gradient(120px_80px_at_20%_30%,rgba(255,255,255,0.35),transparent_70%),radial-gradient(160px_90px_at_75%_70%,rgba(160,190,190,0.28),transparent_70%)]" />

          {shells.map((s, i) => (
            <svg
              key={i}
              viewBox="-30 -30 60 60"
              className="absolute drop-shadow-[0_2px_3px_rgba(120,90,60,0.28)]"
              style={{
                left: `${s.x}%`,
                top: `${s.y}%`,
                width: s.size * 2,
                height: s.size * 2,
                transform: `translate(-50%,-50%) rotate(${s.rot}deg)`,
              }}
              aria-hidden="true"
            >
              {s.kind === 'shell' ? (
                <g>
                  <path d="M0 16 Q-17 6 -12 -10 Q0 -6 12 -10 Q17 6 0 16 Z" fill={s.tone} stroke="rgba(150,110,80,0.55)" strokeWidth="1.2" />
                  {[-2, -1, 0, 1, 2].map((k) => (
                    <path key={k} d={`M0 14 L${k * 5} ${-8 + Math.abs(k) * 2}`} stroke="rgba(150,110,80,0.35)" strokeWidth="1" />
                  ))}
                </g>
              ) : (
                <path
                  d="M0 -16 L4.7 -5.2 L16 -4.4 L7.4 3.2 L10.2 14 L0 8.2 L-10.2 14 L-7.4 3.2 L-16 -4.4 L-4.7 -5.2 Z"
                  fill={s.tone}
                  stroke="rgba(150,110,80,0.45)"
                  strokeWidth="1.1"
                />
              )}
            </svg>
          ))}

          <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
            <p className="font-display text-[20px] font-semibold leading-snug text-[#42301f] sm:text-[23px]">{note}</p>
            <p className="mt-2 text-[11.5px] text-[#5a4530]/70">—— 屿上留给你的一句话</p>
          </div>
        </div>

        {/* 上层：可以被刮掉的干沙 */}
        <canvas
          ref={sandRef}
          className="game-canvas absolute inset-0 h-full w-full"
          aria-label="沙岸拾贝：用手指或鼠标刮开沙子"
        />

        <div className="pointer-events-none absolute left-4 top-4">
          <span className="sticker">
            <Icon name="feather" size={12} />
            {done ? '已经刮开了' : '按下并拖动，把沙刮开'}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/70">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sea-300 to-lav-300 transition-all duration-500"
              style={{ width: `${Math.min(100, progress * 100)}%` }}
            />
          </div>
          <span className="tnum w-9 text-right text-[11px] text-ink-400">{Math.round(progress * 100)}%</span>
        </div>
        <button onClick={reset} className="btn-quiet text-[11.5px]">
          <Icon name="refresh" size={13} />
          换一片沙
        </button>
      </div>
    </div>
  )
}
