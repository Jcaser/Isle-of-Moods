import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PATTERNS, buildTimeline, phaseAt, scaleFor } from '../lib/breathing'
import { useAppStore } from '../store/useAppStore'
import { Icon } from './Icons'
import { MoodCheckIn } from './MoodCheckIn'

const DURATIONS = [
  { label: '1 分钟', sec: 60 },
  { label: '3 分钟', sec: 180 },
  { label: '5 分钟', sec: 300 },
]

function playChime(kind: 'in' | 'out' | 'hold') {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = kind === 'in' ? 528 : kind === 'out' ? 396 : 462
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.4)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 1.5)
    osc.onended = () => ctx.close()
  } catch {
    /* 静默失败 */
  }
}

export function BreathingOverlay() {
  const { open, pattern } = useAppStore((s) => s.breathing)
  const close = useAppStore((s) => s.closeBreathing)
  const openBreathing = useAppStore((s) => s.openBreathing)

  const p = PATTERNS[pattern]
  const timeline = useMemo(() => buildTimeline(p), [p])

  const [target, setTarget] = useState(180)
  const [playing, setPlaying] = useState(true)
  const [elapsed, setElapsed] = useState(0)
  const [finished, setFinished] = useState(false)
  const [sound, setSound] = useState(false)

  const orbRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const startRef = useRef<number>(0)
  const baseRef = useRef(0)
  const lastPhase = useRef<string>('')

  const info = phaseAt(p, elapsed)
  const scale = scaleFor(info)

  const reset = useCallback(() => {
    setElapsed(0)
    setFinished(false)
    setPlaying(true)
    baseRef.current = 0
    startRef.current = performance.now()
    lastPhase.current = ''
  }, [])

  useEffect(() => {
    if (!open) return
    reset()
  }, [open, pattern, reset])

  useEffect(() => {
    if (!open || !playing || finished) return
    startRef.current = performance.now() - baseRef.current * 1000
    let lastPaint = 0

    const loop = (now: number) => {
      const e = (now - startRef.current) / 1000
      if (e >= target) {
        setElapsed(target)
        setFinished(true)
        setPlaying(false)
        return
      }
      baseRef.current = e

      // 平滑驱动球体，避免 React 逐帧重渲染
      const cur = phaseAt(p, e * 1000)
      if (orbRef.current) {
        const s = scaleFor(cur)
        orbRef.current.style.transform = `scale(${s.toFixed(4)})`
        orbRef.current.style.opacity = String(0.72 + (s - 0.62) * 0.55)
      }
      if (cur.key !== lastPhase.current) {
        lastPhase.current = cur.key
        if (sound) playChime(cur.key === 'inhale' ? 'in' : cur.key === 'exhale' ? 'out' : 'hold')
      }
      if (now - lastPaint > 90) {
        lastPaint = now
        setElapsed(e)
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [open, playing, finished, target, p, sound])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.code === 'Space') {
        e.preventDefault()
        setPlaying((v) => !v)
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, close])

  const progress = Math.min(1, elapsed / target)
  const cycles = Math.floor((elapsed * 1000) / (timeline.reduce((s, x) => s + x.duration, 0) * 1000))

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="潮汐呼吸引导"
        >
          <div className="absolute inset-0 bg-[radial-gradient(1200px_800px_at_50%_-10%,#e9f6f8_0%,#f2f5fb_45%,#f7f2ea_100%)]" />
          <div className="absolute inset-0 opacity-60">
            <div className="absolute -left-20 top-1/3 h-80 w-80 rounded-full bg-sea-200/40 blur-3xl" />
            <div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-lav-200/40 blur-3xl" />
          </div>

          <div className="relative mx-auto flex min-h-full w-full max-w-3xl flex-col px-5 pb-8 pt-5 sm:px-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sea-500">Tidal Breathing</p>
                <h2 className="mt-1 font-display text-lg font-semibold tracking-tight text-ink-900">{p.name}</h2>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setSound((v) => !v)}
                  className={`btn-quiet h-9 w-9 rounded-full p-0 ${sound ? 'text-sea-600' : ''}`}
                  aria-label={sound ? '关闭提示音' : '开启提示音'}
                  aria-pressed={sound}
                >
                  <Icon name="volume" size={17} />
                </button>
                <button onClick={close} className="btn-quiet h-9 w-9 rounded-full p-0" aria-label="退出呼吸练习">
                  <Icon name="close" size={18} />
                </button>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {Object.values(PATTERNS).map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    openBreathing(item.id)
                  }}
                  className={`rounded-full border px-3 py-1.5 text-[11.5px] transition ${
                    item.id === pattern
                      ? 'border-sea-300 bg-white/85 text-sea-700 shadow-sm'
                      : 'border-white/60 bg-white/40 text-ink-500 hover:bg-white/70'
                  }`}
                >
                  {item.name}
                </button>
              ))}
            </div>

            {!finished ? (
              <>
                <div className="mt-6 flex flex-1 flex-col items-center justify-center py-4">
                  <div className="relative flex h-[19rem] w-[19rem] items-center justify-center sm:h-[22rem] sm:w-[22rem]">
                    {/* 潮汐环 */}
                    <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
                      <circle cx="100" cy="100" r="94" fill="none" stroke="rgba(148,205,217,0.18)" strokeWidth="1" />
                      <circle
                        cx="100"
                        cy="100"
                        r="94"
                        fill="none"
                        stroke="rgba(74,151,170,0.35)"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeDasharray={`${Math.max(progress, 0.002) * 590} 590`}
                        className="transition-[stroke-dasharray] duration-200"
                      />
                      <circle cx="100" cy="100" r="78" fill="none" stroke="rgba(196,185,236,0.35)" strokeWidth="0.8" strokeDasharray="2 6" />
                    </svg>

                    <div
                      ref={orbRef}
                      className="breath-orb absolute h-[14rem] w-[14rem] rounded-full sm:h-[16.5rem] sm:w-[16.5rem]"
                      style={{ transition: 'none', transform: `scale(${scale})` }}
                    />

                    <div className="relative z-10 text-center">
                      <p className="font-display text-[26px] font-medium tracking-[0.18em] text-[#123640]">
                        {info.label}
                      </p>
                      <p className="mt-1 text-3xl font-light tabular-nums text-[#0f2d36]">{info.remaining}</p>
                      <p className="mt-0.5 text-[10px] tracking-[0.2em] text-[#123640]/60">SEC</p>
                    </div>
                  </div>

                  <p className="mt-6 max-w-sm text-center text-[12.5px] leading-relaxed text-ink-500">
                    {info.key === 'inhale' && '用鼻子安静吸气，肩膀不要用力'}
                    {info.key === 'hold' && '轻轻屏住，喉咙放松，不要绷紧'}
                    {info.key === 'exhale' && '用嘴缓慢呼气，像把气吹到很远的地方'}
                    {info.key === 'rest' && '停一下，感受身体的重量'}
                  </p>
                </div>

                <div className="mt-2">
                  <div className="mx-auto h-1 w-full max-w-sm overflow-hidden rounded-full bg-white/60">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sea-300 via-sea-400 to-lav-300 transition-[width] duration-300"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-ink-300">
                    <span>已完成 {cycles} 个循环</span>
                    <span>
                      {Math.floor(elapsed / 60)}:{String(Math.floor(elapsed % 60)).padStart(2, '0')} / {Math.floor(target / 60)}:
                      {String(target % 60).padStart(2, '0')}
                    </span>
                  </div>

                  <div className="mt-5 flex items-center justify-center gap-2">
                    <button onClick={() => setPlaying((v) => !v)} className="btn-primary px-6">
                      <Icon name={playing ? 'pause' : 'play'} size={16} />
                      {playing ? '暂停' : '继续'}
                    </button>
                    <button onClick={reset} className="btn-ghost">
                      <Icon name="refresh" size={16} />
                      重置
                    </button>
                  </div>

                  <div className="mt-4 flex items-center justify-center gap-1.5">
                    {DURATIONS.map((d) => (
                      <button
                        key={d.sec}
                        onClick={() => {
                          setTarget(d.sec)
                          reset()
                        }}
                        className={`rounded-full px-3 py-1 text-[11px] transition ${
                          target === d.sec ? 'bg-white/90 text-ink-900 shadow-sm' : 'text-ink-400 hover:text-ink-700'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-1 flex-col items-center justify-center py-8"
              >
                <div className="relative mb-5 h-24 w-24">
                  <div className="absolute inset-0 rounded-full bg-white/60 blur-xl" />
                  <img src="/brand/icon-256.png" alt="" className="relative h-24 w-24 object-contain animate-float" />
                </div>
                <h3 className="font-display text-2xl font-semibold tracking-tight text-ink-900">
                  {Math.round(target / 60)} 分钟，完成了
                </h3>
                <p className="mt-2 max-w-sm text-center text-[13px] leading-relaxed text-ink-500">
                  {p.name}做完了 {Math.max(cycles, 1)} 个循环。留意一下身体：肩膀有没有松一点，呼吸是不是更深了？
                </p>
                <div className="mt-6 w-full max-w-md">
                  <MoodCheckIn compact onSaved={() => setTimeout(close, 1600)} />
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={reset} className="btn-ghost">
                    再来一轮
                  </button>
                  <button onClick={close} className="btn-primary">
                    回到岛屿
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
