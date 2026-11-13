import { useEffect, useRef, useState } from 'react'
import { clamp, fitCanvas, pointerPos, rand } from '../../lib/canvas'
import { sfx } from '../../lib/sfx'
import { Icon } from '../Icons'

/**
 * 打水漂 · Stone Skipping
 *
 * 交互：拖动定方向 → 长按蓄力 → 松开投出
 * 物理：世界坐标 760 单位宽，落地后按入射角与速度决定「弹起或沉没」，
 *      每次投掷带一点点风与摩擦扰动，所以同样力度也不会得到同一个数字。
 */

type Stage = 'aim' | 'charge' | 'fly' | 'done'

interface Ripple {
  x: number
  y: number
  r: number
  max: number
  life: number
  total: number
  wide: number
}
interface Drop {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  total: number
  r: number
}
interface FloatText {
  x: number
  y: number
  life: number
  text: string
}
interface Trail {
  x: number
  y: number
  rot: number
  life: number
}
interface Mark {
  x: number
  life: number
  n: number
}

const WORLD_W = 760
const ORIGIN = { x: 78, y: -18 }
const GRAVITY = 760
const HOP_C = 3.6e-4
const SPEED_MIN = 300
const SPEED_MAX = 700
const SINK_VX = 150
const MAX_SKIPS = 12
const TIME_SCALE = 0.72
const AIM_MIN = 3
const AIM_MAX = 50
const STEEP = 27
const STEP = 1 / 240
const BEST_KEY = 'sereneisle.v1.skip-best'

const STEPS: { id: Stage; label: string }[] = [
  { id: 'aim', label: '拖动定方向' },
  { id: 'charge', label: '长按蓄力' },
  { id: 'fly', label: '松手投出' },
]

function buzz(ms: number) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* 忽略：桌面浏览器一般不支持 */
  }
}

function loadBest(): number {
  try {
    const n = Number(localStorage.getItem(BEST_KEY) || '0')
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

export function Skipping() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const powerFillRef = useRef<HTMLDivElement | null>(null)
  const powerTextRef = useRef<HTMLSpanElement | null>(null)
  const angleRef = useRef<HTMLSpanElement | null>(null)

  const [stage, setStage] = useState<Stage>('aim')
  const [skips, setSkips] = useState(0)
  const [best, setBest] = useState(0)
  const [windUi, setWindUi] = useState('无风')
  const [hint, setHint] = useState('按住并拖动，先决定石头飞出去的方向')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const init = fitCanvas(canvas)
    let ctx = init.ctx as CanvasRenderingContext2D
    let w = init.w
    let h = init.h
    let U = w / WORLD_W
    let waterY = h * 0.7

    /* ───────── 运行状态 ───────── */
    let stageLocal: Stage = 'aim'
    let angleDeg = 14
    let power = 0
    let charging = false
    let aiming = false
    let skipsLocal = 0
    let windAccel = 0
    let friction = 1
    let bounceSeed = 0
    let finished = false
    let bestLocal = loadBest()
    let lastTouchX = ORIGIN.x
    let t = 0

    const stone = { x: ORIGIN.x, y: ORIGIN.y, vx: 0, vy: 0, rot: 0, flying: false, sinking: false, sinkT: 0 }
    const ripples: Ripple[] = []
    const drops: Drop[] = []
    const floats: FloatText[] = []
    const trails: Trail[] = []
    const marks: Mark[] = []
    const clouds = [
      { x: 0.16, y: 0.2, s: 1.15, v: 0.006, a: 0.85 },
      { x: 0.52, y: 0.12, s: 0.8, v: 0.004, a: 0.7 },
      { x: 0.8, y: 0.26, s: 1.0, v: 0.005, a: 0.55 },
    ]

    let resetTimer = 0
    let acc = 0
    let raf = 0
    let last = performance.now()

    const sx = (v: number) => v * U
    const sy = (v: number) => waterY + v * U

    /* ───────── UI 同步 ───────── */
    const syncAngle = () => {
      if (angleRef.current) angleRef.current.textContent = `${Math.round(angleDeg)}°`
    }
    const syncPower = () => {
      if (powerFillRef.current) powerFillRef.current.style.height = `${Math.round(power * 100)}%`
      if (powerTextRef.current) powerTextRef.current.textContent = `${Math.round(power * 100)}%`
    }
    const setStageSafe = (s: Stage) => {
      stageLocal = s
      setStage(s)
    }

    /* ───────── 场景元素 ───────── */
    const addRipple = (x: number, y: number, strength = 1) => {
      ripples.push({ x, y, r: 5, max: 54 + strength * 78, life: 1.5, total: 1.5, wide: 0.3 })
      if (strength > 0.9) {
        ripples.push({ x, y, r: 2, max: 34 + strength * 40, life: 1.1, total: 1.1, wide: 0.34 })
      }
    }
    const addSplash = (x: number, y: number, energy: number) => {
      const n = Math.round(6 + energy * 12)
      for (let i = 0; i < n; i++) {
        const a = rand(-Math.PI * 0.92, -Math.PI * 0.08)
        const sp = rand(40, 150) * (0.5 + energy)
        drops.push({
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: rand(0.35, 0.8),
          total: 0.8,
          r: rand(1, 2.4),
        })
      }
    }

    /* ───────── 投掷 ───────── */
    const resetStone = () => {
      window.clearTimeout(resetTimer)
      stone.x = ORIGIN.x
      stone.y = ORIGIN.y
      stone.vx = 0
      stone.vy = 0
      stone.rot = 0
      stone.flying = false
      stone.sinking = false
      stone.sinkT = 0
      skipsLocal = 0
      finished = false
      power = 0
      charging = false
      aiming = false
      setSkips(0)
      setStageSafe('aim')
      syncPower()
      setHint('按住并拖动，先决定石头飞出去的方向')
    }

    const launch = () => {
      const a = (angleDeg * Math.PI) / 180
      const speed = SPEED_MIN + (SPEED_MAX - SPEED_MIN) * power
      windAccel = rand(-0.35, 0.5)
      friction = rand(-0.03, 0.03)
      bounceSeed = rand(-0.05, 0.05)
      stone.vx = Math.cos(a) * speed
      stone.vy = -Math.sin(a) * speed
      stone.flying = true
      lastTouchX = ORIGIN.x
      stone.sinking = false
      stone.sinkT = 0
      skipsLocal = 0
      finished = false
      setSkips(0)
      setStageSafe('fly')
      setWindUi(
        Math.abs(windAccel) < 0.1
          ? '无风'
          : `${windAccel > 0.28 ? '风起' : '微风'} ${windAccel > 0 ? '→' : '←'}`,
      )
      setHint('贴着水面飞…')
      sfx.whoosh()
    }

    const settle = () => {
      if (finished) return
      finished = true
      stone.flying = false
      const n = skipsLocal
      if (n > 0) {
        marks.push({ x: clamp(lastTouchX, 24, WORLD_W - 10), life: 26, n })
        if (marks.length > 7) marks.shift()
      }
      setStageSafe('done')
      if (n > bestLocal) {
        bestLocal = n
        setBest(n)
        try {
          localStorage.setItem(BEST_KEY, String(n))
        } catch {
          /* 忽略 */
        }
      }
      if (n === 0) setHint('石头直接扎进水里了。角度放浅一点，力度再给足些。')
      else if (n <= 2) setHint('水面记住了它，一下也算一下。')
      else if (n <= 5) setHint('节奏已经有了，再浅一点会更远。')
      else if (n <= 8) setHint('这一投很稳，水面跟着你的节奏走。')
      else setHint('漂亮。风也帮了你一点。')
      if (n >= 9) sfx.chime()
      resetTimer = window.setTimeout(resetStone, 1900)
    }

    const doSink = () => {
      stone.sinking = true
      stone.flying = false
      stone.sinkT = 0
      stone.vy = 0
      addRipple(stone.x, 0, 1.15)
      sfx.plink()
      buzz(28)
      resetTimer = window.setTimeout(settle, 900)
    }

    /* ───────── 物理 ───────── */
    const onBounce = () => {
      skipsLocal += 1
      lastTouchX = stone.x
      setSkips(skipsLocal)
      addRipple(stone.x, 0, 0.5)
      addSplash(stone.x, 0, Math.min(1, Math.abs(stone.vx) / 520))
      floats.push({ x: stone.x, y: -8, life: 1, text: String(skipsLocal) })
      sfx.splash()
      buzz(6)
      if (skipsLocal === 5) setHint('已经 5 下了，保持这个角度')
      if (skipsLocal === 9) setHint('9 下，很稳')
    }

    const physics = (dt: number) => {
      if (!stone.flying) return
      stone.vy += GRAVITY * dt
      stone.vx += windAccel * 26 * dt
      stone.x += stone.vx * dt
      stone.y += stone.vy * dt
      stone.rot += dt * 7.5

      if (stone.y > 0 && stone.vy > 0 && !stone.sinking) {
        stone.y = 0
        const ratio = stone.vy / Math.max(1, Math.abs(stone.vx))
        const canSkip = skipsLocal < MAX_SKIPS && ratio < 0.55 && Math.abs(stone.vx) > SINK_VX
        if (canSkip) {
          stone.vx *= (0.9 - ratio * 0.35) * (1 + friction)
          const L = HOP_C * stone.vx * stone.vx * (1 + bounceSeed)
          stone.vy = -Math.max((GRAVITY * L) / (2 * stone.vx), 50)
          stone.y = -0.6
          onBounce()
        } else {
          doSink()
        }
      }

      if (stone.x * U > w + 80) settle()
      if (stone.x < -40) settle()
    }

    /* ───────── 绘制：远山与灯塔（可复用于水面倒影） ───────── */
    const paintLand = (alpha = 1) => {
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.beginPath()
      ctx.moveTo(-2, waterY + 2)
      ctx.bezierCurveTo(w * 0.06, waterY - 38, w * 0.16, waterY - 56, w * 0.28, waterY - 14)
      ctx.bezierCurveTo(w * 0.36, waterY - 36, w * 0.44, waterY - 24, w * 0.5, waterY + 2)
      ctx.closePath()
      ctx.fillStyle = 'rgba(116, 170, 194, 0.5)'
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(w * 0.06, waterY + 2)
      ctx.bezierCurveTo(w * 0.16, waterY - 44, w * 0.26, waterY - 52, w * 0.38, waterY - 4)
      ctx.bezierCurveTo(w * 0.44, waterY - 22, w * 0.5, waterY - 12, w * 0.56, waterY + 2)
      ctx.closePath()
      ctx.fillStyle = 'rgba(96, 156, 184, 0.55)'
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(w * 0.46, waterY + 2)
      ctx.bezierCurveTo(w * 0.6, waterY - 46, w * 0.72, waterY - 34, w * 0.84, waterY - 8)
      ctx.bezierCurveTo(w * 0.9, waterY - 22, w * 0.95, waterY - 12, w + 2, waterY + 2)
      ctx.closePath()
      ctx.fillStyle = 'rgba(110, 165, 190, 0.42)'
      ctx.fill()

      // 远处的小岛与灯塔
      const ix = w * 0.845
      const iy = waterY - 2
      const islandW = 52 * (w / 760 + 0.2)
      ctx.beginPath()
      ctx.moveTo(ix - islandW, iy + 1)
      ctx.quadraticCurveTo(ix - islandW * 0.4, iy - 16, ix + islandW * 0.1, iy - 12)
      ctx.quadraticCurveTo(ix + islandW * 0.6, iy - 8, ix + islandW, iy + 1)
      ctx.closePath()
      ctx.fillStyle = 'rgba(133, 175, 191, 0.72)'
      ctx.fill()

      // 灯屋
      ctx.beginPath()
      ctx.moveTo(ix + 2, iy - 12)
      ctx.lineTo(ix + 5, iy - 42)
      ctx.lineTo(ix + 13, iy - 42)
      ctx.lineTo(ix + 16, iy - 12)
      ctx.closePath()
      ctx.fillStyle = 'rgba(226, 240, 244, 0.92)'
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(ix + 4, iy - 28)
      ctx.lineTo(ix + 14, iy - 28)
      ctx.strokeStyle = 'rgba(146, 182, 196, 0.6)'
      ctx.lineWidth = 1.6
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(ix + 3, iy - 42)
      ctx.lineTo(ix + 9, iy - 49)
      ctx.lineTo(ix + 15, iy - 42)
      ctx.closePath()
      ctx.fillStyle = 'rgba(150, 174, 186, 0.9)'
      ctx.fill()

      // 灯塔的光
      const pulse = 0.45 + Math.sin(t * 1.1) * 0.14
      const lg = ctx.createRadialGradient(ix + 9, iy - 44, 1, ix + 9, iy - 44, 20)
      lg.addColorStop(0, `rgba(255, 250, 232, ${pulse})`)
      lg.addColorStop(1, 'rgba(255, 250, 232, 0)')
      ctx.beginPath()
      ctx.arc(ix + 9, iy - 44, 20, 0, Math.PI * 2)
      ctx.fillStyle = lg
      ctx.fill()
      ctx.restore()
    }

    /* ───────── 绘制：天空 ───────── */
    const drawSky = () => {
      const sky = ctx.createLinearGradient(0, 0, 0, waterY)
      sky.addColorStop(0, '#b3dcef')
      sky.addColorStop(0.4, '#cbe7f4')
      sky.addColorStop(0.76, '#ddf0f8')
      sky.addColorStop(1, '#e8f6fa')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, w, waterY + 1)

      const sunX = w * 0.19
      const sunY = waterY * 0.34
      const haloR = Math.max(w * 0.3, 190)
      const halo = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, haloR)
      halo.addColorStop(0, 'rgba(255, 246, 226, 0.72)')
      halo.addColorStop(0.18, 'rgba(255, 246, 228, 0.34)')
      halo.addColorStop(0.52, 'rgba(255, 248, 236, 0.12)')
      halo.addColorStop(1, 'rgba(255, 250, 240, 0)')
      ctx.fillStyle = halo
      ctx.fillRect(0, 0, w, waterY + 1)

      // 太阳
      const disc = ctx.createRadialGradient(sunX - 3, sunY - 3, 1, sunX, sunY, 16)
      disc.addColorStop(0, 'rgba(255, 253, 246, 1)')
      disc.addColorStop(0.6, 'rgba(255, 242, 214, 0.95)')
      disc.addColorStop(1, 'rgba(255, 234, 198, 0)')
      ctx.beginPath()
      ctx.arc(sunX, sunY, 16, 0, Math.PI * 2)
      ctx.fillStyle = disc
      ctx.fill()

      // 云：软边叠出来的，不用滤镜也够柔
      for (const c of clouds) {
        const cx = (((c.x + t * c.v) % 1.4) - 0.2) * w
        const cy = c.y * waterY
        const r = 26 * c.s * (w / 760 + 0.45)
        ctx.globalAlpha = c.a
        for (let i = 0; i < 3; i++) {
          const gx = cx + (i - 1) * r * 1.1
          const gy = cy + Math.sin(i * 1.7) * r * 0.16
          const g = ctx.createRadialGradient(gx, gy, r * 0.1, gx, gy, r)
          g.addColorStop(0, 'rgba(255,255,255,0.98)')
          g.addColorStop(0.55, 'rgba(255,255,255,0.6)')
          g.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.beginPath()
          ctx.ellipse(gx, gy, r * 1.3, r * 0.6, 0, 0, Math.PI * 2)
          ctx.fillStyle = g
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1

      paintLand()

      // 飞鸟
      const bx = w * 0.56
      const by = waterY * 0.28
      ctx.strokeStyle = 'rgba(96, 132, 148, 0.55)'
      ctx.lineWidth = 1.2
      for (let i = 0; i < 3; i++) {
        const ox = bx + i * 18 + Math.sin(t * 0.5 + i) * 4
        const oy = by + Math.sin(t * 0.8 + i * 2) * 3 + i * 4
        const s = 4.5 - i * 0.8
        ctx.beginPath()
        ctx.moveTo(ox - s, oy)
        ctx.quadraticCurveTo(ox - s * 0.4, oy - s * 0.6, ox, oy - s * 0.1)
        ctx.quadraticCurveTo(ox + s * 0.4, oy - s * 0.6, ox + s, oy)
        ctx.stroke()
      }
    }

    /* ───────── 绘制：水面 ───────── */
    const drawWater = () => {
      const sea = ctx.createLinearGradient(0, waterY, 0, h)
      sea.addColorStop(0, '#a8d7e8')
      sea.addColorStop(0.3, '#8ec8dd')
      sea.addColorStop(0.66, '#75b6cf')
      sea.addColorStop(1, '#5fa2be')
      ctx.fillStyle = sea
      ctx.fillRect(0, waterY, w, h - waterY)

      // 远山与灯塔在水面的倒影：整体压扁、压暗，加一点横向波动
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, waterY, w, h - waterY)
      ctx.clip()
      ctx.translate(0, waterY * 2)
      ctx.scale(1, -0.85)
      paintLand(0.22)
      ctx.restore()

      // 灯塔倒影：一团柔光，不要硬边方块
      const ix = w * 0.845
      const refl = ctx.createRadialGradient(ix, waterY + 10, 2, ix, waterY + 10, 46)
      refl.addColorStop(0, 'rgba(116, 156, 174, 0.3)')
      refl.addColorStop(0.55, 'rgba(116, 156, 174, 0.14)')
      refl.addColorStop(1, 'rgba(116, 156, 174, 0)')
      ctx.beginPath()
      ctx.ellipse(ix, waterY + 10, 46, 26, 0, 0, Math.PI * 2)
      ctx.fillStyle = refl
      ctx.fill()

      // 阳光在水面铺开的一团柔光
      const sunX = w * 0.2
      const pool = ctx.createRadialGradient(
        sunX,
        waterY + (h - waterY) * 0.22,
        6,
        sunX,
        waterY + (h - waterY) * 0.22,
        Math.max(w * 0.26, 150),
      )
      pool.addColorStop(0, 'rgba(255, 250, 234, 0.55)')
      pool.addColorStop(0.5, 'rgba(255, 250, 236, 0.22)')
      pool.addColorStop(1, 'rgba(255, 250, 238, 0)')
      ctx.fillStyle = pool
      ctx.fillRect(0, waterY, w * 0.55, h - waterY)

      // 光斑
      for (let i = 0; i < 26; i++) {
        const p = i / 26
        const y = waterY + 4 + p * (h - waterY) * 0.9
        const spread = (14 + p * 66) * (w / 760 + 0.3)
        const shimmer = 0.35 + Math.sin(t * 1.6 + i * 0.9) * 0.35
        ctx.beginPath()
        ctx.ellipse(
          sunX + Math.sin(i * 2.3 + t * 0.6) * spread,
          y,
          (6 + p * 15) * 0.7,
          1 + p * 1.2,
          0,
          0,
          Math.PI * 2,
        )
        ctx.fillStyle = `rgba(255, 253, 244, ${Math.max(0, shimmer) * 0.7})`
        ctx.fill()
      }

      // 水纹
      for (let i = 0; i < 9; i++) {
        const p = i / 9
        const y = waterY + 5 + p * (h - waterY)
        ctx.beginPath()
        ctx.moveTo(-10, y)
        for (let x = -10; x <= w + 40; x += 36) {
          ctx.quadraticCurveTo(
            x + 18,
            y + Math.sin((x + t * 42 + i * 26) / 82) * (1.2 + p * 2.2),
            x + 36,
            y,
          )
        }
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.26 - p * 0.19})`
        ctx.lineWidth = 1 + p * 0.6
        ctx.stroke()
      }

      // 岸线
      ctx.beginPath()
      ctx.moveTo(0, waterY)
      ctx.lineTo(w, waterY)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
      ctx.lineWidth = 1.4
      ctx.stroke()
    }

    /* ───────── 绘制：近岸木栈桥 ───────── */
    const drawDeck = () => {
      const deckTop = sy(-16)
      const deckH = Math.max(5, 9 * U)
      const deckW = Math.max(78, w * 0.145)
      const postTop = deckTop + deckH - 1
      const postBottom = waterY + 20 * U + 10

      // 水里的桩与倒影
      for (const px of [deckW * 0.24, deckW * 0.72]) {
        ctx.fillStyle = 'rgba(124, 112, 100, 0.55)'
        ctx.fillRect(px - 2.2 * U - 1, postTop, 4.4 * U + 2, postBottom - postTop)
        const rf = ctx.createLinearGradient(0, waterY, 0, waterY + 40)
        rf.addColorStop(0, 'rgba(110, 98, 88, 0.3)')
        rf.addColorStop(1, 'rgba(110, 98, 88, 0)')
        ctx.fillStyle = rf
        ctx.fillRect(px - 2.2 * U - 1, waterY, 4.4 * U + 2, 40)
      }

      // 甲板
      ctx.beginPath()
      const r = deckH * 0.7
      ctx.moveTo(-8, deckTop + r)
      ctx.quadraticCurveTo(-8, deckTop, deckW - r, deckTop)
      ctx.quadraticCurveTo(deckW, deckTop, deckW, deckTop + r)
      ctx.lineTo(deckW, deckTop + deckH - r)
      ctx.quadraticCurveTo(deckW, deckTop + deckH, deckW - r, deckTop + deckH)
      ctx.lineTo(-8, deckTop + deckH)
      ctx.closePath()
      const wood = ctx.createLinearGradient(0, deckTop, 0, deckTop + deckH)
      wood.addColorStop(0, 'rgba(226, 209, 186, 0.98)')
      wood.addColorStop(0.55, 'rgba(198, 179, 155, 0.98)')
      wood.addColorStop(1, 'rgba(168, 149, 128, 0.98)')
      ctx.fillStyle = wood
      ctx.fill()

      // 木板缝
      ctx.strokeStyle = 'rgba(146, 126, 106, 0.28)'
      ctx.lineWidth = 1
      for (let x = deckW * 0.12; x < deckW - 6; x += Math.max(11, 13 * U)) {
        ctx.beginPath()
        ctx.moveTo(x, deckTop + 1)
        ctx.lineTo(x, deckTop + deckH - 1)
        ctx.stroke()
      }

      // 板上小石子
      ctx.fillStyle = 'rgba(150, 158, 160, 0.55)'
      for (let i = 0; i < 4; i++) {
        const bx = deckW * (0.55 + i * 0.09)
        ctx.beginPath()
        ctx.ellipse(bx, deckTop + deckH * 0.45, 2.6, 1.5, 0, 0, Math.PI * 2)
        ctx.fill()
      }

      // 甲板在水面的投影
      const sh = ctx.createLinearGradient(0, waterY, 0, waterY + 22)
      sh.addColorStop(0, 'rgba(88, 118, 130, 0.2)')
      sh.addColorStop(1, 'rgba(88, 118, 130, 0)')
      ctx.fillStyle = sh
      ctx.fillRect(0, waterY, deckW * 1.05, 22)
    }

    /* ───────── 绘制：石头与特效 ───────── */
    const drawStone = () => {
      if (!stone.flying && stageLocal === 'done') return
      const px = sx(stone.x)
      const py = sy(stone.y)
      const r = 13 * clamp(U, 0.85, 1.15)
      const alpha = stone.sinking ? Math.max(0, 1 - stone.sinkT * 1.6) : 1

      // 水面投影
      if (!stone.sinking) {
        const depth = clamp(1 - Math.abs(stone.y) / 160, 0.25, 1)
        ctx.beginPath()
        ctx.ellipse(px, waterY + 2, r * 0.9 * depth, r * 0.26 * depth, 0, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(58, 123, 141, ${0.14 * depth})`
        ctx.fill()
      }

      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(px, py)
      ctx.rotate(stone.rot)
      const g = ctx.createLinearGradient(-r, -r, r, r)
      g.addColorStop(0, '#a8b6bd')
      g.addColorStop(0.55, '#8798a0')
      g.addColorStop(1, '#6f828c')
      ctx.beginPath()
      ctx.ellipse(0, 0, r, r * 0.44, 0, 0, Math.PI * 2)
      ctx.fillStyle = g
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(-r * 0.18, -r * 0.14, r * 0.5, r * 0.15, 0.28, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.42)'
      ctx.fill()
      ctx.restore()
      ctx.globalAlpha = 1

      // 蓄力时的呼吸光晕
      if (charging) {
        const rr = r * 1.9 + power * 16
        ctx.beginPath()
        ctx.arc(px, py, rr, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(74, 151, 170, ${0.16 + power * 0.35})`
        ctx.lineWidth = 1.6
        ctx.stroke()
      }
    }

    const drawTrails = (dt: number) => {
      for (let i = trails.length - 1; i >= 0; i--) {
        const tr = trails[i]
        tr.life -= dt * 2.2
        if (tr.life <= 0) {
          trails.splice(i, 1)
          continue
        }
        ctx.beginPath()
        ctx.ellipse(sx(tr.x), sy(tr.y), 8 * tr.life, 3.4 * tr.life, 0, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(120, 146, 156, ${tr.life * 0.22})`
        ctx.fill()
      }
    }

    const drawEffects = (dt: number) => {
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i]
        r.life -= dt
        r.r += (r.max - r.r) * Math.min(1, dt * 2.4)
        if (r.life <= 0) {
          ripples.splice(i, 1)
          continue
        }
        const a = Math.max(0, r.life / r.total)
        for (let k = 0; k < 2; k++) {
          ctx.beginPath()
          ctx.ellipse(r.x * U, waterY, r.r * (1 - k * 0.32), r.r * r.wide * (1 - k * 0.3), 0, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(255, 255, 255, ${a * (k === 0 ? 0.7 : 0.34)})`
          ctx.lineWidth = k === 0 ? 1.6 : 1
          ctx.stroke()
        }
      }

      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]
        d.life -= dt
        if (d.life <= 0) {
          drops.splice(i, 1)
          continue
        }
        d.vy += 620 * dt
        d.x += d.vx * dt
        d.y += d.vy * dt
        if (d.y > 0) {
          d.y = 0
          d.vy *= -0.28
          d.vx *= 0.6
        }
        ctx.beginPath()
        ctx.arc(sx(d.x), sy(d.y), d.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, d.life * 2.2) * 0.9})`
        ctx.fill()
      }

      for (let i = floats.length - 1; i >= 0; i--) {
        const f = floats[i]
        f.life -= dt * 1.5
        if (f.life <= 0) {
          floats.splice(i, 1)
          continue
        }
        f.y -= dt * 15
        ctx.font = '600 15px "Optima", "Songti SC", system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillStyle = `rgba(44, 96, 112, ${Math.min(1, f.life * 1.6) * 0.8})`
        ctx.fillText(f.text, sx(f.x), sy(f.y) - 12)
      }

      for (let i = marks.length - 1; i >= 0; i--) {
        const m = marks[i]
        m.life -= dt
        if (m.life <= 0) {
          marks.splice(i, 1)
          continue
        }
        const a = Math.min(0.5, m.life / 8)
        ctx.beginPath()
        ctx.arc(sx(m.x), waterY + 3, 2.4, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(58, 123, 141, ${a})`
        ctx.fill()
        ctx.font = '500 9px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillStyle = `rgba(58, 123, 141, ${a})`
        ctx.fillText(`${m.n}`, sx(m.x), waterY + 16)
      }
    }

    /* ───────── 瞄准与轨迹预览 ───────── */
    const trajectory = (aDeg: number, pw: number) => {
      const a = (aDeg * Math.PI) / 180
      const speed = SPEED_MIN + (SPEED_MAX - SPEED_MIN) * pw
      let vx = Math.cos(a) * speed
      let vy = -Math.sin(a) * speed
      let x = ORIGIN.x
      let y = ORIGIN.y
      const pts: { x: number; y: number }[] = [{ x, y }]
      let hit: { x: number; y: number } | null = null
      const dt = 1 / 160
      let bounces = 0
      for (let i = 0; i < 1200; i++) {
        vy += GRAVITY * dt
        x += vx * dt
        y += vy * dt
        if (y >= 0 && vy > 0) {
          const ratio = vy / Math.max(1, vx)
          if (!hit) hit = { x, y: 0 }
          bounces += 1
          if (bounces > 2 || ratio >= 0.55 || vx < SINK_VX) break
          vx *= 0.9 - ratio * 0.35
          const L = HOP_C * vx * vx
          vy = -Math.max((GRAVITY * L) / (2 * vx), 50)
          y = -0.6
          pts.push({ x, y: 0 })
        }
        if (i % 3 === 0) pts.push({ x, y })
        if (x > WORLD_W + 60) break
      }
      return { pts, hit }
    }

    const drawAim = () => {
      if (stageLocal !== 'aim' && stageLocal !== 'charge') return
      const px = sx(ORIGIN.x)
      const py = sy(ORIGIN.y)
      const a = (angleDeg * Math.PI) / 180
      const len = 54 + power * 18
      const ex = px + Math.cos(a) * len
      const ey = py - Math.sin(a) * len

      // 方向线
      const arrowInk = angleDeg > STEEP ? 'rgba(214, 106, 84, 0.9)' : 'rgba(46, 108, 128, 0.85)'
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(ex, ey)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)'
      ctx.lineWidth = 4.5
      ctx.setLineDash([5, 5])
      ctx.lineDashOffset = -t * 18
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(ex, ey)
      ctx.strokeStyle = arrowInk
      ctx.lineWidth = 1.8
      ctx.stroke()
      ctx.setLineDash([])

      // 箭头
      ctx.save()
      ctx.translate(ex, ey)
      ctx.rotate(-a)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(-7, 4)
      ctx.lineTo(-7, -4)
      ctx.closePath()
      ctx.fillStyle = arrowInk
      ctx.fill()
      ctx.restore()

      // 角度弧
      ctx.beginPath()
      ctx.arc(px, py, 30, 0, -a, true)
      ctx.strokeStyle = 'rgba(58, 123, 141, 0.3)'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(px + 34, py)
      ctx.strokeStyle = 'rgba(58, 123, 141, 0.16)'
      ctx.setLineDash([2, 4])
      ctx.stroke()
      ctx.setLineDash([])

      // 轨迹预览：先铺一层白色柔光，再压一条虚线，浅色海面上也看得清
      const preview = stageLocal === 'charge' ? power : 0.55
      const { pts, hit } = trajectory(angleDeg, preview)
      const line = () => {
        ctx.beginPath()
        pts.forEach((p, i) => {
          const px2 = sx(p.x)
          const py2 = sy(p.y)
          if (i === 0) ctx.moveTo(px2, py2)
          else ctx.lineTo(px2, py2)
        })
      }
      line()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
      ctx.lineWidth = 4
      ctx.lineJoin = 'round'
      ctx.stroke()
      line()
      ctx.strokeStyle = stageLocal === 'charge' ? 'rgba(52, 118, 138, 0.7)' : 'rgba(52, 118, 138, 0.45)'
      ctx.lineWidth = 1.6
      ctx.setLineDash([4, 5])
      ctx.lineDashOffset = -t * 26
      ctx.stroke()
      ctx.setLineDash([])

      // 落点：一圈呼吸的准星
      if (hit) {
        const hx = sx(hit.x)
        const pulse = 1 + Math.sin(t * 3.2) * 0.12
        ctx.beginPath()
        ctx.ellipse(hx, waterY + 1, 11 * pulse, 3.6 * pulse, 0, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
        ctx.lineWidth = 1.6
        ctx.stroke()
        ctx.beginPath()
        ctx.ellipse(hx, waterY + 1, 4.5, 1.6, 0, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(58, 123, 141, 0.6)'
        ctx.fill()
      }
    }

    const drawVignette = () => {
      const v = ctx.createRadialGradient(w * 0.5, h * 0.45, Math.min(w, h) * 0.25, w * 0.5, h * 0.5, Math.max(w, h) * 0.78)
      v.addColorStop(0, 'rgba(46, 96, 112, 0)')
      v.addColorStop(1, 'rgba(38, 82, 98, 0.16)')
      ctx.fillStyle = v
      ctx.fillRect(0, 0, w, h)
    }

    /* ───────── 主循环 ───────── */
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      t += dt

      if (charging) {
        power = Math.min(1, power + dt * 0.72)
        syncPower()
      }

      if (stone.sinking) {
        stone.sinkT += dt
        stone.y += dt * 22
      }

      // 固定步长积分，避免速度快时穿水面
      acc += dt * TIME_SCALE
      let guard = 0
      while (acc >= STEP && guard < 24) {
        physics(STEP)
        acc -= STEP
        guard += 1
      }
      if (guard >= 24) acc = 0

      if (stone.flying && !stone.sinking) {
        trails.push({ x: stone.x, y: stone.y, rot: stone.rot, life: 0.9 })
        if (trails.length > 26) trails.shift()
      }

      drawSky()
      drawWater()
      drawDeck()
      drawTrails(dt)
      drawEffects(dt)
      drawAim()
      drawStone()
      drawVignette()

      raf = requestAnimationFrame(loop)
    }

    /* ───────── 交互 ───────── */
    // 拖动方向即投掷方向：用按下点到当前点的位移算角度，从哪里拖都顺手
    let aimFrom = { x: 0, y: 0 }
    const updateAim = (px: number, py: number) => {
      const dx = px - aimFrom.x
      const dy = aimFrom.y - py
      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return
      const a = (Math.atan2(dy, Math.max(dx, 18)) * 180) / Math.PI
      angleDeg = clamp(a, AIM_MIN, AIM_MAX)
      syncAngle()
    }

    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture?.(e.pointerId)
      canvas.focus()
      const p = pointerPos(canvas, e)
      if (stageLocal === 'aim') {
        aiming = true
        aimFrom = { x: p.x, y: p.y }
        setHint('往右上拖，松手定住方向')
        sfx.tick()
      } else if (stageLocal === 'charge') {
        charging = true
        power = 0.04
        syncPower()
        setHint('长按越久，力度越大；松手就投出去')
      }
    }

    const onMove = (e: PointerEvent) => {
      if (!aiming) return
      const p = pointerPos(canvas, e)
      updateAim(p.x, p.y)
    }

    const onUp = () => {
      if (aiming) {
        aiming = false
        setStageSafe('charge')
        setHint('长按任意位置蓄力，松手把石头投出去')
        return
      }
      if (charging) {
        charging = false
        launch()
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        angleDeg = clamp(angleDeg + (e.key === 'ArrowRight' ? 1 : -1), AIM_MIN, AIM_MAX)
        syncAngle()
        sfx.tick()
        return
      }
      if (e.code === 'Space') {
        e.preventDefault()
        if (stageLocal === 'aim') {
          setStageSafe('charge')
          setHint('长按任意位置蓄力，松手把石头投出去')
        } else if (stageLocal === 'charge' && !charging) {
          charging = true
          power = 0.04
          syncPower()
        }
        return
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        resetStone()
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && charging) {
        e.preventDefault()
        charging = false
        launch()
      }
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    canvas.addEventListener('keydown', onKeyDown)
    canvas.addEventListener('keyup', onKeyUp)

    const ro = new ResizeObserver(() => {
      const next = fitCanvas(canvas)
      ctx = next.ctx as CanvasRenderingContext2D
      w = next.w
      h = next.h
      U = w / WORLD_W
      waterY = h * 0.7
      resetStone()
    })
    ro.observe(canvas)

    // 首屏状态
    setBest(loadBest())
    syncAngle()
    syncPower()

    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(resetTimer)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('keydown', onKeyDown)
      canvas.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  return (
    <div>
      <div className="relative overflow-hidden rounded-[2rem] bg-[#e6f4f9] shadow-[0_26px_60px_-40px_rgba(46,96,112,0.65)] ring-1 ring-white/70">
        <div className="relative h-[320px] sm:h-[400px]">
          <canvas
            ref={canvasRef}
            tabIndex={0}
            className="game-canvas h-full w-full cursor-crosshair outline-none"
            aria-label="打水漂：先拖动定方向，再长按蓄力，松开投出石头"
          />

          {/* 纸感 + 顶部柔光 */}
          <div className="grain pointer-events-none absolute inset-0" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_75%_at_50%_0%,rgba(255,255,255,0.16),transparent_62%)]" />

          {/* 成绩 */}
          <div className="pointer-events-none absolute left-4 top-4 flex flex-col items-start gap-1.5">
            <span className="sticker">
              这一投 <span className="tnum ml-0.5 text-[13px] font-semibold text-ink-900">{skips}</span> 下
            </span>
            <span className="sticker text-ink-400">
              纪录 <span className="tnum ml-0.5 text-[12px] font-semibold text-sea-600">{best}</span> 下
            </span>
          </div>

          {/* 角度 / 风 */}
          <div className="pointer-events-none absolute right-4 top-4 space-y-1 text-right">
            <p className="text-[10px] tracking-[0.16em] text-ink-400">
              角度 <span ref={angleRef} className="tnum text-[12px] font-semibold text-ink-800">14°</span>
            </p>
            <p className="text-[10px] tracking-[0.16em] text-ink-400">
              风 <span className="text-[11px] font-medium text-sea-600">{windUi}</span>
            </p>
          </div>

          {/* 步骤指引 */}
          <div className="pointer-events-none absolute left-1/2 top-3.5 hidden -translate-x-1/2 items-center gap-1 sm:flex">
            {STEPS.map((s, i) => {
              const active = stage === s.id
              const done = (stage === 'fly' || stage === 'done') && i < 2
              return (
                <div key={s.id} className="flex items-center">
                  <span
                    className={`flex items-center gap-1 rounded-full px-2 py-[3px] text-[10px] transition-colors duration-300 ${
                      active
                        ? 'bg-white/90 text-ink-900 shadow-[0_6px_14px_-10px_rgba(46,96,112,0.8)]'
                        : done
                          ? 'text-sea-600/80'
                          : 'text-ink-300'
                    }`}
                  >
                    <span
                      className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-semibold ${
                        active ? 'bg-sea-500 text-white' : done ? 'bg-sea-200 text-sea-700' : 'bg-white/70 text-ink-300'
                      }`}
                    >
                      {done ? '✓' : i + 1}
                    </span>
                    {s.label}
                  </span>
                  {i < STEPS.length - 1 && <span className="mx-1 h-px w-2.5 bg-white/80" />}
                </div>
              )
            })}
          </div>

          {/* 力度条 */}
          <div
            className={`pointer-events-none absolute bottom-4 left-4 flex items-end gap-2 transition-opacity duration-500 ${
              stage === 'charge' ? 'opacity-100' : 'opacity-50'
            }`}
          >
            <div className="relative flex h-24 w-3 flex-col justify-end overflow-hidden rounded-full bg-white/55 ring-1 ring-white/70">
              <div
                ref={powerFillRef}
                className="w-full rounded-full bg-gradient-to-t from-sea-400 via-sea-300 to-lav-300"
                style={{ height: '0%' }}
              />
            </div>
            <div className="mb-0.5">
              <p className="text-[9px] tracking-[0.18em] text-ink-400">POWER</p>
              <span ref={powerTextRef} className="tnum mt-0.5 block text-[10px] font-semibold text-sea-700">
                0%
              </span>
            </div>
          </div>

          {/* 提示 */}
          {stage !== 'done' && (
            <p className="pointer-events-none absolute bottom-4 left-1/2 max-w-[62%] -translate-x-1/2 text-center text-[11.5px] leading-relaxed text-sea-800/80">
              {hint}
            </p>
          )}

          {/* 投完之后的小结 */}
          {stage === 'done' && (
            <div className="skip-result pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center">
              <p className="font-display text-[34px] font-semibold leading-none text-sea-800/90">
                {skips}
                <span className="ml-1 text-[12px] font-normal tracking-[0.14em] text-sea-700/70">下</span>
              </p>
              <p className="mt-1.5 max-w-[80%] text-center text-[11px] leading-relaxed text-sea-800/75">{hint}</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <p className="text-[11.5px] leading-relaxed text-ink-400">
          先拖动定方向，再长按蓄力。角度越浅，石头越容易贴着水面一路弹过去。
          <span className="mt-0.5 block text-[10.5px] text-ink-300">
            ← → 调角度 · 空格长按蓄力 · R 重抛，键盘也能玩
          </span>
        </p>
        <span className="chip shrink-0">
          <Icon name="wave" size={12} />
          最多 12 下
        </span>
      </div>
    </div>
  )
}
