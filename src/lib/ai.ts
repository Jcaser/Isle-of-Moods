/**
 * 岛主 AI 的前端状态层
 *
 * 浏览器不持有任何密钥：它只知道「服务端开没开、用掉多少额度」。
 * 这些信息来自本地代理 /api/health（见 server/proxy.mjs）。
 */

export interface Quota {
  used: number
  budget: number
  remaining: number
  ratio: number
  exhausted: boolean
  calls: number
  lastAt: string | null
  /** 平均每次上游请求消耗的 tokens：用来判断「发一条消息大概花多少」 */
  avgPerCall?: number
}

export interface AiStatus {
  ok: boolean
  provider: string
  model: string
  hasKey: boolean
  quota: Quota
  limits: {
    maxOutputTokens: number
    maxHistoryTurns: number
    thinking: string
    ratePerMinute: number
  }
}

/** 服务端是否可提供云端推理（已配 Key 且额度没用完） */
export function aiReady(status: AiStatus | null): boolean {
  return Boolean(status?.ok)
}

/** 额度是否已耗尽：耗尽后应停止一切云端请求 */
export function aiExhausted(status: AiStatus | null): boolean {
  return Boolean(status?.quota.exhausted)
}

/** 读取服务端状态；连不上返回 null，前端据此退回本地知识模式 */
export async function fetchAiStatus(signal?: AbortSignal): Promise<AiStatus | null> {
  try {
    const res = await fetch('/api/health', { signal, headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const json = (await res.json()) as AiStatus
    if (typeof json?.ok !== 'boolean') return null
    return json
  } catch {
    return null
  }
}

/** 重置本地额度计数（仅供开发/演示时自己在服务端复归） */
export async function resetQuota(): Promise<Quota | null> {
  try {
    const res = await fetch('/api/quota/reset', { method: 'POST' })
    if (!res.ok) return null
    const json = await res.json()
    return (json?.quota as Quota) ?? null
  } catch {
    return null
  }
}

/** 把 token 数变成人看得懂的短句 */
export function formatTokens(n: number): string {
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)} 万`
  return String(n)
}
