/**
 * Agent 工具层（Function Calling / MCP 适配）
 *
 * 结构：
 *   ToolSpec { name, label, description, parameters(JSON Schema), run() }
 *     ↓ 启动时编译成
 *   TOOL_SCHEMAS（OpenAI / Ark function calling 的 tools 数组）
 *
 * 每个工具有两个产出：
 *   1) 结构化文本，回给模型让它继续说话；
 *   2) 可选的一个「待确认动作」（PendingAction）。注意是"待确认"——工具绝不自己弹窗或跳页：
 *      岛主会先把话说完，界面上再出现「好，打开 / 先不用」，用户点了才真的执行。
 *
 * 参数在执行前按 JSON Schema 校验一遍：不合法就回一条结构化错误，
 * 模型看到错误可以自己改参数重试（自主决策 + 自我修正），而不是让整段回答崩掉。
 */

import { retrieve } from './rag'
import { detectRisk } from './crisis'
import { summarize, buildSeries, MOOD_META, MOOD_TAGS } from './mood'
import { isMcpTool, callMcpTool } from './mcp'
import type { AssessmentRecord, Citation, MoodRecord, MoodScore, ToolResult } from './types'
import type { ToolSchema } from './llm'
import { LEVEL_META } from './assessment'

export interface ToolContext {
  addMood: (record: Omit<MoodRecord, 'id' | 'ts'>) => void
  getRecords: () => MoodRecord[]
  getAssessments: () => AssessmentRecord[]
}

type Handler = (args: any, ctx: ToolContext, callId: string) => ToolResult | Promise<ToolResult>

interface ToolSpec {
  name: string
  label: string
  description: string
  parameters: Record<string, unknown>
  run: Handler
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

function planFor(subjects: string[], hours: number): string[] {
  const perBlock = 45
  const totalBlocks = Math.max(2, Math.round((hours * 60) / perBlock))
  const blocks: string[] = []
  for (let i = 0; i < totalBlocks; i++) blocks.push(subjects[i % Math.max(subjects.length, 1)] ?? '错题回顾')
  return blocks
}

function buildPlan(args: { days: number; hours_per_day: number; subjects: string[]; pain_point?: string }): string {
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
    days > 7 ? `\n- 第 8 天起按「${subjects[0]} → 错题 → 模拟」循环推进，每 3 天做一次 90 分钟限时训练。` : ''

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
    '> 说明：计划按"最低可完成量"设计，状态差的日子完成上午块即可，避免全有全无。最后 2 天总时长减半，只做框架默写与物资清单。',
  ]
    .filter((l) => l !== '')
    .join('\n')
}

const BREATHING = {
  '478': { title: '4-7-8 呼吸引导', hint: '吸 4 秒、屏 7 秒、呼 8 秒，呼气比吸气长' },
  box: { title: '箱式呼吸引导', hint: '吸 4、屏 4、呼 4、屏 4，适合专注前' },
  coherent: { title: '共振呼吸引导', hint: '吸 5、呼 5，约每分钟 6 次' },
} as const

const PAGES: Record<string, { title: string; hint: string }> = {
  '/calm': { title: '潮汐 · 呼吸与明信片', hint: '呼吸引导、明信片与白噪音都在这一页' },
  '/library': { title: '分享小屋 · 藏书阁', hint: '岛主读过的心理学科普都在这里，可以自己翻' },
  '/harbor': { title: '避风港 · 求助方式', hint: '热线、求助流程与七件缓解焦虑的小事' },
  '/mood': { title: '潮向 · 情绪仪表盘', hint: '看近期的情绪曲线与打卡记录' },
}

/* ─────────────────────── 注册表 ─────────────────────── */

const SPECS: ToolSpec[] = [
  {
    name: 'search_knowledge_base',
    label: '检索知识库',
    description: '检索分享小屋知识库（CBT、睡眠、学习科学）。用户问"为什么""怎么办""有依据吗"时调用。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '检索词，保留具体症状与情境' },
        top_k: { type: 'integer', minimum: 1, maximum: 3, description: '片段数，1-3，默认 2' },
      },
      required: ['query'],
    },
    run: (args, _ctx, id) => {
      const k = clamp(Number(args.top_k ?? 2), 1, 3)
      const citations: Citation[] = retrieve(String(args.query ?? ''), k)
      if (!citations.length) {
        return { id, name: 'search_knowledge_base', ok: true, summary: '知识库未检索到直接相关的条目（不要编造依据）' }
      }
      const text = citations
        .slice(0, 2)
        .map((c, i) => `资料${i + 1}《${c.title}》：${c.snippet}`)
        .join('\n')
      return { id, name: 'search_knowledge_base', ok: true, summary: text, citations }
    },
  },
  {
    name: 'start_breathing',
    label: '唤起潮汐呼吸',
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
    run: (args, _ctx, id) => {
      const pattern = (['478', 'box', 'coherent'] as const).includes(args.pattern) ? args.pattern : '478'
      const m = BREATHING[pattern as keyof typeof BREATHING]
      return {
        id,
        name: 'start_breathing',
        ok: true,
        summary: `已向用户提议打开「${m.title}」（${m.hint}）。界面上会出现一个确认按钮，他点了才会真的打开。你可以在回答里邀请他试试，但不要说"已经打开了"。`,
        action: { kind: 'breathing', pattern, title: m.title, hint: m.hint },
      }
    },
  },
  {
    name: 'open_anxiety_assessment',
    label: '打开 GAD-7 自评',
    description: '打开 GAD-7 焦虑自评（7 题，近两周）。用户想知道焦虑程度，或紧张持续两周以上时调用。',
    parameters: { type: 'object', properties: {}, required: [] },
    run: (_args, _ctx, id) => ({
      id,
      name: 'open_anxiety_assessment',
      ok: true,
      summary:
        '已向用户提议打开 GAD-7 焦虑自评（7 题，回顾过去两周），他点了确认才会开始。你可以邀请他做，并说明这是筛查不是诊断，但不要说"已经打开了"。',
      action: { kind: 'assessment', title: 'GAD-7 焦虑自评', hint: '7 个问题，回顾过去两周，约 2 分钟' },
    }),
  },
  {
    name: 'create_study_plan',
    label: '生成减压复习计划',
    description: '按剩余天数、每天可用时长与科目生成减压复习计划，含错题回顾与放松时段。',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'integer', minimum: 1, maximum: 60, description: '距离考试的剩余天数' },
        hours_per_day: { type: 'number', minimum: 1, maximum: 14, description: '每天可投入的净学习小时数' },
        subjects: { type: 'array', items: { type: 'string' }, description: '需要安排的科目或章节' },
        pain_point: { type: 'string', description: '用户当前最大的困难，如"错题太多""总是拖延"' },
      },
      required: ['days', 'hours_per_day', 'subjects'],
    },
    run: (args, _ctx, id) => ({
      id,
      name: 'create_study_plan',
      ok: true,
      summary: buildPlan({
        days: Number(args.days),
        hours_per_day: Number(args.hours_per_day),
        subjects: Array.isArray(args.subjects) ? args.subjects.map(String) : [],
        pain_point: args.pain_point ? String(args.pain_point) : undefined,
      }),
    }),
  },
  {
    name: 'log_mood',
    label: '写入情绪记录',
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
    run: (args, ctx, id) => {
      const score = clamp(Math.round(Number(args.score)), 1, 5) as MoodScore
      const tags = Array.isArray(args.tags)
        ? args.tags.map(String).filter((t: string) => MOOD_TAGS.includes(t)).slice(0, 4)
        : []
      const note = args.note ? String(args.note).slice(0, 120) : undefined
      ctx.addMood({ score, tags, note, source: 'chat' })
      return {
        id,
        name: 'log_mood',
        ok: true,
        summary: `已记录：${MOOD_META[score].label}（${score}/5）${tags.length ? `，标签：${tags.join('、')}` : ''}。数据仅保存在本地浏览器。`,
      }
    },
  },
  {
    name: 'get_mood_trend',
    label: '读取情绪趋势',
    description: '读取本地情绪记录，返回近 N 天平均分、趋势与高频标签。',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'integer', enum: [7, 14, 30], description: '统计窗口，默认 7' },
      },
      required: [],
    },
    run: (args, ctx, id) => {
      const days = [7, 14, 30].includes(Number(args.days)) ? Number(args.days) : 7
      const records = ctx.getRecords()
      const s = summarize(records, days)
      if (!s.count) {
        return { id, name: 'get_mood_trend', ok: true, summary: `近 ${days} 天还没有记录。可以邀请用户先做一次 30 秒的情绪打卡。` }
      }
      const series = buildSeries(records, days)
      const filled = series.filter((p) => p.avg !== null)
      const text = [
        `近 ${days} 天共 ${s.count} 条记录，平均 ${s.avg?.toFixed(1)}/5。`,
        s.prevAvg !== null
          ? `上一周期平均 ${s.prevAvg.toFixed(1)}，变化 ${s.delta! >= 0 ? '+' : ''}${s.delta}。`
          : '上一周期无足够数据对比。',
        s.topTags.length ? `高频标签：${s.topTags.map((t) => `${t.tag}(${t.n})`).join('、')}。` : '',
        `有记录的天数：${filled.length} 天；连续记录 ${s.streak} 天。`,
        `波动：${filled.map((p) => `${p.label} ${p.avg!.toFixed(1)}`).join('，')}`,
      ]
        .filter(Boolean)
        .join('\n')
      return { id, name: 'get_mood_trend', ok: true, summary: text }
    },
  },
  {
    name: 'navigate_to',
    label: '推荐一个页面',
    description: '用户想动手做点什么时，提议带他去对应页面（呼吸/藏书阁/避风港/情绪仪表盘）。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', enum: Object.keys(PAGES), description: '目标页面路径' },
        reason: { type: 'string', description: '为什么建议去这一页，一句话' },
      },
      required: ['path'],
    },
    run: (args, _ctx, id) => {
      const page = PAGES[args.path] ?? PAGES['/calm']
      return {
        id,
        name: 'navigate_to',
        ok: true,
        summary: `已向用户提议前往「${page.title}」。界面上会出现确认按钮，他点了才会跳转。不要说"已经带你过去了"。`,
        action: { kind: 'navigate', path: args.path in PAGES ? args.path : '/calm', title: page.title, hint: page.hint },
      }
    },
  },
]

export const TOOL_LABELS: Record<string, string> = Object.fromEntries(SPECS.map((s) => [s.name, s.label]))

export const TOOL_SCHEMAS: ToolSchema[] = SPECS.map((s) => ({
  type: 'function',
  function: { name: s.name, description: s.description, parameters: s.parameters },
}))

const BY_NAME = new Map(SPECS.map((s) => [s.name, s]))

/* ─────────────────────── 参数校验 ─────────────────────── */

type Schema = { type?: string; properties?: Record<string, any>; required?: string[]; items?: any; enum?: any[]; minimum?: number; maximum?: number }

/** 极简 JSON Schema 校验：够用就好，不引第三方依赖 */
export function validateArgs(schema: Schema, args: Record<string, any>): string[] {
  const errors: string[] = []
  const props = schema?.properties ?? {}
  for (const key of schema?.required ?? []) {
    const v = args?.[key]
    if (v === undefined || v === null || v === '') errors.push(`缺少必填参数 ${key}`)
  }
  for (const [key, raw] of Object.entries(props)) {
    const def = raw as Schema
    const v = args?.[key]
    if (v === undefined || v === null) continue
    switch (def.type) {
      case 'string':
        if (typeof v !== 'string') errors.push(`${key} 应为字符串`)
        break
      case 'integer':
        if (!Number.isInteger(Number(v))) errors.push(`${key} 应为整数`)
        break
      case 'number':
        if (typeof v !== 'number' || Number.isNaN(v)) errors.push(`${key} 应为数字`)
        break
      case 'boolean':
        if (typeof v !== 'boolean') errors.push(`${key} 应为布尔值`)
        break
      case 'array':
        if (!Array.isArray(v)) errors.push(`${key} 应为数组`)
        break
      default:
        break
    }
    if (def.enum && !def.enum.includes(v)) errors.push(`${key} 只能是 ${def.enum.join(' / ')} 之一`)
    if (typeof v === 'number') {
      if (def.minimum !== undefined && v < def.minimum) errors.push(`${key} 不能小于 ${def.minimum}`)
      if (def.maximum !== undefined && v > def.maximum) errors.push(`${key} 不能大于 ${def.maximum}`)
    }
  }
  return errors
}

/* ─────────────────────── 执行 ─────────────────────── */

export async function runTool(name: string, rawArgs: string, ctx: ToolContext, callId: string): Promise<ToolResult> {
  // 外部 MCP 工具：走桥接，不进本地注册表
  if (isMcpTool(name)) {
    const res = await callMcpTool(name, rawArgs)
    return { id: callId, name, ok: res.ok, summary: res.summary }
  }

  const spec = BY_NAME.get(name)
  if (!spec) return { id: callId, name, ok: false, summary: `未知工具：${name}。可选工具：${[...BY_NAME.keys()].join(', ')}` }

  let args: Record<string, any> = {}
  if (rawArgs?.trim()) {
    try {
      args = JSON.parse(rawArgs)
    } catch {
      return {
        id: callId,
        name,
        ok: false,
        summary: `参数不是合法 JSON（收到：${rawArgs.slice(0, 80)}）。请只输出合法的参数对象。`,
      }
    }
  }

  const errors = validateArgs(spec.parameters as Schema, args)
  if (errors.length) {
    return {
      id: callId,
      name,
      ok: false,
      summary: `参数校验未通过：${errors.join('；')}。请修正后重新调用，或改用自然语言直接回答。`,
    }
  }

  try {
    return await spec.run(args, ctx, callId)
  } catch (e) {
    return { id: callId, name, ok: false, summary: `工具执行失败：${(e as Error).message}` }
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
