import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { BackToAtlas } from '../components/BackToAtlas'
import { Icon, type IconName } from '../components/Icons'
import { Bubbles } from '../components/games/Bubbles'
import { ShellHunt } from '../components/games/ShellHunt'
import { Skipping } from '../components/games/Skipping'
import { StarWish } from '../components/games/StarWish'
import { MOOD_META } from '../lib/mood'
import { isMuted, setMuted, sfx } from '../lib/sfx'
import type { MoodScore } from '../lib/types'
import { useAppStore } from '../store/useAppStore'

type GameId = 'bubble' | 'shell' | 'skip' | 'star'

const GAMES: {
  id: GameId
  name: string
  en: string
  desc: string
  feel: string
  icon: IconName
  accent: string
}[] = [
  {
    id: 'bubble',
    name: '潮汐泡泡',
    en: 'Bubble Tide',
    desc: '点掉或划破往上飘的泡泡，碎掉的一瞬间有一点爽。',
    feel: '适合：脑子太满，什么都想不了',
    icon: 'sparkles',
    accent: 'from-[#dff2f8] to-[#e9e3fa]',
  },
  {
    id: 'shell',
    name: '沙岸拾贝',
    en: 'Sand & Shells',
    desc: '用指尖把沙子刮开，下面压着一句话和几枚贝壳。',
    feel: '适合：心里堵着一团，说不出来',
    icon: 'feather',
    accent: 'from-[#f8ecd6] to-[#f4e2cd]',
  },
  {
    id: 'skip',
    name: '打水漂',
    en: 'Stone Skipping',
    desc: '按住蓄力，松手扔出去，看石头在水面弹几下。',
    feel: '适合：坐立不安，想动一动',
    icon: 'wave',
    accent: 'from-[#dcf0f6] to-[#cfe7f1]',
  },
  {
    id: 'star',
    name: '星光许愿',
    en: 'Star Wish',
    desc: '在夜空点一颗星，写下一句想放下的话。',
    feel: '适合：睡前，脑子里反复过事情',
    icon: 'compass',
    accent: 'from-[#2b3358] to-[#3d4370]',
  },
]

const PLAY_KEY = 'sereneisle.v1.play-count'

export default function Play() {
  const [game, setGame] = useState<GameId>('bubble')
  const [muted, setMutedUi] = useState(false)
  const [plays, setPlays] = useState(0)
  const [recorded, setRecorded] = useState<MoodScore | null>(null)
  const addMood = useAppStore((s) => s.addMood)

  useEffect(() => {
    setMutedUi(isMuted())
    try {
      const raw = Number(localStorage.getItem(PLAY_KEY) || '0')
      setPlays(Number.isFinite(raw) ? raw : 0)
    } catch {
      /* 忽略 */
    }
  }, [])

  const switchGame = (id: GameId) => {
    setGame(id)
    setRecorded(null)
    sfx.tick()
  }

  const record = (score: MoodScore) => {
    addMood({ score, tags: ['放松'], note: `在屿乐园玩了一局「${GAMES.find((g) => g.id === game)?.name}」`, source: 'quick' })
    setRecorded(score)
    sfx.chime()
    try {
      const next = plays + 1
      setPlays(next)
      localStorage.setItem(PLAY_KEY, String(next))
    } catch {
      /* 忽略 */
    }
  }

  const current = GAMES.find((g) => g.id === game) ?? GAMES[0]

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
      {/* 头部 */}
      <section className="pb-6 pt-5 sm:pt-7">
        <BackToAtlas />
        <div className="mt-7">
          <span className="sticker">
            <Icon name="sparkles" size={12} />
            PLAY SHORE · 不费脑子的四个小岛
          </span>
        </div>
        <h1 className="mt-5 font-display text-[34px] font-semibold leading-[1.2] tracking-tight text-ink-900 sm:text-[44px]">
          学不进去的时候，
          <br className="sm:hidden" />
          先来<span className="text-gradient">玩两分钟</span>。
        </h1>
        <div className="mt-4 flex max-w-xl gap-3.5">
          <span className="mt-1 h-[calc(100%-8px)] w-[2px] shrink-0 rounded-full bg-gradient-to-b from-coral-300/90 via-lav-300/70 to-transparent" />
          <p className="text-[13.5px] leading-[1.9] text-ink-500">
            这里没有分数、没有排行榜、没有连续打卡。四个小游戏都发生在本地浏览器里，玩到一半关掉也不会有任何损失。
            如果玩完心情松了一点，可以顺手在下面记一笔。
          </p>
        </div>
        <div className="hairline mt-7 opacity-70" />
      </section>

      {/* 选择 */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {GAMES.map((g) => {
          const on = g.id === game
          return (
            <button
              key={g.id}
              onClick={() => switchGame(g.id)}
              className={`group relative overflow-hidden rounded-3xl border p-3.5 text-left transition-all duration-400 ${
                on
                  ? 'border-white bg-white/80 shadow-soft'
                  : 'border-white/60 bg-white/40 hover:-translate-y-0.5 hover:bg-white/60'
              }`}
              aria-pressed={on}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-2xl bg-gradient-to-br ${g.accent} ${
                  g.id === 'star' ? 'text-white/90' : 'text-sea-600'
                }`}
              >
                <Icon name={g.icon} size={15} />
              </span>
              <p className="mt-2.5 text-[13px] font-semibold tracking-tight text-ink-900">{g.name}</p>
              <p className="mt-0.5 text-[9.5px] uppercase tracking-[0.16em] text-ink-300">{g.en}</p>
              {on && <span className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-sea-400" />}
            </button>
          )
        })}
      </div>

      {/* 游戏区 */}
      <div className="mt-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={game}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-5xl border border-white/70 bg-white/45 p-3 shadow-soft backdrop-blur-sm sm:p-4"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
              <div>
                <p className="text-[13.5px] font-semibold tracking-tight text-ink-900">{current.name}</p>
                <p className="mt-0.5 text-[11.5px] text-ink-400">{current.desc}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="chip">{current.feel}</span>
                <button
                  onClick={() => {
                    const next = !muted
                    setMutedUi(next)
                    setMuted(next)
                    if (!next) sfx.plink()
                  }}
                  className="btn-quiet h-8 w-8 rounded-full p-0"
                  aria-label={muted ? '打开音效' : '关闭音效'}
                >
                  <Icon name={muted ? 'close' : 'volume'} size={15} />
                </button>
              </div>
            </div>

            {game === 'bubble' && <Bubbles />}
            {game === 'shell' && <ShellHunt />}
            {game === 'skip' && <Skipping />}
            {game === 'star' && <StarWish />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 记录 */}
      <section className="mt-4 rounded-5xl border border-white/70 bg-white/45 px-5 py-5 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sea-500">After play</p>
            <p className="mt-1 font-display text-[16px] font-semibold tracking-tight text-ink-900">
              {recorded ? '记下了，潮向图上多了一个点' : '玩完之后，现在感觉怎么样？'}
            </p>
            <p className="mt-1 text-[11.5px] text-ink-400">
              {recorded
                ? `这一笔会同时出现在「潮向」里，标签自动记为「放松」。`
                : '顺手记一笔，只用点一下。不记也没关系。'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {([1, 2, 3, 4, 5] as MoodScore[]).map((s) => {
              const meta = MOOD_META[s]
              const on = recorded === s
              return (
                <button
                  key={s}
                  onClick={() => record(s)}
                  className={`flex h-11 w-11 items-center justify-center rounded-full text-[12px] font-medium transition-all duration-300 ${
                    on ? 'scale-110 text-white shadow-soft' : 'bg-white/70 text-ink-500 hover:-translate-y-0.5 hover:bg-white'
                  }`}
                  style={on ? { background: meta.color } : undefined}
                  aria-label={`记录心情：${meta.label}`}
                  title={meta.label}
                >
                  {meta.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-white/60 pt-3 text-[10.5px] text-ink-300">
          <span>本机已记录 {plays} 次游玩</span>
          <span>·</span>
          <span>所有动画与音效均在本机合成</span>
          <span>·</span>
          <span>如果心里真的很沉，去避风港看看</span>
        </div>
      </section>
    </div>
  )
}
