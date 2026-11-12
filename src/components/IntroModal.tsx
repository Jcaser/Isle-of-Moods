import { useAppStore } from '../store/useAppStore'
import { Icon } from './Icons'
import { Modal } from './Modal'

export function IntroModal() {
  const seen = useAppStore((s) => s.introSeen)
  const markSeen = useAppStore((s) => s.markIntroSeen)
  const openBreathing = useAppStore((s) => s.openBreathing)

  return (
    <Modal open={!seen} onClose={markSeen} hideClose maxWidth="max-w-lg">
      <div className="pb-1 text-center">
        <div className="relative mx-auto h-24 w-24">
          <div className="absolute inset-2 rounded-full bg-sea-200/40 blur-xl" />
          <img src="/brand/icon-256.png" alt="清绪之屿" className="relative h-24 w-24 object-contain animate-float" />
        </div>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-sea-500">SereneIsle</p>
        <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink-900">欢迎靠岸，这里是清绪之屿</h2>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-ink-500">
          一座给备考学生的情绪避风小岛。你可以短暂停靠、把心里的话放下，再决定下一步。
        </p>
      </div>

      <div className="mt-5 space-y-2.5">
        {[
          { icon: 'chat' as const, title: '和岛主聊聊', desc: 'AI 对话疏导，会检索心理知识库，也会调用工具陪你做练习' },
          { icon: 'wave' as const, title: '跟着潮汐呼吸', desc: '4-7-8 呼吸动画与正念语音引导，1 分钟就能把心率降下来' },
          { icon: 'chart' as const, title: '看见情绪潮向', desc: '记录每天的状态，用趋势图观察自己在变好还是需要帮助' },
        ].map((f) => (
          <div key={f.title} className="flex items-start gap-3 rounded-2xl bg-white/55 px-4 py-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sea-100 text-sea-600">
              <Icon name={f.icon} size={16} />
            </span>
            <div>
              <p className="text-[13px] font-medium text-ink-900">{f.title}</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-500">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-2xl border border-sea-200/60 bg-sea-50/60 px-4 py-3">
        <Icon name="shield" size={15} className="mt-0.5 shrink-0 text-sea-600" />
        <p className="text-[11.5px] leading-relaxed text-ink-600">
          你的对话与情绪记录<strong className="font-semibold">只保存在本机浏览器</strong>，不需要注册账号，我们看不到你的内容。
        </p>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-2xl border border-coral-300/30 bg-coral-300/10 px-4 py-3">
        <Icon name="alert" size={15} className="mt-0.5 shrink-0 text-coral-500" />
        <p className="text-[11.5px] leading-relaxed text-ink-600">
          本产品是自助辅助工具，<strong className="font-semibold">不能替代心理咨询与医疗诊断</strong>。若出现严重困扰，请拨
          12356 或前往线下心理卫生机构。
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          onClick={() => {
            markSeen()
            openBreathing('478')
          }}
          className="btn-ghost flex-1"
        >
          <Icon name="wave" size={16} />
          先做一次呼吸
        </button>
        <button onClick={markSeen} className="btn-primary flex-1">
          进入岛屿
          <Icon name="arrowRight" size={16} />
        </button>
      </div>
    </Modal>
  )
}
