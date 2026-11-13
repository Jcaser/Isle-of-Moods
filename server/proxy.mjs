/**
 * 岛主 AI · 服务端代理（火山方舟 Ark / OpenAI 兼容协议）
 * ---------------------------------------------------------------------------
 * 为什么需要这一层：
 *   1. 比赛硬性要求 —— API Key 不能出现在任何公开代码仓库里，也不能被打包进前端产物。
 *      浏览器直连模型时 Key 对访问者可见，因此把 Key 收进服务端环境变量，前端只调本地 /api。
 *   2. 额度保护 —— 记录每次调用的 token 用量，触及自设上限后立刻拒绝请求，
 *      并把「额度已用完」如实告诉前端，不再偷偷烧钱。
 *   3. 成本控制 —— 强制关闭深度思考（thinking）、收敛 max_tokens、限制上下文轮数。
 *
 * 只使用 Node 内置能力，无第三方依赖。运行：node server/proxy.mjs
 */

import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DIST = path.join(ROOT, 'dist')
const USAGE_FILE = path.join(__dirname, '.usage.json')

/* ────────────────────────── 读取环境变量 ────────────────────────── */

/** 极简 .env 解析：只认 KEY=VALUE，忽略注释与空行 */
function readEnvFile(file) {
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i <= 0) continue
    const key = line.slice(0, i).trim()
    let val = line.slice(i + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

// .env.local 优先于 .env；系统环境变量优先级最高
const fileEnv = { ...readEnvFile(path.join(ROOT, '.env')), ...readEnvFile(path.join(ROOT, '.env.local')) }
const env = (key, fallback = '') => {
  const v = process.env[key] ?? fileEnv[key]
  return v === undefined || v === '' ? fallback : v
}

const ARK_KEY = env('ARK_API_KEY')
const ARK_BASE = env('ARK_BASE_URL', 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/+$/, '')
const ARK_MODEL = env('ARK_MODEL', 'doubao-seed-2-1-turbo-260628')
const TOKEN_BUDGET = Number(env('ARK_TOKEN_BUDGET', '300000')) || 300000
const MAX_OUTPUT_TOKENS = Number(env('ARK_MAX_OUTPUT_TOKENS', '700')) || 700
const PORT = Number(env('PROXY_PORT', '8787')) || 8787
const RATE_LIMIT = Number(env('ARK_RATE_LIMIT', '20')) || 20 // 每分钟最大请求数
const LOCK_MODEL = env('ARK_LOCK_MODEL', '1') !== '0'

/* ────────────────────────── 用量账本 ────────────────────────── */

const initialUsage = (() => {
  try {
    const j = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'))
    return {
      used: Number(j.used) || 0,
      prompt: Number(j.prompt) || 0,
      completion: Number(j.completion) || 0,
      calls: Number(j.calls) || 0,
      lastAt: j.lastAt ?? null,
      exhaustedAt: j.exhaustedAt ?? null,
    }
  } catch {
    return { used: 0, prompt: 0, completion: 0, calls: 0, lastAt: null, exhaustedAt: null }
  }
})()

const usage = { ...initialUsage }
let saveTimer = null

function persistUsage() {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    try {
      fs.writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 2))
    } catch (e) {
      console.warn('[usage] 写入失败：', e.message)
    }
  }, 800)
}

function addUsage(u) {
  if (!u) return
  const prompt = Number(u.prompt_tokens) || 0
  const completion = Number(u.completion_tokens) || 0
  const total = Number(u.total_tokens) || prompt + completion
  usage.used += total
  usage.prompt += prompt
  usage.completion += completion
  usage.calls += 1
  usage.lastAt = new Date().toISOString()
  if (usage.used >= TOKEN_BUDGET && !usage.exhaustedAt) usage.exhaustedAt = usage.lastAt
  persistUsage()
}

const quotaSnapshot = () => ({
  used: usage.used,
  budget: TOKEN_BUDGET,
  remaining: Math.max(0, TOKEN_BUDGET - usage.used),
  ratio: Math.min(1, usage.used / TOKEN_BUDGET),
  exhausted: usage.used >= TOKEN_BUDGET,
  calls: usage.calls,
  lastAt: usage.lastAt,
})

/* ────────────────────────── 限流 ────────────────────────── */

const hits = new Map() // ip -> number[] 时间戳
function limited(ip) {
  const now = Date.now()
  const win = (hits.get(ip) ?? []).filter((t) => now - t < 60_000)
  win.push(now)
  hits.set(ip, win)
  return win.length > RATE_LIMIT
}

/* ────────────────────────── HTTP 小工具 ────────────────────────── */

function sendJson(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  })
  res.end(text)
}

function sendError(res, status, code, message) {
  sendJson(res, status, { error: { code, message, type: status === 429 ? 'rate_limit' : 'invalid_request' } })
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > 1_000_000) {
        reject(new Error('请求体过大'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/* ────────────────────────── 静态资源（生产演示用） ────────────────────────── */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
}

function serveStatic(req, res, pathname) {
  if (!fs.existsSync(DIST)) {
    sendJson(res, 200, {
      ok: false,
      hint: '前端产物不存在：请先 npm run build，或用 npm run dev 启动开发服务器。',
      api: ['/api/health', '/api/chat/completions'],
    })
    return
  }
  const rel = decodeURIComponent(pathname).replace(/^\/+/, '')
  let file = path.join(DIST, rel || 'index.html')
  // 防目录穿越
  if (!file.startsWith(DIST)) file = path.join(DIST, 'index.html')
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
  const ext = path.extname(file).toLowerCase()
  res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' })
  fs.createReadStream(file).pipe(res)
}

/* ────────────────────────── 核心：转发对话请求 ────────────────────────── */

async function handleChat(req, res, ip) {
  if (!ARK_KEY) {
    sendError(res, 503, 'NoApiKey', '服务端未配置 ARK_API_KEY，请检查 .env.local，或以本地知识模式运行。')
    return
  }
  if (usage.used >= TOKEN_BUDGET) {
    sendError(
      res,
      429,
      'QuotaExhausted',
      `免费额度已达到自设上限（${usage.used}/${TOKEN_BUDGET} tokens），岛主已停止调用云端模型。`,
    )
    return
  }
  if (limited(ip)) {
    sendError(res, 429, 'RateLimited', '请求太频繁了，休息一分钟再聊。')
    return
  }

  let payload
  try {
    payload = JSON.parse(await readBody(req))
  } catch {
    sendError(res, 400, 'BadJSON', '请求体不是合法 JSON')
    return
  }

  const wantsStream = payload.stream !== false
  const upstreamBody = {
    ...payload,
    // 模型名由服务端决定，避免前端误传或误用贵的模型
    model: LOCK_MODEL ? ARK_MODEL : payload.model || ARK_MODEL,
    // 关闭深度思考：思考 token 会成倍计入用量，且会让回复变慢变长
    thinking: { type: 'disabled' },
    // 收敛输出长度，避免长篇大论与额度浪费
    max_tokens: Math.min(Number(payload.max_tokens) || MAX_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS),
    stream: wantsStream,
    ...(wantsStream ? { stream_options: { include_usage: true } } : {}),
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 75_000)
  res.on('close', () => {
    clearTimeout(timeout)
    if (!res.writableEnded) controller.abort()
  })

  let upstream
  try {
    upstream = await fetch(`${ARK_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ARK_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(upstreamBody),
      signal: controller.signal,
    })
  } catch (e) {
    clearTimeout(timeout)
    const aborted = (e && e.name === 'AbortError') || controller.signal.aborted
    sendError(res, aborted ? 504 : 502, 'UpstreamUnreachable', `无法连接火山方舟：${(e && e.message) || '网络异常'}`)
    return
  }

  // 上游报错：原样转成 OpenAI 风格，前端好读
  if (!upstream.ok) {
    clearTimeout(timeout)
    const text = await upstream.text().catch(() => '')
    let msg = text.slice(0, 400)
    let code = 'UpstreamError'
    try {
      const j = JSON.parse(text)
      msg = j?.error?.message ?? msg
      code = j?.error?.code ?? code
    } catch {
      /* 保留原文 */
    }
    console.warn(`[ark] ${upstream.status} ${code}`)
    sendJson(res, upstream.status, { error: { code, message: msg, type: 'upstream' } })
    return
  }

  if (!wantsStream) {
    const json = await upstream.json().catch(() => null)
    clearTimeout(timeout)
    if (!json) {
      sendError(res, 502, 'BadUpstream', '上游返回内容无法解析')
      return
    }
    addUsage(json.usage)
    sendJson(res, 200, json)
    return
  }

  // 流式：边转发边从 usage 帧累加，不改动任何内容
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  })

  const reader = upstream.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let counted = false

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(Buffer.from(value))

      buffer += decoder.decode(value, { stream: true })
      let idx
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim()
        buffer = buffer.slice(idx + 1)
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (!data || data === '[DONE]') continue
        try {
          const j = JSON.parse(data)
          if (j.usage && !counted) {
            counted = true
            addUsage(j.usage)
            console.log(
              `[ark] +${j.usage.total_tokens ?? 0} tokens（累计 ${usage.used}/${TOKEN_BUDGET}${usage.used >= TOKEN_BUDGET ? '，额度已用完' : ''}）`,
            )
          }
        } catch {
          /* 单帧解析失败不影响转发 */
        }
      }
    }
  } catch (e) {
    if (!controller.signal.aborted) console.warn('[ark] 流中断：', e.message)
  } finally {
    clearTimeout(timeout)
    if (!res.writableEnded) res.end()
  }
}

/* ────────────────────────── 路由 ────────────────────────── */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  const p = url.pathname
  const ip = req.socket.remoteAddress ?? 'local'

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    })
    res.end()
    return
  }

  if (p === '/api/health' || p === '/api/quota') {
    sendJson(res, 200, {
      ok: Boolean(ARK_KEY) && usage.used < TOKEN_BUDGET,
      provider: 'volcengine-ark',
      model: ARK_MODEL,
      hasKey: Boolean(ARK_KEY),
      quota: quotaSnapshot(),
      limits: {
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        maxHistoryTurns: 4,
        thinking: 'disabled',
        ratePerMinute: RATE_LIMIT,
      },
    })
    return
  }

  if (p === '/api/quota/reset' && req.method === 'POST') {
    usage.used = 0
    usage.calls = 0
    usage.exhaustedAt = null
    persistUsage()
    sendJson(res, 200, { ok: true, quota: quotaSnapshot() })
    return
  }

  if (p.endsWith('/chat/completions') || p === '/api/chat') {
    if (req.method !== 'POST') {
      sendError(res, 405, 'MethodNotAllowed', '请用 POST')
      return
    }
    await handleChat(req, res, ip)
    return
  }

  if (p.startsWith('/api/')) {
    sendError(res, 404, 'NotFound', `未知接口 ${p}`)
    return
  }

  serveStatic(req, res, p)
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  岛主 AI 代理已启动  http://127.0.0.1:${PORT}`)
  console.log(`  模型：${ARK_MODEL}`)
  console.log(`  Key：${ARK_KEY ? '已从环境变量读取（不会下发到浏览器）' : '缺失，将以本地知识模式运行'}`)
  console.log(`  额度上限：${usage.used} / ${TOKEN_BUDGET} tokens（达到即停）\n`)
})
