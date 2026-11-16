/** 情绪潮向 · 记录与统计 */

import type { MoodRecord, MoodScore } from './types'

export const MOOD_META: Record<MoodScore, { label: string; hint: string; color: string }> = {
  1: { label: '很低落', hint: '几乎撑不住', color: '#8e9bb5' },
  2: { label: '有点沉', hint: '提不起劲', color: '#9fb6c9' },
  3: { label: '还平稳', hint: '不咸不淡', color: '#94cdd9' },
  4: { label: '比较松', hint: '能专注做事', color: '#a9c9a4' },
  5: { label: '很舒展', hint: '心里有光', color: '#c4b9ec' },
}

export const MOOD_TAGS = [
  '学业压力',
  '睡眠不足',
  '人际摩擦',
  '家庭期待',
  '自我怀疑',
  '身体不适',
  '计划推进',
  '被治愈到',
]

const DAY = 86400000

export function dayKey(ts: number): string {
  const d = new Date(ts)
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export interface DayPoint {
  key: string
  label: string
  avg: number | null
  count: number
}

export function buildSeries(records: MoodRecord[], days: number): DayPoint[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const buckets = new Map<string, number[]>()

  for (const r of records) {
    const k = dayKey(r.ts)
    buckets.set(k, [...(buckets.get(k) ?? []), r.score])
  }

  const out: DayPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const ts = today.getTime() - i * DAY
    const k = dayKey(ts)
    const scores = buckets.get(k) ?? []
    const d = new Date(ts)
    out.push({
      key: k,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      avg: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
      count: scores.length,
    })
  }
  return out
}

export interface MoodSummary {
  avg: number | null
  prevAvg: number | null
  delta: number | null
  count: number
  streak: number
  topTags: { tag: string; n: number }[]
  lowDays: number
}

export function summarize(records: MoodRecord[], days = 7): MoodSummary {
  const now = Date.now()
  const from = now - days * DAY
  const prevFrom = now - days * 2 * DAY
  const cur = records.filter((r) => r.ts >= from)
  const prev = records.filter((r) => r.ts >= prevFrom && r.ts < from)

  const avg = cur.length ? cur.reduce((s, r) => s + r.score, 0) / cur.length : null
  const prevAvg = prev.length ? prev.reduce((s, r) => s + r.score, 0) / prev.length : null

  const tagCount = new Map<string, number>()
  for (const r of cur) for (const t of r.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1)
  const topTags = [...tagCount.entries()]
    .map(([tag, n]) => ({ tag, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 3)

  // 连续记录天数（今天或昨天有记录即算延续）
  const daysWith = new Set(cur.map((r) => dayKey(r.ts)))
  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 0; i < 400; i++) {
    const k = dayKey(today.getTime() - i * DAY)
    if (daysWith.has(k)) streak++
    else if (i > 0) break
  }

  const lowDays = cur.filter((r) => r.score <= 2).length

  return {
    avg,
    prevAvg,
    delta: avg !== null && prevAvg !== null ? Number((avg - prevAvg).toFixed(2)) : null,
    count: cur.length,
    streak,
    topTags,
    lowDays,
  }
}

/** 曲线下方的一行解读：只描述事实，不给建议（建议交给画像区） */
export function buildPortraitLine(summary: MoodSummary): string {
  const { avg, delta, count, streak, topTags } = summary
  if (!count) return '还没有记录。今天可以先选一个最接近当下的状态，画像就从这一笔开始。'
  const head = `近 ${count} 次记录的平均潮位是 ${avg?.toFixed(1)} 分`
  const trend =
    delta === null
      ? '，还没有可对比的上一周期。'
      : delta <= -0.5
        ? `，比上一周期低 ${Math.abs(delta).toFixed(1)} 分。`
        : delta >= 0.5
          ? `，比上一周期高 ${delta.toFixed(1)} 分。`
          : '，和上一周期差不多。'
  const tail = topTags.length
    ? `最近比较多提到「${topTags[0].tag}」。`
    : streak >= 3
      ? `已经连续记录 ${streak} 天。`
      : ''
  return head + trend + tail
}
