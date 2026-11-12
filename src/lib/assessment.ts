/** GAD-7 焦虑自评（筛查工具，非诊断） */

import type { AnxietyLevel } from './types'

export interface GadItem {
  id: number
  text: string
}

export const GAD7_ITEMS: GadItem[] = [
  { id: 1, text: '感到紧张、焦虑或急切' },
  { id: 2, text: '无法停止或控制自己的担忧' },
  { id: 3, text: '对各种各样的事情担忧过多' },
  { id: 4, text: '很难放松下来' },
  { id: 5, text: '由于不安而无法静坐' },
  { id: 6, text: '变得容易烦恼或急躁' },
  { id: 7, text: '感到似乎将有可怕的事情发生而害怕' },
]

export const GAD7_OPTIONS = [
  { label: '完全没有', value: 0 },
  { label: '有几天', value: 1 },
  { label: '一半以上时间', value: 2 },
  { label: '几乎每天', value: 3 },
]

export const LEVEL_META: Record<
  AnxietyLevel,
  { label: string; range: string; color: string; advice: string }
> = {
  minimal: {
    label: '轻微',
    range: '0–4 分',
    color: '#66b2c3',
    advice: '当前焦虑水平较低。保持规律作息与固定的放松时段，把注意力放在可执行的复习计划上。',
  },
  mild: {
    label: '轻度',
    range: '5–9 分',
    color: '#94cdd9',
    advice: '存在轻度焦虑，属于备考常见范围。建议每天做 2 次 4-7-8 呼吸（每次 4 个循环），并尝试一次思维记录表。',
  },
  moderate: {
    label: '中度',
    range: '10–14 分',
    color: '#a99be0',
    advice: '焦虑已开始占用注意力资源。建议：减少单日复习总量 20%、每天固定 30 分钟"担心时间"、预约一次学校心理中心的面谈。',
  },
  severe: {
    label: '重度',
    range: '15–21 分',
    color: '#e37f69',
    advice: '焦虑水平较高且可能影响睡眠与日常功能。建议尽快联系学校心理中心或医院心理科/精神科进行评估，同时保持 12356 热线可用。',
  },
}

export function scoreToLevel(total: number): AnxietyLevel {
  if (total <= 4) return 'minimal'
  if (total <= 9) return 'mild'
  if (total <= 14) return 'moderate'
  return 'severe'
}

export const GAD7_DISCLAIMER =
  'GAD-7 是国际通用的焦虑筛查量表，用于自我觉察与趋势观察，不能作为医学诊断依据。结果不能替代专业评估。'
