/** 呼吸节奏定义与相位计算 */

import type { BreathingPattern } from './types'

export const PATTERNS: Record<BreathingPattern['id'], BreathingPattern> = {
  '478': {
    id: '478',
    name: '4-7-8 潮汐呼吸',
    inhale: 4,
    hold: 7,
    exhale: 8,
    desc: '吸 4 秒 · 屏 7 秒 · 呼 8 秒。呼气长于吸气，帮助心率降下来，适合睡前与考前急性紧张。',
  },
  box: {
    id: 'box',
    name: '箱式呼吸',
    inhale: 4,
    hold: 4,
    exhale: 4,
    holdAfter: 4,
    desc: '吸 4 · 屏 4 · 呼 4 · 屏 4。四个等长的边，适合进入专注前稳定注意力。',
  },
  coherent: {
    id: 'coherent',
    name: '共振呼吸',
    inhale: 5,
    hold: 0,
    exhale: 5,
    desc: '吸 5 · 呼 5，约每分钟 6 次，是心率变异性生物反馈的常用频率，适合日常稳定状态。',
  },
}

export type PhaseKey = 'inhale' | 'hold' | 'exhale' | 'rest'

export const PHASE_LABEL: Record<PhaseKey, string> = {
  inhale: '吸气',
  hold: '屏息',
  exhale: '呼气',
  rest: '停留',
}

export interface PhaseInfo {
  key: PhaseKey
  label: string
  index: number
  progress: number
  remaining: number
  duration: number
  cycle: number
}

export function buildTimeline(p: BreathingPattern): { key: PhaseKey; duration: number }[] {
  const seq: { key: PhaseKey; duration: number }[] = [
    { key: 'inhale', duration: p.inhale },
    { key: 'hold', duration: p.hold },
    { key: 'exhale', duration: p.exhale },
  ]
  if (p.holdAfter) seq.push({ key: 'rest', duration: p.holdAfter })
  return seq.filter((s) => s.duration > 0)
}

export function phaseAt(p: BreathingPattern, elapsedMs: number): PhaseInfo {
  const seq = buildTimeline(p)
  const cycleLen = seq.reduce((s, x) => s + x.duration, 0)
  const t = elapsedMs / 1000
  const cycle = Math.floor(t / cycleLen) + 1
  let rest = t % cycleLen
  let index = 0
  for (let i = 0; i < seq.length; i++) {
    if (rest < seq[i].duration) {
      index = i
      break
    }
    rest -= seq[i].duration
    index = i
  }
  const cur = seq[index] ?? seq[0]
  const progress = Math.min(1, Math.max(0, rest / cur.duration))
  return {
    key: cur.key,
    label: PHASE_LABEL[cur.key],
    index,
    progress,
    remaining: Math.max(0, Math.ceil(cur.duration - rest)),
    duration: cur.duration,
    cycle,
  }
}

/** 各相位对应的球体缩放：吸气放大、屏息保持、呼气缩小 */
export function scaleFor(info: PhaseInfo): number {
  const MIN = 0.62
  const MAX = 1
  if (info.key === 'hold') return MAX
  if (info.key === 'rest') return MIN
  if (info.key === 'inhale') {
    const e = Math.pow(info.progress, 0.85)
    return MIN + (MAX - MIN) * e
  }
  // 呼气：前段快、后段慢，更接近真实呼气曲线
  const e = 1 - Math.pow(1 - info.progress, 2.2)
  return MAX - (MAX - MIN) * e
}
