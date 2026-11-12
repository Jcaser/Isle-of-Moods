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
  const voice =
    voices.find((v) => v.voiceURI === opts.voiceURI) ??
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
