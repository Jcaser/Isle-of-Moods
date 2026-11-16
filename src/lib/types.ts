/** 全局类型定义 */

export type MoodScore = 1 | 2 | 3 | 4 | 5

export interface MoodRecord {
  id: string
  ts: number
  score: MoodScore
  tags: string[]
  note?: string
  source: 'quick' | 'chat' | 'assessment'
}

export type AnxietyLevel = 'minimal' | 'mild' | 'moderate' | 'severe'

export interface AssessmentRecord {
  id: string
  ts: number
  answers: number[]
  total: number
  level: AnxietyLevel
}

export interface Citation {
  chunkId: string
  docId: string
  title: string
  category: string
  snippet: string
  score: number
}

export interface ToolCall {
  id: string
  name: string
  arguments: string
}

/**
 * 工具想做的界面动作。
 *
 * 关键约定：工具本身**不执行**任何跳转或弹窗，只产出一个「待确认动作」。
 * 岛主先把话说完整，用户看到回答后再决定要不要去，点头了才真正打开。
 */
export interface PendingAction {
  kind: 'breathing' | 'assessment' | 'navigate'
  /** 动作标题，如「4-7-8 呼吸引导」 */
  title: string
  /** 一句说明，直接展示在确认条上 */
  hint: string
  /** kind = breathing 时的节奏 */
  pattern?: '478' | 'box' | 'coherent'
  /** kind = navigate 时的目标路径 */
  path?: string
}

/**
 * 一次回答的「工作流快照」：理解 → 检索 → 工具 → 校验。
 * 展示给用户看的是结论（走了几步、有没有查到资料），不是内部思维链。
 */
export interface AgentPlanSummary {
  /** 意图 id，如 'anxiety' */
  intent: string
  /** 意图的中文标签，如 '焦虑与身体反应' */
  label: string
  risk: RiskLevel
  /** used=命中并注入；skipped=寒暄不检索；empty=检索了但没命中 */
  retrieval: 'used' | 'skipped' | 'empty'
  hits: number
  /** 本次允许的最大工具步数（额度紧张时会下调） */
  maxSteps: number
}

/** 输出侧安全检查的结果 */
export interface GuardSummary {
  level: 'pass' | 'fixed' | 'blocked'
  checks: number
  issues: { id: string; label: string; severity: 'low' | 'medium' | 'high' }[]
  /** 回答与检索资料的重合度 0-1 */
  grounded: number
}

export interface ToolResult {
  id: string
  name: string
  ok: boolean
  summary: string
  citations?: Citation[]
  payload?: Record<string, unknown>
  /** 需要用户确认后才执行的界面动作 */
  action?: PendingAction
}

export interface ToolTraceItem {
  id: string
  name: string
  label: string
  status: 'running' | 'done' | 'error'
  summary?: string
}

export type RiskLevel = 'none' | 'low' | 'medium' | 'high'

export interface RiskReport {
  level: RiskLevel
  hits: string[]
  kind: 'ideation' | 'self-harm' | 'hopelessness' | 'none'
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  ts: number
  trace?: ToolTraceItem[]
  citations?: Citation[]
  risk?: RiskLevel
  offline?: boolean
  /** 岛主提议的界面动作：只有用户点了同意才会执行 */
  action?: PendingAction
  /** 用户对上面那个动作的选择，未设置表示还在等 */
  actionState?: 'done' | 'skipped'
  /** 这次回答走的工作流（意图 / 检索 / 步数） */
  plan?: AgentPlanSummary
  /** 输出安全审查结果 */
  guard?: GuardSummary
  /** 用户随消息发来的图片（压缩后的缩略图，仅用于显示） */
  image?: string
}

export interface Settings {
  baseUrl: string
  model: string
  apiKey: string
  temperature: number
  voiceURI: string
  rate: number
  pitch: number
}

export interface BreathingPattern {
  id: '478' | 'box' | 'coherent'
  name: string
  inhale: number
  hold: number
  exhale: number
  holdAfter?: number
  desc: string
}
