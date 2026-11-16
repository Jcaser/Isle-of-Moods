import { motion } from 'framer-motion'
import { useState } from 'react'
import { AUDIENCES, SAY_MOODS, copyText, sayIt, type Audience, type SayMood } from '../lib/harbor'
import { Icon } from './Icons'

/** 开口练习：把「我说不出口」变成一条可以直接发出去的句子 */
export function SayItForMe() {
  const [audience, setAudience] = useState<Audience>('friend')
  const [mood, setMood] = useState<SayMood>('open')
  const [variant, setVariant] = useState(0)
  const [copied, setCopied] = useState(false)

  const text = sayIt(audience, mood, variant)

  const copy = async () => {
    const ok = await copyText(text)
    setCopied(ok)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-5xl border border-white/75 bg-gradient-to-br from-white/65 to-sea-50/50 p-5 shadow-soft backdrop-blur sm:p-6">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-lav-500">Say It For Me</p>
        <h2 className="mt-1 font-display text-[17px] font-semibold tracking-tight text-ink-900">不知道怎么说？我帮你写</h2>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-500">
          选一下要对谁说、想说到哪一步，我给你一句能直接发出去的话。
        </p>
      </div>

      <div className="mt-3.5">
        <p className="text-[10.5px] text-ink-400">对谁说</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {AUDIENCES.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                setAudience(a.id)
                setVariant(0)
              }}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                audience === a.id
                  ? 'border-sea-300 bg-white text-sea-700 shadow-sm'
                  : 'border-white/70 bg-white/45 text-ink-500 hover:bg-white/80'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2.5">
        <p className="text-[10.5px] text-ink-400">想说到哪一步</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {SAY_MOODS.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setMood(m.id)
                setVariant(0)
              }}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                mood === m.id
                  ? 'border-lav-300 bg-white text-lav-500 shadow-sm'
                  : 'border-white/70 bg-white/45 text-ink-500 hover:bg-white/80'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <motion.div
        key={`${audience}-${mood}-${variant}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mt-4 rounded-3xl rounded-tl-lg border border-white/80 bg-white/85 px-4 py-3.5"
      >
        <span className="absolute -left-1 top-3 h-3 w-3 rotate-45 border-b border-l border-white/80 bg-white/85" />
        <p className="text-[13px] leading-[1.9] text-ink-800">{text}</p>
        <p className="mt-2 text-[10px] text-ink-300">可以直接复制，也可以改成你自己的说法</p>
      </motion.div>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
        <button onClick={copy} className="btn-primary px-4 py-2 text-[12px]">
          <Icon name={copied ? 'check' : 'send'} size={13} />
          {copied ? '已复制' : '复制这句话'}
        </button>
        <button onClick={() => setVariant((v) => v + 1)} className="btn-ghost px-3 py-2 text-[12px]">
          <Icon name="refresh" size={13} />
          换一句
        </button>
        {!copied && <span className="text-[10px] text-ink-300">发出去一句，就已经在求助了</span>}
      </div>
    </section>
  )
}
