import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { RELIEFS, type Relief } from '../lib/relief'
import { Icon } from './Icons'

type Phase = 'idle' | 'shaking' | 'open'

/** 洗一副牌，抽完一轮再洗 */
function shuffle(ids: string[]) {
  const next = [...ids]
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

/** 盒盖上的蝴蝶结 */
function Bow() {
  return (
    <svg viewBox="0 0 104 50" className="absolute left-1/2 top-0 w-[104px] -translate-x-1/2" aria-hidden>
      <path
        d="M46 19C42 5 23-3 15 5 7 13 24 25 46 23Z"
        fill="#fbe4de"
        stroke="#eeb3a2"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M58 19C62 5 81-3 89 5 97 13 80 25 58 23Z"
        fill="#fbe4de"
        stroke="#eeb3a2"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M45 27C42 33 37 38 30 41l-4-6c6-3 10-7 12-11Z" fill="#fbe4de" stroke="#eeb3a2" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M59 27c3 6 8 11 15 14l4-6c-6-3-10-7-12-11Z" fill="#fbe4de" stroke="#eeb3a2" strokeWidth="1.3" strokeLinejoin="round" />
      <rect x="43" y="14" width="18" height="16" rx="6" fill="#f7cabb" stroke="#eeb3a2" strokeWidth="1.4" />
    </svg>
  )
}

export function ReliefBlindBox() {
  const reduced = useReducedMotion()
  const [phase, setPhase] = useState<Phase>('idle')
  const [drawn, setDrawn] = useState<Relief | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [pulse, setPulse] = useState(0)

  const deck = useRef<string[]>([])
  const last = useRef<string | null>(null)
  const timer = useRef<number | null>(null)

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])

  const draw = useCallback(() => {
    if (phase === 'shaking') return
    if (deck.current.length === 0) {
      const ids = shuffle(RELIEFS.map((r) => r.id))
      if (ids.length > 1 && ids[0] === last.current) [ids[0], ids[1]] = [ids[1], ids[0]]
      deck.current = ids
    }
    const id = deck.current.shift()!
    last.current = id
    const item = RELIEFS.find((r) => r.id === id)
    if (!item) return

    setPhase('shaking')
    timer.current = window.setTimeout(
      () => {
        setDrawn(item)
        setPicked((p) => (p.includes(id) ? p : [...p, id]))
        setPhase('open')
        setPulse((n) => n + 1)
      },
      reduced ? 140 : 620,
    )
  }, [phase, reduced])

  const left = RELIEFS.length - picked.length
  const shake =
    phase === 'shaking' && !reduced
      ? { rotate: [0, -4.5, 4.5, -3.5, 3.5, -1.5, 0], y: [0, -5, 0, -6, 0, -2, 0] }
      : { rotate: 0, y: 0 }

  return (
    <section
      className="relative overflow-hidden rounded-5xl border border-white/70 bg-gradient-to-br from-[#f7fbfc]/90 via-white/60 to-[#f4f1fb]/80 p-5 shadow-soft sm:p-7"
      aria-labelledby="relief-title"
    >
      <div className="pointer-events-none absolute -left-16 top-1/3 h-64 w-64 rounded-full bg-sea-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-14 -top-10 h-56 w-56 rounded-full bg-lav-300/25 blur-3xl" />

      <div className="relative z-10 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-sea-500">
            <Icon name="gift" size={13} />
            A Little Draw
          </p>
          <h2 id="relief-title" className="mt-1.5 font-display text-[19px] font-semibold tracking-tight text-ink-900">
            缓解焦虑的七件小事
          </h2>
          <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-ink-500">
            不用先想清楚从哪儿开始。抽一张，今天只做这一件就好。
          </p>
        </div>
        <p className="tnum text-[11px] text-ink-400">
          {picked.length} / {RELIEFS.length} 已抽到
        </p>
      </div>

      <div className="relative z-10 mt-5 grid items-start gap-6 lg:grid-cols-[0.76fr_1.24fr]">
        {/* ── 盲盒 ── */}
        <div className="flex flex-col items-center">
          <div className="relative mt-1">
            <div className="pointer-events-none absolute -inset-8 rounded-full bg-gradient-to-b from-white/80 to-transparent blur-2xl" />
            <div className={reduced ? 'relative' : 'relative animate-float'}>
              <motion.button
                type="button"
                onClick={draw}
                animate={shake}
                transition={{ duration: 0.72, ease: 'easeInOut' }}
                aria-label={phase === 'open' ? '再抽一张' : '抽一张缓解焦虑的小事'}
                className="group relative block h-[168px] w-[184px] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-sea-400/60 focus-visible:ring-offset-4 focus-visible:ring-offset-transparent"
              >
                {/* 盒身 */}
                <span className="absolute bottom-0 left-0 block h-[124px] w-full overflow-hidden rounded-[20px] bg-gradient-to-b from-[#a9dbe5] via-[#8ac7d4] to-[#69a9ba] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_20px_32px_-22px_rgba(28,70,86,0.65)] transition-transform duration-300 group-hover:-translate-y-0.5">
                  <span className="absolute left-1/2 top-0 block h-full w-[28px] -translate-x-1/2 bg-white/45" />
                  <span className="absolute inset-x-0 bottom-0 block h-[45%] bg-gradient-to-t from-[#4b8fa0]/30 to-transparent" />
                  <span
                    className={`absolute inset-x-0 top-0 block h-8 bg-gradient-to-b from-white/75 to-transparent transition-opacity duration-500 ${
                      phase === 'open' ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                </span>

                {/* 盒盖（含蝴蝶结） */}
                <motion.span
                  className="absolute left-[-7px] top-[22px] block h-[54px] w-[calc(100%+14px)]"
                  style={{ transformOrigin: '50% 92%' }}
                  animate={
                    phase === 'open'
                      ? reduced
                        ? { opacity: 0 }
                        : { y: -62, rotate: -17, opacity: 0 }
                      : { y: 0, rotate: 0, opacity: 1 }
                  }
                  transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
                >
                  <span className="absolute inset-x-0 top-[8px] block h-[40px] overflow-hidden rounded-[12px] bg-gradient-to-b from-[#c1e9ef] to-[#7ec2d0] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_18px_-12px_rgba(28,70,86,0.6)]">
                    <span className="absolute left-1/2 top-0 block h-full w-[28px] -translate-x-1/2 bg-white/50" />
                  </span>
                  <Bow />
                </motion.span>

                {/* 盒身正面小签 */}
                <span className="absolute bottom-[30px] left-1/2 -translate-x-1/2 rounded-full border border-white/60 bg-white/70 px-3 py-1 text-[10.5px] font-semibold tracking-[0.16em] text-sea-700 backdrop-blur-sm">
                  {phase === 'open' ? '再抽一张' : '抽一张'}
                </span>

                {/* 光点 */}
                {!reduced && (
                  <>
                    <motion.span
                      key={`s1-${pulse}`}
                      className="absolute -right-2 top-[30px] h-1.5 w-1.5 rounded-full bg-lav-300"
                      animate={{ y: [0, -8, 0], opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.span
                      key={`s2-${pulse}`}
                      className="absolute -left-3 top-[86px] h-1 w-1 rounded-full bg-sea-300"
                      animate={{ y: [0, -10, 0], opacity: [0.25, 0.9, 0.25] }}
                      transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
                    />
                  </>
                )}
              </motion.button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button onClick={draw} className="btn-primary px-4 py-2.5 text-[12.5px]" disabled={phase === 'shaking'}>
              <Icon name="sparkles" size={14} />
              {phase === 'open' ? '再抽一张' : '摇一摇，抽一张'}
            </button>
            {phase === 'open' && (
              <button onClick={() => setPhase('idle')} className="btn-ghost px-3.5 py-2.5 text-[12px]">
                收好
              </button>
            )}
          </div>
          <p className="mt-2.5 text-center text-[10.5px] leading-relaxed text-ink-300">
            {left > 0 ? `盒子里还有 ${left} 件没抽到` : '七件都抽过了，可以再来一轮'}
          </p>

        </div>

        {/* ── 结果 / 抽屉 ── */}
        <div className="relative">
          <AnimatePresence mode="wait" initial={false}>
            {drawn && phase !== 'idle' ? (
              <motion.article
                key={drawn.id}
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.975 }}
                animate={
                  reduced
                    ? { opacity: 1 }
                    : phase === 'shaking'
                      ? { opacity: 0.45, y: 0, scale: 0.985 }
                      : { opacity: 1, y: 0, scale: 1 }
                }
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.99 }}
                transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden rounded-4xl border border-white/80 bg-white/85 shadow-float backdrop-blur"
              >
                <div className="relative aspect-[16/9] overflow-hidden">
                  <img
                    src={drawn.src}
                    alt={drawn.alt}
                    width={900}
                    height={506}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#12222b]/65 via-[#12222b]/10 to-transparent" />
                  <span className="absolute left-3.5 top-3.5 rounded-full border border-white/50 bg-white/85 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-sea-700 backdrop-blur">
                    {drawn.tag}
                  </span>
                  <h3 className="absolute bottom-3.5 left-4 font-display text-[21px] font-semibold tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.35)]">
                    {drawn.title}
                  </h3>
                </div>

                <div className="p-4 sm:p-5">
                  <p className="text-[12.5px] leading-relaxed text-ink-600">{drawn.intro}</p>
                  <ol className="mt-3 space-y-2">
                    {drawn.steps.map((s, i) => (
                      <li key={s} className="flex gap-2.5 text-[12px] leading-relaxed text-ink-600">
                        <span className="mt-[1px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-sea-100 text-[10px] font-semibold text-sea-700">
                          {i + 1}
                        </span>
                        {s}
                      </li>
                    ))}
                  </ol>
                  <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-ink-900/[0.06] pt-3">
                    <p className="text-[10.5px] text-ink-300">
                      {left > 0 ? `还剩 ${left} 件没抽到` : '这一轮抽完了'}
                    </p>
                    <button onClick={draw} className="text-[11.5px] font-medium text-sea-600 transition hover:text-sea-700">
                      再来一件 →
                    </button>
                  </div>
                </div>
              </motion.article>
            ) : (
              <motion.div
                key="drawer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="rounded-4xl border border-dashed border-sea-200/80 bg-white/40 px-3.5 py-5 sm:px-5"
              >
                <p className="text-center text-[12px] text-ink-500">
                  {picked.length === 0 ? '盒子里装着这七件小事' : '抽到过的都留在这儿了'}
                </p>
                <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {RELIEFS.map((r) => {
                    const got = picked.includes(r.id)
                    return (
                      <div key={r.id} className="flex flex-col items-center gap-1.5">
                        <div
                          className={`relative aspect-square w-full overflow-hidden rounded-2xl border bg-white/60 ${
                            got ? 'border-white shadow-sm' : 'border-white/70'
                          }`}
                        >
                          <img
                            src={r.src}
                            alt={got ? r.title : '还没抽到的小事'}
                            loading="lazy"
                            className={`h-full w-full object-cover transition-all duration-500 ${
                              got ? 'scale-100 blur-0' : 'scale-110 blur-[5px] brightness-105 saturate-50'
                            }`}
                          />
                          {!got && <span className="absolute inset-0 bg-white/25" />}
                          {!got && (
                            <span className="absolute inset-0 flex items-center justify-center">
                              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/70 bg-white/80 text-[12px] font-semibold text-sea-600 shadow-sm">
                                ?
                              </span>
                            </span>
                          )}
                        </div>
                        <span className={`text-[9.5px] leading-none ${got ? 'text-ink-500' : 'text-ink-300'}`}>
                          {got ? r.title : '···'}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <p className="mt-4 text-center text-[10.5px] leading-relaxed text-ink-300">
                  焦虑的时候不用挑最优解，随便一件，做三分钟就停。
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
