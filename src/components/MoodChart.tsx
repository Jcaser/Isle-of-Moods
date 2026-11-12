import { useMemo, useState } from 'react'
import type { DayPoint } from '../lib/mood'

interface Props {
  points: DayPoint[]
  height?: number
  compact?: boolean
}

/** 平滑曲线路径（Catmull-Rom → 三次贝塞尔） */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (!pts.length) return ''
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`
  let d = `M${pts[0].x},${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`
  }
  return d
}

export function MoodChart({ points, height = 180, compact }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 640
  const H = height
  const padL = compact ? 8 : 30
  const padR = compact ? 8 : 14
  const padT = 12
  const padB = compact ? 18 : 26

  const valid = points.filter((p) => p.avg !== null)
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const coords = useMemo(
    () =>
      points.map((p, i) => ({
        ...p,
        x: padL + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW),
        y: p.avg === null ? null : padT + innerH - ((p.avg - 1) / 4) * innerH,
      })),
    [points, innerW, innerH, padL, padT],
  )

  const line = smoothPath(coords.filter((c) => c.y !== null).map((c) => ({ x: c.x, y: c.y! })))
  const area = line
    ? `${line} L${coords.filter((c) => c.y !== null).slice(-1)[0]?.x ?? 0},${H - padB} L${
        coords.filter((c) => c.y !== null)[0]?.x ?? 0
      },${H - padB} Z`
    : ''

  const active = hover !== null ? coords[hover] : null

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={`情绪趋势图，共 ${valid.length} 天有记录`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="moodArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#94cdd9" stopOpacity="0.45" />
            <stop offset="55%" stopColor="#c4b9ec" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#c4b9ec" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="moodLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#66b2c3" />
            <stop offset="60%" stopColor="#8fb6c9" />
            <stop offset="100%" stopColor="#a99be0" />
          </linearGradient>
        </defs>

        {/* 网格 */}
        {[1, 2, 3, 4, 5].map((v) => {
          const y = padT + innerH - ((v - 1) / 4) * innerH
          return (
            <g key={v}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(120,160,175,0.14)" strokeDasharray={v === 3 ? '' : '3 5'} />
              {!compact && (
                <text x={padL - 8} y={y + 3.5} textAnchor="end" fontSize="9" fill="#a8b6bd">
                  {v}
                </text>
              )}
            </g>
          )
        })}

        {area && <path d={area} fill="url(#moodArea)" />}
        {line && <path d={line} fill="none" stroke="url(#moodLine)" strokeWidth={2.2} strokeLinecap="round" />}

        {coords.map((c, i) =>
          c.y === null ? null : (
            <g key={c.key}>
              <circle
                cx={c.x}
                cy={c.y}
                r={active?.key === c.key ? 5.5 : 3.4}
                fill="#ffffff"
                stroke="#7fb9c8"
                strokeWidth={1.8}
                className="transition-all"
              />
              <rect
                x={c.x - 10}
                y={0}
                width={20}
                height={H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                tabIndex={0}
                role="button"
                aria-label={`${c.label}，${c.avg?.toFixed(1)} 分`}
              />
            </g>
          ),
        )}

        {/* x 轴标签 */}
        {!compact &&
          coords.map((c, i) => {
            const step = Math.ceil(points.length / 7)
            if (i % step !== 0 && i !== points.length - 1) return null
            return (
              <text key={`l-${c.key}`} x={c.x} y={H - 7} textAnchor="middle" fontSize="9" fill="#a8b6bd">
                {c.label}
              </text>
            )
          })}
      </svg>

      {active && active.y !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-xl bg-white/95 px-2.5 py-1.5 text-[10.5px] shadow-md"
          style={{ left: `${(active.x / W) * 100}%`, top: Math.max(0, active.y - 44) }}
        >
          <span className="font-medium text-ink-900">{active.label}</span>
          <span className="ml-1.5 text-sea-600">{active.avg?.toFixed(1)} 分</span>
        </div>
      )}

      {!valid.length && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-[12px] text-ink-300">还没有记录，今天先打个卡吧</p>
        </div>
      )}
    </div>
  )
}
