/**
 * 本地账号体系（无服务端）
 *
 * 设计取舍：
 * - 这是心理自助产品，账号只是「本机上给数据分抽屉」，不做真实身份认证；
 * - 密码用 SHA-256 加盐摘要后存 localStorage，永不上传；
 * - 同一浏览器可拥有多个岛主，数据按命名空间隔离。
 */

const USERS_KEY = 'sereneisle.auth.users'
const SESSION_KEY = 'sereneisle.auth.session'
const SCHEMA = 1

export interface IslandAccount {
  id: string
  name: string
  /** 头像色相，由名字推导，保证同名同色 */
  hue: number
  salt: string
  hash: string
  createdAt: number
  lastSeen: number
  guest?: boolean
}

interface Store {
  schema: number
  users: IslandAccount[]
}

function readStore(): Store {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    if (!raw) return { schema: SCHEMA, users: [] }
    const parsed = JSON.parse(raw) as Store
    if (!Array.isArray(parsed.users)) return { schema: SCHEMA, users: [] }
    return { schema: SCHEMA, users: parsed.users }
  } catch {
    return { schema: SCHEMA, users: [] }
  }
}

function writeStore(users: IslandAccount[]): void {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify({ schema: SCHEMA, users }))
  } catch {
    /* 配额不足时静默失败 */
  }
}

/** 名字 → 稳定色相，用于生成头像渐变 */
export function hueOf(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return h
}

function randomId(): string {
  return 'u' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4)
}

function randomSalt(): string {
  try {
    const buf = new Uint8Array(8)
    crypto.getRandomValues(buf)
    return Array.from(buf)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    return Math.random().toString(36).slice(2, 12)
  }
}

/** SHA-256(名字 + 盐 + 密码)；非安全上下文降级为 FNV-1a */
async function digest(name: string, salt: string, password: string): Promise<string> {
  const text = `${name.toLowerCase()}::${salt}::${password}::sereneisle`
  const bytes = new TextEncoder().encode(text)
  if (globalThis.crypto?.subtle) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', bytes)
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    } catch {
      /* 落到下面的降级实现 */
    }
  }
  let h = 0x811c9dc5
  for (const b of bytes) {
    h ^= b
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return `fnv1a-${h.toString(16)}`
}

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

export function validateName(name: string): string | null {
  const n = normalizeName(name)
  if (n.length < 1) return '先给自己起个名字吧'
  if (n.length > 12) return '名字最多 12 个字'
  if (/[<>/\\{}[\]$]/.test(n)) return '名字里有不支持的符号'
  return null
}

export function validatePassword(pw: string): string | null {
  if (pw.length < 4) return '密码至少 4 位'
  if (pw.length > 32) return '密码最多 32 位'
  return null
}

export function listAccounts(): IslandAccount[] {
  return readStore()
    .users.filter((u) => !u.guest)
    .sort((a, b) => b.lastSeen - a.lastSeen)
}

export function findAccount(name: string): IslandAccount | null {
  const target = normalizeName(name).toLowerCase()
  return readStore().users.find((u) => u.name.toLowerCase() === target) ?? null
}

export function nameTaken(name: string): boolean {
  return Boolean(findAccount(name))
}

export async function register(name: string, password: string): Promise<IslandAccount> {
  const clean = normalizeName(name)
  const errName = validateName(clean)
  if (errName) throw new Error(errName)
  const errPw = validatePassword(password)
  if (errPw) throw new Error(errPw)
  if (nameTaken(clean)) throw new Error('这个名字已经有人用了')

  const salt = randomSalt()
  const account: IslandAccount = {
    id: randomId(),
    name: clean,
    hue: hueOf(clean),
    salt,
    hash: await digest(clean, salt, password),
    createdAt: Date.now(),
    lastSeen: Date.now(),
  }
  const store = readStore()
  writeStore([...store.users, account])
  return account
}

export type LoginResult =
  | { ok: true; account: IslandAccount }
  | { ok: false; reason: 'missing' | 'password'; message: string }

export async function login(name: string, password: string): Promise<LoginResult> {
  const account = findAccount(name)
  if (!account) return { ok: false, reason: 'missing', message: '这座岛还没有名字' }
  const hash = await digest(account.name, account.salt, password)
  if (hash !== account.hash) return { ok: false, reason: 'password', message: '暗号不对，再想想' }
  touch(account.id)
  return { ok: true, account }
}

export function touch(id: string): void {
  const store = readStore()
  const users = store.users.map((u) => (u.id === id ? { ...u, lastSeen: Date.now() } : u))
  writeStore(users)
}

/** 游客：同一台设备共用一座「公共岛」，随时可进，不需要密码 */
export function guestAccount(): IslandAccount {
  const store = readStore()
  const found = store.users.find((u) => u.guest)
  if (found) {
    touch(found.id)
    return found
  }
  const account: IslandAccount = {
    id: 'guest',
    name: '过客',
    hue: 196,
    salt: '',
    hash: '',
    createdAt: Date.now(),
    lastSeen: Date.now(),
    guest: true,
  }
  writeStore([...store.users, account])
  return account
}

/** 账号 → 存储命名空间 */
export function namespaceOf(account: IslandAccount | null): string {
  if (!account) return ''
  return account.guest ? 'guest' : `u_${account.id}`
}

export function saveSession(id: string): void {
  try {
    localStorage.setItem(SESSION_KEY, id)
  } catch {
    /* noop */
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* noop */
  }
}

export function restoreSession(): IslandAccount | null {
  try {
    const id = localStorage.getItem(SESSION_KEY)
    if (!id) return null
    const account = readStore().users.find((u) => u.id === id)
    if (!account) return null
    touch(account.id)
    return account
  } catch {
    return null
  }
}

export function removeAccount(id: string): void {
  const users = readStore().users.filter((u) => u.id !== id)
  writeStore(users)
}
