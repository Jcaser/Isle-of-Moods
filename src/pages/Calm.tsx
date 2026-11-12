import { motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/Icons'
import { PageHeader } from '../components/PageHeader'
import { PATTERNS } from '../lib/breathing'
import { PALETTES, WALLPAPER_QUOTES, renderWallpaper } from '../lib/wallpaper'
import { isTTSSupported, listVoices, speak, splitSentences, type VoiceOption } from '../lib/tts'
import { useAppStore } from '../store/useAppStore'

type Tab = 'breath' | 'mind' | 'paper'

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

function BreathingTab() {
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
                {p.inhale}-{p.hold}-{p.exhale}
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

      <div className="rounded-4xl border border-white/70 bg-white/50 p-5 sm:p-6">
        <h3 className="font-display text-[15px] font-semibold text-ink-900">为什么是"呼气更长"</h3>
        <p className="mt-2 text-[12.5px] leading-[1.85] text-ink-500">
          吸气时心率略微加快，呼气时减慢，这种波动由迷走神经调节。把呼气拉长，相当于反复给身体一个"安全"的信号，
          心率与肌肉张力会随之下降。这也是为什么 4-7-8 常被用于睡前与急性紧张——重点不在数字精确，而在
          <strong className="font-medium text-ink-700">呼气长于吸气</strong>。屏息让你不适时，直接改成吸 4 呼 6 即可。
        </p>
      </div>
    </div>
  )
}

function MindTab() {
  const voiceURI = useAppStore((s) => s.settings.voiceURI)
  const rate = useAppStore((s) => s.settings.rate)
  const update = useAppStore((s) => s.updateSettings)
  const [activeId, setActiveId] = useState(SCRIPTS[0].id)
  const [current, setCurrent] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [voices, setVoices] = useState<VoiceOption[]>([])
  const stopRef = useRef<(() => void) | null>(null)

  const script = SCRIPTS.find((s) => s.id === activeId)!
  const sentences = useMemo(() => splitSentences(script.text), [script])

  useEffect(() => {
    listVoices().then(setVoices)
  }, [])

  useEffect(() => {
    return () => stopRef.current?.()
  }, [])

  const play = (from = 0) => {
    stopRef.current?.()
    setPlaying(true)
    stopRef.current = speak(sentences.slice(from), {
      voiceURI,
      rate,
      onSentence: (i) => setCurrent(from + i),
      onEnd: () => {
        setPlaying(false)
        setCurrent(-1)
      },
    })
  }

  const stop = () => {
    stopRef.current?.()
    stopRef.current = null
    setPlaying(false)
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
          语音由浏览器内置 TTS 实时合成，文字与音频都不离开本机。无中文音色时，请安装系统语音包。
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
              <button onClick={() => play(0)} className="btn-primary px-4 text-[12.5px]" disabled={!isTTSSupported()}>
                <Icon name="play" size={14} />
                播放
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
              value={voiceURI}
              onChange={(e) => update({ voiceURI: e.target.value })}
              className="rounded-full border border-white/70 bg-white/70 px-2.5 py-1 text-[11px] text-ink-600 outline-none"
              aria-label="选择音色"
            >
              <option value="">自动中文音色</option>
              {voices.map((v) => (
                <option key={v.uri} value={v.uri}>
                  {v.name}
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

function PaperTab() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [paletteIndex, setPaletteIndex] = useState(0)
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6))
  const [quote, setQuote] = useState(WALLPAPER_QUOTES[0])

  useEffect(() => {
    if (!canvasRef.current) return
    renderWallpaper(canvasRef.current, { palette: PALETTES[paletteIndex], seed, quote })
  }, [paletteIndex, seed, quote])

  const download = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `sereneisle-wallpaper-${seed}.png`
    a.click()
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="glass overflow-hidden p-3">
        <canvas
          ref={canvasRef}
          className="w-full rounded-3xl shadow-inner"
          style={{ aspectRatio: '3 / 4' }}
          aria-label="程序化生成的海岛壁纸预览"
        />
      </div>

      <div className="space-y-4">
        <div className="rounded-4xl border border-white/70 bg-white/50 p-5">
          <h3 className="font-display text-[15px] font-semibold text-ink-900">端侧生成的海岛</h3>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-500">
            天空渐变、光晕、星点、海面波光与灯塔都由 Canvas 分层绘制，配合种子随机数生成独一无二的画面。
            不调用任何图像 API，断网也能用，画面不出浏览器。
          </p>

          <div className="mt-4">
            <p className="label">色调</p>
            <div className="flex flex-wrap gap-1.5">
              {PALETTES.map((p, i) => (
                <button
                  key={p.name}
                  onClick={() => setPaletteIndex(i)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] transition ${
                    i === paletteIndex
                      ? 'border-sea-300 bg-white/90 text-ink-900'
                      : 'border-white/70 bg-white/45 text-ink-500 hover:bg-white/75'
                  }`}
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: `linear-gradient(135deg, ${p.sky[0]}, ${p.sea[1]})` }}
                  />
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <p className="label">写一句话（可选）</p>
            <div className="flex flex-wrap gap-1.5">
              {WALLPAPER_QUOTES.map((q) => (
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
                不写字
              </button>
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <button onClick={() => setSeed(Math.floor(Math.random() * 1e6))} className="btn-ghost flex-1 text-[12.5px]">
              <Icon name="refresh" size={15} />
              换一张
            </button>
            <button onClick={download} className="btn-primary flex-1 text-[12.5px]">
              <Icon name="download" size={15} />
              下载 1080×1440
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/70 bg-white/45 px-4 py-3 text-[11px] leading-relaxed text-ink-400">
          小提示：设为锁屏后，每次解锁都会看到一句你想对自己说的话。
        </div>
      </div>
    </div>
  )
}

export default function Calm() {
  const [tab, setTab] = useState<Tab>('breath')

  const tabs: { id: Tab; label: string; icon: 'wave' | 'volume' | 'sparkles' }[] = [
    { id: 'breath', label: '潮汐呼吸', icon: 'wave' },
    { id: 'mind', label: '正念语音', icon: 'volume' },
    { id: 'paper', label: '海岛壁纸', icon: 'sparkles' },
  ]

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Tidal Therapy"
        icon={<Icon name="wave" size={13} />}
        title="潮汐疗愈"
        desc="身体先慢下来，想法才有可能松开。这里有三条路径：跟着海浪呼吸、听一段正念引导、或给自己生成一张安静的海岛。"
      />

      <div className="mb-5 inline-flex rounded-full border border-white/70 bg-white/50 p-1 backdrop-blur">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] transition ${
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

      <div className="pb-4">
        {tab === 'breath' && <BreathingTab />}
        {tab === 'mind' && <MindTab />}
        {tab === 'paper' && <PaperTab />}
      </div>
    </div>
  )
}
