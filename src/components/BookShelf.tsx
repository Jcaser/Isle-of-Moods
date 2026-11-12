import type { KnowledgeDoc } from '../lib/knowledge'
import { Icon } from './Icons'

const SPINE: Record<string, { base: string; edge: string; text: string }> = {
  焦虑机制: { base: '#8fc0cd', edge: '#6ea9b9', text: 'rgba(255,255,255,0.95)' },
  'CBT 认知': { base: '#b3a4e2', edge: '#9887d2', text: 'rgba(255,255,255,0.95)' },
  放松技术: { base: '#9ecfdc', edge: '#7fbccb', text: 'rgba(255,255,255,0.95)' },
  睡眠: { base: '#a9a8d8', edge: '#8d8cc6', text: 'rgba(255,255,255,0.95)' },
  学习策略: { base: '#dcc7a4', edge: '#c9b089', text: 'rgba(255,255,255,0.98)' },
  危机识别: { base: '#e6a795', edge: '#d18f7b', text: 'rgba(255,255,255,0.98)' },
}

/** 书架：把文档做成能抽出来的书脊，和下面的卡片网格形成两种浏览节奏 */
export function BookShelf({ docs, onOpen }: { docs: KnowledgeDoc[]; onOpen: (d: KnowledgeDoc) => void }) {
  const shelf = docs.slice(0, 12)

  return (
    <div className="relative">
      <div className="flex items-end justify-center gap-[5px] overflow-x-auto px-1 pb-0 pt-3 no-bar sm:gap-2">
        {shelf.map((d, i) => {
          const tone = SPINE[d.category] ?? SPINE['焦虑机制']
          const height = 128 + ((d.title.length * 7) % 52)
          const width = 24 + (i % 3) * 3
          return (
            <button
              key={d.id}
              onClick={() => onOpen(d)}
              title={d.title}
              className="group relative shrink-0 origin-bottom rounded-t-[4px] transition-all duration-400 hover:-translate-y-2 focus-ring"
              style={{ height, width }}
              aria-label={`打开《${d.title}》`}
            >
              <span
                className="absolute inset-0 rounded-t-[4px] shadow-[0_6px_14px_-8px_rgba(46,96,112,0.55)] transition group-hover:shadow-[0_14px_22px_-10px_rgba(46,96,112,0.6)]"
                style={{
                  background: `linear-gradient(90deg, ${tone.edge} 0%, ${tone.base} 18%, ${tone.base} 74%, ${tone.edge} 100%)`,
                }}
              />
              {/* 书脊压印 */}
              <span className="absolute inset-x-[3px] top-2 h-[1px] bg-white/25" />
              <span className="absolute inset-x-[3px] bottom-3 h-[1px] bg-white/20" />
              <span
                className="absolute inset-x-0 top-3.5 mx-auto block w-[13px] overflow-hidden text-center text-[10px] font-medium leading-[1.2] tracking-[0.02em]"
                style={{
                  writingMode: 'vertical-rl',
                  color: tone.text,
                  maxHeight: height - 36,
                }}
              >
                {d.title.replace(/：.*$/, '').slice(0, 12)}
              </span>
              {/* 分类色签 */}
              <span className="absolute bottom-1.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white/70" />
            </button>
          )
        })}
        <button
          onClick={() => onOpen(docs[Math.floor(Math.random() * docs.length)])}
          className="mb-1 ml-3 flex h-[86px] w-[40px] shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-sea-200/90 bg-white/45 text-[9px] leading-tight text-sea-600 transition hover:-translate-y-1 hover:bg-white/75"
          aria-label="随机翻开一本"
        >
          <Icon name="sparkles" size={13} />
          随机
          <br />
          一本
        </button>
      </div>

      {/* 隔板 */}
      <div className="relative">
        <div className="h-[5px] rounded-full bg-gradient-to-b from-[#f2e7d2] to-[#ddcbaa] shadow-[0_5px_12px_-7px_rgba(120,96,64,0.5)]" />
        <div className="mx-auto h-[2px] w-[97%] rounded-b-full bg-[#d3bf9d]/40 blur-[1.5px]" />
      </div>
    </div>
  )
}
