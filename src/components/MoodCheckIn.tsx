import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { MOOD_META, MOOD_TAGS } from '../lib/mood'
import type { MoodScore } from '../lib/types'
import { useAppStore } from '../store/useAppStore'
import { Icon } from './Icons'

interface Props {
  compact?: boolean
  defaultScore?: MoodScore
  onSaved?: (score: MoodScore) => void
}

export function MoodCheckIn({ compact, defaultScore, onSaved }: Props) {
  const addMood = useAppStore((s) => s.addMood)
  const [score, setScore] = useState<MoodScore | null>(defaultScore ?? null)
  const [tags, setTags] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)

  const toggleTag = (t: string) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : prev.length >= 3 ? prev : [...prev, t]))

  const submit = () => {
    if (!score) return
    addMood({ score, tags, note: note.trim() || undefined, source: 'quick' })
    setSaved(true)
    onSaved?.(score)
    setTimeout(() => {
      setSaved(false)
      setNote('')
      setTags([])
    }, 2600)
  }

  return (
    <div className="glass grain relative overflow-hidden p-5 sm:p-6">
      <div className="relative z-10">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-[15px] font-semibold tracking-tight text-ink-900">此刻的潮位</p>
          <span className="text-[11px] text-ink-300">30 秒记录 · 仅存本地</span>
        </div>

        <div className="mt-4 flex items-end justify-between gap-1.5">
          {([1, 2, 3, 4, 5] as MoodScore[]).map((s) => {
            const meta = MOOD_META[s]
            const active = score === s
            return (
              <button
                key={s}
                onClick={() => setScore(s)}
                aria-pressed={active}
                aria-label={`${meta.label}，${s} 分`}
                className="group flex flex-1 flex-col items-center gap-2 focus-ring rounded-2xl py-1"
              >
                <span className="relative flex h-12 w-full items-center justify-center">
                  <motion.span
                    animate={{ scale: active ? 1 : 0.78, opacity: active ? 1 : 0.82 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                    className="block h-9 w-9 rounded-full"
                    style={{
                      background: `radial-gradient(circle at 32% 28%, #ffffff 0%, ${meta.color} 42%, ${meta.color} 100%)`,
                      boxShadow: active ? `0 10px 22px -10px ${meta.color}` : 'none',
                    }}
                  />
                  {active && (
                    <motion.span
                      layoutId="mood-ring"
                      className="absolute inset-0 rounded-2xl border border-white"
                      style={{ boxShadow: `inset 0 0 0 1.5px ${meta.color}55` }}
                    />
                  )}
                </span>
                <span className={`text-[11px] transition ${active ? 'font-semibold text-ink-900' : 'text-ink-300'}`}>
                  {meta.label}
                </span>
              </button>
            )
          })}
        </div>

        <AnimatePresence initial={false}>
          {!compact && score && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 flex flex-wrap gap-1.5">
                {MOOD_TAGS.map((t) => {
                  const on = tags.includes(t)
                  return (
                    <button
                      key={t}
                      onClick={() => toggleTag(t)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                        on
                          ? 'border-sea-300 bg-sea-100 text-sea-700'
                          : 'border-white/70 bg-white/50 text-ink-500 hover:bg-white/80'
                      }`}
                    >
                      {t}
                    </button>
                  )
                })}
              </div>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="一句话：今天最占心思的是……（可留空）"
                className="input mt-3 py-2.5 text-[13px]"
                maxLength={80}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-4 flex items-center gap-3">
          <button onClick={submit} disabled={!score} className="btn-primary flex-1 disabled:opacity-40">
            {saved ? <Icon name="check" size={16} /> : <Icon name="leaf" size={16} />}
            {saved ? '已记入潮向' : '记录这一刻'}
          </button>
          {!score && <span className="text-[11px] text-ink-300">先选一个最接近的状态</span>}
        </div>
      </div>
    </div>
  )
}
