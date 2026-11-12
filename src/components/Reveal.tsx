import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  delay?: number
  className?: string
  as?: ElementType
  once?: boolean
}

/**
 * 滚动进场：用 IntersectionObserver 而不是依赖滚动事件，
 * 之前用 whileInView 遇到过内容整块不可见的问题，这里保证兜底可见。
 */
export function Reveal({ children, delay = 0, className = '', as, once = true }: Props) {
  const Tag = (as ?? 'div') as ElementType
  const ref = useRef<HTMLElement | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true)
            if (once) io.disconnect()
          } else if (!once) {
            setShown(false)
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    )
    io.observe(el)
    // 兜底：内容已经在视口内但观察器未触发时，900ms 后强制显示
    const timer = window.setTimeout(() => setShown(true), 900)
    return () => {
      io.disconnect()
      window.clearTimeout(timer)
    }
  }, [once])

  return (
    <Tag
      ref={ref as never}
      className={`rise ${shown ? 'in' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  )
}
