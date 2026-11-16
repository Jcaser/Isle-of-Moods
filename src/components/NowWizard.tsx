import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  COMPANY,
  KNOTS,
  copyText,
  wizardResult,
  type Company,
  type Knot,
  type WizardAction,
} from '../lib/harbor'
import { useAppStore } from '../store/useAppStore'
import { Icon } from './Icons'

const KEY = 'sereneisle.v1.harbor-checklist'

interface Stored {
  date: string
  done: string[]
}

const today = () => new Date().toISOString().slice(0, 10)

/** 「现在这一刻」向导：三个问题，换一张能立刻照着做的清单 */
export function NowWizard() {
  const openBreathing = useAppStore((s) => s.openBreathing)
  const navigate = useNavigate()

  const [knot, setKnot] = useState<Knot | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [done, setDone] = useState<string[]>([])
  const [copied, setCopied] = useState<string | null>(null)

  const result = useMemo(() => wizardResult(knot, company), [knot, company])
  const step = !knot ? 1 : !company ? 2 : 3

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Stored
      if (parsed.date === today()) setDone(parsed.done ?? [])
    } catch {
      /* 忽略 */
    }
  }, [])

  const persist = (next: string[]) => {
    setDone(next)
    try {
      localStorage.setItem(KEY, JSON.stringify({ date: today(), done: next }))
    } catch {
      /* 忽略 */
    }
  }

  const toggle = (text: string) => {
    persist(done.includes(text) ? done.filter((d) => d !== text) : [...done, text])
  }

  const run = async (a: WizardAction) => {
    if (a.kind === 'breathe' && a.pattern) openBreathing(a.pattern)
    if (a.kind === 'plan') navigate('/mood')
    if (a.kind === 'copy' && a.text) {
      const ok = await copyText(a.text)
      setCopied(ok ? a.text : '复制失败，手动选中也可以')
      window.setTimeout(() => setCopied(null), 2200)
    }
  }

  const reset = () => {
    setKnot(null)
    setCompany(null)
  }

  return (
    <section className="overflow-hidden rounded-5xl border border-white/75 bg-white/58 p-5 shadow-soft backdrop-blur sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sea-500">Right Now</p>
          <h2 className="mt-1 font-display text-[17px] font-semibold tracking-tight text-ink-900">现在这一刻</h2>
        </div>
        <div className="flex items-center gap-1.5 pt-1">
          {[1, 2, 3].map((s) => (
            <span
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                step === s ? 'w-5 bg-sea-500' : step > s ? 'w-1.5 bg-sea-300' : 'w-1.5 bg-ink-300/30'
              }`}
            />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="q1" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
            <p className="mt-3 text-[12.5px] leading-relaxed text-ink-500">先不管为什么。现在最难受的是哪一部分？</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {KNOTS.map((k) => (
                <button
                  key={k.id}
                  onClick={() => setKnot(k.id)}
                  className="rounded-3xl border border-white/80 bg-white/65 px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-sea-300 hover:bg-white/90"
                >
                  <p className="text-[12.5px] font-medium text-ink-900">{k.label}</p>
                  <p className="mt-0.5 text-[10.5px] leading-relaxed text-ink-400">{k.hint}</p>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="q2" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
            <p className="mt-3 text-[12.5px] leading-relaxed text-ink-500">此刻，你身边有人吗？</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {COMPANY.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCompany(c.id)}
                  className="rounded-3xl border border-white/80 bg-white/65 px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-sea-300 hover:bg-white/90"
                >
                  <p className="text-[12.5px] font-medium text-ink-900">{c.label}</p>
                  <p className="mt-0.5 text-[10.5px] text-ink-400">{c.hint}</p>
                </button>
              ))}
            </div>
            <button onClick={() => setKnot(null)} className="mt-3 text-[11px] text-ink-300 hover:text-ink-500">
              ← 上一个问题
            </button>
          </motion.div>
        )}

        {step === 3 && result && (
          <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h3 className="mt-3 font-display text-[16px] font-semibold leading-snug tracking-tight text-ink-900">
              {result.title}
            </h3>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-500">{result.lead}</p>

            <div className="mt-3.5 flex flex-wrap gap-2">
              {result.actions.map((a) =>
                a.kind === 'call' ? (
                  <a key={a.label} href={`tel:${a.phone?.replace(/-/g, '')}`} className="btn-primary px-4 py-2 text-[12px]">
                    <Icon name="lifebuoy" size={13} />
                    {a.label}
                  </a>
                ) : (
                  <button key={a.label} onClick={() => void run(a)} className="btn-ghost px-3.5 py-2 text-[12px]">
                    <Icon name={a.kind === 'breathe' ? 'wave' : a.kind === 'plan' ? 'feather' : 'send'} size={13} />
                    {a.label}
                  </button>
                ),
              )}
              <button onClick={reset} className="btn-quiet px-2 text-[11px]">
                重新选
              </button>
            </div>



            <p className="mt-3.5 flex items-center gap-1.5 text-[10.5px] font-semibold tracking-wide text-sea-600">
              <Icon name="clock" size={12} />
              接下来 10 分钟，按顺序做
            </p>
            <ul className="mt-2 space-y-1.5">
              {result.steps.map((s, i) => {
                const on = done.includes(s)
                return (
                  <li key={s}>
                    <button
                      onClick={() => toggle(s)}
                      className={`flex w-full items-start gap-2.5 rounded-2xl px-3 py-2 text-left transition ${
                        on ? 'bg-sea-50/80' : 'bg-white/50 hover:bg-white/80'
                      }`}
                      aria-pressed={on}
                    >
                      <span
                        className={`mt-0.5 flex shrink-0 items-center justify-center rounded-full border text-[9px] ${
                          on ? 'border-sea-400 bg-sea-400 text-white' : 'border-ink-300/50 text-ink-300'
                        }`}
                        style={{ height: 18, width: 18 }}
                      >
                        {on ? <Icon name="check" size={10} /> : i + 1}
                      </span>
                      <span className={`text-[11.5px] leading-[1.7] ${on ? 'text-ink-400 line-through' : 'text-ink-600'}`}>
                        {s}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>

            {copied && (
              <p className="mt-2 rounded-xl bg-sea-50 px-3 py-2 text-[10.5px] leading-relaxed text-sea-700">
                {copied === '复制失败，手动选中也可以' ? copied : `已复制：${copied}`}
              </p>
            )}
            {done.length > 0 && (
              <p className="mt-2 text-[10px] text-ink-300">
                今天已经完成 {done.length} / {result.steps.length} 步。做不完也没关系，做到哪算哪。
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
