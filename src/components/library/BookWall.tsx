import { motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '../Icons'
import { MOODS, timeAgo, type Book } from '../../lib/books'
import { BookCover } from './BookCover'

/* 鼠标也能左右拖动书架（触屏用原生滑动） */
function useDragScroll() {
  const ref = useRef<HTMLDivElement | null>(null)
  const drag = useRef({ down: false, startX: 0, startLeft: 0, moved: 0 })

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    const el = ref.current
    if (!el) return
    drag.current = { down: true, startX: e.clientX, startLeft: el.scrollLeft, moved: 0 }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el || !drag.current.down) return
    const dx = e.clientX - drag.current.startX
    drag.current.moved = Math.abs(dx)
    if (Math.abs(dx) > 4) el.scrollLeft = drag.current.startLeft - dx
  }

  const end = () => {
    drag.current.down = false
  }

  /* 拖动之后不要误触「打开书」 */
  const onClickCapture = (e: React.MouseEvent) => {
    if (drag.current.moved > 6) {
      e.preventDefault()
      e.stopPropagation()
      drag.current.moved = 0
    }
  }

  return { ref, onPointerDown, onPointerMove, onPointerUp: end, onPointerLeave: end, onClickCapture }
}

interface TileProps {
  book: Book
  index: number
  onOpen: (b: Book) => void
}

function BookTile({ book, index, onOpen }: TileProps) {
  const mood = MOODS[book.mood] ?? MOODS.anxious
  const tilt = ((index % 3) - 1) * 0.9

  return (
    <motion.button
      type="button"
      onClick={() => onOpen(book)}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, delay: Math.min(index * 0.04, 0.3), ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -11, scale: 1.045, rotate: tilt + (index % 2 ? 0.6 : -0.6) }}
      whileTap={{ scale: 0.985, y: -4 }}
      className="group relative w-[106px] shrink-0 snap-start text-left focus-ring sm:w-[124px] lg:w-[140px]"
      aria-label={`翻开《${book.title}》，作者 ${book.author}`}
    >
      {/* 书影 */}
      <span className="pointer-events-none absolute -bottom-1 left-1/2 h-2 w-[78%] -translate-x-1/2 rounded-[50%] bg-ink-900/12 blur-[5px] transition-all duration-400 group-hover:w-[62%] group-hover:bg-ink-900/18" />

      <div className="relative overflow-hidden rounded-[7px] shadow-[0_10px_18px_-14px_rgba(46,96,112,0.6)] transition-shadow duration-400 group-hover:shadow-[0_26px_40px_-22px_rgba(46,96,112,0.62)]">
        <BookCover cover={book.cover} title={book.title} author={book.author} mood={book.mood} size="sm" />

        {book.replies.length > 0 && (
          <span className="pointer-events-none absolute right-1 top-1 flex items-center gap-0.5 rounded-full bg-white/85 px-1.5 py-0.5 text-[8.5px] font-medium text-ink-600 shadow-sm backdrop-blur-sm">
            <Icon name="mail" size={8} />
            {book.replies.length}
          </span>
        )}
      </div>

      <p className="mt-2 truncate text-[10.5px] font-medium leading-tight text-ink-600 transition group-hover:text-ink-900">
        {book.title}
      </p>
      <p className="mt-0.5 truncate text-[9px] text-ink-300 group-hover:hidden">
        {book.author} · {timeAgo(book.createdAt)}
      </p>
      {/* 悬停时把作者行换成这本书的情绪注脚 */}
      <p className="mt-0.5 hidden truncate text-[9px] text-sea-600 group-hover:block">{mood.hint}</p>
    </motion.button>
  )
}

function ShelfRow({
  books,
  startIndex,
  onOpen,
  onCreate,
}: {
  books: Book[]
  startIndex: number
  onOpen: (b: Book) => void
  onCreate?: () => void
}) {
  const scroller = useDragScroll()
  const [edge, setEdge] = useState({ left: false, right: false })

  const sync = useCallback(() => {
    const el = scroller.ref.current
    if (!el) return
    setEdge({
      left: el.scrollLeft > 8,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 8,
    })
  }, [scroller.ref])

  useEffect(() => {
    sync()
    const el = scroller.ref.current
    if (!el) return
    el.addEventListener('scroll', sync, { passive: true })
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', sync)
      ro.disconnect()
    }
  }, [sync, books.length])

  const nudge = (dir: -1 | 1) => {
    const el = scroller.ref.current
    if (!el) return
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.7, 200), behavior: 'smooth' })
  }

  return (
    <div className="relative">
      <div
        ref={scroller.ref}
        onPointerDown={scroller.onPointerDown}
        onPointerMove={scroller.onPointerMove}
        onPointerUp={scroller.onPointerUp}
        onPointerLeave={scroller.onPointerLeave}
        onClickCapture={scroller.onClickCapture}
        className="no-bar flex cursor-grab items-end gap-3 overflow-x-auto scroll-smooth px-1 pb-3 pt-5 active:cursor-grabbing sm:gap-4"
        style={{ scrollSnapType: 'x proximity' }}
      >
        {books.map((b, i) => (
          <BookTile key={b.id} book={b} index={startIndex + i} onOpen={onOpen} />
        ))}
        {onCreate && (
          <button
            type="button"
            onClick={onCreate}
            className="group mb-0.5 flex w-[106px] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-[7px] border border-dashed border-sea-300/80 bg-white/40 py-7 text-sea-600 transition hover:-translate-y-1 hover:border-sea-400 hover:bg-white/70 focus-ring sm:w-[124px] lg:w-[140px]"
            style={{ aspectRatio: '3 / 4' }}
            aria-label="写一本自己的小书"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-sea-500 shadow-sm transition group-hover:scale-110">
              <Icon name="feather" size={16} />
            </span>
            <span className="px-2 text-center text-[10px] leading-relaxed text-ink-500">
              写一本
              <br />
              自己的小书
            </span>
          </button>
        )}
      </div>

      {/* 隔板 */}
      <div className="relative">
        <div className="h-[6px] rounded-full bg-gradient-to-b from-[#f4e9d6] to-[#dcc9a6] shadow-[0_6px_14px_-8px_rgba(120,96,64,0.55)]" />
        <div className="mx-auto h-[2px] w-[98%] rounded-b-full bg-[#d3bf9d]/45 blur-[1.5px]" />
        <div className="pointer-events-none absolute inset-x-0 -top-2 h-3 bg-gradient-to-t from-[#dcc9a6]/25 to-transparent" />
      </div>

      {/* 左右翻动 */}
      {edge.left && (
        <button
          type="button"
          onClick={() => nudge(-1)}
          className="absolute left-0 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white/80 text-ink-500 shadow-soft backdrop-blur transition hover:bg-white hover:text-sea-600 sm:flex"
          aria-label="向左看"
        >
          <Icon name="arrowRight" size={14} className="rotate-180" />
        </button>
      )}
      {edge.right && (
        <button
          type="button"
          onClick={() => nudge(1)}
          className="absolute right-0 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white/80 text-ink-500 shadow-soft backdrop-blur transition hover:bg-white hover:text-sea-600 sm:flex"
          aria-label="向右看"
        >
          <Icon name="arrowRight" size={14} />
        </button>
      )}
    </div>
  )
}

/** 书墙：一排排木架，书脊朝外，能横向滑动，也能被抽出来 */
export function BookWall({
  books,
  onOpen,
  onCreate,
}: {
  books: Book[]
  onOpen: (b: Book) => void
  onCreate?: () => void
}) {
  const perRow = 6
  const rows: Book[][] = []
  for (let i = 0; i < books.length; i += perRow) rows.push(books.slice(i, i + perRow))
  if (onCreate) {
    if (rows.length === 0) rows.push([])
    // 「写一本」只出现在最后一排
  }

  return (
    <div className="space-y-1">
      {rows.map((row, i) => (
        <ShelfRow
          key={i}
          books={row}
          startIndex={i * perRow}
          onOpen={onOpen}
          onCreate={onCreate && i === rows.length - 1 ? onCreate : undefined}
        />
      ))}
    </div>
  )
}
