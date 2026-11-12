/**
 * 岛屿日记 · 本地数据 + 反馈生成 + 日记卡片绘制
 *
 * 所有内容只存在浏览器 localStorage（按岛主命名空间隔离），不上传。
 * 卡片用 Canvas 程序化绘制，断网也能导出，不依赖任何外部图片接口。
 */

import { load, save } from './storage'
import { MOOD_META } from './mood'
import type { MoodScore } from './types'

export interface JournalEntry {
  id: string
  ts: number
  day: string
  text: string
  mood: MoodScore | null
  feedback: string
  mode: 'ai' | 'local'
  seed: number
}

export const JOURNAL_KEY = 'journal'

export function loadJournal(): JournalEntry[] {
  return load<JournalEntry[]>(JOURNAL_KEY, [])
}

export function saveJournal(list: JournalEntry[]): void {
  save(JOURNAL_KEY, list.slice(0, 200))
}

export function dayOf(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)
}

export function seedOf(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

const pick = <T,>(arr: T[], seed: number, salt = 0): T => arr[(seed + salt * 53) % arr.length]

/** 把日记里的一小段摘出来，反馈才有"读过"的感觉 */
export function excerptOf(text: string, max = 18): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  const clause = clean.split(/[。！？!?\n]/).find((s) => s.trim().length > 3) ?? clean
  const s = clause.trim()
  return s.length > max ? `${s.slice(0, max)}…` : s
}

const LEADS = [
  '今天你在「{q}」这里停了一下。',
  '你写下了「{q}」，这句话值得被认真对待。',
  '「{q}」——能把它写出来，说明你已经在自己这边了。',
  '看到「{q}」这句，我大概能想象今天的分量。',
]

const OBSERVE_TOPIC: { test: RegExp; say: string[] }[] = [
  {
    test: /(别人|旁边的人|同学都|室友都|大家都|比较|比不过|落后)/,
    say: [
      '你提到了别人——比较一旦启动，"他的进度"很容易被当成"我的标准"。',
      '看到别人的节奏时，你好像会顺手给自己判一次分。',
    ],
  },
  {
    test: /(考试|复习|学习|成绩|绩点|考研|保研|作业|论文)/,
    say: [
      '你写的大多和"要做的事"有关，说明神经一直绷在任务上，休息时也没真正松下来。',
      '注意力被结果占满的时候，身体会先替你紧张；这不是意志力的问题。',
      '你在用"效率"给自己打分，但今天真正缺的可能是休息，不是方法。',
    ],
  },
  {
    test: /(室友|朋友|同学|爸妈|父母|家里|他们|对象|分手|吵)/,
    say: [
      '今天耗掉你力气的，更多是人和人之间的那部分，而不是事情本身。',
      '你在意别人的反应，这通常意味着你也很在意关系里的位置。',
      '有些话没说出口，就一直在心里重复消耗。',
    ],
  },
  {
    test: /(累|困|睡不着|失眠|头疼|没力气|麻木)/,
    say: [
      '身体先替你报了警：累到一定程度，情绪会变钝，这不是你变冷漠了。',
      '睡眠和精力是底层的，不补上，方法都用不出来。',
      '今天硬撑的部分，明天可能要还。',
    ],
  },
  {
    test: /(没用|废物|讨厌自己|自卑|我这个人|我很差|不配|一无是处)/,
    say: [
      '你对自己的语气有点重，比你对朋友说话重得多。',
      '自我批评短期像鞭子，长期只会抬高下一次的难度。',
      '把"这件事没做好"写成"我不行"，这两句差别其实很大。',
    ],
  },
]

const OBSERVE_PLAIN = [
  '你今天的状态不算好，但你在留意它——这本身就是一种照顾。',
  '能写得这么具体，说明你不是在情绪里打转，而是在观察它。',
  '这段文字里有疲惫，也有一点想往前走的力气。',
]

const NUDGES: { test: RegExp; say: string[] }[] = [
  {
    test: /(刷手机|短视频|手机|拖延|坐不住|效率低|看不进)/,
    say: [
      '今晚别复盘"又刷了多久"，那只会让明天更难开始；把手机放到伸手够不到的地方，就算赢一次。',
      '给明天设一个"只做 10 分钟"的开关：坐下、打开书、计时，铃响就允许自己停。',
    ],
  },
  {
    test: /(别人|旁边的人|比较|比不过|落后)/,
    say: [
      '明天只和自己昨天的进度比一次，具体到"多做了几道题"，别用别人的页数当尺子。',
      '把"我是不是方法不对"变成一个可验证的小实验：换一种复习方式做 25 分钟，看有没有更容易进去。',
    ],
  },
  {
    test: /(考试|复习|学习|成绩|考研)/,
    say: [
      '今晚可以只定一件事：明天的第一个 20 分钟做什么，写具体到"第几页"。',
      '把"必须复习完"换成"今晚 20 分钟只碰一科"，剩下的明天再说。',
    ],
  },
  {
    test: /(累|困|睡不着|失眠)/,
    say: [
      '今晚试着把手机放到够不到的地方，给自己留 20 分钟暗下来的时间。',
      '睡前不要复盘今天没做完的事，留到明天早上写。',
    ],
  },
  {
    test: /(室友|朋友|同学|爸妈|父母|家里|对象|分手)/,
    say: [
      '如果还有话没说，可以先写在这里，不一定要发出去；写完再决定。',
      '给这件事设一个"今天先不想"的边界，明天情绪落下去再说。',
    ],
  },
]

const NUDGE_PLAIN = [
  '现在做一件 2 分钟能完成的小事：喝口水、拉开窗帘、把桌子上的东西归位。',
  '给明天留一句便条，只写一件事，不写清单。',
  '今晚不必想明白全部，先把这一页合上。',
]

const TONE_NOTE: { test: RegExp; say: string }[] = [
  { test: /(开心|轻松|不错|好多了|顺利|有进步)/, say: '今天有亮的部分，别急着跳过它。' },
  { test: /(焦虑|紧张|慌|怕)/, say: '焦虑在提醒你这件事重要，不是提醒你不行。' },
  { test: /(难过|想哭|委屈|低落)/, say: '难过不需要理由充分才成立。' },
  { test: /(生气|烦|讨厌|受够)/, say: '生气往往说明有条边界被越过了。' },
]

/** 没配 Key 时的本地反馈：读内容、说观察、给一件小事 */
export function localFeedback(text: string, mood: MoodScore | null): string {
  const seed = seedOf(text)
  const q = excerptOf(text)
  const lead = pick(LEADS, seed).replace('{q}', q)
  const topic = OBSERVE_TOPIC.find((t) => t.test.test(text))
  const observe = topic ? pick(topic.say, seed, 1) : pick(OBSERVE_PLAIN, seed, 1)
  const nudgeSrc = NUDGES.find((t) => t.test.test(text))
  const nudge = nudgeSrc ? pick(nudgeSrc.say, seed, 2) : pick(NUDGE_PLAIN, seed, 2)
  const tone = TONE_NOTE.find((t) => t.test.test(text))?.say ?? ''
  const negative = /(难过|想哭|委屈|低落|后悔|累|烦|不想|失败|差|慌|怕|焦虑|压)/.test(text)
  const moodLine =
    mood == null
      ? ''
      : mood <= 2
        ? '今天的潮位偏低，这种日子不用要求自己高效。'
        : mood >= 4 && !negative
          ? '今天的潮位其实不差，说明你不是一直都沉在下面。'
          : ''

  return [lead, [observe, tone, moodLine].filter(Boolean).join(''), nudge].filter(Boolean).join('\n\n')
}

export const JOURNAL_SYSTEM = `你是"清绪之屿"的岛屿向导，正在回应一位学生刚写完的日记。
规则：
1. 先用一句话回应他写下的具体内容（可以引用他自己的词），证明你读懂了，不要泛泛共情。
2. 再给一个观察：他可能没意识到的模式、身体信号或自我对话方式。温和但不含糊。
3. 最后给一件今天/今晚就能做的小事，具体到动作，不要列清单。
4. 全文 120-200 字，不要 Markdown 标题，不要分点超过两条，不要说教，不要用"作为AI"。
5. 如果内容涉及自伤、自杀或严重危机，先明确表达关心，再提醒可拨打 12356（24 小时），语气要稳。
6. 不要复述整段日记，不要评价文笔。`

/* ────────────────── 卡片绘制 ────────────────── */

const FONT_SERIF = '"Songti SC", "Source Han Serif SC", "PingFang SC", "Microsoft YaHei", serif'
const FONT_SANS = '"PingFang SC", "Microsoft YaHei", -apple-system, sans-serif'

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    if (!para.trim()) {
      lines.push('')
      continue
    }
    let line = ''
    for (const ch of para) {
      const test = line + ch
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line)
        line = ch
      } else {
        line = test
      }
    }
    if (line) lines.push(line)
  }
  return lines
}

function corners(ctx: CanvasRenderingContext2D, w: number, h: number, inset: number, color: string) {
  const L = 26
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  const pts: [number, number, number, number][] = [
    [inset, inset, 1, 1],
    [w - inset, inset, -1, 1],
    [inset, h - inset, 1, -1],
    [w - inset, h - inset, -1, -1],
  ]
  for (const [x, y, dx, dy] of pts) {
    ctx.beginPath()
    ctx.moveTo(x + dx * L, y)
    ctx.lineTo(x, y)
    ctx.lineTo(x, y + dy * L)
    ctx.stroke()
  }
}

function islandSilhouette(ctx: CanvasRenderingContext2D, cx: number, baseY: number, w: number, h: number, fill: string) {
  ctx.beginPath()
  ctx.moveTo(cx - w / 2, baseY)
  ctx.bezierCurveTo(cx - w * 0.34, baseY - h * 1.05, cx - w * 0.1, baseY - h * 1.24, cx, baseY - h * 1.24)
  ctx.bezierCurveTo(cx + w * 0.12, baseY - h * 1.24, cx + w * 0.36, baseY - h * 1.0, cx + w / 2, baseY)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
}

export interface CardOptions {
  width?: number
  height?: number
  nickname?: string
}

/** 画一张"今日一页"卡片：1080×1350，可直接保存分享 */
export function renderJournalCard(canvas: HTMLCanvasElement, entry: JournalEntry, opt: CardOptions = {}): void {
  const W = opt.width ?? 1080
  const H = opt.height ?? 1350
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const mood = entry.mood ?? 3
  const accent = MOOD_META[mood]?.color ?? '#66b2c3'
  const d = new Date(entry.ts)
  const dateStr = `${d.getFullYear()} · ${String(d.getMonth() + 1).padStart(2, '0')} · ${String(d.getDate()).padStart(2, '0')}`
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
  const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

  // 背景：纸张感的暖白 + 顶部情绪色晕
  ctx.fillStyle = '#fdfbf6'
  ctx.fillRect(0, 0, W, H)

  const glow = ctx.createRadialGradient(W * 0.78, H * 0.06, 0, W * 0.78, H * 0.06, W * 0.9)
  glow.addColorStop(0, `${accent}24`)
  glow.addColorStop(0.45, `${accent}0d`)
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  const cool = ctx.createRadialGradient(W * 0.12, H * 0.95, 0, W * 0.12, H * 0.95, W * 0.75)
  cool.addColorStop(0, 'rgba(169,155,224,0.16)')
  cool.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = cool
  ctx.fillRect(0, 0, W, H)

  corners(ctx, W, H, 48, 'rgba(74,151,170,0.35)')

  // 顶部：日期 + 心情
  ctx.fillStyle = 'rgba(58,123,141,0.75)'
  ctx.font = `500 24px ${FONT_SANS}`
  ctx.textAlign = 'left'
  ctx.fillText('ISLAND JOURNAL', 104, 132)

  ctx.fillStyle = '#1e2a33'
  ctx.font = `600 46px ${FONT_SERIF}`
  ctx.fillText(dateStr, 104, 196)

  ctx.fillStyle = 'rgba(95,114,128,0.85)'
  ctx.font = `400 24px ${FONT_SANS}`
  ctx.fillText(`${week} · ${timeStr} · ${MOOD_META[mood].label}`, 104, 240)

  // 心情色点
  ctx.beginPath()
  ctx.arc(W - 148, 176, 46, 0, Math.PI * 2)
  ctx.fillStyle = `${accent}26`
  ctx.fill()
  ctx.beginPath()
  ctx.arc(W - 148, 176, 20, 0, Math.PI * 2)
  ctx.fillStyle = accent
  ctx.fill()

  // 分隔线
  ctx.strokeStyle = 'rgba(58,123,141,0.18)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(104, 296)
  ctx.lineTo(W - 104, 296)
  ctx.stroke()

  // 正文：按长度调字号，最多 12 行
  const body = entry.text.trim() || '（这一页没有写字）'
  const contentW = W - 208
  let font = 40
  let lines: string[] = []
  for (const size of [40, 37, 34, 31, 28, 26]) {
    font = size
    ctx.font = `400 ${size}px ${FONT_SERIF}`
    lines = wrap(ctx, body, contentW)
    if (lines.length <= 10) break
  }
  const shown = lines.slice(0, 10)
  if (lines.length > 10) shown[9] = `${shown[9].slice(0, -1)}…`

  ctx.fillStyle = '#2b3b45'
  ctx.textAlign = 'left'
  const lineH = font * 1.78
  shown.forEach((line, i) => {
    ctx.fillText(line, 104, 386 + i * lineH)
  })

  const bodyBottom = 386 + Math.max(shown.length, 1) * lineH

  // 反馈摘句：优先取"观察"那一段，比"引述 + 评价"更适合印在卡片上
  const parts = entry.feedback.split('\n').map((s) => s.trim()).filter(Boolean)
  const fbSource = parts[1] ?? parts[0] ?? ''
  const fbText = fbSource.length > 58 ? `${fbSource.slice(0, 58)}…` : fbSource
  const feedbackLines = wrap(ctx, fbText, contentW - 84).slice(0, 3)
  const fbTop = Math.max(bodyBottom + 56, H - 430)
  const fbH = 34 + feedbackLines.length * 42

  ctx.fillStyle = 'rgba(74,151,170,0.07)'
  ctx.beginPath()
  ctx.roundRect(104, fbTop, contentW, fbH, 22)
  ctx.fill()

  ctx.fillStyle = accent
  ctx.fillRect(104, fbTop + 20, 3, fbH - 40)

  ctx.fillStyle = 'rgba(58,90,104,0.92)'
  ctx.font = `400 26px ${FONT_SANS}`
  feedbackLines.forEach((line, i) => {
    ctx.fillText(line, 136, fbTop + 52 + i * 42)
  })

  // 底部：岛与落款
  islandSilhouette(ctx, W - 186, H - 196, 210, 90, 'rgba(102,178,195,0.26)')
  islandSilhouette(ctx, W - 210, H - 196, 148, 62, 'rgba(169,155,224,0.28)')

  ctx.fillStyle = 'rgba(95,114,128,0.7)'
  ctx.font = `400 24px ${FONT_SERIF}`
  ctx.fillText('停泊情绪风浪，从容奔赴考场', 104, H - 150)

  ctx.fillStyle = 'rgba(143,161,173,0.9)'
  ctx.font = `400 19px ${FONT_SANS}`
  ctx.fillText('SERENE ISLE · 清绪之屿', 104, H - 104)

  if (opt.nickname) {
    ctx.textAlign = 'right'
    ctx.fillStyle = 'rgba(58,123,141,0.8)'
    ctx.font = `400 22px ${FONT_SERIF}`
    ctx.fillText(`—— ${opt.nickname}`, W - 104, H - 104)
  }

  // 颗粒
  const grit = ctx.getImageData(0, 0, W, H)
  const data = grit.data
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 7
    data[i] += n
    data[i + 1] += n
    data[i + 2] += n
  }
  ctx.putImageData(grit, 0, 0)
}

/** 直接下载为 PNG */
export function downloadJournalCard(entry: JournalEntry, nickname?: string): void {
  const canvas = document.createElement('canvas')
  renderJournalCard(canvas, entry, { nickname })
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `清绪之屿-日记-${entry.day}.png`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }, 'image/png')
}

/** 卡片预览（供 <img> 使用） */
export function journalCardUrl(entry: JournalEntry, nickname?: string): string {
  const canvas = document.createElement('canvas')
  renderJournalCard(canvas, entry, { nickname })
  return canvas.toDataURL('image/png')
}
