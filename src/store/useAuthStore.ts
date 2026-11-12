import { create } from 'zustand'
import {
  clearSession,
  guestAccount,
  login,
  namespaceOf,
  register,
  restoreSession,
  saveSession,
  type IslandAccount,
  type LoginResult,
} from '../lib/auth'
import { setNamespace } from '../lib/storage'
import { useAppStore } from './useAppStore'

interface AuthState {
  ready: boolean
  user: IslandAccount | null
  signIn: (name: string, password: string) => Promise<LoginResult>
  signUp: (name: string, password: string) => Promise<void>
  enterAsGuest: () => void
  enter: (account: IslandAccount) => void
  signOut: () => void
}

/** 切换岛主：换命名空间 → 重新从本地读取这个人的数据 */
function activate(account: IslandAccount | null): void {
  setNamespace(namespaceOf(account))
  useAppStore.getState().hydrate()
  if (account) saveSession(account.id)
  else clearSession()
}

export const useAuthStore = create<AuthState>((set) => ({
  ready: true,
  user: null,

  signIn: async (name, password) => {
    const result = await login(name, password)
    if (result.ok) {
      activate(result.account)
      set({ user: result.account })
    }
    return result
  },

  signUp: async (name, password) => {
    const account = await register(name, password)
    activate(account)
    set({ user: account })
  },

  enterAsGuest: () => {
    const account = guestAccount()
    activate(account)
    set({ user: account })
  },

  enter: (account) => {
    activate(account)
    set({ user: account })
  },

  signOut: () => {
    activate(null)
    set({ user: null })
  },
}))

// 启动时恢复上次的岛主，并载入他自己的那份数据
const restored = typeof window === 'undefined' ? null : restoreSession()
activate(restored)
useAuthStore.setState({ user: restored, ready: true })
