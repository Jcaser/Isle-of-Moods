import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icons'
import { Journal } from '../components/Journal'
import { MoodCheckIn } from '../components/MoodCheckIn'
import { MoodChart } from '../components/MoodChart'
import { MoodPortrait } from '../components/MoodPortrait'
import { PageHeader } from '../components/PageHeader'
import { LEVEL_META } from '../lib/assessment'
import { MOOD_META, buildSeries, dayKey, buildPortraitLine, summarize } from '../lib/mood'
import { buildPortrait } from '../lib/portrait'
import { useAppStore } from '../store/useAppStore'

export default function Mood() {
  const records = useAppStore((s) => s.records)
  const assessments = useAppStore((s) => s.assessments)
  const removeMood = useAppStore((s) => s.removeMood)
  const setAssessmentOpen = useAppStore((s) => s.setAssessmentOpen)
  const openBreathing = useAppStore((s) => s.openBreathing)
  const navigate = useNavigate()

  const [range, setRange] = useState<7 | 30>(7)
  const [allRecords, setAllRecords] = useState(false)

  const series = useMemo(() => buildSeries(records, range), [records, range])
  const summary = useMemo(() => summarize(records, range), [records, range])
  const portrait = useMemo(() => buildPortrait(records, assessments), [records, assessments])
  const line = useMemo(() => buildPortraitLine(summary), [summary])

  const latestAssessment = assessments[0]
  const shown = allRecords ? records.slice(0, 40) : records.slice(0, 8)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Mood Tide"
        icon={<Icon name="chart" size={13} />}
        title="情绪潮向"
        desc="不是一张报表，是你这段时间起伏的形状。记录几次之后，这里会慢慢长出属于你的情绪画像。"
        right={
          <button onClick={() => setAssessmentOpen(true)} className="btn-ghost text-[12.5px]">
            <Icon name="chart" size={15} />
            GAD-7 自评
          </button>
        }
      />

      <MoodPortrait portrait={portrait} />

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.42fr_0.78fr]">
        <div className="glass p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink-900">潮位变化</h2>
              <p className="mt-0.5 text-[11px] text-ink-400">1 = 很低落，5 = 很舒展；悬停查看当天均值</p>
            </div>
            <div className="flex rounded-full bg-white/60 p-0.5">
              {[7, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setRange(d as 7 | 30)}
                  className={`rounded-full px-3 py-1 text-[11px] transition ${
                    range === d ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-400'
                  }`}
                >
                  {d} 天
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <MoodChart points={series} height={196} />
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-2xl bg-sea-50/70 px-4 py-3">
            <Icon name="compass" size={15} className="mt-0.5 shrink-0 text-lav-400" />
            <p className="text-[12px] leading-relaxed text-ink-600">{line}</p>
          </div>
        </div>

        <div className="space-y-4">
          <MoodCheckIn compact />

          <div className="rounded-4xl border border-white/70 bg-white/55 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-[13.5px] font-semibold text-ink-900">最近一次自评</h3>
              <button onClick={() => setAssessmentOpen(true)} className="text-[10.5px] text-sea-600">
                重测 →
              </button>
            </div>
            {latestAssessment ? (
              <div className="mt-2.5">
                <div className="flex items-end gap-2">
                  <p className="font-display text-[26px] font-semibold leading-none tracking-tight text-ink-900">
                    {latestAssessment.total}
                  </p>
                  <span className="mb-0.5 text-[10.5px] text-ink-300">/ 21</span>
                  <span
                    className="mb-0.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium"
                    style={{
                      background: `${LEVEL_META[latestAssessment.level].color}22`,
                      color: LEVEL_META[latestAssessment.level].color,
                    }}
                  >
                    {LEVEL_META[latestAssessment.level].label}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-ink-500">
                  {LEVEL_META[latestAssessment.level].advice}
                </p>
                <p className="mt-1 text-[10px] text-ink-300">
                  {new Date(latestAssessment.ts).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })} · 仅用于自我观察
                </p>
              </div>
            ) : (
              <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-400">
                还没测过。1 分钟 7 道题，帮你判断这段时间的焦虑水平。
              </p>
            )}
          </div>
        </div>
      </div>

      <Journal />

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.42fr_0.78fr]">
        <div className="glass p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink-900">最近的潮位</h2>
            <span className="text-[10.5px] text-ink-300">共 {records.length} 条 · 仅存本机</span>
          </div>
          <div className="mt-3 space-y-1.5">
            {records.length === 0 && (
              <p className="py-6 text-center text-[12px] text-ink-300">还没有记录。从今天的一个「潮位」开始。</p>
            )}
            {shown.map((r) => (
              <div key={r.id} className="group flex items-center gap-3 rounded-2xl bg-white/50 px-3 py-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: MOOD_META[r.score].color }} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink-800">
                    {MOOD_META[r.score].label}
                    {r.source === 'chat' && <span className="chip text-[9px]">对话记录</span>}
                  </p>
                  <p className="truncate text-[10.5px] text-ink-400">
                    {r.tags.length ? r.tags.join(' · ') : '未标注影响因素'}
                    {r.note ? ` · ${r.note}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-[10px] tabular-nums text-ink-300">
                  {dayKey(r.ts).slice(5)} {new Date(r.ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <button
                  onClick={() => removeMood(r.id)}
                  className="shrink-0 rounded-full p-1 text-ink-300 opacity-0 transition hover:bg-coral-300/20 hover:text-coral-500 group-hover:opacity-100"
                  aria-label="删除这条记录"
                >
                  <Icon name="trash" size={13} />
                </button>
              </div>
            ))}
          </div>
          {records.length > 8 && (
            <button onClick={() => setAllRecords((v) => !v)} className="mt-3 text-[11px] text-sea-600">
              {allRecords ? '收起' : `展开全部 ${records.length} 条`}
            </button>
          )}
        </div>

        <div className="flex flex-col rounded-4xl border border-white/70 bg-gradient-to-br from-white/65 to-lav-50/50 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-300">关于画像</p>
          <p className="mt-2 text-[11.5px] leading-[1.9] text-ink-500">
            画像只由「潮位记录 + 影响因素 + 自评」算出，全部在本机完成。它不会给你贴标签，
            也不会判断你「是不是有病」——只是把你自己没注意到的模式，摆到眼前。
          </p>
          <p className="mt-2.5 text-[10.5px] leading-relaxed text-ink-300">
            记录满 2 次开始生成；满 20 天，「记录习惯」这一维才会到顶。
          </p>
          <div className="mt-auto flex flex-wrap gap-2 pt-4">
            <button onClick={() => openBreathing('coherent')} className="btn-ghost text-[11.5px]">
              <Icon name="wave" size={13} />
              做 1 分钟呼吸
            </button>
            <button onClick={() => navigate('/calm')} className="btn-quiet px-2.5 text-[11px]">
              去潮汐看看
              <Icon name="arrowRight" size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
