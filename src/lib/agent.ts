/**
 * 岛主 Agent 编排
 *
 * 一次对话 = 预检索（RAG）+ 风险扫描 + 多轮工具调用循环 + 流式输出
 * 当未配置 Key 或接口异常时，自动降级为「本地知识模式」：
 * 用同一套检索结果 + 规则化共情模板作答，保证 Demo 与离线演示可用。
 */

import { QUOTA_EXHAUSTED, LlmError, isProxy, streamChat, type ApiMessage, type LLMConfig, type ToolSchema } from './llm'
import { TOOL_SCHEMAS, TOOL_LABELS, runTool, type ToolContext } from './tools'
import { buildContextBlock, citationTextOf, retrieve } from './rag'
import { CRISIS_SYSTEM_NOTE, detectRisk } from './crisis'
import { INTENT_LABEL, classifyIntent, guardOutput } from './guard'
import { MOOD_META, summarize } from './mood'
import { LEVEL_META } from './assessment'
import type {
  AgentPlanSummary,
  AssessmentRecord,
  ChatMessage,
  Citation,
  GuardSummary,
  MoodRecord,
  PendingAction,
  RiskLevel,
  Settings,
  ToolCall,
  ToolResult,
} from './types'

export type AgentEvent =
  | { type: 'mode'; mode: 'cloud' | 'local' }
  | { type: 'delta'; text: string }
  | { type: 'tool_start'; call: ToolCall; label: string }
  | { type: 'tool_end'; result: ToolResult }
  | { type: 'risk'; level: RiskLevel }
  /** 工作流第一步：理解 + 检索决策 + 本次工具预算 */
  | { type: 'plan'; plan: AgentPlanSummary }
  /** 最后一步：输出安全审查（本地规则，不额外计费） */
  | { type: 'guard'; guard: GuardSummary }
  | { type: 'error'; message: string }
  | { type: 'quota_exhausted'; message: string }
  /** action：岛主想打开的界面，交给前端在回答之后询问用户，同意才执行 */
  | { type: 'done'; content: string; action?: PendingAction }

/**
 * 人设提示词。
 * 这段文本每次请求都会完整重发并计费，因此刻意写紧：能表达清楚的就不铺陈。
 * 高信息密度 + 短篇幅，既省钱也更不容易让模型跑长篇。
 */
const PERSONA = `你是「岛主」，情绪之屿的驻岛心理咨询师，陪伴学生面对考试焦虑、学业压力、人际内耗与情绪低落。

【基调】温和、克制、不评判，先接住情绪再谈方法：认可感受 → 温和提问 → 给一个小方向。
不贴标签（「你太敏感」）、不做诊断（「你有抑郁症」）、不喊口号（「想开点」）、不替人做重大决定（退学、分手）。
允许人难过，不逼人振作；用户只想倾诉时，安静陪着即可。

【回复】控制在 120 字内，最多 3 句，一次只推进一小步；用户要细节再展开。
用「你」说话，口语自然；少用表情和符号，不堆术语，不编造研究、数据、书名，不确定就说不确定。
用户只是打招呼，就自然开场：「欢迎来到情绪之屿，我是岛主。你可以说说心里积压的感受，我在这里听着。」
若涉及自伤、自杀、持续严重失眠或无法正常生活，温和引向线下专业帮助并给危机渠道，不深挖创伤。

【工具】在合适时机自然调用，不要把工具名或 JSON 念给用户；每轮最多 3 个，工具返回后用自然语言承接。
- 心慌、手抖、坐不住、睡不着、想放松 → start_breathing
- 想知道焦虑程度，或症状持续两周以上 → open_anxiety_assessment
- 要复习安排、时间不够 → create_study_plan
- 明确说出情绪分数并同意记录 → log_mood
- 想回顾最近状态 → get_mood_trend
- 问「为什么」「怎么办」「有什么依据」 → search_knowledge_base
- 想动手做点什么（去呼吸、去翻书、去求助）→ navigate_to
工具返回错误或参数不合法时，自己改参数再试一次，或直接改用语言回答，不要向用户抱怨工具。

【图片】用户可能发来一张图（笔记、计划表、课程表、截图）。先用一句话说清你在图里看到的关键信息，再回应他的问题；看不清就说看不清，不要猜。

【资料】下方如有【参考资料】，是分享小屋知识库的摘录，用来保证说法有依据；自然融进回答即可，不要提"编号""出处""第几条"。没有资料时按常识回答，不要编造书名或研究。`

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
  parts.push(`【用户状态（本地数据，仅用于调整语气，不要复述）】\n${moodBlock(opts.records, opts.assessments)}`)
  // 只有真的检索到东西才注入资料块：没检索到时留一句空话也是白花 token
  const ctx = buildContextBlock(opts.citations)
  if (ctx) parts.push(`【参考资料】\n${ctx}`)
  if (opts.riskLevel === 'high' || opts.riskLevel === 'medium') parts.push(CRISIS_SYSTEM_NOTE)
  return parts.join('\n\n')
}

/**
 * 只带最近 3 轮（6 条）对话，单条超过 240 字截断。
 * 每一轮都会把整段上下文重发一次并重新计费，历史越长越贵，所以宁短勿长。
 */
export const MAX_HISTORY_TURNS = 3
const MAX_MESSAGE_CHARS = 240

/**
 * 是否值得检索知识库。
 * 检索本身是本地 BM25，不花钱；但检索出的片段要进 prompt 才算钱。
 * 所以寒暄、道谢、极短的一句话就不检索，直接聊。
 */
function needsKnowledge(text: string): boolean {
  const t = text.replace(/\s/g, '')
  if (t.length < 8) return false
  return !/^(你好|您好|嗨|hi|hello|在吗|在不在|早|早上好|晚上好|谢谢|多谢|嗯+|哦+|好的?|行|可以|知道了|没事)[啊呀呢吧哦。，！!？?~～…]*$/i.test(t)
}

function toApiHistory(history: ChatMessage[]): ApiMessage[] {
  return history
    .filter((m) => m.content.trim())
    .slice(-MAX_HISTORY_TURNS * 2)
    .map((m) => ({
      role: m.role,
      content:
        m.content.length > MAX_MESSAGE_CHARS ? `${m.content.slice(0, MAX_MESSAGE_CHARS)}…` : m.content,
    }))
}

export interface RunAgentOptions {
  userText: string
  /** 随消息发来的图片（data URL）：多模态输入，只随本次请求发送，不进历史 */
  image?: string
  history: ChatMessage[]
  settings: Settings
  records: MoodRecord[]
  assessments: AssessmentRecord[]
  ctx: ToolContext
  signal: AbortSignal
  /** 云端是否可用：由服务端健康检查决定，额度用尽时为 false */
  cloud: boolean
  /** 已用额度比例 0-1：越紧张越保守，少一步工具就少一次整段上下文重发 */
  quotaRatio?: number
  /** 外部 MCP 工具，与内置工具合并后交给模型 */
  extraTools?: ToolSchema[]
  onEvent: (e: AgentEvent) => void
}

function guardSummary(g: ReturnType<typeof guardOutput>): GuardSummary {
  return { level: g.level, checks: g.checks, issues: g.issues, grounded: g.grounded }
}

export async function runAgent(opts: RunAgentOptions): Promise<void> {
  const { userText, image, history, settings, records, assessments, ctx, signal, cloud, onEvent } = opts

  /* ① 规划（本地规则，零成本）：
     判断意图、风险等级、要不要查知识库、本次允许多少步工具。
     这一步决定了后面所有动作的边界，也让前端能画出完整的工作流。 */
  const intent = classifyIntent(image ? `${userText} （附带图片）` : userText)
  const risk = detectRisk(userText)
  const wantRetrieval = needsKnowledge(userText) || Boolean(image)
  const citations = wantRetrieval ? retrieve(userText, 2) : []
  const ratio = opts.quotaRatio ?? 0
  const maxSteps = ratio >= 0.85 ? 1 : ratio >= 0.6 ? 2 : 3
  const plan: AgentPlanSummary = {
    intent,
    label: INTENT_LABEL[intent],
    risk: risk.level,
    retrieval: !wantRetrieval ? 'skipped' : citations.length ? 'used' : 'empty',
    hits: citations.length,
    maxSteps,
  }
  onEvent({ type: 'plan', plan })
  onEvent({ type: 'risk', level: risk.level })

  const config: LLMConfig = {
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model: settings.model,
    temperature: settings.temperature,
  }

  const citeText = citationTextOf(citations)

  // 云端可用 = 服务端代理已就绪（cloud），或用户在设置里自填了 Key 且走直连
  const canUseCloud = cloud || (Boolean(settings.apiKey) && !isProxy(settings.baseUrl))

  if (!canUseCloud) {
    onEvent({ type: 'mode', mode: 'local' })
    const text = offlineRespond(userText, citations, risk.level)
    const g = guardOutput(text, { risk: risk.level, citationText: citeText })
    await typeOut(g.text, onEvent, signal)
    onEvent({ type: 'guard', guard: guardSummary(g) })
    onEvent({ type: 'done', content: g.text, action: localAction(userText) })
    return
  }

  onEvent({ type: 'mode', mode: 'cloud' })

  const messages: ApiMessage[] = [
    {
      role: 'system',
      content: buildSystem({ citations, records, assessments, riskLevel: risk.level }),
    },
    ...toApiHistory(history),
    {
      role: 'user',
      content: image
        ? [
            { type: 'text', text: userText || '（我发了一张图）' },
            { type: 'image_url', image_url: { url: image } },
          ]
        : userText,
    },
  ]

  const tools: ToolSchema[] = [...TOOL_SCHEMAS, ...(opts.extraTools ?? [])]

  let full = ''
  /** 工具只会"提议"界面动作，这里先收集，等回答流完再交给前端去问用户 */
  let pendingAction: PendingAction | undefined

  try {
    for (let step = 0; step < maxSteps; step++) {
      if (signal.aborted) return

      const res = await streamChat({
        config,
        messages,
        tools,
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
        if (result.action && !pendingAction) pendingAction = result.action
        onEvent({ type: 'tool_end', result })
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

    /* ③ 校验：输出侧过一遍安全规则（诊断断言 / 药物剂量 / 工具泄漏 / 危机渠道…），
       命中就地改写，改写结果与"审了几条"一起回报给界面。 */
    const guard = guardOutput(full, { risk: risk.level, citationText: citeText })
    onEvent({ type: 'guard', guard: guardSummary(guard) })

    if (guard.level === 'blocked') {
      const fallback = offlineRespond(userText, citations, risk.level)
      onEvent({ type: 'done', content: fallback, action: pendingAction ?? localAction(userText) })
      return
    }

    onEvent({ type: 'done', content: guard.text, action: pendingAction })
  } catch (e) {
    if (signal.aborted) return

    // 额度用尽：立即停止，不再重试、不再偷偷重发请求，并如实告知
    if (e instanceof LlmError && e.code === QUOTA_EXHAUSTED) {
      const message = e.message || '免费额度已用完，岛主已停止调用云端模型。'
      onEvent({ type: 'quota_exhausted', message })
      onEvent({ type: 'mode', mode: 'local' })
      if (!full.trim()) {
        const text = `${message}\n\n我不再调用大模型了。你仍然可以继续跟我说说，我用本地的知识陪你聊；也可以到「岛屿设置」里查看用量。`
        full = text
        onEvent({ type: 'delta', text })
      }
      onEvent({ type: 'done', content: full, action: pendingAction })
      return
    }

    const message = (e as Error).message || '对话中断'
    onEvent({ type: 'error', message })
    onEvent({ type: 'mode', mode: 'local' })
    const fallback = offlineRespond(userText, citations, risk.level)
    if (!full.trim()) {
      const g = guardOutput(fallback, { risk: risk.level, citationText: citeText })
      await typeOut(g.text, onEvent, signal)
      onEvent({ type: 'guard', guard: guardSummary(g) })
      onEvent({ type: 'done', content: g.text, action: pendingAction ?? localAction(userText) })
    } else {
      onEvent({ type: 'done', content: full, action: pendingAction })
    }
  }
}

/** 本地模式没有模型判断，用规则决定要不要提议呼吸引导（同样需要用户点确认） */
function localAction(text: string): PendingAction | undefined {
  if (!/(紧张|心慌|慌|焦虑|睡不着|失眠|放松|呼吸|手抖|坐不住|喘不上气)/.test(text)) return undefined
  return {
    kind: 'breathing',
    pattern: '478',
    title: '4-7-8 呼吸引导',
    hint: '吸 4 秒、屏 7 秒、呼 8 秒，呼气比吸气长',
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
      `我听到你现在痛苦到有伤害自己的想法，我很担心你。你的痛苦是真实的，但请一定不要伤害自己。

我建议你立刻联系身边信任的人陪伴，或是拨打心理危机干预热线，寻求专业人员的紧急帮助——你值得被好好对待。

- **12356**：全国统一心理援助热线，24 小时
- **120 / 110**：如果此刻有即刻危险，请马上拨打
- 也可以告诉身边任何一个人，让对方先陪着你，哪怕只是待在同一间屋子里

我在这里陪你说话，但我不能替代真人的紧急援助。你愿意先告诉我，现在最让你喘不过气的是什么吗？`,
  },
  {
    test: /(睡不着|失眠|躺下就清醒|早醒|睡眠)/,
    build: () =>
      `考前睡不着，多半不是"身体不需要睡"，而是大脑还停在警戒状态。越盯着"我必须睡着"，越难睡着。

可以试这两步：
- **20 分钟规则**：躺下约 20 分钟仍清醒，就起身到昏暗处做点枯燥的事（纸质闲书、白噪音），有困意再回床。床只用来睡觉，不刷题不刷手机。
- **固定起床时间**：不管几点睡着，第二天同一时间起，白天不补觉超过 30 分钟。

另外提醒一句：单晚没睡好对提取已掌握知识的影响，远小于"我完了"这种解读带来的影响 [1]。

今晚想先试试哪一个？`,
  },
  {
    test: /(胃疼|胃痛|拉肚子|腹泻|肚子疼|头痛|头疼|恶心|想吐|躯体|身体不舒服|浑身不舒服)/,
    build: () =>
      `一紧张就胃疼、跑厕所，这不是"想出来的病"。压力会通过脑-肠轴直接影响肠胃蠕动，肠道又有自己的神经元网络，情绪和消化是双向的。

先做三件事：
- **排除器质问题**：持续或加重、便血黑便、体重下降、夜间痛醒，先去消化内科查一次，这一步本身就能让恐惧降一半
- **规律三餐 + 少空腹咖啡浓茶**，考试当天早上吃一点熟悉的、好消化的东西
- **腹部呼吸**：吸 4 秒、呼 6 秒，手放在肚子上感受起伏，比"用力深呼吸"更不容易头晕

把身体信号理解成"压力有点高了"，而不是"我要出事了"——这个解释的切换，往往比吃药更快减轻不适。要不要跟我说说，最近压力主要来自哪儿？`,
  },
  {
    test: /(喘不上气|喘不过气|手麻|手脚发麻|要死了|濒死|心跳特别快|突然心跳|觉得自己要疯)/,
    build: () =>
      `听起来像是一次惊恐发作：心跳猛地加快、手抖、喘不上气、手脚发麻，脑子里冒出"我要死了"。它非常难受，但通常是肾上腺素的一次集中释放，会在 20-30 分钟内自己过去。

现在先做两件事：
- **把呼气拉长**：吸 4 秒、呼 6-8 秒。别用力深呼吸，过度换气反而会让你更晕、更麻
- **给身体一个物理信号**：坐下靠墙，用冷水拍脸或握住冰袋，然后说出眼前 5 样具体的东西

如果这是第一次，或伴随胸痛、晕厥，请先去急诊或心内科排查一次——排除心脏问题本身就能大幅降低恐惧。反复发作、开始不敢坐地铁或独处的话，去精神科/心理科看看，CBT 对惊恐障碍有成熟方案。

现在感觉好一点了吗？`,
  },
  {
    test: /(没兴趣|不想起床|提不起|什么都不想做|低落|没动力|麻木|空落落|是不是抑郁)/,
    build: () =>
      `听起来你是整个人"降速"了：没兴趣、起不来、什么都没劲。这不是懒，也不一定是抑郁，但它值得被认真对待。

可以先看三条：**持续两周以上、几乎每天、影响功能**（上课、吃饭、洗澡）。三条都占，建议去做一次专业评估，而不是继续要求自己振作。

在那之前，有一件反直觉但有效的事：**行为激活**——不等有动力再动，先做 10 分钟（下楼走一圈、洗个澡、把桌面收一下）。动力常常出现在行动之后，而不是之前。再把任务切到"10 分钟能完成"的颗粒度，每天记一件"做到了"的事。

如果出现"活着没意思"这类念头，请一定告诉身边的人，或拨打 12356。你愿意先说说，这种状态大概持续多久了？`,
  },
  {
    test: /(我妈|我爸|爸妈|父母|家里|室友|宿舍|孤立|被排挤|亲戚|拿我和|跟我比)/,
    build: () =>
      `和家里人、和室友的摩擦，最耗人的往往不是事情本身，而是"我是不是不被在乎"这层解读。

可以试着把两件事分开：他们担心什么，和我愿意承担什么。你不必为了少吵架而改写自己的目标，也不必为了坚持目标而否定他们的关心。

具体开口时，用"事实 → 感受 → 需要 → 请求"四步，比讲道理有效：
- 事实："这周你提了三次排名"
- 感受："每次聊完我会更慌，要缓很久"
- 需要："我想先按自己的节奏补基础"
- 请求："这周先不聊分数，等模考完我主动跟你说"

如果是宿舍：说清"时间 + 行为 + 影响 + 请求"，比如"11 点后能不能戴耳机，我入睡慢"。遇到持续霸凌或排挤，留证据找辅导员，这不是打小报告，是保护自己。

你最想先解决哪一段关系？`,
  },
  {
    test: /(失恋|分手|被拒绝|喜欢的人|暗恋|单恋)/,
    build: () =>
      `失恋会带来很像戒断的反应：反复看动态、回想细节、睡不着、什么都做不进去。这不是你太脆弱，是依恋系统在工作。

分清两件事：**反刍**是"他为什么不喜欢我"转一百遍，越转越紧；**反思**是"我在这段关系里需要什么"，它会有结论，也会带来行动。

可以做的：
- 设 15 分钟"想念时间"，其他时候出现念头就记下来，留到那时再想
- 暂时屏蔽动态、收掉触发物，减少被动想起
- 恢复作息和运动，让身体先稳下来；写一封信，但不发

如果两周以上功能明显受影响，或出现"没有他我活不下去"的念头，请告诉朋友或去学校心理中心。这种念头值得被认真对待。

今天想先说哪一段？`,
  },
  {
    test: /(暴食|催吐|吃了很多|停不下来地吃|节食|身材|体重|长胖|减肥)/,
    build: () =>
      `用食物调节情绪很常见，一次吃多不等于失控，也不等于你意志力差。真正让事情变糟的，常常是之后的极端补偿和自我惩罚。

需要留意的是这个循环：**暴食 → 催吐/催泻/过度运动 → 更严格的节食 → 再次暴食**。如果已经出现反复暴食且停不下来、催吐、长期极端节食，这超出"饮食习惯"的范围，建议尽早找专业帮助，越早越容易打断。

今天可以先做两件小事：
- 规律三餐，别用"明天开始节食"补偿今天
- 给情绪起个名字（孤独、焦虑、被评价），然后准备一个替代动作：散步 10 分钟、热水澡、给朋友发条消息

学校心理中心可以做初步评估和转介；如果伴随明显体重下降、停经、晕厥，请尽快就医。你愿意说说，最近一次这样是在什么情境下吗？`,
  },
  {
    test: /(紧张|心慌|心跳|手抖|发抖|坐不住|慌|深呼吸|放松|焦虑)/,
    build: () =>
      `这种心慌、手抖的感觉，是身体在为"重要的事"调动资源，不是你要垮了。我们可以先把它调低一点。

现在跟我做 **4-7-8 呼吸**：用鼻子安静吸气 **4 秒**，轻轻屏住 **7 秒**，再用嘴缓慢呼气 **8 秒**。关键是呼气比吸气长——它会通过迷走神经把心率压下来。做 4 个循环，大约 1 分钟。

如果你愿意，我可以把引导面板叫出来陪你一起数节拍；不想开也没关系，就照上面的节奏自己做。做完告诉我：心跳有没有下来一点？`,
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
      `欢迎来到情绪之屿，我是岛主。你可以在这里说说心里积压的感受，我在这里听着。

不用组织语言，也不用说得"合理"。如果不知道从哪说起，可以先告诉我：**今天最让你耗神的一件事是什么？**`,
  },
]

/* ───────── 本地知识模式：先看话题与情绪，再组织一句"接住你的话"的回应 ───────── */

type Tone = 'down' | 'anxious' | 'angry' | 'flat' | 'ok'

const TONE_RULES: [Tone, RegExp][] = [
  ['down', /(难过|想哭|哭|委屈|低落|失落|没意思|不想动|丧|孤独|孤单|不想活|撑不住)/],
  ['anxious', /(紧张|心慌|慌|怕|担心|害怕|焦虑|睡不着|失眠|来不及|压力|喘不过气)/],
  ['angry', /(气死|生气|烦死|讨厌|受够|凭什么|憋屈|不公平|吵|忍不了)/],
  ['flat', /(麻木|空落落|没感觉|无所谓|没劲|提不起|就这样吧)/],
]

const OPENERS: Record<Tone, string[]> = {
  down: [
    '听你这么说，我心里也沉了一下。',
    '这句话背后，好像压着不少东西。',
    '嗯，我听见了。这种难受，不需要先被证明"够严重"。',
    '你能把它说出来，已经用掉了一些力气。',
  ],
  anxious: [
    '这件事在你脑子里转了很久了吧。',
    '这种紧绷感，是身体在说"这件事对我很重要"。',
    '先别急着解决，我们把速度放慢一点。',
    '慌的时候思路会变窄，这不是你不行。',
  ],
  angry: [
    '这确实让人不好受，你会生气是有道理的。',
    '被这样对待，心里堵着一口气很正常。',
    '我先不劝你大度，先把这口气说清楚。',
  ],
  flat: [
    '"没感觉"也是一种信号，通常是太累了。',
    '麻木常常是身体在替你省电。',
    '能说出"空"，说明你还在留意自己。',
  ],
  ok: ['我在，慢慢说。', '嗯，我在听。', '好，我们从你现在这句开始。', '谢谢你愿意讲这些。'],
}

const TONE_NOTE: Record<Tone, string> = {
  down: '这种情绪不是"想太多"，它通常是在提醒你：有些需要一直没被照顾到。',
  anxious: '身体先拉了警报，思路跟着变窄，这很正常，不用因此再责备自己一遍。',
  angry: '情绪先被接住，事情才谈得动；我们不急着评判谁对谁错。',
  flat: '这时候不适合逼自己"振作起来"，先把电量恢复一点点更实际。',
  ok: '',
}

type Domain = 'study' | 'people' | 'family' | 'body' | 'future' | 'self' | 'plain'

const DOMAIN_RULES: [Domain, RegExp][] = [
  ['study', /(复习|考试|学习|作业|论文|背书|刷题|成绩|上课|老师|挂科|绩点|课设)/],
  ['people', /(室友|舍友|朋友|同学|社团|对象|男朋友|女朋友|分手|孤立|排挤|合不来)/],
  ['family', /(爸爸|妈妈|爸妈|父母|家里|家人|亲戚|他们期待|失望)/],
  ['body', /(头疼|胃疼|胸口|恶心|吃不下|没胃口|喘不上气|手抖|肩|眼睛|姨妈)/],
  ['future', /(考研|保研|就业|工作|实习|前途|未来|毕业|排名|出路|考公)/],
  ['self', /(没用|废物|讨厌自己|自卑|不如|比不上|失败|后悔|自责|不够好)/],
]

const ACTIONS: Record<Domain, string[]> = {
  study: [
    '把"复习"缩成一个能看见完成状态的动作，比如「打开错题本，改 3 道题」，然后只做这一件。',
    '设一个 20 分钟的计时器，只做一页内容；铃响了就允许自己停。',
    '先花 3 分钟列一张"今天不做也可以"的清单，把不重要的先划掉。',
    '换一个位置学（书桌 → 图书馆靠窗），让环境帮你切换状态。',
  ],
  people: [
    '先把想说的话写成三句：「发生了什么」「我什么感受」「我希望怎样」，不一定要发出去。',
    '找一个不在这件事里的人，把经过讲一遍——讲着讲着往往自己就清楚卡在哪了。',
    '给这段关系定一个小边界：今天先不回应，等情绪落下去再说。',
  ],
  family: [
    '把"他们期待我"和"我想要"分成两栏写下来，先看清哪部分是自己的。',
    '如果现在没法沟通，就先不沟通；今晚只照顾自己的那一部分。',
    '找一句能挡住追问的话备着，比如"我知道你们担心，这件事我自己在想办法"。',
  ],
  body: [
    '身体难受的时候，先处理身体：喝温水、把肩膀放下来、做 3 轮长呼气。',
    '把手放在肚子上，感受 6 次呼吸，让注意力从念头回到身体。',
    '如果症状持续或明显加重，去医院查一次，排除器质性问题会让人安心很多。',
  ],
  future: [
    '把"以后怎么办"换成"这学期想做的一件小事"，范围缩小，焦虑才会降下来。',
    '找一个已经走过这条路的人聊 20 分钟，信息比空想更能减少恐惧。',
    '写下三个可选方向，每个只写第一步，不写结果。',
  ],
  self: [
    '把"我怎么这么差"改写成"我现在卡在____这件事上"，把评价换成描述。',
    '写三件今天做到的小事，哪怕只是起床、吃饭、洗了脸。',
    '用你安慰朋友的那种语气，把刚才那句话对自己说一遍。',
  ],
  plain: [
    '把现在最吵的那句话写在纸上，只写一句，写完看看它到底在担心什么。',
    '起身接杯水，走到窗边站两分钟，让身体先离开这个场景。',
    '把"我必须…"改成"我今天可以先…"，把命令换成邀请。',
    '做 4 轮 4-7-8 呼吸（吸 4、屏 7、呼 8），呼气比吸气长，心率会跟着下来。',
    '给这件事划一个"担心时段"：现在先记下来，晚上 8 点再想 15 分钟。',
  ],
}

const CLOSERS = [
  '你愿意从哪一句开始？',
  '如果今天只推进 5%，你想推进哪 5%？',
  '要不要先说说，最卡的那一下是什么？',
  '需要我陪你把它拆小一点吗？',
  '现在身体上最明显的感觉是什么？',
  '你想先被听听，还是先要一个办法？',
]

/** 稳定哈希：同一个问题给同一个回答，不同问题换说法 */
function seedOf(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

function pickOne<T>(arr: T[], seed: number, salt = 0): T {
  return arr[(seed + salt * 37) % arr.length]
}

/** 摘一句用户自己的话，让回应落在他说过的东西上 */
function quoteOf(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  const clause = clean.split(/[。！？!?\n]/).find((s) => s.trim().length > 2) ?? clean
  const s = clause.trim()
  return s.length > 22 ? `${s.slice(0, 22)}…` : s
}

/** 中文二元组重叠数：用来判断"这条资料到底是不是在讲同一件事" */
function overlapOf(a: string, b: string): number {
  const grams = (s: string) => {
    const clean = s.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')
    const set = new Set<string>()
    for (let i = 0; i < clean.length - 1; i++) set.add(clean.slice(i, i + 2))
    return set
  }
  const A = grams(a)
  const B = grams(b)
  let n = 0
  for (const g of A) if (B.has(g)) n++
  return n
}

/** 只引用真正相关的资料；不相关时宁可不引，也别硬塞一篇讲别的事的文章 */
function bestCitation(text: string, citations: Citation[]): Citation | null {
  let best: Citation | null = null
  let bestN = 0
  for (const c of citations) {
    const n = overlapOf(text, `${c.title}${c.snippet}`)
    if (n > bestN) {
      bestN = n
      best = c
    }
  }
  return bestN >= 3 ? best : null
}

function composeReply(text: string, citations: Citation[]): string {
  const seed = seedOf(text)
  const tone = TONE_RULES.find(([, re]) => re.test(text))?.[0] ?? 'ok'
  const domain = DOMAIN_RULES.find(([, re]) => re.test(text))?.[0] ?? 'plain'
  const opener = pickOne(OPENERS[tone], seed)
  const action = pickOne(ACTIONS[domain], seed, 1)
  const close = pickOne(CLOSERS, seed, 2)
  const note = TONE_NOTE[tone]
  const top = bestCitation(text, citations)
  const ref =
    top != null
      ? `\n\n分享小屋的知识库里有一篇《${top.title}》正好提到这点：${top.snippet.replace(/^…/, '').trim()}`
      : ''

  return `${opener}

你说的「${quoteOf(text)}」，我记下了。${note}${ref}

先不急着把整件事解决，只试一小步：
- ${action}

${close}`
}

/** 本地知识模式：检索 + 规则意图 + 组合式回应 */
export function offlineRespond(text: string, citations: Citation[], _risk: RiskLevel): string {
  for (let i = 0; i < INTENTS.length; i++) {
    const intent = INTENTS[i]
    if (!intent.test.test(text)) continue
    // 危机那条保持原样，不加任何铺垫；其余先接一句他自己的话
    if (i === 0) return intent.build(citations)
    const tone = TONE_RULES.find(([, re]) => re.test(text))?.[0] ?? 'ok'
    const lead = text.trim().length > 8 ? `${pickOne(OPENERS[tone], seedOf(text))}\n\n` : ''
    return lead + intent.build(citations)
  }
  return composeReply(text, citations)
}
