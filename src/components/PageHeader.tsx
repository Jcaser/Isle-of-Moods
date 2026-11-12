import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface Props {
  eyebrow?: string
  title: string
  desc?: ReactNode
  icon?: ReactNode
  right?: ReactNode
}

export function PageHeader({ eyebrow, title, desc, icon, right }: Props) {
  return (
    <div className="flex flex-col gap-4 pb-6 pt-8 sm:flex-row sm:items-end sm:justify-between sm:pt-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {eyebrow && (
          <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-sea-500">
            {icon}
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight text-ink-900 sm:text-[34px]">
          {title}
        </h1>
        {desc && <p className="mt-2.5 max-w-2xl text-[13.5px] leading-relaxed text-ink-500 sm:text-sm">{desc}</p>}
      </motion.div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}
