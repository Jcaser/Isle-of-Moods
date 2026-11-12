import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, type ReactNode } from 'react'
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

export function Modal({ open, onClose, title, subtitle, children, maxWidth = 'max-w-2xl', hideClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => panelRef.current?.focus(), 60)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      clearTimeout(t)
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label={title ?? '对话框'}
        >
          <button
            className="absolute inset-0 h-full w-full cursor-default bg-[#2b4450]/25 backdrop-blur-[6px]"
            onClick={onClose}
            aria-label="关闭对话框"
            tabIndex={-1}
          />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            className={`glass-strong relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-4xl sm:rounded-4xl ${maxWidth}`}
            initial={{ y: 28, opacity: 0, scale: 0.99 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          >
            {(title || !hideClose) && (
              <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/60 bg-white/70 px-6 py-4 backdrop-blur-xl sm:px-8">
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
        </motion.div>
      )}
    </AnimatePresence>
  )
}
