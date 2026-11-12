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

export interface ToolResult {
  id: string
  name: string
  ok: boolean
  summary: string
  citations?: Citation[]
  payload?: Record<string, unknown>
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
