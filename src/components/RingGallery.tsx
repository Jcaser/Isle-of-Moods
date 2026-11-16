import { animate, motion, useAnimationFrame, useMotionValue, useTransform, type MotionValue } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { GALLERY, type GalleryItem } from '../lib/gallery'
import { Icon } from './Icons'

/** 自转速度：度/秒。慢一点，才像「慢慢转」 */
const SPIN = 5.2
/** 拖拽灵敏度：鼠标横向 1px 转多少度 */
const DRAG_RATE = 0.28
/** 判定「这是一次点击」而不是「拖了一下」的位移阈值 */
const CLICK_SLOP = 6

const rad = (deg: number) => (deg * Math.PI) / 180

interface CardProps {
  item: GalleryItem
  index: number
  total: number
  rot: MotionValue<number>
  cardW: number
  radius: number
  onPick: (index: number) => void
}

/** 一张卡片：角度由共享的 rot 推出来，位置 / 大小 / 模糊都跟着角度走 */
function RingCard({ item, index, total, rot, cardW, radius, onPick }: CardProps) {
  const angle = useTransform(rot, (r) => r + index * (360 / total))

  const x = useTransform(angle, (a) => Math.sin(rad(a)) * radius)
  const y = useTransform(angle, (a) => -(1 - Math.cos(rad(a))) * cardW * 0.115)
  const z = useTransform(angle, (a) => Math.cos(rad(a)) * radius - radius + 80)
  const rotateY = useTransform(angle, (a) => -Math.sin(rad(a)) * 34)
  /* depth：1 = 正对镜头，0 = 转到最远 */
  const depth = useTransform(angle, (a) => (Math.cos(rad(a)) + 1) / 2)
  const opacity = useTransform(depth, (d) => 0.38 + d * 0.62)
  const filter = useTransform(
    depth,
    (d) =>
      `blur(${((1 - d) * 2.6).toFixed(2)}px) saturate(${(0.7 + d * 0.3).toFixed(2)}) brightness(${(0.94 + d * 0.06).toFixed(2)})`,
  )
  const zIndex = useTransform(depth, (d) => Math.round(8 + d * 92))

  const height = Math.round(cardW * 0.5625)

  return (
    <motion.button
      type="button"
      onClick={() => onPick(index)}
      aria-label={`放大明信片：${item.caption}`}
      className="absolute left-1/2 top-1/2 cursor-pointer focus-ring"
      style={{
        width: cardW,
        height,
        marginLeft: -cardW / 2,
        marginTop: -height / 2,
        x,
        y,
        z,
        rotateY,
        zIndex,
      }}
    >
      <motion.div
        className="relative h-full w-full rounded-[16px] border border-white/85 bg-white/75 p-[5px] shadow-[0_26px_54px_-26px_rgba(30,60,72,0.62)]"
        style={{ opacity, filter }}
        whileHover={{ y: -9, scale: 1.035 }}
        transition={{ type: 'spring', stiffness: 240, damping: 20 }}
      >
        <img
          src={item.src}
          alt={item.caption}
          draggable={false}
          loading="lazy"
          className="h-full w-full rounded-[12px] object-cover"
        />
        {/* 玻璃高光，让卡片看起来是「一张实体照片」 */}
        <span className="pointer-events-none absolute inset-[5px] rounded-[12px] bg-gradient-to-tr from-white/0 via-white/0 to-white/20" />
      </motion.div>
    </motion.button>
  )
}

interface LightboxProps {
  index: number | null
  onClose: () => void
  onStep: (delta: number) => void
}

/** 全屏预览：大图 + 那句话 + 左右切换 */
function Lightbox({ index, onClose, onStep }: LightboxProps) {
  const open = index !== null
  const [mounted, setMounted] = useState(open)
  const lastRef = useRef(0)

  useEffect(() => {
    if (open) {
      setMounted(true)
      return
    }
    const t = window.setTimeout(() => setMounted(false), 240)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') onStep(1)
      if (e.key === 'ArrowLeft') onStep(-1)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose, onStep])

  useEffect(() => {
    if (index !== null) lastRef.current = index
  }, [index])

  if (!mounted) return null
  const item = GALLERY[index ?? lastRef.current]

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center px-4 pb-6 pt-16 sm:px-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: open ? 1 : 0 }}
      transition={{ duration: open ? 0.22 : 0.2, ease: 'easeOut' }}
      style={{ pointerEvents: open ? 'auto' : 'none' }}
      role="dialog"
      aria-modal="true"
      aria-label={`明信片：${item.caption}`}
    >
      <button
        className="absolute inset-0 cursor-zoom-out bg-[#0f1e27]/[0.9] backdrop-blur-md"
        onClick={onClose}
        aria-label="关闭预览"
        tabIndex={-1}
      />

      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white/85 backdrop-blur transition hover:bg-white/20 sm:right-6 sm:top-6"
        aria-label="关闭预览"
      >
        <Icon name="close" size={18} />
      </button>

      <button
        onClick={() => onStep(-1)}
        className="absolute left-2 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white/85 backdrop-blur transition hover:bg-white/20 sm:left-4 sm:flex"
        aria-label="上一张"
      >
        <Icon name="arrowRight" size={18} className="rotate-180" />
      </button>
      <button
        onClick={() => onStep(1)}
        className="absolute right-2 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white/85 backdrop-blur transition hover:bg-white/20 sm:right-4 sm:flex"
        aria-label="下一张"
      >
        <Icon name="arrowRight" size={18} />
      </button>

      <motion.figure
        className="relative z-10 flex max-h-full w-full max-w-5xl flex-col items-center"
        animate={{ scale: open ? 1 : 0.97, y: open ? 0 : 10 }}
        transition={{ type: 'spring', stiffness: 240, damping: 26 }}
      >
        <img
          src={item.src}
          alt={item.caption}
          className="max-h-[68vh] w-auto max-w-full rounded-2xl border border-white/20 object-contain shadow-[0_40px_90px_-30px_rgba(0,0,0,0.7)] sm:max-h-[72vh]"
        />
        <figcaption className="mt-4 text-center">
          <p className="font-display text-[15px] tracking-wide text-white/90 sm:text-[17px]">{item.caption}</p>
          <p className="mt-1.5 text-[10.5px] tracking-[0.16em] text-white/45">
            {(index ?? lastRef.current) + 1} / {GALLERY.length} · 点背景或按 Esc 收起
          </p>
        </figcaption>
      </motion.figure>
    </motion.div>,
    document.body,
  )
}

/** 3D 环形画廊：自动慢转、可拖拽、点卡片转到正面并放大 */
export function RingGallery() {
  const stageRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ cardW: 250, radius: 300 })
  const [dragging, setDragging] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [focusing, setFocusing] = useState(false)
  const [active, setActive] = useState<number | null>(null)
  const [visible, setVisible] = useState(false)
  const [reduced, setReduced] = useState(false)

  const rot = useMotionValue(0)
  const drag = useRef({ moved: 0, active: false })
  const suppress = useRef(false)
  const stopRef = useRef<(() => void) | null>(null)

  /* 卡片尺寸与半径跟着容器宽度走，窄屏自动收缩，不会被裁 */
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      const cardW = Math.round(Math.min(Math.max(w * 0.33, 144), 332))
      const radius = Math.round(Math.min(Math.max(w * 0.35, 130), 412))
      setSize({ cardW, radius })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /* 滚出视口就停转，省电；系统开了「减少动态效果」也停 */
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const io = new IntersectionObserver((entries) => setVisible(entries[0]?.isIntersecting ?? false), { threshold: 0.2 })
    io.observe(el)
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => {
      io.disconnect()
      mq.removeEventListener('change', sync)
    }
  }, [])

  const paused = dragging || hovering || focusing || active !== null || !visible || reduced
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  useAnimationFrame((_, delta) => {
    if (pausedRef.current) return
    rot.set(rot.get() + (delta / 1000) * SPIN)
  })

  useEffect(() => () => stopRef.current?.(), [])

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const startX = e.clientX
    const startRot = rot.get()
    drag.current = { moved: 0, active: true }
    suppress.current = false
    setDragging(true)

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      drag.current.moved = Math.max(drag.current.moved, Math.abs(dx))
      rot.set(startRot + dx * DRAG_RATE)
    }
    const end = () => {
      suppress.current = drag.current.moved > CLICK_SLOP
      drag.current = { moved: 0, active: false }
      setDragging(false)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      stopRef.current = null
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    stopRef.current = end
  }

  /* 把某张卡转到正前方（走最短的那一边） */
  const focusTo = useCallback(
    (index: number) => {
      const stepDeg = 360 / GALLERY.length
      const current = rot.get()
      const currentMod = ((current % 360) + 360) % 360
      const targetMod = ((-index * stepDeg) % 360 + 360) % 360
      let delta = targetMod - currentMod
      if (delta > 180) delta -= 360
      if (delta < -180) delta += 360

      setFocusing(true)
      animate(rot, current + delta, {
        duration: 0.75,
        ease: [0.22, 1, 0.36, 1],
        onComplete: () => setFocusing(false),
      })
    },
    [rot],
  )

  /* 点卡片：先把它转到正前方，再打开大图 */
  const pick = (index: number) => {
    if (suppress.current) {
      suppress.current = false
      return
    }
    focusTo(index)
    setActive(index)
  }

  /* 大图里切上一张 / 下一张时，环也跟着转 */
  const step = useCallback(
    (delta: number) => {
      if (active === null) return
      const next = (active + delta + GALLERY.length) % GALLERY.length
      setActive(next)
      focusTo(next)
    },
    [active, focusTo],
  )

  const cardH = Math.round(size.cardW * 0.5625)

  return (
    <>
      <div
        ref={stageRef}
        className="relative touch-pan-y select-none"
        style={{ height: cardH + Math.round(size.cardW * 0.3), perspective: 1050, perspectiveOrigin: '50% 34%' }}
        onPointerDown={onPointerDown}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') setHovering(true)
        }}
        onPointerLeave={() => setHovering(false)}
        role="group"
        aria-label="明信片环形画廊，可拖动旋转，点击卡片放大"
      >
        <div
          className="absolute inset-0"
          style={{ transformStyle: 'preserve-3d', cursor: dragging ? 'grabbing' : 'grab' }}
        >
          {GALLERY.map((item, i) => (
            <RingCard
              key={item.src}
              item={item}
              index={i}
              total={GALLERY.length}
              rot={rot}
              cardW={size.cardW}
              radius={size.radius}
              onPick={pick}
            />
          ))}
        </div>
      </div>

      <p className="mt-1 flex items-center justify-center gap-1.5 text-[10.5px] tracking-[0.12em] text-ink-300">
        <Icon name="compass" size={11} />
        拖动转一转 · 点卡片看大图
      </p>

      <Lightbox index={active} onClose={() => setActive(null)} onStep={step} />
    </>
  )
}
