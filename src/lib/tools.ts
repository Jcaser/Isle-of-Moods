/**
 * Agent 工具层（Function Calling）
 *
 * 每个工具有两个产出：
 *   1) 结构化文本，回给模型让它继续说话；
 *   2) 可选的一个「待确认动作」（PendingAction）。注意是"待确认"——工具绝不自己弹窗或跳页：
 *      岛主会先把话说完，界面上再出现「好，打开 / 先不用」，用户点了才真的执行。
 *      这样不会出现"回答还没出来，面板已经弹出来盖住屏幕"的打断感。
 */

import { retrieve } from './rag'
import { detectRisk } from './crisis'
import { summarize, buildSeries, MOOD_META, MOOD_TAGS } from './mood'
import type { AssessmentRecord, Citation, MoodRecord, MoodScore, ToolResult } from './types'
import type { ToolSchema } from './llm'
import { LEVEL_META } from './assessment'

export interface ToolContext {
  addMood: (record: Omit<MoodRecord, 'id' | 'ts'>) => void
  getRecords: () => MoodRecord[]
  getAssessments: () => AssessmentRecord[]
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
        '检索分享小屋知识库（CBT、睡眠、学习科学）。用户问"为什么""怎么办""有依据吗"时调用。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '检索词，保留具体症状与情境' },
          top_k: { type: 'integer', description: '片段数，1-3，默认 2' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'start_breathing',
      description: '打开呼吸放松引导面板。用户心慌、手抖、坐不住、睡不着或想放松时调用。',
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
      description: '打开 GAD-7 焦虑自评（7 题，近两周）。用户想知道焦虑程度，或紧张持续两周以上时调用。',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_study_plan',
      description: '按剩余天数、每天可用时长与科目生成减压复习计划，含错题回顾与放松时段。',
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
      description: '记录一次情绪分数（1 很低落 - 5 很舒展）。必须先和用户确认分数再调用。',
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
      description: '读取本地情绪记录，返回近 N 天平均分、趋势与高频标签。',
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
        const k = clamp(Number(args.top_k ?? 2), 1, 3)
        const citations: Citation[] = retrieve(query, k)
        if (!citations.length) return ok('知识库未检索到直接相关的条目')
        // 只回传最相关的 2 条：这段文字会作为工具结果再次进入上下文，也是在计费
        const text = citations
          .slice(0, 2)
          .map((c, i) => `资料${i + 1}《${c.title}》：${c.snippet}`)
          .join('\n')
        return ok(text, { citations })
      }

      case 'start_breathing': {
        const pattern = (['478', 'box', 'coherent'] as const).includes(args.pattern)
          ? (args.pattern as '478' | 'box' | 'coherent')
          : '478'
        const map = {
          '478': { title: '4-7-8 呼吸引导', hint: '吸 4 秒、屏 7 秒、呼 8 秒，呼气比吸气长' },
          box: { title: '箱式呼吸引导', hint: '吸 4、屏 4、呼 4、屏 4，适合专注前' },
          coherent: { title: '共振呼吸引导', hint: '吸 5、呼 5，约每分钟 6 次' },
        } as const
        const m = map[pattern]
        // 只提议，不执行：回答说完后界面会出现「好，打开 / 先不用」
        return ok(
          `已向用户提议打开「${m.title}」（${m.hint}）。界面上会出现一个确认按钮，他点了才会真的打开。你可以在回答里邀请他试试，但不要说"已经打开了"。`,
          { action: { kind: 'breathing', pattern, title: m.title, hint: m.hint } },
        )
      }

      case 'open_anxiety_assessment': {
        return ok(
          '已向用户提议打开 GAD-7 焦虑自评（7 题，回顾过去两周），他点了确认才会开始。你可以邀请他做，并说明这是筛查不是诊断，但不要说"已经打开了"。',
          {
            action: {
              kind: 'assessment',
              title: 'GAD-7 焦虑自评',
              hint: '7 个问题，回顾过去两周，约 2 分钟',
            },
          },
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
