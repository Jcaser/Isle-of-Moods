import { motion } from 'framer-motion'
import { Icon } from '../components/Icons'
import { NowWizard } from '../components/NowWizard'
import { PageHeader } from '../components/PageHeader'
import { ReliefBlindBox } from '../components/ReliefBlindBox'
import { SafetyPlan } from '../components/SafetyPlan'
import { SayItForMe } from '../components/SayItForMe'
import { CRISIS_RESOURCES, SAFETY_STEPS } from '../lib/crisis'

const SIGNALS = [
  '几乎每天情绪低落、空虚，持续两周以上',
  '对原本喜欢的事失去兴趣，什么都不想做',
  '睡眠、食欲、体重明显改变，持续疲惫',
  '无法上课、无法完成基本作业，回避所有人',
  '反复出现"活着没意思""我是别人的负担"',
  '出现自伤行为，或开始计划、准备、交代后事',
]

export default function Harbor() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Safe Harbor"
        icon={<Icon name="lifebuoy" size={13} />}
        title="避风港"
        desc="这里不讲道理，也不分析你。如果此刻很难受，先做下面任意一件：打一个电话，或者跟着两步向导，拿到一份能照着做的清单。"
      />

      {/* 紧急卡片：只留最该做的三件事 */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-5xl border border-coral-300/40 bg-gradient-to-br from-[#fdf1ec] via-white/70 to-[#f3f6fb] p-5 shadow-soft sm:p-7"
      >
        <div className="pointer-events-none absolute -right-10 -top-12 h-56 w-56 rounded-full bg-coral-300/20 blur-3xl" />
        <div className="relative z-10 grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.18em] text-coral-500">
              <Icon name="alert" size={12} />
              如果有伤害自己的念头
            </p>
            <h2 className="mt-2.5 font-display text-[22px] font-semibold leading-snug tracking-tight text-ink-900 sm:text-[26px]">
              先不要一个人扛着。
            </h2>
            <p className="mt-2 max-w-lg text-[12.5px] leading-relaxed text-ink-600">
              不用把话说清楚，也不用先证明自己「够严重」。接通之后，说一句「我现在很不好」就可以。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href="tel:12356" className="btn-primary px-5 py-3 text-[13px]">
                <Icon name="lifebuoy" size={16} />
                拨打 12356
              </a>
              <a href="tel:120" className="btn-ghost px-4 py-3 text-[12.5px]">
                120 急救
              </a>
              <a href="tel:110" className="btn-ghost px-4 py-3 text-[12.5px]">
                110 报警
              </a>
            </div>
          </div>

          <div className="grid gap-1.5 sm:grid-cols-2">
            {CRISIS_RESOURCES.map((r) => (
              <a
                key={r.phone}
                href={r.phone.includes('/') ? 'tel:120' : `tel:${r.phone.replace(/-/g, '')}`}
                className="rounded-2xl border border-white/80 bg-white/70 px-3.5 py-2.5 transition hover:bg-white"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[11.5px] font-medium text-ink-900">{r.name}</p>
                  <span className="shrink-0 text-[9px] text-ink-300">{r.hours}</span>
                </div>
                <p className="mt-0.5 font-display text-[14px] font-semibold tracking-tight text-sea-700">{r.phone}</p>
              </a>
            ))}
          </div>
        </div>
      </motion.section>

      {/* 交互区：向导 + 话术 */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.22fr_0.95fr]">
        <NowWizard />
        <SayItForMe />
      </div>

      {/* 长文本折叠：默认收起，需要时再展开 */}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <details className="group rounded-4xl border border-white/70 bg-white/50 px-5 py-4 open:bg-white/62">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <div>
              <p className="font-display text-[14px] font-semibold tracking-tight text-ink-900">如果危险就在眼前</p>
              <p className="mt-0.5 text-[10.5px] text-ink-400">4 个动作，按顺序</p>
            </div>
            <Icon name="arrowRight" size={15} className="shrink-0 text-ink-300 transition group-open:rotate-90" />
          </summary>
          <ol className="mt-3 space-y-2">
            {SAFETY_STEPS.map((s, i) => (
              <li key={s} className="flex gap-2.5 text-[12px] leading-relaxed text-ink-600">
                <span className="mt-0.5 flex shrink-0 items-center justify-center rounded-full bg-coral-300/25 text-[10px] font-semibold text-[#c2634f]" style={{ height: 18, width: 18 }}>
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
          <p className="mt-3 rounded-2xl bg-sea-50/70 px-3.5 py-2.5 text-[11px] leading-relaxed text-ink-600">
            如果身边有人处于危险中：不要留他独自一人，移除可能造成伤害的物品。直接问「你是不是想自杀」不会增加风险，反而常常让人松一口气。
          </p>
        </details>

        <details className="group rounded-4xl border border-white/70 bg-white/50 px-5 py-4 open:bg-white/62">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <div>
              <p className="font-display text-[14px] font-semibold tracking-tight text-ink-900">什么时候该去看医生</p>
              <p className="mt-0.5 text-[10.5px] text-ink-400">出现任意一条，都值得联系学校心理中心或医院</p>
            </div>
            <Icon name="arrowRight" size={15} className="shrink-0 text-ink-300 transition group-open:rotate-90" />
          </summary>
          <ul className="mt-3 space-y-1.5">
            {SIGNALS.map((s) => (
              <li key={s} className="flex gap-2 text-[12px] leading-relaxed text-ink-600">
                <Icon name="alert" size={12} className="mt-1 shrink-0 text-coral-400" />
                {s}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[10.5px] leading-relaxed text-ink-300">
            去之前不用准备什么，写下「什么时候开始、最困扰的症状、睡眠和食欲的变化」三行字就够。
          </p>
        </details>
      </div>

      {/* 安全计划 */}
      <div className="mt-4 [&>section]:mt-0">
        <SafetyPlan />
      </div>

      <div className="mt-6">
        <ReliefBlindBox />
      </div>

      <p className="mt-5 text-center text-[10.5px] leading-relaxed text-ink-300">
        清绪之屿不做诊断，也不替代专业帮助。所有记录只存在这台设备上。
      </p>
    </div>
  )
}
