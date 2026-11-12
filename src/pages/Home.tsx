import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icons'
import { IslandAtlas } from '../components/IslandAtlas'
import { MoodCheckIn } from '../components/MoodCheckIn'
import { MoodChart } from '../components/MoodChart'
import { Reveal } from '../components/Reveal'
import { buildSeries, insightOf, summarize } from '../lib/mood'
import { MOMENTS, loadMoment, type Moment } from '../lib/moment'
import { KB_STATS } from '../lib/rag'
import { useAppStore } from '../store/useAppStore'

export default function Home() {
  const records = useAppStore((s) => s.records)
  const openBreathing = useAppStore((s) => s.openBreathing)
  const setAssessmentOpen = useAppStore((s) => s.setAssessmentOpen)
  const [moment, setMoment] = useState<Moment>('noon')

  useEffect(() => {
    setMoment(loadMoment())
  }, [])

  const series = buildSeries(records, 7)
  const summary = summarize(records, 7)
  const insight = insightOf(summary)
  const momentMeta = MOMENTS.find((m) => m.id === moment) ?? MOMENTS[1]
  const greeting =
    moment === 'dawn' ? '早上好' : moment === 'dusk' ? '傍晚好' : moment === 'night' ? '夜里好' : '你好'

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      {/* ── Hero ── */}
      <section className="relative grid items-center gap-10 pb-8 pt-6 sm:pt-12 lg:grid-cols-[1.06fr_0.94fr] lg:gap-6 lg:pb-12">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="sticker">
              <span className="h-1.5 w-1.5 rounded-full bg-sea-400" />
              {momentMeta.label} · {momentMeta.time}
            </span>
            <span className="text-[11px] tracking-[0.16em] text-ink-300">{greeting}，风浪可以先放一放</span>
          </div>

          <h1 className="mt-6 font-display text-[42px] font-semibold leading-[1.14] tracking-tight text-ink-900 sm:text-[54px] lg:text-[60px]">
            把心里的风浪，
            <br />
            泊在<span className="text-gradient">一座岛上</span>。
          </h1>

          <p className="mt-6 max-w-lg text-[14px] leading-[1.9] text-ink-500 sm:text-[15px]">
            清绪之屿是一个面向备考学生的 AI 情绪自助空间。
            灯塔会听你说，藏书阁给得出依据，潮汐湾负责让你慢下来，
            乐园沙滩留给学不进去的那半小时。不评判，不催促，只陪你把今天过完。
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/chat" className="btn-primary px-6 py-3">
              <Icon name="chat" size={17} />
              和岛主聊聊
            </Link>
            <button onClick={() => openBreathing('478')} className="btn-ghost px-5 py-3">
              <Icon name="wave" size={17} />
              先做 1 分钟呼吸
            </button>
            <Link to="/play" className="btn-quiet px-4 py-3 text-[13px]">
              去玩一局
              <Icon name="arrowRight" size={14} />
            </Link>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-ink-400">
            <span className="flex items-center gap-1.5">
              <Icon name="shield" size={13} className="text-sea-400" />
              本地账号 · 数据不出本机
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="book" size={13} className="text-sea-400" />
              {KB_STATS.docs} 篇知识条目可追溯
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="lifebuoy" size={13} className="text-coral-400" />
              24h 援助热线 12356
            </span>
          </div>
        </motion.div>

        {/* 视觉主体 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto flex w-full max-w-[430px] items-center justify-center"
        >
          <div className="relative aspect-square w-full">
            <div className="absolute inset-[6%] rounded-full bg-gradient-to-br from-white/70 via-sea-50/50 to-lav-100/50 blur-2xl" />

            <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full" aria-hidden="true">
              <circle cx="200" cy="200" r="170" fill="none" stroke="rgba(148,205,217,0.22)" strokeWidth="0.7" strokeDasharray="2 9" />
              <circle cx="200" cy="200" r="140" fill="none" stroke="rgba(196,185,236,0.28)" strokeWidth="0.7" />
              <circle cx="200" cy="200" r="110" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="10" strokeOpacity="0.5" />
              <g className="origin-center animate-[spin_52s_linear_infinite]">
                <circle cx="200" cy="30" r="3" fill="#94cdd9" />
                <circle cx="370" cy="200" r="2.2" fill="#c4b9ec" />
                <circle cx="200" cy="370" r="2.6" fill="#f6b6a6" />
              </g>
              <g className="origin-center animate-[spin_78s_linear_infinite_reverse]">
                <circle cx="300" cy="200" r="1.6" fill="#ef9b87" />
                <circle cx="100" cy="200" r="1.6" fill="#94cdd9" />
              </g>
            </svg>

            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative h-[61%] w-[61%]">
                <div className="absolute inset-6 rounded-full bg-white/45 blur-2xl" />
                <img
                  src="/brand/icon-512.png"
                  alt="清绪之屿图标：海岛上的灯塔"
                  className="relative h-full w-full animate-float object-contain drop-shadow-[0_26px_44px_rgba(58,123,141,0.24)]"
                />
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
              className="glass absolute -left-2 top-[15%] flex items-center gap-2 rounded-2xl px-3 py-2 text-[11px] text-ink-600 sm:left-0"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sea-100 text-sea-600">
                <Icon name="wave" size={13} />
              </span>
              4-7-8 潮汐呼吸
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.75 }}
              className="glass absolute -right-1 top-[35%] flex items-center gap-2 rounded-2xl px-3 py-2 text-[11px] text-ink-600 sm:right-0"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-lav-100 text-lav-500">
                <Icon name="book" size={13} />
              </span>
              RAG 引用可追溯
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="glass absolute bottom-[9%] left-[10%] flex items-center gap-2 rounded-2xl px-3 py-2 text-[11px] text-ink-600"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sand-100 text-[#b79a6a]">
                <Icon name="sparkles" size={13} />
              </span>
              四个解压小游戏
            </motion.div>
          </div>
        </motion.div>

        <span
          className="pointer-events-none absolute -right-6 top-1/2 hidden -translate-y-1/2 text-[10px] tracking-[0.5em] text-ink-300 lg:block"
          style={{ writingMode: 'vertical-rl' }}
        >
          EXAM ANXIETY · SELF REGULATION · 2026
        </span>
      </section>

      {/* ── 岛屿全景 ── */}
      <Reveal>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.26em] text-sea-500">Walk the island</p>
            <h2 className="mt-1.5 font-display text-[22px] font-semibold tracking-tight text-ink-900 sm:text-[26px]">
              岛上七处，随便挑一处上岸
            </h2>
          </div>
          <Link to="/about" className="hidden items-center gap-1 text-[12px] text-ink-400 transition hover:text-ink-900 sm:flex">
            项目说明
            <Icon name="arrowRight" size={14} />
          </Link>
        </div>
      </Reveal>

      <Reveal delay={80}>
        <IslandAtlas />
      </Reveal>

      {/* ── 今日潮位 + 趋势 ── */}
      <Reveal delay={60}>
        <section className="mt-4 grid gap-4 lg:grid-cols-[1.02fr_0.98fr]">
          <MoodCheckIn />
          <div className="lux flex flex-col p-5 sm:p-6">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sea-500">Tide Trend</p>
                <p className="mt-1 font-display text-[16px] font-semibold tracking-tight text-ink-900">近 7 天潮向</p>
              </div>
              <Link to="/mood" className="text-[11px] text-ink-400 transition hover:text-sea-600">
                完整仪表盘 →
              </Link>
            </div>
            <div className="mt-3 flex-1">
              <MoodChart points={series} height={150} compact />
            </div>
            <div className="mt-3 flex items-center gap-4 border-t border-white/60 pt-3">
              <div>
                <p className="text-[10px] text-ink-300">平均情绪</p>
                <p className="tnum font-display text-xl font-semibold text-ink-900">
                  {summary.avg !== null ? summary.avg.toFixed(1) : '—'}
                  <span className="ml-0.5 text-[11px] font-normal text-ink-300">/5</span>
                </p>
              </div>
              <div>
                <p className="text-[10px] text-ink-300">连续记录</p>
                <p className="tnum font-display text-xl font-semibold text-ink-900">
                  {summary.streak}
                  <span className="ml-0.5 text-[11px] font-normal text-ink-300">天</span>
                </p>
              </div>
              <button onClick={() => setAssessmentOpen(true)} className="btn-quiet ml-auto text-[11.5px]">
                GAD-7 自评
                <Icon name="arrowRight" size={13} />
              </button>
            </div>
          </div>
        </section>
      </Reveal>

      {/* ── 洞察 ── */}
      <Reveal delay={40}>
        <section className="mt-4 flex items-start gap-3 rounded-4xl border border-white/70 bg-white/45 px-5 py-4 backdrop-blur">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lav-100/80 text-lav-500">
            <Icon name="compass" size={15} />
          </span>
          <p className="text-[12.5px] leading-relaxed text-ink-600">
            <strong className="font-semibold text-ink-900">今日潮向　</strong>
            {insight}
          </p>
        </section>
      </Reveal>

      {/* ── 呼吸 CTA ── */}
      <Reveal delay={40}>
        <section className="relative mt-6 overflow-hidden rounded-5xl border border-white/70 bg-gradient-to-br from-sea-100/60 via-white/55 to-lav-100/55 p-6 shadow-soft sm:p-10">
          <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-white/60 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-sand-100/70 blur-3xl" />
          <div className="relative z-10 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.26em] text-sea-500">One minute pause</p>
              <h2 className="mt-2 font-display text-[26px] font-semibold tracking-tight text-ink-900 sm:text-[32px]">
                现在，先什么也不解决。
              </h2>
              <p className="mt-2 max-w-md text-[13px] leading-[1.85] text-ink-500">
                只做一件事：吸气 4 秒，屏息 7 秒，呼气 8 秒。四个循环之后，再决定下一步。
              </p>
            </div>
            <button onClick={() => openBreathing('478')} className="btn-primary shrink-0 px-6 py-3">
              <Icon name="play" size={16} />
              开始呼吸
            </button>
          </div>
        </section>
      </Reveal>

      {/* ── 岛屿档案 ── */}
      <Reveal delay={40}>
        <section className="mt-6 grid gap-3 sm:grid-cols-4">
          {[
            { k: `${KB_STATS.chunks}`, u: '个知识片段', d: '本地检索，引用可展开原文' },
            { k: '6', u: '个 Agent 工具', d: '呼吸 / 自评 / 计划 / 记录 / 趋势 / 检索' },
            { k: '7', u: '处岛屿场景', d: '灯塔、书阁、潮汐、乐园、观测台…' },
            { k: '0', u: '字节上传', d: '对话与情绪只存在浏览器本地' },
          ].map((s) => (
            <div key={s.u} className="rounded-3xl border border-white/70 bg-white/40 px-4 py-4 backdrop-blur transition hover:border-white hover:bg-white/60">
              <p className="tnum font-display text-[22px] font-semibold tracking-tight text-ink-900">
                {s.k}
                <span className="ml-1.5 text-[10.5px] font-normal text-ink-400">{s.u}</span>
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-400">{s.d}</p>
            </div>
          ))}
        </section>
      </Reveal>
    </div>
  )
}
