/**
 * 避风港 · 危机识别与安全兜底
 *
 * 设计原则：
 * 1. 双通道检测——用户输入与模型输出都过一遍，避免模型复述风险内容而不给资源；
 * 2. 分级响应——高危直接置顶求助卡片，中危温和确认 + 提供渠道，低危正常疏导；
 * 3. 宁可误报，不可漏报——命中后由界面呈现资源，不阻断用户表达。
 */

import type { RiskLevel, RiskReport } from './types'

interface Rule {
  level: RiskLevel
  kind: RiskReport['kind']
  patterns: string[]
}

const RULES: Rule[] = [
  {
    level: 'high',
    kind: 'ideation',
    patterns: [
      '自杀',
      '自尽',
      '不想活了',
      '不想活着',
      '活不下去',
      '结束生命',
      '结束自己的生命',
      '了结自己',
      '一了百了',
      '遗书',
      '跳楼',
      '跳河',
      '割腕',
      '烧炭',
      '吃安眠药',
      '上吊',
      '死了算了',
      '想死',
    ],
  },
  {
    level: 'high',
    kind: 'self-harm',
    patterns: ['自残', '自伤', '伤害自己', '划手', '拿刀划'],
  },
  {
    level: 'medium',
    kind: 'hopelessness',
    patterns: [
      '活着没意思',
      '活着没有意义',
      '没有意义',
      '撑不下去',
      '熬不下去',
      '坚持不住',
      '消失就好了',
      '想消失',
      '解脱',
      '没人在乎',
      '我是累赘',
      '拖累别人',
    ],
  },
  {
    level: 'low',
    kind: 'hopelessness',
    patterns: ['绝望', '崩溃', '没希望', '看不到希望', '抑郁', '撑不住'],
  },
]

/** 误报过滤：常见口语中的"死"字用法 */
const FALSE_POSITIVE = ['笑死', '累死', '困死', '热死', '饿死', '美死', '烦死', '吓死', '气死']

export function detectRisk(text: string): RiskReport {
  if (!text) return { level: 'none', hits: [], kind: 'none' }

  let sanitized = text
  for (const fp of FALSE_POSITIVE) sanitized = sanitized.split(fp).join('')

  let level: RiskLevel = 'none'
  let kind: RiskReport['kind'] = 'none'
  const hits: string[] = []
  const order: RiskLevel[] = ['none', 'low', 'medium', 'high']

  for (const rule of RULES) {
    const matched = rule.patterns.filter((p) => sanitized.includes(p))
    if (!matched.length) continue
    hits.push(...matched)
    if (order.indexOf(rule.level) > order.indexOf(level)) {
      level = rule.level
      kind = rule.kind
    }
  }

  return { level, hits: [...new Set(hits)], kind }
}

export function isHighRisk(level: RiskLevel): boolean {
  return level === 'high'
}

export interface CrisisResource {
  name: string
  phone: string
  desc: string
  hours: string
  tag: '热线' | '机构' | '紧急'
}

export const CRISIS_RESOURCES: CrisisResource[] = [
  {
    name: '全国统一心理援助热线',
    phone: '12356',
    desc: '国家卫生健康委统一号码，由各地精神卫生中心承接，提供心理疏导与危机干预',
    hours: '24 小时',
    tag: '热线',
  },
  {
    name: '北京心理危机研究与干预中心',
    phone: '010-82951332',
    desc: '国内较早开展自杀干预的专业机构，提供危机干预热线服务',
    hours: '24 小时',
    tag: '热线',
  },
  {
    name: '紧急医疗与报警',
    phone: '120 / 110',
    desc: '如已出现即刻的人身危险、自伤行为或意识不清，请立即呼叫急救与警方',
    hours: '24 小时',
    tag: '紧急',
  },
  {
    name: '学校心理健康教育中心',
    phone: '校内预约',
    desc: '多数高校对本校学生免费且保密，可线上预约面谈，适合持续两周以上的情绪困扰',
    hours: '工作日',
    tag: '机构',
  },
]

export const SAFETY_STEPS = [
  '先把可能伤害自己的物品移开，或交给身边的人保管。',
  '给一个你信任的人打电话，让对方陪着你，哪怕只是待在同一个房间。',
  '拨打 12356，把现在的感受直接说出来，不需要组织语言。',
  '如果是紧急情况，立刻拨打 120 或 110，不要独自等待。',
]

/** 高危时追加给模型的系统约束 */
export const CRISIS_SYSTEM_NOTE = `【安全协议已触发】用户表达中出现了自伤/自杀相关信号。
你必须：
1) 先直接表达关心，承认对方的痛苦是真实的，不使用空洞的安慰或说教；
2) 明确询问当下的安全状况（现在是否安全、是否已有具体计划或手段、身边是否有人），一次只问一个；
3) 告知平台不能提供紧急救援，并明确给出求助渠道：全国统一心理援助热线 12356（24 小时）、如有即刻危险拨打 120/110、尽快联系学校心理中心或医院精神科；
4) 不进行诊断、不评判、不承诺保密例外之外的任何事；
5) 回复保持简短、稳定、具体，优先让用户与真人建立联系。

【固定话术基调（可自然调整措辞，但不要丢掉这些点）】
「我听到你现在痛苦到有伤害自己的想法，我很担心你。你的痛苦是真实的，但请一定不要伤害自己。我建议你立刻联系身边信任的人陪伴，或是拨打心理危机干预热线，寻求专业人员的紧急帮助，你值得被好好对待。」`
