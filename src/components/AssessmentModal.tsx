import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GAD7_DISCLAIMER, GAD7_ITEMS, GAD7_OPTIONS, LEVEL_META, scoreToLevel } from '../lib/assessment'
import { useAppStore } from '../store/useAppStore'
import { Icon } from './Icons'
import { Modal } from './Modal'

type Stage = 'intro' | 'question' | 'result'

export function AssessmentModal() {
  const open = useAppStore((s) => s.assessmentOpen)
  const setOpen = useAppStore((s) => s.setAssessmentOpen)
  const addAssessment = useAppStore((s) => s.addAssessment)
  const navigate = useNavigate()

  const [stage, setStage] = useState<Stage>('intro')
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<(number | null)[]>(Array(7).fill(null))

  useEffect(() => {
    if (open) {
      setStage('intro')
      setIndex(0)
      setAnswers(Array(7).fill(null))
    }
  }, [open])

  const total = answers.reduce<number>((s, v) => s + (v ?? 0), 0)
  const answeredAll = answers.every((v) => v !== null)
  const level = scoreToLevel(total)
  const meta = LEVEL_META[level]

  const pick = (value: number) => {
    const next = [...answers]
    next[index] = value
    setAnswers(next)
    setTimeout(() => {
      if (index < GAD7_ITEMS.length - 1) setIndex(index + 1)
      else {
        const sum = next.reduce<number>((s, v) => s + (v ?? 0), 0)
        addAssessment({ answers: next as number[], total: sum, level: scoreToLevel(sum) })
        setStage('result')
      }
    }, 180)
  }

  const restart = () => {
    setAnswers(Array(7).fill(null))
    setIndex(0)
    setStage('intro')
  }

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="GAD-7 焦虑自评"
      subtitle="回顾过去两周，按真实感受作答 · 结果仅存本地"
      maxWidth="max-w-xl"
    >
      <AnimatePresence mode="wait">
        {stage === 'intro' && (
          <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="rounded-3xl bg-sea-50/70 p-5">
              <p className="text-[13.5px] leading-relaxed text-ink-700">
                接下来有 7 道题，请回想<strong>过去两周</strong>的状态，选择最符合的频率。整个过程约 1 分钟。
              </p>
              <ul className="mt-3 space-y-1.5 text-[12.5px] text-ink-500">
                <li className="flex gap-2">
                  <Icon name="check" size={14} className="mt-0.5 text-sea-500" />
                  没有对错，不必揣测"理想答案"
                </li>
                <li className="flex gap-2">
                  <Icon name="check" size={14} className="mt-0.5 text-sea-500" />
                  这是一份筛查量表，不是诊断
                </li>
                <li className="flex gap-2">
                  <Icon name="check" size={14} className="mt-0.5 text-sea-500" />
                  记录会进入情绪潮向，方便观察趋势
                </li>
              </ul>
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setStage('question')} className="btn-primary flex-1">
                开始自评
              </button>
              <button onClick={() => setOpen(false)} className="btn-ghost">
                稍后再说
              </button>
            </div>
          </motion.div>
        )}

        {stage === 'question' && (
          <motion.div key={`q-${index}`} initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }}>
            <div className="mb-4 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sea-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sea-300 to-lav-300 transition-all duration-300"
                  style={{ width: `${((index + (answers[index] !== null ? 1 : 0)) / 7) * 100}%` }}
                />
              </div>
              <span className="text-[11px] tabular-nums text-ink-300">{index + 1} / 7</span>
            </div>

            <p className="font-display text-[17px] font-medium leading-relaxed text-ink-900">{GAD7_ITEMS[index].text}</p>

            <div className="mt-4 space-y-2" role="radiogroup" aria-label={GAD7_ITEMS[index].text}>
              {GAD7_OPTIONS.map((opt) => {
                const active = answers[index] === opt.value
                return (
                  <button
                    key={opt.value}
                    role="radio"
                    aria-checked={active}
                    onClick={() => pick(opt.value)}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-[13.5px] transition ${
                      active
                        ? 'border-sea-300 bg-sea-50 text-ink-900'
                        : 'border-white/70 bg-white/55 text-ink-700 hover:border-sea-200 hover:bg-white/85'
                    }`}
                  >
                    {opt.label}
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                        active ? 'border-sea-400 bg-sea-400 text-white' : 'border-ink-300/60'
                      }`}
                    >
                      {active && <Icon name="check" size={10} strokeWidth={3} />}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mt-4 flex justify-between">
              <button
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
                className="btn-quiet disabled:opacity-30"
              >
                上一题
              </button>
              <button onClick={() => setOpen(false)} className="btn-quiet">
                退出
              </button>
            </div>
          </motion.div>
        )}

        {stage === 'result' && answeredAll && (
          <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex flex-col items-center py-2">
              <div className="relative h-36 w-36">
                <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(148,205,217,0.2)" strokeWidth="8" />
                  <motion.circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke={meta.color}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 52}
                    initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - total / 21) }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-3xl font-semibold tracking-tight text-ink-900">{total}</span>
                  <span className="text-[10px] tracking-[0.16em] text-ink-300">/ 21</span>
                </div>
              </div>
              <p className="mt-3 font-display text-lg font-semibold" style={{ color: meta.color }}>
                {meta.label}焦虑 · {meta.range}
              </p>
              <p className="mt-2 max-w-sm text-center text-[13px] leading-relaxed text-ink-600">{meta.advice}</p>
            </div>

            <div className="mt-4 rounded-2xl border border-white/70 bg-white/55 p-4 text-[11.5px] leading-relaxed text-ink-500">
              {GAD7_DISCLAIMER}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setOpen(false)
                  navigate('/mood')
                }}
                className="btn-primary flex-1"
              >
                查看情绪潮向
              </button>
              <button
                onClick={() => {
                  setOpen(false)
                  navigate('/chat')
                }}
                className="btn-ghost"
              >
                和岛主聊聊
              </button>
              <button onClick={restart} className="btn-quiet">
                重新测
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  )
}
