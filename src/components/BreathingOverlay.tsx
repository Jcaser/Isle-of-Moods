import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PATTERNS, PHASE_SHORT, PHASE_TIP, buildTimeline, breathLevel, phaseAt } from '../lib/breathing'
import { useAppStore } from '../store/useAppStore'
import { Icon } from './Icons'
import { MoodCheckIn } from './MoodCheckIn'

const DURATIONS = [
  { label: '1 分钟', sec: 60 },
  { label: '3 分钟', sec: 180 },
  { label: '5 分钟', sec: 300 },
]

const PHASE_COLOR: Record<string, string> = {
  inhale: '#6fb9c7',
  hold: '#a99be0',
  exhale: '#7fb6a6',
  rest: '#d9c49c',
}

/** 极轻的提示音，全部实时合成 */
let audioCtx: AudioContext | null = null
function playChime(kind: 'in' | 'out' | 'hold') {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    if (!audioCtx) audioCtx = new Ctx()
    const ctx = audioCtx
    if (ctx.state === 'suspended') void ctx.resume()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = kind === 'in' ? 528 : kind === 'out' ? 396 : 462
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.045, ctx.currentTime + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.5)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 1.6)
  } catch {
    /* 静默失败 */
  }
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) return
  try {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'zh-CN'
    u.rate = 0.9
    u.pitch = 1.04
    u.volume = 0.85
    speechSynthesis.speak(u)
  } catch {
    /* 静默失败 */
  }
}

/** 海面随呼吸涨落：吸气时潮位上升，呼气时退去 */
function paintTide(ctx: CanvasRenderingContext2D, w: number, h: number, level: number, t: number) {
  ctx.clearRect(0, 0, w, h)
  const base = h * (0.84 - level * 0.055)
  const layers = [
    { amp: 12, y: 0, alpha: 0.22, speed: 0.55, color: '#a6d6e1' },
    { amp: 16, y: 20, alpha: 0.26, speed: 0.38, color: '#84c6d6' },
    { amp: 10, y: 44, alpha: 0.3, speed: 0.72, color: '#6cb2c7' },
  ]

  layers.forEach((l, i) => {
    const y = base + l.y + level * i * 4
    ctx.beginPath()
    ctx.moveTo(0, y)
    for (let x = 0; x <= w; x += 10) {
      const wave =
        Math.sin(x * 0.0045 + t * l.speed + i * 1.7) * (l.amp + level * 7) +
        Math.sin(x * 0.011 - t * l.speed * 0.8) * l.amp * 0.32
      ctx.lineTo(x, y + wave)
    }
    ctx.lineTo(w, h)
    ctx.lineTo(0, h)
    ctx.closePath()
    const g = ctx.createLinearGradient(0, y - 20, 0, h)
    g.addColorStop(0, l.color)
    g.addColorStop(1, '#eef8fa')
    ctx.globalAlpha = l.alpha
    ctx.fillStyle = g
    ctx.fill()
    ctx.globalAlpha = 1
  })
}

export function BreathingOverlay() {
  const { open, pattern } = useAppStore((s) => s.breathing)
  const close = useAppStore((s) => s.closeBreathing)
  const openBreathing = useAppStore((s) => s.openBreathing)

  const p = PATTERNS[pattern]
  const timeline = useMemo(() => buildTimeline(p), [p])
  const cycleLen = useMemo(() => timeline.reduce((s, x) => s + x.duration, 0), [timeline])

  const [target, setTarget] = useState(180)
  const [playing, setPlaying] = useState(true)
  const [elapsed, setElapsed] = useState(0)
  const [finished, setFinished] = useState(false)
  const [sound, setSound] = useState(false)
  const [voice, setVoice] = useState(false)

  const orbRef = useRef<HTMLDivElement>(null)
  const haloRef = useRef<HTMLDivElement>(null)
  const arcRef = useRef<SVGCircleElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const startRef = useRef<number>(0)
  const baseRef = useRef(0)
  const levelRef = useRef(0)
  const lastPhase = useRef<string>('')

  const info = phaseAt(p, elapsed * 1000)
  const cycleProgress = Math.min(1, elapsed / target)

  const reset = useCallback(() => {
    setElapsed(0)
    setFinished(false)
    setPlaying(true)
    baseRef.current = 0
    levelRef.current = 0
    startRef.current = performance.now()
    lastPhase.current = ''
  }, [])

  useEffect(() => {
    if (!open) return
    reset()
  }, [open, pattern, reset])

  // 画布尺寸（跟随窗口与 DPR）
  useEffect(() => {
    if (!open) return
    const resize = () => {
      const cv = canvasRef.current
      if (!cv) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      cv.width = Math.floor(window.innerWidth * dpr)
      cv.height = Math.floor(window.innerHeight * dpr)
      const ctx = cv.getContext('2d')
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [open])

  // 主循环：一个时钟同时驱动球体、相位弧、海面
  useEffect(() => {
    if (!open || finished) return
    const cv = canvasRef.current
    const ctx = cv?.getContext('2d') ?? null
    startRef.current = performance.now() - baseRef.current * 1000
    let lastPaint = 0

    const render = (e: number, now: number) => {
      const cur = phaseAt(p, e * 1000)
      const level = breathLevel(cur)
      levelRef.current = level

      if (orbRef.current) orbRef.current.style.transform = `scale(${(0.56 + level * 0.5).toFixed(4)})`
      if (haloRef.current) {
        haloRef.current.style.transform = `scale(${(0.66 + level * 0.62).toFixed(4)})`
        haloRef.current.style.opacity = String(0.22 + level * 0.5)
      }
      if (arcRef.current) {
        const C = 2 * Math.PI * 86
        arcRef.current.style.strokeDashoffset = String(C * cur.progress)
        arcRef.current.style.stroke = PHASE_COLOR[cur.key] ?? '#6fb9c7'
      }
      if (ctx && cv) {
        paintTide(ctx, cv.width / (Math.min(2, window.devicePixelRatio || 1)), cv.height / (Math.min(2, window.devicePixelRatio || 1)), level, now / 1000)
      }

      if (cur.key !== lastPhase.current) {
        lastPhase.current = cur.key
        if (sound) playChime(cur.key === 'inhale' ? 'in' : cur.key === 'exhale' ? 'out' : 'hold')
        if (voice) speak(cur.key === 'inhale' ? '吸气' : cur.key === 'exhale' ? '呼气' : cur.key === 'hold' ? '屏息' : '停留')
      }
    }

    const loop = (now: number) => {
      if (!playing) {
        // 暂停时画面继续轻微流动，但时间不前进
        render(baseRef.current, now)
        rafRef.current = requestAnimationFrame(loop)
        return
      }
      const e = (now - startRef.current) / 1000
      if (e >= target) {
        setElapsed(target)
        setFinished(true)
        setPlaying(false)
        baseRef.current = target
        return
      }
      baseRef.current = e
      render(e, now)
      if (now - lastPaint > 90) {
        lastPaint = now
        setElapsed(e)
      }
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [open, playing, finished, target, p, sound, voice])

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
      if ('speechSynthesis' in window) speechSynthesis.cancel()
    }
  }, [open, close])

  const cycles = cycleLen ? Math.floor(elapsed / cycleLen) : 0
  const phaseColor = PHASE_COLOR[info.key] ?? '#6fb9c7'

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
          <div className="absolute inset-0 bg-[radial-gradient(1300px_900px_at_50%_-12%,#eaf7f9_0%,#f1f5fb_46%,#f8f2e8_100%)]" />
          <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-0 opacity-55">
            <div className="absolute -left-24 top-1/4 h-80 w-80 rounded-full bg-sea-200/40 blur-3xl" />
            <div className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-lav-200/40 blur-3xl" />
          </div>

          <div className="relative mx-auto flex min-h-full w-full max-w-3xl flex-col px-5 pb-10 pt-5 sm:px-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sea-500">Tidal Breathing</p>
                <h2 className="mt-1 font-display text-lg font-semibold tracking-tight text-ink-900">{p.name}</h2>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setSound((v) => !v)
                    if (!sound) playChime('in')
                  }}
                  className={`btn-quiet h-9 w-9 rounded-full p-0 ${sound ? 'bg-white/90 text-sea-600' : ''}`}
                  aria-label={sound ? '关闭提示音' : '开启提示音'}
                  aria-pressed={sound}
                  title="提示音"
                >
                  <Icon name="volume" size={17} />
                </button>
                <button
                  onClick={() => {
                    setVoice((v) => !v)
                    if (!voice) speak('跟着我的声音呼吸')
                    else if ('speechSynthesis' in window) speechSynthesis.cancel()
                  }}
                  className={`btn-quiet h-9 w-9 rounded-full p-0 ${voice ? 'bg-white/90 text-lav-500' : ''}`}
                  aria-label={voice ? '关闭语音引导' : '开启语音引导'}
                  aria-pressed={voice}
                  title="语音引导"
                >
                  <Icon name="mic" size={16} />
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
                  onClick={() => openBreathing(item.id)}
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
                <div className="mt-4 flex flex-1 flex-col items-center justify-center py-2">
                  <div className="relative h-[19rem] w-[19rem] sm:h-[22rem] sm:w-[22rem]">
                    {/* 会话进度 */}
                    <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
                      <circle cx="100" cy="100" r="94" fill="none" stroke="rgba(148,205,217,0.16)" strokeWidth="1" />
                      <circle
                        cx="100"
                        cy="100"
                        r="94"
                        fill="none"
                        stroke="rgba(74,151,170,0.32)"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeDasharray={`${Math.max(cycleProgress, 0.002) * 590} 590`}
                      />
                      {/* 当前相位：一圈会被“用掉”的弧 */}
                      <circle
                        ref={arcRef}
                        cx="100"
                        cy="100"
                        r="86"
                        fill="none"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 86}
                        style={{ transition: 'stroke 0.5s ease' }}
                      />
                    </svg>

                    {/* 光晕：跟随呼吸扩张与收拢 */}
                    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                      <div
                        ref={haloRef}
                        className="h-[13rem] w-[13rem] rounded-full sm:h-[15rem] sm:w-[15rem]"
                        style={{
                          background: `radial-gradient(circle, ${phaseColor}55 0%, ${phaseColor}22 46%, transparent 72%)`,
                          filter: 'blur(6px)',
                          transition: 'background 0.6s ease',
                        }}
                      />
                    </div>

                    {/* 球体 */}
                    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                      <div
                        ref={orbRef}
                        className="breath-orb h-[14rem] w-[14rem] rounded-full sm:h-[16.5rem] sm:w-[16.5rem]"
                        style={{ transition: 'none', transform: 'scale(0.56)' }}
                      />
                    </div>

                    <div className="relative z-10 flex h-full flex-col items-center justify-center text-center">
                      <p
                        className="font-display text-[27px] font-medium tracking-[0.2em] transition-colors duration-500 sm:text-[30px]"
                        style={{ color: '#0f2d36' }}
                      >
                        {info.label}
                      </p>
                      <p className="tnum mt-1 text-[34px] font-light leading-none text-[#0b262e] sm:text-[38px]">
                        {info.remaining}
                      </p>
                      <p className="mt-1 text-[9.5px] tracking-[0.28em] text-[#123640]/55">SECONDS</p>
                    </div>
                  </div>

                  <p className="mt-5 max-w-sm text-center text-[12.5px] leading-relaxed text-ink-500">
                    {PHASE_TIP[info.key]}
                  </p>

                  {/* 节奏条：吸 → 屏 → 呼 的比例与当前进度一眼可见 */}
                  <div className="mt-6 w-full max-w-sm">
                    <div className="mb-1.5 flex items-center justify-between text-[10px] text-ink-300">
                      <span className="tracking-[0.16em]">这个周期的节奏</span>
                      <span className="tnum">第 {info.cycle} 轮</span>
                    </div>
                    <div className="flex items-stretch gap-1.5">
                      {timeline.map((seg, i) => {
                        const on = i === info.index
                        return (
                          <div key={seg.key} style={{ flexGrow: seg.duration, flexBasis: 0 }}>
                            <div
                              className="h-2 overflow-hidden rounded-full"
                              style={{ background: on ? `${PHASE_COLOR[seg.key]}2e` : 'rgba(148,205,217,0.16)' }}
                            >
                              <div
                                className="h-full rounded-full transition-[width] duration-150 ease-linear"
                                style={{
                                  width: `${(on ? info.progress : i < info.index ? 1 : 0) * 100}%`,
                                  background: PHASE_COLOR[seg.key],
                                  opacity: on ? 1 : 0.45,
                                }}
                              />
                            </div>
                            <p
                              className={`mt-1.5 text-center text-[11px] leading-none transition ${
                                on ? 'font-semibold text-ink-800' : 'text-ink-400'
                              }`}
                            >
                              {PHASE_SHORT[seg.key]}
                              <span className="ml-0.5 text-[9.5px] font-normal text-ink-300">{seg.duration}s</span>
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-1">
                  <div className="mx-auto h-1 w-full max-w-sm overflow-hidden rounded-full bg-white/60">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sea-300 via-sea-400 to-lav-300 transition-[width] duration-300"
                      style={{ width: `${cycleProgress * 100}%` }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-ink-300">
                    <span>已完成 {cycles} 个循环</span>
                    <span className="tnum">
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
                  <img src="/brand/icon-256.png" alt="" className="relative h-24 w-24 animate-float object-contain" />
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
