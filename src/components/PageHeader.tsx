import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { BackToAtlas } from './BackToAtlas'

interface Props {
  eyebrow?: string
  title: string
  desc?: ReactNode
  icon?: ReactNode
  right?: ReactNode
}

/** 岛上的页码：从一个页面走到另一个页面，像翻一本图鉴 */
const PAGE_NO: Record<string, string> = {
  '/chat': 'II',
  '/mood': 'III',
  '/library': 'IV',
  '/calm': 'V',
  '/play': 'VI',
  '/harbor': 'VII',
}

export function PageHeader({ eyebrow, title, desc, icon, right }: Props) {
  const { pathname } = useLocation()
  const no = PAGE_NO[pathname] ?? 'I'

  return (
    <div className="relative pb-7 pt-5 sm:pt-7">
      {/* 顶部工具行：无论从哪进来，都能一步退回地图 */}
      <div className="flex items-center justify-between gap-3">
        <BackToAtlas />
        <p className="hidden items-center gap-2 text-[9.5px] font-medium uppercase tracking-[0.26em] text-ink-300 sm:flex">
          <span className="font-display text-[11px] tracking-[0.1em] text-sea-500">{no}</span>
          <span className="h-px w-4 bg-ink-300/40" />
          岛屿 ∕ {eyebrow ?? title}
        </p>
      </div>

      <div className="mt-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {eyebrow && (
            <p className="mb-3 flex items-center gap-2.5 text-[10.5px] font-semibold uppercase tracking-[0.26em] text-sea-500">
              <span className="h-px w-7 bg-gradient-to-r from-sea-400/80 to-sea-400/0" />
              {icon}
              {eyebrow}
            </p>
          )}
          <h1 className="font-display text-[27px] font-semibold leading-[1.18] tracking-tight text-ink-900 sm:text-[36px]">
            {title}
          </h1>
          {desc && (
            <div className="mt-3.5 flex gap-3.5">
              <span className="mt-1 h-[calc(100%-8px)] w-[2px] shrink-0 rounded-full bg-gradient-to-b from-sea-300/90 via-lav-300/70 to-transparent" />
              <p className="max-w-2xl text-[13.5px] leading-[1.9] text-ink-500">{desc}</p>
            </div>
          )}
        </motion.div>
        {right && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="shrink-0"
          >
            {right}
          </motion.div>
        )}
      </div>

      <div className="hairline mt-7 opacity-70" />
    </div>
  )
}
