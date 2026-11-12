/**
 * 潮汐疗愈 · 海岛壁纸程序化生成
 *
 * 不依赖任何外部绘图 API：用 Canvas 分层绘制天空渐变、日晕、星点、云、
 * 海面光柱、岛屿与灯塔，可导出 1080×1440 PNG。
 * 同一 seed 可复现同一张图；断网仍可用，画面不出浏览器。
 */

export interface Palette {
  name: string
  sky: [string, string, string]
  glow: string
  sea: [string, string]
  island: string
  islandShade: string
  sand: string
  accent: string
  ink: string
}

export const PALETTES: Palette[] = [
  {
    name: '晨雾',
    sky: ['#cfe8f2', '#e6f0f4', '#fdf3e2'],
    glow: 'rgba(255, 236, 190, 0.95)',
    sea: ['#8fc3cf', '#cbe7e8'],
    island: '#fbf1d8',
    islandShade: '#e6d3ad',
    sand: '#f0c4a4',
    accent: '#ef9b87',
    ink: '#46656e',
  },
  {
    name: '潮汐蓝',
    sky: ['#c6e2ef', '#dce9f2', '#ece4f8'],
    glow: 'rgba(255, 246, 215, 0.92)',
    sea: ['#7cb2c6', '#c2dfe6'],
    island: '#faf0da',
    islandShade: '#e3d2ae',
    sand: '#ecc4ae',
    accent: '#a99be0',
    ink: '#3d6270',
  },
  {
    name: '暮色薰衣草',
    sky: ['#d3c9ee', '#e8dcef', '#fce4d6'],
    glow: 'rgba(255, 212, 198, 0.92)',
    sea: ['#8fa8cc', '#cdd9ec'],
    island: '#f7e7d4',
    islandShade: '#dfc6ac',
    sand: '#e6ac92',
    accent: '#f6b6a6',
    ink: '#585473',
  },
  {
    name: '沙屿',
    sky: ['#f8efd8', '#eef4ec', '#d6ecf4'],
    glow: 'rgba(255, 240, 198, 0.95)',
    sea: ['#7fbfb6', '#c8e8e0'],
    island: '#fdf3da',
    islandShade: '#e8d3ab',
    sand: '#eec59c',
    accent: '#7fb8a6',
    ink: '#566b60',
  },
]

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function smoothClosed(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  if (pts.length < 3) return
  const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  ctx.beginPath()
  const start = mid(pts[0], pts[pts.length - 1])
  ctx.moveTo(start[0], start[1])
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const m = mid(a, b)
    ctx.quadraticCurveTo(a[0], a[1], m[0], m[1])
  }
  ctx.closePath()
}

/** 小岛：圆润坡面 + 底部珊瑚色崖壁 */
function drawIsland(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  w: number,
  h: number,
  p: Palette,
) {
  const left = cx - w / 2
  const right = cx + w / 2
  const N = 80
  const bottomY = baseY + h * 0.16

  const pts: [number, number][] = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const bump = Math.pow(Math.sin(Math.PI * t), 1.35) * (0.92 + 0.08 * Math.sin(Math.PI * 3 * t + 0.5))
    pts.push([left + t * w, baseY - h * bump])
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N
    pts.push([left + t * w, bottomY + Math.pow(Math.sin(Math.PI * t), 0.8) * h * 0.14])
  }
  smoothClosed(ctx, pts)

  const g = ctx.createLinearGradient(0, baseY - h, 0, bottomY)
  g.addColorStop(0, '#fffdf4')
  g.addColorStop(0.16, p.island)
  g.addColorStop(0.68, p.island)
  g.addColorStop(0.76, p.islandShade)
  g.addColorStop(0.78, p.sand)
  g.addColorStop(1, '#caa68c')
  ctx.fillStyle = g
  ctx.fill()
  ctx.strokeStyle = 'rgba(120, 150, 150, 0.18)'
  ctx.lineWidth = 1.6
  ctx.stroke()

  // 崖壁纹理
  ctx.save()
  ctx.clip()
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.lineWidth = 1.4
  for (let i = 0; i < 3; i++) {
    const y = baseY + h * (0.055 + i * 0.055)
    ctx.beginPath()
    for (let x = left; x <= right; x += 10) {
      const yy = y + Math.sin((x - left) / 60 + i) * 2.5
      if (x === left) ctx.moveTo(x, yy)
      else ctx.lineTo(x, yy)
    }
    ctx.stroke()
  }
  ctx.restore()

  // 草丛与碎石
  for (let i = 0; i < 22; i++) {
    const t = 0.16 + Math.random() * 0.68
    const x = left + t * w
    const topY = baseY - h * Math.pow(Math.sin(Math.PI * t), 1.35) * 0.9
    const y = topY + (baseY - topY) * (0.35 + Math.random() * 0.45)
    ctx.fillStyle = `rgba(126, 170, 152, ${0.16 + Math.random() * 0.16})`
    ctx.beginPath()
    ctx.ellipse(x, y, 2.2 + Math.random() * 3.4, 1.5 + Math.random() * 1.8, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawLighthouse(ctx: CanvasRenderingContext2D, x: number, baseY: number, h: number, accent: string) {
  const w = h * 0.3
  ctx.save()
  ctx.translate(x, baseY)

  ctx.beginPath()
  ctx.moveTo(-w * 0.5, 0)
  ctx.quadraticCurveTo(-w * 0.34, -h * 0.55, -w * 0.27, -h)
  ctx.lineTo(w * 0.27, -h)
  ctx.quadraticCurveTo(w * 0.34, -h * 0.55, w * 0.5, 0)
  ctx.closePath()
  const body = ctx.createLinearGradient(-w / 2, 0, w / 2, 0)
  body.addColorStop(0, '#efe8db')
  body.addColorStop(0.38, '#ffffff')
  body.addColorStop(1, '#e2dacb')
  ctx.fillStyle = body
  ctx.fill()

  ctx.save()
  ctx.clip()
  ctx.fillStyle = accent
  ctx.globalAlpha = 0.78
  for (let i = 0; i < 2; i++) {
    const yTop = -h * (0.28 + i * 0.3)
    ctx.beginPath()
    ctx.moveTo(-w, yTop)
    ctx.lineTo(w, yTop - h * 0.15)
    ctx.lineTo(w, yTop - h * 0.02)
    ctx.lineTo(-w, yTop + h * 0.13)
    ctx.closePath()
    ctx.fill()
  }
  ctx.globalAlpha = 0.12
  ctx.fillStyle = '#4b6570'
  ctx.fillRect(w * 0.12, -h, w, h)
  ctx.restore()

  ctx.fillStyle = 'rgba(92, 112, 122, 0.5)'
  ctx.beginPath()
  ctx.arc(0, -h * 0.045, w * 0.115, Math.PI, 0)
  ctx.rect(-w * 0.115, -h * 0.045, w * 0.23, h * 0.048)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(0, -h * 0.42, w * 0.075, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#faf6ec'
  ctx.fillRect(-w * 0.42, -h * 1.05, w * 0.84, h * 0.05)
  ctx.fillStyle = 'rgba(92, 112, 122, 0.16)'
  ctx.fillRect(-w * 0.42, -h * 1.005, w * 0.84, h * 0.01)

  ctx.fillStyle = '#faf6ec'
  ctx.fillRect(-w * 0.24, -h * 1.25, w * 0.48, h * 0.205)
  const lamp = ctx.createRadialGradient(0, -h * 1.14, 0, 0, -h * 1.14, w * 0.45)
  lamp.addColorStop(0, '#fffef4')
  lamp.addColorStop(0.45, '#ffeda4')
  lamp.addColorStop(1, 'rgba(255, 233, 150, 0)')
  ctx.fillStyle = lamp
  ctx.fillRect(-w * 0.45, -h * 1.32, w * 0.9, h * 0.34)

  ctx.beginPath()
  ctx.moveTo(-w * 0.32, -h * 1.25)
  ctx.quadraticCurveTo(-w * 0.1, -h * 1.36, 0, -h * 1.47)
  ctx.quadraticCurveTo(w * 0.1, -h * 1.36, w * 0.32, -h * 1.25)
  ctx.closePath()
  ctx.fillStyle = '#f3b3a1'
  ctx.fill()

  ctx.beginPath()
  ctx.arc(0, -h * 1.49, w * 0.06, 0, Math.PI * 2)
  ctx.fillStyle = '#f9e3a2'
  ctx.fill()
  ctx.restore()
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, alpha: number) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = '#ffffff'
  const blobs: [number, number, number][] = [
    [0, 0, 32],
    [28, -9, 24],
    [54, 3, 27],
    [24, 9, 23],
    [-22, 5, 20],
  ]
  for (const [dx, dy, r] of blobs) {
    ctx.beginPath()
    ctx.ellipse(x + dx * s, y + dy * s, r * s, r * s * 0.78, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

export interface WallpaperOptions {
  width?: number
  height?: number
  palette?: Palette
  seed?: number
  quote?: string
}

export function renderWallpaper(canvas: HTMLCanvasElement, opt: WallpaperOptions = {}): void {
  const W = opt.width ?? 1080
  const H = opt.height ?? 1440
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const p = opt.palette ?? PALETTES[0]
  const rand = mulberry32(opt.seed ?? 1)
  const horizon = H * 0.615

  // 天空
  const sky = ctx.createLinearGradient(0, 0, W * 0.15, horizon)
  sky.addColorStop(0, p.sky[0])
  sky.addColorStop(0.5, p.sky[1])
  sky.addColorStop(1, p.sky[2])
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, horizon + 2)

  // 日轮与光晕
  const sx = W * (0.6 + rand() * 0.16)
  const sy = H * (0.19 + rand() * 0.06)
  const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, W * 0.52)
  halo.addColorStop(0, p.glow)
  halo.addColorStop(0.14, 'rgba(255, 246, 218, 0.62)')
  halo.addColorStop(0.42, 'rgba(255, 248, 228, 0.18)')
  halo.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, W, horizon + 40)

  const disc = ctx.createRadialGradient(sx, sy, 0, sx, sy, W * 0.075)
  disc.addColorStop(0, 'rgba(255, 252, 236, 0.95)')
  disc.addColorStop(0.6, 'rgba(255, 244, 206, 0.55)')
  disc.addColorStop(1, 'rgba(255, 244, 206, 0)')
  ctx.fillStyle = disc
  ctx.beginPath()
  ctx.arc(sx, sy, W * 0.075, 0, Math.PI * 2)
  ctx.fill()

  // 星点
  for (let i = 0; i < 54; i++) {
    const x = rand() * W
    const y = rand() * horizon * 0.68
    ctx.globalAlpha = 0.12 + rand() * 0.36
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(x, y, rand() * 1.8 + 0.5, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // 云
  drawCloud(ctx, W * 0.14, H * 0.15, 0.85, 0.5)
  drawCloud(ctx, W * 0.84, H * 0.31, 0.62, 0.36)
  drawCloud(ctx, W * 0.38, H * 0.37, 0.44, 0.26)

  // 海面（近处更亮）
  const sea = ctx.createLinearGradient(0, horizon, 0, H)
  sea.addColorStop(0, p.sea[0])
  sea.addColorStop(0.45, p.sea[0])
  sea.addColorStop(1, p.sea[1])
  ctx.fillStyle = sea
  ctx.fillRect(0, horizon, W, H - horizon)

  ctx.fillStyle = 'rgba(255,255,255,0.42)'
  ctx.fillRect(0, horizon - 1.5, W, 3)

  // 日光倒影
  for (let i = 0; i < 26; i++) {
    const t = i / 26
    const y = horizon + 8 + t * (H - horizon) * 0.52
    const halfW = W * (0.02 + t * 0.1)
    const alpha = 0.34 * (1 - t) * (0.6 + rand() * 0.7)
    ctx.fillStyle = `rgba(255, 250, 228, ${alpha})`
    ctx.beginPath()
    ctx.ellipse(sx + (rand() - 0.5) * W * 0.02, y, halfW, 2.5 + t * 4, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // 远处小岛
  ctx.globalAlpha = 0.28
  ctx.fillStyle = p.islandShade
  ctx.beginPath()
  ctx.ellipse(W * 0.13, horizon + 14, W * 0.16, H * 0.024, 0, Math.PI, 0)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(W * 0.9, horizon + 18, W * 0.12, H * 0.018, 0, Math.PI, 0)
  ctx.fill()
  ctx.globalAlpha = 1

  // 主岛
  const cx = W * (0.47 + rand() * 0.06)
  const baseY = horizon + H * 0.075
  const islandW = W * 0.52
  const islandH = H * 0.15

  const shadow = ctx.createRadialGradient(cx, baseY + islandH * 0.3, 0, cx, baseY + islandH * 0.3, islandW * 0.62)
  shadow.addColorStop(0, 'rgba(40, 84, 100, 0.16)')
  shadow.addColorStop(1, 'rgba(40, 84, 100, 0)')
  ctx.fillStyle = shadow
  ctx.beginPath()
  ctx.ellipse(cx, baseY + islandH * 0.3, islandW * 0.62, islandH * 0.42, 0, 0, Math.PI * 2)
  ctx.fill()

  drawIsland(ctx, cx, baseY, islandW, islandH, p)
  drawLighthouse(ctx, cx + W * 0.004, baseY - islandH * 0.94, H * 0.15, p.accent)

  // 塔灯光芒
  const beam = ctx.createRadialGradient(
    cx,
    baseY - islandH - H * 0.13,
    0,
    cx,
    baseY - islandH - H * 0.13,
    W * 0.22,
  )
  beam.addColorStop(0, 'rgba(255, 243, 196, 0.45)')
  beam.addColorStop(1, 'rgba(255, 243, 196, 0)')
  ctx.fillStyle = beam
  ctx.beginPath()
  ctx.arc(cx, baseY - islandH - H * 0.13, W * 0.22, 0, Math.PI * 2)
  ctx.fill()

  // 海面波纹
  for (let i = 0; i < 42; i++) {
    const depth = Math.pow(rand(), 0.65)
    const y = horizon + 22 + depth * (H - horizon - 34)
    const len = 24 + rand() * 110
    const x = rand() * W
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.06 + depth * 0.2})`
    ctx.lineWidth = 0.8 + depth * 1.8
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(x + len / 2, y - 2 - depth * 2.5, x + len, y)
    ctx.stroke()
  }

  // 前景浪带
  for (let layer = 0; layer < 3; layer++) {
    const yBase = horizon + (H - horizon) * (0.62 + layer * 0.14)
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.12 + layer * 0.05})`
    ctx.lineWidth = 1.2 + layer
    ctx.beginPath()
    for (let x = 0; x <= W; x += 10) {
      const y = yBase + Math.sin(x / (110 + layer * 50) + layer * 1.7) * (3 + layer * 2.5)
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  // 暗角
  const vig = ctx.createRadialGradient(W / 2, H * 0.44, H * 0.2, W / 2, H * 0.44, H * 0.86)
  vig.addColorStop(0, 'rgba(255,255,255,0)')
  vig.addColorStop(1, 'rgba(52, 84, 100, 0.18)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, W, H)

  // 文案
  if (opt.quote) {
    ctx.save()
    ctx.fillStyle = p.ink
    ctx.globalAlpha = 0.62
    ctx.font = `300 ${Math.round(W * 0.037)}px "Songti SC", "Source Han Serif SC", serif`
    ctx.textAlign = 'center'
    ctx.fillText(opt.quote, W / 2, H * 0.925)
    ctx.globalAlpha = 0.28
    ctx.font = `300 ${Math.round(W * 0.016)}px "Songti SC", serif`
    ctx.fillText('S E R E N E   I S L E', W / 2, H * 0.952)
    ctx.restore()
  }

  // 颗粒
  const grain = ctx.getImageData(0, 0, W, H)
  const d = grain.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 8
    d[i] += n
    d[i + 1] += n
    d[i + 2] += n
  }
  ctx.putImageData(grain, 0, 0)
}

export const WALLPAPER_QUOTES = [
  '停泊情绪风浪，从容奔赴考场',
  '你不需要一直坚强，只需要被好好接住',
  '慢一点也没关系，潮水从不催促礁石',
  '把今天过完，就已经很了不起',
]
