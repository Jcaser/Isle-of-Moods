import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BreathCompanion } from '../components/BreathCompanion'
import { Icon } from '../components/Icons'
import { PageHeader } from '../components/PageHeader'
import { PATTERNS } from '../lib/breathing'
import { POSTCARDS, POSTCARD_QUOTES } from '../lib/postcards'
import { ISLAND_VOICES, speakCloud, splitSentences } from '../lib/tts'
import { useAppStore } from '../store/useAppStore'

type Tab = 'breath' | 'companion' | 'mind' | 'paper'

const SCRIPTS = [
  {
    id: 'threemin',
    title: '三分钟呼吸空间',
    scene: '考前焦虑上升时',
    dur: '3 分钟',
    text: '找个地方坐下，脚掌平放在地面。如果方便，把眼睛轻轻闭上，或者把目光落在前方一个固定的点。现在，把注意力带到呼吸上。不用刻意加深，只是知道你正在吸气，正在呼气。吸气的时候，感觉空气比体温稍凉；呼气的时候，感觉肩膀往下沉一点点。走神了没关系，这不是失败，只需要温和地把注意力带回来。接下来，把注意力扩展到整个身体。感觉臀部与椅面的接触，感觉手掌的重量。如果身体里有紧张的地方，不用赶走它，只是给它一点空间。最后，把注意力带回呼吸，深吸一口气，慢慢呼出。睁开眼睛之前，告诉自己一句话：现在这样，也可以。',
  },
  {
    id: 'bodyscan',
    title: '睡前身体扫描',
    scene: '躺下后脑子停不下来',
    dur: '6 分钟',
    text: '平躺下来，双手放在身体两侧，掌心向上。先做三次缓慢的呼气，让身体的重量交给床。把注意力放到脚趾，感觉它们的温度、袜子的触感、被子压在上面的重量。不需要改变什么，只是感觉。慢慢向上，来到小腿、膝盖、大腿。如果发现哪里绷着，可以在呼气的时候，让它松一点点。继续来到腹部，感觉呼吸让腹部轻轻起伏。然后是胸口、肩膀、手臂、手指。最后是脖子、下巴、眉心。让眉心的皮肤松开，让舌头不再顶着上颚。现在，感觉整个身体像一个整体，安静地躺在这里。如果睡意来了，就让它带你走，不需要听完这段话。',
  },
  {
    id: 'grounding',
    title: '考场 5-4-3-2-1 着陆',
    scene: '脑子空白、心跳很快',
    dur: '2 分钟',
    text: '先做一次长长的呼气，把气全部呼出去。现在，慢慢看一圈，在心里说出你看到的五样东西：钟表、桌角、笔袋、窗、前面同学的椅背。然后，感觉四样能触摸到的东西：桌面的凉、笔杆的纹路、衣服的布料、脚踩地面的压力。再听三种声音：翻卷子的声音、空调的声音、你自己的呼吸。闻两种气味：纸张、消毒水，或者衣服上的洗衣液。最后，感觉一种味道，或者喝一口水。好，你现在在这里。接下来，只做一件事：把会做的题先做出来。',
  },
  {
    id: 'selfcare',
    title: '自我关怀短句',
    scene: '自责、觉得自己不够好',
    dur: '1 分钟',
    text: '把手放在胸口，感觉手掌的温度。对自己说第一句话：这很难，我现在确实不好受。第二句话：很多人在备考的时候，都会有这样的时刻，我不是一个人。第三句话：我愿意对自己温和一点，就像对待一个正在努力的朋友。再说一遍，慢一点：这很难。我不是一个人。我愿意对自己温和一点。好，深呼吸一次。接下来，我们只做今天能做的一小步。',
  },
]

/** 固定节奏的三种呼吸：选一种直接开始，不需要先描述状态 */
function BreathingTab({ onCompanion }: { onCompanion: () => void }) {
  const openBreathing = useAppStore((s) => s.openBreathing)
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {Object.values(PATTERNS).map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="glass flex flex-col p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-medium tracking-wide text-sea-500">
                {p.hold > 0 ? `${p.inhale}-${p.hold}-${p.exhale}` : `${p.inhale}-${p.exhale}`}
                {p.holdAfter ? `-${p.holdAfter}` : ''}
              </span>
              <Icon name="wave" size={16} className="text-sea-300" />
            </div>
            <h3 className="mt-2 font-display text-[16px] font-semibold tracking-tight text-ink-900">{p.name}</h3>
            <p className="mt-1.5 flex-1 text-[12px] leading-relaxed text-ink-500">{p.desc}</p>
            <button onClick={() => openBreathing(p.id)} className="btn-primary mt-4 text-[12.5px]">
              <Icon name="play" size={14} />
              开始引导
            </button>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-4xl border border-white/70 bg-white/50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h3 className="font-display text-[15px] font-semibold text-ink-900">不知道该选哪个？</h3>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-500">
            说一句现在什么感觉，岛主会判断状态，替你配好节奏和时长。
          </p>
        </div>
        <button onClick={onCompanion} className="btn-ghost shrink-0 text-[12.5px]">
          <Icon name="chat" size={14} />
          让岛主配一组
          <Icon name="arrowRight" size={14} />
        </button>
      </div>

      <div className="rounded-4xl border border-white/70 bg-white/50 p-5 sm:p-6">
        <h3 className="font-display text-[15px] font-semibold text-ink-900">为什么是「呼气更长」</h3>
        <p className="mt-2 text-[12.5px] leading-[1.85] text-ink-500">
          吸气时心率略微加快，呼气时减慢，这种波动由迷走神经调节。把呼气拉长，相当于反复给身体一个「安全」的信号，
          心率与肌肉张力会随之下降。这也是为什么 4-7-8 常被用于睡前与急性紧张——重点不在数字精确，而在
          <strong className="font-medium text-ink-700">呼气长于吸气</strong>。屏息让你不适时，直接改成吸 4 呼 6 即可。
        </p>
      </div>
    </div>
  )
}

function MindTab() {
  const islandVoice = useAppStore((s) => s.settings.islandVoice)
  const rate = useAppStore((s) => s.settings.rate)
  const update = useAppStore((s) => s.updateSettings)
  const [activeId, setActiveId] = useState(SCRIPTS[0].id)
  const [current, setCurrent] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [warming, setWarming] = useState(false)
  const stopRef = useRef<(() => void) | null>(null)

  const script = SCRIPTS.find((s) => s.id === activeId)!
  const sentences = useMemo(() => splitSentences(script.text), [script])

  useEffect(() => {
    return () => stopRef.current?.()
  }, [])

  const play = (from = 0) => {
    stopRef.current?.()
    setPlaying(true)
    setWarming(true)
    stopRef.current = speakCloud(sentences.slice(from), {
      voice: islandVoice,
      rate,
      onSentence: (i) => {
        setWarming(false)
        setCurrent(from + i)
      },
      onEnd: () => {
        setPlaying(false)
        setWarming(false)
        setCurrent(-1)
      },
    })
  }

  const stop = () => {
    stopRef.current?.()
    stopRef.current = null
    setPlaying(false)
    setWarming(false)
    setCurrent(-1)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-2">
        {SCRIPTS.map((s) => (
          <button
            key={s.id}
            onClick={() => {
              stop()
              setActiveId(s.id)
            }}
            className={`w-full rounded-3xl border p-4 text-left transition ${
              s.id === activeId
                ? 'border-sea-300 bg-white/85 shadow-soft'
                : 'border-white/70 bg-white/45 hover:bg-white/70'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="font-display text-[14px] font-semibold text-ink-900">{s.title}</p>
              <span className="chip text-[10px]">{s.dur}</span>
            </div>
            <p className="mt-1 text-[11px] text-ink-400">{s.scene}</p>
          </button>
        ))}
        <p className="px-1 pt-2 text-[10.5px] leading-relaxed text-ink-300">
          语音由岛主之声实时合成，音色与 Edge「大声朗读」同源；断网时自动退回系统语音。
        </p>
      </div>

      <div className="glass flex flex-col p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10.5px] tracking-[0.16em] text-sea-500">MEDITATION</p>
            <h3 className="mt-1 font-display text-[17px] font-semibold tracking-tight text-ink-900">{script.title}</h3>
          </div>
          <div className="flex gap-1.5">
            {playing ? (
              <button onClick={stop} className="btn-ghost px-4 text-[12px]">
                <Icon name="stop" size={14} />
                停止
              </button>
            ) : (
              <button onClick={() => play(0)} className="btn-primary px-4 text-[12.5px]">
                <Icon name="play" size={14} />
                {warming ? '准备中…' : '播放'}
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 max-h-[46vh] flex-1 space-y-1.5 overflow-y-auto pr-1">
          {sentences.map((s, i) => (
            <button
              key={i}
              onClick={() => {
                setCurrent(i)
                play(i)
              }}
              className={`block w-full rounded-xl px-2.5 py-1.5 text-left text-[13px] leading-[1.85] transition ${
                current === i
                  ? 'bg-sea-100/80 font-medium text-ink-900'
                  : 'text-ink-500 hover:bg-white/70'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/60 pt-3">
          <div className="flex items-center gap-2">
            <Icon name="volume" size={14} className="text-ink-300" />
            <select
              value={islandVoice}
              onChange={(e) => update({ islandVoice: e.target.value })}
              className="rounded-full border border-white/70 bg-white/70 px-2.5 py-1 text-[11px] text-ink-600 outline-none"
              aria-label="选择音色"
            >
              {ISLAND_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-1 items-center gap-2">
            <span className="text-[10.5px] text-ink-400">语速</span>
            <input
              type="range"
              min={0.6}
              max={1.2}
              step={0.02}
              value={rate}
              onChange={(e) => update({ rate: Number(e.target.value) })}
              className="w-24 accent-sea-500"
              aria-label="语速"
            />
            <span className="tabular-nums text-[10.5px] text-ink-400">{rate.toFixed(2)}×</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function PostcardTab() {
  const [index, setIndex] = useState(0)
  const [quote, setQuote] = useState(POSTCARD_QUOTES[0])
  const card = POSTCARDS[index]

  // 打开这一页就把八张都预取进缓存（合计约 2.6MB 本地静态文件）：
  // 翻到任意一张都是瞬时的，不会出现「点了没反应」或中途白一下
  useEffect(() => {
    POSTCARDS.forEach((p) => {
      const img = new Image()
      img.src = p.src
    })
  }, [])

  const next = () => setIndex((i) => (i + 1) % POSTCARDS.length)

  /**
   * 导出 1920×1080：先按 cover 铺满，再把题字叠上去。
   * 素材放在 public 下、与页面同源，画布不会被 tainted，可直接导出。
   */
  const download = async () => {
    const img = new Image()
    img.src = card.src
    try {
      await img.decode()
    } catch {
      return
    }

    const W = 1920
    const H = 1080
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const g = canvas.getContext('2d')
    if (!g) return

    const scale = Math.max(W / img.width, H / img.height)
    const dw = img.width * scale
    const dh = img.height * scale
    g.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh)

    if (quote) {
      const scrim = g.createLinearGradient(0, H * 0.52, 0, H)
      scrim.addColorStop(0, 'rgba(0,0,0,0)')
      scrim.addColorStop(1, 'rgba(0,0,0,0.38)')
      g.fillStyle = scrim
      g.fillRect(0, H * 0.52, W, H * 0.48)

      g.textAlign = 'center'
      g.fillStyle = 'rgba(255,255,255,0.95)'
      g.font = '500 52px "Songti SC", "Noto Serif SC", serif'
      g.fillText(quote, W / 2, H - 118)

      g.fillStyle = 'rgba(255,255,255,0.55)'
      g.font = '400 20px "Helvetica Neue", Arial, sans-serif'
      g.fillText('S E R E N E   I S L E', W / 2, H - 70)
    }

    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/jpeg', 0.92)
    a.download = `sereneisle-postcard-${card.id}.jpg`
    a.click()
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
      {/*
        两栏从 xl 起才启用：1024–1279 之间右侧文案会换行变高，硬撑两栏就对不齐了。
        左图用 aspect-[16/9]，图片本身即卡片、不留外框，边缘才能与右侧卡片齐平。
      */}
      <figure className="relative aspect-[16/9] self-start overflow-hidden rounded-4xl border border-white/70 bg-sea-100/40 shadow-soft">
        <AnimatePresence>
          <motion.img
            key={card.id}
            src={card.src}
            alt={`明信片：${card.name}`}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </AnimatePresence>

        {/* 题字叠在画面底部，和明信片上手写一行字一样 */}
        {quote && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 via-black/[0.18] to-transparent px-6 pb-5 pt-16 text-center">
            <p className="font-display text-[13.5px] font-medium tracking-wide text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)] sm:text-[15px]">
              {quote}
            </p>
            <p className="mt-1.5 text-[8.5px] uppercase tracking-[0.34em] text-white/75">Serene Isle</p>
          </div>
        )}
      </figure>

      {/* 右：说明与操作。h-full 让它与左边明信片等高 */}
      <div className="flex h-full flex-col rounded-4xl border border-white/70 bg-white/50 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-[15px] font-semibold text-ink-900">潮汐明信片</h3>
          <span className="shrink-0 rounded-full bg-sea-50 px-2.5 py-1 text-[10.5px] tabular-nums text-sea-700">
            {index + 1} / {POSTCARDS.length}
          </span>
        </div>

        <p className="mt-1.5 text-[12px] font-medium text-ink-700">{card.name}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-500">{card.scene}</p>

        <div className="mt-4">
          <p className="label">题一句话（可选）</p>
          <div className="flex flex-wrap gap-1.5">
            {POSTCARD_QUOTES.map((q) => (
              <button
                key={q}
                onClick={() => setQuote(q)}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                  quote === q
                    ? 'border-sea-300 bg-sea-50 text-sea-700'
                    : 'border-white/70 bg-white/45 text-ink-500 hover:bg-white/75'
                }`}
              >
                {q}
              </button>
            ))}
            <button
              onClick={() => setQuote('')}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                quote === '' ? 'border-sea-300 bg-sea-50 text-sea-700' : 'border-white/70 bg-white/45 text-ink-500'
              }`}
            >
              留白
            </button>
          </div>
        </div>

        {/* 八张的位置指示，兼作快速跳转 */}
        <div className="mt-4 flex items-center gap-1.5">
          {POSTCARDS.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setIndex(i)}
              aria-label={`第 ${i + 1} 张：${p.name}`}
              aria-current={i === index ? 'true' : undefined}
              title={p.name}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-5 bg-sea-500' : 'w-1.5 bg-ink-300/45 hover:bg-sea-300'
              }`}
            />
          ))}
        </div>

        {/* mt-auto：卡片被拉到与明信片同高时，按钮贴着底部，中间留白 */}
        <div className="mt-auto pt-5">
          <div className="flex gap-2">
            <button onClick={next} className="btn-ghost flex-1 text-[12.5px]">
              <Icon name="refresh" size={15} />
              换一张
            </button>
            <button onClick={download} className="btn-primary flex-1 text-[12.5px]">
              <Icon name="download" size={15} />
              下载
            </button>
          </div>
          <p className="mt-2.5 text-[10.5px] leading-relaxed text-ink-400">
            导出 1920×1080，适合做锁屏或打印。八张都在本地，断网也能翻。
          </p>
        </div>
      </div>
    </div>
  )
}

export default function Calm() {
  const [tab, setTab] = useState<Tab>('breath')

  const tabs: { id: Tab; label: string; icon: 'wave' | 'chat' | 'volume' | 'sparkles' }[] = [
    { id: 'breath', label: '呼吸练习', icon: 'wave' },
    { id: 'companion', label: '岛主陪伴', icon: 'chat' },
    { id: 'mind', label: '正念语音', icon: 'volume' },
    { id: 'paper', label: '明信片', icon: 'sparkles' },
  ]

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Tidal Therapy"
        icon={<Icon name="wave" size={13} />}
        title="潮汐疗愈"
        desc="三种呼吸节奏随手就能开始；如果说不清自己是什么状态，也可以交给岛主判断，让她配一组节奏，练的时候还能当场改。"
      />

      <div className="mb-5 max-w-full overflow-x-auto">
        <div className="inline-flex rounded-full border border-white/70 bg-white/50 p-1 backdrop-blur">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[12.5px] transition sm:px-4 ${
                tab === t.id ? 'text-ink-900' : 'text-ink-500 hover:text-ink-800'
              }`}
            >
              {tab === t.id && (
                <motion.span layoutId="calm-tab" className="absolute inset-0 rounded-full bg-white shadow-sm" transition={{ type: 'spring', stiffness: 340, damping: 30 }} />
              )}
              <span className="relative flex items-center gap-1.5">
                <Icon name={t.icon} size={14} />
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="pb-4">
        {tab === 'breath' && <BreathingTab onCompanion={() => setTab('companion')} />}
        {tab === 'companion' && <BreathCompanion />}
        {tab === 'mind' && <MindTab />}
        {tab === 'paper' && <PostcardTab />}
      </div>
    </div>
  )
}
