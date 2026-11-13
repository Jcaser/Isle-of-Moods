import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import {
  COVER_BGS,
  COVER_FONTS,
  MOODS,
  MOOD_KEYS,
  STICKERS,
  TEXTURES,
  defaultCover,
  emptyCover,
  uid,
  type Book,
  type BookCoverCfg,
  type CoverBgKey,
  type FontKey,
  type MoodKey,
  type Sticker,
  type Stroke,
  type TextureKey,
} from '../../lib/books'
import { sfx } from '../../lib/sfx'
import { Icon } from '../Icons'
import { Modal } from '../Modal'
import { BookCover } from './BookCover'

export interface BookDraft {
  title: string
  mood: MoodKey
  content: string
  visibility: 'public' | 'private'
  cover: BookCoverCfg
}

interface Props {
  open: boolean
  /** create：写作 + 设计封面；cover：只改封面 */
  mode: 'create' | 'cover'
  editing?: Book | null
  /** 预览封面上署的名字 */
  author?: string
  onClose: () => void
  onSave: (draft: BookDraft) => void
}

const PROMPTS = ['今天让我难受的是……', '有件事我一直没说出来：', '我想对三个月后的自己说：', '如果不用假装，我其实……']
/** 手绘笔色：一支深墨打底，其余都是落在纸封上也够亮的糖果色 */
const PEN_COLORS = [
  '#2f3e48', // 墨
  '#ff4d6d', // 珊瑚红
  '#ff6b35', // 橘
  '#ffa41b', // 琥珀
  '#ffd43b', // 柠檬
  '#7bdc6a', // 青柠
  '#20c997', // 薄荷
  '#22b8cf', // 天青
  '#3b8cf5', // 湖蓝
  '#6c63ff', // 靛紫
  '#b197fc', // 藤紫
  '#ff67b0', // 玫粉
]
const PEN_WIDTHS = [2.4, 4, 6]

const TABS = [
  { key: 'bg', label: '底色', icon: 'leaf' },
  { key: 'sticker', label: '贴纸', icon: 'sparkles' },
  { key: 'font', label: '字体', icon: 'feather' },
  { key: 'draw', label: '手绘', icon: 'compass' },
] as const

type TabKey = (typeof TABS)[number]['key']

export function BookStudio({ open, mode, editing, author = '我', onClose, onSave }: Props) {
  const [step, setStep] = useState<'write' | 'design'>('write')
  const [title, setTitle] = useState('')
  const [mood, setMood] = useState<MoodKey>('anxious')
  const [content, setContent] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [cover, setCover] = useState<BookCoverCfg>(emptyCover())
  const [tab, setTab] = useState<TabKey>('bg')
  const [drawOn, setDrawOn] = useState(false)
  const [penColor, setPenColor] = useState(PEN_COLORS[0])
  const [penW, setPenW] = useState(PEN_WIDTHS[0])
  const [activeSticker, setActiveSticker] = useState<string | null>(null)
  const [hint, setHint] = useState('')

  const previewRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null)
  const penRef = useRef(false)

  /* 每次打开都重置，避免带着上一本的内容 */
  useEffect(() => {
    if (!open) return
    const seedMood = editing?.mood ?? 'anxious'
    setStep(mode === 'cover' ? 'design' : 'write')
    setTitle(editing?.title ?? '')
    setMood(seedMood)
    setContent(editing?.content ?? '')
    setVisibility(editing?.visibility ?? 'public')
    setCover(
      editing ? (JSON.parse(JSON.stringify(editing.cover)) as BookCoverCfg) : defaultCover(seedMood),
    )
    setTab('bg')
    setDrawOn(false)
    setActiveSticker(null)
    setHint('')
  }, [open, mode, editing])

  /* 情绪变了，如果封面还没动过，就跟着换底色 */
  const moodPick = (m: MoodKey) => {
    setMood(m)
    setCover((c) => (c.stickers.length || c.strokes.length ? c : { ...c, bg: MOODS[m].bg }))
  }

  const patchCover = (patch: Partial<BookCoverCfg>) => setCover((c) => ({ ...c, ...patch }))

  /* 新贴纸尽量落在空白处：多试几个点，挑离已有贴纸最远、也不压住题字的那个 */
  const addSticker = (glyph: string) => {
    sfx.pop(2)
    let best = { x: 0.24, y: 0.2, score: -Infinity }
    for (let i = 0; i < 14; i++) {
      const x = 0.14 + Math.random() * 0.72
      const y = 0.1 + Math.random() * 0.8
      const nearest = cover.stickers.reduce((min, st) => Math.min(min, Math.hypot(st.x - x, st.y - y)), 1.4)
      const overText = x > 0.16 && x < 0.84 && y > 0.3 && y < 0.68 ? 0.34 : 0
      const score = nearest - overText + Math.random() * 0.08
      if (score > best.score) best = { x, y, score }
    }
    const s: Sticker = {
      id: uid(),
      glyph,
      x: best.x,
      y: best.y,
      s: 0.9 + Math.random() * 0.4,
      r: (Math.random() - 0.5) * 26,
    }
    patchCover({ stickers: [...cover.stickers, s] })
    setActiveSticker(s.id)
  }

  /* ── 贴纸拖动 ── */
  const onStickerDown = (s: Sticker, e: React.PointerEvent<HTMLElement>) => {
    if (drawOn) return
    const rect = previewRef.current?.getBoundingClientRect()
    if (!rect) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    dragRef.current = { id: s.id, dx: (e.clientX - rect.left) / rect.width - s.x, dy: (e.clientY - rect.top) / rect.height - s.y }
    setActiveSticker(s.id)
  }

  const onPreviewMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = previewRef.current?.getBoundingClientRect()
    if (!rect) return
    const d = dragRef.current
    if (d) {
      const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width - d.dx))
      const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height - d.dy))
      setCover((c) => ({ ...c, stickers: c.stickers.map((s) => (s.id === d.id ? { ...s, x, y } : s)) }))
      return
    }
    if (!penRef.current) return
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    setCover((c) => {
      const strokes = [...c.strokes]
      const last = strokes[strokes.length - 1]
      if (!last) return c
      strokes[strokes.length - 1] = { ...last, pts: [...last.pts, { x, y }] }
      return { ...c, strokes }
    })
  }

  const onPreviewDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drawOn) return
    const rect = previewRef.current?.getBoundingClientRect()
    if (!rect) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    penRef.current = true
    const p = { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height }
    const stroke: Stroke = { pts: [p], color: penColor, w: penW }
    setCover((c) => ({ ...c, strokes: [...c.strokes, stroke] }))
  }

  const onPreviewUp = () => {
    dragRef.current = null
    penRef.current = false
  }

  const removeSticker = (s: Sticker) => {
    patchCover({ stickers: cover.stickers.filter((x) => x.id !== s.id) })
    setActiveSticker(null)
  }

  const randomize = () => {
    sfx.plink()
    const keys = Object.keys(COVER_BGS) as CoverBgKey[]
    const fonts = Object.keys(COVER_FONTS) as FontKey[]
    const tex = TEXTURES.map((t) => t.key)
    patchCover({
      bg: keys[Math.floor(Math.random() * keys.length)],
      font: fonts[Math.floor(Math.random() * fonts.length)],
      texture: tex[Math.floor(Math.random() * tex.length)] as TextureKey,
    })
  }

  const trySave = () => {
    if (!title.trim()) {
      setHint('先给这本书起个名字吧')
      setStep('write')
      return
    }
    if (mode === 'create' && content.trim().length < 4) {
      setHint('至少写下一句话，哪怕只有一句')
      setStep('write')
      return
    }
    sfx.chime()
    onSave({
      title: title.trim().slice(0, 24),
      mood,
      content: content.trim(),
      visibility,
      cover,
    })
  }

  const isDesign = step === 'design'
  const modalTitle = mode === 'cover' ? '重新设计封面' : isDesign ? '设计一本书的封面' : '写一本书'
  const modalSub =
    mode === 'cover'
      ? '像做手账一样，把这本书的封面调成你喜欢的样子。右边改，左边立刻就能看见。'
      : isDesign
        ? '底色、贴纸、字体、手绘都可以自己搭。拖动贴纸可以换位置，双击可以拿掉它。'
        : '这里不评判、不改写。写下此刻真正想说的话，它会被放在书墙上，等一个懂的人翻开。'

  return (
    <Modal open={open} onClose={onClose} title={modalTitle} subtitle={modalSub} maxWidth="max-w-4xl">
      <div className="pb-2">
        {mode === 'create' && (
          <div className="mb-5 flex items-center gap-2">
            {(['write', 'design'] as const).map((s, i) => (
              <button
                key={s}
                onClick={() => setStep(s)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] transition ${
                  step === s
                    ? 'border-sea-300 bg-white text-sea-700 shadow-sm'
                    : 'border-white/70 bg-white/40 text-ink-400 hover:bg-white/70'
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold ${
                    step === s ? 'bg-sea-500 text-white' : 'bg-ink-300/25 text-ink-500'
                  }`}
                >
                  {i + 1}
                </span>
                {s === 'write' ? '写下内容' : '设计封面'}
              </button>
            ))}
            <span className="ml-auto hidden text-[10px] text-ink-300 sm:block">
              {step === 'write' ? '第二步可以把封面做成手账的样子' : '所有改动都会实时预览'}
            </span>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[232px_1fr]">
          {/* ── 实时预览 ── */}
          <div
            className={
              isDesign
                ? 'sticky top-[84px] z-10 -mx-1 bg-[#fffdf8]/93 px-1 pb-2 pt-1 backdrop-blur-sm lg:static lg:top-2 lg:bg-transparent lg:pb-0 lg:pt-0 lg:backdrop-blur-none'
                : ''
            }
          >
            <div
              ref={previewRef}
              onPointerDown={isDesign ? onPreviewDown : undefined}
              onPointerMove={isDesign ? onPreviewMove : undefined}
              onPointerUp={isDesign ? onPreviewUp : undefined}
              onPointerLeave={isDesign ? onPreviewUp : undefined}
              className="relative mx-auto w-[136px] touch-none select-none sm:w-[168px] lg:w-full"
              style={{ cursor: isDesign ? (drawOn ? 'crosshair' : 'default') : 'default' }}
            >
              <div className="overflow-hidden rounded-[10px] shadow-[0_22px_44px_-28px_rgba(46,96,112,0.6)]">
                <BookCover
                  cover={cover}
                  title={title}
                  author={editing?.author ?? author}
                  mood={mood}
                  size="md"
                  interactive={
                    isDesign && !drawOn
                      ? { onStickerDown, onStickerDouble: removeSticker, activeSticker }
                      : undefined
                  }
                />
              </div>

              {/* 拖拽/绘制提示 */}
              {isDesign && (
                <p className="mt-2 text-center text-[9.5px] leading-relaxed text-ink-300">
                  {drawOn ? '直接在封面上画，画歪了也没关系' : '拖动贴纸调整位置 · 双击拿走'}
                </p>
              )}
            </div>

            {isDesign && (
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                <button onClick={randomize} className="btn-ghost px-2.5 py-1.5 text-[10.5px]">
                  <Icon name="refresh" size={11} />
                  换一套
                </button>
                <button
                  onClick={() => patchCover({ stickers: [], strokes: [] })}
                  className="btn-quiet px-2.5 py-1.5 text-[10.5px]"
                >
                  <Icon name="trash" size={11} />
                  清空装饰
                </button>
              </div>
            )}
          </div>

          {/* ── 右侧：内容或设计器 ── */}
          <div className="min-w-0">
            <AnimatePresence mode="wait">
              {step === 'write' ? (
                <motion.div
                  key="write"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.24 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="label" htmlFor="book-title">
                      书名
                    </label>
                    <input
                      id="book-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value.slice(0, 24))}
                      placeholder="比如：晚自习的第十七分钟"
                      className="input"
                    />
                    <p className="mt-1 text-right text-[10px] text-ink-300">{title.length}/24</p>
                  </div>

                  <div>
                    <span className="label">这本书的情绪</span>
                    <div className="flex flex-wrap gap-1.5">
                      {MOOD_KEYS.map((k) => (
                        <button
                          key={k}
                          onClick={() => moodPick(k)}
                          title={MOODS[k].hint}
                          className={`rounded-full border px-3 py-1.5 text-[11px] transition ${
                            mood === k
                              ? 'border-transparent bg-white text-ink-900 shadow-sm ring-1 ring-sea-300'
                              : 'border-white/70 bg-white/45 text-ink-500 hover:bg-white/80'
                          }`}
                        >
                          <span
                            className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
                            style={{ background: MOODS[k].dot }}
                          />
                          {MOODS[k].label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="label" htmlFor="book-content">
                      正文
                    </label>
                    <textarea
                      id="book-content"
                      value={content}
                      onChange={(e) => setContent(e.target.value.slice(0, 1200))}
                      rows={7}
                      placeholder="今天发生了什么？可以只写一句……"
                      className="input resize-none leading-[1.9]"
                      style={{ fontSize: 13.5 }}
                    />
                    <div className="mt-1.5 flex items-center justify-between">
                      <div className="flex flex-wrap gap-1">
                        {PROMPTS.map((p) => (
                          <button
                            key={p}
                            onClick={() => setContent((c) => (c ? `${c}\n\n${p}` : p))}
                            className="rounded-full bg-white/60 px-2 py-1 text-[10px] text-ink-400 transition hover:bg-white hover:text-sea-700"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                      <span className="shrink-0 text-[10px] text-ink-300">{content.length}/1200</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-2xl border border-white/70 bg-white/45 px-3 py-2">
                    <span className="text-[11px] text-ink-500">可见范围</span>
                    <div className="ml-auto flex gap-1">
                      {(
                        [
                          { key: 'public', label: '公开到书墙', icon: 'eye' },
                          { key: 'private', label: '只放我的书架', icon: 'lock' },
                        ] as const
                      ).map((o) => (
                        <button
                          key={o.key}
                          onClick={() => setVisibility(o.key)}
                          className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[10.5px] transition ${
                            visibility === o.key
                              ? 'bg-white text-ink-800 shadow-sm ring-1 ring-sea-200'
                              : 'text-ink-400 hover:bg-white/70'
                          }`}
                        >
                          <Icon name={o.icon} size={11} />
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="design"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.24 }}
                >
                  {/* 设计分类 */}
                  <div className="flex gap-1.5">
                    {TABS.map((t) => (
                      <button
                        key={t.key}
                        onClick={() => {
                          setTab(t.key)
                          if (t.key !== 'draw') setDrawOn(false)
                        }}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-2xl border px-2 py-2 text-[11px] transition ${
                          tab === t.key
                            ? 'border-sea-300 bg-white text-sea-700 shadow-sm'
                            : 'border-white/70 bg-white/40 text-ink-500 hover:bg-white/75'
                        }`}
                      >
                        <Icon name={t.icon} size={12} />
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 min-h-[236px]">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={tab}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18 }}
                      >
                        {tab === 'bg' && (
                          <div className="space-y-4">
                            <div>
                              <p className="label">底色</p>
                              <div className="grid grid-cols-5 gap-2 sm:grid-cols-9">
                                {(Object.keys(COVER_BGS) as CoverBgKey[]).map((k) => (
                                  <button
                                    key={k}
                                    onClick={() => {
                                      patchCover({ bg: k })
                                      sfx.pop(1)
                                    }}
                                    className={`group relative flex flex-col items-center gap-1 rounded-xl p-1 transition ${
                                      cover.bg === k ? 'ring-2 ring-sea-400 ring-offset-1' : 'hover:bg-white/60'
                                    }`}
                                    aria-label={COVER_BGS[k].label}
                                  >
                                    <span
                                      className="block h-8 w-full rounded-lg border border-white/70 shadow-inner"
                                      style={{
                                        background: `linear-gradient(158deg, ${COVER_BGS[k].from}, ${COVER_BGS[k].to})`,
                                      }}
                                    />
                                    <span className="text-[9px] text-ink-400">{COVER_BGS[k].label}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="label">纸张纹理</p>
                              <div className="flex flex-wrap gap-1.5">
                                {TEXTURES.map((t) => (
                                  <button
                                    key={t.key}
                                    onClick={() => patchCover({ texture: t.key })}
                                    className={`rounded-full border px-3 py-1.5 text-[11px] transition ${
                                      cover.texture === t.key
                                        ? 'border-sea-300 bg-white text-sea-700 shadow-sm'
                                        : 'border-white/70 bg-white/45 text-ink-500 hover:bg-white/80'
                                    }`}
                                  >
                                    {t.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {tab === 'sticker' && (
                          <div>
                            <div className="flex items-center justify-between">
                              <p className="label mb-0">贴纸</p>
                              <button
                                onClick={() => patchCover({ stickers: [] })}
                                className="text-[10px] text-ink-300 transition hover:text-coral-500"
                              >
                                清空贴纸
                              </button>
                            </div>
                            <div className="mt-2 grid grid-cols-8 gap-1.5 sm:grid-cols-10">
                              {STICKERS.map((g) => (
                                <button
                                  key={g}
                                  onClick={() => addSticker(g)}
                                  className="flex aspect-square items-center justify-center rounded-xl bg-white/55 text-[18px] transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm"
                                  aria-label={`添加贴纸 ${g}`}
                                >
                                  {g}
                                </button>
                              ))}
                            </div>
                            <p className="mt-3 rounded-xl bg-white/45 px-3 py-2 text-[10px] leading-relaxed text-ink-400">
                              点一下就会贴到封面上，位置不满意可以直接拖着走，双击贴纸可以把它拿下来。
                            </p>
                          </div>
                        )}

                        {tab === 'font' && (
                          <div>
                            <p className="label">题字字体</p>
                            <div className="space-y-1.5">
                              {(Object.keys(COVER_FONTS) as FontKey[]).map((k) => (
                                <button
                                  key={k}
                                  onClick={() => patchCover({ font: k })}
                                  className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 text-left transition ${
                                    cover.font === k
                                      ? 'border-sea-300 bg-white shadow-sm'
                                      : 'border-white/70 bg-white/40 hover:bg-white/75'
                                  }`}
                                >
                                  <span className="text-[11px] text-ink-500">{COVER_FONTS[k].label}</span>
                                  <span
                                    className="truncate text-[14px] text-ink-900"
                                    style={{ fontFamily: COVER_FONTS[k].stack }}
                                  >
                                    {title || '心里的那件事'}
                                  </span>
                                  {cover.font === k && <Icon name="check" size={13} className="shrink-0 text-sea-500" />}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {tab === 'draw' && (
                          <div>
                            <div className="flex items-center justify-between gap-2 rounded-2xl bg-white/50 px-3 py-2.5">
                              <div>
                                <p className="text-[11.5px] font-medium text-ink-700">手绘模式</p>
                                <p className="mt-0.5 text-[10px] text-ink-400">打开后在左侧封面直接画</p>
                              </div>
                              <button
                                onClick={() => {
                                  setDrawOn((v) => !v)
                                  setActiveSticker(null)
                                }}
                                className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                                  drawOn ? 'bg-sea-400' : 'bg-ink-300/40'
                                }`}
                                role="switch"
                                aria-checked={drawOn}
                                aria-label="手绘模式"
                              >
                                <span
                                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
                                    drawOn ? 'left-[22px]' : 'left-0.5'
                                  }`}
                                />
                              </button>
                            </div>

                            <div className="mt-3">
                              <p className="label">笔色</p>
                              <div className="grid w-fit grid-cols-6 gap-2">
                                {PEN_COLORS.map((c) => (
                                  <button
                                    key={c}
                                    onClick={() => {
                                      setPenColor(c)
                                      sfx.tick()
                                    }}
                                    className={`h-7 w-7 rounded-full border border-white/90 shadow-[0_2px_6px_-2px_rgba(45,59,69,0.45)] transition hover:scale-110 ${
                                      penColor === c ? 'scale-110 ring-2 ring-sea-400 ring-offset-2' : ''
                                    }`}
                                    style={{ background: c }}
                                    aria-label={`画笔颜色 ${c}`}
                                    aria-pressed={penColor === c}
                                  />
                                ))}
                              </div>
                              <p className="mt-1.5 text-[9.5px] leading-relaxed text-ink-300">
                                十二种颜色，画完会跟着封面一起保存
                              </p>
                            </div>

                            <div className="mt-3">
                              <p className="label">笔触</p>
                              <div className="flex gap-1.5">
                                {PEN_WIDTHS.map((w, i) => (
                                  <button
                                    key={w}
                                    onClick={() => setPenW(w)}
                                    className={`flex h-9 flex-1 items-center justify-center rounded-xl border transition ${
                                      penW === w
                                        ? 'border-sea-300 bg-white shadow-sm'
                                        : 'border-white/70 bg-white/40 hover:bg-white/75'
                                    }`}
                                    aria-label={`笔触 ${i + 1}`}
                                  >
                                    <span
                                      className="block w-8 rounded-full"
                                      style={{ height: w, background: penColor, opacity: 0.85 }}
                                    />
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="mt-3 flex gap-1.5">
                              <button
                                onClick={() => patchCover({ strokes: cover.strokes.slice(0, -1) })}
                                disabled={!cover.strokes.length}
                                className="btn-ghost flex-1 py-2 text-[11px] disabled:opacity-40"
                              >
                                撤销一笔
                              </button>
                              <button
                                onClick={() => patchCover({ strokes: [] })}
                                disabled={!cover.strokes.length}
                                className="btn-ghost flex-1 py-2 text-[11px] disabled:opacity-40"
                              >
                                全部擦掉
                              </button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {hint && <p className="mt-3 text-[11px] text-coral-500">{hint}</p>}

            <div className="sticky bottom-0 z-10 -mx-1 mt-5 flex items-center gap-2 border-t border-white/60 bg-white/85 px-1 py-3 backdrop-blur-md">
              {mode === 'create' && step === 'design' && (
                <button onClick={() => setStep('write')} className="btn-ghost px-4 py-2 text-[12px]">
                  上一步
                </button>
              )}
              {mode === 'create' && step === 'write' && (
                <button onClick={() => setStep('design')} className="btn-ghost px-4 py-2 text-[12px]">
                  <Icon name="sparkles" size={13} />
                  去设计封面
                </button>
              )}
              <button onClick={trySave} className="btn-primary ml-auto px-5 py-2 text-[12.5px]">
                <Icon name="check" size={14} />
                {mode === 'cover' ? '保存封面' : '放进书墙'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
