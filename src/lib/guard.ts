/**
 * AI 安全层（可解释、可兜底）
 *
 * 三层结构：
 *   1. 输入侧：风险分级（crisis.ts）+ 意图分类，高危时收紧人设与输出要求；
 *   2. 生成侧：system prompt 里写死"不诊断、不承诺、不替代真人"；
 *   3. 输出侧：本文件。模型说的话在落库前逐条过审，命中就本地改写，
 *      并把"审了几条、改了哪条"如实写进工作流面板 —— 让可控性可被看见，而不是口头承诺。
 *
 * 这里全部是本地规则，不额外调用模型、不产生费用。
 */

import type { RiskLevel } from './types'

export type GuardLevel = 'pass' | 'fixed' | 'blocked'

export interface GuardIssue {
  id: string
  label: string
  severity: 'low' | 'medium' | 'high'
}

export interface GuardReport {
  level: GuardLevel
  /** 本次一共执行了多少条检查 */
  checks: number
  issues: GuardIssue[]
  /** 回答与检索资料的重合度 0-1，用于判断"有没有真的用上资料" */
  grounded: number
}

/* ─────────────────────── 输出侧规则表 ─────────────────────── */

interface Rule {
  id: string
  label: string
  severity: GuardIssue['severity']
  test: RegExp
  /** 命中后的处理：drop=整句删掉，replace=改写，append=补一句 */
  fix: (text: string) => string
}

const SPLIT = /[^。！？\n]+[。！？]?/g

const sentences = (text: string): string[] => text.match(SPLIT) ?? [text]

/** 把命中的那几句换掉 / 删掉，其余原样保留 */
function rewriteSentences(text: string, test: RegExp, replacer: (s: string) => string): string {
  return sentences(text)
    .map((s) => (test.test(s) ? replacer(s) : s))
    .join('')
}

const SAFE_DIAGNOSIS = '这种状态值得被认真对待，但它是不是某种"症"，需要专业人士当面评估，我不做诊断。'

const RULES: Rule[] = [
  {
    id: 'diagnosis',
    label: '诊断性断言',
    severity: 'high',
    test: /(你|您)(已经)?(患|得|有)(了)?[^，。；！？]{0,10}(抑郁症|焦虑症|恐惧症|强迫症|双相|PTSD|进食障碍|精神分裂|惊恐障碍)/,
    fix: (t) => rewriteSentences(t, /(患|得)(了)?[^，。；！？]{0,10}(症|障碍)/, () => SAFE_DIAGNOSIS),
  },
  {
    id: 'certainty',
    label: '医疗承诺',
    severity: 'high',
    test: /(一定能治好|保证(你)?(会)?(好|康复)|彻底根治|包治|百分百(能)?好)/,
    fix: (t) =>
      rewriteSentences(
        t,
        /(一定能治好|保证(你)?(会)?(好|康复)|彻底根治|包治|百分百(能)?好)/,
        () => '能不能好转要看很多因素，但可以确定的是：现在做的这一小步不算白做。',
      ),
  },
  {
    id: 'dosage',
    label: '药物剂量建议',
    severity: 'high',
    test: /\d+(\.\d+)?\s*(mg|毫克|片|粒)/i,
    fix: (t) => rewriteSentences(t, /\d+(\.\d+)?\s*(mg|毫克|片|粒)/i, () => '用药相关的问题请交给开药的医生判断。'),
  },
  {
    id: 'role',
    label: '身份越界',
    severity: 'medium',
    test: /我是(一名)?(心理医生|精神科医生|执业咨询师|心理专家)/,
    fix: (t) => t.replace(/我是(一名)?(心理医生|精神科医生|执业咨询师|心理专家)/g, '我是岛主，一个陪你说话的 AI'),
  },
  {
    id: 'leak',
    label: '工具/协议泄漏',
    severity: 'medium',
    test: /(start_breathing|search_knowledge_base|open_anxiety_assessment|log_mood|get_mood_trend|create_study_plan|navigate_to)\s*\(|tool_calls|"function"\s*:/,
    fix: (t) =>
      t
        .replace(/[a-z_]+\((?:[^()]{0,80})\)/g, '')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/tool_calls|"function"\s*:/g, ''),
  },
  {
    id: 'opened',
    label: '谎称已打开界面',
    severity: 'medium',
    test: /(已经|已)(为你|帮你)?(打开|启动)(了)?(呼吸|引导|自评|面板)/,
    fix: (t) =>
      rewriteSentences(t, /(已经|已)(为你|帮你)?(打开|启动)(了)?/, () => '我可以帮你把引导面板打开，你点确认就行。'),
  },
]

/** 危机场景必须出现求助渠道，否则补一句（宁可多一句，也不能让人找不到出口） */
const CRISIS_CHANNELS = /(12356|120|110|热线|心理中心|精神科|告诉(身边|朋友|家人))/

const CRISIS_FALLBACK =
  '如果此刻真的很难熬，请打 12356（全国心理援助热线，24 小时），或者告诉身边任何一个人，让对方先陪着你。'

export interface GuardOptions {
  risk: RiskLevel
  /** 检索到的资料片段数，用于 groundedness */
  citationText: string
}

export interface GuardResult extends GuardReport {
  text: string
}

/** 中文二元组集合，用来算回答到底吸没吸收检索资料 */
function bigrams(s: string): Set<string> {
  const clean = s.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')
  const set = new Set<string>()
  for (let i = 0; i < clean.length - 1; i++) set.add(clean.slice(i, i + 2))
  return set
}

/** 回答对资料的覆盖率（0-1）：太低说明模型在自由发挥，面板里会标注"未使用资料" */
export function groundingScore(answer: string, citationText: string): number {
  if (!citationText.trim() || !answer.trim()) return 0
  const a = bigrams(answer)
  const c = bigrams(citationText)
  if (!a.size || !c.size) return 0
  let hit = 0
  for (const g of c) if (a.has(g)) hit++
  return Number(Math.min(1, hit / Math.max(12, c.size * 0.5)).toFixed(2))
}

/**
 * 输出审查：逐条过规则，命中就地改写；改写后再次检查危机渠道。
 */
export function guardOutput(raw: string, opts: GuardOptions): GuardResult {
  const issues: GuardIssue[] = []
  let text = raw.trim()

  if (!text) {
    return { text: '', level: 'blocked', checks: RULES.length + 2, issues: [{ id: 'empty', label: '空回答', severity: 'high' }], grounded: 0 }
  }

  for (const rule of RULES) {
    if (!rule.test.test(text)) continue
    const next = rule.fix(text).replace(/\n{3,}/g, '\n\n').trim()
    if (next !== text) {
      issues.push({ id: rule.id, label: rule.label, severity: rule.severity })
      text = next
    }
  }

  // 同一句话连续重复（模型偶发复读）
  const parts = sentences(text)
  let repeat = 0
  for (let i = 1; i < parts.length; i++) if (parts[i].trim() && parts[i].trim() === parts[i - 1].trim()) repeat++
  if (repeat >= 2) {
    const seen = new Set<string>()
    text = parts.filter((s) => {
      const k = s.trim()
      if (!k) return true
      if (seen.has(k)) return false
      seen.add(k)
      return true
    }).join('')
    issues.push({ id: 'repeat', label: '复读', severity: 'low' })
  }

  // 危机场景：必须给出口
  let checks = RULES.length + 1
  if ((opts.risk === 'high' || opts.risk === 'medium') && !CRISIS_CHANNELS.test(text)) {
    text = `${text}\n\n${CRISIS_FALLBACK}`
    issues.push({ id: 'crisis-channel', label: '补上求助渠道', severity: 'high' })
    checks++
  }

  // 高危时不接受"只有安慰、没有出口"的长篇
  if (opts.risk === 'high' && text.length > 400) {
    text = `${text.slice(0, 400).replace(/[，、；]$/, '')}…\n\n${CRISIS_FALLBACK}`
    issues.push({ id: 'crisis-length', label: '高危场景收敛篇幅', severity: 'medium' })
    checks++
  }

  const level: GuardLevel = !text ? 'blocked' : issues.length ? 'fixed' : 'pass'
  return { text, level, checks, issues, grounded: groundingScore(text, opts.citationText) }
}

/* ─────────────────────── 输入侧：意图分类 ─────────────────────── */

export type Intent =
  | 'crisis'
  | 'anxiety'
  | 'sleep'
  | 'study'
  | 'mood'
  | 'people'
  | 'smalltalk'
  | 'question'

const INTENT_RULES: [Intent, RegExp][] = [
  ['crisis', /(不想活|自杀|自残|活不下去|想死|结束生命|撑不下去|熬不下去|伤害自己)/],
  ['sleep', /(睡不着|失眠|早醒|躺下就清醒|做噩梦)/],
  ['anxiety', /(紧张|心慌|心跳|手抖|发抖|坐不住|喘不上气|惊恐|焦虑|压力大)/],
  ['study', /(复习|考试|作业|论文|刷题|成绩|挂科|绩点|考研|保研|时间不够|拖延)/],
  ['people', /(室友|舍友|朋友|同学|对象|分手|失恋|爸妈|父母|家里|孤立|排挤)/],
  ['mood', /(低落|难过|想哭|没兴趣|提不起|麻木|空落落|自责|没用|讨厌自己)/],
  ['smalltalk', /^(你好|您好|嗨|hi|hello|在吗|在不在|早|早上好|晚上好|谢谢|多谢|嗯+|哦+|好的?|行|可以|知道了|没事)[啊呀呢吧哦。，！!？?~～…]*$/i],
]

export const INTENT_LABEL: Record<Intent, string> = {
  crisis: '危机信号',
  anxiety: '焦虑与身体反应',
  sleep: '睡眠困扰',
  study: '学业压力',
  mood: '情绪低落',
  people: '人际与家庭',
  smalltalk: '寒暄',
  question: '开放提问',
}

export function classifyIntent(text: string): Intent {
  const t = text.replace(/\s/g, '')
  for (const [intent, re] of INTENT_RULES) if (re.test(t)) return intent
  return 'question'
}
