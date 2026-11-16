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
import { DEFAULT_VOICE, VOICE_PRESETS, synthesizeCached } from './edge-tts.mjs'

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
const MAX_OUTPUT_TOKENS = Number(env('ARK_MAX_OUTPUT_TOKENS', '480')) || 480
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
      recent: Array.isArray(j.recent) ? j.recent.slice(-30) : [],
    }
  } catch {
    return { used: 0, prompt: 0, completion: 0, calls: 0, lastAt: null, exhaustedAt: null, recent: [] }
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
  usage.recent.push({ ts: usage.lastAt, prompt, completion, total })
  if (usage.recent.length > 30) usage.recent = usage.recent.slice(-30)
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
  /** 平均每次上游请求消耗，用来判断「一条消息到底花了多少」 */
  avgPerCall: usage.calls ? Math.round(usage.used / usage.calls) : 0,
  recent: usage.recent.slice(-12),
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

/** 宽松取值：非法输入退回默认值，避免前端传错就整条链路挂掉 */
function clampNumber(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
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

/* ────────────────────────── MCP 桥接（可选） ──────────────────────────
 * 浏览器不能直接拉起 stdio 的 MCP Server，所以由这一层做 JSON-RPC 桥接：
 *   initialize → notifications/initialized → tools/list / tools/call
 * 支持 Streamable HTTP 传输（JSON 或 SSE 响应都认）。
 * 没配 MCP_SERVERS 时整段逻辑不启用，接口返回空列表，前端静默跳过。
 */

const MCP_SERVERS = (env('MCP_SERVERS', '') || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const MCP_TIMEOUT = 8000
let rpcId = 1
let mcpCache = { at: 0, servers: [] }

function mcpName(url, i) {
  try {
    const u = new URL(url)
    return (u.hostname + u.pathname).replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || `mcp-${i}`
  } catch {
    return `mcp-${i}`
  }
}

async function mcpPost(url, payload, sid) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), MCP_TIMEOUT)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(sid ? { 'Mcp-Session-Id': sid } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    const newSid = res.headers.get('mcp-session-id') || sid
    const ct = res.headers.get('content-type') || ''
    let json = null
    if (ct.includes('text/event-stream')) {
      const text = await res.text()
      for (const line of text.split(/\r?\n/)) {
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (!data) continue
        try {
          const j = JSON.parse(data)
          if (j.id === payload.id) json = j
        } catch {
          /* 单帧解析失败忽略 */
        }
      }
    } else {
      const text = await res.text()
      json = text ? JSON.parse(text) : null
    }
    return { json, sid: newSid, status: res.status }
  } finally {
    clearTimeout(timer)
  }
}

async function mcpHandshake(url, name) {
  const init = await mcpPost(url, {
    jsonrpc: '2.0',
    id: rpcId++,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'serene-isle', version: '1.0.0' },
    },
  }).catch((e) => ({ json: { error: { message: e.message } } }))

  if (!init.json || init.json.error) {
    return { name, url, ok: false, error: init.json?.error?.message ?? 'initialize 失败', tools: [] }
  }
  const sid = init.sid
  await mcpPost(url, { jsonrpc: '2.0', method: 'notifications/initialized' }, sid).catch(() => {})
  const list = await mcpPost(url, { jsonrpc: '2.0', id: rpcId++, method: 'tools/list', params: {} }, sid).catch((e) => ({
    json: { error: { message: e.message } },
  }))
  if (!list.json || list.json.error) {
    return { name, url, sid, ok: false, error: list.json?.error?.message ?? 'tools/list 失败', tools: [] }
  }
  return { name, url, sid, ok: true, tools: list.json.result?.tools ?? [] }
}

async function refreshMcp(force = false) {
  if (!MCP_SERVERS.length) return []
  if (!force && Date.now() - mcpCache.at < 60_000) return mcpCache.servers
  const servers = await Promise.all(MCP_SERVERS.map((url, i) => mcpHandshake(url, mcpName(url, i))))
  mcpCache = { at: Date.now(), servers }
  const total = servers.reduce((n, s) => n + s.tools.length, 0)
  console.log(`[mcp] ${servers.length} 个 Server，共 ${total} 个工具`)
  return servers
}

/** MCP tools/call 的返回可能是 text / image / resource，这里只取文本，够聊天用 */
function mcpText(result) {
  const parts = result?.content ?? []
  const text = parts
    .filter((p) => p?.type === 'text')
    .map((p) => p.text)
    .join('\n')
    .trim()
  return text || (result?.isError ? '工具返回错误' : '（工具没有返回文本内容）')
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
              `[ark] +${j.usage.total_tokens ?? 0} tokens（prompt ${j.usage.prompt_tokens ?? 0} / completion ${
                j.usage.completion_tokens ?? 0
              }｜累计 ${usage.used}/${TOKEN_BUDGET}${usage.used >= TOKEN_BUDGET ? '，额度已用完' : ''}）`,
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
        maxHistoryTurns: 3,
        maxToolSteps: 3,
        knowledgeSnippets: 2,
        thinking: 'disabled',
        ratePerMinute: RATE_LIMIT,
        multimodal: ['text', 'image'],
      },
      mcp: {
        configured: MCP_SERVERS.length,
        online: mcpCache.servers.filter((s) => s.ok).length,
        tools: mcpCache.servers.reduce((n, s) => n + (s.tools?.length ?? 0), 0),
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

  /* ── 岛主之声：神经语音合成（与 Edge「大声朗读」同一套音色）── */
  if (p === '/api/tts' && req.method === 'POST') {
    let body
    try {
      body = JSON.parse(await readBody(req))
    } catch {
      sendError(res, 400, 'BadJSON', '请求体不是合法 JSON')
      return
    }
    const text = String(body?.text ?? '').trim()
    if (!text) {
      sendError(res, 400, 'EmptyText', '缺少要朗读的文字')
      return
    }
    if (text.length > 800) {
      sendError(res, 413, 'TooLong', '单次朗读不超过 800 字')
      return
    }
    const voice = String(body?.voice ?? '')
    try {
      const { audio, cached } = await synthesizeCached(text, {
        voice: VOICE_PRESETS.some((v) => v.id === voice) ? voice : undefined,
        rate: clampNumber(body?.rate, 0.6, 1.4, 1),
        pitch: clampNumber(body?.pitch, 0.7, 1.4, 1),
      })
      res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audio.length,
        'Cache-Control': 'public, max-age=604800',
        'X-TTS-Cache': cached ? 'hit' : 'miss',
        'Access-Control-Allow-Origin': '*',
      })
      res.end(audio)
    } catch (e) {
      // 合成不可用时明确告知，前端会退回浏览器 TTS
      sendJson(res, 503, { ok: false, error: String(e?.message ?? e), fallback: 'browser' })
    }
    return
  }

  if (p === '/api/tts/voices') {
    sendJson(res, 200, { ok: true, default: DEFAULT_VOICE, voices: VOICE_PRESETS })
    return
  }

  if (p === '/api/mcp/tools') {
    const servers = await refreshMcp(url.searchParams.get('refresh') === '1')
    sendJson(res, 200, {
      servers: servers.map((s) => ({
        name: s.name,
        ok: Boolean(s.ok),
        error: s.error,
        tools: (s.tools ?? []).map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      })),
      cachedAt: mcpCache.at,
    })
    return
  }

  if (p === '/api/mcp/call' && req.method === 'POST') {
    let body
    try {
      body = JSON.parse(await readBody(req))
    } catch {
      sendError(res, 400, 'BadJSON', '请求体不是合法 JSON')
      return
    }
    const server = body?.server
    const tool = body?.tool
    if (!server || !tool) {
      sendJson(res, 400, { ok: false, error: '缺少 server 或 tool' })
      return
    }
    const servers = await refreshMcp()
    const target = servers.find((s) => s.name === server && s.ok)
    if (!target) {
      sendJson(res, 200, { ok: false, error: `未找到可用的 MCP Server：${server}` })
      return
    }
    const r = await mcpPost(
      target.url,
      { jsonrpc: '2.0', id: rpcId++, method: 'tools/call', params: { name: tool, arguments: body.arguments ?? {} } },
      target.sid,
    ).catch((e) => ({ json: { error: { message: e.message } } }))
    if (!r.json || r.json.error) {
      sendJson(res, 200, { ok: false, error: r.json?.error?.message ?? '调用失败' })
      return
    }
    const result = r.json.result
    sendJson(res, 200, { ok: !result?.isError, text: mcpText(result) })
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
  console.log(`  额度上限：${usage.used} / ${TOKEN_BUDGET} tokens（达到即停）`)
  console.log(`  MCP：${MCP_SERVERS.length ? `${MCP_SERVERS.length} 个外部 Server（启动后自动握手）` : '未配置（仅用内置工具）'}\n`)
  if (MCP_SERVERS.length) refreshMcp().catch((e) => console.warn('[mcp] 握手失败：', e.message))
})
