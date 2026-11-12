/**
 * 大模型接入层：OpenAI 兼容协议 + SSE 流式解析 + Function Calling
 *
 * 支持任意 OpenAI 兼容端点（DeepSeek / 智谱 GLM / 通义 / Moonshot / OpenAI / 本地 vLLM 等），
 * 用户自带 Key，配置仅保存在浏览器本地，不经过任何第三方服务器。
 */

import type { ToolCall } from './types'

export interface LLMConfig {
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
}

export interface ApiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
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

function endpoint(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '')
  if (base.endsWith('/chat/completions')) return base
  // 已带版本段（/v1、/v4、/compatible-mode/v1 等）时直接拼接口路径
  if (/\/v\d+$/.test(base) || /\/compatible-mode\/v\d+$/.test(base)) return `${base}/chat/completions`
  return `${base}/v1/chat/completions`
}

async function readError(res: Response): Promise<string> {
  let detail = ''
  try {
    const text = await res.text()
    try {
      const json = JSON.parse(text)
      detail = json?.error?.message ?? json?.message ?? text
    } catch {
      detail = text
    }
  } catch {
    /* noop */
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
            : res.status >= 500
              ? '服务端暂时不可用'
              : '请求失败'
  return `${hint}（HTTP ${res.status}）${detail ? `：${detail.slice(0, 200)}` : ''}`
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
  if (!config.apiKey) throw new Error('未配置 API Key')

  const res = await fetch(endpoint(config.baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    signal,
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: config.temperature,
      stream: true,
      ...(tools && tools.length ? { tools, tool_choice: 'auto' } : {}),
    }),
  })

  if (!res.ok) throw new Error(await readError(res))
  if (!res.body) throw new Error('响应为空，请检查接口地址')

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

/** 连通性测试：拉取模型列表，失败则回退一次极短对话 */
export async function testConnection(config: LLMConfig): Promise<string> {
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
