/**
 * 呼吸陪伴的「理解层」
 *
 * 只做两件事：
 *  1. readState —— 把用户随口说的一句话读成状态（焦虑 / 紧张 / 烦躁 / 疲惫 / 失眠）
 *  2. reflect   —— 练完之后，用一句话把这次的身体变化说出来
 *
 * 决策（推荐哪组节奏、练多久、怎么调）一律不交给模型，放在 breath.ts 的规则里。
 * 模型不可用时整条链路退回本地关键词识别，页面功能不减少。
 */

import { STATE_META, detectState, type BreathState, type BreathOutcome, type Detection } from './breath'
import { streamChat, type LLMConfig } from './llm'

const STATE_WORDS: Record<string, BreathState> = {
  焦虑: 'anxious',
  紧张: 'tense',
  烦躁: 'irritable',
  疲惫: 'exhausted',
  失眠: 'insomnia',
  说不清: 'unknown',
  anxious: 'anxious',
  tense: 'tense',
  irritable: 'irritable',
  exhausted: 'exhausted',
  insomnia: 'insomnia',
  unknown: 'unknown',
}

export interface CoachRead {
  detection: Detection
  /** 模型写的共情句；空表示用本地模板 */
  reply: string
  source: 'model' | 'local'
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('timeout')), ms)
    p.then(
      (v) => {
        window.clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        window.clearTimeout(timer)
        reject(e)
      },
    )
  })
}

function extractJson(text: string): Record<string, unknown> | null {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    return JSON.parse(m[0]) as Record<string, unknown>
  } catch {
    return null
  }
}

/** 清掉模型偶尔带出来的 markdown、引号与多余换行 */
function tidy(text: string, max = 90): string {
  const clean = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_#>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["「『]|["」』]$/g, '')
  return clean.length > max ? `${clean.slice(0, max)}…` : clean
}

/**
 * 读状态。模型返回的只用于「更宽容地听懂」，
 * 关键词命中仍然并行算一份：断网、超时、返回格式错，都能立刻降级。
 */
export async function readState(text: string, config: LLMConfig): Promise<CoachRead> {
  const local = detectState(text)

  try {
    const out = await withTimeout(
      streamChat({
        config: { ...config, temperature: 0.35 },
        messages: [
          {
            role: 'system',
            content: [
              '你是「清绪之屿」的呼吸陪伴助手，正在读用户刚说的一句话。',
              '只输出一行 JSON，不要 markdown，不要解释：',
              '{"state":"焦虑|紧张|烦躁|疲惫|失眠|说不清","intensity":1-5,"reply":"一句中文回应"}',
              '',
              '六个状态的判定标准（优先级从上到下）：',
              '1. 焦虑：心慌、心跳快、发抖、手心出汗、喘不上气、害怕、坐立不安。出现身体报警信号一律判焦虑。',
              '2. 失眠：睡不着、躺下后脑子停不下来、半夜醒、入睡困难。',
              '3. 烦躁：生气、想发火、胸口闷、觉得委屈或被冒犯（常与人际冲突有关）。',
              '4. 疲惫：累、空、麻木、提不起劲、不想动（没有明显情绪，只是耗光了）。',
              '5. 紧张：明确指向「即将发生的一件事」（考试、面试、上台、截止日期），人还坐得住。',
              '6. 说不清：信息不足，或用户自己也没法命名。',
              '',
              '注意：「慌 / 心跳快」是焦虑，不是紧张；只有明确提到未来的事件才判紧张。',
              'reply 规则：不超过 40 字；先说出你听到的身体感受，再给一个很小的落点；',
              '不要说教，不要诊断，不要承诺疗效，不要用感叹号堆情绪。',
            ].join('\n'),
          },
          { role: 'user', content: text.slice(0, 400) },
        ],
      }),
      9000,
    )

    const json = extractJson(out.content)
    if (!json) throw new Error('bad json')

    const rawState = String(json.state ?? '').trim()
    const state = STATE_WORDS[rawState]
    const intensityRaw = Number(json.intensity)
    const reply = typeof json.reply === 'string' ? tidy(json.reply) : ''

    if (!state || !reply) throw new Error('bad fields')

    return {
      source: 'model',
      reply,
      detection: {
        ...local,
        state,
        intensity: Number.isFinite(intensityRaw) ? Math.min(5, Math.max(1, Math.round(intensityRaw))) : local.intensity,
      },
    }
  } catch {
    return { detection: local, reply: '', source: 'local' }
  }
}

/**
 * 练完之后的复盘。返回 null 表示这次不打扰，用本地报告里的建议就够了。
 */
export async function reflect(
  out: BreathOutcome,
  extra: { before: string; feedbacks: number; total: number },
  config: LLMConfig,
): Promise<string | null> {
  const meta = STATE_META[out.plan.state]
  try {
    const res = await withTimeout(
      streamChat({
        config: { ...config, temperature: 0.6 },
        messages: [
          {
            role: 'system',
            content: [
              '你在为一次呼吸练习写复盘。只写 2 句中文，不超过 60 字。',
              '第一句描述这次身体可能发生的变化（用「可能」「大概」这类留有余地的词）；',
              '第二句给一个今天就能做的小建议。',
              '不要诊断，不要承诺疗效，不要用 markdown，不要提分数。',
            ].join('\n'),
          },
          {
            role: 'user',
            content: [
              `开始前的状态：${meta.label}（原话：${extra.before.slice(0, 80)}）`,
              `用的节奏：${out.plan.name}（${out.plan.spec.inhale}-${out.plan.spec.hold}-${out.plan.spec.exhale}）`,
              `实际时长：${Math.round(out.seconds / 60)} 分钟，${out.cycles} 轮`,
              `中途调整：${extra.feedbacks} 次`,
              `这是第 ${extra.total} 次练习。`,
            ].join('\n'),
          },
        ],
      }),
      9000,
    )
    const text = tidy(res.content, 80)
    return text.length >= 8 ? text : null
  } catch {
    return null
  }
}
