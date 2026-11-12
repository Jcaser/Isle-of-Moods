/**
 * 极轻量的 WebAudio 音效。
 * 不加载任何音频文件，全部用振荡器合成，避免额外体积与网络请求。
 * 浏览器要求首次发声必须发生在用户手势之后，因此这里都是点击时才创建上下文。
 */

let ctx: AudioContext | null = null

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, slide = 0) {
  const a = ac()
  if (!a) return
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, a.currentTime)
  if (slide) {
    o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), a.currentTime + dur)
  }
  g.gain.setValueAtTime(0.0001, a.currentTime)
  g.gain.linearRampToValueAtTime(gain, a.currentTime + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur)
  o.connect(g)
  g.connect(a.destination)
  o.start()
  o.stop(a.currentTime + dur + 0.03)
}

function noise(dur: number, gain = 0.05, hp = 400) {
  const a = ac()
  if (!a) return
  const len = Math.floor(a.sampleRate * dur)
  const buffer = a.createBuffer(1, len, a.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2
  }
  const src = a.createBufferSource()
  src.buffer = buffer
  const filter = a.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value = hp
  const g = a.createGain()
  g.gain.value = gain
  src.connect(filter)
  filter.connect(g)
  g.connect(a.destination)
  src.start()
}

let muted = false

export function setMuted(v: boolean) {
  muted = v
}
export function isMuted() {
  return muted
}

export const sfx = {
  pop(step = 0) {
    if (muted) return
    tone(480 + step * 26, 0.13, 'sine', 0.05, 300)
    noise(0.05, 0.018, 1200)
  },
  plink() {
    if (muted) return
    tone(920, 0.22, 'triangle', 0.035, -180)
  },
  splash() {
    if (muted) return
    noise(0.22, 0.045, 600)
    tone(200, 0.12, 'sine', 0.03, -80)
  },
  chime() {
    if (muted) return
    tone(784, 0.42, 'sine', 0.035)
    window.setTimeout(() => tone(1046, 0.55, 'sine', 0.03), 110)
    window.setTimeout(() => tone(1318, 0.7, 'sine', 0.022), 230)
  },
  whoosh() {
    if (muted) return
    noise(0.3, 0.04, 300)
  },
  tick() {
    if (muted) return
    tone(1200, 0.05, 'square', 0.014)
  },
}
