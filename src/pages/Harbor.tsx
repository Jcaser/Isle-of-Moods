import { motion } from 'framer-motion'
import { useState } from 'react'
import { Icon } from '../components/Icons'
import { PageHeader } from '../components/PageHeader'
import { ReliefBlindBox } from '../components/ReliefBlindBox'
import { SafetyPlan } from '../components/SafetyPlan'
import { CRISIS_RESOURCES, SAFETY_STEPS } from '../lib/crisis'
import { useAppStore } from '../store/useAppStore'

const SIGNALS = [
  '几乎每天情绪低落、空虚，持续两周以上',
  '对原本喜欢的事失去兴趣，什么都不想做',
  '睡眠、食欲、体重明显改变，持续疲惫',
  '无法上课、无法完成基本作业，回避所有人',
  '反复出现"活着没意思""我是别人的负担"',
  '出现自伤行为，或开始计划、准备、交代后事',
]

const NEEDS = [
  {
    id: 'company',
    title: '我现在需要有人陪着',
    desc: '不要一个人待着。打电话给一个信任的人，哪怕只是让对方在电话那头陪你呼吸。',
    actions: ['给朋友/家人打电话，直接说"我现在不太好，能陪我一会儿吗"', '去有人的公共空间，如图书馆、便利店', '拨打 12356，让咨询员陪你说完这通电话'],
  },
  {
    id: 'quiet',
    title: '我想先静一静',
    desc: '允许自己暂停，但给暂停设一个边界：先做 4 个呼吸循环，再决定下一步。',
    actions: ['打开潮汐呼吸，做 1 分钟 4-7-8', '把此刻的念头写下来，不修改、不评价', '给自己 20 分钟，之后必须联系一个人'],
  },
  {
    id: 'help',
    title: '我需要专业帮助',
    desc: '这不是"太脆弱"，而是像发烧去看医生一样正常。越早评估，越早轻松。',
    actions: ['学校心理健康教育中心：官网/公众号预约，通常免费且保密', '医院精神科或临床心理科：可提前电话咨询挂号', '把症状、持续时间、睡眠情况写在纸上，问诊时更清楚'],
  },
]

export default function Harbor() {
  const openBreathing = useAppStore((s) => s.openBreathing)
  const [need, setNeed] = useState<string | null>(null)

  const active = NEEDS.find((n) => n.id === need)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Safe Harbor"
        icon={<Icon name="lifebuoy" size={13} />}
        title="避风港"
        desc="这里不做分析，也不讲道理。如果你正在经历难以承受的时刻，先把下面这件事做了：让一个真人知道你现在的情况。"
      />

      {/* 紧急卡片 */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-5xl border border-coral-300/40 bg-gradient-to-br from-[#fdf1ec] via-white/70 to-[#f3f6fb] p-6 shadow-soft sm:p-8"
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-coral-300/20 blur-3xl" />
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.18em] text-coral-500">
              <Icon name="alert" size={13} />
              如果你现在有伤害自己的念头
            </p>
            <h2 className="mt-3 font-display text-2xl font-semibold leading-snug tracking-tight text-ink-900 sm:text-[28px]">
              先不要一个人扛着。
              <br />
              打个电话，让对方陪着你。
            </h2>
            <p className="mt-3 max-w-lg text-[13px] leading-relaxed text-ink-600">
              你不需要把话说得清楚，也不需要先证明自己"够严重"。接通之后，直接说"我现在很不好"就可以。
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <a href="tel:12356" className="btn-primary px-5 py-3 text-[13px]">
                <Icon name="lifebuoy" size={16} />
                拨打 12356
              </a>
              <a href="tel:120" className="btn-ghost px-4 py-3 text-[13px]">
                <Icon name="alert" size={15} />
                120 急救
              </a>
              <a href="tel:110" className="btn-ghost px-4 py-3 text-[13px]">
                110 报警
              </a>
            </div>
          </div>

          <div className="space-y-2">
            {CRISIS_RESOURCES.map((r) => (
              <a
                key={r.phone}
                href={r.phone.includes('/') ? 'tel:120' : `tel:${r.phone.replace(/-/g, '')}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/70 px-4 py-3 transition hover:bg-white"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink-900">
                    {r.name}
                    <span className="chip text-[9px]">{r.tag}</span>
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[10.5px] leading-relaxed text-ink-400">{r.desc}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-[15px] font-semibold tracking-tight text-sea-700">{r.phone}</p>
                  <p className="text-[9.5px] text-ink-300">{r.hours}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </motion.section>

      {/* 此刻需要什么 */}
      <section className="mt-6">
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink-900">此刻，你更需要哪一种？</h2>
        <p className="mt-1 text-[12px] text-ink-400">选一个，不用想太久。</p>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {NEEDS.map((n) => (
            <button
              key={n.id}
              onClick={() => setNeed(need === n.id ? null : n.id)}
              className={`rounded-4xl border p-5 text-left transition-all ${
                need === n.id
                  ? 'border-sea-300 bg-white/90 shadow-soft'
                  : 'border-white/70 bg-white/50 hover:-translate-y-0.5 hover:bg-white/80'
              }`}
              aria-expanded={need === n.id}
            >
              <p className="font-display text-[14.5px] font-semibold text-ink-900">{n.title}</p>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-500">{n.desc}</p>
            </button>
          ))}
        </div>

        {active && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-3 overflow-hidden rounded-4xl border border-white/70 bg-white/60 p-5"
          >
            <p className="text-[11px] font-semibold tracking-wide text-sea-600">{active.title} · 具体做法</p>
            <ol className="mt-2.5 space-y-2">
              {active.actions.map((a, i) => (
                <li key={a} className="flex gap-2.5 text-[12.5px] leading-relaxed text-ink-600">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sea-100 text-[10.5px] font-semibold text-sea-700">
                    {i + 1}
                  </span>
                  {a}
                </li>
              ))}
            </ol>
            <button onClick={() => openBreathing('478')} className="btn-ghost mt-4 text-[12px]">
              <Icon name="wave" size={14} />
              先做 1 分钟呼吸
            </button>
          </motion.div>
        )}
      </section>

      {/* 安全步骤 + 预警信号 */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="glass p-5 sm:p-6">
          <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink-900">如果危险就在眼前</h2>
          <ol className="mt-3 space-y-2.5">
            {SAFETY_STEPS.map((s, i) => (
              <li key={s} className="flex gap-3 text-[12.5px] leading-relaxed text-ink-600">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-coral-300/25 text-[10.5px] font-semibold text-[#c2634f]">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
          <div className="mt-4 rounded-2xl bg-sea-50/70 px-4 py-3 text-[11.5px] leading-relaxed text-ink-600">
            如果你身边有人处于危险中：不要留他独自一人，移除可能造成伤害的物品，直接问"你是不是想自杀"不会增加风险，反而常常带来松一口气。
          </div>
        </section>

        <section className="glass p-5 sm:p-6">
          <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink-900">需要专业评估的信号</h2>
          <p className="mt-1 text-[11px] text-ink-400">出现任意一条，都值得联系学校心理中心或医院心理科/精神科。</p>
          <ul className="mt-3 space-y-2">
            {SIGNALS.map((s) => (
              <li key={s} className="flex gap-2.5 text-[12.5px] leading-relaxed text-ink-600">
                <Icon name="alert" size={13} className="mt-1 shrink-0 text-coral-400" />
                {s}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* 求助流程 */}
      <SafetyPlan />

      <section className="mt-4 rounded-4xl border border-white/70 bg-white/50 p-5 sm:p-6">
        <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink-900">第一次求助，可以这样开始</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { t: '找入口', d: '学校心理健康教育中心通常在官网或公众号有预约入口；医院挂"精神科"或"临床心理科"。' },
            { t: '做准备', d: '写下三件事：什么时候开始、最困扰的症状、睡眠与食欲的变化。不用写成文章。' },
            { t: '开口说', d: '第一句话可以是："我最近状态很不好，想请你帮我看看。"剩下的，对方会带你走。' },
          ].map((s, i) => (
            <div key={s.t} className="rounded-2xl bg-white/60 px-4 py-3">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-900">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-lav-100 text-[10px] text-lav-500">
                  {i + 1}
                </span>
                {s.t}
              </p>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-500">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6">
        <ReliefBlindBox />
      </div>
    </div>
  )
}
