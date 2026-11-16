import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { hueOf } from '../../lib/auth'
import { MOODS, NOTE_COLORS, fullDate, timeAgo, type Book } from '../../lib/books'
import { sfx } from '../../lib/sfx'
import { Icon } from '../Icons'
import { BookCover } from './BookCover'

const QUICK = ['我也经历过类似的时刻。', '抱抱你，你已经很努力了。', '愿意的话，可以再多说一点。', '你的感受是真实的，不用急着好起来。']

function Avatar({ name, size = 26 }: { name: string; size?: number }) {
  const hue = hueOf(name)
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-sm"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(135deg, hsl(${hue} 62% 74%), hsl(${(hue + 42) % 360} 58% 67%))`,
      }}
      aria-hidden
    >
      {name.slice(0, 1)}
    </span>
  )
}

/** 内页上的一张便签 */
export function StickyNote({ text, author, time, color }: { text: string; author: string; time: string; color: number }) {
  const c = NOTE_COLORS[color % NOTE_COLORS.length]
  return (
    <div
      className="relative rounded-[4px] px-4 pb-3.5 pt-5 shadow-[0_12px_20px_-16px_rgba(90,70,50,0.7)]"
      style={{ background: c.bg, color: c.ink }}
    >
      <span
        className="absolute -top-2 left-1/2 h-3.5 w-12 -translate-x-1/2 -rotate-2 rounded-[1px] opacity-90"
        style={{ background: c.tape, boxShadow: '0 1px 2px rgba(120,100,70,0.18)' }}
      />
      <p className="whitespace-pre-wrap text-[12.5px] leading-[1.85]">{text}</p>
      <p className="mt-2.5 flex items-center gap-1.5 text-[10px] opacity-60">
        <span className="font-medium">{author}</span>
        <span>·</span>
        <span>{time}</span>
      </p>
    </div>
  )
}

interface ReplyComposerProps {
  book: Book
  myName: string
  open: boolean
  onClose: () => void
  onSubmit: (content: string, color: number) => void
}

function ReplyComposer({ book, myName, open, onClose, onSubmit }: ReplyComposerProps) {
  const [text, setText] = useState('')
  const [color, setColor] = useState(0)

  useEffect(() => {
    if (open) {
      setText('')
      setColor(Math.floor(Math.random() * NOTE_COLORS.length))
    }
  }, [open])

  const submit = () => {
    const value = text.trim()
    if (value.length < 2) return
    sfx.plink()
    onSubmit(value, color)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            className="absolute inset-0 cursor-default bg-[#2b4450]/[0.28] backdrop-blur-[5px]"
            onClick={onClose}
            aria-label="关闭回复"
            tabIndex={-1}
          />
          <motion.div
            initial={{ y: 26, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 18, opacity: 0, scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-t-4xl border border-white/85 bg-[#fffdf7] shadow-[0_40px_80px_-40px_rgba(46,96,112,0.55)] sm:rounded-4xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#e8ddc8]/70 px-5 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#b09570]">A Warm Note</p>
                <h3 className="mt-1 font-display text-[15px] font-semibold text-ink-900">
                  给《{book.title}》留一张便签
                </h3>
              </div>
              <button onClick={onClose} className="btn-quiet -mr-1 h-8 w-8 rounded-full p-0" aria-label="关闭">
                <Icon name="close" size={16} />
              </button>
            </div>

            <div className="px-5 py-4">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 300))}
                rows={5}
                autoFocus
                placeholder="不用给出标准答案。一句「我也这样过」，有时候就够了……"
                className="w-full resize-none rounded-2xl border border-[#e6dac4] bg-white/80 px-4 py-3 text-[13px] leading-[1.9] outline-none transition focus:border-sea-300 focus:bg-white"
                style={{ color: '#2d3b45' }}
              />
              <div className="mt-2 flex items-center justify-between text-[10px] text-ink-300">
                <span>署名：{myName} · 便签会贴在 TA 的书页上</span>
                <span className={text.length > 280 ? 'text-coral-500' : ''}>{text.length}/300</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {QUICK.map((q) => (
                  <button
                    key={q}
                    onClick={() => setText((t) => (t.trim() ? `${t.trimEnd()}\n${q}` : q).slice(0, 300))}
                    className="rounded-full border border-[#e6dac4] bg-white/70 px-2.5 py-1 text-[10.5px] text-ink-500 transition hover:border-sea-200 hover:bg-white hover:text-sea-700"
                  >
                    {q}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  {NOTE_COLORS.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => setColor(i)}
                      className={`h-5 w-5 rounded-[3px] transition ${
                        color === i ? 'ring-2 ring-sea-400 ring-offset-1' : 'opacity-80 hover:opacity-100'
                      }`}
                      style={{ background: c.bg, border: `1px solid ${c.tape}` }}
                      aria-label={`便签颜色 ${i + 1}`}
                    />
                  ))}
                </div>
                <button onClick={submit} disabled={text.trim().length < 2} className="btn-primary px-5 py-2 text-[12.5px] disabled:opacity-45">
                  <Icon name="send" size={14} />
                  贴上去
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

interface ReaderProps {
  book: Book | null
  myName: string
  onClose: () => void
  onReply: (bookId: string, content: string, color: number) => void
  onToast: (text: string) => void
}

/** 翻开一本书：左边是封面与书籍信息，右边是内页与便签 */
export function BookReader({ book, myName, onClose, onReply, onToast }: ReaderProps) {
  const [composing, setComposing] = useState(false)

  useEffect(() => {
    if (!book) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [book])

  useEffect(() => {
    if (!book) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (composing) setComposing(false)
      else onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [book, composing, onClose])

  const paragraphs = useMemo(() => (book ? book.content.split(/\n{2,}/).filter(Boolean) : []), [book])
  const mood = book ? MOODS[book.mood] ?? MOODS.anxious : MOODS.anxious

  return createPortal(
    <>
      <AnimatePresence>
        {book && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label={`《${book.title}》`}
          >
            <button
              className="absolute inset-0 cursor-default bg-[#243844]/[0.32] backdrop-blur-[7px]"
              onClick={onClose}
              aria-label="合上这本书"
              tabIndex={-1}
            />

            <motion.div
              initial={{ y: 46, opacity: 0, scale: 0.97, rotateX: 6 }}
              animate={{ y: 0, opacity: 1, scale: 1, rotateX: 0 }}
              exit={{ y: 30, opacity: 0, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 220, damping: 24 }}
              className="relative z-10 flex max-h-[93dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[28px] border border-white/70 shadow-[0_50px_90px_-44px_rgba(30,60,72,0.6)] sm:rounded-[28px]"
              style={{ background: 'linear-gradient(180deg, #fffdf8 0%, #fdf8ee 100%)' }}
            >
              {/* 顶部微微的书脊光 */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-sea-300/50 via-lav-300/50 to-coral-300/50" />

              {/* 移动端：随时能合上书 */}
              <button
                onClick={onClose}
                className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/85 text-ink-500 shadow-sm backdrop-blur lg:hidden"
                aria-label="合上这本书"
              >
                <Icon name="close" size={16} />
              </button>

              <div className="no-bar grid flex-1 overflow-y-auto lg:grid-cols-[248px_1fr] lg:overflow-hidden">
                {/* 左：封面 */}
                <div className="relative flex flex-col items-center gap-4 border-b border-[#eae0cd]/60 px-6 py-6 lg:border-b-0 lg:border-r lg:py-8">
                  <motion.div
                    initial={{ rotate: -3, scale: 0.94, opacity: 0 }}
                    animate={{ rotate: -1.2, scale: 1, opacity: 1 }}
                    transition={{ delay: 0.06, type: 'spring', stiffness: 200, damping: 20 }}
                    className="w-[168px] sm:w-[190px] lg:w-full"
                  >
                    <BookCover cover={book.cover} title={book.title} author={book.author} mood={book.mood} size="lg" />
                  </motion.div>

                  <div className="w-full space-y-2 text-center lg:text-left">
                    <div className="flex items-center justify-center gap-2 lg:justify-start">
                      <Avatar name={book.author} size={24} />
                      <p className="text-[12px] font-medium text-ink-700">{book.author}</p>
                      {book.visibility === 'private' && (
                        <span className="flex items-center gap-0.5 rounded-full bg-white/80 px-1.5 py-0.5 text-[9px] text-ink-400">
                          <Icon name="lock" size={9} />
                          私密
                        </span>
                      )}
                    </div>
                    <p className="text-[10.5px] text-ink-300">写于 {fullDate(book.createdAt)}</p>
                    <div className="flex flex-wrap items-center justify-center gap-1.5 lg:justify-start">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${mood.tag}`}>{mood.label}</span>
                      <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] text-ink-400">
                        {book.replies.length} 张便签
                      </span>
                    </div>
                  </div>

                  {/* 藏书印：补上左栏的空白，也有点旧书味道 */}
                  <div className="mt-auto hidden w-full justify-center lg:flex">
                    <div className="relative flex h-[68px] w-[68px] -rotate-[7deg] items-center justify-center rounded-full border border-[#c39a6b]/60">
                      <span className="absolute inset-[5px] rounded-full border border-dashed border-[#c39a6b]/45" />
                      <span className="text-center text-[8.5px] leading-[1.7] tracking-[0.18em] text-[#ab8a60]">
                        分享小屋
                        <br />
                        <span className="text-[6.5px] tracking-[0.14em]">SERENE ISLE</span>
                      </span>
                    </div>
                  </div>

                  <button onClick={onClose} className="btn-ghost mt-1 w-full py-2 text-[11.5px]">
                    <Icon name="book" size={13} />
                    合上这本书
                  </button>
                </div>

                {/* 右：内页 */}
                <div className="no-bar flex flex-col overflow-y-auto px-6 py-6 sm:px-9 sm:py-8">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[9.5px] font-semibold uppercase tracking-[0.3em] text-[#b09570]">
                        A Book from the Isle
                      </p>
                      <h2 className="mt-2 font-display text-[22px] font-semibold leading-snug tracking-tight text-ink-900 sm:text-[26px]">
                        {book.title}
                      </h2>
                    </div>
                    <button onClick={onClose} className="btn-quiet -mr-2 hidden h-8 w-8 shrink-0 rounded-full p-0 lg:flex" aria-label="关闭">
                      <Icon name="close" size={17} />
                    </button>
                  </div>

                  <div className="mt-4 space-y-4">
                    {paragraphs.map((p, i) => (
                      <motion.p
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + i * 0.06, duration: 0.36 }}
                        className="whitespace-pre-wrap font-display text-[13.5px] leading-[2.1] text-ink-700"
                        style={{ letterSpacing: '0.01em' }}
                      >
                        {p}
                      </motion.p>
                    ))}
                  </div>

                  {/* 便签区 */}
                  <div className="mt-7 flex items-center gap-3">
                    <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[#dcc9a6]/70 to-[#dcc9a6]/30" />
                    <span className="text-[10px] tracking-[0.2em] text-[#b09570]">书页上的便签</span>
                    <span className="h-px flex-1 bg-gradient-to-l from-transparent via-[#dcc9a6]/70 to-[#dcc9a6]/30" />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <AnimatePresence mode="popLayout">
                      {book.replies.map((r, i) => (
                        <motion.div
                          key={r.id}
                          layout
                          initial={{ opacity: 0, y: 14, rotate: -3 }}
                          animate={{ opacity: 1, y: 0, rotate: i % 2 ? 0.9 : -0.9 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ type: 'spring', stiffness: 260, damping: 24, delay: Math.min(i * 0.04, 0.24) }}
                        >
                          <StickyNote text={r.content} author={r.author} time={timeAgo(r.createdAt)} color={r.color} />
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {book.replies.length === 0 && (
                      <div className="sm:col-span-2 rounded-2xl border border-dashed border-[#dcc9a6]/80 bg-white/45 px-5 py-7 text-center">
                        <p className="text-[12px] text-ink-400">这一页还空着。</p>
                        <p className="mt-1 text-[11px] text-ink-300">你的那句「我也这样过」，也许正是 TA 在等的。</p>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setComposing(true)
                      sfx.pop(1)
                    }}
                    className="mt-5 flex w-full items-center justify-between gap-3 rounded-2xl border border-[#e3d5ba] bg-gradient-to-r from-[#fdf5e4] to-[#fbf1f8] px-4 py-3 text-left transition hover:border-[#d3bd97] hover:shadow-sm"
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#c08b57] shadow-sm">
                        <Icon name="feather" size={15} />
                      </span>
                      <span>
                        <span className="block text-[12.5px] font-medium text-ink-800">写一张暖心便签</span>
                        <span className="block text-[10px] text-ink-400">不评判，不讲道理，只是陪着</span>
                      </span>
                    </span>
                    <Icon name="arrowRight" size={15} className="text-[#b09570]" />
                  </button>

                  <p className="mt-4 text-[10px] leading-relaxed text-ink-300">
                    书墙是岛民的树洞，不替代专业帮助。如果你正经历难以承受的时刻，
                    <Link to="/harbor" className="mx-0.5 text-sea-600 underline decoration-dotted underline-offset-2">
                      去避风港
                    </Link>
                    看看，或拨打心理援助热线 12356。
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {book && (
        <ReplyComposer
          book={book}
          myName={myName}
          open={composing}
          onClose={() => setComposing(false)}
          onSubmit={(content, color) => {
            onReply(book.id, content, color)
            setComposing(false)
            onToast('你的善意已经送达~')
          }}
        />
      )}
    </>,
    document.body,
  )
}
