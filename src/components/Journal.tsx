import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icons'
import { Modal } from './Modal'
import { MOOD_META, dayKey } from '../lib/mood'
import {
  JOURNAL_SYSTEM,
  dayOf,
  downloadJournalCard,
  journalCardUrl,
  loadJournal,
  localFeedback,
  saveJournal,
  seedOf,
  uid,
  type JournalEntry,
} from '../lib/journal'
import { streamChat } from '../lib/llm'
import type { MoodScore } from '../lib/types'
import { useAppStore } from '../store/useAppStore'
import { useAuthStore } from '../store/useAuthStore'

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function timeLabel(ts: number): string {
  const d = new Date(ts)
  const today = dayOf(Date.now())
  const day = dayOf(ts)
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return today === day ? `今天 ${hm}` : `${day.slice(5).replace('-', '/')} ${hm}`
}

/** 岛屿日记：写下今天，向导读一遍，再把它做成一张卡片 */
export function Journal() {
  const settings = useAppStore((s) => s.settings)
  const records = useAppStore((s) => s.records)
  const user = useAuthStore((s) => s.user)

  const [entries, setEntries] = useState<JournalEntry[]>(() => loadJournal())
  const [text, setText] = useState('')
  const [mood, setMood] = useState<MoodScore | null>(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [mode, setMode] = useState<'ai' | 'local'>('local')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [cardOpen, setCardOpen] = useState(false)
  const [cardUrl, setCardUrl] = useState('')

  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<number | null>(null)
  const fbRef = useRef<HTMLDivElement | null>(null)

  const todayScore = useMemo(() => {
    const today = dayKey(Date.now())
    return records.find((r) => dayKey(r.ts) === today)?.score ?? null
  }, [records])

  // 换岛主后重新载入这个人的日记
  useEffect(() => {
    setEntries(loadJournal())
    setText('')
    setFeedback('')
    setActiveId(null)
    setMood(null)
  }, [user?.id])

  useEffect(() => {
    if (mood === null && todayScore) setMood(todayScore)
  }, [todayScore, mood])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [])

  const active = entries.find((e) => e.id === activeId) ?? null
  const today = dayOf(Date.now())

  const persist = (id: string, patch: Partial<JournalEntry>) => {
    setEntries((prev) => {
      const next = prev.map((e) => (e.id === id ? { ...e, ...patch } : e))
      saveJournal(next)
      return next
    })
  }

  /** 本地模式也逐字吐，保持"它在读"的感觉 */
  const typeLocal = (full: string) =>
    new Promise<void>((resolve) => {
      let i = 0
      const tick = () => {
        i += 3
        setFeedback(full.slice(0, i))
        if (i < full.length) timerRef.current = window.setTimeout(tick, 16)
        else {
          timerRef.current = null
          resolve()
        }
      }
      tick()
    })

  const askGuide = async (entry: JournalEntry) => {
    setFeedback('')
    const fallback = localFeedback(entry.text, entry.mood)

    if (!settings.apiKey) {
      setMode('local')
      await typeLocal(fallback)
      persist(entry.id, { feedback: fallback, mode: 'local' })
      return
    }

    setMode('ai')
    const controller = new AbortController()
    abortRef.current = controller
    const context =
      `今天日期：${entry.day}（${WEEK[new Date(entry.ts).getDay()]}）\n` +
      `此刻心情潮位：${entry.mood ? `${entry.mood}/5（${MOOD_META[entry.mood].label}）` : '未标注'}\n` +
      `今天已有的潮位记录：${records.filter((r) => dayKey(r.ts) === entry.day).length} 条\n` +
      `日记原文：\n${entry.text}`

    try {
      let acc = ''
      const out = await streamChat({
        config: {
          baseUrl: settings.baseUrl,
          apiKey: settings.apiKey,
          model: settings.model,
          temperature: 0.75,
        },
        messages: [
          { role: 'system', content: JOURNAL_SYSTEM },
          { role: 'user', content: context },
        ],
        signal: controller.signal,
        onDelta: (t) => {
          acc += t
          setFeedback(acc)
        },
      })
      const final = (out.content || acc).trim() || fallback
      setFeedback(final)
      persist(entry.id, { feedback: final, mode: 'ai' })
    } catch {
      setMode('local')
      await typeLocal(fallback)
      persist(entry.id, { feedback: fallback, mode: 'local' })
    } finally {
      abortRef.current = null
    }
  }

  const submit = async () => {
    const body = text.trim()
    if (!body || busy) return
    setBusy(true)
    const ts = Date.now()
    const entry: JournalEntry = {
      id: uid(),
      ts,
      day: dayOf(ts),
      text: body,
      mood,
      feedback: '',
      mode: 'local',
      seed: seedOf(body),
    }
    setEntries((prev) => {
      const next = [entry, ...prev]
      saveJournal(next)
      return next
    })
    setActiveId(entry.id)
    setText('')
    await askGuide(entry)
    setBusy(false)
    // 手机上写完，把回应带到视野里
    window.setTimeout(() => fbRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120)
  }

  const regenerate = async () => {
    if (!active || busy) return
    setBusy(true)
    await askGuide(active)
    setBusy(false)
  }

  const openCard = () => {
    if (!active || !active.feedback) return
    setCardUrl(journalCardUrl(active, user?.name))
    setCardOpen(true)
  }

  const written = entries.some((e) => e.day === today)

  return (
    <section id="journal" className="lux relative overflow-hidden">
      {/* 头部 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/60 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-sand-100 via-white to-lav-100 text-[#b0916a]">
            <Icon name="feather" size={18} />
          </span>
          <div>
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.28em] text-sea-500">Island Journal</p>
            <h2 className="mt-0.5 font-display text-[16.5px] font-semibold tracking-tight text-ink-900">
              岛屿日记 · 今天想说什么
            </h2>
          </div>
        </div>
        <p className="flex w-full items-center gap-1.5 text-[10.5px] text-ink-300 sm:w-auto">
          <Icon name="lock" size={12} />
          只写在本机 · {entries.length} 页
          {written && <span className="ml-1 rounded-full bg-sea-50 px-2 py-0.5 text-sea-600">今天已写</span>}
        </p>
      </div>

      <div className="grid lg:grid-cols-[1.34fr_0.66fr]">
        {/* 写字区 */}
        <div className="p-5 sm:p-6">
          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 1200))}
              placeholder={'不用组织语言。今天哪件事最占地方，就写哪件。\n写给一个不会评价你的地方。'}
              className="min-h-[168px] w-full resize-y rounded-3xl border border-white/80 bg-white/70 px-4 py-3.5 text-[13.5px] leading-[1.95] text-ink-900 outline-none transition placeholder:text-ink-300 focus:border-sea-300/80 focus:bg-white/90 focus:shadow-[0_0_0_4px_rgba(148,205,217,0.16)]"
            />
            <span className="pointer-events-none absolute bottom-3 right-4 text-[10px] tabular-nums text-ink-300">
              {text.length} / 1200
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <span className="mr-1 text-[10.5px] text-ink-400">此刻潮位</span>
              {([1, 2, 3, 4, 5] as MoodScore[]).map((s) => {
                const meta = MOOD_META[s]
                const on = mood === s
                return (
                  <button
                    key={s}
                    onClick={() => setMood(on ? null : s)}
                    title={meta.label}
                    aria-label={`标记情绪：${meta.label}`}
                    aria-pressed={on}
                    className={`h-8 w-8 rounded-full transition-all duration-300 ${on ? 'scale-110 ring-2 ring-white' : 'opacity-60 hover:opacity-100'}`}
                    style={{
                      background: meta.color,
                      boxShadow: on ? `0 0 0 3px ${meta.color}33` : undefined,
                    }}
                  />
                )
              })}
            </div>

            <div className="flex items-center gap-2">
              {feedback && !busy && (
                <button onClick={openCard} className="btn-ghost text-[12px]">
                  <Icon name="download" size={14} />
                  做成卡片
                </button>
              )}
              <button onClick={submit} disabled={!text.trim() || busy} className="btn-primary text-[12.5px] disabled:opacity-45">
                {busy ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    向导在读…
                  </>
                ) : (
                  <>
                    <Icon name="feather" size={15} />
                    记下这一页
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 向导回应 */}
          <AnimatePresence>
            {(feedback || (active && active.feedback)) && (
              <motion.div
                ref={fbRef}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="relative mt-4 overflow-hidden rounded-3xl border border-sea-300/30 bg-sea-50/55 p-4 sm:p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.24em] text-sea-500">
                    <Icon name="sparkles" size={12} />
                    向导回应 · {(active?.mode ?? mode) === 'ai' ? 'AI' : '本地'}
                  </p>
                  {active?.feedback && !busy && (
                    <button onClick={regenerate} className="flex items-center gap-1 text-[10.5px] text-ink-400 transition hover:text-sea-600">
                      <Icon name="refresh" size={11} />
                      换个说法
                    </button>
                  )}
                </div>
                <p className="mt-2.5 whitespace-pre-wrap text-[13px] leading-[1.95] text-ink-700">
                  {feedback || active?.feedback}
                  {busy && <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse bg-sea-400 align-middle" />}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 往期 */}
        <div className="border-t border-white/60 bg-white/25 p-5 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.26em] text-sea-500">Previous pages</p>
            <span className="text-[10px] text-ink-300">最近 6 页</span>
          </div>

          <div className="mt-3 space-y-1.5">
            {entries.length === 0 && (
              <div className="mt-2 rounded-2xl border border-dashed border-sea-300/40 bg-white/40 px-4 py-6 text-center">
                <Icon name="feather" size={18} className="mx-auto text-sea-300" />
                <p className="mt-2 text-[11.5px] leading-[1.9] text-ink-400">
                  还没有写过。
                  <br />
                  第一页可以从「今天最累的一件事」开始，两三行就够。
                </p>
              </div>
            )}
            {entries.slice(0, 6).map((e) => {
              const on = e.id === activeId
              return (
                <button
                  key={e.id}
                  onClick={() => {
                    setActiveId(e.id)
                    setFeedback('')
                  }}
                  className={`w-full rounded-2xl border px-3 py-2.5 text-left transition ${
                    on ? 'border-sea-300/50 bg-white/85' : 'border-transparent bg-white/45 hover:bg-white/75'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[10.5px] text-ink-400">
                      {e.mood && (
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: MOOD_META[e.mood].color }} />
                      )}
                      {timeLabel(e.ts)}
                    </span>
                    {on && <span className="h-1 w-1 rounded-full bg-sea-400" />}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11.5px] leading-[1.7] text-ink-700">{e.text}</p>
                </button>
              )
            })}
          </div>

          {active && (
            <button
              onClick={() => {
                const next = entries.filter((e) => e.id !== active.id)
                setEntries(next)
                saveJournal(next)
                setActiveId(null)
                setFeedback('')
              }}
              className="mt-3 flex items-center gap-1.5 text-[10.5px] text-ink-300 transition hover:text-coral-500"
            >
              <Icon name="trash" size={11} />
              删掉这一页
            </button>
          )}
        </div>
      </div>

      <Modal
        open={cardOpen}
        onClose={() => setCardOpen(false)}
        title="今日一页"
        subtitle="存下来，或者只是给自己看一眼"
        maxWidth="max-w-md"
      >
        {cardUrl && (
          <img
            src={cardUrl}
            alt="日记卡片"
            className="w-full rounded-2xl border border-white/70 shadow-[0_20px_50px_-30px_rgba(46,96,112,0.8)]"
          />
        )}
        <div className="mt-4 flex gap-2">
          <button
            className="btn-primary flex-1 text-[12.5px]"
            onClick={() => active && downloadJournalCard(active, user?.name)}
          >
            <Icon name="download" size={15} />
            保存为图片
          </button>
          <button className="btn-ghost text-[12.5px]" onClick={() => setCardOpen(false)}>
            先不留
          </button>
        </div>
        <p className="mt-3 text-[10.5px] leading-relaxed text-ink-300">
          卡片由浏览器本地绘制，日记内容不会离开这台设备。
        </p>
      </Modal>
    </section>
  )
}
