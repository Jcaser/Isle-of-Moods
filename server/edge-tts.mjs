/**
 * 岛主之声 · Edge TTS 合成（服务端，零第三方依赖）
 * ---------------------------------------------------------------------------
 * 为什么要自己写：
 *   浏览器内置的 speechSynthesis 在 Windows 上只有 Huihui / Yaoyao 这类老式
 *   音色，机械感很强。这里直接连微软 Edge「大声朗读」所用的同一套神经语音
 *   （zh-CN-XiaoxiaoNeural），让岛主的声音和用户听到的试听音频完全一致。
 *
 * 三个技术点：
 *   1. 协议：WebSocket + 自定义头部（Origin 必须是 Edge 扩展来源），
 *      先发 speech.config，再发 ssml，音频以二进制帧回来。
 *   2. 鉴权：Sec-MS-GEC 需要每 5 分钟刷新的时间戳签名（SHA-256 变体 + CS64
 *      摘要），算法与微软前端一致，见 drm 段。
 *   3. 缓存：同一句话只合成一次，落在 server/.tts-cache/，重复朗读零延迟。
 *
 * 只使用 Node 内置模块（>= 20 才有全局 WebSocket）。合成失败一律抛出，
 * 由上层降级到浏览器 TTS，绝不让朗读按钮「点了没反应」。
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const CHROMIUM_FULL_VERSION = '143.0.3650.75'
const SEC_MS_GEC_VERSION = `2-${CHROMIUM_FULL_VERSION}`
const WIN_EPOCH = 11644473600
const WSS = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1'
const OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3'

/** 岛主默认音色：与 public/voice 下的试听音频同源 */
export const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural'

/* ──────────────────────────── SHA-256 / CS64 ──────────────────────────── */
/* 微软把标准 SHA-256 做了改写（他们管它叫 SHA-256），并额外算一枚 128 位
 * CS64 摘要，拼成 "<cs64>-<sha256>" 作为 Sec-MS-GEC。这里逐位复刻。 */

const U32 = 0xffffffffn

/* 常量一律写十进制，避免手抄十六进制时出错 */
const SHA_INITIAL = [1779033703n, 3144134277n, 1013904242n, 2773480762n, 1359893119n, 2600822924n, 528734635n, 1541459225n]
const SHA_STATE = [4255104674n, 2435071207n, 3192492180n, 3442351626n, 1811967817n, 79508907n, 4272990180n, 66059218n]
const SHA_SCHEDULE = [
  3945054110n, 358115615n, 2696978146n, 217723578n, 2787307148n, 3520959633n, 3235718560n,
  4192668342n, 4039316851n, 1884868174n, 1904797190n, 15051571n, 3529027680n, 1920361828n,
]
const SHA_ROUND_CONSTANTS = [
  1116352408n, 1899447441n, 3049323471n, 3921009573n, 961987163n, 1508970993n, 2453635748n, 2870763221n,
  3624381080n, 310598401n, 607225278n, 1426881987n, 1925078388n, 2162078206n, 2614888103n, 3248222580n,
  3835390401n, 4022224774n, 264347078n, 604807628n, 770255983n, 1249150122n, 1555081692n, 1996064986n,
  2554220882n, 2821834349n, 2952996808n, 3210313671n, 3336571891n, 3584528711n, 113926993n, 338241895n,
  666307205n, 773529912n, 1294757372n, 1396182291n, 1695183700n, 1986661051n, 2177026350n, 2456956037n,
  2730485921n, 2820302411n, 3259730800n, 3345764771n, 3516065817n, 3600352804n, 4094571909n, 275423344n,
  430227734n, 506948616n, 659060556n, 883997877n, 958139571n, 1322822218n, 1537002063n, 1747873779n,
  1955562222n, 2024104815n, 2227730452n, 2361852424n, 2428436474n, 2756734187n, 3204031479n, 3329325298n,
]
const SHA_ADJUSTMENT = 3386640039n
const SHA_BLOCK_CONSTANTS = [
  ...SHA_ROUND_CONSTANTS.slice(0, 14),
  SHA_ADJUSTMENT,
  ...SHA_ROUND_CONSTANTS.slice(15),
]
const SIGMA0_ADJUSTMENT = 94112640n
const SIGMA1_ADJUSTMENT = 758464n

const CS64_COEFFICIENTS = [
  [3895366065, 3005677776], [1155409094, 2296378653], [1005282748, 693190712],
  [3365689651, 3005795295], [2367603217, 3557143765], [827258325, 652566332],
  [3911487921, 1618477510], [4037392853, 2192753147], [101076211, 4199654362],
  [3665427040, 545047652], [3201434976, 1010595059], [2314848760, 3536931681],
  [905590982, 3137643201], [3410617286, 3311559015],
]
const CS64_FACTOR = 2190031155n
const CS64_ADJUSTMENT0 = 4076407578n
const CS64_ADJUSTMENT1 = 186253312n

const rol16 = (v) => {
  const x = v & U32
  return ((x << 16n) | (x >> 16n)) & U32
}

const sigma0 = (v) => ((v >> 7n) ^ (v << 25n) ^ (v >> 18n) ^ (v << 14n) ^ (v >> 3n)) & U32
const sigma1 = (v) => ((v >> 17n) ^ (v << 15n) ^ (v >> 19n) ^ (v << 13n) ^ (v >> 10n)) & U32

/** 小端 32 位分字，末尾补零到偶数个 */
function wordsLE4Even(buf) {
  const pad = (4 - (buf.length % 4)) % 4
  const total = buf.length + pad
  if (total === 0) return []
  const words = []
  for (let i = 0; i < total; i += 4) {
    words.push(
      (BigInt(buf[i] ?? 0)) |
        (BigInt(buf[i + 1] ?? 0) << 8n) |
        (BigInt(buf[i + 2] ?? 0) << 16n) |
        (BigInt(buf[i + 3] ?? 0) << 24n),
    )
  }
  if (words.length % 2) words.push(0n)
  return words
}

function beWords(buf) {
  const words = []
  for (let i = 0; i < buf.length; i += 4) {
    words.push(((BigInt(buf[i]) << 24n) | (BigInt(buf[i + 1]) << 16n) | (BigInt(buf[i + 2]) << 8n) | BigInt(buf[i + 3])))
  }
  return words
}

function expandSchedule(words, firstWord = 16) {
  for (let i = firstWord; i < 64; i++) {
    const x = words[i - 2]
    const y = words[i - 15]
    const s1 = (x >> 17n) ^ (x << 15n) ^ (x >> 19n) ^ (x << 13n) ^ (x >> 10n)
    const s0 = (y >> 7n) ^ (y << 25n) ^ (y >> 18n) ^ (y << 14n) ^ (y >> 3n)
    words.push((s1 + words[i - 7] + s0 + words[i - 16]) & U32)
  }
}

const rotr = (v, n) => ((v >> n) | (v << (32n - n))) & U32

function shaRounds(state, words, firstRound = 0) {
  let [a, b, c, d, e, f, g, h] = state
  const constants = firstRound === 14 ? SHA_BLOCK_CONSTANTS : SHA_ROUND_CONSTANTS
  for (let i = firstRound; i < 64; i++) {
    const s1 = rotr(e, 6n) ^ rotr(e, 11n) ^ rotr(e, 25n)
    const ch = g ^ (e & (f ^ g))
    const t1 = (h + s1 + ch + constants[i] + words[i]) & U32
    const s0 = rotr(a, 2n) ^ rotr(a, 13n) ^ rotr(a, 22n)
    const maj = (a & b) | (c & (a | b))
    const t2 = (s0 + maj) & U32
    h = g
    g = f
    f = e
    e = (d + t1) & U32
    d = c
    c = b
    b = a
    a = (t1 + t2) & U32
  }
  return [a, b, c, d, e, f, g, h]
}

function shaInit(buf) {
  const words = Array.from({ length: 14 }, () => 0n)
  words.push((BigInt(buf[0]) << 16n) | (BigInt(buf[1]) << 8n) | BigInt(buf[2]))
  words.push((BigInt(buf[3]) << 24n) | (BigInt(buf[4]) << 16n) | (BigInt(buf[5]) << 8n) | BigInt(buf[6]))
  for (let i = 16; i < 30; i++) {
    let value = SHA_SCHEDULE[i - 16]
    if (i - 2 >= 14) {
      value += i === 16 ? sigma1(words[i - 2]) ^ SIGMA1_ADJUSTMENT : sigma1(words[i - 2])
    }
    if (i - 7 >= 14) value += words[i - 7]
    if (i - 15 >= 14) {
      value += i === 29 ? sigma0(words[i - 15]) ^ SIGMA0_ADJUSTMENT : sigma0(words[i - 15])
    }
    words.push(value & U32)
  }
  words.push(
    (sigma1(words[28]) + words[23] + sigma0(words[15]) + words[14] + SHA_ADJUSTMENT - SHA_ROUND_CONSTANTS[14]) & U32,
  )
  expandSchedule(words, 31)
  const working = shaRounds(SHA_STATE, words, 14)
  return working.map((w, i) => (w + SHA_INITIAL[i]) & U32)
}

/** SHA-256 摘要（64 位十六进制） */
function sha181Digest(data) {
  if (data.length < 7) throw new Error('token salt too short')
  const length = 57 + data.length
  const tail = data.subarray(7)
  const body = [Buffer.from(tail), Buffer.from([0x80])]
  const zeroCount = (((55 - length) % 64) + 64) % 64
  body.push(Buffer.alloc(zeroCount))
  const lenBuf = Buffer.alloc(8)
  lenBuf.writeBigUInt64BE(BigInt(length * 8))
  body.push(lenBuf)
  const padded = Buffer.concat(body)
  let state = shaInit(data.subarray(0, 7))
  for (let off = 0; off < padded.length; off += 64) {
    const words = beWords(padded.subarray(off, off + 64))
    expandSchedule(words, 16)
    const working = shaRounds(state, words)
    state = state.map((w, i) => (w + working[i]) & U32)
  }
  const out = Buffer.alloc(32)
  state.forEach((w, i) => out.writeUInt32BE(Number(w), i * 4))
  return out
}

/** CS64 摘要（16 位十六进制） */
function cs64Digest(data, digest) {
  let keyA = digest.readUInt32LE(0)
  let keyB = digest.readUInt32LE(4)
  keyA |= 1
  keyB |= 1
  const a = BigInt(keyA)
  const b = BigInt(keyB)
  const factors = [(a * CS64_FACTOR) & U32, (b * CS64_FACTOR) & U32]
  const terms = CS64_COEFFICIENTS.map(([coeff], i) => (BigInt(coeff) * factors[i % 2]) & U32)
  const offsets = CS64_COEFFICIENTS.map(([, off]) => BigInt(off))
  const body = Buffer.concat([Buffer.from([0]), data])
  wordsLE4Even(body).forEach((word, index) => {
    const even = index % 2 === 0
    let term = word * (even ? a : b)
    let offset = rol16(word) * (even ? 0xef0569fbn : 0xc31713dbn)
    if (index === 0) {
      term += CS64_ADJUSTMENT0 * factors[0]
      offset += CS64_ADJUSTMENT1
    }
    terms.push(term & U32)
    offsets.push(offset & U32)
  })
  let swapAcc = 0n
  let swapLast = 0n
  let state = 0n
  let acc = 0n
  for (let i = 0; i < terms.length; i += 2) {
    let t = rol16((offsets[i] + terms[i]) & U32)
    let q = (t * 0x76f50f34n) & U32
    swapAcc += (rol16(q) * 0xc3efea97n + q) & U32
    t = rol16((offsets[i + 1] + terms[i + 1]) & U32)
    q = (t * 0x1881ce3cn) & U32
    swapLast = (rol16(q) * 0x35bd1ec9n + q) & U32
    swapAcc = (swapAcc + swapLast) & U32

    state = (state * a + terms[i]) & U32
    state = (rol16(state) * 0xcf98b111n) & U32
    state = (rol16(state) * 0x87085b9fn) & U32
    state = (rol16(state) * 0x12ceb96dn) & U32
    state = (rol16(state) * 0x257e1d83n) & U32
    acc += state
    t = (state * b + terms[i + 1]) & U32
    t = (rol16(t) * 0xa27416f5n) & U32
    t = (rol16(t) * 0xd38396ffn) & U32
    state = (rol16((rol16(t) * 0x7c932b89n) & U32) * 0xbfa49f69n) & U32
    acc = (acc + state) & U32
  }
  const w0 = Number((swapLast ^ state) & U32)
  const w1 = Number((swapAcc ^ acc) & U32)
  const out = Buffer.alloc(8)
  out.writeUInt32LE(w0, 0)
  out.writeUInt32LE(w1, 4)
  return out.toString('hex').toUpperCase()
}

/** 生成 5 分钟内有效的 Sec-MS-GEC；传入时间戳便于自测 */
export function secMsGec(unixTimestamp = Date.now() / 1000) {
  let ticks = unixTimestamp + WIN_EPOCH
  ticks -= ticks % 300
  ticks *= 1e7
  const salt = Buffer.from(`${BigInt(Math.round(ticks))}${TRUSTED_CLIENT_TOKEN}`, 'ascii')
  const digest = sha181Digest(salt)
  return `${cs64Digest(salt, digest)}-${digest.toString('hex').toUpperCase()}`
}

/* ──────────────────────────── 合成实现 ──────────────────────────── */

const WS_HEADERS = {
  Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
  'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0`,
  Pragma: 'no-cache',
  'Cache-Control': 'no-cache',
}

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * 把一段文字合成为 mp3。
 * @param {string} text 纯文本（会做 XML 转义）
 * @param {{voice?:string, rate?:number, pitch?:number, timeout?:number}} opts
 *   rate / pitch 用 Web Speech 的语义（1 = 正常），内部换算成 SSML 的百分比 / 赫兹。
 */
export function synthesize(text, opts = {}) {
  const voice = opts.voice || DEFAULT_VOICE
  const ratePct = Math.round(((opts.rate ?? 1) - 1) * 100)
  const pitchHz = Math.round(((opts.pitch ?? 1) - 1) * 50)
  const timeout = opts.timeout ?? 20000
  const clean = text.replace(/[#*`>_~]/g, '').trim().slice(0, 1200)
  if (!clean) return Promise.reject(new Error('empty text'))

  const connectionId = crypto.randomUUID().replace(/-/g, '')
  const url =
    `${WSS}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${encodeURIComponent(secMsGec())}` +
    `&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&ConnectionId=${connectionId}`

  return new Promise((resolve, reject) => {
    if (typeof WebSocket === 'undefined') {
      reject(new Error('WebSocket unavailable (need Node >= 20)'))
      return
    }
    const ws = new WebSocket(url, { headers: WS_HEADERS })
    ws.binaryType = 'arraybuffer'
    const chunks = []
    let settled = false
    const timer = setTimeout(() => fail(new Error('tts timeout')), timeout)

    function fail(err) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        ws.close()
      } catch {}
      reject(err)
    }
    function done() {
      if (settled) return
      if (!chunks.length) return fail(new Error('empty audio'))
      settled = true
      clearTimeout(timer)
      try {
        ws.close()
      } catch {}
      resolve(Buffer.concat(chunks))
    }

    ws.onopen = () => {
      const stamp = new Date().toISOString()
      ws.send(
        `X-Timestamp:${stamp}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
          JSON.stringify({
            context: {
              synthesis: {
                audio: {
                  metadataoptions: { sentenceBoundaryEnabled: false, wordBoundaryEnabled: false },
                  outputFormat: OUTPUT_FORMAT,
                },
              },
            },
          }),
      )
      const ssml =
        `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'>` +
        `<voice name='${voice}'><prosody rate='${ratePct}%' pitch='${pitchHz >= 0 ? '+' : ''}${pitchHz}Hz'>` +
        `${esc(clean)}</prosody></voice></speak>`
      ws.send(
        `X-RequestId:${crypto.randomUUID().replace(/-/g, '')}\r\nContent-Type:application/ssml+xml\r\n` +
          `X-Timestamp:${stamp}\r\nPath:ssml\r\n\r\n${ssml}`,
      )
    }
    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        if (ev.data.includes('Path:turn.end')) done()
        return
      }
      const buf = Buffer.from(ev.data)
      const head = buf.indexOf('Path:audio\r\n')
      if (head >= 0) chunks.push(buf.subarray(head + 12))
    }
    ws.onerror = () => fail(new Error('tts socket error'))
    ws.onclose = () => {
      if (!settled) done()
    }
  })
}

/* ──────────────────────────── 磁盘缓存 ──────────────────────────── */

const CACHE_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '.tts-cache')

function cachePath(text, voice, rate, pitch) {
  const key = crypto.createHash('sha1').update(`${voice}|${rate}|${pitch}|${text}`).digest('hex').slice(0, 24)
  return path.join(CACHE_DIR, `${key}.mp3`)
}

/** 先查缓存，再合成；返回 { audio, cached } */
export async function synthesizeCached(text, opts = {}) {
  const voice = opts.voice || DEFAULT_VOICE
  const rate = opts.rate ?? 1
  const pitch = opts.pitch ?? 1
  const file = cachePath(text, voice, rate, pitch)
  try {
    const hit = fs.readFileSync(file)
    if (hit.length > 1000) return { audio: hit, cached: true }
  } catch {}
  const audio = await synthesize(text, { ...opts, voice, rate, pitch })
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
    fs.writeFileSync(file, audio)
  } catch {}
  return { audio, cached: false }
}

export const VOICE_PRESETS = [
  { id: 'zh-CN-XiaoxiaoNeural', label: '晓晓 · 温柔女声（默认）' },
  { id: 'zh-CN-XiaoyiNeural', label: '晓伊 · 明亮少女' },
  { id: 'zh-CN-YunxiNeural', label: '云希 · 清朗男声' },
  { id: 'zh-CN-YunjianNeural', label: '云健 · 沉稳男声' },
]
