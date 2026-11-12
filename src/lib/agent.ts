/**
 * 岛主 Agent 编排
 *
 * 一次对话 = 预检索（RAG）+ 风险扫描 + 多轮工具调用循环 + 流式输出
 * 当未配置 Key 或接口异常时，自动降级为「本地知识模式」：
 * 用同一套检索结果 + 规则化共情模板作答，保证 Demo 与离线演示可用。
 */

import { streamChat, type ApiMessage, type LLMConfig } from './llm'
import { TOOL_SCHEMAS, TOOL_LABELS, runTool, type ToolContext } from './tools'
import { buildContextBlock, retrieve } from './rag'
import { CRISIS_SYSTEM_NOTE, detectRisk } from './crisis'
import { MOOD_META, summarize } from './mood'
import { LEVEL_META } from './assessment'
import type { AssessmentRecord, ChatMessage, Citation, MoodRecord, RiskLevel, Settings, ToolCall, ToolResult } from './types'

export type AgentEvent =
  | { type: 'mode'; mode: 'cloud' | 'local' }
  | { type: 'delta'; text: string }
  | { type: 'tool_start'; call: ToolCall; label: string }
  | { type: 'tool_end'; result: ToolResult }
  | { type: 'citations'; items: Citation[] }
  | { type: 'risk'; level: RiskLevel }
  | { type: 'error'; message: string }
  | { type: 'done'; content: string }

const PERSONA = `你是「屿」，清绪之屿（SereneIsle）的海岛向导，一位受认知行为疗法（CBT）与正念训练理念启发的自助陪伴者。你陪伴的对象是正在备考的学生——高考、考研、期末、公考、教资，他们常见的问题是考前焦虑、反刍内耗、失眠、拖延与自我否定。

【说话方式】
- 温和、具体、不居高临下。不说"别紧张""想开点""大家都这样"这类否定感受的话。
- 先用一句话准确接住对方的感受（命名情绪），再给一个此刻就能做的动作。
- 回复 180-320 字，Markdown 排版，分点最多 3 条，不要长篇大论。
- 不用"作为 AI"开头，不卖萌，不堆砌比喻；海岛意象整段最多用一次。
- 结尾留一个开放的小问题，或一个 10 分钟内能完成的小步骤。

【专业边界】
- 不做诊断、不推荐药物、不承诺疗效；不评价用户的成绩、院校与选择。
- 需要专业判断时，明确建议学校心理中心或医院心理科/精神科。
- 不编造研究数据与文献；不确定就说不确定。
- 若下方【检索资料】被引用，在句末用 [1][2] 标注对应编号，绝不虚构编号。

【工具使用】
- 心跳快/手抖/坐不住/睡不着/想放松 → start_breathing
- 想知道自己焦虑程度、或症状持续两周以上 → open_anxiety_assessment
- 需要复习安排、时间不够 → create_study_plan
- 明确说出情绪分数并同意记录 → log_mood
- 想回顾最近状态 → get_mood_trend
- 问"为什么/怎么办/有什么依据" → search_knowledge_base
- 每轮最多调用 2 个工具；工具返回后要用自然语言承接，不要把 JSON 或工具名念给用户。`

function moodBlock(records: MoodRecord[], assessments: AssessmentRecord[]): string {
  const s = summarize(records, 14)
  const lines: string[] = []
  if (s.count) {
    lines.push(
      `用户近 14 天有 ${s.count} 条情绪记录，平均 ${s.avg?.toFixed(1)}/5${
        s.topTags.length ? `，高频标签：${s.topTags.map((t) => t.tag).join('、')}` : ''
      }。最近一次：${MOOD_META[records[0]?.score ?? 3]?.label ?? '未知'}。`,
    )
  } else {
    lines.push('用户还没有情绪记录。')
  }
  if (assessments.length) {
    const last = [...assessments].sort((a, b) => b.ts - a.ts)[0]
    lines.push(`最近一次 GAD-7：${last.total} 分（${LEVEL_META[last.level].label}）。`)
  }
  return lines.join('\n')
}

function buildSystem(opts: {
  citations: Citation[]
  records: MoodRecord[]
  assessments: AssessmentRecord[]
  riskLevel: RiskLevel
}): string {
  const parts = [PERSONA]
  parts.push(`【用户状态（本地数据，仅用于调整语气，不要逐字复述）】\n${moodBlock(opts.records, opts.assessments)}`)
  const ctx = buildContextBlock(opts.citations)
  parts.push(`【检索资料｜来自屿藏书阁，可作为依据】\n${ctx || '（本轮未检索到直接相关的资料，请基于通用心理学常识回答，不要编造出处）'}`)
  if (opts.riskLevel === 'high' || opts.riskLevel === 'medium') parts.push(CRISIS_SYSTEM_NOTE)
  parts.push(`今天是 ${new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}。`)
  return parts.join('\n\n')
}

function toApiHistory(history: ChatMessage[]): ApiMessage[] {
  return history
    .filter((m) => m.content.trim())
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content }))
}

export interface RunAgentOptions {
  userText: string
  history: ChatMessage[]
  settings: Settings
  records: MoodRecord[]
  assessments: AssessmentRecord[]
  ctx: ToolContext
  signal: AbortSignal
  onEvent: (e: AgentEvent) => void
}

export async function runAgent(opts: RunAgentOptions): Promise<void> {
  const { userText, history, settings, records, assessments, ctx, signal, onEvent } = opts

  const citations = retrieve(userText, 3)
  const risk = detectRisk(userText)
  onEvent({ type: 'citations', items: citations })
  onEvent({ type: 'risk', level: risk.level })

  const config: LLMConfig = {
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model: settings.model,
    temperature: settings.temperature,
  }

  if (!settings.apiKey) {
    onEvent({ type: 'mode', mode: 'local' })
    const text = offlineRespond(userText, citations, risk.level)
    await typeOut(text, onEvent, signal)
    onEvent({ type: 'done', content: text })
    return
  }

  onEvent({ type: 'mode', mode: 'cloud' })

  const messages: ApiMessage[] = [
    {
      role: 'system',
      content: buildSystem({ citations, records, assessments, riskLevel: risk.level }),
    },
    ...toApiHistory(history),
    { role: 'user', content: userText },
  ]

  let full = ''
  const MAX_STEPS = 4

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      if (signal.aborted) return

      const res = await streamChat({
        config,
        messages,
        tools: TOOL_SCHEMAS,
        signal,
        onDelta: (t) => {
          full += t
          onEvent({ type: 'delta', text: t })
        },
      })

      if (!res.toolCalls.length) break

      messages.push({
        role: 'assistant',
        content: res.content || null,
        tool_calls: res.toolCalls.map((c) => ({
          id: c.id,
          type: 'function',
          function: { name: c.name, arguments: c.arguments },
        })),
      })

      for (const call of res.toolCalls) {
        onEvent({
          type: 'tool_start',
          call,
          label: TOOL_LABELS[call.name] ?? call.name,
        })
        const result = await runTool(call.name, call.arguments, ctx, call.id)
        onEvent({ type: 'tool_end', result })
        if (result.citations?.length) onEvent({ type: 'citations', items: result.citations })
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: result.summary,
        })
      }
    }

    if (!full.trim()) {
      const text = '我在。你可以慢慢说，想到哪里说到哪里都可以。'
      full = text
      onEvent({ type: 'delta', text })
    }
    onEvent({ type: 'done', content: full })
  } catch (e) {
    if (signal.aborted) return
    const message = (e as Error).message || '对话中断'
    onEvent({ type: 'error', message })
    onEvent({ type: 'mode', mode: 'local' })
    const fallback = offlineRespond(userText, citations, risk.level)
    if (!full.trim()) {
      await typeOut(fallback, onEvent, signal)
      onEvent({ type: 'done', content: fallback })
    } else {
      onEvent({ type: 'done', content: full })
    }
  }
}

/** 本地模式下的逐字输出，保持流式体感 */
async function typeOut(text: string, onEvent: (e: AgentEvent) => void, signal: AbortSignal): Promise<void> {
  const chunks = text.match(/[\s\S]{1,6}/g) ?? []
  for (const c of chunks) {
    if (signal.aborted) return
    onEvent({ type: 'delta', text: c })
    await new Promise((r) => setTimeout(r, 14))
  }
}

interface Intent {
  test: RegExp
  build: (c: Citation[]) => string
}

const INTENTS: Intent[] = [
  {
    test: /(不想活|自杀|自残|活不下去|想死|结束生命|没有意义|撑不下去|熬不下去)/,
    build: () =>
      `我听见你现在很难受，难受到会觉得"撑不下去"——这种感受是真实的，不是你太脆弱。

我很在意你此刻的安全。想先问你一个问题：**你现在安全吗？身边有没有可以马上联系到的人？**

如果你已经有具体的想法或计划，请不要一个人待着：
- 拨打 **12356**（全国统一心理援助热线，24 小时）
- 有即刻危险，拨 **120 / 110**
- 或告诉身边任何一个你信任的人，让对方先陪着你

我在这里陪你说话，但我不能替代真人的紧急援助。你愿意先告诉我，现在最让你喘不过气的是什么吗？`,
  },
  {
    test: /(睡不着|失眠|躺下就清醒|早醒|睡眠)/,
    build: (c) =>
      `考前睡不着，多半不是"身体不需要睡"，而是大脑还停在警戒状态。越盯着"我必须睡着"，越难睡着。

可以试这两步：
- **20 分钟规则**：躺下约 20 分钟仍清醒，就起身到昏暗处做点枯燥的事（纸质闲书、白噪音），有困意再回床。床只用来睡觉，不刷题不刷手机。
- **固定起床时间**：不管几点睡着，第二天同一时间起，白天不补觉超过 30 分钟。

另外提醒一句：单晚没睡好对提取已掌握知识的影响，远小于"我完了"这种解读带来的影响 [1]。

今晚想先试试哪一个？`,
  },
  {
    test: /(紧张|心慌|心跳|手抖|发抖|坐不住|慌|深呼吸|放松|焦虑)/,
    build: () =>
      `这种心慌、手抖的感觉，是身体在为"重要的事"调动资源，不是你要垮了。我们可以先把它调低一点。

现在跟我做 **4-7-8 呼吸**：用鼻子安静吸气 **4 秒**，轻轻屏住 **7 秒**，再用嘴缓慢呼气 **8 秒**。关键是呼气比吸气长——它会通过迷走神经把心率压下来。做 4 个循环，大约 1 分钟。

我已经把引导面板给你打开了，跟着潮汐的节奏就好。做完之后告诉我：心跳有没有下来一点？`,
  },
  {
    test: /(学不进去|拖延|刷手机|效率低|静不下|专注|内耗)/,
    build: () =>
      `拖延常常不是懒，而是任务让你不舒服，刷手机能立刻缓解，于是被"奖励"了。自责又会抬高下一次面对它的成本。

今天只做一件事：**五分钟启动**。跟自己约定"只做 5 分钟，5 分钟后可以停"，并把任务缩到能看见完成状态的程度，比如"打开错题本第 2 页，改 3 道题"，而不是"复习数学"。

要不要现在就把你要做的那件事说给我，我帮你拆成 25 分钟内能完成的一步？`,
  },
  {
    test: /(考砸|考不好|完蛋|来不及|没希望|考不上|灾难|如果.*失败)/,
    build: () =>
      `"考砸就完了"这个念头出现得很快，快到像是事实。但在 CBT 里它只是一个自动思维——可以拿证据检验它。

试着写三行：
1. 支持它的**事实**（不是感觉）是什么？
2. 反对它的证据有哪些？（过去的成绩、被忽略的科目、还有的时间）
3. 如果是你最好的朋友这样想，你会怎么跟他说？

多数人做完会发现：最坏结果并不是"人生结束"，而是某个具体的、可以应对的后果。

你愿意先写下第 1 行吗？我陪你一起看。`,
  },
  {
    test: /(计划|安排|复习|时间不够|怎么复习|冲刺)/,
    build: () =>
      `时间紧的时候，最忌讳"全面重来"。更稳的做法是**减量、同步、清单化**：
- 70% 时间给错题与知识框架，20% 给高频考点默写，10% 保持手感
- 每天留 30 分钟"担心时间"，其余时间出现担心就记下来，留到那时再想
- 把"复习专业课"拆成能 25 分钟看到完成状态的具体动作

告诉我：距离考试还有几天、每天能净学几小时、哪几科，我给你排一份带放松时段的计划。`,
  },
  {
    test: /(自责|没用|废物|对不起|讨厌自己|内耗|不够努力)/,
    build: () =>
      `你对自己的语气，比你对朋友严厉得多。自我批评短期像鞭子，长期会抬高焦虑、降低尝试意愿——它很少真的带来持续的努力。

试试三句话：
- 承认事实："我现在很焦虑，因为还有两章没看完。"
- 承认共通："大部分人在这个节点都会有这种紧迫感。"
- 给出支持："我可以先列出这两章的考点，完成第一章的 10 道错题。"

这不是降低标准，是把"威胁感"拿掉，让你还能动。

你愿意把第一句按你自己的情况说出来吗？`,
  },
  {
    test: /(你好|嗨|在吗|hello|hi|早上好|晚上好)/,
    build: () =>
      `我在，这里是清绪之屿。🌊

你可以把现在最吵的那个念头直接倒出来——不用组织语言，也不用说得"合理"。我会先听，再陪你找一个此刻能做的小动作。

如果不知道该从哪说起，可以先告诉我：**今天最让你耗神的一件事是什么？**`,
  },
]

const DEFAULT_REPLY = (c: Citation[]): string => {
  const top = c[0]
  const basis = top
    ? `关于这一点，屿藏书阁里有篇《${top.title}》提到：${top.snippet.replace(/^…/, '').slice(0, 110)}…`
    : ''
  return `我听到了。你现在的感受是真实的，不需要先证明它"够不够严重"才值得被照顾。

${basis}

我们可以先做一件很小的事：把现在的状态用一句话写下来（"我在担心____"），然后决定今天的最小一步是什么。不用解决全部，先让今天能过去。

你愿意说说，最让你卡住的是哪一部分吗？`
}

/** 本地知识模式：检索 + 规则意图 + 共情模板 */
export function offlineRespond(text: string, citations: Citation[], risk: RiskLevel): string {
  for (const intent of INTENTS) {
    if (intent.test.test(text)) return intent.build(citations)
  }
  return DEFAULT_REPLY(citations)
}
