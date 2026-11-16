import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import type { Portrait } from '../lib/portrait'
import { useAppStore } from '../store/useAppStore'
import { Icon } from './Icons'
import { explainPortrait } from '../lib/portrait'

const SIZE = 300
const C = SIZE / 2
const R = 100

function point(i: number, n: number, r: number): [number, number] {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
  return [C + Math.cos(a) * r, C + Math.sin(a) * r]
}

function polygon(n: number, r: number) {
  return Array.from({ length: n }, (_, i) => point(i, n, r).join(',')).join(' ')
}

function Radar({ traits }: { traits: Portrait['traits'] }) {
  const n = traits.length
  if (!n) return null
  const data = traits.map((t, i) => point(i, n, Math.max(10, (t.value / 100) * R)).join(',')).join(' ')

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full" role="img" aria-label="情绪画像雷达图">
      <defs>
        <linearGradient id="portrait-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#66b2c3" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#a99be0" stopOpacity="0.34" />
        </linearGradient>
      </defs>

      {[0.25, 0.5, 0.75, 1].map((k) => (
        <polygon
          key={k}
          points={polygon(n, R * k)}
          fill="none"
          stroke="rgba(74,151,170,0.16)"
          strokeWidth={k === 1 ? 1.2 : 0.8}
        />
      ))}
      {traits.map((t, i) => {
        const [x, y] = point(i, n, R)
        return <line key={t.key} x1={C} y1={C} x2={x} y2={y} stroke="rgba(74,151,170,0.14)" strokeWidth="0.8" />
      })}

      <motion.polygon
        points={data}
        fill="url(#portrait-fill)"
        stroke="#4a97aa"
        strokeWidth="1.6"
        initial={{ opacity: 0, scale: 0.86 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ transformOrigin: 'center' }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      />

      {traits.map((t, i) => {
        const [x, y] = point(i, n, Math.max(10, (t.value / 100) * R))
        return <circle key={t.key} cx={x} cy={y} r="3" fill="#fff" stroke="#4a97aa" strokeWidth="1.4" />
      })}

      {traits.map((t, i) => {
        const [x, y] = point(i, n, R + 26)
        const anchor = x > C + 4 ? 'start' : x < C - 4 ? 'end' : 'middle'
        return (
          <text
            key={t.key}
            x={x}
            y={y + 3}
            textAnchor={anchor}
            className="fill-ink-500"
            style={{ fontSize: 10.5, fontWeight: 500 }}
          >
            {t.label}
            <tspan style={{ fontSize: 9, fill: '#8fa1ad' }}> {t.value}</tspan>
          </text>
        )
      })}
    </svg>
  )
}

export function MoodPortrait({ portrait }: { portrait: Portrait }) {
  const settings = useAppStore((s) => s.settings)
  const [open, setOpen] = useState(false)
  const [explain, setExplain] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)

  const top = useMemo(() => [...portrait.traits].sort((a, b) => b.value - a.value).slice(0, 2), [portrait.traits])

  const ask = async () => {
    setAsking(true)
    const text = await explainPortrait(portrait, {
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      model: settings.model,
      temperature: settings.temperature,
    })
    setExplain(text ?? '岛主这会儿没连上，先看上面那段描述也够了。')
    setAsking(false)
  }

  if (!portrait.has) {
    return (
      <section className="rounded-5xl border border-white/75 bg-white/55 p-6 shadow-soft backdrop-blur sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-lav-500">Mood Portrait</p>
            <h2 className="mt-2 font-display text-[24px] font-semibold leading-snug tracking-tight text-ink-900">
              这张画像，还差几笔
            </h2>
            <p className="mt-2.5 max-w-md text-[13px] leading-[1.9] text-ink-500">{portrait.summary}</p>
            <p className="mt-3 text-[11.5px] text-ink-400">
              已经有 {portrait.records} 次记录。再记 2 次，我就能画出你的起伏形状。
            </p>
          </div>
          <div className="flex items-center justify-center">
            <div className="relative h-44 w-44 rounded-full border border-dashed border-sea-300/70 bg-white/40">
              <div className="absolute inset-6 rounded-full border border-white/70" />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Icon name="compass" size={22} className="text-sea-300" />
                <p className="mt-1.5 text-[10.5px] text-ink-300">画像生长中</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="relative overflow-hidden rounded-5xl border border-white/75 bg-white/58 p-6 shadow-soft backdrop-blur sm:p-7">
      <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-lav-200/30 blur-3xl" />
      <div className="relative grid gap-6 lg:grid-cols-[1.12fr_0.88fr] lg:items-center">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-lav-500">Mood Portrait · 近 30 天</p>
          <div className="mt-2 flex flex-wrap items-end gap-2.5">
            <h2 className="font-display text-[26px] font-semibold leading-none tracking-tight text-ink-900 sm:text-[30px]">
              {portrait.title}
            </h2>
            {portrait.trend !== null && (
              <span
                className={`mb-1 rounded-full px-2 py-0.5 text-[10.5px] ${
                  portrait.trend >= 0 ? 'bg-sea-50 text-sea-700' : 'bg-coral-300/20 text-coral-500'
                }`}
              >
                {portrait.trend >= 0 ? '↑' : '↓'} {Math.abs(portrait.trend).toFixed(1)}
              </span>
            )}
          </div>

          <p className="mt-3 max-w-xl text-[13px] leading-[1.95] text-ink-600">{portrait.summary}</p>

          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {top.map((t) => (
              <span key={t.key} className="chip text-[10.5px]">
                {t.label} · {t.value}
              </span>
            ))}
            {portrait.topTags.map((t) => (
              <span key={t.tag} className="rounded-full bg-white/70 px-2.5 py-1 text-[10.5px] text-ink-500">
                {t.tag} ×{t.n}
              </span>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button onClick={ask} disabled={asking} className="btn-ghost text-[12px] disabled:opacity-50">
              <Icon name="sparkles" size={13} />
              {asking ? '岛主正在读…' : '让岛主说说这张画像'}
            </button>
            <button onClick={() => setOpen((v) => !v)} className="btn-quiet px-2.5 text-[11.5px]">
              {open ? '收起依据' : '这张画像怎么来的'}
              <Icon name="arrowRight" size={12} />
            </button>
          </div>

          {explain && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 rounded-2xl border border-lav-200/60 bg-lav-50/70 px-4 py-3"
            >
              <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-lav-500">
                <Icon name="feather" size={11} />
                岛主
              </p>
              <p className="mt-1 text-[12px] leading-[1.85] text-ink-600">{explain}</p>
            </motion.div>
          )}

          {open && (
            <motion.ul
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-3 space-y-1.5 overflow-hidden rounded-2xl bg-white/60 px-4 py-3"
            >
              {portrait.evidence.map((e) => (
                <li key={e} className="flex gap-2 text-[11px] leading-relaxed text-ink-500">
                  <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-sea-400" />
                  {e}
                </li>
              ))}
            </motion.ul>
          )}
        </div>

        <div>
          <div className="mx-auto h-[240px] w-[240px] sm:h-[270px] sm:w-[270px]">
            <Radar traits={portrait.traits} />
          </div>
          <p className="mt-1 text-center text-[10px] text-ink-300">不是评分，是形状 · 数值越高，这一维越明显</p>
        </div>
      </div>
    </section>
  )
}
