/**
 * Agent 工具层（Function Calling）
 *
 * 每个工具都做了"双重职责"设计：
 *   1) 返回结构化文本给模型，让模型能用自然语言继续对话；
 *   2) 通过 ToolContext 触发真实的前端副作用（开呼吸面板、开量表、写情绪记录）。
 * 这样 AI 的"决策"能落地成界面动作，而不是只停留在文字建议。
 */

import { retrieve } from './rag'
import { detectRisk } from './crisis'
import { summarize, buildSeries, MOOD_META, MOOD_TAGS } from './mood'
import type { AssessmentRecord, Citation, MoodRecord, MoodScore, ToolResult } from './types'
import type { ToolSchema } from './llm'
import { LEVEL_META } from './assessment'

export interface ToolContext {
  openBreathing: (pattern?: '478' | 'box' | 'coherent') => void
  openAssessment: () => void
  addMood: (record: Omit<MoodRecord, 'id' | 'ts'>) => void
  getRecords: () => MoodRecord[]
  getAssessments: () => AssessmentRecord[]
  navigate: (path: string) => void
}

export const TOOL_LABELS: Record<string, string> = {
  search_knowledge_base: '检索知识库',
  start_breathing: '唤起潮汐呼吸',
  open_anxiety_assessment: '打开 GAD-7 自评',
  create_study_plan: '生成减压复习计划',
  log_mood: '写入情绪记录',
  get_mood_trend: '读取情绪趋势',
}

export const TOOL_SCHEMAS: ToolSchema[] = [
  {
    type: 'function',
    function: {
      name: 'search_knowledge_base',
      description:
        '在分享小屋的知识库（CBT、教育心理学、睡眠、学习科学的私有知识库）中检索。当用户询问"为什么""怎么办""有什么科学依据"或需要具体方法步骤时调用，返回带出处的资料片段。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '检索关键词或用户原话，保留具体症状与情境' },
          top_k: { type: 'integer', description: '返回片段数量，1-5，默认 3' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'start_breathing',
      description:
        '打开潮汐呼吸放松引导面板（4-7-8 / 箱式 / 共振呼吸）。当用户报告心跳快、手抖、坐不住、脑子发紧、睡不着，或明确想放松时调用。',
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            enum: ['478', 'box', 'coherent'],
            description: '478=吸4屏7呼8，睡前与急性紧张；box=吸4屏4呼4屏4，专注前；coherent=吸5呼5，日常稳定',
          },
          reason: { type: 'string', description: '对用户的一句话说明，为什么选这个节奏' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_anxiety_assessment',
      description:
        '打开 GAD-7 焦虑自评量表（7 题，过去两周）。当用户想知道"我是不是焦虑过度""我的程度如何"，或描述持续两周以上的紧张、担忧、睡不好时调用。',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_study_plan',
      description:
        '根据剩余天数、每日可用时长与科目生成"减压复习计划"：分阶段、含固定错题回顾与放松时段，避免过载。',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'integer', description: '距离考试的剩余天数' },
          hours_per_day: { type: 'number', description: '每天可投入的净学习小时数，1-14' },
          subjects: { type: 'array', items: { type: 'string' }, description: '需要安排的科目或章节' },
          pain_point: { type: 'string', description: '用户当前最大的困难，如"错题太多""总是拖延"' },
        },
        required: ['days', 'hours_per_day', 'subjects'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'log_mood',
      description:
        '记录一次情绪状态到本地情绪潮向仪表盘。必须先与用户确认分数（1=很低落 5=很舒展）再调用。',
      parameters: {
        type: 'object',
        properties: {
          score: { type: 'integer', minimum: 1, maximum: 5, description: '情绪分数 1-5' },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: `影响因素标签，从这些里选：${MOOD_TAGS.join('、')}`,
          },
          note: { type: 'string', description: '一句话备注，可为空' },
        },
        required: ['score'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_mood_trend',
      description: '读取本地情绪记录，返回近 N 天的平均分、波动趋势、高频困扰标签与记录天数。',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'integer', description: '统计窗口，默认 7，可选 7/14/30' },
        },
        required: [],
      },
    },
  },
]

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function planFor(subjects: string[], hours: number): string[] {
  const perBlock = 45
  const totalBlocks = Math.max(2, Math.round((hours * 60) / perBlock))
  const blocks: string[] = []
  for (let i = 0; i < totalBlocks; i++) {
    blocks.push(subjects[i % Math.max(subjects.length, 1)] ?? '错题回顾')
  }
  return blocks
}

function buildPlan(args: {
  days: number
  hours_per_day: number
  subjects: string[]
  pain_point?: string
}): string {
  const days = clamp(Math.round(args.days), 1, 60)
  const hours = clamp(args.hours_per_day, 1, 14)
  const subjects = args.subjects.length ? args.subjects.slice(0, 6) : ['综合复习']

  const phase1 = Math.max(1, Math.round(days * 0.5))
  const phase2 = Math.max(1, Math.round(days * 0.3))

  const dayLines: string[] = []
  for (let d = 1; d <= Math.min(days, 7); d++) {
    const phase = d <= phase1 ? '补漏' : d <= phase1 + phase2 ? '整合' : '模拟'
    const blocks = planFor(subjects, hours)
    const morning = blocks.slice(0, Math.ceil(blocks.length / 2)).join(' → ')
    const afternoon = blocks.slice(Math.ceil(blocks.length / 2)).join(' → ') || '错题回顾'
    dayLines.push(
      `- 第 ${d} 天（${phase}）：上午 ${morning}；下午 ${afternoon}；收尾 错题回顾 30 分钟 + 4-7-8 呼吸 4 个循环`,
    )
  }

  const tail =
    days > 7
      ? `\n- 第 8 天起按「${subjects[0]} → 错题 → 模拟」循环推进，每 3 天做一次 90 分钟限时训练。`
      : ''

  return [
    `### 减压复习计划（${days} 天 · 每天 ${hours} 小时）`,
    '',
    `- 阶段划分：补漏 ${phase1} 天 → 整合 ${phase2} 天 → 模拟与轻量 ${Math.max(days - phase1 - phase2, 0)} 天`,
    `- 科目轮转：${subjects.join(' / ')}`,
    `- 单块时长 45 分钟，块间休息 10 分钟（起身走动、远眺、喝水）`,
    args.pain_point ? `- 针对你的困扰「${args.pain_point}」：每天固定 30 分钟只处理错题，不追求新题量` : '',
    '',
    dayLines.join('\n') + tail,
    '',
    `> 说明：计划按"最低可完成量"设计，状态差的日子完成上午块即可，避免全有全无。最后 2 天总时长减半，只做框架默写与物资清单。`,
  ]
    .filter((l) => l !== '')
    .join('\n')
}

export async function runTool(
  name: string,
  rawArgs: string,
  ctx: ToolContext,
  callId: string,
): Promise<ToolResult> {
  let args: any = {}
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {}
  } catch {
    args = {}
  }

  const ok = (summary: string, extra: Partial<ToolResult> = {}): ToolResult => ({
    id: callId,
    name,
    ok: true,
    summary,
    ...extra,
  })
  const fail = (summary: string): ToolResult => ({ id: callId, name, ok: false, summary })

  try {
    switch (name) {
      case 'search_knowledge_base': {
        const query = String(args.query ?? '')
        const k = clamp(Number(args.top_k ?? 3), 1, 5)
        const citations: Citation[] = retrieve(query, k)
        if (!citations.length) return ok('知识库未检索到直接相关的条目')
        const text = citations
          .map((c, i) => `【资料${i + 1}】${c.title}（${c.category}）\n${c.snippet}`)
          .join('\n\n')
        return ok(text, { citations })
      }

      case 'start_breathing': {
        const pattern = (['478', 'box', 'coherent'] as const).includes(args.pattern)
          ? (args.pattern as '478' | 'box' | 'coherent')
          : '478'
        ctx.openBreathing(pattern)
        const map = {
          '478': '4-7-8 呼吸：吸 4 秒、屏 7 秒、呼 8 秒。呼气长于吸气，帮助心率降下来。已在界面上为你打开引导。',
          box: '箱式呼吸：吸 4、屏 4、呼 4、屏 4。适合进入专注前使用，已在界面上打开。',
          coherent: '共振呼吸：吸 5、呼 5，约每分钟 6 次，是稳住日常状态的常用节奏，已在界面上打开。',
        } as const
        return ok(map[pattern], { payload: { pattern } })
      }

      case 'open_anxiety_assessment': {
        ctx.openAssessment()
        return ok(
          '已打开 GAD-7 焦虑自评（7 题，回顾过去两周）。请用户按真实感受作答，不要替用户猜测分数；结果出来后结合分数给出下一步，并说明这只是筛查不是诊断。',
        )
      }

      case 'create_study_plan': {
        const plan = buildPlan({
          days: Number(args.days ?? 7),
          hours_per_day: Number(args.hours_per_day ?? 6),
          subjects: Array.isArray(args.subjects) ? args.subjects.map(String) : [],
          pain_point: args.pain_point ? String(args.pain_point) : undefined,
        })
        return ok(plan)
      }

      case 'log_mood': {
        const score = clamp(Math.round(Number(args.score ?? 3)), 1, 5) as MoodScore
        const tags = Array.isArray(args.tags)
          ? args.tags.map(String).filter((t: string) => MOOD_TAGS.includes(t)).slice(0, 4)
          : []
        const note = args.note ? String(args.note).slice(0, 120) : undefined
        ctx.addMood({ score, tags, note, source: 'chat' })
        return ok(
          `已记录：${MOOD_META[score].label}（${score}/5）${tags.length ? `，标签：${tags.join('、')}` : ''}。数据仅保存在本地浏览器。`,
        )
      }

      case 'get_mood_trend': {
        const days = [7, 14, 30].includes(Number(args.days)) ? Number(args.days) : 7
        const records = ctx.getRecords()
        const s = summarize(records, days)
        if (!s.count) return ok(`近 ${days} 天还没有记录。可以邀请用户先做一次 30 秒的情绪打卡。`)
        const series = buildSeries(records, days)
        const filled = series.filter((p) => p.avg !== null)
        const text = [
          `近 ${days} 天共 ${s.count} 条记录，平均 ${s.avg?.toFixed(1)}/5。`,
          s.prevAvg !== null ? `上一周期平均 ${s.prevAvg.toFixed(1)}，变化 ${s.delta! >= 0 ? '+' : ''}${s.delta}。` : '上一周期无足够数据对比。',
          s.topTags.length ? `高频标签：${s.topTags.map((t) => `${t.tag}(${t.n})`).join('、')}。` : '',
          `有记录的天数：${filled.length} 天；连续记录 ${s.streak} 天。`,
          `波动：${filled.map((p) => `${p.label} ${p.avg!.toFixed(1)}`).join('，')}`,
        ]
          .filter(Boolean)
          .join('\n')
        return ok(text)
      }

      default:
        return fail(`未知工具：${name}`)
    }
  } catch (e) {
    return fail(`工具执行失败：${(e as Error).message}`)
  }
}

/** 供 UI 展示的评估摘要 */
export function assessmentSummary(records: AssessmentRecord[]): string {
  if (!records.length) return '暂无自评记录'
  const last = [...records].sort((a, b) => b.ts - a.ts)[0]
  return `最近一次 GAD-7：${last.total} 分（${LEVEL_META[last.level].label}）`
}

export function riskNoteFor(text: string): string {
  const r = detectRisk(text)
  return r.level === 'none' ? '' : `检测到风险关键词：${r.hits.join('、')}`
}
