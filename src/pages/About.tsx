import { motion } from 'framer-motion'
import { Icon } from '../components/Icons'
import { PageHeader } from '../components/PageHeader'
import { KB_STATS } from '../lib/rag'

const TECH = [
  { k: '前端框架', v: 'React 18 + TypeScript + Vite', d: '路由级代码分割、组件化、TS 严格模式' },
  { k: '样式与动效', v: 'Tailwind CSS + Framer Motion', d: '设计令牌统一色板、克制的场域动画' },
  { k: '状态与存储', v: 'Zustand + localStorage', d: '情绪数据本地持久化，无账号、无云端' },
  { k: '模型接入', v: 'OpenAI 兼容 + SSE 流式', d: 'DeepSeek / 智谱 / 通义 / 本地 Ollama 均可' },
  { k: 'Agent', v: 'Function Calling 多轮编排', d: '6 个工具、思考过程可视化、最大 4 步' },
  { k: 'RAG', v: '本地 BM25 + 中文二元组', d: '段落切块、同义扩展、引用可回溯原文' },
  { k: '多模态', v: 'Web Speech API + Canvas', d: '语音合成、语音输入、程序化壁纸生成' },
  { k: '安全', v: '关键词分级 + 安全协议', d: '双通道检测、危机资源置顶、AI 输出兜底' },
]

const SCORE_MAP = [
  { dim: 'AI 技术深度', w: '35%', how: '多轮 Function Calling Agent（检索 / 呼吸 / 自评 / 计划 / 记录 / 趋势）、真实 RAG 引用、TTS 与端侧图像生成、输出安全过滤与本地模式兜底' },
  { dim: '创新性', w: '25%', how: '「情绪岛屿」叙事贯穿交互；AI 工具调用直接驱动界面动作（开呼吸面板、开量表）；把 CBT 思维记录做成可对话的流程；情绪潮汐可视化' },
  { dim: '前端工程质量', w: '10%', how: 'TypeScript 严格模式、按路由分包、组件分层、Zustand 单一状态源、无障碍标签与键盘操作、减少动效支持' },
  { dim: '实用性', w: '10%', how: '面向真实备考场景：考前失眠、考场空白、拖延内耗、灾难化思维；无需注册、打开即用、断网可用' },
  { dim: '用户体验', w: '10%', how: '流式输出、思考与工具调用可视化、引用展开、错误降级、响应式移动端、柔和低对比视觉' },
  { dim: '社会价值与商业潜力', w: '10%', how: '高校心理中心可部署、机构 iframe 组件、分考试类型定制知识库、开源共建' },
]

function Section({ title, eyebrow, children }: { title: string; eyebrow?: string; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="mt-8"
    >
      {eyebrow && <p className="text-[10.5px] font-semibold uppercase tracking-[0.24em] text-sea-500">{eyebrow}</p>}
      <h2 className="mt-1.5 font-display text-xl font-semibold tracking-tight text-ink-900">{title}</h2>
      <div className="mt-3">{children}</div>
    </motion.section>
  )
}

export default function About() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="About"
        icon={<Icon name="compass" size={13} />}
        title="关于清绪之屿"
        desc="清绪，是厘清、平复躁动的情绪；之屿，是一座可以短暂停靠的数字小岛。我们想做的，不是让焦虑消失，而是让你在风浪里有一个能站稳的地方。"
      />

      <section className="relative overflow-hidden rounded-5xl border border-white/70 bg-gradient-to-br from-white/70 via-sea-50/50 to-lav-100/40 p-6 shadow-soft sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/60 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center">
          <img src="/brand/icon-256.png" alt="" className="h-20 w-20 shrink-0 object-contain animate-float" />
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink-900">
              SereneIsle · 考试焦虑自助调节平台
            </h2>
            <p className="mt-2 text-[12.5px] leading-[1.85] text-ink-600">
              本项目是一款 AI-Native Web 应用，面向高考、考研、期末考等备考人群，针对考前焦虑、内耗、睡眠障碍与备考压力过大等现实痛点打造。
              以 AI Agent 为核心，结合 RAG 心理知识库与多模态舒缓交互，提供对话疏导、情绪测评、正念放松、减压备考规划等一站式自助服务。
            </p>
            <p className="mt-2 text-[12.5px] leading-[1.85] text-ink-500">
              平台坚持隐私优先：情绪数据默认保存在浏览器本地，不上传云端服务器。产品仅作为心理自助辅助工具，不替代专业医师诊疗；
              当识别到高危心理信号时，自动推送官方心理援助渠道。
            </p>
            <p className="mt-3 flex flex-wrap gap-1.5">
              {['AI Native', 'Agent', 'RAG', '多模态', '隐私优先', 'AI 健康与生活服务赛道'].map((t) => (
                <span key={t} className="chip text-[10px]">
                  {t}
                </span>
              ))}
            </p>
          </div>
        </div>
      </section>

      <Section eyebrow="Modules" title="五个模块，一条完整的自助路径">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['岛主对话', '情绪承接 → RAG 检索 → 工具调用 → 具体动作', 'chat'],
            ['屿藏书阁', `${KB_STATS.docs} 篇条目、${KB_STATS.chunks} 个检索片段，答案可追溯`, 'book'],
            ['潮汐疗愈', '4-7-8 呼吸动画、正念语音、端侧壁纸生成', 'wave'],
            ['情绪潮向', '情绪记录、趋势图、GAD-7 自评与个性化提示', 'chart'],
            ['避风港', '高危信号识别、真实热线、就医与求助步骤', 'lifebuoy'],
          ].map(([t, d, ic]) => (
            <div key={t} className="flex items-start gap-3 rounded-3xl border border-white/70 bg-white/50 px-4 py-3.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sea-100 text-sea-600">
                <Icon name={ic as any} size={15} />
              </span>
              <div>
                <p className="text-[13px] font-medium text-ink-900">{t}</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-500">{d}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Architecture" title="技术实现">
        <div className="overflow-hidden rounded-4xl border border-white/70 bg-white/50">
          {TECH.map((t, i) => (
            <div
              key={t.k}
              className={`flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 ${
                i ? 'border-t border-white/60' : ''
              }`}
            >
              <span className="w-24 shrink-0 text-[10.5px] tracking-wide text-ink-300">{t.k}</span>
              <span className="w-52 shrink-0 text-[12px] font-medium text-ink-900">{t.v}</span>
              <span className="text-[11.5px] leading-relaxed text-ink-500">{t.d}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
          说明：AI 能力通过前端直连 OpenAI 兼容接口实现，后端仅作为模型接入层；知识库、检索与用户数据全部在浏览器端完成，
          因此可以纯静态部署，也天然满足数据最小化原则。
        </p>
      </Section>

      <Section eyebrow="Alignment" title="与赛项评分维度的对应">
        <div className="space-y-2">
          {SCORE_MAP.map((s) => (
            <div key={s.dim} className="rounded-3xl border border-white/70 bg-white/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-[12.5px] font-semibold text-ink-900">{s.dim}</span>
                <span className="rounded-full bg-sea-100 px-2 py-0.5 text-[9.5px] font-medium text-sea-700">权重 {s.w}</span>
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-ink-500">{s.how}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="Privacy" title="隐私与数据">
        <ul className="space-y-2 text-[12.5px] leading-relaxed text-ink-600">
          {[
            '不需要注册、不需要手机号，打开即可使用。',
            '对话、情绪记录、自评分数只写入浏览器 localStorage，不会上传到任何服务器。',
            'API Key 同样只保存在本机，浏览器直接请求模型服务商；公共设备建议不保存，或使用后清除。',
            '在设置中可一键导出全部数据，或彻底删除；清除浏览器站点数据同样会删除全部内容。',
            '页面不接入第三方统计与广告脚本。',
          ].map((s) => (
            <li key={s} className="flex gap-2.5">
              <Icon name="check" size={14} className="mt-1 shrink-0 text-sea-500" />
              {s}
            </li>
          ))}
        </ul>
      </Section>

      <Section eyebrow="Disclaimer" title="免责声明">
        <div className="rounded-4xl border border-coral-300/30 bg-coral-300/10 p-5 text-[12.5px] leading-[1.9] text-ink-700">
          <p>
            清绪之屿仅为考前情绪自助调节辅助工具，
            <strong className="font-semibold">不能替代专业心理咨询师与医疗机构诊断治疗</strong>
            ，如出现严重心理困扰，请及时联系线下心理卫生机构。
          </p>
          <p className="mt-2">
            平台内容基于公开的教育心理学、认知行为疗法与睡眠医学共识整理，仅供科普与自我调节参考，不构成医疗建议。
            任何 AI 生成内容都可能存在偏差，请以专业人员的评估为准。
          </p>
          <p className="mt-2">
            全国统一心理援助热线：<a href="tel:12356" className="font-semibold text-sea-700 underline underline-offset-2">12356</a>（24 小时）；
            紧急情况请拨打 <a href="tel:120" className="font-semibold text-sea-700 underline underline-offset-2">120</a> 或
            <a href="tel:110" className="ml-1 font-semibold text-sea-700 underline underline-offset-2">110</a>。
          </p>
        </div>
      </Section>

      <Section eyebrow="Team" title="参赛信息">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['作品名称', '清绪之屿 SereneIsle'],
            ['参赛赛道', 'AI 健康与生活服务'],
            ['团队 / 学校', '待补充'],
            ['指导老师', '待补充'],
            ['代码仓库', '待补充（GitHub / Gitee）'],
            ['在线演示', '待部署'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-white/70 bg-white/50 px-4 py-3">
              <p className="text-[10px] tracking-wide text-ink-300">{k}</p>
              <p className="mt-0.5 text-[12.5px] text-ink-800">{v}</p>
            </div>
          ))}
        </div>
      </Section>

      <p className="mt-10 pb-4 text-center text-[11px] tracking-wide text-ink-300">
        停泊情绪风浪，从容奔赴考场 · SereneIsle
      </p>
    </div>
  )
}
