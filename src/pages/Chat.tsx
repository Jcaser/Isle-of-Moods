import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Link, useSearchParams } from 'react-router-dom'
import remarkGfm from 'remark-gfm'
import { runAgent } from '../lib/agent'
import { aiExhausted, aiReady, formatTokens } from '../lib/ai'
import { isProxy } from '../lib/llm'
import { summarize } from '../lib/mood'
import { TOOL_LABELS } from '../lib/tools'
import type { ChatMessage, RiskLevel, ToolTraceItem } from '../lib/types'
import { isASRSupported, startRecognition } from '../lib/tts'
import { useAppStore } from '../store/useAppStore'
import { Icon } from '../components/Icons'
import { MoodCheckIn } from '../components/MoodCheckIn'

const SUGGESTIONS = [
  '一想到考试就心慌，晚上也睡不着',
  '我总是学不进去，一坐下就开始刷手机',
  '帮我做一次思维记录，我总觉得考砸就完了',
  '离考试还有 20 天，帮我排一份不那么压垮人的计划',
]

interface LiveState {
  content: string
  trace: ToolTraceItem[]
  risk: RiskLevel
  mode: 'cloud' | 'local'
  error?: string
  /** 额度用尽的提示：出现即代表云端调用已被强制停止 */
  quota?: string
}

const uid = () => Math.random().toString(36).slice(2, 10)

/** 只展示「调用了哪个工具」，不展示任何知识库出处 */
function TraceView({ trace }: { trace: ToolTraceItem[] }) {
  const [open, setOpen] = useState(false)
  if (!trace.length) return null

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-white/70 bg-white/55 px-2.5 py-1 text-[10.5px] text-ink-500 transition hover:bg-white/85"
        aria-expanded={open}
      >
        <Icon name="sparkles" size={12} className="text-lav-400" />
        <span>调用 {trace.length} 个工具</span>
        <Icon name="arrowRight" size={11} className={`transition ${open ? 'rotate-90' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-1.5 rounded-2xl border border-white/60 bg-white/45 p-3">
              {trace.map((t) => (
                <div key={t.id} className="flex items-start gap-2 text-[10.5px] leading-relaxed text-ink-500">
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                      t.status === 'done' ? 'bg-sea-100 text-sea-600' : t.status === 'error' ? 'bg-coral-300/30 text-coral-500' : 'bg-lav-100 text-lav-500'
                    }`}
                  >
                    {t.status === 'running' ? (
                      <span className="h-1.5 w-1.5 animate-ping rounded-full bg-lav-400" />
                    ) : (
                      <Icon name={t.status === 'error' ? 'alert' : 'check'} size={9} />
                    )}
                  </span>
                  <span>
                    <span className="font-medium text-ink-700">{t.label}</span>
                    {t.summary && <span className="ml-1 text-ink-400">— {t.summary.slice(0, 60)}</span>}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * 对话里不再向用户展示知识库出处。
 * 检索依然在本地进行、结果依然作为依据注入模型，只是不呈现给用户看。
 */
function RiskCard({ level }: { level: RiskLevel }) {
  if (level !== 'high' && level !== 'medium') return null
  return (
    <div className="mb-2 rounded-2xl border border-coral-300/40 bg-coral-300/10 px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-coral-500">
        <Icon name="lifebuoy" size={13} />
        如果你此刻正处在危险中，请优先联系真人
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <a href="tel:12356" className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-ink-900 shadow-sm">
          12356 · 24h 心理援助
        </a>
        <a href="tel:120" className="rounded-full bg-white/80 px-3 py-1.5 text-[11px] text-ink-700">
          120 急救
        </a>
        <Link to="/harbor" className="rounded-full bg-white/80 px-3 py-1.5 text-[11px] text-ink-700">
          更多求助方式
        </Link>
      </div>
    </div>
  )
}

export default function Chat() {
  const messages = useAppStore((s) => s.messages)
  const addMessage = useAppStore((s) => s.addMessage)
  const clearChat = useAppStore((s) => s.clearChat)
  const settings = useAppStore((s) => s.settings)
  const aiStatus = useAppStore((s) => s.aiStatus)
  const refreshAi = useAppStore((s) => s.refreshAi)
  const records = useAppStore((s) => s.records)
  const assessments = useAppStore((s) => s.assessments)
  const addMood = useAppStore((s) => s.addMood)
  const openBreathing = useAppStore((s) => s.openBreathing)
  const setAssessmentOpen = useAppStore((s) => s.setAssessmentOpen)
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen)

  const [input, setInput] = useState('')
  const [live, setLive] = useState<LiveState | null>(null)
  const [listening, setListening] = useState(false)
  const [showMood, setShowMood] = useState(false)
  const [searchParams] = useSearchParams()

  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const pendingContent = useRef('')
  const metaRef = useRef<{ trace: ToolTraceItem[]; risk: RiskLevel; quota?: string }>({
    trace: [],
    risk: 'none',
  })
  const abortedRef = useRef(false)

  const streaming = live !== null
  const summary = useMemo(() => summarize(records, 7), [records])

  // 云端是否在线：服务端代理就绪（Key 在服务端），或用户自填 Key 直连
  const cloudNow = aiReady(aiStatus) || (Boolean(settings.apiKey) && !isProxy(settings.baseUrl))
  const exhausted = aiExhausted(aiStatus)

  // 进页面时问一次服务端：有没有配好 Key、额度还剩多少
  useEffect(() => {
    void refreshAi()
  }, [refreshAi])

  // 代理没起来时不做无意义轮询；有状态后每 45 秒刷新一次用量
  useEffect(() => {
    if (!aiStatus) return
    const timer = window.setInterval(() => void refreshAi(), 45_000)
    return () => window.clearInterval(timer)
  }, [aiStatus, refreshAi])

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' })
  }, [])

  useEffect(() => {
    scrollToBottom(false)
  }, [scrollToBottom])

  // 从分享小屋带问题过来时预填输入框
  useEffect(() => {
    const q = searchParams.get('q')
    if (q) setInput(q)
  }, [searchParams])

  useEffect(() => {
    if (streaming) scrollToBottom()
  }, [live?.content, streaming, scrollToBottom])

  const send = useCallback(
    async (raw?: string) => {
      const text = (raw ?? input).trim()
      if (!text || streaming) return

      const history = [...useAppStore.getState().messages]
      const userMsg: ChatMessage = { id: uid(), role: 'user', content: text, ts: Date.now() }
      addMessage(userMsg)
      setInput('')
      setShowMood(false)
      if (taRef.current) taRef.current.style.height = 'auto'

      // 发之前确认一次服务端状态：是否配好 Key、额度是否还有余
      let status = useAppStore.getState().aiStatus
      if (!status) status = await refreshAi()
      const cloud = aiReady(status) || (Boolean(settings.apiKey) && !isProxy(settings.baseUrl))

      const controller = new AbortController()
      abortRef.current = controller
      pendingContent.current = ''
      metaRef.current = { trace: [], risk: 'none' }
      abortedRef.current = false
      setLive({ content: '', trace: [], risk: 'none', mode: cloud ? 'cloud' : 'local' })

      await runAgent({
        userText: text,
        history,
        settings,
        records: useAppStore.getState().records,
        assessments: useAppStore.getState().assessments,
        ctx: {
          openBreathing,
          openAssessment: () => setAssessmentOpen(true),
          addMood: (r) => addMood(r),
          getRecords: () => useAppStore.getState().records,
          getAssessments: () => useAppStore.getState().assessments,
          navigate: () => {},
        },
        signal: controller.signal,
        cloud,
        onEvent: (ev) => {
          if (ev.type === 'risk') metaRef.current.risk = ev.level
          if (ev.type === 'quota_exhausted') {
            metaRef.current.quota = ev.message
            void refreshAi()
          }
          if (ev.type === 'tool_start') {
            metaRef.current.trace = [
              ...metaRef.current.trace,
              {
                id: ev.call.id,
                name: ev.call.name,
                label: ev.label ?? TOOL_LABELS[ev.call.name] ?? ev.call.name,
                status: 'running',
              },
            ]
          }
          if (ev.type === 'tool_end') {
            metaRef.current.trace = metaRef.current.trace.map((t) =>
              t.id === ev.result.id
                ? { ...t, status: ev.result.ok ? 'done' : 'error', summary: ev.result.summary.slice(0, 60) }
                : t,
            )
          }
          if (ev.type === 'delta') pendingContent.current += ev.text

          setLive((prev) => {
            const base: LiveState = prev ?? { content: '', trace: [], risk: 'none', mode: 'cloud' }
            switch (ev.type) {
              case 'delta':
                return { ...base, content: pendingContent.current }
              case 'mode':
                return { ...base, mode: ev.mode }
              case 'risk':
                return { ...base, risk: ev.level }
              case 'tool_start':
                return { ...base, trace: metaRef.current.trace }
              case 'tool_end':
                return { ...base, trace: metaRef.current.trace }
              case 'quota_exhausted':
                return { ...base, quota: ev.message }
              case 'error':
                return { ...base, error: ev.message }
              case 'done':
                return { ...base, content: ev.content || base.content }
              default:
                return base
            }
          })
        },
      })

      if (abortedRef.current) {
        abortRef.current = null
        pendingContent.current = ''
        return
      }

      const final = pendingContent.current.trim()
      if (final) {
        addMessage({
          id: uid(),
          role: 'assistant',
          content: final,
          ts: Date.now(),
          trace: metaRef.current.trace,
          risk: metaRef.current.risk,
          offline: !cloud,
        })
      }
      // 用完一次就同步一次用量，横幅上的数字才是真的
      void refreshAi()
      setLive(null)
      abortRef.current = null
      pendingContent.current = ''
    },
    [input, streaming, settings, addMessage, openBreathing, addMood, setAssessmentOpen, refreshAi]
  )

  // 用最新 live 状态补全落库信息
  useEffect(() => {
    if (!live) return
    if (live.error) scrollToBottom()
  }, [live, scrollToBottom])

  const stop = () => {
    abortedRef.current = true
    abortRef.current?.abort()
    const content = pendingContent.current.trim()
    if (content) {
      addMessage({
        id: uid(),
        role: 'assistant',
        content,
        ts: Date.now(),
        trace: metaRef.current.trace,
        risk: metaRef.current.risk,
        offline: !cloudNow,
      })
    }
    setLive(null)
    abortRef.current = null
    pendingContent.current = ''
  }

  const toggleMic = () => {
    if (listening) {
      setListening(false)
      return
    }
    setListening(true)
    const stopRec = startRecognition(
      (text, final) => {
        setInput((prev) => (final ? (prev + text).trim() : prev))
        if (final) setListening(false)
      },
      () => setListening(false),
    )
    ;(window as any).__siStopRec = stopRec
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void send()
    }
  }

  const isEmpty = messages.length === 0 && !live

  return (
    <div className="flex h-dvh flex-col">
      {/* 顶部栏 */}
      <header className="flex items-center justify-between gap-3 border-b border-white/60 bg-white/45 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="flex items-center gap-2.5">
          <Link to="/#atlas" className="btn-quiet h-9 w-9 rounded-full p-0" aria-label="返回岛屿" title="回到岛屿地图">
            <Icon name="arrowRight" size={17} className="rotate-180" />
          </Link>
          <div className="flex items-center gap-2.5">
            <span className="relative">
              <img src="/brand/icon-128.png" alt="" className="h-9 w-9 object-contain" />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-sea-400" />
            </span>
            <div>
              <p className="font-display text-[14px] font-semibold leading-none tracking-tight text-ink-900">岛主 · 驻岛咨询师</p>
              <p className="mt-1 text-[10px] text-ink-400">
                {streaming ? '正在陪你想…' : exhausted ? '额度已用完 · 本地模式' : cloudNow ? 'AI 已连接 · 可随时中断' : '本地知识模式'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowMood((v) => !v)}
            className="btn-quiet h-9 w-9 rounded-full p-0 sm:hidden"
            aria-label="情绪打卡"
          >
            <Icon name="leaf" size={17} />
          </button>
          <button onClick={() => setSettingsOpen(true)} className="btn-quiet h-9 w-9 rounded-full p-0" aria-label="设置">
            <Icon name="settings" size={17} />
          </button>
          <button
            onClick={() => {
              if (messages.length && window.confirm('清空当前对话？本地记录将一并删除。')) clearChat()
            }}
            className="btn-quiet h-9 w-9 rounded-full p-0"
            aria-label="清空对话"
          >
            <Icon name="trash" size={16} />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* 侧栏 */}
        <aside className="hidden w-64 shrink-0 flex-col gap-3 border-r border-white/50 px-4 py-5 lg:flex xl:w-72">
          <div className="rounded-3xl border border-white/70 bg-white/50 p-4">
            <p className="text-[11px] font-semibold tracking-wide text-ink-900">此刻的你</p>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-500">
              {summary.avg !== null
                ? `近 7 天平均情绪 ${summary.avg.toFixed(1)}/5，连续记录 ${summary.streak} 天。`
                : '还没有情绪记录，先打个卡吧。'}
              {summary.topTags[0] ? ` 最近较多提到「${summary.topTags[0].tag}」。` : ''}
            </p>
            <button onClick={() => setShowMood((v) => !v)} className="btn-ghost mt-3 w-full text-[11.5px]">
              <Icon name="leaf" size={14} />
              30 秒情绪打卡
            </button>
            <AnimatePresence>
              {showMood && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mt-2">
                    <MoodCheckIn compact />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/45 p-4">
            <p className="text-[11px] font-semibold tracking-wide text-ink-900">随时可用</p>
            <div className="mt-2 space-y-1">
              <button onClick={() => openBreathing('478')} className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-[11.5px] text-ink-600 transition hover:bg-white/70">
                <Icon name="wave" size={14} className="text-sea-500" />
                4-7-8 呼吸引导
              </button>
              <button onClick={() => setAssessmentOpen(true)} className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-[11.5px] text-ink-600 transition hover:bg-white/70">
                <Icon name="chart" size={14} className="text-lav-500" />
                GAD-7 焦虑自评
              </button>
              <Link to="/library" className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-[11.5px] text-ink-600 transition hover:bg-white/70">
                <Icon name="book" size={14} className="text-sea-500" />
                翻翻分享小屋
              </Link>
            </div>
          </div>

          <div className="mt-auto rounded-3xl border border-coral-300/25 bg-coral-300/10 p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-coral-500">
              <Icon name="lifebuoy" size={13} />
              如果情况紧急
            </p>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-500">
              岛主不能替代真人援助。请拨 12356（24 小时）或 120，也可以直接告诉身边的人。
            </p>
            <Link to="/harbor" className="mt-2 inline-block text-[10.5px] text-sea-600 underline underline-offset-2">
              查看求助方式 →
            </Link>
          </div>
        </aside>

        {/* 对话区 */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <div className="mx-auto w-full max-w-3xl">
              {isEmpty && (
                <div className="flex flex-col items-center pt-6 text-center sm:pt-12">
                  <div className="relative h-24 w-24">
                    <div className="absolute inset-2 rounded-full bg-sea-200/40 blur-xl" />
                    <img src="/brand/icon-256.png" alt="" className="relative h-24 w-24 object-contain animate-float" />
                  </div>
                  <h1 className="mt-4 font-display text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">
                    欢迎来到情绪之屿
                  </h1>
                  <p className="mt-2 max-w-md text-[13px] leading-relaxed text-ink-500">
                    我是岛主。你可以在这里说说心里积压的感受，我在这里听着。不用组织语言，也不用说得"合理"。
                  </p>

                  <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => void send(s)}
                        className="group flex items-start gap-2 rounded-2xl border border-white/70 bg-white/55 px-4 py-3 text-left text-[12px] leading-relaxed text-ink-600 transition hover:-translate-y-0.5 hover:bg-white/85 hover:shadow-soft"
                      >
                        <Icon name="feather" size={14} className="mt-0.5 shrink-0 text-sea-400" />
                        {s}
                      </button>
                    ))}
                  </div>

                  <p className="mt-6 flex items-center gap-1.5 text-[10.5px] text-ink-300">
                    <Icon name="shield" size={12} />
                    对话仅保存在本地浏览器 · AI 内容不能替代专业诊断
                  </p>
                </div>
              )}

              <div className="space-y-5">
                {messages.map((m) => (
                  <MessageRow key={m.id} message={m} />
                ))}

                {live && <LiveRow live={live} onStop={stop} />}
              </div>
              <div ref={bottomRef} className="h-2" />
            </div>
          </div>

          {/* 输入区 */}
          <div className="border-t border-white/60 bg-white/55 px-3 pb-3 pt-3 backdrop-blur-xl sm:px-6">
            {aiStatus && (
              <div className="mx-auto mb-2 w-full max-w-3xl">
                {exhausted ? (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-coral-300/40 bg-coral-300/10 px-3 py-2 text-[11px] leading-relaxed text-coral-500">
                    <Icon name="alert" size={13} />
                    <span className="font-semibold">免费额度已用完，已停止调用大模型。</span>
                    <span className="text-ink-500">
                      共用了 {formatTokens(aiStatus.quota.used)} tokens。现在以本地知识模式陪你，不产生任何费用。
                    </span>
                    <button
                      onClick={() => setSettingsOpen(true)}
                      className="underline underline-offset-2 hover:text-coral-600"
                    >
                      查看用量
                    </button>
                  </div>
                ) : aiStatus.quota.ratio >= 0.8 ? (
                  <div className="flex items-center gap-1.5 rounded-2xl border border-[#e5c9a3]/50 bg-[#f6e7d2]/50 px-3 py-1.5 text-[10.5px] text-[#a9762e]">
                    <Icon name="alert" size={12} />
                    额度快用完了：已用 {formatTokens(aiStatus.quota.used)} / {formatTokens(aiStatus.quota.budget)} tokens
                  </div>
                ) : null}
              </div>
            )}
            <div className="mx-auto w-full max-w-3xl">
              <div className="flex items-end gap-2 rounded-3xl border border-white/80 bg-white/80 p-2 shadow-[0_12px_30px_-22px_rgba(46,96,112,0.5)]">
                <textarea
                  ref={taRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value)
                    const el = e.target
                    el.style.height = 'auto'
                    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
                  }}
                  onKeyDown={onKeyDown}
                  rows={1}
                  placeholder={listening ? '正在听你说…' : '把此刻的想法写下来，不需要组织语言…'}
                  className="max-h-[140px] min-h-[42px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[14px] leading-relaxed text-ink-900 outline-none placeholder:text-ink-300"
                  aria-label="输入消息"
                />
                {isASRSupported() && (
                  <button
                    onClick={toggleMic}
                    className={`btn-quiet h-10 w-10 shrink-0 rounded-full p-0 ${listening ? 'bg-coral-300/20 text-coral-500' : ''}`}
                    aria-label={listening ? '停止语音输入' : '语音输入'}
                    aria-pressed={listening}
                  >
                    <Icon name="mic" size={18} />
                  </button>
                )}
                {streaming ? (
                  <button onClick={stop} className="btn-ghost h-10 shrink-0 rounded-full px-4 text-[12.5px]" aria-label="停止生成">
                    <Icon name="stop" size={14} />
                    停止
                  </button>
                ) : (
                  <button
                    onClick={() => void send()}
                    disabled={!input.trim()}
                    className="btn-primary h-10 w-10 shrink-0 rounded-full p-0 disabled:opacity-35"
                    aria-label="发送"
                  >
                    <Icon name="send" size={17} />
                  </button>
                )}
              </div>
              <p className="mt-1.5 hidden px-2 text-center text-[10px] text-ink-300 sm:block">
                Enter 发送 · Shift + Enter 换行 · AI 生成内容仅供参考，如有严重困扰请拨打 12356
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MessageRow({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-gradient-to-br from-sea-500 to-[#6c9dc4] px-4 py-2.5 text-[13.5px] leading-relaxed text-white shadow-[0_10px_24px_-16px_rgba(58,123,141,0.9)]">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2.5">
      <img src="/brand/icon-128.png" alt="" className="mt-0.5 h-8 w-8 shrink-0 object-contain" />
      <div className="min-w-0 flex-1">
        {message.risk && <RiskCard level={message.risk} />}
        {message.trace && message.trace.length > 0 && <TraceView trace={message.trace} />}
        <div className="rounded-3xl rounded-tl-lg border border-white/70 bg-white/70 px-4 py-3 shadow-[0_10px_28px_-24px_rgba(46,96,112,0.6)]">
          <div className="md-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-2 px-1 text-[10px] text-ink-300">
          <span>
            {new Date(message.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {message.offline && <span className="chip text-[9px]">本地知识模式</span>}
        </div>
      </div>
    </div>
  )
}

function LiveRow({ live, onStop }: { live: LiveState; onStop: () => void }) {
  const thinking = !live.content
  return (
    <div className="flex gap-2.5">
      <img src="/brand/icon-128.png" alt="" className="mt-0.5 h-8 w-8 shrink-0 object-contain" />
      <div className="min-w-0 flex-1">
        {live.risk && <RiskCard level={live.risk} />}
        {live.trace.length > 0 && <TraceView trace={live.trace} />}
        <div className="rounded-3xl rounded-tl-lg border border-white/70 bg-white/70 px-4 py-3 shadow-[0_10px_28px_-24px_rgba(46,96,112,0.6)]">
          {thinking ? (
            <div className="flex items-center gap-2 py-0.5 text-[12.5px] text-ink-400">
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
              {live.trace.some((t) => t.status === 'running')
                ? `${live.trace.find((t) => t.status === 'running')?.label}…`
                : '正在读你的话，也在翻资料…'}
            </div>
          ) : (
            <div className="md-body caret">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{live.content}</ReactMarkdown>
            </div>
          )}
          {live.quota && (
            <p className="mt-2 rounded-xl bg-coral-300/15 px-2.5 py-1.5 text-[10.5px] leading-relaxed text-coral-500">
              {live.quota} 后续对话将改用本地知识模式，不再产生费用。
            </p>
          )}
          {live.error && (
            <p className="mt-2 rounded-xl bg-coral-300/15 px-2.5 py-1.5 text-[10.5px] text-coral-500">
              云端模型暂时不可用：{live.error}。已切换到本地知识模式继续回答。可到设置中检查 Key 与接口地址。
            </p>
          )}
        </div>
        {live.content && (
          <div className="mt-1.5 flex items-center gap-2 px-1 text-[10px] text-ink-300">
            <span>{live.mode === 'local' ? '本地知识模式' : '正在生成'}</span>
            <button onClick={onStop} className="underline underline-offset-2 hover:text-ink-600">
              停止
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
