import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Icon, type IconName } from '../components/Icons'
import { MoodCheckIn } from '../components/MoodCheckIn'
import { MoodChart } from '../components/MoodChart'
import { buildSeries, insightOf, summarize } from '../lib/mood'
import { KB_STATS } from '../lib/rag'
import { useAppStore } from '../store/useAppStore'

const MODULES: {
  to: string
  title: string
  sub: string
  desc: string
  icon: IconName
  tag: string
  span?: boolean
  tone: string
}[] = [
  {
    to: '/chat',
    title: '岛主对话',
    sub: 'AI 情绪岛主 · Agent',
    desc: '把你的压力原话倒出来。岛主会先接住情绪，再检索知识库、调用工具，陪你拆开一个念头，做一个此刻能完成的练习。',
    icon: 'chat',
    tag: 'Function Calling',
    span: true,
    tone: 'from-sea-100/80 to-white/40',
  },
  {
    to: '/library',
    title: '屿藏书阁',
    sub: 'RAG 知识库',
    desc: '12 篇 CBT、睡眠与学习科学条目，回答都能追溯到具体段落。',
    icon: 'book',
    tag: '可追溯引用',
    tone: 'from-lav-100/70 to-white/40',
  },
  {
    to: '/calm',
    title: '潮汐疗愈',
    sub: '4-7-8 呼吸',
    desc: '跟着海浪的节奏呼吸，配合正念语音与海岛壁纸生成。',
    icon: 'wave',
    tag: '多模态',
    tone: 'from-sea-50 to-white/40',
  },
  {
    to: '/mood',
    title: '情绪潮向',
    sub: '趋势仪表盘',
    desc: '记录每天的潮位，用趋势图看见自己在变好，还是需要帮助。',
    icon: 'chart',
    tag: 'GAD-7',
    tone: 'from-sand-100/70 to-white/40',
  },
  {
    to: '/harbor',
    title: '避风港',
    sub: '危机干预',
    desc: '识别高危信号，给出真实可用的热线、步骤与就医建议。',
    icon: 'lifebuoy',
    tag: '安全兜底',
    tone: 'from-coral-300/15 to-white/40',
  },
]

export default function Home() {
  const records = useAppStore((s) => s.records)
  const openBreathing = useAppStore((s) => s.openBreathing)
  const setAssessmentOpen = useAppStore((s) => s.setAssessmentOpen)

  const series = buildSeries(records, 7)
  const summary = summarize(records, 7)
  const insight = insightOf(summary)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      {/* Hero */}
      <section className="relative grid items-center gap-10 pb-10 pt-6 sm:pt-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-8 lg:pb-16">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/55 px-3 py-1.5 text-[10.5px] font-medium tracking-[0.18em] text-sea-600 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-sea-400" />
            AI NATIVE · 考试焦虑自助调节
          </div>

          <h1 className="mt-5 font-display text-[38px] font-semibold leading-[1.18] tracking-tight text-ink-900 sm:text-[52px] lg:text-[56px]">
            把心里的风浪，
            <br />
            泊在<span className="bg-gradient-to-r from-sea-500 via-[#7f9fc4] to-lav-400 bg-clip-text text-transparent">一座岛上</span>。
          </h1>

          <p className="mt-5 max-w-xl text-[14px] leading-[1.85] text-ink-500 sm:text-[15px]">
            清绪之屿是一个面向备考学生的 AI 情绪自助空间。和岛主聊聊、跟着潮汐呼吸、在藏书阁里找到有依据的方法，
            并把每一次起伏记录下来。不评判，不催促，只陪你把今天过完。
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link to="/chat" className="btn-primary px-6 py-3">
              <Icon name="chat" size={17} />
              和岛主聊聊
            </Link>
            <button onClick={() => openBreathing('478')} className="btn-ghost px-5 py-3">
              <Icon name="wave" size={17} />
              先做 1 分钟呼吸
            </button>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-ink-400">
            <span className="flex items-center gap-1.5">
              <Icon name="shield" size={13} className="text-sea-400" />
              无需注册 · 数据不出本机
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
          transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto flex w-full max-w-[420px] items-center justify-center"
        >
          <div className="relative aspect-square w-full">
            <div className="absolute inset-[6%] rounded-full bg-gradient-to-br from-white/70 via-sea-50/50 to-lav-100/50 blur-2xl" />

            <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full" aria-hidden="true">
              <circle cx="200" cy="200" r="168" fill="none" stroke="rgba(148,205,217,0.28)" strokeWidth="0.8" strokeDasharray="2 8" />
              <circle cx="200" cy="200" r="138" fill="none" stroke="rgba(196,185,236,0.32)" strokeWidth="0.8" />
              <circle cx="200" cy="200" r="108" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="10" strokeOpacity="0.55" />
              <g className="origin-center animate-[spin_46s_linear_infinite]">
                <circle cx="200" cy="32" r="3.2" fill="#94cdd9" />
                <circle cx="368" cy="200" r="2.4" fill="#c4b9ec" />
                <circle cx="200" cy="368" r="2.6" fill="#f6b6a6" />
              </g>
            </svg>

            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative h-[62%] w-[62%]">
                <div className="absolute inset-6 rounded-full bg-white/45 blur-2xl" />
                <img
                  src="/brand/icon-512.png"
                  alt="清绪之屿图标：海岛上的灯塔"
                  className="relative h-full w-full object-contain animate-float drop-shadow-[0_24px_40px_rgba(58,123,141,0.22)]"
                />
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.55 }}
              className="glass absolute left-0 top-[16%] flex items-center gap-2 rounded-2xl px-3 py-2 text-[11px] text-ink-600"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sea-100 text-sea-600">
                <Icon name="wave" size={13} />
              </span>
              4-7-8 潮汐呼吸
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
              className="glass absolute right-0 top-[34%] flex items-center gap-2 rounded-2xl px-3 py-2 text-[11px] text-ink-600"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-lav-100 text-lav-500">
                <Icon name="book" size={13} />
              </span>
              RAG 引用可追溯
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.85 }}
              className="glass absolute bottom-[10%] left-[12%] flex items-center gap-2 rounded-2xl px-3 py-2 text-[11px] text-ink-600"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sand-100 text-[#b79a6a]">
                <Icon name="sparkles" size={13} />
              </span>
              本地生成 · 零上传
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* 模块地图 */}
      <section className="pb-4">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sea-500">Island Map</p>
            <h2 className="mt-1.5 font-display text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">岛上可以去的地方</h2>
          </div>
          <Link to="/about" className="hidden items-center gap-1 text-[12px] text-ink-400 transition hover:text-ink-900 sm:flex">
            项目说明
            <Icon name="arrowRight" size={14} />
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m, i) => (
            <motion.div
              key={m.to}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 + i * 0.045 }}
              className={m.span ? 'sm:col-span-2 lg:col-span-2' : ''}
            >
              <Link
                to={m.to}
                className={`group relative flex h-full flex-col justify-between overflow-hidden rounded-4xl border border-white/70 bg-gradient-to-br ${m.tone} p-5 shadow-soft transition-all duration-500 hover:-translate-y-1 hover:shadow-float sm:p-6`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80 text-sea-600 shadow-sm transition group-hover:scale-105">
                      <Icon name={m.icon} size={19} />
                    </span>
                    <h3 className="mt-3 font-display text-[17px] font-semibold tracking-tight text-ink-900">{m.title}</h3>
                    <p className="mt-0.5 text-[11px] tracking-wide text-sea-600/80">{m.sub}</p>
                  </div>
                  <span className="chip shrink-0">{m.tag}</span>
                </div>
                <p className="mt-6 max-w-md text-[12.5px] leading-relaxed text-ink-500">{m.desc}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-[11.5px] font-medium text-sea-600">
                  进入
                  <Icon name="arrowRight" size={13} className="transition group-hover:translate-x-1" />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 今日潮位 + 7 日趋势 */}
      <section className="mt-8 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <MoodCheckIn />
        <div className="glass flex flex-col p-5 sm:p-6">
          <div className="flex items-baseline justify-between">
            <p className="font-display text-[15px] font-semibold tracking-tight text-ink-900">近 7 天潮向</p>
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
              <p className="font-display text-xl font-semibold text-ink-900">
                {summary.avg !== null ? summary.avg.toFixed(1) : '—'}
                <span className="ml-0.5 text-[11px] font-normal text-ink-300">/5</span>
              </p>
            </div>
            <div>
              <p className="text-[10px] text-ink-300">连续记录</p>
              <p className="font-display text-xl font-semibold text-ink-900">
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

      {/* 洞察 */}
      <section className="mt-4 rounded-4xl border border-white/70 bg-white/50 px-5 py-4 backdrop-blur">
        <p className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-ink-600">
          <Icon name="compass" size={16} className="mt-0.5 shrink-0 text-lav-400" />
          <span>
            <strong className="font-semibold text-ink-900">潮向提示　</strong>
            {insight}
          </span>
        </p>
      </section>

      {/* 呼吸 CTA */}
      <section className="relative mt-8 overflow-hidden rounded-5xl border border-white/70 bg-gradient-to-br from-sea-100/70 via-white/60 to-lav-100/60 p-6 shadow-soft sm:p-10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/50 blur-3xl" />
        <div className="relative z-10 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sea-500">One Minute Pause</p>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
              现在，先什么也不解决。
            </h2>
            <p className="mt-2 max-w-md text-[13px] leading-relaxed text-ink-500">
              只做一件事：吸气 4 秒，屏息 7 秒，呼气 8 秒。四个循环之后，再决定下一步。
            </p>
          </div>
          <button onClick={() => openBreathing('478')} className="btn-primary shrink-0 px-6 py-3">
            <Icon name="play" size={16} />
            开始呼吸
          </button>
        </div>
      </section>

      {/* 技术/隐私 */}
      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          { k: `${KB_STATS.chunks}`, u: '个知识片段', d: '本地向量化检索，引用可点开原文' },
          { k: '6', u: '个 Agent 工具', d: '呼吸 / 自评 / 计划 / 记录 / 趋势 / 检索' },
          { k: '0', u: '字节上传', d: '对话与情绪数据只存在浏览器本地' },
        ].map((s) => (
          <div key={s.u} className="rounded-3xl border border-white/70 bg-white/45 px-5 py-4 backdrop-blur">
            <p className="font-display text-2xl font-semibold tracking-tight text-ink-900">
              {s.k}
              <span className="ml-1.5 text-[11px] font-normal text-ink-400">{s.u}</span>
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-400">{s.d}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
