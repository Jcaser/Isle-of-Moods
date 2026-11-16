/**
 * MCP 客户端（浏览器侧）
 *
 * 浏览器不能直接拉起 stdio 的 MCP Server，所以这里走服务端桥接：
 *   前端 → /api/mcp/tools  → 代理 →（Streamable HTTP / JSON-RPC）→ 外部 MCP Server
 *   前端 → /api/mcp/call   → 代理 → 外部 MCP Server
 *
 * 没有配置 MCP_SERVERS 时，桥接返回空列表，下面的函数全部退化为 no-op，
 * 岛主仍然只用内置的 Function Calling 工具，功能不受影响。
 */

import type { ToolSchema } from './llm'

export interface McpToolMeta {
  /** 命名空间化后的名字：mcp__<server>__<tool> */
  name: string
  server: string
  tool: string
  description: string
  schema: ToolSchema
}

interface Cache {
  tools: McpToolMeta[]
  servers: string[]
  at: number
}

let cache: Cache | null = null
const TTL = 5 * 60_000

export const MCP_PREFIX = 'mcp__'

export async function loadMcpTools(force = false): Promise<Cache> {
  if (!force && cache && Date.now() - cache.at < TTL) return cache
  try {
    const res = await fetch('/api/mcp/tools', { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const tools: McpToolMeta[] = []
    const servers: string[] = []
    for (const s of json?.servers ?? []) {
      if (!s?.ok) continue
      servers.push(s.name ?? s.url)
      for (const t of s.tools ?? []) {
        const name = `${MCP_PREFIX}${s.name}__${t.name}`
        tools.push({
          name,
          server: s.name,
          tool: t.name,
          description: String(t.description ?? '').slice(0, 200),
          schema: {
            type: 'function',
            function: {
              name,
              description: `【外部 MCP 工具 · ${s.name}】${String(t.description ?? '').slice(0, 160)}`,
              parameters: t.inputSchema ?? { type: 'object', properties: {} },
            },
          },
        })
      }
    }
    cache = { tools, servers, at: Date.now() }
  } catch {
    cache = { tools: [], servers: [], at: Date.now() }
  }
  return cache
}

export function isMcpTool(name: string): boolean {
  return name.startsWith(MCP_PREFIX)
}

/** 调用外部 MCP 工具，失败时返回结构化错误交给模型自我修正 */
export async function callMcpTool(name: string, rawArgs: string): Promise<{ ok: boolean; summary: string }> {
  const rest = name.slice(MCP_PREFIX.length)
  const idx = rest.indexOf('__')
  if (idx <= 0) return { ok: false, summary: 'MCP 工具名不合法' }
  const server = rest.slice(0, idx)
  const tool = rest.slice(idx + 2)

  let args: unknown = {}
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {}
  } catch {
    return { ok: false, summary: '参数不是合法 JSON，请重新输出参数对象' }
  }

  try {
    const res = await fetch('/api/mcp/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ server, tool, arguments: args }),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.ok) {
      return { ok: false, summary: `MCP 调用失败：${json?.error ?? `HTTP ${res.status}`}` }
    }
    return { ok: true, summary: String(json.text ?? '').slice(0, 600) || '（工具没有返回文本内容）' }
  } catch (e) {
    return { ok: false, summary: `MCP 调用异常：${(e as Error).message}` }
  }
}
