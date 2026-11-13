/**
 * 分享小屋 · 书墙数据层
 *
 * 这里的「书」不是知识条目，而是岛民自己写下的心事：
 * 一段倾诉、一个还没解开的困惑、一次没考好的模考、一句想对世界说的话。
 * 每本书有自己手作感的封面（底色 / 纹理 / 字体 / 贴纸 / 手绘），
 * 别人读完可以在内页贴一张便签，作为「暖心回复」。
 *
 * 隐私：所有内容只存在这台设备的浏览器里（localStorage，按岛主命名空间隔离），
 * 不上传服务器；「私密」的书只出现在自己的书架上。
 */

import { load, save } from './storage'

/* ────────────────────────── 类型 ────────────────────────── */

export type MoodKey = 'anxious' | 'tired' | 'lonely' | 'sad' | 'lost' | 'warm' | 'selfblame' | 'hope'

export type CoverBgKey = 'sand' | 'sea' | 'rose' | 'lav' | 'mint' | 'cream' | 'dusk' | 'peach' | 'night'

export type TextureKey = 'paper' | 'dots' | 'grid' | 'none'

export type FontKey = 'song' | 'kai' | 'round' | 'hand'

export interface Sticker {
  id: string
  glyph: string
  /** 0~1 的相对位置（贴纸中心） */
  x: number
  y: number
  /** 缩放倍数 */
  s: number
  /** 旋转角度 */
  r: number
}

export interface Stroke {
  /** 归一化点集，0~1 */
  pts: { x: number; y: number }[]
  color: string
  w: number
}

export interface BookCoverCfg {
  bg: CoverBgKey
  texture: TextureKey
  font: FontKey
  stickers: Sticker[]
  strokes: Stroke[]
}

export interface Reply {
  id: string
  bookId: string
  author: string
  authorId: string
  content: string
  color: number
  createdAt: number
}

export interface Book {
  id: string
  authorId: string
  author: string
  title: string
  mood: MoodKey
  content: string
  cover: BookCoverCfg
  visibility: 'public' | 'private'
  createdAt: number
  replies: Reply[]
  /** 种子书标记：不是本地岛民写的，用来把书墙填得有温度 */
  seed?: boolean
}

export type SortKey = 'new' | 'old' | 'notes'

/* ────────────────────────── 情绪 ────────────────────────── */

export const MOOD_KEYS: MoodKey[] = ['anxious', 'tired', 'lonely', 'sad', 'lost', 'warm', 'selfblame', 'hope']

export const MOODS: Record<MoodKey, { label: string; bg: CoverBgKey; tag: string; dot: string; hint: string }> = {
  anxious: {
    label: '焦虑',
    bg: 'sea',
    tag: 'bg-sea-100/90 text-sea-700',
    dot: '#94cdd9',
    hint: '心里一直有根弦绷着',
  },
  tired: {
    label: '疲惫',
    bg: 'sand',
    tag: 'bg-sand-100 text-[#a8895c]',
    dot: '#e2cba4',
    hint: '好像很久没有真正休息过',
  },
  lonely: {
    label: '孤独',
    bg: 'lav',
    tag: 'bg-lav-100 text-[#7c6bb8]',
    dot: '#c4b9ec',
    hint: '在人群里也觉得没人看见我',
  },
  sad: {
    label: '难过',
    bg: 'rose',
    tag: 'bg-[#fbe7e4] text-[#c2634f]',
    dot: '#f6b6a6',
    hint: '有件事一直堵在胸口',
  },
  lost: {
    label: '迷茫',
    bg: 'mint',
    tag: 'bg-[#e6f2e8] text-[#5d8a6b]',
    dot: '#b7d8c0',
    hint: '不知道下一步该往哪走',
  },
  warm: {
    label: '温暖',
    bg: 'cream',
    tag: 'bg-[#fdf1e3] text-[#b9814f]',
    dot: '#f3c98b',
    hint: '今天有一点点小确幸',
  },
  selfblame: {
    label: '自责',
    bg: 'dusk',
    tag: 'bg-[#e8eef2] text-[#5c7a8c]',
    dot: '#a9c1cf',
    hint: '一直在怪自己',
  },
  hope: {
    label: '期待',
    bg: 'peach',
    tag: 'bg-[#f9e9f1] text-[#b46a92]',
    dot: '#ecc0d6',
    hint: '还想再试一次',
  },
}

/* ────────────────────────── 封面素材 ────────────────────────── */

export const COVER_BGS: Record<CoverBgKey, { label: string; from: string; to: string; ink: string }> = {
  sand: { label: '暖米', from: '#fdf5e6', to: '#f4e4c6', ink: '#6b5335' },
  sea: { label: '浅蓝', from: '#eef8fa', to: '#cde6ed', ink: '#2f6b7b' },
  rose: { label: '淡粉', from: '#fdf1ed', to: '#f7dad2', ink: '#a45a49' },
  lav: { label: '雾紫', from: '#f5f2fd', to: '#ded5f6', ink: '#655399' },
  mint: { label: '奶绿', from: '#f0f8f0', to: '#d3e9d6', ink: '#4a7758' },
  cream: { label: '奶油', from: '#fffbf2', to: '#f6e7cb', ink: '#8a6a3d' },
  dusk: { label: '雾灰', from: '#f0f4f8', to: '#d4dfe7', ink: '#47606f' },
  peach: { label: '蜜桃', from: '#fdf2f5', to: '#f7dbe4', ink: '#9c5670' },
  night: { label: '深海', from: '#6b8b9e', to: '#3d5c70', ink: '#f3f8fa' },
}

export const COVER_FONTS: Record<FontKey, { label: string; stack: string; sample: string }> = {
  song: { label: '宋体', stack: '"Songti SC","Source Han Serif SC","Noto Serif SC",Georgia,serif', sample: '字' },
  kai: { label: '楷体', stack: '"Kaiti SC","STKaiti","KaiTi","Songti SC",serif', sample: '字' },
  round: { label: '圆体', stack: '"Yuanti SC","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif', sample: '字' },
  hand: {
    label: '手写',
    stack: '"HanziPen SC","Hannotate SC","Segoe Script","Bradley Hand","Kaiti SC",cursive',
    sample: '字',
  },
}

export const TEXTURES: { key: TextureKey; label: string }[] = [
  { key: 'paper', label: '纸纹' },
  { key: 'dots', label: '点点' },
  { key: 'grid', label: '格纹' },
  { key: 'none', label: '素面' },
]

export const STICKERS: string[] = [
  '🌙', '⭐', '🌿', '🐚', '☁️', '🐳', '🌸', '🐈',
  '🕯️', '🪶', '🍊', '💌', '🫧', '🌊', '🍋', '🧸',
  '🎧', '🌻', '🍃', '🐟',
]

export const STICKER_COLORS = ['#5a6b74', '#f4f8fa', '#e59a8a', '#6f9fc0']

/** 便签纸配色（贴在书的内页上） */
export const NOTE_COLORS: { bg: string; tape: string; ink: string }[] = [
  { bg: '#fdf3d8', tape: 'rgba(226, 203, 164, 0.55)', ink: '#6b5335' },
  { bg: '#e8f4f6', tape: 'rgba(148, 205, 217, 0.5)', ink: '#2f6472' },
  { bg: '#fbeee9', tape: 'rgba(246, 182, 166, 0.55)', ink: '#9b5545' },
  { bg: '#f0ecfa', tape: 'rgba(196, 185, 236, 0.55)', ink: '#5f5090' },
  { bg: '#edf6ec', tape: 'rgba(183, 216, 192, 0.6)', ink: '#4a7758' },
  { bg: '#fdf1f4', tape: 'rgba(236, 192, 214, 0.55)', ink: '#8d4f68' },
]

/* ────────────────────────── 工具 ────────────────────────── */

export function uid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)
}

export function defaultCover(mood: MoodKey): BookCoverCfg {
  return { bg: MOODS[mood].bg, texture: 'paper', font: 'song', stickers: [], strokes: [] }
}

export function emptyCover(): BookCoverCfg {
  return { bg: 'sand', texture: 'paper', font: 'song', stickers: [], strokes: [] }
}

/** 相对时间：刚刚 / 3 小时前 / 昨天 / 11 月 8 日 */
export function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} 小时前`
  const day = Math.floor(hour / 24)
  if (day === 1) return '昨天'
  if (day < 7) return `${day} 天前`
  const d = new Date(ts)
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

export function fullDate(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function sortBooks(list: Book[], key: SortKey): Book[] {
  const copy = [...list]
  if (key === 'new') return copy.sort((a, b) => b.createdAt - a.createdAt)
  if (key === 'old') return copy.sort((a, b) => a.createdAt - b.createdAt)
  return copy.sort((a, b) => b.replies.length - a.replies.length || b.createdAt - a.createdAt)
}

/* ────────────────────────── 存储 ────────────────────────── */

export const BOOK_KEYS = {
  books: 'books',
  replies: 'book-replies',
}

export function loadMyBooks(): Book[] {
  return load<Book[]>(BOOK_KEYS.books, [])
}

export function saveMyBooks(list: Book[]): void {
  save(BOOK_KEYS.books, list)
}

export function loadReplies(): Record<string, Reply[]> {
  return load<Record<string, Reply[]>>(BOOK_KEYS.replies, {})
}

export function saveReplies(map: Record<string, Reply[]>): void {
  save(BOOK_KEYS.replies, map)
}

/** 把某个书 id 的便签合并到书上 */
export function attachReplies(books: Book[], map: Record<string, Reply[]>): Book[] {
  return books.map((b) => ({ ...b, replies: mergeReplies(b.replies, map[b.id]) }))
}

function mergeReplies(seed: Reply[], extra?: Reply[]): Reply[] {
  if (!extra?.length) return seed ?? []
  return [...(seed ?? []), ...extra].sort((a, b) => a.createdAt - b.createdAt)
}

/* ────────────────────────── 种子书 ────────────────────────── */

const DAY = 86400000
const now = Date.now()

const seedReply = (
  bookId: string,
  author: string,
  content: string,
  color: number,
  hoursAgo: number,
): Reply => ({
  id: `${bookId}-r-${author}`,
  bookId,
  author,
  authorId: `seed-${author}`,
  content,
  color,
  createdAt: now - hoursAgo * 3600000,
})

export const SEED_BOOKS: Book[] = [
  {
    id: 'seed-late-study',
    authorId: 'seed-alan',
    author: '阿岚',
    title: '晚自习的第十七分钟',
    mood: 'anxious',
    cover: {
      bg: 'sea',
      texture: 'paper',
      font: 'song',
      stickers: [{ id: 's1', glyph: '🌙', x: 0.78, y: 0.14, s: 1, r: 8 }],
      strokes: [],
    },
    createdAt: now - 3 * 3600000,
    visibility: 'public',
    seed: true,
    content: `每天晚自习的第十七分钟，我都会抬头看一次钟。

不是看还有多久下课，是开始算：如果现在开始复习，还来不来得及；如果来不及，就一直算下去。算到最后什么也没看进去，只觉得钟走得太快，而我停在原地。

今天我又算了一遍，忽然发现其实没有人规定我必须每一分钟都有产出。窗外的路灯亮起来的时候，我很想问：那些看起来很稳的人，是不是也在第十七分钟抬头看钟？`,
    replies: [
      seedReply(
        'seed-late-study',
        '小满',
        '我也数过。后来我用了个更笨的办法：只写下一件今晚能做完的小事，做完就允许自己发三分钟呆。第十七分钟还是会有，但它不再像一场审判。',
        0,
        2,
      ),
      seedReply(
        'seed-late-study',
        '海边的信',
        '你抬头的那个动作，其实是在照顾自己。钟可以走得快，你不必跟着它跑。',
        1,
        1,
      ),
    ],
  },
  {
    id: 'seed-alarm',
    authorId: 'seed-yuzu',
    author: '柚子',
    title: '我把闹钟调早了三次',
    mood: 'tired',
    cover: {
      bg: 'sand',
      texture: 'grid',
      font: 'kai',
      stickers: [{ id: 's2', glyph: '☁️', x: 0.24, y: 0.16, s: 1.1, r: -6 }],
      strokes: [],
    },
    createdAt: now - 26 * 3600000,
    visibility: 'public',
    seed: true,
    content: `五点五十、五点四十、五点三十二。我第三次把闹钟往前调的时候，突然意识到自己在跟一个不存在的对手比赛起床。

今天第一次，我按掉了六点的闹钟，睡到自然醒。醒来那一秒很轻松，接着内疚了一整个上午，像欠了谁一笔钱。

可是下午做题的时候，我居然没有走神。也许我欠的不是钱，是觉。`,
    replies: [
      seedReply(
        'seed-alarm',
        '林间',
        '内疚是身体在替学校的铃声说话，不一定是你的声音。睡够了那天，你做到的其实更多。',
        2,
        9,
      ),
    ],
  },
  {
    id: 'seed-light-off',
    authorId: 'seed-hush',
    author: 'hush',
    title: '宿舍最后一个关灯的人',
    mood: 'lonely',
    cover: {
      bg: 'lav',
      texture: 'dots',
      font: 'song',
      stickers: [{ id: 's3', glyph: '🕯️', x: 0.2, y: 0.76, s: 1, r: 4 }],
      strokes: [],
    },
    createdAt: now - 2 * DAY - 7200000,
    visibility: 'public',
    seed: true,
    content: `我总是在最后一个洗漱，最后一个关灯。

不是因为我慢，是因为我怕躺下之后，听见她们聊天，而里面没有我的名字。关灯那一瞬间房间会安静两秒，我就利用那两秒假装自己也是刚刚才忙完。

昨天晚上我小声问了一句「你们在聊什么」。她们愣了一下，然后把我拉进去了。原来那扇门一直是虚掩着的。`,
    replies: [
      seedReply(
        'seed-light-off',
        '荔枝汽水',
        '我是那个先躺下的人，也怕。你问出口的那一句，比关灯勇敢多了。',
        3,
        40,
      ),
      seedReply('seed-light-off', 'A-17', '虚掩的门这个说法好准。下次我也想试着推一下。', 5, 20),
    ],
  },
  {
    id: 'seed-canteen',
    authorId: 'seed-april',
    author: '四月',
    title: '在食堂一个人吃完了一顿饭',
    mood: 'sad',
    cover: {
      bg: 'rose',
      texture: 'paper',
      font: 'round',
      stickers: [
        { id: 's4', glyph: '🍊', x: 0.74, y: 0.8, s: 1.1, r: -12 },
        { id: 's5', glyph: '🫧', x: 0.26, y: 0.2, s: 0.9, r: 0 },
      ],
      strokes: [],
    },
    createdAt: now - 4 * DAY,
    visibility: 'public',
    seed: true,
    content: `番茄鸡蛋面，吃到最后有点坨了。

中途差点掉眼泪，因为想起我妈做的面会放两个蛋。我给家里打电话说食堂很好吃，她说那就好，我在这边点头，其实一个字也说不出来。

挂了电话去洗手间站了两分钟，看镜子里的人把眼睛擦干，然后回去把汤喝完了。今天也是好好吃饭的一天，虽然有点咸。`,
    replies: [
      seedReply(
        'seed-canteen',
        '晚风',
        '两个蛋的差距，比什么都大。下次想家的时候来这里写下来，这里也有人端着面，也差点掉眼泪。',
        0,
        60,
      ),
    ],
  },
  {
    id: 'seed-fine',
    authorId: 'seed-momo',
    author: '默默',
    title: '我也想把「还行」改成「不好」',
    mood: 'lost',
    cover: {
      bg: 'mint',
      texture: 'none',
      font: 'hand',
      stickers: [{ id: 's6', glyph: '🍃', x: 0.8, y: 0.72, s: 1.2, r: 30 }],
      strokes: [],
    },
    createdAt: now - 5 * DAY,
    visibility: 'public',
    seed: true,
    content: `每次被问到怎么样，我都说还行。

还行是个安全词，它不会引出追问，也不会让人担心。可是我心里其实有很多话，只是找不到合适的第一个字。怕说出来太重，怕对方接不住，也怕说完之后我自己更难受。

今天先写在这里。这里没有人会追问我「到底怎么了」，但我好像第一次把那两个字放下来了。`,
    replies: [
      seedReply(
        'seed-fine',
        '岛主',
        '第一个字不用合适。可以先写「我今天……」，写不下去就算了。你已经在这里写了三百字，这本身就是第一个字。',
        1,
        100,
      ),
      seedReply('seed-fine', '小满', '我也一直说还行。看到有人和我一样，忽然没那么孤单。', 4, 30),
    ],
  },
  {
    id: 'seed-mock',
    authorId: 'seed-a17',
    author: 'A-17',
    title: '模考成绩出来那天',
    mood: 'anxious',
    cover: {
      bg: 'dusk',
      texture: 'grid',
      font: 'song',
      stickers: [],
      strokes: [],
    },
    createdAt: now - 6 * DAY - 3600000,
    visibility: 'public',
    seed: true,
    content: `排名往下掉了三十七名。

我没有哭，只是把卷子折得很整齐，四折，塞进抽屉最里面。然后一整个下午都在想同一个问题：我是不是就到这里了。

晚上回宿舍，室友在背单词，我忽然特别想问她一句「你觉得我还有希望吗」，但最后说的是「借我一支笔」。`,
    replies: [
      seedReply(
        'seed-mock',
        '四月',
        '三十七名写在纸上是一行数字，写在你身上却是三个月的失眠。分不清的时候，先照顾那个熬了三个月的身体。',
        2,
        120,
      ),
    ],
  },
  {
    id: 'seed-pink-sea',
    authorId: 'seed-lychee',
    author: '荔枝汽水',
    title: '今天的海是粉色的',
    mood: 'warm',
    cover: {
      bg: 'cream',
      texture: 'paper',
      font: 'round',
      stickers: [
        { id: 's7', glyph: '🌻', x: 0.22, y: 0.78, s: 1.2, r: -8 },
        { id: 's8', glyph: '🌊', x: 0.76, y: 0.18, s: 1, r: 6 },
      ],
      strokes: [],
    },
    createdAt: now - 7 * DAY,
    visibility: 'public',
    seed: true,
    content: `下课绕远路去了海边。

傍晚的云像被揉开的草莓糖，有人带狗在跑步，狗跑得比人开心。我坐在台阶上吃了半个橘子，风是温的，手心是凉的。

没有什么特别的事发生。回宿舍的路上我想，如果今天要写进日记，大概只有一句：今天过得还不错。

好像也够了。`,
    replies: [
      seedReply(
        'seed-pink-sea',
        '默默',
        '半个橘子也值得被记下来。下次带一整个，分给路过的人一半。',
        0,
        150,
      ),
    ],
  },
  {
    id: 'seed-forgive',
    authorId: 'seed-forest',
    author: '林间',
    title: '我还没有原谅自己',
    mood: 'selfblame',
    cover: {
      bg: 'night',
      texture: 'dots',
      font: 'kai',
      stickers: [{ id: 's9', glyph: '⭐', x: 0.78, y: 0.2, s: 1, r: 0 }],
      strokes: [],
    },
    createdAt: now - 9 * DAY,
    visibility: 'public',
    seed: true,
    content: `上次答应帮室友带的东西忘了。

她说没关系，可我一直记得。已经过去两周，我还在夜里把那个画面重播一遍，然后对自己说：你怎么连这么小的事都做不好。

我发现自己对别人的失误很宽容，会替他们找理由；对自己的失误很刻薄，一句话就判完。

今晚想试试，用那种很温柔的语气，把同样的话对自己说一遍。`,
    replies: [
      seedReply(
        'seed-forgive',
        'hush',
        '你替别人找理由的时候，用的是很好听的声音。也念给自己听听吧，你值得同一副嗓子。',
        3,
        200,
      ),
    ],
  },
  {
    id: 'seed-three-years',
    authorId: 'seed-future',
    author: '三月',
    title: '致三年后的我',
    mood: 'hope',
    cover: {
      bg: 'peach',
      texture: 'none',
      font: 'hand',
      stickers: [{ id: 's10', glyph: '💌', x: 0.72, y: 0.76, s: 1.2, r: 10 }],
      strokes: [],
    },
    createdAt: now - 12 * DAY,
    visibility: 'public',
    seed: true,
    content: `如果你看到这本小书，说明我还没有放弃。

现在的我每天背单词、做题、害怕考不上，晚上会为一次小小的失误失眠。写这封信的时候，我刚哭过，但已经不记得是为了什么。

我不是为了让你过得轻松才努力的，我是想让你有得选。可以选择喜欢的方向，可以拒绝不想做的事，可以在某个下午忽然想去海边就去了。

如果这三年很难，请记得今天的我，也曾这样一寸一寸地往前挪。`,
    replies: [
      seedReply(
        'seed-three-years',
        '岛主',
        '三年后的你会记得今天的光，也会记得，是你一个人走到这里的。',
        1,
        300,
      ),
      seedReply('seed-three-years', '阿岚', '「有得选」这三个字，我抄下来了。', 0, 240),
    ],
  },
]

/** 书墙上的所有书：自己的（公开）+ 种子书 */
export function wallBooks(mine: Book[]): Book[] {
  return [...mine.filter((b) => b.visibility === 'public'), ...SEED_BOOKS]
}

export function myBooks(mine: Book[], myId: string): Book[] {
  return mine.filter((b) => b.authorId === myId)
}

export function countNotes(books: Book[]): number {
  return books.reduce((sum, b) => sum + b.replies.length, 0)
}
