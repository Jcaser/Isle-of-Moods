import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icon } from '../components/Icons'
import { IslandAtlas } from '../components/IslandAtlas'
import { Reveal } from '../components/Reveal'
import { RingGallery } from '../components/RingGallery'
import { MOMENTS, loadMoment, type Moment } from '../lib/moment'
import { useAppStore } from '../store/useAppStore'

export default function Home() {
  const openBreathing = useAppStore((s) => s.openBreathing)
  const [moment, setMoment] = useState<Moment>('noon')
  const { hash } = useLocation()

  useEffect(() => {
    setMoment(loadMoment())
  }, [])

  // 从副页面点「回到岛屿地图」时，直接落到地图，而不是停在首屏大标题上
  useEffect(() => {
    if (hash !== '#atlas') return
    const t = window.setTimeout(() => {
      document.getElementById('atlas')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
    return () => window.clearTimeout(t)
  }, [hash])

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
            灯塔会听你说，分享小屋里有人写下心事，潮汐湾负责让你慢下来，
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
        <div className="mb-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.26em] text-sea-500">Walk the island</p>
          <h2 className="mt-1.5 font-display text-[22px] font-semibold tracking-tight text-ink-900 sm:text-[26px]">
            岛上六处，随便挑一处上岸
          </h2>
        </div>
      </Reveal>

      <Reveal delay={80}>
        <IslandAtlas />
      </Reveal>

      {/* ── 明信片环形画廊 ── */}
      <Reveal delay={60}>
        <section className="mt-6 overflow-hidden rounded-5xl border border-white/60 bg-gradient-to-b from-white/45 via-white/20 to-transparent px-4 pb-5 pt-6 sm:px-8 sm:pb-6 sm:pt-8">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.26em] text-sea-500">Postcards from the isle</p>
              <h2 className="mt-1.5 font-display text-[22px] font-semibold tracking-tight text-ink-900 sm:text-[26px]">
                转一转，挑一张带走
              </h2>
            </div>
            <p className="text-[11px] text-ink-300">七张小画 · 挑一句今天需要的</p>
          </div>
          <div className="mt-3">
            <RingGallery />
          </div>
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

    </div>
  )
}
