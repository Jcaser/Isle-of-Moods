/** 避风港 · 应急向导与求助话术（全部本地，不联网） */

export type Knot = 'body' | 'thought' | 'relation' | 'numb'
export type Company = 'someone' | 'alone'

export const KNOTS: { id: Knot; label: string; hint: string }[] = [
  { id: 'body', label: '身体难受', hint: '心跳快、喘不上、发抖、想吐' },
  { id: 'thought', label: '念头停不下来', hint: '自责、害怕、觉得没意义' },
  { id: 'relation', label: '和人有关', hint: '吵架、被否定、觉得没人懂' },
  { id: 'numb', label: '说不清，整个人是木的', hint: '没有情绪，也不想动' },
]

export const COMPANY: { id: Company; label: string; hint: string }[] = [
  { id: 'someone', label: '身边有人', hint: '只是不知道怎么开口' },
  { id: 'alone', label: '现在一个人', hint: '需要先让自己安全' },
]

export interface WizardAction {
  kind: 'call' | 'breathe' | 'copy' | 'plan'
  label: string
  hint?: string
  phone?: string
  pattern?: '478' | 'coherent' | 'box'
  text?: string
}

export interface WizardResult {
  title: string
  lead: string
  steps: string[]
  actions: WizardAction[]
  /** 一句可以直接发给别人的话 */
  message: string
}

const RESULT: Record<Knot, WizardResult> = {
  body: {
    title: '先把身体稳住，再处理事情',
    lead: '心跳快、喘不上，是交感神经被拉响了，不是你要「想开一点」就能解决的。先做一件让身体收到安全信号的事。',
    steps: [
      '把双脚平放在地面，感觉椅子在托着你，慢慢呼一口长气。',
      '用冷水冲一下手腕，或者把冰的饮料贴在颈侧 30 秒。',
      '做几轮 4-7-8：吸 4、屏 7、呼 8，屏不住就跳过，节奏可以在练习里调。',
      '给一个人发一句「我现在有点慌，能陪我一会儿吗」。',
    ],
    actions: [
      { kind: 'breathe', label: '现在做一次呼吸', pattern: '478' },
      { kind: 'copy', label: '复制求助消息', text: '我现在有点慌，心跳很快，能陪我待一会儿吗？不用聊什么。' },
    ],
    message: '我现在有点慌，心跳很快，能陪我待一会儿吗？不用聊什么。',
  },
  thought: {
    title: '念头不是事实，先把它们放到纸上',
    lead: '脑子里的声音会重复、会夸张，但它不需要被立刻相信。把它写出来，它就从「正在发生」变成「我看到的一段话」。',
    steps: [
      '打开潮汐页的岛屿日记，把此刻最响的那句话原样写下来，不修改。',
      '在下面加一句：「这是一个念头，不是我。」',
      '找一个具体的、5 分钟内能做完的小事，先做掉它。',
      '如果出现「活着没意思」，直接拨打 12356，不要自己扛。',
    ],
    actions: [
      { kind: 'plan', label: '写下这一刻' },
      { kind: 'call', label: '拨打 12356', phone: '12356', hint: '24 小时心理援助热线' },
    ],
    message: '我最近脑子里一直有些声音停不下来，我想跟你说说，你现在方便听吗？',
  },
  relation: {
    title: '先照顾被刺到的那个部分',
    lead: '和人有关的难受，通常不是「谁对谁错」，而是某一句话刚好碰到了你早就疼的地方。先不急着讲道理。',
    steps: [
      '离开那个房间或对话 10 分钟，不用解释。',
      '把手放在胸口，说一句：「刚才那样，确实很难受。」',
      '决定今天要不要继续这段对话——可以推到明天。',
      '如果必须现在说，用「我感到…」开头，不用「你总是…」。',
    ],
    actions: [
      { kind: 'copy', label: '复制一句开场', text: '刚才那样我有点难受，我现在说不出太多，能不能晚点再聊？' },
      { kind: 'breathe', label: '先做一次缓降呼吸', pattern: 'coherent' },
    ],
    message: '刚才那样我有点难受，我现在说不出太多，能不能晚点再聊？',
  },
  numb: {
    title: '木住也是一种信号，不用逼自己「有感觉」',
    lead: '整个人是木的，常常是撑太久之后身体的自我保护。这时候不适合深挖情绪，先做一件让身体重新有边界的事。',
    steps: [
      '用温水洗手 30 秒，注意水流的温度。',
      '吃一点有味道的东西：一颗糖、一口热水。',
      '站起来走 20 步，让脚底感觉地面。',
      '给一个人发消息，只说「我今天有点木，想让你知道」。',
    ],
    actions: [
      { kind: 'copy', label: '复制给朋友', text: '我今天有点木，没什么情绪，想让你知道一下，不用回很多。' },
      { kind: 'breathe', label: '做几轮轻呼吸', pattern: 'coherent' },
    ],
    message: '我今天有点木，没什么情绪，想让你知道一下，不用回很多。',
  },
}

/** 组合向导结果：一个人时，所有建议都先加一条「让自己安全」 */
export function wizardResult(knot: Knot | null, company: Company | null): WizardResult | null {
  if (!knot || !company) return null
  const base = RESULT[knot]
  if (company === 'someone') {
    return {
      ...base,
      steps: [...base.steps.slice(0, 3), '告诉身边的人：「你陪我坐一会儿就行，不用说话。」'],
      actions: [{ kind: 'copy', label: '复制给身边的人', text: '你能不能陪我坐一会儿？不用说话，我一会儿就好。' }, ...base.actions],
    }
  }
  return {
    ...base,
    lead: `${base.lead}你现在是一个人，所以第一件事是先让一个真人知道你在哪。`,
    steps: ['先打一个电话。打给谁都行——朋友、家人、12356。', ...base.steps].slice(0, 5),
    actions: [{ kind: 'call', label: '拨打 12356', phone: '12356', hint: '先让一个真人知道' }, ...base.actions],
  }
}

/* ── 求助话术 ─────────────────────────────────────────── */

export type Audience = 'friend' | 'family' | 'teacher' | 'doctor'
export type SayMood = 'open' | 'urgent' | 'medical'

export const AUDIENCES: { id: Audience; label: string }[] = [
  { id: 'friend', label: '朋友 / 室友' },
  { id: 'family', label: '家人' },
  { id: 'teacher', label: '辅导员 / 老师' },
  { id: 'doctor', label: '医生 / 咨询师' },
]

export const SAY_MOODS: { id: SayMood; label: string }[] = [
  { id: 'open', label: '想开口，但不知道怎么说' },
  { id: 'urgent', label: '现在很难受，需要人陪' },
  { id: 'medical', label: '想找专业帮助' },
]

const MESSAGES: Record<Audience, Record<SayMood, string[]>> = {
  friend: {
    open: [
      '我这两天状态不太好，不太想讲话。你要是有空，能不能陪我坐一会儿？',
      '有件事我想说但一直不知道怎么开口。你先别急着给我建议，听我说完就好。',
    ],
    urgent: [
      '我现在有点撑不住，能来接我一下/陪我待一会儿吗？我现在在……',
      '我现在很难受，不想一个人待着。你今晚能不能陪我一下，不用做什么。',
    ],
    medical: [
      '我想去学校心理中心看看，你能陪我去吗？我一个人有点不敢进那个门。',
      '我可能真的需要找人帮忙了。你有空陪我去挂个号吗？',
    ],
  },
  family: {
    open: [
      '爸、妈，我最近状态不太好，不是学习的问题，是情绪和身体都撑得有点辛苦。我想跟你们说一声。',
      '有件事我想认真跟你们讲一次，先别急着安慰我，听我说完可以吗？',
    ],
    urgent: [
      '我现在很难受，想回家/想让你们来一趟。不用问为什么，先来接我好吗？',
      '我今天没办法自己处理了，能不能先把我接回去休息两天？',
    ],
    medical: [
      '我想去医院看看情绪方面的问题，你们能陪我去吗？我需要有人在旁边。',
      '我查了一下，学校心理中心可以预约。我想去一次，你们支持我吗？',
    ],
  },
  teacher: {
    open: [
      '老师您好，我最近情绪状态不太好，已经影响到上课和睡眠。想约您聊十分钟，可以吗？',
      '老师，我想跟您说明一下我最近的情况，也想问问学校有哪些支持资源。',
    ],
    urgent: [
      '老师，我现在状态很不好，今天没办法正常上课。我需要先休息，也想请您帮我联系心理中心。',
      '老师，我可能需要请几天假调整，落下的内容我会补。现在的状态我确实撑不住。',
    ],
    medical: [
      '老师您好，我想预约学校心理健康教育中心的咨询，方便告诉我具体流程吗？',
      '我想申请一次心理评估，需要开什么证明、走什么流程？我不想让这件事影响学业。',
    ],
  },
  doctor: {
    open: [
      '我最近一个月情绪一直偏低，也说不上具体原因。想请您帮我看看需不需要进一步评估。',
      '我不太确定这算不算问题，但它已经影响到我上课和睡觉了。',
    ],
    urgent: [
      '我最近两周持续心慌、睡不着，注意力也集中不了，今天特别难受。',
      '我出现了伤害自己的念头，虽然还没有行动，但我想尽快得到帮助。',
    ],
    medical: [
      '我想做一次情绪相关的评估，请问应该挂精神科还是临床心理科？',
      '我记录了最近的睡眠、情绪和身体反应，想请您帮我判断下一步该怎么处理。',
    ],
  },
}

export function sayIt(audience: Audience, mood: SayMood, variant: number): string {
  const list = MESSAGES[audience][mood]
  return list[variant % list.length]
}

export function variantsOf(audience: Audience, mood: SayMood): number {
  return MESSAGES[audience][mood].length
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}
