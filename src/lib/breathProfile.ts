/**
 * 呼吸档案 · 用户画像（轻量、本地）
 *
 * 存的只有：什么时候练了、什么状态、用了哪组节奏、几分钟、
 * 中途给过什么反馈。不存聊天原文，不传服务器。
 * 这些字段足够回答三个问题：常用哪组、平均多久、是不是怕屏息。
 */

import { load, save, STORAGE_KEYS } from './storage'
import { STATE_META, type BreathOutcome, type BreathSpec, type BreathState, type FeedbackKind, type RhythmKey } from './breath'

export interface BreathSession {
  id: string
  ts: number
  state: BreathState
  planKey: string
  planName: string
  seconds: number
  target: number
  cycles: number
  feedbacks: FeedbackKind[]
  endedEarly: boolean
  rhythm: RhythmKey
  /** 这次的节奏签名，用于「就用上次那组」 */
  spec?: BreathSpec
}

export interface BreathProfile {
  sessions: BreathSession[]
  total: number
  /** 累计分钟 */
  minutes: number
  /** 单次平均秒数 */
  avgSeconds: number
  topState: BreathState | null
  topPlan: string | null
  dizzy: number
  fast: number
  behind: number
  /** 屏息耐受：出现过头晕，或多次说太急 */
  holdAversion: boolean
  pace: '偏快' | '偏慢' | '温和'
  streakDays: number
  lastAt: number | null
  /** 状态 → 次数，用于画像里的标签云 */
  stateCounts: { state: BreathState; n: number }[]
}

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3)

export function loadBreathSessions(): BreathSession[] {
  const list = load<BreathSession[]>(STORAGE_KEYS.breathSessions, [])
  return Array.isArray(list) ? list.filter((s) => s && typeof s.ts === 'number') : []
}

export function recordSession(out: BreathOutcome): BreathSession[] {
  const entry: BreathSession = {
    id: uid(),
    ts: Date.now(),
    state: out.plan.state,
    planKey: out.plan.key,
    planName: out.plan.name,
    seconds: Math.round(out.seconds),
    target: out.target,
    cycles: out.cycles,
    feedbacks: [...new Set(out.feedbacks)],
    endedEarly: out.endedEarly,
    rhythm: out.plan.rhythm,
    spec: { ...out.plan.spec },
  }
  const list = [entry, ...loadBreathSessions()].slice(0, 200)
  save(STORAGE_KEYS.breathSessions, list)
  return list
}

export function clearBreathSessions(): void {
  save(STORAGE_KEYS.breathSessions, [])
}

function dayKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

export function deriveBreathProfile(sessions: BreathSession[]): BreathProfile {
  const total = sessions.length
  const minutes = sessions.reduce((s, x) => s + x.seconds, 0) / 60
  const avgSeconds = total ? sessions.reduce((s, x) => s + x.seconds, 0) / total : 0

  const stateCount = new Map<BreathState, number>()
  const planCount = new Map<string, number>()
  let dizzy = 0
  let fast = 0
  let behind = 0

  for (const s of sessions) {
    stateCount.set(s.state, (stateCount.get(s.state) ?? 0) + 1)
    planCount.set(s.planName, (planCount.get(s.planName) ?? 0) + 1)
    if (s.feedbacks.includes('dizzy')) dizzy++
    if (s.feedbacks.includes('fast')) fast++
    if (s.feedbacks.includes('behind')) behind++
  }

  const top = <T,>(m: Map<T, number>): [T, number] | null => {
    let best: [T, number] | null = null
    for (const [k, v] of m) if (!best || v > best[1]) best = [k, v]
    return best
  }

  const topState = top(stateCount)?.[0] ?? null
  const topPlan = top(planCount)?.[0] ?? null

  const holdAversion = dizzy >= 1 || fast >= 2
  const pace: BreathProfile['pace'] = holdAversion ? '温和' : behind > fast ? '偏快' : fast > 0 ? '偏慢' : '温和'

  // 连续练习天数（今天或昨天有记录即延续）
  const days = new Set(sessions.map((s) => dayKey(s.ts)))
  let streakDays = 0
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  for (let i = 0; i < 400; i++) {
    const k = dayKey(cursor.getTime() - i * 86400000)
    if (days.has(k)) streakDays++
    else if (i > 0) break
  }

  return {
    sessions,
    total,
    minutes: Math.round(minutes * 10) / 10,
    avgSeconds: Math.round(avgSeconds),
    topState,
    topPlan,
    dizzy,
    fast,
    behind,
    holdAversion,
    pace,
    streakDays,
    lastAt: sessions[0]?.ts ?? null,
    stateCounts: [...stateCount.entries()]
      .map(([state, n]) => ({ state, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 4),
  }
}

/** 进入页面时主动说的那句话：把画像翻译成一句「我记得你」 */
export function memoryLine(p: BreathProfile): string | null {
  if (!p.total) return null
  if (p.holdAversion) {
    return `你之前有次练完说头晕，这次就不给你排屏息了——直接走柔和模式。`
  }
  if (p.pace === '偏慢' && p.topPlan) {
    return `你说过「${p.topPlan}」太急，这次我把呼气再放慢一点。`
  }
  if (p.total >= 3 && p.topState && p.topPlan) {
    return `${STATE_META[p.topState].label}的时候，你更适合「${p.topPlan}」，要不要接着用它？`
  }
  if (p.total >= 1 && p.topPlan) {
    return `上次你练了 ${Math.max(1, Math.round(p.sessions[0].seconds / 60))} 分钟「${p.topPlan}」。今天要不要再来一次？`
  }
  return null
}

/** 练习结束写进画像时的提示语 */
export function archiveLine(p: BreathProfile): string {
  if (p.total === 1) return '第一笔记录已经写进呼吸档案了。'
  if (p.streakDays >= 3) return `已经连续 ${p.streakDays} 天做呼吸练习了，这件事开始变成习惯。`
  return `档案里现在有 ${p.total} 次练习，共 ${p.minutes} 分钟。`
}
