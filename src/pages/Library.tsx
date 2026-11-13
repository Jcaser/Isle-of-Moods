import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import { Icon } from '../components/Icons'
import { PageHeader } from '../components/PageHeader'
import { BookReader, StickyNote } from '../components/library/BookReader'
import { BookStudio, type BookDraft } from '../components/library/BookStudio'
import { BookWall } from '../components/library/BookWall'
import { BookCover } from '../components/library/BookCover'
import { KnowledgePane } from '../components/library/KnowledgePane'
import { useAuthStore } from '../store/useAuthStore'
import {
  MOODS,
  MOOD_KEYS,
  attachReplies,
  countNotes,
  loadMyBooks,
  loadReplies,
  saveMyBooks,
  saveReplies,
  sortBooks,
  timeAgo,
  uid,
  wallBooks,
  type Book,
  type MoodKey,
  type Reply,
  type SortKey,
} from '../lib/books'
import { sfx } from '../lib/sfx'

type Tab = 'wall' | 'mine' | 'knowledge'

const TABS: { key: Tab; label: string; hint: string }[] = [
  { key: 'wall', label: '书墙', hint: '大家的书' },
  { key: 'mine', label: '我的书架', hint: '我写的与收到的' },
  { key: 'knowledge', label: '知识库', hint: '岛主读过的' },
]

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'new', label: '最新发布' },
  { key: 'old', label: '最早发布' },
  { key: 'notes', label: '便签最多' },
]

export default function Library() {
  const user = useAuthStore((s) => s.user)
  const [own, setOwn] = useState<Book[]>(() => loadMyBooks())
  const [replyMap, setReplyMap] = useState<Record<string, Reply[]>>(() => loadReplies())
  const [tab, setTab] = useState<Tab>('wall')
  const [moodFilter, setMoodFilter] = useState<MoodKey | 'all'>('all')
  const [sort, setSort] = useState<SortKey>('new')
  const [readerId, setReaderId] = useState<string | null>(null)
  const [studio, setStudio] = useState<{ open: boolean; mode: 'create' | 'cover'; editing: Book | null }>({
    open: false,
    mode: 'create',
    editing: null,
  })
  const [toast, setToast] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()

  const myName = user?.name ?? '岛民'
  const myId = user?.id ?? 'guest'

  useEffect(() => saveMyBooks(own), [own])
  useEffect(() => saveReplies(replyMap), [replyMap])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(t)
  }, [toast])

  /* 从聊天里的引用点进来：直接落到知识库那栏并打开原文 */
  const focusDoc = params.get('doc')
  useEffect(() => {
    if (focusDoc) setTab('knowledge')
  }, [focusDoc])

  const wall = useMemo(() => attachReplies(wallBooks(own), replyMap), [own, replyMap])
  const mine = useMemo(() => attachReplies(own, replyMap), [own, replyMap])

  const filtered = useMemo(() => {
    const base = moodFilter === 'all' ? wall : wall.filter((b) => b.mood === moodFilter)
    return sortBooks(base, sort)
  }, [wall, moodFilter, sort])

  const readerBook = useMemo(() => {
    if (!readerId) return null
    return wall.find((b) => b.id === readerId) ?? mine.find((b) => b.id === readerId) ?? null
  }, [readerId, wall, mine])

  const notesOnMine = useMemo(
    () =>
      mine
        .flatMap((b) => b.replies.map((r) => ({ ...r, bookTitle: b.title })))
        .sort((a, b) => b.createdAt - a.createdAt),
    [mine],
  )

  const addReply = (bookId: string, content: string, color: number) => {
    const r: Reply = {
      id: uid(),
      bookId,
      author: myName,
      authorId: myId,
      content,
      color,
      createdAt: Date.now(),
    }
    setReplyMap((m) => ({ ...m, [bookId]: [...(m[bookId] ?? []), r] }))
  }

  const saveDraft = (draft: BookDraft) => {
    if (studio.mode === 'cover' && studio.editing) {
      const id = studio.editing.id
      setOwn((list) => list.map((b) => (b.id === id ? { ...b, cover: draft.cover } : b)))
      setStudio({ open: false, mode: 'create', editing: null })
      setToast('封面已经换好啦~')
      return
    }

    const book: Book = {
      id: uid(),
      authorId: myId,
      author: myName,
      title: draft.title,
      mood: draft.mood,
      content: draft.content,
      cover: draft.cover,
      visibility: draft.visibility,
      createdAt: Date.now(),
      replies: [],
    }
    setOwn((list) => [book, ...list])
    setStudio({ open: false, mode: 'create', editing: null })
    setTab(draft.visibility === 'public' ? 'wall' : 'mine')
    setMoodFilter('all')
    setSort('new')
    setToast(draft.visibility === 'public' ? '你的书已经放进书墙了，等一个懂的人翻开~' : '已经放进你的书架，只有你看得见')
  }

  const toggleVisibility = (id: string) => {
    sfx.pop(1)
    setOwn((list) =>
      list.map((b) => (b.id === id ? { ...b, visibility: b.visibility === 'public' ? 'private' : 'public' } : b)),
    )
    setToast('可见范围已经改好了')
  }

  const removeBook = (id: string) => {
    setOwn((list) => list.filter((b) => b.id !== id))
    setReplyMap((m) => {
      const next = { ...m }
      delete next[id]
      return next
    })
    setConfirmDelete(null)
    setToast('这本书已经收起来了')
  }

  const openStudio = (mode: 'create' | 'cover', editing: Book | null = null) => {
    sfx.whoosh()
    setStudio({ open: true, mode, editing })
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Share Hut · Book Wall"
        icon={<Icon name="book" size={13} />}
        title="分享小屋"
        desc="每一本书都是一段真实的心事：一次没考好的模考、一个说不出口的困惑、一顿差点掉眼泪的晚饭。你可以写下自己的，也可以翻开别人的，在书页上贴一张便签——不评判、不讲道理，只是陪着。"
        right={
          <div className="flex items-center gap-2">
            <div className="hidden rounded-2xl border border-white/70 bg-white/55 px-3.5 py-2 text-center sm:block">
              <p className="font-display text-lg font-semibold leading-none text-ink-900">{wall.length}</p>
              <p className="mt-1 text-[10px] text-ink-400">本书在架</p>
            </div>
            <div className="hidden rounded-2xl border border-white/70 bg-white/55 px-3.5 py-2 text-center sm:block">
              <p className="font-display text-lg font-semibold leading-none text-ink-900">{countNotes(wall)}</p>
              <p className="mt-1 text-[10px] text-ink-400">张暖心便签</p>
            </div>
            <button onClick={() => openStudio('create')} className="btn-primary px-4 py-2.5 text-[12.5px]">
              <Icon name="feather" size={14} />
              写一本书
            </button>
          </div>
        }
      />

      {/* 分栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex rounded-full border border-white/70 bg-white/45 p-1 backdrop-blur">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key)
                sfx.tick()
              }}
              className={`relative rounded-full px-4 py-2 text-[12px] transition ${
                tab === t.key ? 'text-ink-900' : 'text-ink-400 hover:text-ink-700'
              }`}
              role="tab"
              aria-selected={tab === t.key}
            >
              {tab === t.key && (
                <motion.span
                  layoutId="library-tab"
                  className="absolute inset-0 rounded-full bg-white shadow-[0_6px_16px_-10px_rgba(46,96,112,0.6)]"
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                />
              )}
              <span className="relative">{t.label}</span>
            </button>
          ))}
        </div>

        <p className="text-[10.5px] tracking-[0.12em] text-ink-300">
          {tab === 'wall' ? '点一本书翻开 · 读完可以留一张便签' : tab === 'mine' ? '只属于你的一格书架' : '岛主回答的出处'}
        </p>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.24 }}
          className="mt-5"
        >
          {tab === 'wall' && (
            <>
              {/* 筛选 */}
              <div className="flex flex-col gap-2.5 rounded-4xl border border-white/70 bg-white/40 px-3.5 py-3 backdrop-blur-sm sm:flex-row sm:items-center">
                <div className="no-bar flex flex-1 gap-1.5 overflow-x-auto">
                  <button
                    onClick={() => setMoodFilter('all')}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] transition ${
                      moodFilter === 'all'
                        ? 'border-sea-300 bg-white text-sea-700 shadow-sm'
                        : 'border-white/70 bg-white/45 text-ink-500 hover:bg-white/80'
                    }`}
                  >
                    全部情绪
                  </button>
                  {MOOD_KEYS.map((k) => (
                    <button
                      key={k}
                      onClick={() => setMoodFilter(k)}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] transition ${
                        moodFilter === k
                          ? 'border-sea-300 bg-white text-sea-700 shadow-sm'
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
                <div className="flex shrink-0 items-center gap-1">
                  {SORTS.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setSort(s.key)}
                      className={`rounded-full px-2.5 py-1.5 text-[10.5px] transition ${
                        sort === s.key ? 'bg-white text-ink-800 shadow-sm' : 'text-ink-400 hover:bg-white/70'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {filtered.length > 0 ? (
                <div className="mt-3 rounded-[2rem] border border-white/60 bg-gradient-to-b from-white/40 to-white/12 px-2 py-2 sm:px-4">
                  <BookWall books={filtered} onOpen={(b) => setReaderId(b.id)} onCreate={() => openStudio('create')} />
                </div>
              ) : (
                <div className="mt-3 rounded-[2rem] border border-dashed border-sea-200/70 bg-white/35 px-6 py-14 text-center">
                  <p className="font-display text-[15px] text-ink-600">
                    这一格书架还空着，{moodFilter === 'all' ? '' : `暂时没有「${MOODS[moodFilter].label}」的书`}
                  </p>
                  <p className="mt-2 text-[11.5px] text-ink-400">要不要把你的那一本放上来，做第一个？</p>
                  <div className="mt-5 flex justify-center gap-2">
                    <button onClick={() => setMoodFilter('all')} className="btn-ghost px-4 py-2 text-[11.5px]">
                      看看全部
                    </button>
                    <button onClick={() => openStudio('create')} className="btn-primary px-4 py-2 text-[11.5px]">
                      写一本
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-5 flex items-start gap-2.5 rounded-3xl border border-white/70 bg-white/45 px-4 py-3.5">
                <Icon name="heart" size={14} className="mt-0.5 shrink-0 text-coral-400" />
                <p className="text-[11.5px] leading-relaxed text-ink-500">
                  书墙上的每一本都由岛民亲手写下、亲手做了封面。留下便签的时候，不必急着给建议——
                  <strong className="font-medium text-ink-700">「我也这样过」</strong>
                  往往比「你应该」更有力量。所有内容只保存在这台设备上。
                </p>
              </div>
            </>
          )}

          {tab === 'mine' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sea-500">My Shelf</p>
                  <h2 className="mt-1.5 font-display text-[19px] font-semibold text-ink-900">
                    我的书架 <span className="text-[11px] font-normal text-ink-300">· {mine.length} 本</span>
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="chip">
                    <Icon name="mail" size={11} />
                    收到 {notesOnMine.length} 张便签
                  </span>
                  <button onClick={() => openStudio('create')} className="btn-ghost px-3.5 py-2 text-[11.5px]">
                    <Icon name="feather" size={12} />
                    写一本
                  </button>
                </div>
              </div>

              {mine.length === 0 ? (
                <div className="rounded-[2rem] border border-dashed border-sea-200/70 bg-white/35 px-6 py-14 text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/80 text-sea-500 shadow-sm">
                    <Icon name="book" size={22} />
                  </span>
                  <p className="mt-4 font-display text-[15.5px] text-ink-700">你的书架还空着</p>
                  <p className="mx-auto mt-2 max-w-sm text-[11.5px] leading-relaxed text-ink-400">
                    写下第一本小书吧。可以只有一句话，也可以是一段很久没对人说过的心事。
                  </p>
                  <button onClick={() => openStudio('create')} className="btn-primary mt-5 px-5 py-2.5 text-[12px]">
                    <Icon name="feather" size={14} />
                    写第一本书
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
                  {mine.map((b, i) => (
                    <motion.div
                      key={b.id}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.04, 0.24), duration: 0.35 }}
                      className="group rounded-[18px] border border-white/70 bg-white/55 p-2.5 transition hover:-translate-y-1 hover:bg-white/85 hover:shadow-soft"
                    >
                      <button onClick={() => setReaderId(b.id)} className="block w-full text-left focus-ring">
                        <div className="overflow-hidden rounded-[8px] shadow-[0_12px_22px_-18px_rgba(46,96,112,0.7)] transition group-hover:shadow-[0_18px_28px_-18px_rgba(46,96,112,0.7)]">
                          <BookCover cover={b.cover} title={b.title} author={b.author} mood={b.mood} size="sm" />
                        </div>
                      </button>
                      <div className="mt-2 flex items-start justify-between gap-1">
                        <p className="truncate text-[11px] font-medium text-ink-800">{b.title}</p>
                        <span className="mt-0.5 flex shrink-0 items-center gap-0.5 text-[9px] text-ink-300">
                          <Icon name="mail" size={9} />
                          {b.replies.length}
                        </span>
                      </div>
                      <p className="mt-0.5 flex items-center gap-1 text-[9px] text-ink-300">
                        <span className="h-1 w-1 rounded-full" style={{ background: MOODS[b.mood].dot }} />
                        {MOODS[b.mood].label} · {timeAgo(b.createdAt)}
                      </p>

                      <div className="mt-2 flex items-center gap-1 border-t border-white/70 pt-2">
                        <button
                          onClick={() => toggleVisibility(b.id)}
                          className={`flex items-center gap-1 rounded-full px-1.5 py-1 text-[9.5px] transition ${
                            b.visibility === 'public'
                              ? 'bg-sea-50 text-sea-600 hover:bg-sea-100'
                              : 'bg-ink-900/5 text-ink-400 hover:bg-ink-900/10'
                          }`}
                          aria-label={b.visibility === 'public' ? '设为私密' : '设为公开'}
                        >
                          <Icon name={b.visibility === 'public' ? 'eye' : 'lock'} size={9} />
                          {b.visibility === 'public' ? '公开' : '私密'}
                        </button>
                        <button
                          onClick={() => openStudio('cover', b)}
                          className="rounded-full px-1.5 py-1 text-[9.5px] text-ink-400 transition hover:bg-white hover:text-sea-600"
                          aria-label="编辑封面"
                        >
                          改封面
                        </button>
                        <button
                          onClick={() => (confirmDelete === b.id ? removeBook(b.id) : setConfirmDelete(b.id))}
                          className={`ml-auto rounded-full px-1.5 py-1 text-[9.5px] transition ${
                            confirmDelete === b.id
                              ? 'bg-coral-300/30 text-[#c2634f]'
                              : 'text-ink-300 hover:bg-white hover:text-coral-500'
                          }`}
                          aria-label="删除这本书"
                        >
                          {confirmDelete === b.id ? '再点一次' : <Icon name="trash" size={10} />}
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              <div className="rounded-[2rem] border border-white/70 bg-white/45 p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sea-500">Notes for You</p>
                    <h3 className="mt-1 font-display text-[16px] font-semibold text-ink-900">收到的暖心便签</h3>
                  </div>
                  <span className="text-[10.5px] text-ink-300">{notesOnMine.length} 张</span>
                </div>

                {notesOnMine.length === 0 ? (
                  <p className="mx-auto mt-4 max-w-xl rounded-2xl border border-dashed border-sea-200/70 bg-white/40 px-4 py-8 text-center text-[11.5px] leading-relaxed text-ink-400">
                    还没有人留下便签。把书设为公开，它会被更多岛上的人看见。
                  </p>
                ) : (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {notesOnMine.map((n, i) => (
                      <div key={n.id} className="space-y-1.5">
                        <p className="flex items-center gap-1 text-[9.5px] text-ink-300">
                          <Icon name="book" size={9} />
                          贴在《{n.bookTitle}》
                        </p>
                        <StickyNote text={n.content} author={n.author} time={timeAgo(n.createdAt)} color={n.color + i} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'knowledge' && <KnowledgePane focusDocId={focusDoc} />}
        </motion.div>
      </AnimatePresence>

      {/* 阅读器 */}
      <BookReader
        book={readerBook}
        myName={myName}
        onClose={() => {
          setReaderId(null)
          if (params.get('doc')) {
            params.delete('doc')
            setParams(params, { replace: true })
          }
        }}
        onReply={addReply}
        onToast={setToast}
      />

      {/* 写作 / 封面设计 */}
      <BookStudio
        open={studio.open}
        mode={studio.mode}
        editing={studio.editing}
        author={myName}
        onClose={() => setStudio({ open: false, mode: 'create', editing: null })}
        onSave={saveDraft}
      />

      {/* 提示：挂到 body，避免页面入场动画的 filter 改变 fixed 的定位容器 */}
      {createPortal(
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              className="pointer-events-none fixed bottom-24 left-1/2 z-[90] w-[min(92vw,420px)] -translate-x-1/2"
              role="status"
              aria-live="polite"
            >
              <div className="flex items-center gap-2.5 rounded-full border border-white/80 bg-white/92 px-4 py-2.5 shadow-[0_24px_50px_-28px_rgba(46,96,112,0.7)] backdrop-blur-xl">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sea-100 to-lav-100 text-sea-600">
                  <Icon name="heart" size={12} />
                </span>
                <p className="text-[12px] text-ink-700">{toast}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}
