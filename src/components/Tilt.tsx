import { useRef, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
  max?: number
  glare?: boolean
}

/** 指针驱动的 3D 倾斜卡片：位移很小，但有真实的"厚度"反馈 */
export function Tilt({ children, className = '', max = 6, glare = true }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    el.style.setProperty('--ry', `${(px - 0.5) * max * 2}deg`)
    el.style.setProperty('--rx', `${-(py - 0.5) * max * 2}deg`)
    el.style.setProperty('--mx', `${px * 100}%`)
    el.style.setProperty('--my', `${py * 100}%`)
    el.style.setProperty('--glare', '1')
  }

  const reset = () => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--ry', '0deg')
    el.style.setProperty('--rx', '0deg')
    el.style.setProperty('--glare', '0')
  }

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      className={`tilt ${className}`}
    >
      {children}
      {glare && <span className="tilt-glare" aria-hidden="true" />}
    </div>
  )
}
