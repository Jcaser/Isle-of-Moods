/**
 * 大模型接入层：OpenAI 兼容协议 + SSE 流式解析 + Function Calling
 *
 * 两种运行方式：
 *  A. 代理模式（推荐，默认）—— baseUrl 为相对路径 `/api`，请求经本地 Node 代理
 *     （server/proxy.mjs）转发到火山方舟。密钥只存在服务端环境变量里，浏览器永远看不到。
 *  B. 直连模式 —— baseUrl 为完整地址（https://api.deepseek.com/v1 等），用户自填 Key，
 *     仅保存在浏览器本地。适合评审临时换模型，或本机跑 Ollama。
 */

import type { ToolCall } from './types'

export interface LLMConfig {
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
}

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export interface ApiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null | ContentPart[]
  tool_calls?: {
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }[]
  tool_call_id?: string
}

export interface ToolSchema {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface StreamResult {
  content: string
  toolCalls: ToolCall[]
  finishReason: string
}

/** 带错误码的异常：上层据此决定是重试、降级，还是彻底停下 */
export class LlmError extends Error {
  code: string
  constructor(message: string, code = 'LlmError') {
    super(message)
    this.name = 'LlmError'
    this.code = code
  }
}

/** baseUrl 是相对路径（/api）时，代表走同源本地代理，浏览器不需要也不应该持有 Key */
export function isProxy(baseUrl: string): boolean {
  const v = (baseUrl || '').trim()
  return v.startsWith('/') && !v.startsWith('//')
}

/** 额度耗尽的错误码：一旦出现，前端应停止云端调用 */
export const QUOTA_EXHAUSTED = 'QuotaExhausted'

function endpoint(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '')
  if (base.endsWith('/chat/completions')) return base
  // 已带版本段（/v1、/v4、/compatible-mode/v1 等）时直接拼接口路径
  if (/\/v\d+$/.test(base) || /\/compatible-mode\/v\d+$/.test(base)) return `${base}/chat/completions`
  return `${base}/v1/chat/completions`
}

async function readError(res: Response): Promise<{ message: string; code: string }> {
  let detail = ''
  let code = ''
  try {
    const text = await res.text()
    try {
      const json = JSON.parse(text)
      detail = json?.error?.message ?? json?.message ?? text
      code = json?.error?.code ?? ''
    } catch {
      detail = text
    }
  } catch {
    /* noop */
  }

  if (code === QUOTA_EXHAUSTED) {
    return { message: detail || '云端额度已用完，岛主已停止调用大模型。', code }
  }

  const hint =
    res.status === 401
      ? 'API Key 无效或已过期'
      : res.status === 403
        ? '该 Key 没有访问权限，或所在地区被限制'
        : res.status === 404
          ? '接口地址或模型名不存在，请检查 Base URL 与模型名称'
          : res.status === 429
            ? '请求过于频繁或额度用尽'
            : res.status === 503
              ? '服务端尚未配置密钥'
              : res.status >= 500
                ? '服务端暂时不可用'
                : '请求失败'
  return {
    message: `${hint}（HTTP ${res.status}）${detail ? `：${detail.slice(0, 200)}` : ''}`,
    code: code || `Http${res.status}`,
  }
}

/**
 * 流式对话。逐块回调 onDelta，结束时返回完整内容与工具调用。
 */
export async function streamChat(opts: {
  config: LLMConfig
  messages: ApiMessage[]
  tools?: ToolSchema[]
  signal?: AbortSignal
  onDelta?: (text: string) => void
}): Promise<StreamResult> {
  const { config, messages, tools, signal, onDelta } = opts
  const proxy = isProxy(config.baseUrl)
  if (!config.apiKey && !proxy) throw new LlmError('未配置 API Key', 'NoApiKey')

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  // 代理模式下由服务端注入密钥；直连模式才把用户自己的 Key 放进请求头
  if (config.apiKey && !proxy) headers.Authorization = `Bearer ${config.apiKey}`

  const res = await fetch(endpoint(config.baseUrl), {
    method: 'POST',
    headers,
    signal,
    body: JSON.stringify({
      // 留空表示「由服务端决定用哪个模型」
      ...(config.model ? { model: config.model } : {}),
      messages,
      temperature: config.temperature,
      stream: true,
      ...(tools && tools.length ? { tools, tool_choice: 'auto' } : {}),
    }),
  })

  if (!res.ok) {
    const err = await readError(res)
    throw new LlmError(err.message, err.code)
  }
  if (!res.body) throw new LlmError('响应为空，请检查接口地址', 'EmptyBody')

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let content = ''
  let finishReason = 'stop'
  const acc: { id: string; name: string; arguments: string }[] = []

  const handleLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) return
    const payload = trimmed.slice(5).trim()
    if (!payload || payload === '[DONE]') return

    let json: any
    try {
      json = JSON.parse(payload)
    } catch {
      return
    }
    const choice = json?.choices?.[0]
    if (!choice) return
    const delta = choice.delta ?? choice.message
    if (!delta) return

    if (typeof delta.content === 'string' && delta.content) {
      content += delta.content
      onDelta?.(delta.content)
    }

    if (Array.isArray(delta.tool_calls)) {
      for (const tc of delta.tool_calls) {
        const idx: number = tc.index ?? 0
        if (!acc[idx]) acc[idx] = { id: '', name: '', arguments: '' }
        if (tc.id) acc[idx].id = tc.id
        if (tc.function?.name) acc[idx].name = tc.function.name
        if (tc.function?.arguments) acc[idx].arguments += tc.function.arguments
      }
    }

    if (choice.finish_reason) finishReason = choice.finish_reason
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) handleLine(line)
  }
  if (buffer) handleLine(buffer)

  const toolCalls: ToolCall[] = acc
    .filter((t) => t.name)
    .map((t, i) => ({
      id: t.id || `call_${i}_${Math.random().toString(36).slice(2, 8)}`,
      name: t.name,
      arguments: t.arguments || '{}',
    }))

  return { content, toolCalls, finishReason }
}

/** 连通性测试：代理模式读服务端健康检查，直连模式拉模型列表或发一次短对话 */
export async function testConnection(config: LLMConfig): Promise<string> {
  if (isProxy(config.baseUrl)) {
    const res = await fetch('/api/health')
    if (!res.ok) throw new Error(`本地代理未响应（HTTP ${res.status}），请先运行 npm run server`)
    const json = await res.json()
    if (!json?.hasKey) throw new Error('服务端未配置 ARK_API_KEY，请检查 .env.local')
    if (json?.quota?.exhausted) throw new Error('额度已用完，已停止调用大模型')
    return `连接成功 · ${json.model} · 已用 ${json.quota.used}/${json.quota.budget} tokens`
  }

  const base = config.baseUrl.trim().replace(/\/+$/, '')
  const root = base.endsWith('/v1') ? base : `${base}/v1`
  try {
    const res = await fetch(`${root}/models`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    })
    if (res.ok) {
      const json = await res.json()
      const n = Array.isArray(json?.data) ? json.data.length : 0
      return `连接成功，可用模型 ${n} 个`
    }
  } catch {
    /* 回退 */
  }

  const out = await streamChat({
    config: { ...config, temperature: 0 },
    messages: [{ role: 'user', content: '回复"ok"两个字符即可' }],
  })
  if (!out.content && !out.toolCalls.length) throw new Error('接口可访问但返回为空')
  return '连接成功，已完成一次流式对话'
}
