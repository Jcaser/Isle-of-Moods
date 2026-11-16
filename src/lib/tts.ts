/** 语音层：Web Speech API 合成（AI TTS 正念引导）与语音输入 */

export interface VoiceOption {
  uri: string
  name: string
  lang: string
}

export function listVoices(): Promise<VoiceOption[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve([])
      return
    }
    const pick = () => {
      const all = window.speechSynthesis.getVoices()
      resolve(
        all.map((v) => ({ uri: v.voiceURI, name: v.name, lang: v.lang })),
      )
    }
    const voices = window.speechSynthesis.getVoices()
    if (voices.length) pick()
    else {
      window.speechSynthesis.onvoiceschanged = pick
      setTimeout(pick, 800)
    }
  })
}

export function isTTSSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function cancelSpeech(): void {
  if (isTTSSupported()) window.speechSynthesis.cancel()
}

export interface SpeakOptions {
  voiceURI?: string
  rate?: number
  pitch?: number
  onSentence?: (index: number) => void
  onEnd?: () => void
}

/**
 * 逐句朗读，便于做句子级高亮。
 * 返回 stop 函数；调用后立即停止且不再回调。
 */
export function speak(sentences: string[], opts: SpeakOptions = {}): () => void {
  if (!isTTSSupported()) {
    opts.onEnd?.()
    return () => {}
  }
  window.speechSynthesis.cancel()
  let stopped = false
  const voices = window.speechSynthesis.getVoices()
  // 兜底色：优先挑名字里带 Xiaoxiao / Natural 的中文音色，其次任意中文音色
  const voice =
    voices.find((v) => v.voiceURI === opts.voiceURI) ??
    voices.find((v) => /xiaoxiao/i.test(v.name) && v.lang.startsWith('zh')) ??
    voices.find((v) => /(natural|online)/i.test(v.name) && v.lang.startsWith('zh')) ??
    voices.find((v) => v.lang === 'zh-CN') ??
    voices.find((v) => v.lang.startsWith('zh'))

  let i = 0
  const next = () => {
    if (stopped) return
    if (i >= sentences.length) {
      opts.onEnd?.()
      return
    }
    const idx = i++
    opts.onSentence?.(idx)
    const u = new SpeechSynthesisUtterance(sentences[idx])
    if (voice) u.voice = voice
    u.lang = voice?.lang ?? 'zh-CN'
    u.rate = opts.rate ?? 0.92
    u.pitch = opts.pitch ?? 1.0
    u.volume = 1
    u.onend = next
    u.onerror = next
    window.speechSynthesis.speak(u)
  }
  next()

  return () => {
    stopped = true
    window.speechSynthesis.cancel()
  }
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？；\n])/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/* ───────────────────────── 岛主之声：云端神经语音 ─────────────────────────
 * 服务端的 /api/tts 会用和 Edge「大声朗读」同一套音色合成 mp3。
 * 好处是每个浏览器听起来都一样、不再是 Huihui 那种老式机器音。
 * 网络不通就整段退回浏览器内置 TTS，保证「点了总有声音」。
 */

export const ISLAND_VOICES = [
  { id: 'zh-CN-XiaoxiaoNeural', label: '晓晓 · 温柔女声' },
  { id: 'zh-CN-XiaoyiNeural', label: '晓伊 · 明亮少女' },
  { id: 'zh-CN-YunxiNeural', label: '云希 · 清朗男声' },
  { id: 'zh-CN-YunjianNeural', label: '云健 · 沉稳男声' },
] as const

export const DEFAULT_ISLAND_VOICE = ISLAND_VOICES[0].id

export interface CloudSpeakOptions extends SpeakOptions {
  /** Edge TTS 音色 id，见 ISLAND_VOICES */
  voice?: string
}

const speechCache = new Map<string, string>()
const CACHE_LIMIT = 60
let cloudDownAt = 0

/** 云端语音降级窗口：5 分钟内不再重试，避免每次朗读都先卡一下 */
function cloudUsable() {
  return Date.now() - cloudDownAt > 5 * 60 * 1000
}

function cacheSpeech(text: string, opts: CloudSpeakOptions): Promise<string> {
  const voice = opts.voice || DEFAULT_ISLAND_VOICE
  const rate = opts.rate ?? 0.92
  const key = `${voice}|${rate.toFixed(2)}|${text}`
  const hit = speechCache.get(key)
  if (hit) return Promise.resolve(hit)
  return fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice, rate }),
  }).then(async (r) => {
    if (!r.ok) throw new Error(`tts ${r.status}`)
    // 静态预览环境没有代理，SPA 兜底会返回 index.html —— 当音频用会解码失败
    if (!(r.headers.get('content-type') ?? '').startsWith('audio/')) throw new Error('tts not audio')
    const blob = await r.blob()
    if (!blob.size) throw new Error('tts empty')
    const url = URL.createObjectURL(blob)
    if (speechCache.size >= CACHE_LIMIT) {
      const oldest = speechCache.keys().next().value
      if (oldest) {
        const old = speechCache.get(oldest)
        if (old) URL.revokeObjectURL(old)
        speechCache.delete(oldest)
      }
    }
    speechCache.set(key, url)
    return url
  })
}

/**
 * 优先用岛主之声朗读；云端不可用时整段退回浏览器 TTS。
 * 句子级回调保留，方便继续做逐句高亮。
 */
export function speakCloud(sentences: string[], opts: CloudSpeakOptions = {}): () => void {
  let stopped = false
  let audio: HTMLAudioElement | null = null
  let browserStop: (() => void) | null = null
  const pending = new Map<number, Promise<string>>()

  const prefetch = (index: number) => {
    if (index >= sentences.length || pending.has(index)) return
    pending.set(index, cacheSpeech(sentences[index], opts))
  }

  const finish = () => {
    if (stopped) return
    stopped = true
    opts.onEnd?.()
  }

  const fallback = (from: number) => {
    if (stopped) return
    cloudDownAt = Date.now()
    browserStop = speak(sentences.slice(from), opts)
  }

  const run = async (start: number) => {
    for (let i = start; i < sentences.length; i++) {
      if (stopped) return
      opts.onSentence?.(i)
      prefetch(i + 1)
      let url: string
      try {
        url = await pending.get(i)!
      } catch {
        if (i === start) {
          fallback(i)
          return
        }
        continue
      }
      if (stopped) {
        URL.revokeObjectURL(url)
        return
      }
      const ok = await new Promise<boolean>((resolve) => {
        const el = new Audio(url)
        audio = el
        el.onended = () => resolve(true)
        el.onerror = () => resolve(false)
        el.play().catch(() => resolve(false))
      })
      audio = null
      if (stopped) return
      if (!ok && i === start) {
        fallback(i)
        return
      }
    }
    finish()
  }

  if (!sentences.length) {
    opts.onEnd?.()
    return () => {}
  }

  if (cloudUsable()) {
    prefetch(0)
    void run(0)
  } else {
    fallback(0)
  }

  return () => {
    stopped = true
    browserStop?.()
    browserStop = null
    if (audio) {
      audio.pause()
      audio = null
    }
    cancelSpeech()
    pending.clear()
  }
}

/** 语音输入（Chrome / Edge 支持） */
export function isASRSupported(): boolean {
  return typeof window !== 'undefined' && Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
}

export function startRecognition(
  onResult: (text: string, final: boolean) => void,
  onEnd: () => void,
): () => void {
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (!Ctor) {
    onEnd()
    return () => {}
  }
  const rec = new Ctor()
  rec.lang = 'zh-CN'
  rec.continuous = true
  rec.interimResults = true
  rec.onresult = (e: any) => {
    let text = ''
    let final = false
    for (let i = e.resultIndex; i < e.results.length; i++) {
      text += e.results[i][0].transcript
      if (e.results[i].isFinal) final = true
    }
    onResult(text, final)
  }
  rec.onerror = () => onEnd()
  rec.onend = () => onEnd()
  rec.start()
  return () => {
    try {
      rec.stop()
    } catch {
      /* noop */
    }
  }
}
