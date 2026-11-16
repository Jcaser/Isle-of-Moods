import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MOMENTS, applyMoment, saveMoment } from '../lib/moment'
import { useAppStore } from '../store/useAppStore'
import { Icon, type IconName } from './Icons'

interface Cmd {
  id: string
  label: string
  hint?: string
  icon: IconName
  group: '地点' | '动作'
  run: () => void
  keywords?: string
}

/**
 * ⌘K 快捷面板：键盘优先的全局入口。
 * 地点跳转、呼吸、量表、岛屿时刻都收敛到一处。
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const navigate = useNavigate()
  const openBreathing = useAppStore((s) => s.openBreathing)
  const setAssessmentOpen = useAppStore((s) => s.setAssessmentOpen)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const close = () => {
    setOpen(false)
    setQ('')
    setIdx(0)
  }

  const commands = useMemo<Cmd[]>(() => {
    const pages: { to: string; label: string; icon: IconName; kw: string }[] = [
      { to: '/', label: '岛屿全景', icon: 'home', kw: 'home 地图 首页 island' },
      { to: '/chat', label: '岛主 · AI 对话', icon: 'chat', kw: 'chat ai 倾诉 聊天 agent' },
      { to: '/library', label: '分享小屋', icon: 'book', kw: 'library 书墙 便签 分享 小屋 知识库 rag 文章' },
      { to: '/calm', label: '潮汐疗愈', icon: 'wave', kw: 'calm 呼吸 壁纸 正念 音频' },
      { to: '/play', label: '屿乐园', icon: 'sparkles', kw: 'play 游戏 解压 泡泡 水漂 星星' },
      { to: '/mood', label: '情绪潮向', icon: 'chart', kw: 'mood 记录 趋势 打卡' },
      { to: '/harbor', label: '避风港', icon: 'lifebuoy', kw: 'harbor 求助 热线 危机 12356' },
    ]
    return [
      ...pages.map<Cmd>((p) => ({
        id: 'go' + p.to,
        label: p.label,
        group: '地点',
        icon: p.icon,
        keywords: p.kw,
        hint: p.to,
        run: () => {
          navigate(p.to)
          close()
        },
      })),
      {
        id: 'breathe',
        label: '现在做一轮 4-7-8 呼吸',
        group: '动作',
        icon: 'wave',
        keywords: 'breath 呼吸 放松 紧张',
        run: () => {
          openBreathing('478')
          close()
        },
      },
      {
        id: 'gad7',
        label: '做一次 GAD-7 情绪自评',
        group: '动作',
        icon: 'leaf',
        keywords: 'gad 量表 测评 焦虑 自评',
        run: () => {
          setAssessmentOpen(true)
          close()
        },
      },
      ...MOMENTS.map<Cmd>((m) => ({
        id: 'moment' + m.id,
        label: `把岛屿切到「${m.label}」`,
        group: '动作',
        icon: 'clock',
        keywords: `moment 时刻 主题 ${m.id}`,
        run: () => {
          applyMoment(m.id)
          saveMoment(m.id)
          close()
        },
      })),
    ]
  }, [navigate, openBreathing, setAssessmentOpen])

  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase()
    if (!key) return commands
    return commands.filter((c) => (c.label + (c.keywords ?? '')).toLowerCase().includes(key))
  }, [commands, q])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === 'Escape' && open) {
        close()
      }
    }
    const onAsk = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('serene:palette', onAsk)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('serene:palette', onAsk)
    }
  }, [open])

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 60)
  }, [open])

  useEffect(() => setIdx(0), [q])

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIdx((i) => Math.min(filtered.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIdx((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      filtered[idx]?.run()
    }
  }

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-i="${idx}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [idx])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[14vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
        >
          <div className="absolute inset-0 bg-[#0f2d36]/[0.12] backdrop-blur-[3px]" onClick={close} aria-hidden="true" />
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="快捷命令"
            className="relative w-full max-w-lg overflow-hidden rounded-4xl border border-white/90 bg-white/[0.92] shadow-[0_40px_90px_-40px_rgba(24,60,72,0.55)] backdrop-blur-xl"
          >
            <div className="flex items-center gap-2.5 border-b border-ink-900/[0.06] px-4 py-3">
              <Icon name="compass" size={16} className="text-sea-500" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="去哪儿？试试「呼吸」「避风港」「夜航」"
                aria-label="搜索地点或动作"
                className="w-full bg-transparent text-[13.5px] text-ink-900 placeholder:text-ink-300 focus:outline-none"
                style={{ outline: 'none' }}
              />
              <kbd className="hidden shrink-0 rounded-md border border-ink-900/10 px-1.5 py-0.5 text-[9.5px] text-ink-400 sm:block">
                ESC
              </kbd>
            </div>

            <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5 no-bar">
              {filtered.length === 0 && (
                <p className="px-3 py-6 text-center text-[12px] text-ink-300">没有找到，换个词试试</p>
              )}
              {(['地点', '动作'] as const).map((g) => {
                const items = filtered.filter((c) => c.group === g)
                if (!items.length) return null
                return (
                  <div key={g} className="mb-1">
                    <p className="px-3 pb-1 pt-2 text-[9.5px] font-semibold tracking-[0.22em] text-ink-300">{g}</p>
                    {items.map((c) => {
                      const i = filtered.indexOf(c)
                      const on = i === idx
                      return (
                        <button
                          key={c.id}
                          data-i={i}
                          onMouseEnter={() => setIdx(i)}
                          onClick={c.run}
                          className={`flex w-full items-center gap-2.5 rounded-2xl px-3 py-2 text-left transition ${
                            on ? 'bg-sea-50/90 text-sea-700' : 'text-ink-600 hover:bg-white'
                          }`}
                        >
                          <span className={`flex h-7 w-7 items-center justify-center rounded-full ${on ? 'bg-white text-sea-600' : 'bg-sand-100/70 text-ink-400'}`}>
                            <Icon name={c.icon} size={14} />
                          </span>
                          <span className="flex-1 text-[12.5px] font-medium">{c.label}</span>
                          {c.hint && <span className="text-[10px] text-ink-300">{c.hint}</span>}
                          {on && <Icon name="arrowRight" size={12} className="text-sea-400" />}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between border-t border-ink-900/[0.06] px-4 py-2 text-[10px] text-ink-300">
              <span>↑↓ 选择 · Enter 执行</span>
              <span>⌘K / Ctrl K 随时唤起</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
