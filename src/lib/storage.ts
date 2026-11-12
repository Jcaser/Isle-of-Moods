/** 本地存储封装（隐私优先：全部数据仅存于浏览器） */

const PREFIX = 'sereneisle.v1.'

/**
 * 数据命名空间：每个岛主拥有独立的一份数据，互不干扰。
 * 未登录（或游客）时为空串，数据直接落在 PREFIX 下。
 */
let namespace = ''

export function setNamespace(ns: string): void {
  namespace = ns.replace(/[^a-zA-Z0-9_-]/g, '')
}

export function getNamespace(): string {
  return namespace
}

function scoped(key: string): string {
  return PREFIX + (namespace ? `${namespace}.` : '') + key
}

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(scoped(key))
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(scoped(key), JSON.stringify(value))
  } catch {
    /* 隐私模式或配额不足时静默降级 */
  }
}

export function drop(key: string): void {
  try {
    localStorage.removeItem(scoped(key))
  } catch {
    /* noop */
  }
}

/** 清空当前岛主的所有数据（不含账号本身） */
export function clearAll(): void {
  try {
    const keys: string[] = []
    const prefix = namespace ? PREFIX + namespace + '.' : PREFIX
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k?.startsWith(prefix)) continue
      // 兼容旧版本：未分命名空间时不要碰账号表（账号表在 sereneisle.auth.*）
      if (!namespace && (k.startsWith('sereneisle.auth') || k.startsWith('sereneisle.v2'))) continue
      keys.push(k)
    }
    keys.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* noop */
  }
}

export function estimateUsage(): string {
  try {
    let bytes = 0
    const prefix = namespace ? PREFIX + namespace + '.' : PREFIX
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(prefix)) bytes += (localStorage.getItem(k)?.length ?? 0) * 2
    }
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  } catch {
    return '—'
  }
}

export const STORAGE_KEYS = {
  mood: 'mood',
  assessments: 'assessments',
  chat: 'chat',
  settings: 'settings',
  intro: 'intro-seen',
  breathSessions: 'breath-sessions',
  safetyPlan: 'safety-plan',
  wishes: 'wishes',
} as const
