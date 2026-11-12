import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { Icon } from '../components/Icons'
import { MoodCheckIn } from '../components/MoodCheckIn'
import { MoodChart } from '../components/MoodChart'
import { PageHeader } from '../components/PageHeader'
import { LEVEL_META } from '../lib/assessment'
import { MOOD_META, buildSeries, dayKey, insightOf, summarize } from '../lib/mood'
import type { MoodScore } from '../lib/types'
import { useAppStore } from '../store/useAppStore'

export default function Mood() {
  const records = useAppStore((s) => s.records)
  const assessments = useAppStore((s) => s.assessments)
  const removeMood = useAppStore((s) => s.removeMood)
  const setAssessmentOpen = useAppStore((s) => s.setAssessmentOpen)

  const [range, setRange] = useState<7 | 30>(7)

  const series = useMemo(() => buildSeries(records, range), [records, range])
  const summary = useMemo(() => summarize(records, range), [records, range])
  const insight = insightOf(summary)

  const distribution = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const r of records) counts[r.score] = (counts[r.score] ?? 0) + 1
    const total = records.length || 1
    return [1, 2, 3, 4, 5].map((s) => ({ score: s as MoodScore, n: counts[s], pct: (counts[s] / total) * 100 }))
  }, [records])

  const latestAssessment = assessments[0]

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Mood Tide"
        icon={<Icon name="chart" size={13} />}
        title="情绪潮向"
        desc="情绪不是一条直线，而是一条有涨落的潮汐。记录下来，你才能看清自己是在退潮，还是在慢慢回涨。"
        right={
          <div className="flex gap-2">
            <button onClick={() => setAssessmentOpen(true)} className="btn-ghost text-[12.5px]">
              <Icon name="chart" size={15} />
              GAD-7 自评
            </button>
          </div>
        }
      />

      {/* 指标 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: `近 ${range} 天平均`,
            value: summary.avg !== null ? summary.avg.toFixed(1) : '—',
            unit: '/5',
            hint:
              summary.delta !== null
                ? `${summary.delta >= 0 ? '↑' : '↓'} 较上一周期 ${Math.abs(summary.delta).toFixed(1)}`
                : '暂无对比数据',
            tone: summary.delta !== null && summary.delta < 0 ? 'text-coral-500' : 'text-sea-600',
          },
          { label: '连续记录', value: `${summary.streak}`, unit: '天', hint: '每天 30 秒即可', tone: 'text-lav-500' },
          { label: '记录次数', value: `${summary.count}`, unit: '次', hint: `共 ${records.length} 条历史`, tone: 'text-sea-600' },
          {
            label: '低潮天数',
            value: `${summary.lowDays}`,
            unit: '天',
            hint: summary.lowDays >= 3 ? '建议做一次自评' : '状态可调节',
            tone: summary.lowDays >= 3 ? 'text-coral-500' : 'text-ink-500',
          },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-3xl border border-white/70 bg-white/55 p-4 backdrop-blur"
          >
            <p className="text-[10.5px] text-ink-400">{s.label}</p>
            <p className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-ink-900">
              {s.value}
              <span className="ml-0.5 text-[11px] font-normal text-ink-300">{s.unit}</span>
            </p>
            <p className={`mt-1 text-[10.5px] ${s.tone}`}>{s.hint}</p>
          </motion.div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        {/* 趋势 */}
        <div className="glass p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink-900">潮位变化</h2>
              <p className="mt-0.5 text-[11px] text-ink-400">纵轴 1 = 很低落，5 = 很舒展；悬停查看当天均值</p>
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
            <MoodChart points={series} height={210} />
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-2xl bg-sea-50/70 px-4 py-3">
            <Icon name="compass" size={15} className="mt-0.5 shrink-0 text-lav-400" />
            <p className="text-[12px] leading-relaxed text-ink-600">{insight}</p>
          </div>
        </div>

        {/* 分布 + 打卡 */}
        <div className="space-y-4">
          <div className="glass p-5">
            <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink-900">情绪分布</h2>
            <div className="mt-3 space-y-2.5">
              {distribution
                .slice()
                .reverse()
                .map((d) => (
                  <div key={d.score} className="flex items-center gap-2.5">
                    <span className="w-12 shrink-0 text-[10.5px] text-ink-400">{MOOD_META[d.score].label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/70">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${d.pct}%` }}
                        transition={{ duration: 0.6 }}
                        className="h-full rounded-full"
                        style={{ background: MOOD_META[d.score].color }}
                      />
                    </div>
                    <span className="w-6 shrink-0 text-right text-[10.5px] tabular-nums text-ink-400">{d.n}</span>
                  </div>
                ))}
            </div>
            {summary.topTags.length > 0 && (
              <div className="mt-4 border-t border-white/60 pt-3">
                <p className="text-[10.5px] text-ink-400">高频影响因素</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {summary.topTags.map((t) => (
                    <span key={t.tag} className="chip text-[10px]">
                      {t.tag} · {t.n}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <MoodCheckIn compact />
        </div>
      </div>

      {/* 自评历史 */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="glass p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink-900">GAD-7 自评记录</h2>
            <button onClick={() => setAssessmentOpen(true)} className="text-[11px] text-sea-600">
              重新测 →
            </button>
          </div>

          {latestAssessment ? (
            <>
              <div className="mt-4 flex items-end gap-4">
                <div>
                  <p className="font-display text-4xl font-semibold tracking-tight text-ink-900">{latestAssessment.total}</p>
                  <p className="text-[10.5px] text-ink-400">最近一次 / 21 分</p>
                </div>
                <div className="mb-1">
                  <span
                    className="rounded-full px-3 py-1 text-[11.5px] font-medium"
                    style={{
                      background: `${LEVEL_META[latestAssessment.level].color}22`,
                      color: LEVEL_META[latestAssessment.level].color,
                    }}
                  >
                    {LEVEL_META[latestAssessment.level].label}
                  </span>
                  <p className="mt-1 text-[10.5px] text-ink-400">
                    {new Date(latestAssessment.ts).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-ink-500">{LEVEL_META[latestAssessment.level].advice}</p>

              {assessments.length > 1 && (
                <div className="mt-4 space-y-1.5">
                  {assessments.slice(1, 5).map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded-xl bg-white/55 px-3 py-1.5">
                      <span className="text-[11px] text-ink-500">
                        {new Date(a.ts).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(a.total / 21) * 100}%`,
                              background: LEVEL_META[a.level].color,
                            }}
                          />
                        </div>
                        <span className="w-6 text-right text-[11px] tabular-nums text-ink-500">{a.total}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="mt-6 flex flex-col items-center py-4 text-center">
              <Icon name="chart" size={26} className="text-sea-300" />
              <p className="mt-2 text-[12px] text-ink-400">还没有自评记录</p>
              <button onClick={() => setAssessmentOpen(true)} className="btn-ghost mt-3 text-[11.5px]">
                花 1 分钟测一次
              </button>
            </div>
          )}
          <p className="mt-4 text-[10px] leading-relaxed text-ink-300">
            GAD-7 为筛查量表，分数变化用于自我观察，不构成诊断。
          </p>
        </div>

        {/* 记录列表 */}
        <div className="glass p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink-900">最近的记录</h2>
            <span className="text-[10.5px] text-ink-300">仅存本机</span>
          </div>
          <div className="mt-3 max-h-[19rem] space-y-1.5 overflow-y-auto pr-1">
            {records.length === 0 && (
              <p className="py-8 text-center text-[12px] text-ink-300">还没有记录。从今天的一个"潮位"开始。</p>
            )}
            {records.slice(0, 40).map((r) => (
              <div key={r.id} className="group flex items-center gap-3 rounded-2xl bg-white/50 px-3 py-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: MOOD_META[r.score].color }}
                />
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
        </div>
      </div>
    </div>
  )
}
