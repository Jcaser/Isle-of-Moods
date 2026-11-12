import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../components/Icons'
import { BookShelf } from '../components/BookShelf'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { CATEGORIES, KNOWLEDGE_DOCS, type KnowledgeDoc } from '../lib/knowledge'
import { KB_STATS, searchDocs } from '../lib/rag'

const CATEGORY_TONE: Record<string, string> = {
  焦虑机制: 'bg-sea-100 text-sea-700',
  'CBT 认知': 'bg-lav-100 text-lav-500',
  放松技术: 'bg-sea-50 text-sea-600',
  睡眠: 'bg-[#e9e4f7] text-[#7c6bb8]',
  学习策略: 'bg-sand-100 text-[#a8895c]',
  危机识别: 'bg-coral-300/25 text-[#c2634f]',
}

export default function Library() {
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState<string>('全部')
  const [params, setParams] = useSearchParams()
  const [active, setActive] = useState<KnowledgeDoc | null>(null)
  const navigate = useNavigate()

  const docs = useMemo(() => searchDocs(keyword, category), [keyword, category])

  useEffect(() => {
    const id = params.get('doc')
    if (id) {
      const doc = KNOWLEDGE_DOCS.find((d) => d.id === id)
      if (doc) setActive(doc)
    }
  }, [params])

  const closeReader = () => {
    setActive(null)
    if (params.get('doc')) {
      params.delete('doc')
      setParams(params, { replace: true })
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Repository · RAG"
        icon={<Icon name="book" size={13} />}
        title="屿藏书阁"
        desc="考前心理的私有知识库：教育心理学、CBT、睡眠与学习科学。岛主的每一次回答都会先在这里检索，并标注出处——用检索约束生成，减少一本正经的胡说。"
        right={
          <div className="flex gap-2">
            <div className="rounded-2xl border border-white/70 bg-white/55 px-3.5 py-2 text-center">
              <p className="font-display text-lg font-semibold leading-none text-ink-900">{KB_STATS.docs}</p>
              <p className="mt-1 text-[10px] text-ink-400">篇条目</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/55 px-3.5 py-2 text-center">
              <p className="font-display text-lg font-semibold leading-none text-ink-900">{KB_STATS.chunks}</p>
              <p className="mt-1 text-[10px] text-ink-400">个检索片段</p>
            </div>
          </div>
        }
      />

      {/* 书架 */}
      <section className="mb-6 rounded-5xl border border-white/70 bg-gradient-to-b from-white/55 to-white/25 px-3 py-4 backdrop-blur-sm sm:px-5">
        <div className="mb-1 flex items-center justify-between px-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sea-500">The Shelf</p>
          <p className="text-[10.5px] text-ink-300">点书脊，直接翻开</p>
        </div>
        <BookShelf docs={KNOWLEDGE_DOCS} onOpen={(d) => setActive(d)} />
      </section>

      {/* 检索条 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Icon name="book" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索：失眠 / 灾难化 / 拖延 / 呼吸…"
            className="input py-3 pl-11"
            aria-label="搜索知识库"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full border px-3 py-1.5 text-[11.5px] transition ${
                category === c
                  ? 'border-sea-300 bg-white/90 text-sea-700 shadow-sm'
                  : 'border-white/70 bg-white/45 text-ink-500 hover:bg-white/75'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* 说明 */}
      <div className="mt-4 flex items-start gap-2 rounded-3xl border border-white/70 bg-white/45 px-4 py-3 text-[11.5px] leading-relaxed text-ink-500">
        <Icon name="sparkles" size={14} className="mt-0.5 shrink-0 text-lav-400" />
        <p>
          检索采用<strong className="font-medium text-ink-700">本地 BM25 + 中文二元组分词 + 同义扩展</strong>
          ，按段落切块，答案中引用的编号可点开原文对照。所有计算在浏览器内完成，不上传任何内容。
        </p>
      </div>

      {/* 文档列表 */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {docs.map((d, i) => (
            <motion.button
              key={d.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.2) }}
              onClick={() => setActive(d)}
              className="group flex h-full flex-col rounded-4xl border border-white/70 bg-white/55 p-5 text-left shadow-soft transition-all duration-400 hover:-translate-y-1 hover:bg-white/85 hover:shadow-float"
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${CATEGORY_TONE[d.category] ?? 'bg-sea-50 text-sea-600'}`}>
                  {d.category}
                </span>
                <Icon name="arrowRight" size={14} className="text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-sea-500" />
              </div>
              <h3 className="mt-3 font-display text-[15.5px] font-semibold leading-snug tracking-tight text-ink-900">{d.title}</h3>
              <p className="mt-2 flex-1 text-[12px] leading-relaxed text-ink-500">{d.summary}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {d.tags.slice(0, 4).map((t) => (
                  <span key={t} className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] text-ink-400">
                    #{t}
                  </span>
                ))}
              </div>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      {docs.length === 0 && (
        <div className="mt-10 rounded-4xl border border-dashed border-sea-200/70 bg-white/40 px-6 py-12 text-center">
          <p className="text-[13px] text-ink-500">没有找到「{keyword}」相关的条目</p>
          <button
            onClick={() => {
              setKeyword('')
              setCategory('全部')
            }}
            className="btn-ghost mt-4 text-[12px]"
          >
            清空筛选
          </button>
        </div>
      )}

      {/* 阅读器 */}
      <Modal
        open={Boolean(active)}
        onClose={closeReader}
        title={active?.title}
        subtitle={active ? `${active.category} · 约 ${Math.ceil(active.content.length / 380)} 分钟读完` : undefined}
        maxWidth="max-w-3xl"
      >
        {active && (
          <article>
            <p className="rounded-2xl bg-sea-50/70 px-4 py-3 text-[12.5px] leading-relaxed text-ink-600">
              {active.summary}
            </p>
            <div className="md-body mt-4">
              {active.content.split(/\n{2,}/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-1">
              {active.tags.map((t) => (
                <span key={t} className="chip">
                  #{t}
                </span>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/60 pt-4">
              <button
                onClick={() => {
                  closeReader()
                  navigate(`/chat?q=${encodeURIComponent(`关于《${active.title}》，我想了解`)}`)
                }}
                className="btn-primary"
              >
                <Icon name="chat" size={15} />
                带着这篇去问岛主
              </button>
              <p className="text-[10.5px] text-ink-300">科普内容不构成诊疗建议</p>
            </div>
          </article>
        )}
      </Modal>
    </div>
  )
}
