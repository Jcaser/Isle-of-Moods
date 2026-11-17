import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  QUICK_STATES,
  RHYTHM_LABEL,
  STATE_META,
  buildReport,
  describeSpec,
  detectState,
  openingLine,
  planFor,
  type BreathPlan,
  type BreathReport,
} from '../lib/breath'
import { readState, reflect, type CoachRead } from '../lib/breathCoach'
import {
  clearBreathSessions,
  deriveBreathProfile,
  loadBreathSessions,
  memoryLine,
  recordSession,
  type BreathSession,
} from '../lib/breathProfile'
import { isASRSupported, startRecognition } from '../lib/tts'
import { useAppStore } from '../store/useAppStore'
import { BreathDossier } from './BreathDossier'
import { BreathReportCard } from './BreathReportCard'
import { Icon } from './Icons'

type Phase = 'ask' | 'thinking' | 'plan' | 'done'

const DURATIONS = [
  { label: '1 分钟', sec: 60 },
  { label: '2 分钟', sec: 120 },
  { label: '3 分钟', sec: 180 },
  { label: '5 分钟', sec: 300 },
]

const SEG_COLOR: Record<string, string> = {
  inhale: '#6fb9c7',
  hold: '#a99be0',
  exhale: '#7fb6a6',
  rest: '#d9c49c',
}

const SEG_LABEL: Record<string, string> = { inhale: '吸', hold: '屏', exhale: '呼', rest: '停' }

function RhythmBars({ plan }: { plan: BreathPlan }) {
  const segs = [
    { key: 'inhale', v: plan.spec.inhale },
    { key: 'hold', v: plan.spec.hold },
    { key: 'exhale', v: plan.spec.exhale },
    { key: 'rest', v: plan.spec.holdAfter ?? 0 },
  ].filter((s) => s.v > 0)

  return (
    <div className="flex items-stretch gap-1.5">
      {segs.map((s) => (
        <div key={s.key} style={{ flexGrow: s.v, flexBasis: 0 }}>
          <div className="h-7 overflow-hidden rounded-lg" style={{ background: `${SEG_COLOR[s.key]}22` }}>
            <div className="flex h-full items-center justify-center" style={{ background: `${SEG_COLOR[s.key]}2e` }}>
              <span className="text-[11px] font-semibold" style={{ color: SEG_COLOR[s.key] }}>
                {SEG_LABEL[s.key]}
                <span className="ml-0.5 text-[10px] font-normal opacity-80">{s.v}s</span>
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function BreathCompanion() {
  const settings = useAppStore((s) => s.settings)
  const openBreathPlan = useAppStore((s) => s.openBreathPlan)

  const [sessions, setSessions] = useState<BreathSession[]>(() => loadBreathSessions())
  const [phase, setPhase] = useState<Phase>('ask')
  const [text, setText] = useState('')
  const [read, setRead] = useState<CoachRead | null>(null)
  const [plan, setPlan] = useState<BreathPlan | null>(null)
  const [duration, setDuration] = useState(180)
  const [report, setReport] = useState<BreathReport | null>(null)
  const [nth, setNth] = useState(0)
  const [reflectLine, setReflectLine] = useState<string | null>(null)
  const [listening, setListening] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const alive = useRef(true)
  const recRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      recRef.current?.()
    }
  }, [])

  const profile = useMemo(() => deriveBreathProfile(sessions), [sessions])
  const memory = profile.total > 0
  const lastMemory = useMemo(() => memoryLine(profile), [profile])
  const cfg = useMemo(
    () => ({ baseUrl: settings.baseUrl, apiKey: settings.apiKey, model: settings.model, temperature: settings.temperature }),
    [settings.baseUrl, settings.apiKey, settings.model, settings.temperature],
  )

  const analyze = async (input: string) => {
    const content = input.trim()
    if (!content) return
    setText(content)
    // 先用本地关键词给一个即时判断，模型回来后再覆盖——不用干等
    setRead({ detection: detectState(content), reply: '', source: 'local' })
    setPhase('thinking')
    const res = await readState(content, cfg)
    if (!alive.current) return
    const next = planFor(res.detection.state, profile)
    setRead(res)
    setPlan(next)
    setDuration(next.target)
    setPhase('plan')
  }

  const start = () => {
    if (!plan) return
    const finalPlan: BreathPlan = { ...plan, target: duration }
    openBreathPlan(finalPlan, (outcome) => {
      const list = recordSession(outcome)
      const nextProfile = deriveBreathProfile(list)
      setSessions(list)
      setNth(nextProfile.total)
      setReport(buildReport(outcome, nextProfile))
      setReflectLine(null)
      setPhase('done')
      void reflect(
        outcome,
        { before: text, feedbacks: outcome.feedbacks.length, total: nextProfile.total },
        cfg,
      ).then((line) => {
        if (line && alive.current) setReflectLine(line)
      })
    })
  }

  const reset = () => {
    setPhase('ask')
    setText('')
    setRead(null)
    setPlan(null)
    setReport(null)
    setReflectLine(null)
  }

  /** 用档案里上一次的节奏直接开局，不用重新描述 */
  const reuseLast = () => {
    const last = sessions[0]
    if (!last) return
    const plan: BreathPlan = {
      key: last.planKey,
      name: last.planName,
      state: last.state,
      spec: last.spec ?? { inhale: 4, hold: 0, exhale: 6 },
      target: last.target,
      rhythm: last.rhythm,
      focus: '和上次一样，觉得不对随时说一声',
      reason: '这组是你上次练完时留下的，身体已经认得这个节奏，不用再重新适应。',
      adapted: '来自你的呼吸档案，不用重新描述状态。',
    }
    setText(`沿用上次：${last.planName}`)
    setRead({
      detection: { state: last.state, intensity: 3, hits: [], confidence: 1 },
      reply: '好，那我们就用上次那组。中途想改，说一声就行。',
      source: 'local',
    })
    setPlan(plan)
    setDuration(plan.target)
    setPhase('plan')
  }

  const toggleMic = () => {
    if (listening) {
      recRef.current?.()
      recRef.current = null
      setListening(false)
      return
    }
    if (!isASRSupported()) {
      window.alert('这个浏览器不支持语音输入，用 Chrome / Edge 可以试试。')
      return
    }
    setListening(true)
    recRef.current = startRecognition(
      (chunk) => setText((prev) => (prev + chunk).slice(0, 120)),
      () => {
        setListening(false)
        recRef.current = null
      },
    )
  }

  const meta = read ? STATE_META[read.detection.state] : null
  const reply = read?.reply || (read ? openingLine(read.detection, memory) : '')

  return (
    <div className="grid gap-4 lg:grid-cols-[1.52fr_0.9fr]">
      <div className="space-y-4">
        <section className="overflow-hidden rounded-5xl border border-white/75 bg-white/58 p-5 shadow-soft backdrop-blur sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <img src="/brand/icon-128.png" alt="" className="h-9 w-9 object-contain" />
              <div>
                <p className="font-display text-[14.5px] font-semibold tracking-tight text-ink-900">岛主 · 呼吸陪伴</p>
                <p className="mt-0.5 text-[10px] tracking-wide text-ink-400">
                  {read?.source === 'model' ? '正在读懂你的描述' : memory ? '记得你的节奏' : '先听你说，再配节奏'}
                </p>
              </div>
            </div>
            <span className="chip text-[10px]">
              <span className={`h-1.5 w-1.5 rounded-full ${read?.source === 'model' ? 'bg-sea-400' : 'bg-ink-300'}`} />
              {read?.source === 'model' ? '大模型识别' : '本地规则'}
            </span>
          </div>

          {/* 岛主的第一句 */}
          <div className="mt-4 flex gap-2.5">
            <div className="mt-0.5 h-7 w-7 shrink-0 overflow-hidden rounded-full bg-sea-100">
              <img src="/brand/icon-64.png" alt="" className="h-full w-full object-contain p-0.5" />
            </div>
            <div className="rounded-3xl rounded-tl-lg bg-white/80 px-4 py-3">
              <p className="text-[13px] leading-[1.85] text-ink-700">
                {phase === 'ask' ? '今天感觉怎么样？可以和我说说，说不清也没关系。' : reply}
              </p>
              {phase === 'ask' && (
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-400">
                  你说一句，我判断状态，再给你配一组节奏和时长——不用自己在列表里挑。
                </p>
              )}
              {phase !== 'ask' && read && read.detection.hits.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {read.detection.hits.map((h) => (
                    <span key={h} className="rounded-full bg-sea-50 px-2 py-0.5 text-[10px] text-sea-700">
                      {h}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 用户说的一句 */}
          <AnimatePresence>
            {phase !== 'ask' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex justify-end"
              >
                <div className="max-w-[85%] rounded-3xl rounded-tr-lg bg-gradient-to-br from-sea-100 to-lav-100/80 px-4 py-2.5">
                  <p className="text-[12.5px] leading-relaxed text-ink-800">{text}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {phase === 'ask' && (
            <>
              {lastMemory && (
                <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-2xl border border-lav-200/60 bg-lav-50/60 px-3.5 py-2.5">
                  <p className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-ink-600">{lastMemory}</p>
                  <button onClick={reuseLast} className="btn-ghost shrink-0 px-3 py-1.5 text-[11px]">
                    <Icon name="play" size={11} />
                    就用上次那组
                  </button>
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-1.5">
                {QUICK_STATES.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => void analyze(q.text)}
                    className="rounded-full border border-white/80 bg-white/55 px-3 py-1.5 text-[11.5px] text-ink-500 transition hover:bg-white/90 hover:text-ink-800"
                  >
                    {q.text}
                  </button>
                ))}
              </div>

              <div className="mt-3 rounded-3xl border border-white/80 bg-white/65 p-2.5">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 120))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void analyze(text)
                    }
                  }}
                  rows={2}
                  placeholder="比如：我现在有点慌，心跳很快 / 明天考试，静不下来…"
                  className="w-full resize-none bg-transparent px-2 py-1.5 text-[13px] leading-relaxed text-ink-900 outline-none placeholder:text-ink-300"
                />
                <div className="flex items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-1">
                    {isASRSupported() && (
                      <button
                        onClick={toggleMic}
                        className={`btn-quiet h-8 w-8 rounded-full p-0 ${listening ? 'bg-coral-500 text-white' : ''}`}
                        aria-label={listening ? '取消语音输入' : '语音输入'}
                        title="语音输入"
                      >
                        <Icon name="mic" size={15} />
                      </button>
                    )}
                    {listening ? (
                      <>
                        <span className="relative flex h-2.5 w-2.5 shrink-0">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-coral-500 opacity-60" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-coral-500" />
                        </span>
                        <span className="text-[11px] font-semibold text-coral-500">正在语音输入…</span>
                        <button
                          onClick={toggleMic}
                          className="shrink-0 rounded-full bg-coral-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-coral-400"
                          aria-label="取消语音输入"
                        >
                          取消语音
                        </button>
                      </>
                    ) : (
                      <span className="text-[10px] text-ink-300">{text.length}/120</span>
                    )}
                  </div>
                  <button
                    onClick={() => void analyze(text)}
                    disabled={!text.trim()}
                    className="btn-primary px-4 py-2 text-[12.5px] disabled:opacity-40"
                  >
                    开始感知
                    <Icon name="arrowRight" size={14} />
                  </button>
                </div>
              </div>
            </>
          )}

          {phase === 'thinking' && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/55 px-4 py-3">
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-sea-400"
                    animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
                    transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.16 }}
                  />
                ))}
              </span>
              <p className="text-[11.5px] text-ink-500">
                正在读你的描述
                {meta ? `——先听到的是「${meta.label}」` : ''}，配一组节奏…
              </p>
            </div>
          )}

          {/* 方案 */}
          <AnimatePresence>
            {phase !== 'ask' && phase !== 'thinking' && phase !== 'done' && plan && read && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 rounded-3xl border border-sea-200/60 bg-gradient-to-br from-white/85 to-sea-50/60 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                      style={{ background: meta?.soft, color: meta?.color }}
                    >
                      {meta?.label}
                    </span>
                    <span className="flex items-center gap-0.5" title={`强度 ${read.detection.intensity}/5`}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full"
                          style={{
                            background: i < read.detection.intensity ? meta?.color : 'rgba(143,161,173,0.22)',
                          }}
                        />
                      ))}
                    </span>
                    <span className="text-[10.5px] text-ink-400">强度 {read.detection.intensity}/5</span>
                  </div>
                  <span className="text-[10.5px] text-ink-400">{RHYTHM_LABEL[plan.rhythm]}</span>
                </div>

                <h3 className="mt-2.5 font-display text-[18px] font-semibold tracking-tight text-ink-900">
                  {plan.name}
                </h3>
                <p className="mt-0.5 text-[11.5px] text-ink-500">
                  {describeSpec(plan.spec)} · 约 {Math.max(1, Math.round(plan.target / 60))} 分钟
                </p>

                <div className="mt-3">
                  <RhythmBars plan={plan} />
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white/70 px-3.5 py-2.5">
                    <p className="text-[10px] tracking-wide text-ink-300">为什么是这组</p>
                    <p className="mt-1 text-[11.5px] leading-[1.75] text-ink-600">{plan.reason}</p>
                  </div>
                  <div className="rounded-2xl bg-white/70 px-3.5 py-2.5">
                    <p className="text-[10px] tracking-wide text-ink-300">练习时只需要记住</p>
                    <p className="mt-1 text-[11.5px] leading-[1.75] text-ink-600">{plan.focus}</p>
                  </div>
                </div>

                {plan.adapted && (
                  <p className="mt-2 flex items-start gap-1.5 rounded-2xl bg-lav-50/80 px-3 py-2 text-[11px] leading-relaxed text-lav-500">
                    <Icon name="sparkles" size={12} className="mt-0.5 shrink-0" />
                    {plan.adapted}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="flex rounded-full bg-white/70 p-0.5">
                    {DURATIONS.map((d) => (
                      <button
                        key={d.sec}
                        onClick={() => setDuration(d.sec)}
                        className={`rounded-full px-2.5 py-1 text-[11px] transition ${
                          duration === d.sec ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-400 hover:text-ink-700'
                        }`}
                      >
                        {d.label}
                        {d.sec === plan.target && <span className="ml-0.5 text-[9px] text-sea-500">推荐</span>}
                      </button>
                    ))}
                  </div>
                  <button onClick={start} className="btn-primary ml-auto px-4 py-2 text-[12.5px]">
                    <Icon name="play" size={14} />
                    开始练习
                  </button>
                  <button onClick={reset} className="btn-quiet px-2 text-[11.5px]">
                    不是这个状态
                  </button>
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-ink-300">
                  练习中随时可以说「太急了 / 跟不上 / 有点头晕」，节奏会当场改，不用退出重来。
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          {phase === 'done' && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/65 px-4 py-2.5">
              <Icon name="check" size={14} className="shrink-0 text-sea-600" />
              <p className="text-[11.5px] leading-relaxed text-ink-600">
                这次练完了，报告在下面。下次进来，我会先问你要不要接着用这组节奏。
              </p>
            </div>
          )}
        </section>

        {phase === 'done' && report && (
          <BreathReportCard
            report={report}
            nth={nth}
            reflect={reflectLine}
            onAgain={start}
            onChange={reset}
          />
        )}

        {phase !== 'done' && (
          <div className="rounded-4xl border border-white/70 bg-white/45 p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-sea-600">
              <Icon name="compass" size={12} />
              为什么「呼气更长」有效
            </p>
            <p className="mt-1.5 text-[11.5px] leading-[1.85] text-ink-500">
              吸气时心率略快，呼气时减慢，这种波动由迷走神经调节。把呼气拉长，等于反复给身体一个「安全」的信号。
              所以重点不在数字精确，而在<strong className="font-medium text-ink-700">呼气长于吸气</strong>；
              屏息让你不适时，直接跳过它。
            </p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <BreathDossier
          profile={profile}
          onClear={() => {
            if (!confirmClear) {
              setConfirmClear(true)
              window.setTimeout(() => setConfirmClear(false), 4000)
              return
            }
            clearBreathSessions()
            setSessions([])
            setConfirmClear(false)
          }}
        />
        <div className="rounded-4xl border border-white/70 bg-white/45 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-300">How it works</p>
          <ol className="mt-2 space-y-2">
            {[
              { t: '听你说一句', d: '大模型读状态，断网时退回关键词。' },
              { t: '配一组节奏', d: '状态 → 吸气/屏息/呼气与时长，规则可解释。' },
              { t: '练的时候改', d: '你说太急、头晕，节奏当场重算。' },
              { t: '练完写档案', d: '下一次进来，我先提你上次那组。' },
            ].map((s, i) => (
              <li key={s.t} className="flex gap-2">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sea-100 text-[9px] font-semibold text-sea-700">
                  {i + 1}
                </span>
                <p className="text-[11px] leading-relaxed text-ink-500">
                  <span className="font-medium text-ink-800">{s.t}</span> · {s.d}
                </p>
              </li>
            ))}
          </ol>
          <p className="mt-2.5 text-[10px] leading-relaxed text-ink-300">
            所有记录只存在这台设备上；呼吸练习不能替代医疗帮助。
          </p>
        </div>
      </div>
    </div>
  )
}
