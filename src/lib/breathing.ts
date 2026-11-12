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

/** 相位短名，用于节奏条 */
export const PHASE_SHORT: Record<PhaseKey, string> = {
  inhale: '吸',
  hold: '屏',
  exhale: '呼',
  rest: '停',
}

export const PHASE_TIP: Record<PhaseKey, string> = {
  inhale: '用鼻子安静吸气，肩膀不要用力',
  hold: '轻轻屏住，喉咙放松，不要绷紧',
  exhale: '用嘴缓慢呼气，像把气吹到很远的地方',
  rest: '停一下，感受身体的重量',
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
  const t = Math.max(0, elapsedMs) / 1000
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

/** 余弦缓动：起止都柔和，接近真实呼吸的加速度 */
function easeInOut(p: number): number {
  return 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, p)))
}

/**
 * 呼吸强度：0 = 完全呼尽，1 = 吸满。
 * 吸气用余弦缓动；呼气是“被动回落”，开头快、结尾慢；
 * 屏息时保持接近 1，并带极轻的起伏，避免看起来像画面卡住。
 */
export function breathLevel(info: PhaseInfo): number {
  switch (info.key) {
    case 'inhale':
      return easeInOut(info.progress)
    case 'hold':
      return 1 + Math.sin(info.progress * Math.PI) * 0.018
    case 'exhale': {
      const p = Math.min(1, Math.max(0, info.progress))
      return Math.pow(1 - p, 1.45)
    }
    case 'rest':
    default:
      return 0
  }
}

/** 球体缩放：呼尽时仍有 0.56，不会缩成一个点 */
export function scaleFor(level: number): number {
  return 0.56 + level * 0.5
}
