import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KNOWLEDGE_DOCS } from '../lib/knowledge'
import { MOMENTS, loadMoment, saveMoment, type Moment } from '../lib/moment'
import { useAppStore } from '../store/useAppStore'
import { Icon } from './Icons'

type SpotId = 'light' | 'library' | 'tide' | 'play' | 'lookout' | 'harbor'

type Spot = {
  id: SpotId
  index: string
  name: string
  en: string
  to: string
  x: number
  y: number
  lx: number
  ly: number
  anchor: 'start' | 'middle' | 'end'
  tagline: string
  points: string[]
  meta: string
  action: 'chat' | 'read' | 'breathe' | 'game' | 'chart' | 'call' | 'about'
}

const SPOTS: Spot[] = [
  {
    id: 'light',
    index: '01',
    name: '灯塔 · 岛主',
    en: 'The Keeper',
    to: '/chat',
    x: 432,
    y: 214,
    lx: 432,
    ly: 128,
    anchor: 'middle',
    tagline: '夜里一直亮着的那盏灯，专门用来接住说不出口的话。',
    points: [
      '先接住情绪，再谈方法——不会一上来就给你列计划表。',
      '会自己检索知识库、调用呼吸与自评工具，调用过程对你完全可见。',
      '断网或没填 Key 时自动切成离线知识模式，仍然能聊。',
    ],
    meta: 'Agent · Function Calling',
    action: 'chat',
  },
  {
    id: 'lookout',
    index: '02',
    name: '观测台',
    en: 'The Lookout',
    to: '/mood',
    x: 528,
    y: 266,
    lx: 582,
    ly: 262,
    anchor: 'start',
    tagline: '把每天的情绪画成一条线，你才看得见自己其实在往前走。',
    points: [
      '1—5 分潮位打卡，配 8 个常用标签，10 秒记完。',
      '7 天 / 30 天趋势、分布、周对比与连续记录天数。',
      'GAD-7 自评量表，给出分级建议而不是一个吓人的分数。',
    ],
    meta: '数据可视化 · GAD-7',
    action: 'chart',
  },
  {
    id: 'library',
    index: '03',
    name: '分享小屋',
    en: 'The Share Hut',
    to: '/library',
    x: 286,
    y: 320,
    lx: 292,
    ly: 370,
    anchor: 'middle',
    tagline: '一排木架上放着岛民自己写的书，翻开能读，也能留一张便签。',
    points: [
      '写一本自己的小书：选一个情绪、写下此刻，再像做手账一样设计封面。',
      '点开别人的书读内页，留一张带胶带的暖心便签；收到的回复会进我的书架。',
      '每本书可设公开或私密；岛主的科普知识库也在这一页的另一栏里。',
    ],
    meta: 'RAG · 本地检索',
    action: 'read',
  },
  {
    id: 'tide',
    index: '04',
    name: '潮汐湾',
    en: 'Tide Cove',
    to: '/calm',
    x: 232,
    y: 418,
    lx: 282,
    ly: 430,
    anchor: 'start',
    tagline: '海水一来一回，你只要跟着它呼吸，不用想别的。',
    points: [
      '4-7-8 / 4-4-4-4 / 谐振呼吸三种节奏，球体随相位缩放。',
      '正念脚本可朗读（TTS），还能挑一张手绘明信片当锁屏。',
      '呼气比吸气长，是让心率慢下来的关键。',
    ],
    meta: '多模态 · 呼吸 / TTS / 明信片',
    action: 'breathe',
  },
  {
    id: 'harbor',
    index: '05',
    name: '避风港',
    en: 'Safe Harbor',
    to: '/harbor',
    x: 186,
    y: 470,
    lx: 192,
    ly: 486,
    anchor: 'middle',
    tagline: '当风浪真的太大时，这里只做一件事：把你交给能接住你的人。',
    points: [
      '三级风险识别，对"好累""撑不住"这类表达做了误报过滤。',
      '全国统一心理援助热线 12356，以及校心理中心、急诊的正确用法。',
      '可以填写自己的安全计划：联系人、去处、让自己稳下来的三件事。',
    ],
    meta: '危机干预 · 安全兜底',
    action: 'call',
  },
  {
    id: 'play',
    index: '06',
    name: '乐园沙滩',
    en: 'Play Shore',
    to: '/play',
    x: 590,
    y: 398,
    lx: 596,
    ly: 460,
    anchor: 'middle',
    tagline: '四个不费脑子的解压小游戏，专门给"学不进去"的那半小时。',
    points: [
      '潮汐泡泡、沙岸拾贝、打水漂、星光许愿，全部本地运行。',
      '玩完可以把当下的情绪顺手记一笔，变成潮向图上的一个点。',
      '没有排行榜、没有连续打卡压力，随时退出都可以。',
    ],
    meta: 'Canvas · 即时反馈',
    action: 'game',
  },
]

const TREES: { x: number; y: number; r: number; tone: string }[] = [
  { x: 356, y: 246, r: 10, tone: '#a2cbb3' },
  { x: 382, y: 264, r: 7.5, tone: '#93bfa8' },
  { x: 334, y: 274, r: 8.5, tone: '#a2cbb3' },
  { x: 312, y: 240, r: 7, tone: '#b1d4be' },
  { x: 466, y: 196, r: 8.5, tone: '#a2cbb3' },
  { x: 492, y: 214, r: 6.5, tone: '#93bfa8' },
  { x: 510, y: 194, r: 7.5, tone: '#b1d4be' },
  { x: 346, y: 302, r: 9, tone: '#a2cbb3' },
  { x: 318, y: 322, r: 7, tone: '#b1d4be' },
  { x: 372, y: 334, r: 7.5, tone: '#93bfa8' },
  { x: 474, y: 302, r: 8, tone: '#a2cbb3' },
  { x: 500, y: 320, r: 6.5, tone: '#b1d4be' },
  { x: 524, y: 302, r: 7, tone: '#93bfa8' },
  { x: 616, y: 306, r: 8, tone: '#a2cbb3' },
  { x: 634, y: 328, r: 6.5, tone: '#b1d4be' },
  { x: 598, y: 338, r: 7, tone: '#93bfa8' },
  { x: 296, y: 394, r: 8, tone: '#a2cbb3' },
  { x: 320, y: 412, r: 6.5, tone: '#b1d4be' },
  { x: 364, y: 424, r: 7.5, tone: '#93bfa8' },
  { x: 396, y: 440, r: 7, tone: '#a2cbb3' },
  { x: 428, y: 430, r: 6, tone: '#b1d4be' },
  { x: 458, y: 446, r: 7, tone: '#93bfa8' },
  { x: 478, y: 428, r: 6, tone: '#a2cbb3' },
  { x: 544, y: 382, r: 7, tone: '#b1d4be' },
  { x: 556, y: 404, r: 6, tone: '#93bfa8' },
  { x: 264, y: 336, r: 7, tone: '#a2cbb3' },
  { x: 240, y: 360, r: 6, tone: '#b1d4be' },
  { x: 214, y: 382, r: 6.5, tone: '#93bfa8' },
]

function Tree({ x, y, r, tone }: { x: number; y: number; r: number; tone: string }) {
  return (
    <g pointerEvents="none">
      <ellipse cx={x + 1.5} cy={y + r * 1.02} rx={r * 1.15} ry={r * 0.36} fill="rgba(88,132,110,0.14)" />
      <rect x={x - 1.3} y={y + r * 0.2} width="2.6" height={r * 0.78} rx={1.2} fill="#c0a37c" opacity={0.5} />
      <circle cx={x} cy={y} r={r} fill={tone} />
      <circle cx={x - r * 0.32} cy={y - r * 0.34} r={r * 0.5} fill="rgba(255,255,255,0.34)" />
      <circle cx={x + r * 0.36} cy={y + r * 0.28} r={r * 0.34} fill="rgba(90,140,120,0.1)" />
    </g>
  )
}

/** 地图视野（对应 SVG viewBox） */
const VIEW = { x: 146, y: 104, w: 574, h: 424 }
const MAX_ZOOM = 2.4

/** 岛屿俯瞰图：可点选的地点，先看内容再决定去哪 */
export function IslandAtlas() {
  // 从副页面回到地图时，恢复上次停下的那一处，不用重新找
  const [active, setActive] = useState<SpotId>(() => {
    try {
      const saved = sessionStorage.getItem('sereneisle.atlas.active')
      if (saved && SPOTS.some((s) => s.id === saved)) return saved as SpotId
    } catch {
      /* 隐私模式下忽略 */
    }
    return 'light'
  })
  const [hover, setHover] = useState<SpotId | null>(null)
  const [moment, setMoment] = useState<Moment>('noon')
  const [quote, setQuote] = useState(0)
  const [zoom, setZoom] = useState(1)
  const navigate = useNavigate()
  const openBreathing = useAppStore((s) => s.openBreathing)

  const stageRef = useRef<HTMLDivElement | null>(null)
  const layerRef = useRef<HTMLDivElement | null>(null)
  const cam = useRef({ x: 0, y: 0, k: 1 })
  const goal = useRef({ x: 0, y: 0, k: 1 })
  const rafRef = useRef(0)
  const drag = useRef({ on: false, sx: 0, sy: 0, ox: 0, oy: 0, moved: 0 })

  useEffect(() => {
    setMoment(loadMoment())
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem('sereneisle.atlas.active', active)
    } catch {
      /* 隐私模式下忽略 */
    }
  }, [active])

  const spot = useMemo(() => SPOTS.find((s) => s.id === active) ?? SPOTS[0], [active])
  const doc = KNOWLEDGE_DOCS[quote % KNOWLEDGE_DOCS.length]

  const applyCam = useCallback(() => {
    const el = layerRef.current
    if (!el) return
    el.style.transform = `translate3d(${cam.current.x.toFixed(2)}px, ${cam.current.y.toFixed(2)}px, 0) scale(${cam.current.k.toFixed(4)})`
    el.style.setProperty('--inv', (1 / cam.current.k).toFixed(4))
  }, [])

  const clampPan = useCallback((x: number, y: number, k: number) => {
    const r = stageRef.current?.getBoundingClientRect()
    const w = r?.width ?? 600
    const h = r?.height ?? 440
    const mx = (w * (k - 1)) / 2 + 8
    const my = (h * (k - 1)) / 2 + 8
    return { x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) }
  }, [])

  /** 惯性插值：拖动时 1:1，按钮与滚轮缩放时柔和过渡 */
  const animateCam = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    layerRef.current?.classList.add('is-moving')
    const step = () => {
      const c = cam.current
      const g = goal.current
      c.x += (g.x - c.x) * 0.24
      c.y += (g.y - c.y) * 0.24
      c.k += (g.k - c.k) * 0.24
      applyCam()
      if (Math.abs(g.x - c.x) > 0.35 || Math.abs(g.y - c.y) > 0.35 || Math.abs(g.k - c.k) > 0.0015) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        cam.current = { ...g }
        applyCam()
        layerRef.current?.classList.remove('is-moving')
      }
    }
    rafRef.current = requestAnimationFrame(step)
  }, [applyCam])

  const zoomTo = useCallback(
    (next: number) => {
      const k = Math.max(1, Math.min(MAX_ZOOM, Number(next.toFixed(2))))
      const ratio = goal.current.k === 0 ? 1 : k / goal.current.k
      const p = clampPan(goal.current.x * ratio, goal.current.y * ratio, k)
      goal.current = { ...p, k }
      if (k === 1) goal.current = { x: 0, y: 0, k: 1 }
      setZoom(k)
      animateCam()
    },
    [animateCam, clampPan]
  )

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  const pickMoment = (m: Moment) => {
    setMoment(m)
    saveMoment(m)
  }

  const enter = () => {
    if (spot.action === 'breathe') {
      openBreathing('478')
      return
    }
    navigate(spot.to)
  }

  const pick = useCallback((id: SpotId) => {
    // 拖动地图时不要误选地点
    if (drag.current.moved > 8) {
      drag.current.moved = 0
      return
    }
    setActive(id)
  }, [])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    // 只记录起点，不抢指针：否则捕获后 click 会落到容器上，按钮点不动
    drag.current = { on: true, sx: e.clientX, sy: e.clientY, ox: goal.current.x, oy: goal.current.y, moved: 0 }
  }

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current
      if (!d.on) return
      const dx = e.clientX - d.sx
      const dy = e.clientY - d.sy
      d.moved = Math.max(d.moved, Math.abs(dx) + Math.abs(dy))
      if (d.moved < 4) return
      stageRef.current?.classList.add('is-dragging')
      layerRef.current?.classList.add('is-moving')
      const p = clampPan(d.ox + dx, d.oy + dy, goal.current.k)
      goal.current = { ...goal.current, ...p }
      cam.current.x = p.x
      cam.current.y = p.y
      applyCam()
    }
    const up = () => {
      drag.current.on = false
      stageRef.current?.classList.remove('is-dragging')
      layerRef.current?.classList.remove('is-moving')
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [applyCam, clampPan])

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // 只有按住 Ctrl / ⌘ 才缩放，避免劫持页面滚动
    if (!(e.ctrlKey || e.metaKey)) return
    e.preventDefault()
    zoomTo(goal.current.k * (e.deltaY > 0 ? 0.92 : 1.08))
  }

  const spotProps = (id: SpotId, label: string) => ({
    className: 'atlas-spot',
    'data-active': active === id,
    onClick: () => pick(id),
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': label,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setActive(id)
      }
    },
  })

  return (
    <div id="atlas" className="grid scroll-mt-24 items-stretch gap-4 lg:grid-cols-[1.52fr_1fr]">
      {/* ── 地图 ── */}
      <div className="relative overflow-hidden rounded-5xl border border-white/70 bg-white/40 shadow-soft backdrop-blur-sm">
        {/* 海图角标，给整块地图一个"图鉴"的画框感 */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-2.5 z-20">
          <span className="absolute left-0 top-0 h-4 w-4 rounded-tl-md border-l border-t border-sea-400/70" />
          <span className="absolute right-0 top-0 h-4 w-4 rounded-tr-md border-r border-t border-sea-400/70" />
          <span className="absolute bottom-0 left-0 h-4 w-4 rounded-bl-md border-b border-l border-sea-400/70" />
          <span className="absolute bottom-0 right-0 h-4 w-4 rounded-br-md border-b border-r border-sea-400/70" />
        </div>
        <div className="flex items-start justify-between gap-3 px-5 pb-1 pt-4">
          <div>
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.26em] text-sea-500">Island Atlas</p>
            <p className="mt-1 font-display text-[14px] font-semibold tracking-tight text-ink-900">点一处，看看那里有什么</p>
            <p className="mt-0.5 hidden text-[9.5px] tracking-wide text-ink-300 sm:block">
              拖动平移 · ⌘/Ctrl 滚轮缩放 · 双击放大
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1 rounded-full border border-white/80 bg-white/70 p-1 backdrop-blur">
            {MOMENTS.map((m) => (
              <button
                key={m.id}
                onClick={() => pickMoment(m.id)}
                title={`${m.label} ${m.time}`}
                aria-label={`切换到${m.label}`}
                aria-pressed={moment === m.id}
                className={`relative h-5 w-5 rounded-full transition ${
                  moment === m.id ? 'scale-100' : 'scale-90 opacity-60 hover:opacity-100'
                }`}
              >
                <span
                  className="absolute inset-[2.5px] rounded-full"
                  style={{ background: `linear-gradient(135deg, ${m.from}, ${m.to})` }}
                />
                {moment === m.id && (
                  <motion.span
                    layoutId="moment-ring"
                    className="absolute inset-0 rounded-full ring-[1.5px] ring-white"
                    style={{ boxShadow: '0 0 0 1px rgba(58,123,141,0.3)' }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        <div
          ref={stageRef}
          onPointerDown={onPointerDown}
          onWheel={onWheel}
          onDoubleClick={() => zoomTo(zoom > 1.05 ? 1 : 1.9)}
          className="atlas-stage relative touch-pan-y overflow-hidden"
        >
          <div ref={layerRef} className="atlas-layer">
            {useMemo(
              () => (
        <svg
          viewBox="146 104 574 424"
          className="w-full select-none"
          role="img"
          aria-label="清绪之屿全景地图：灯塔、分享小屋、潮汐湾、乐园沙滩、观测台与避风港"
        >
          <defs>
            <linearGradient id="atlas-sea" x1="0.1" y1="0" x2="0.5" y2="1">
              <stop offset="0" stopColor="#eaf7fa" />
              <stop offset="0.48" stopColor="#d8edf4" />
              <stop offset="1" stopColor="#c3e1ea" />
            </linearGradient>
            <linearGradient id="atlas-sand" x1="0.2" y1="0" x2="0.55" y2="1">
              <stop offset="0" stopColor="#fdf5e6" />
              <stop offset="0.6" stopColor="#f6e9d2" />
              <stop offset="1" stopColor="#ecdcc0" />
            </linearGradient>
            <linearGradient id="atlas-grass" x1="0.15" y1="0" x2="0.5" y2="1">
              <stop offset="0" stopColor="#e3f2e6" />
              <stop offset="0.55" stopColor="#cfe8d8" />
              <stop offset="1" stopColor="#bcdcc9" />
            </linearGradient>
            <radialGradient id="atlas-lamp">
              <stop offset="0" stopColor="#fff6d4" stopOpacity="0.95" />
              <stop offset="0.42" stopColor="#ffe9a8" stopOpacity="0.42" />
              <stop offset="1" stopColor="#ffe9a8" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="atlas-glow">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
            <filter id="atlas-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#4a7d8c" floodOpacity="0.16" />
            </filter>
            <filter id="atlas-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#5b7d74" floodOpacity="0.18" />
            </filter>
          </defs>

          {/* 海面 */}
          <rect x="100" y="60" width="700" height="530" fill="url(#atlas-sea)" />

          {/* 海面波纹 */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <path
              key={i}
              d={`M${120 + i * 18} ${486 + i * 16} q 44 -7 88 0 t 88 0 t 88 0 t 88 0 t 88 0 t 88 0`}
              stroke="rgba(255,255,255,0.55)"
              strokeWidth={1.1}
              fill="none"
              opacity={0.5 - i * 0.06}
            />
          ))}
          <ellipse cx="434" cy="318" rx="270" ry="180" fill="url(#atlas-glow)" opacity="0.4" />

          {/* 远处的礁屿 */}
          <g opacity="0.7">
            <path
              d="M652 168 C 660 152 682 146 696 156 C 710 168 708 186 692 192 C 674 200 650 190 652 172 Z"
              fill="#dcebd9"
              stroke="#c6ddcb"
              strokeWidth="1"
            />
            <path d="M678 176 C 684 168 694 168 698 174 C 702 180 696 186 688 185 C 680 184 675 181 678 176 Z" fill="#cbe2d2" />
          </g>
          <g opacity="0.42">
            <path d="M180 140 C 190 132 204 134 209 143 C 214 152 205 159 194 157 C 183 155 176 148 180 140 Z" fill="#e4efe0" />
          </g>

          {/* 岸边泡沫 */}
          <g opacity="0.6">
            {[0, 1].map((i) => (
              <path
                key={i}
                d="M196 322 C 200 256 252 194 332 170 C 402 149 472 158 532 184 C 592 210 642 256 658 318
                   C 674 380 628 440 558 464 C 488 488 398 486 318 462 C 250 442 192 388 196 322 Z"
                fill="none"
                stroke="rgba(255,255,255,0.85)"
                strokeWidth={2 - i * 0.7}
                transform={`translate(434,320) scale(${1.022 + i * 0.022}) translate(-434,-320)`}
              />
            ))}
          </g>

          {/* 沙滩层 */}
          {/* 阴影用两层偏移路径代替 SVG 滤镜：缩放时不再逐帧重算高斯模糊 */}
          <path d="M196 322 C 200 256 252 194 332 170 C 402 149 472 158 532 184 C 592 210 642 256 658 318
               C 674 380 628 440 558 464 C 488 488 398 486 318 462 C 250 442 192 388 196 322 Z" fill="rgba(84,132,144,0.10)" transform="translate(0,16)" />
          <path d="M196 322 C 200 256 252 194 332 170 C 402 149 472 158 532 184 C 592 210 642 256 658 318
               C 674 380 628 440 558 464 C 488 488 398 486 318 462 C 250 442 192 388 196 322 Z" fill="rgba(84,132,144,0.13)" transform="translate(0,9)" />
          <path d="M196 322 C 200 256 252 194 332 170 C 402 149 472 158 532 184 C 592 210 642 256 658 318
               C 674 380 628 440 558 464 C 488 488 398 486 318 462 C 250 442 192 388 196 322 Z" fill="url(#atlas-sand)" />
          {/* 草地层 */}
          <path
            d="M220 322 C 224 264 270 210 342 188 C 406 168 470 176 526 200 C 580 224 624 266 638 320
               C 652 374 612 422 550 444 C 486 466 404 464 332 442 C 272 424 216 376 220 322 Z"
            fill="url(#atlas-grass)"
          />

          {/* 高地 */}
          <ellipse cx="506" cy="256" rx="102" ry="56" fill="#c3dfcd" opacity="0.55" />
          <ellipse cx="516" cy="246" rx="80" ry="42" fill="#b9d9c6" opacity="0.4" />
          <ellipse cx="330" cy="288" rx="70" ry="40" fill="#c9e4d4" opacity="0.5" />
          <ellipse cx="392" cy="398" rx="92" ry="44" fill="#cbe5d5" opacity="0.38" />

          {/* 等高线 */}
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              d={`M${396 + i * 13} ${266 - i * 5} q 44 -24 88 -4 t 58 32`}
              fill="none"
              stroke="rgba(132,176,154,0.28)"
              strokeWidth={0.9}
            />
          ))}

          {/* 沙滩上的贝壳与石子 */}
          {[
            [268, 348],
            [244, 396],
            [300, 438],
            [352, 466],
            [442, 470],
            [508, 452],
            [566, 434],
            [618, 400],
            [640, 352],
            [596, 214],
            [520, 180],
            [416, 162],
            [330, 180],
            [252, 232],
            [214, 288],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.6 : 1.1} fill="rgba(190,160,120,0.35)" />
          ))}

          {/* 小径 */}
          <path
            d="M432 254 C 396 272 352 296 316 316 C 292 330 268 368 250 398"
            fill="none"
            stroke="#efe3c8"
            strokeWidth={5}
            strokeLinecap="round"
            opacity={0.95}
          />
          <path
            d="M432 254 C 470 264 506 268 526 284 C 552 306 574 352 588 380"
            fill="none"
            stroke="#efe3c8"
            strokeWidth={5}
            strokeLinecap="round"
            opacity={0.95}
          />
          <path
            d="M432 254 C 428 294 422 330 412 348"
            fill="none"
            stroke="#efe3c8"
            strokeWidth={4}
            strokeLinecap="round"
            opacity={0.9}
          />
          <path
            d="M316 316 C 288 350 268 388 244 410"
            fill="none"
            stroke="#efe3c8"
            strokeWidth={3.6}
            strokeLinecap="round"
            strokeDasharray="1 9"
            opacity={0.7}
          />

          {TREES.map((t, i) => (
            <Tree key={i} {...t} />
          ))}

          {/* 草丛 */}
          {[
            [300, 262],
            [330, 236],
            [500, 348],
            [470, 366],
            [560, 330],
            [590, 356],
            [380, 380],
            [270, 410],
            [340, 300],
            [600, 262],
          ].map(([x, y], i) => (
            <g key={i} opacity="0.5">
              <path d={`M${x} ${y} q -4 -6 -1 -10`} stroke="#8fbfa4" strokeWidth={1.1} fill="none" strokeLinecap="round" />
              <path d={`M${x + 4} ${y} q 1 -8 5 -10`} stroke="#8fbfa4" strokeWidth={1.1} fill="none" strokeLinecap="round" />
              <path d={`M${x + 8} ${y} q 4 -5 8 -6`} stroke="#8fbfa4" strokeWidth={1} fill="none" strokeLinecap="round" />
            </g>
          ))}

          {/* ── 灯塔 ── */}
          <g transform="translate(432,214)">
            <g {...spotProps('light', '灯塔 · 岛主对话')}>
              <circle className="atlas-ring" r="46" fill="none" stroke="rgba(74,151,170,0.4)" strokeWidth="1.2" strokeDasharray="3 5" />
              <ellipse cx="0" cy="6" rx="24" ry="8" fill="rgba(88,132,110,0.16)" />
              <circle r="60" fill="url(#atlas-lamp)" opacity="0.5" />
              <path d="M-9 4 L-5.5 -46 L5.5 -46 L9 4 Z" fill="#fffdf7" stroke="#d7cbb9" strokeWidth="1.1" />
              <path d="M-8.4 -26 L8.4 -26 L8.9 -13 L-8.9 -13 Z" fill="#ef9b87" />
              <path d="M-6.6 -41 L6.6 -41 L7.1 -31 L-7.1 -31 Z" fill="#ef9b87" />
              <path d="M-3 4 L-3 -4 q 3 -3 6 0 L3 4 Z" fill="#cfc0aa" opacity={0.75} />
              <rect x="-6.5" y="-52" width="13" height="7" rx="2" fill="#5f7280" />
              <circle cx="0" cy="-48.5" r="4" fill="#fff3c6" />
              <circle cx="0" cy="-48.5" r="9" fill="#fff3c6" opacity="0.4" />
              <path d="M-8 -52 L0 -60 L8 -52 Z" fill="#7f9fc4" />
              <circle cx="0" cy="-61" r="1.6" fill="#ffe9a8" />
            </g>
          </g>

          {/* ── 观测台 ── */}
          <g transform="translate(528,266)">
            <g {...spotProps('lookout', '观测台')}>
              <circle className="atlas-ring" r="32" fill="none" stroke="rgba(250,214,150,0.65)" strokeWidth="1.2" strokeDasharray="3 5" />
              <ellipse cx="0" cy="12" rx="20" ry="6" fill="rgba(88,132,110,0.16)" />
              <path d="M-16 12 L16 12 L13 8 L-13 8 Z" fill="#efe6d5" />
              <path d="M-13 8 L13 8 L10 4 L-10 4 Z" fill="#f6efe0" />
              <path d="M-10 4 L-8 -8 L8 -8 L10 4 Z" fill="#fdfaf3" stroke="#e2d6c3" strokeWidth="1" />
              <path d="M-9 -8 A 9 9 0 0 1 9 -8 Z" fill="#7f9fc4" />
              <path d="M-9 -8 A 9 9 0 0 1 9 -8 Z" fill="none" stroke="#6d8db3" strokeWidth="0.8" />
              <g transform="translate(6,-10) rotate(-30)">
                <rect x="0" y="-2.4" width="20" height="4.8" rx="2.4" fill="#59707e" />
                <rect x="17" y="-3.4" width="5" height="6.8" rx="1.8" fill="#94cdd9" stroke="#7cb8c8" strokeWidth="0.6" />
              </g>
            </g>
          </g>

          {/* ── 分享小屋 ── */}
          <g transform="translate(286,320)">
            <g {...spotProps('library', '分享小屋')}>
              <circle className="atlas-ring" r="40" fill="none" stroke="rgba(169,155,224,0.45)" strokeWidth="1.2" strokeDasharray="3 5" />
              <ellipse cx="0" cy="10" rx="30" ry="9" fill="rgba(88,132,110,0.16)" />
              <rect x="-23" y="-16" width="46" height="26" rx="2.5" fill="#fdfaf3" stroke="#e0d3bd" strokeWidth="1" />
              <path d="M-28 -16 L0 -36 L28 -16 Z" fill="#b8a8e0" />
              <path d="M-28 -16 L0 -36 L28 -16 Z" fill="none" stroke="#a495d6" strokeWidth="1" />
              <rect x="-5.5" y="-3" width="11" height="13" rx="1.6" fill="#efe3cd" stroke="#e0d3bd" strokeWidth="0.6" />
              <rect x="-17" y="-10" width="8" height="8" rx="1.2" fill="#fff2c4" stroke="#e8d9b8" strokeWidth="0.8" />
              <rect x="9" y="-10" width="8" height="8" rx="1.2" fill="#fff2c4" stroke="#e8d9b8" strokeWidth="0.8" />
              <rect x="14" y="-32" width="5" height="11" rx="1.5" fill="#d9cfc0" />
              <circle cx="16.5" cy="-35" r="2.6" fill="#f7ebd6" opacity="0.85" />
              <circle cx="20" cy="-40" r="2" fill="#f7ebd6" opacity="0.6" />
              <g transform="translate(-26,6)">
                <rect x="0" y="0" width="9" height="3.4" rx="1" fill="#c9bce9" />
                <rect x="1" y="-3.4" width="8" height="3.4" rx="1" fill="#a9cfe0" />
                <rect x="0.5" y="-6.8" width="7" height="3.4" rx="1" fill="#f2cfc1" />
              </g>
            </g>
          </g>

          {/* ── 岛心的一小片野花与碎石 ── */}
          <g pointerEvents="none">
            <ellipse cx="410" cy="358" rx="30" ry="12" fill="rgba(96,150,120,0.16)" />
            {([
              [396, 352, 2.6, '#eeb49f'],
              [404, 361, 1.9, '#bda9e6'],
              [415, 351, 2.2, '#f3d488'],
              [423, 361, 1.8, '#eeb49f'],
              [409, 366, 1.6, '#ffffff'],
              [431, 354, 1.5, '#bda9e6'],
              [400, 366, 1.4, '#f3d488'],
            ] as const).map(([x, y, r, c]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={c} />
            ))}
            <circle cx="389" cy="363" r="4" fill="#9fc4ac" />
            <circle cx="434" cy="366" r="3.2" fill="#aecfba" />
          </g>

          {/* ── 潮汐湾 ── */}
          <g transform="translate(232,418)">
            <g {...spotProps('tide', '潮汐湾')}>
              <circle className="atlas-ring" r="36" fill="none" stroke="rgba(74,151,170,0.42)" strokeWidth="1.2" strokeDasharray="3 5" />
              <path d="M-28 0 C -24 -15 8 -19 23 -10 C 36 -3 32 13 15 17 C -2 21 -30 16 -28 0 Z" fill="#bfe2ea" stroke="#a5d1dc" strokeWidth="1.2" />
              <path d="M-25 4 q 13 -5 26 -1 t 24 -1" stroke="#ffffff" strokeWidth="1.5" fill="none" opacity="0.9" />
              <path d="M-23 10 q 12 -4 24 0 t 22 -1" stroke="#ffffff" strokeWidth="1.1" fill="none" opacity="0.6" />
              <ellipse cx="-17" cy="-11" rx="4.2" ry="3" fill="#d9d3c6" />
              <ellipse cx="19" cy="11" rx="3.4" ry="2.6" fill="#ddd7ca" />
              <ellipse cx="3" cy="-14" rx="2.8" ry="2.2" fill="#e3dcd0" />
              <ellipse cx="-6" cy="14" rx="6" ry="2.4" fill="#d3ecf1" opacity="0.9" />
            </g>
          </g>

          {/* ── 乐园沙滩 ── */}
          <g transform="translate(590,398)">
            <g {...spotProps('play', '乐园沙滩')}>
              <circle className="atlas-ring" r="42" fill="none" stroke="rgba(239,155,135,0.45)" strokeWidth="1.2" strokeDasharray="3 5" />
              <ellipse cx="0" cy="22" rx="32" ry="9" fill="rgba(88,132,110,0.14)" />
              <path d="M-16 22 L0 -2 L16 22" fill="none" stroke="#cfd8dd" strokeWidth="2.6" strokeLinejoin="round" />
              <path d="M-9 22 L0 8 L9 22" fill="none" stroke="#dfe6ea" strokeWidth="1.6" />
              <g transform="translate(0,-14)">
                <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="34s" repeatCount="indefinite" additive="sum" />
                <circle r="20" fill="none" stroke="#f0b7a3" strokeWidth="2.4" />
                <circle r="20" fill="none" stroke="#ffffff" strokeWidth="0.8" strokeDasharray="2 6" opacity="0.8" />
                {[0, 60, 120, 180, 240, 300].map((deg) => (
                  <line
                    key={deg}
                    x1={-20 * Math.cos((deg * Math.PI) / 180)}
                    y1={-20 * Math.sin((deg * Math.PI) / 180)}
                    x2={20 * Math.cos((deg * Math.PI) / 180)}
                    y2={20 * Math.sin((deg * Math.PI) / 180)}
                    stroke="#f3c3b2"
                    strokeWidth="1.1"
                  />
                ))}
                {[0, 60, 120, 180, 240, 300].map((deg) => (
                  <circle
                    key={deg}
                    cx={20 * Math.cos((deg * Math.PI) / 180)}
                    cy={20 * Math.sin((deg * Math.PI) / 180)}
                    r="3.2"
                    fill="#ffffff"
                    stroke="#ef9b87"
                    strokeWidth="1.5"
                  />
                ))}
              </g>
              <circle cx="0" cy="-14" r="2.6" fill="#e37f69" />
              <g transform="translate(-24,20)">
                <circle r="4.6" fill="#ffffff" stroke="#efb6a6" strokeWidth="1" />
                <path d="M-4.6 0 A 4.6 4.6 0 0 1 4.6 0 Z" fill="#f8c9b6" />
                <path d="M0 -4.6 L0 0" stroke="#efb6a6" strokeWidth="0.8" />
              </g>
            </g>
          </g>

          {/* ── 避风港 ── */}
          <g transform="translate(186,470)">
            <g {...spotProps('harbor', '避风港')}>
              <circle className="atlas-ring" r="34" fill="none" stroke="rgba(239,155,135,0.5)" strokeWidth="1.2" strokeDasharray="3 5" />
              <g opacity="0.95">
                <rect x="8" y="-2" width="52" height="4.4" rx="1.8" fill="#e6dac4" />
                <rect x="12" y="2.4" width="3" height="9" fill="#d6c6ab" />
                <rect x="26" y="2.4" width="3" height="9" fill="#d6c6ab" />
                <rect x="40" y="2.4" width="3" height="9" fill="#d6c6ab" />
                <rect x="54" y="2.4" width="3" height="9" fill="#d6c6ab" />
              </g>
              <g transform="translate(2,6)">
                <path d="M-15 0 q 15 10 30 0 Z" fill="#fffdf7" stroke="#d7cbb9" strokeWidth="1.1" />
                <path d="M0 -1 L0 -15 L10 -3 Z" fill="#94cdd9" />
                <path d="M0 -1 L0 -13 L-9 -3 Z" fill="#fffdf7" stroke="#d7cbb9" strokeWidth="0.8" />
              </g>
              <g transform="translate(4,-14)">
                <circle r="7" fill="none" stroke="#ef9b87" strokeWidth="3.6" />
                <circle r="7" fill="none" stroke="#ffffff" strokeWidth="1.2" strokeDasharray="2 3" />
              </g>
            </g>
          </g>

          {/* 东南礁石 */}
          <g opacity="0.85">
            <path d="M654 430 q 8 -12 18 -2 q 8 8 -2 12 q -14 4 -16 -10 Z" fill="#cdd7d5" />
            <path d="M666 446 q 6 -8 13 -1 q 5 6 -2 9 q -10 2 -11 -8 Z" fill="#c2cfcd" />
            <ellipse cx="668" cy="440" rx="16" ry="5" fill="rgba(120,170,180,0.18)" />
          </g>

          {/* 飞鸟 */}
          <g stroke="#9fb8c2" strokeWidth="1.2" fill="none" opacity="0.7" strokeLinecap="round">
            <path d="M560 150 q 4 -5 8 0 q 4 -5 8 0" />
            <path d="M590 138 q 3 -4 6 0 q 3 -4 6 0" />
            <path d="M540 132 q 2.5 -3 5 0 q 2.5 -3 5 0" />
          </g>

          {/* 云 */}
          <g opacity="0.55">
            <ellipse cx="252" cy="136" rx="42" ry="13" fill="#ffffff" />
            <ellipse cx="276" cy="128" rx="26" ry="11" fill="#ffffff" />
            <ellipse cx="660" cy="286" rx="34" ry="10" fill="#ffffff" opacity="0.7" />
          </g>

          {/* 海面小舟 */}
          <g transform="translate(676,352) scale(0.95)" opacity="0.85">
            <g className="atlas-boat">
              <path d="M-15 0 q 15 8 30 0 Z" fill="#ffffff" stroke="#d9cfc0" strokeWidth="1" />
              <path d="M0 -1 L0 -18 L10 -4 Z" fill="#faf3e4" stroke="#d9cfc0" strokeWidth="0.8" />
              <path d="M0 -1 L0 -15 L-8 -4 Z" fill="#ffffff" stroke="#d9cfc0" strokeWidth="0.8" />
              <path d="M-18 5 q 18 6 36 0" stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" fill="none" />
            </g>
          </g>

        </svg>
              ),
              // 只在换地点或换时刻时重建 SVG，悬停不再触发整棵树重渲染
              [active, moment]
            )}

            {/* 地图注记：HTML 排版，比 SVG text 更清晰、也更轻 */}
            <div className="pointer-events-none absolute inset-0">
              {SPOTS.map((sp) => {
                const on = active === sp.id || hover === sp.id
                const left = ((sp.lx - VIEW.x) / VIEW.w) * 100
                const top = ((sp.ly - VIEW.y) / VIEW.h) * 100
                const align =
                  sp.anchor === 'start'
                    ? { transform: 'translate(0, -50%) scale(var(--inv, 1))', transformOrigin: 'left center' }
                    : sp.anchor === 'end'
                      ? { transform: 'translate(-100%, -50%) scale(var(--inv, 1))', transformOrigin: 'right center' }
                      : { transform: 'translate(-50%, -50%) scale(var(--inv, 1))', transformOrigin: 'center' }
                return (
                  <button
                    key={sp.id}
                    onMouseEnter={() => setHover(sp.id)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(sp.id)}
                    onBlur={() => setHover(null)}
                    onClick={() => pick(sp.id)}
                    aria-pressed={active === sp.id}
                    className={`pointer-events-auto absolute flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-[3px] text-[11px] font-medium backdrop-blur-[2px] transition-[background,color,box-shadow] duration-300 ${
                      on
                        ? 'z-20 bg-white/95 text-ink-900 shadow-[0_8px_18px_-12px_rgba(46,96,112,0.9)]'
                        : 'bg-white/45 text-ink-500 hover:bg-white/85 hover:text-ink-900'
                    }`}
                    style={{ left: `${left}%`, top: `${top}%`, ...align }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full transition-colors"
                      style={{ background: on ? '#3a7b8d' : 'rgba(95,114,128,0.4)' }}
                    />
                    {sp.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 缩放控件 */}
          <div className="absolute bottom-3 right-3 z-20 flex flex-col items-center gap-1 rounded-full border border-white/85 bg-white/75 p-1 backdrop-blur">
            <button
              onClick={() => zoomTo(zoom + 0.4)}
              disabled={zoom >= MAX_ZOOM - 0.01}
              className="atlas-zoom"
              aria-label="放大地图"
            >
              +
            </button>
            <span className="tnum text-[9px] text-ink-400">{zoom.toFixed(1)}×</span>
            <button
              onClick={() => zoomTo(zoom - 0.4)}
              disabled={zoom <= 1.01}
              className="atlas-zoom"
              aria-label="缩小地图"
            >
              −
            </button>
            {zoom > 1.02 && (
              <button
                onClick={() => zoomTo(1)}
                className="atlas-zoom text-[9px]"
                aria-label="回到全景"
                title="回到全景"
              >
                1×
              </button>
            )}
          </div>


        </div>

        <p className="px-5 pb-3 pt-2 text-[10px] tracking-wide text-ink-300">
          {MOMENTS.find((m) => m.id === moment)?.hint}
        </p>
      </div>

      {/* ── 地点面板 ── */}
      <div className="relative flex h-full min-h-[30rem] flex-col overflow-hidden rounded-5xl border border-white/70 bg-white/55 p-5 shadow-soft backdrop-blur-md sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-lav-100/60 blur-2xl" />
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={spot.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex flex-1 flex-col"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-[11px] tracking-[0.3em] text-sea-400">
                  {spot.index} / {String(SPOTS.length).padStart(2, '0')}
                </p>
                <h3 className="mt-1.5 font-display text-[22px] font-semibold tracking-tight text-ink-900">{spot.name}</h3>
                <p className="mt-0.5 text-[10.5px] uppercase tracking-[0.2em] text-ink-300">{spot.en}</p>
              </div>
              <span className="chip shrink-0">{spot.meta}</span>
            </div>

            <p className="mt-4 text-[13px] leading-[1.85] text-ink-700">{spot.tagline}</p>

            <ul className="mt-4 space-y-2">
              {spot.points.map((p) => (
                <li key={p} className="flex gap-2 text-[12px] leading-relaxed text-ink-500">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-sea-300" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>

            <div className="mt-4 rounded-3xl border border-white/80 bg-white/60 p-3.5">
              {spot.action === 'chat' && (
                <div>
                  <p className="text-[10px] tracking-[0.18em] text-ink-300">试着说一句</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {['我一想到考试就心慌', '我总觉得自己复习不完', '晚上躺下脑子停不下来'].map((q) => (
                      <button
                        key={q}
                        onClick={() => navigate(`/chat?q=${encodeURIComponent(q)}`)}
                        className="rounded-full border border-white/90 bg-white/80 px-2.5 py-1 text-[11px] text-ink-600 transition hover:border-sea-200 hover:bg-sea-50 hover:text-sea-700"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {spot.action === 'read' && (
                <div>
                  <p className="text-[10px] tracking-[0.18em] text-ink-300">随手翻到一页</p>
                  <p className="mt-1.5 font-display text-[13px] font-semibold leading-snug text-ink-900">{doc.title}</p>
                  <p className="mt-1 line-clamp-3 text-[11.5px] leading-relaxed text-ink-500">{doc.summary}</p>
                  <button
                    onClick={() => setQuote((q) => q + 1)}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-lav-500"
                  >
                    <Icon name="refresh" size={12} />
                    再翻一页
                  </button>
                </div>
              )}

              {spot.action === 'breathe' && (
                <div className="flex items-center gap-3">
                  <span className="relative flex h-11 w-11 items-center justify-center">
                    <span className="absolute inset-0 rounded-full bg-sea-200/50 slow-breath" />
                    <span className="relative h-6 w-6 rounded-full bg-gradient-to-br from-sea-200 to-lav-200" />
                  </span>
                  <div>
                    <p className="text-[11.5px] text-ink-600">4 秒吸气 · 7 秒屏息 · 8 秒呼气</p>
                    <button onClick={() => openBreathing('478')} className="mt-1 text-[11px] font-medium text-sea-600">
                      现在就来一轮 →
                    </button>
                  </div>
                </div>
              )}

              {spot.action === 'game' && (
                <div className="flex flex-wrap gap-1.5">
                  {['潮汐泡泡', '沙岸拾贝', '打水漂', '星光许愿'].map((g) => (
                    <span key={g} className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] text-ink-600">
                      {g}
                    </span>
                  ))}
                </div>
              )}

              {spot.action === 'chart' && <MiniTrend />}

              {spot.action === 'call' && (
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] tracking-[0.18em] text-ink-300">24 小时 · 全国统一</p>
                    <p className="font-display text-xl font-semibold tracking-tight text-ink-900">12356</p>
                  </div>
                  <a href="tel:12356" className="btn-ghost px-3 py-1.5 text-[11.5px]">
                    <Icon name="lifebuoy" size={13} />
                    拨打
                  </a>
                </div>
              )}

              {spot.action === 'about' && (
                <p className="text-[11.5px] leading-relaxed text-ink-600">
                  <span className="font-medium text-ink-900">隐私优先　</span>
                  本地账号、无服务端数据库，每个名字拥有独立命名空间，对话与情绪记录只写入浏览器 localStorage。
                </p>
              )}
            </div>

            {/* mt-auto：卡片被拉伸到与地图同高时，把主按钮压在底部，中间留白而不是底部塌空 */}
            <div className="mt-auto pt-5">
              <button onClick={enter} className="btn-primary w-full py-2.5 text-[13px]">
                {spot.action === 'breathe' ? '开始一次呼吸' : `进入${spot.name.split(' · ')[0]}`}
                <Icon name="arrowRight" size={15} />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

/** 面板内的 7 日迷你趋势 */
function MiniTrend() {
  const records = useAppStore((s) => s.records)
  const points = useMemo(() => {
    const now = Date.now()
    const day = 86400000
    return Array.from({ length: 7 }, (_, i) => {
      const start = now - (6 - i) * day
      const d = new Date(start)
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
      const same = records.filter((r) => {
        const rd = new Date(r.ts)
        return `${rd.getFullYear()}-${rd.getMonth() + 1}-${rd.getDate()}` === key
      })
      const avg = same.length ? same.reduce((a, b) => a + b.score, 0) / same.length : null
      return { key, avg }
    })
  }, [records])

  const filled = points.filter((p) => p.avg !== null)
  const W = 200
  const H = 54
  const path = points
    .map((p, i) => {
      const x = (i / 6) * W
      const y = H - ((p.avg ?? 3) / 5) * (H - 8) - 4
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] tracking-[0.18em] text-ink-300">近 7 天潮位</p>
        <p className="text-[10.5px] text-ink-400">{filled.length ? `${filled.length} 天有记录` : '还没有记录'}</p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1.5 h-[54px] w-full" aria-hidden="true">
        <path d={path} fill="none" stroke="#94cdd9" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle
            key={p.key}
            cx={(i / 6) * W}
            cy={H - ((p.avg ?? 3) / 5) * (H - 8) - 4}
            r={p.avg !== null ? 2.6 : 1.4}
            fill={p.avg !== null ? '#4a97aa' : '#dbe7ea'}
          />
        ))}
      </svg>
    </div>
  )
}
