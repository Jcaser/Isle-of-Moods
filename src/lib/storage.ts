/** 本地存储封装（隐私优先：全部数据仅存于浏览器） */

const PREFIX = 'sereneisle.v1.'

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* 隐私模式或配额不足时静默降级 */
  }
}

export function drop(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    /* noop */
  }
}

export function clearAll(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(PREFIX)) keys.push(k)
    }
    keys.forEach((k) => localStorage.removeItem(k))
  } catch {
    /* noop */
  }
}

export function estimateUsage(): string {
  try {
    let bytes = 0
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(PREFIX)) bytes += (localStorage.getItem(k)?.length ?? 0) * 2
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
} as const
