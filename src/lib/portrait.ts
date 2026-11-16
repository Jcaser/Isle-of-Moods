/**
 * 情绪画像
 *
 * 不是给用户打分，而是把他这段时间「是怎么起伏的」描述成一个形状：
 * 稳定度、恢复力、记录习惯、压力感、身体感、自我照顾。
 * 分数越高代表这个维度越明显，不代表好坏。
 */

import { streamChat, type LLMConfig } from './llm'
import { MOOD_META, dayKey } from './mood'
import type { AssessmentRecord, MoodRecord } from './types'

export interface Trait {
  key: string
  label: string
  /** 0–100 */
  value: number
  hint: string
}

export interface Portrait {
  has: boolean
  title: string
  /** 岛主视角的一段描述 */
  summary: string
  traits: Trait[]
  evidence: string[]
  topTags: { tag: string; n: number }[]
  /** 情绪最低常落在哪个时段 */
  window: string
  avg: number | null
  trend: number | null
  days: number
  records: number
  latest?: AssessmentRecord
}

const DAY = 86400000
const clamp100 = (v: number) => Math.max(0, Math.min(100, Math.round(v)))

function windowOf(records: MoodRecord[]): string {
  const buckets = [
    { label: '凌晨（0–6 点）', from: 0, to: 6 },
    { label: '上午', from: 6, to: 12 },
    { label: '下午', from: 12, to: 18 },
    { label: '晚上', from: 18, to: 24 },
  ]
  let best = { label: '晚上', avg: 6, n: 0 }
  for (const b of buckets) {
    const list = records.filter((r) => {
      const h = new Date(r.ts).getHours()
      return h >= b.from && h < b.to
    })
    if (list.length < 2) continue
    const avg = list.reduce((s, r) => s + r.score, 0) / list.length
    if (avg < best.avg) best = { label: b.label, avg, n: list.length }
  }
  return best.label
}

export function buildPortrait(
  records: MoodRecord[],
  assessments: AssessmentRecord[],
  days = 30,
): Portrait {
  const from = Date.now() - days * DAY
  const list = records.filter((r) => r.ts >= from).sort((a, b) => a.ts - b.ts)

  if (list.length < 2) {
    return {
      has: false,
      title: '画像还没成形',
      summary:
        '再记几次情绪，我就能看出你起伏的形状——不是给你打分，是记住你通常在什么时候、因为什么往下走。',
      traits: [],
      evidence: [],
      topTags: [],
      window: '—',
      avg: null,
      trend: null,
      days: new Set(list.map((r) => dayKey(r.ts))).size,
      records: list.length,
      latest: assessments[0],
    }
  }

  const scores = list.map((r) => r.score)
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  const variance = scores.reduce((s, v) => s + (v - avg) ** 2, 0) / scores.length
  const std = Math.sqrt(variance)

  const last7 = list.filter((r) => r.ts >= Date.now() - 7 * DAY)
  const prev7 = list.filter((r) => r.ts >= Date.now() - 14 * DAY && r.ts < Date.now() - 7 * DAY)
  const avgOf = (arr: MoodRecord[]) => (arr.length ? arr.reduce((s, r) => s + r.score, 0) / arr.length : null)
  const a7 = avgOf(last7)
  const a14 = avgOf(prev7)
  const trend = a7 !== null && a14 !== null ? Number((a7 - a14).toFixed(1)) : null

  // 按天聚合，用于看「低潮之后多久回涨」
  const byDay = new Map<string, number[]>()
  for (const r of list) byDay.set(dayKey(r.ts), [...(byDay.get(dayKey(r.ts)) ?? []), r.score])
  const daySeries = [...byDay.entries()]
    .map(([k, arr]) => ({ key: k, avg: arr.reduce((a, b) => a + b, 0) / arr.length, ts: new Date(`${k}T12:00:00`).getTime() }))
    .sort((a, b) => a.ts - b.ts)

  // 恢复力：低潮之后，几天回到 3 分以上
  let lowCount = 0
  const gaps: number[] = []
  for (let i = 0; i < daySeries.length; i++) {
    if (daySeries[i].avg > 2.6) continue
    lowCount++
    let gap = 7
    for (let j = i + 1; j < Math.min(daySeries.length, i + 8); j++) {
      if (daySeries[j].avg >= 3) {
        gap = j - i
        break
      }
    }
    gaps.push(gap)
  }
  const avgGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0
  const recovery = gaps.length ? Math.round(Math.max(12, Math.min(94, 100 - avgGap * 13))) : 64

  const uniqDays = byDay.size
  const consistency = clamp100((uniqDays / 20) * 100)

  const tagCount = new Map<string, number>()
  for (const r of list) for (const t of r.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1)
  const topTags = [...tagCount.entries()]
    .map(([tag, n]) => ({ tag, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 3)
  const ratio = (tags: string[]) => tags.reduce((s, t) => s + (tagCount.get(t) ?? 0), 0) / list.length

  const pressure = ratio(['学业压力', '家庭期待', '自我怀疑'])
  const body = ratio(['睡眠不足', '身体不适'])
  const care = ratio(['被治愈到', '计划推进'])

  const traits: Trait[] = [
    { key: 'stable', label: '稳定度', value: clamp100(100 - std * 42), hint: '情绪上下摆动的幅度' },
    { key: 'recover', label: '恢复力', value: clamp100(recovery), hint: '低潮之后多快回涨' },
    { key: 'habit', label: '记录习惯', value: consistency, hint: '有没有持续看见自己' },
    { key: 'pressure', label: '压力感', value: clamp100(pressure * 150), hint: '被学业与期待牵动的程度' },
    { key: 'body', label: '身体感', value: clamp100(body * 170), hint: '情绪是否先从身体反映' },
    { key: 'care', label: '自我照顾', value: clamp100(care * 140 + Math.min(18, list.length)), hint: '主动做点什么的比例' },
  ]

  const t = (k: string) => traits.find((x) => x.key === k)?.value ?? 0
  let title = '起伏明显型'
  if (t('stable') >= 70 && (trend ?? 0) >= 0) title = '稳定回涨型'
  else if (t('stable') >= 70) title = '平稳巡航型'
  else if (t('pressure') >= 62) title = '压力聚集型'
  else if (t('body') >= 58) title = '身体先知道型'
  else if (t('recover') >= 55) title = '慢回涨型'

  const window = windowOf(list)
  const trendText =
    trend === null
      ? '这段时间还没有可对比的两周。'
      : trend > 0.3
        ? `近一周比前一周回升了 ${trend.toFixed(1)} 分。`
        : trend < -0.3
          ? `近一周比前一周低了 ${Math.abs(trend).toFixed(1)} 分。`
          : '近两周大致持平。'

  const tagSentence = topTags.length
    ? `最常被提起的是「${topTags[0].tag}」${topTags[1] ? `，其次是「${topTags[1].tag}」` : ''}。`
    : '还没有标注影响因素。'

  const summary = [
    `这 ${days} 天你留下了 ${list.length} 次记录，覆盖 ${uniqDays} 天。`,
    trendText,
    tagSentence,
    t('stable') >= 70 ? '你的情绪没有大起大落，这本身是一种资源。' : '起伏比较明显，说明你对外界反应很快，也更需要给身体留缓冲。',
  ].join('')

  const evidence = [
    `记录 ${list.length} 次、覆盖 ${uniqDays} 天；平均 ${avg.toFixed(1)} / 5 分。`,
    lowCount
      ? `出现过 ${lowCount} 天低潮，平均 ${avgGap.toFixed(1)} 天后回到 3 分以上——这是「恢复力」的来源。`
      : '这段时间没有持续的低潮日。',
    topTags.length
      ? `高频影响因素：${topTags.map((x) => `${x.tag} ${x.n} 次`).join('、')}。`
      : '还没有标注影响因素，可以在打卡时补一个。',
    `情绪最低的时间多出现在${window}。`,
  ]

  return {
    has: true,
    title,
    summary,
    traits,
    evidence,
    topTags,
    window,
    avg: Number(avg.toFixed(2)),
    trend,
    days: uniqDays,
    records: list.length,
    latest: assessments[0],
  }
}

export const moodWord = (avg: number | null) => {
  if (avg === null) return '—'
  const key = Math.max(1, Math.min(5, Math.round(avg))) as 1 | 2 | 3 | 4 | 5
  return MOOD_META[key].label
}

/** 让岛主用自己的话说一遍这张画像；失败则返回 null，页面用本地 summary */
export async function explainPortrait(p: Portrait, config: LLMConfig): Promise<string | null> {
  if (!p.has) return null
  const traitLine = p.traits.map((t) => `${t.label} ${t.value}/100`).join('，')
  try {
    const res = await Promise.race([
      streamChat({
        config: { ...config, temperature: 0.65 },
        messages: [
          {
            role: 'system',
            content: [
              '你在为用户解读一份「情绪画像」。写 3 句中文，总长不超过 90 字。',
              '第一句描述他的起伏形状（用比喻，但别浮夸）；第二句指出一个具体模式；第三句给一个本周能做的小动作。',
              '不要诊断，不要提分数，不要用 markdown，不要说「根据数据」。',
            ].join('\n'),
          },
          {
            role: 'user',
            content: `画像：${p.title}。${traitLine}。最常提到的：${p.topTags.map((t) => t.tag).join('、') || '未标注'}。近 30 天记录 ${p.records} 次，平均 ${p.avg?.toFixed(1)} 分。低潮多在${p.window}。`,
          },
        ],
      }),
      new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('timeout')), 9000)),
    ])
    const clean = res.content.replace(/[*_#>`]/g, '').replace(/\s+/g, ' ').trim()
    return clean.length >= 12 ? clean.slice(0, 140) : null
  } catch {
    return null
  }
}
