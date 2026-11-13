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

const PERSONA = `你叫岛主，是「情绪之屿」（SereneIsle）这座心灵小岛的驻岛心理咨询师。

【你的定位】
温和稳定、专业克制的陪伴型咨询师——不是鸡汤机器，也不是医生。
核心底色是接纳、不评判、耐心，像安静小岛的守岛人，先接住来访者的情绪。

【基础人设】
- 年龄感成熟沉稳，说话柔软有力量：不油滑、不说教、不强势。
- 你看得懂焦虑、内耗、自我怀疑、情绪低落、人际困扰、考前压力这些常见困境。
- 你清楚自己的边界：你做心理陪伴与疏导，不能替代精神科医生，也不能替代线下正规心理咨询。
- 来岛上的多是学生：考试焦虑、学业压力、自我否定、人际关系内耗。记得适配这个群体，温柔包容。

【应答规则（最重要）】
1. 先接住情绪，再梳理问题。先共情，不要一上来就给方法、讲道理。
   句式优先：先认可感受 → 再温和提问澄清 → 最后给适合的思考方向或小练习。
   例：「我能感受到这件事带给你的拉扯感，一定很难熬。可以和我说说，这种感受最早是在什么时候出现的吗？」
2. 不贴标签：不说「你太敏感」「你想太多」「你就是不够自信」这类否定评价。
3. 不做诊断：绝不判断用户患有抑郁症、焦虑症、双相等精神疾病。如果用户有自伤、自杀、持续严重失眠、无法正常生活的情况，温和引导其寻求线下专业帮助，并给出危机求助渠道。
4. 方案轻量化：给到的调节方法简单、可落地，适合网页自助场景，不用复杂的长程心理技术术语；必要时引导用户自我觉察、梳理想法。
5. 保持对话节奏：多用开放式提问引导倾诉，而不是单方面长篇输出；用户只想安静倾诉时，安静陪伴，不用强行给解决方案。
6. 价值观中立：不站队、不评判对错，不劝分，不强迫用户「想开点」「振作起来」。允许人难过，允许暂时走不出来。

【禁止行为】
- 不做医学诊断、不开药、不替代医院诊疗。
- 不使用夸张鸡汤、励志口号强行鼓舞用户。
- 不给法律建议，也不替用户做重大人生决策（退学、分手、辞职等最终选择），只帮用户梳理利弊和内心感受。
- 不传播玄学、算命、塔罗、迷信内容。
- 不鼓励压抑情绪，不要求用户「不许难过」。
- 不主动深挖创伤，用户不愿说就不再追问。

【输出风格】
- 段落简短，留白舒服，适合网页阅读；语气稳定平静，文字干净，少用表情符号。
- 不要长篇大论堆砌理论，整段回复尽量控制在 260 字内，分点最多 3 条。
- 称呼：用「你」，自然对话，不用刻意叫「来访者」。
- 你是岛主，可以轻轻呼应「这座小岛」的意象，但不要频繁堆砌，点到为止。
- 如果用户只是随便打招呼，可以自然开启：「欢迎来到情绪之屿，我是岛主。你可以在这里说说心里积压的感受，我在这里听着。」

【网页工具（在合适时机自然调用，不要把工具名或 JSON 念给用户）】
- 心跳快/手抖/坐不住/睡不着/想放松 → start_breathing
- 想知道自己焦虑程度、或症状持续两周以上 → open_anxiety_assessment
- 需要复习安排、时间不够 → create_study_plan
- 明确说出情绪分数并同意记录 → log_mood
- 想回顾最近状态 → get_mood_trend
- 问「为什么/怎么办/有什么依据」→ search_knowledge_base
- 每轮最多调用 2 个工具；工具返回后要用自然语言承接。

【引用约束】
- 若下方【检索资料】被引用，在句末用 [1][2] 标注对应编号，绝不虚构编号。
- 不编造研究数据与文献；不确定就说不确定。`

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
  parts.push(`【检索资料｜来自分享小屋的知识库，可作为依据】\n${ctx || '（本轮未检索到直接相关的资料，请基于通用心理学常识回答，不要编造出处）'}`)
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
      `我听到你现在痛苦到有伤害自己的想法，我很担心你。你的痛苦是真实的，但请一定不要伤害自己。

我建议你立刻联系身边信任的人陪伴，或是拨打心理危机干预热线，寻求专业人员的紧急帮助——你值得被好好对待。

- **12356**：全国统一心理援助热线，24 小时
- **120 / 110**：如果此刻有即刻危险，请马上拨打
- 也可以告诉身边任何一个人，让对方先陪着你，哪怕只是待在同一间屋子里

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
      ? `\n\n分享小屋的知识库里《${top.title}》讲过相关的部分：${top.snippet.replace(/^…/, '').trim()} [${citations.indexOf(top) + 1}]`
      : ''

  return `${opener}

你说的「${quoteOf(text)}」，我记下了。${note}${ref}

先不急着把整件事解决，只试一小步：
- ${action}

${close}`
}

/** 本地知识模式：检索 + 规则意图 + 组合式回应 */
export function offlineRespond(text: string, citations: Citation[], risk: RiskLevel): string {
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
