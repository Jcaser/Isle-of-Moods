import { useMemo, useState } from 'react'
import { MOOD_META, dayKey, summarize } from '../lib/mood'
import type { MoodScore } from '../lib/types'
import { useAppStore } from '../store/useAppStore'

const LEVEL_COLOR: Record<MoodScore, string> = {
  1: '#dde8ec',
  2: '#c3dde4',
  3: '#9ccbd8',
  4: '#6fb2c5',
  5: '#3f8fa4',
}

const WEEK_LABEL = ['一', '二', '三', '四', '五', '六', '日']

/** 潮汐日历：把最近 14 周的情绪画成一片海，颜色越深代表潮位越高 */
export function MoodHeatmap() {
  const records = useAppStore((s) => s.records)
  const [hover, setHover] = useState<{ key: string; avg: number; n: number; tags: string[] } | null>(null)

  const s14 = useMemo(() => summarize(records, 14), [records])

  const byDay = useMemo(() => {
    const map = new Map<string, { sum: number; n: number; tags: string[] }>()
    for (const r of records) {
      const k = dayKey(r.ts)
      const cur = map.get(k) ?? { sum: 0, n: 0, tags: [] }
      cur.sum += r.score
      cur.n += 1
      for (const t of r.tags) if (!cur.tags.includes(t)) cur.tags.push(t)
      map.set(k, cur)
    }
    return map
  }, [records])

  const { weeks, monthMarks, activeDays } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dow = (today.getDay() + 6) % 7
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - dow)

    const total = 14
    const start = new Date(weekStart)
    start.setDate(weekStart.getDate() - (total - 1) * 7)

    const cols: { key: string; date: Date; avg: number | null; n: number; isFuture: boolean; isToday: boolean }[][] = []
    const marks: { col: number; label: string }[] = []
    let lastMonth = -1

    for (let w = 0; w < total; w++) {
      const col: (typeof cols)[number] = []
      for (let d = 0; d < 7; d++) {
        const date = new Date(start)
        date.setDate(start.getDate() + w * 7 + d)
        const key = dayKey(date.getTime())
        const hit = byDay.get(key)
        col.push({
          key,
          date,
          avg: hit ? hit.sum / hit.n : null,
          n: hit?.n ?? 0,
          isFuture: date.getTime() > today.getTime(),
          isToday: date.getTime() === today.getTime(),
        })
        if (d === 0 && date.getMonth() !== lastMonth) {
          lastMonth = date.getMonth()
          marks.push({ col: w, label: `${date.getMonth() + 1}月` })
        }
      }
      cols.push(col)
    }

    let active = 0
    for (const col of cols) for (const c of col) if (c.avg !== null) active++
    return { weeks: cols, monthMarks: marks, activeDays: active }
  }, [byDay])

  return (
    <div className="lux p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sea-500">Tide Calendar</p>
          <p className="mt-1 font-display text-[16px] font-semibold tracking-tight text-ink-900">最近 14 周的潮汐</p>
        </div>
        <p className="text-[11px] text-ink-400">
          有记录 <span className="tnum font-medium text-ink-700">{activeDays}</span> 天 · 每天一格
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex shrink-0 gap-2">
        {/* 星期标签 */}
        <div className="flex shrink-0 flex-col gap-[4px] pt-[15px]">
          {WEEK_LABEL.map((w, i) => (
            <span key={w} className="flex h-[15px] items-center text-[9px] leading-none text-ink-300">
              {i % 2 === 0 ? w : ''}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto no-bar">
          {/* 月份标记 */}
          <div className="relative mb-1 h-[11px]" style={{ width: weeks.length * 19 }}>
            {monthMarks.map((m) => (
              <span
                key={`${m.col}-${m.label}`}
                className="absolute text-[9px] leading-none text-ink-300"
                style={{ left: m.col * 19 }}
              >
                {m.label}
              </span>
            ))}
          </div>

          <div
            className="grid gap-[4px]"
            style={{ gridTemplateColumns: `repeat(${weeks.length}, 15px)`, gridAutoFlow: 'column', gridTemplateRows: 'repeat(7, 15px)' }}
          >
            {weeks.map((col) =>
              col.map((cell) => {
                const lvl = cell.avg ? (Math.round(cell.avg) as MoodScore) : null
                return (
                  <button
                    key={cell.key}
                    onMouseEnter={() =>
                      cell.avg !== null &&
                      setHover({
                        key: cell.key,
                        avg: cell.avg,
                        n: cell.n,
                        tags: byDay.get(cell.key)?.tags ?? [],
                      })
                    }
                    onMouseLeave={() => setHover(null)}
                    onClick={() => {
                      if (cell.avg !== null) {
                        setHover({ key: cell.key, avg: cell.avg, n: cell.n, tags: byDay.get(cell.key)?.tags ?? [] })
                      }
                    }}
                    title={
                      cell.avg !== null
                        ? `${cell.date.getMonth() + 1}月${cell.date.getDate()}日 · ${cell.avg.toFixed(1)}/5 · ${cell.n} 条`
                        : `${cell.date.getMonth() + 1}月${cell.date.getDate()}日 · 无记录`
                    }
                    className={`rounded-[3.5px] transition-transform duration-200 hover:scale-[1.35] ${
                      cell.isToday ? 'ring-[1.5px] ring-sea-500 ring-offset-1 ring-offset-white/60' : ''
                    } ${cell.isFuture ? 'opacity-30' : ''}`}
                    style={{
                      background: lvl ? LEVEL_COLOR[lvl] : 'rgba(214,228,232,0.42)',
                      cursor: cell.avg !== null ? 'pointer' : 'default',
                    }}
                    aria-label={cell.avg !== null ? `${cell.key} 情绪 ${cell.avg.toFixed(1)} 分` : `${cell.key} 无记录`}
                  />
                )
              }),
            )}
          </div>
        </div>
        </div>

        <div className="grid flex-1 grid-cols-3 gap-2.5">
          {[
            { k: '近 14 天平均', v: s14.avg !== null ? s14.avg.toFixed(1) : '—', u: '/5' },
            { k: '记录天数', v: s14.count, u: '次' },
            { k: '最长连续', v: s14.streak, u: '天' },
          ].map((x) => (
            <div key={x.k} className="rounded-2xl border border-white/70 bg-white/55 px-3 py-2.5">
              <p className="text-[10px] text-ink-400">{x.k}</p>
              <p className="tnum mt-1 font-display text-[19px] font-semibold leading-none tracking-tight text-ink-900">
                {x.v}
                <span className="ml-0.5 text-[10px] font-normal text-ink-300">{x.u}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/60 pt-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-ink-300">低</span>
          {([1, 2, 3, 4, 5] as MoodScore[]).map((s) => (
            <span key={s} className="h-[15px] w-[15px] rounded-[4px]" style={{ background: LEVEL_COLOR[s] }} />
          ))}
          <span className="text-[10px] text-ink-300">高</span>
        </div>

        <p className="min-h-[16px] text-[11px] text-ink-500">
          {hover ? (
            <>
              <span className="font-medium text-ink-900">{hover.key}</span>
              <span className="mx-1.5 text-ink-300">·</span>
              平均 {hover.avg.toFixed(1)}/5（{MOOD_META[Math.round(hover.avg) as MoodScore].label}）
              {hover.tags.length > 0 && (
                <>
                  <span className="mx-1.5 text-ink-300">·</span>
                  {hover.tags.slice(0, 3).join('、')}
                </>
              )}
            </>
          ) : (
            <span className="text-ink-300">把鼠标放到格子上，看看那一天</span>
          )}
        </p>
      </div>
    </div>
  )
}
