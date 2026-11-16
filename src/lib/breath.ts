/**
 * 潮汐呼吸 · 状态识别 → 方案 → 实时调整 → 报告
 *
 * 设计原则：模型负责「听懂」，规则负责「决策」。
 * 状态识别可以由大模型做（更宽容），但把状态映射成节奏、时长、
 * 以及在用户说「太急了 / 头晕」时怎么改，都在本地用可解释的规则算，
 * 这样断网也能用，评审也能追问每一步为什么。
 */

import type { BreathingPattern } from './types'

/* ── 状态 ─────────────────────────────────────────────── */

export type BreathState = 'anxious' | 'tense' | 'irritable' | 'exhausted' | 'insomnia' | 'unknown'

export const STATE_META: Record<
  BreathState,
  { label: string; en: string; color: string; soft: string; bloom: string; note: string }
> = {
  anxious: {
    label: '焦虑',
    en: 'Anxious',
    color: '#4a97aa',
    soft: 'rgba(148,205,217,0.26)',
    bloom: '#bfe2ea',
    note: '身体先被拉响了警报：心跳快、手心出汗、呼吸浅。',
  },
  tense: {
    label: '紧张',
    en: 'Tense',
    color: '#8f7ed2',
    soft: 'rgba(169,155,224,0.24)',
    bloom: '#dcd5f5',
    note: '注意力被「等一下要发生的事」占满了，人还坐在这里。',
  },
  irritable: {
    label: '烦躁',
    en: 'Irritable',
    color: '#e37f69',
    soft: 'rgba(246,182,166,0.28)',
    bloom: '#f6b6a6',
    note: '胸口发闷、想发火又压着，呼吸容易卡在中间。',
  },
  exhausted: {
    label: '疲惫',
    en: 'Drained',
    color: '#a8a08a',
    soft: 'rgba(243,230,203,0.5)',
    bloom: '#f3e6cb',
    note: '不是困，是「撑太久了」的那种空。',
  },
  insomnia: {
    label: '失眠',
    en: 'Sleepless',
    color: '#6f6bb0',
    soft: 'rgba(196,185,236,0.26)',
    bloom: '#c4b9ec',
    note: '身体躺下了，脑子还在开会。',
  },
  unknown: {
    label: '说不太清',
    en: 'Unnamed',
    color: '#8fa1ad',
    soft: 'rgba(143,161,173,0.2)',
    bloom: '#dbe4e9',
    note: '说不太清也是一种状态，先给身体一个稳定的节奏。',
  },
}

const LEXICON: { state: BreathState; words: string[] }[] = [
  {
    state: 'anxious',
    words: [
      '慌', '心慌', '心跳', '心悸', '发抖', '手抖', '出汗', '喘不上', '喘不过', '呼吸急', '害怕',
      '恐惧', '担心', '不安', '坐立不安', '胸口紧', '发麻', '受不了了',
    ],
  },
  {
    state: 'insomnia',
    words: ['睡不着', '失眠', '躺下', '脑子停不下来', '半夜', '早醒', '翻来覆去', '入睡', '醒了好几次', '凌晨'],
  },
  {
    state: 'irritable',
    words: ['烦', '烦躁', '生气', '火大', '吵', '吵架', '怒', '憋屈', '胸口闷', '想摔', '看不下去', '忍不了', '委屈'],
  },
  {
    state: 'exhausted',
    words: ['累', '疲惫', '撑不住', '没力气', '提不起', '不想动', '麻木', '空的', '熬夜', '耗光', '好困'],
  },
  {
    state: 'tense',
    words: ['考试', '面试', '上台', '汇报', '答辩', '截止', 'deadline', '明天', '静不下来', '集中不了', '紧张', '绷', '赶不', '复习', '挂科'],
  },
]

/** 强度词：出现即可判断「这一次来得比较猛」 */
const INTENSITY_WORDS = ['很', '太', '特别', '非常', '超级', '已经', '快撑', '受不了', '一直', '整晚']

export interface Detection {
  state: BreathState
  /** 1–5，用于调整引导语与时长 */
  intensity: number
  /** 命中的词，展示给用户看「我是根据这些判断的」 */
  hits: string[]
  /** 关键词命中的粗略置信度 0–1 */
  confidence: number
}

/**
 * 本地情绪识别：关键词打分 + 强度词。
 * 冲突时按「身体反应优先」排序（焦虑 > 失眠 > 烦躁 > 疲惫 > 紧张），
 * 因为身体信号最能决定这一次该用哪种呼吸。
 */
export function detectState(text: string): Detection {
  const raw = (text || '').trim()
  if (!raw) return { state: 'unknown', intensity: 2, hits: [], confidence: 0 }

  const hits: string[] = []
  const score: Record<BreathState, number> = {
    anxious: 0,
    tense: 0,
    irritable: 0,
    exhausted: 0,
    insomnia: 0,
    unknown: 0,
  }

  for (const group of LEXICON) {
    for (const w of group.words) {
      if (!raw.includes(w)) continue
      // 长词更具指向性，给更高权重
      score[group.state] += w.length >= 3 ? 1.4 : 1
      if (!hits.includes(w)) hits.push(w)
    }
  }

  const order: BreathState[] = ['anxious', 'insomnia', 'irritable', 'exhausted', 'tense']
  let best: BreathState = 'unknown'
  let bestScore = 0
  for (const s of order) {
    if (score[s] > bestScore) {
      bestScore = score[s]
      best = s
    }
  }

  const booster = INTENSITY_WORDS.filter((w) => raw.includes(w)).length
  const intensity = Math.max(1, Math.min(5, Math.round(2 + bestScore * 0.55 + booster * 0.4)))

  return {
    state: bestScore > 0 ? best : 'unknown',
    intensity,
    hits: hits.slice(0, 5),
    confidence: bestScore === 0 ? 0 : Math.min(1, bestScore / 3),
  }
}

/* ── 方案 ─────────────────────────────────────────────── */

export type RhythmKey = 'long-exhale' | 'even' | 'gentle'

export const RHYTHM_LABEL: Record<RhythmKey, string> = {
  'long-exhale': '呼气拉长',
  even: '稳定等长',
  gentle: '温和不憋气',
}

export interface BreathSpec {
  inhale: number
  hold: number
  exhale: number
  holdAfter?: number
}

export interface BreathPlan {
  /** 节奏签名，如 4-4-8，用于统计「常用呼吸法」 */
  key: string
  name: string
  state: BreathState
  spec: BreathSpec
  /** 秒 */
  target: number
  rhythm: RhythmKey
  /** 练习时的一句话重点 */
  focus: string
  /** 为什么推荐，给用户看 */
  reason: string
  /** 来自用户画像的适配说明（如果有） */
  adapted?: string
}

const BASE: Record<BreathState, Omit<BreathPlan, 'state' | 'adapted'>> = {
  anxious: {
    key: '4-4-8',
    name: '4-4-8 长呼',
    spec: { inhale: 4, hold: 4, exhale: 8 },
    target: 180,
    rhythm: 'long-exhale',
    focus: '呼气放到最慢，屏息只留 4 秒——觉得憋就跳过它',
    reason:
      '心跳快的时候，交感神经处在高位。把呼气拉长到吸气的两倍，是让心率最快落下来的方式；屏息只留 4 秒，是因为憋气本身会让心慌的人更慌。',
  },
  tense: {
    key: '4-7-8',
    name: '4-7-8 潮汐呼吸',
    spec: { inhale: 4, hold: 7, exhale: 8 },
    target: 180,
    rhythm: 'long-exhale',
    focus: '数字不用精确，只要呼气比吸气长',
    reason:
      '考前紧张是「预期性」的，注意力一直在未来。4-7-8 的屏息段会强迫注意力回到身体内部，三轮之后通常就能感觉到肩膀落下来。',
  },
  irritable: {
    key: '4-2-6',
    name: '4-2-6 缓降',
    spec: { inhale: 4, hold: 2, exhale: 6 },
    target: 120,
    rhythm: 'long-exhale',
    focus: '呼气像叹气一样松开喉咙，别用力压',
    reason:
      '烦躁时胸口本来就紧，长屏息只会更闷。这里只留 2 秒过渡，把重点放在「叹出去」的那 6 秒上。',
  },
  exhausted: {
    key: '4-6',
    name: '4-6 轻呼吸',
    spec: { inhale: 4, hold: 0, exhale: 6 },
    target: 120,
    rhythm: 'gentle',
    focus: '不追深度，只是让呼吸比刚才慢一点',
    reason:
      '疲惫的时候不适合练长屏息——那会更耗。做法是不要屏息、不要深呼吸，只把呼气稍微延长，让身体从「撑住」切到「可以放下」。',
  },
  insomnia: {
    key: '4-7-8',
    name: '4-7-8 睡前版',
    spec: { inhale: 4, hold: 7, exhale: 8 },
    target: 300,
    rhythm: 'long-exhale',
    focus: '做完就躺着，不用逼自己睡着',
    reason:
      '躺下后脑子开会，是入睡前的「清醒窗口」还没关。4-7-8 加长版会把呼吸频率压到接近每分钟 6 次，多数人在 5 分钟内会开始打哈欠——打哈欠就是起效了，不用再撑。',
  },
  unknown: {
    key: '3-4-6',
    name: '3-4-6 温和',
    spec: { inhale: 3, hold: 4, exhale: 6 },
    target: 120,
    rhythm: 'gentle',
    focus: '先跟上节奏，别的都不用管',
    reason:
      '描述不太具体时，先从最不容易出错的节奏开始：吸 3 秒很短，屏 4 秒不难受，呼 6 秒刚好比吸气长。练完再决定要不要换。',
  },
}

/** 节奏签名：4-7-8；没有屏息时就只写「吸-呼」，避免出现 4-0-8 这种读不懂的名字 */
/** 去掉屏息后，推荐理由要跟着改——不能嘴上说「不屏息」，理由里还留着屏息 */
const NO_HOLD_REASON: Record<BreathState, string> = {
  anxious:
    '心跳快的时候，交感神经处在高位，把呼气拉长到吸气的两倍，是让心率最快落下来的方式。你之前屏息会头晕，所以这次全程不屏息，只走吸 4、呼 8 的慢呼吸。',
  tense:
    '4-7-8 里的屏息本来是为了把注意力拉回身体，但屏息会让你不舒服，所以这次只留吸 4、呼 8——呼气比吸气长，一样能把人从「等下的考试」里拉回来。',
  irritable:
    '烦躁时胸口本来就紧，屏息只会更闷。这组不屏息，只把呼气放到 6 秒以上，重点是「叹出去」的那一段。',
  exhausted:
    '疲惫的时候不适合练屏息，那会更耗。这组只做慢呼吸：吸 4、呼 6 以上，不深吸、不憋气，让身体从「撑住」切到「可以放下」。',
  insomnia:
    '睡前这组去掉了屏息，改成吸 4、呼 8。对容易头晕的人，长呼气同样有效，而且更容易做着做着就困了。',
  unknown: '先从最不容易出错的节奏开始：吸气短一点，呼气长一点，全程不屏息。练完再决定要不要换。',
}

const nameOfSpec = (spec: BreathSpec) =>
  [spec.inhale, spec.hold > 0 ? spec.hold : null, spec.exhale, spec.holdAfter ? spec.holdAfter : null]
    .filter((v): v is number => v !== null)
    .join('-')

/**
 * 生成方案。用户画像会在这里生效：
 * 易头晕 → 去掉屏息；偏好更慢 → 呼气加 1 秒。
 */
export function planFor(state: BreathState, profile?: { holdAversion?: boolean; pace?: '偏快' | '偏慢' | '温和' } | null): BreathPlan {
  const base = BASE[state]
  const plan: BreathPlan = { ...base, spec: { ...base.spec }, state }
  const notes: string[] = []

  if (profile?.holdAversion && plan.spec.hold > 0) {
    plan.spec = { ...plan.spec, hold: 0, holdAfter: 0 }
    plan.name = `${nameOfSpec(plan.spec)} 不屏息`
    plan.key = nameOfSpec(plan.spec)
    plan.rhythm = 'gentle'
    plan.focus = '全程不屏息，只做慢呼吸'
    plan.reason = NO_HOLD_REASON[state]
    notes.push('你之前练完有点头晕，这次已经把屏息全部去掉了。')
  }

  if (profile?.pace === '偏慢' && plan.spec.exhale < 10) {
    plan.spec = { ...plan.spec, exhale: plan.spec.exhale + 1 }
    plan.key = nameOfSpec(plan.spec)
    notes.push(`上次你说节奏偏快，呼气已经为你放慢到 ${plan.spec.exhale} 秒。`)
  }

  if (notes.length) plan.adapted = notes.join(' ')
  return plan
}

/** 把方案翻成页面已有的呼吸节奏类型，供计时与画布复用 */
export function toPattern(plan: BreathPlan): BreathingPattern {
  return {
    id: 'coherent',
    name: plan.name,
    inhale: plan.spec.inhale,
    hold: plan.spec.hold,
    exhale: plan.spec.exhale,
    holdAfter: plan.spec.holdAfter,
    desc: plan.reason,
  }
}

export const describeSpec = (spec: BreathSpec) =>
  [
    `吸 ${spec.inhale}`,
    spec.hold > 0 ? `屏 ${spec.hold}` : null,
    `呼 ${spec.exhale}`,
    spec.holdAfter ? `停 ${spec.holdAfter}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

export const cycleSeconds = (spec: BreathSpec) =>
  spec.inhale + spec.hold + spec.exhale + (spec.holdAfter ?? 0)

/* ── 实时反馈与调整 ───────────────────────────────────── */

export type FeedbackKind = 'fast' | 'behind' | 'dizzy' | 'steady'

export const FEEDBACK_META: Record<FeedbackKind, { label: string; reply: string; tone: 'warn' | 'ok' }> = {
  fast: { label: '太急了', reply: '好，我把呼气再拉长一点', tone: 'warn' },
  behind: { label: '跟不上', reply: '好，节奏整体调短一点', tone: 'warn' },
  dizzy: { label: '有点头晕', reply: '已经把屏息全部取消', tone: 'warn' },
  steady: { label: '继续保持', reply: '很好，就停在这个节奏', tone: 'ok' },
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/**
 * 根据反馈调整方案。同一个反馈在本次练习里出现多次时，调整幅度会加大：
 * 第一次「太急」只拉长呼气，第二次才开始砍屏息，第三次直接换成 3-4-6。
 */
export function applyFeedback(
  plan: BreathPlan,
  kind: FeedbackKind,
  counts: { fast: number; behind: number; dizzy: number },
  elapsed: number,
): { plan: BreathPlan; note: string; safety?: string } {
  const spec = { ...plan.spec }
  let name = plan.name
  let focus = plan.focus
  let rhythm = plan.rhythm
  let target = plan.target
  let note = FEEDBACK_META[kind].reply
  let safety: string | undefined

  if (kind === 'fast') {
    const alreadyGentle = spec.inhale === 3 && spec.hold === 0 && spec.exhale === 6
    if (counts.fast >= 1 && !alreadyGentle) {
      // 连续两次「太急」→ 直接换成最温和的一组，不再一点点试
      spec.inhale = 3
      spec.hold = 0
      spec.holdAfter = 0
      spec.exhale = 6
      name = '3-4-6 柔和模式'
      rhythm = 'gentle'
      focus = '换成最温和的一组，不屏息、不追深度'
      target = Math.min(target, Math.max(60, Math.round(elapsed) + 90))
      note = '已经换成 3-4-6 柔和模式：不屏息，呼气 6 秒，跟得上就行'
    } else if (alreadyGentle) {
      note = '现在就是最温和的一组了，跟着自己的节奏，不用追'
    } else if (spec.hold > 0) {
      spec.hold = clamp(spec.hold - 2, 0, 10)
      spec.holdAfter = spec.holdAfter ? clamp(spec.holdAfter - 2, 0, 10) : spec.holdAfter
      spec.exhale = clamp(spec.exhale + 1, 4, 10)
      name = nameOfSpec(spec)
      note = `屏息缩到 ${spec.hold} 秒，呼气放到 ${spec.exhale} 秒`
    } else {
      spec.exhale = clamp(spec.exhale + 1, 4, 10)
      name = nameOfSpec(spec)
      note = `呼气再慢一点，现在是 ${spec.exhale} 秒`
    }
  }

  if (kind === 'behind') {
    spec.inhale = clamp(spec.inhale - 1, 3, 8)
    spec.hold = clamp(spec.hold - 2, 0, 10)
    spec.holdAfter = spec.holdAfter ? clamp(spec.holdAfter - 2, 0, 10) : spec.holdAfter
    spec.exhale = clamp(spec.exhale - 1, 4, 10)
    name = nameOfSpec(spec)
    note = `整组缩短到 ${describeSpec(spec)}，先跟得上再谈深`
  }

  if (kind === 'dizzy') {
    spec.hold = 0
    spec.holdAfter = 0
    spec.inhale = 4
    spec.exhale = 6
    name = '4-6 不屏息'
    rhythm = 'gentle'
    focus = '只做慢呼吸，不屏息、不深吸'
    target = Math.min(target, Math.max(60, Math.round(elapsed) + 90))
    note = '屏息已全部取消，改成 4-6 慢呼吸。如果还晕，先停下来坐着'
    safety = '头晕、手麻通常是过度换气。停一下，正常呼吸，别继续深呼吸；持续不适请告诉身边的人。'
  }

  return {
    plan: { ...plan, spec, name, focus, rhythm, target, key: nameOfSpec(spec) },
    note,
    safety,
  }
}

/* ── 练习结果与报告 ───────────────────────────────────── */

export interface BreathOutcome {
  plan: BreathPlan
  /** 实际练习秒数 */
  seconds: number
  target: number
  cycles: number
  feedbacks: FeedbackKind[]
  /** 中途退出 */
  endedEarly: boolean
}

export interface BreathReport {
  title: string
  state: BreathState
  planName: string
  minutes: number
  rhythm: RhythmKey
  lines: { label: string; value: string }[]
  advice: string[]
  postcard: { quote: string; sub: string }
}

/** 报告第二条建议：按状态给，不做诊断 */
const STATE_ADVICE: Record<BreathState, string> = {
  anxious: '如果心慌明显，优先选择 4-4-8 或 4-8——呼气比吸气长一倍，比屏息更安全。',
  tense: '考前那次别追求憋气，先建立稳定节奏；进考场前做 3 轮就够，不用凑满 3 分钟。',
  irritable: '烦躁上来时先呼出去，别急着讲道理——身体降下来，话才说得清。',
  exhausted: '疲惫时练完会更困，这是正常的。条件允许就接着睡 20 分钟，比硬撑划算。',
  insomnia: '睡前那次不要看时间，也不要检查自己「睡着了没有」——那会把清醒窗口重新打开。',
  unknown: '说不清的时候，先把节奏固定下来：吸短、呼长、不屏息，身体会替你找到感觉。',
}

export function buildReport(
  out: BreathOutcome,
  profile?: { total: number; dizzy: number; fast: number; streakDays: number } | null,
): BreathReport {
  const { plan } = out
  const minutes = Math.max(0.5, Math.round((out.seconds / 60) * 10) / 10)
  const dizzy = out.feedbacks.includes('dizzy')
  const fastCount = out.feedbacks.filter((f) => f === 'fast').length

  const advice: string[] = []
  if (dizzy) {
    advice.push('紧张时不要追求憋气，先建立稳定节奏。下次直接用不屏息的 4-6。')
    advice.push('如果你经常在练习中头晕，把时长控制在 2 分钟内，坐着练，别躺着。')
  } else if (fastCount >= 1) {
    advice.push(`你适合偏慢的呼气练习。${plan.name}这组可以固定下来，每天 2 次。`)
  } else if (out.endedEarly) {
    advice.push(
      `提前停下来也算一次。下次把时长调到 ${Math.max(1, Math.round(out.seconds / 60))} 分钟，先把「做完」这件事变得容易。`,
    )
  } else {
    advice.push(`${plan.name}这组对你有效，明天同一时间再做一次，身体会记得这个节奏。`)
  }

  // 第二条：与状态有关、今天就能用的一句话
  advice.push(STATE_ADVICE[plan.state])

  if (profile && profile.total >= 3) {
    advice.push(`这是你第 ${profile.total} 次呼吸练习${out.endedEarly ? '' : '并完成全程'}，岛主已经把这次的节奏记进你的呼吸档案。`)
  }

  return {
    title: out.endedEarly ? '先停在这里，也很好' : '这一次，身体降下来了',
    state: plan.state,
    planName: plan.name,
    minutes,
    rhythm: plan.rhythm,
    lines: [
      { label: '本次状态', value: STATE_META[plan.state].label },
      { label: '使用呼吸法', value: plan.name },
      { label: '练习时长', value: out.endedEarly ? `${minutes} 分钟（提前结束）` : `${minutes} 分钟` },
      { label: '完成循环', value: `${Math.max(out.cycles, 1)} 轮` },
      { label: '节奏特点', value: RHYTHM_LABEL[plan.rhythm] },
    ],
    advice: advice.slice(0, 3),
    postcard: {
      quote: out.endedEarly ? '停下来，也是在照顾自己。' : '呼气长一点，世界就慢一点。',
      sub: `${STATE_META[plan.state].label} · ${plan.name} · ${minutes} 分钟`,
    },
  }
}

/* ── 引导语 ───────────────────────────────────────────── */

export function openingLine(d: Detection, hasMemory: boolean): string {
  const meta = STATE_META[d.state]
  if (d.state === 'unknown') {
    return '嗯，说不清也没关系。我们先不谈原因，只把呼吸放慢一点，看看身体会不会松一格。'
  }
  const body = d.hits[0] ? `你提到「${d.hits[0]}」——` : ''
  const tail = hasMemory ? '这次我按你之前的记录调过了，你看看合不合适。' : '我给你配了一组，先试试看。'
  return `${body}听起来是${meta.label}。${meta.note}${tail}`
}

export const QUICK_STATES = [
  { id: 'anxious', text: '我现在有点慌，心跳很快' },
  { id: 'tense', text: '明天考试，静不下来' },
  { id: 'irritable', text: '刚吵完架，胸口闷' },
  { id: 'insomnia', text: '躺下很久，脑子停不下来' },
  { id: 'exhausted', text: '没发生什么，就是很累' },
] as const
