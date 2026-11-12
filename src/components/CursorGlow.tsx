import { useEffect, useRef, useState } from 'react'

/** 跟随指针的柔光，只在精确指针设备上启用，用来把页面"点亮"一点 */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setEnabled(true)

    let x = window.innerWidth / 2
    let y = window.innerHeight / 2
    let tx = x
    let ty = y
    let raf = 0

    const move = (e: PointerEvent) => {
      tx = e.clientX
      ty = e.clientY
    }

    const loop = () => {
      x += (tx - x) * 0.14
      y += (ty - y) * 0.14
      if (ref.current) ref.current.style.transform = `translate3d(${x - 180}px, ${y - 180}px, 0)`
      raf = requestAnimationFrame(loop)
    }

    window.addEventListener('pointermove', move, { passive: true })
    raf = requestAnimationFrame(loop)
    return () => {
      window.removeEventListener('pointermove', move)
      cancelAnimationFrame(raf)
    }
  }, [])

  if (!enabled) return null

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-0 h-[360px] w-[360px] rounded-full opacity-70"
      style={{
        background:
          'radial-gradient(circle, rgba(255,255,255,0.75) 0%, rgba(214,240,247,0.32) 38%, rgba(255,255,255,0) 70%)',
        mixBlendMode: 'soft-light',
      }}
    />
  )
}
