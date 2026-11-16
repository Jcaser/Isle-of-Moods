import { motion } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icons'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children: ReactNode
  maxWidth?: string
  hideClose?: boolean
}

const EXIT_MS = 260

export function Modal({ open, onClose, title, subtitle, children, maxWidth = 'max-w-2xl', hideClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef(0)
  /* 自己管挂载与关闭动画：关闭动画还没结束就再次打开，也不会被吃掉 */
  const [mounted, setMounted] = useState(open)

  useEffect(() => {
    if (open) {
      setMounted(true)
      return
    }
    const t = window.setTimeout(() => setMounted(false), EXIT_MS)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)

    /* 记住打开时的滚动位置，关掉后原样回到这里 */
    scrollRef.current = window.scrollY
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    /* preventScroll：不要为了聚焦把页面滚到弹窗所在的位置 */
    const t = window.setTimeout(() => panelRef.current?.focus({ preventScroll: true }), 60)

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      window.clearTimeout(t)
      if (Math.abs(window.scrollY - scrollRef.current) > 2) {
        window.scrollTo({ top: scrollRef.current, behavior: 'instant' as ScrollBehavior })
      }
    }
  }, [open, onClose])

  if (!mounted) return null

  /*
   * 挂到 body：页面入场动画会给容器留下 transform / filter，
   * 那样 fixed 会相对整页内容定位，窗口放大到全屏后弹窗就会被顶出屏幕。
   */
  return createPortal(
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: open ? 1 : 0 }}
      transition={{ duration: open ? 0.18 : 0.22, ease: 'easeOut' }}
      style={{ pointerEvents: open ? 'auto' : 'none' }}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? '对话框'}
    >
      <button
        className="absolute inset-0 h-full w-full cursor-default bg-[#2b4450]/[0.25] backdrop-blur-[6px]"
        onClick={onClose}
        aria-label="关闭对话框"
        tabIndex={-1}
      />
      <motion.div
        ref={panelRef}
        tabIndex={-1}
        className={`glass-strong relative z-10 max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-t-4xl sm:rounded-4xl ${maxWidth}`}
        initial={{ y: 28, opacity: 0, scale: 0.99 }}
        animate={open ? { y: 0, opacity: 1, scale: 1 } : { y: 18, opacity: 0, scale: 0.99 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      >
        {(title || !hideClose) && (
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/60 bg-[rgba(253,252,247,0.95)] px-6 py-4 sm:px-8">
            <div>
              {title && <h2 className="font-display text-lg font-semibold tracking-tight text-ink-900">{title}</h2>}
              {subtitle && <p className="mt-1 text-xs leading-relaxed text-ink-500">{subtitle}</p>}
            </div>
            {!hideClose && (
              <button className="btn-quiet -mr-2 h-9 w-9 rounded-full p-0" onClick={onClose} aria-label="关闭">
                <Icon name="close" size={18} />
              </button>
            )}
          </div>
        )}
        <div className="px-6 py-5 sm:px-8">{children}</div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
