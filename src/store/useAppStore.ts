import { create } from 'zustand'
import { STORAGE_KEYS, clearAll, load, save } from '../lib/storage'
import { fetchAiStatus, type AiStatus } from '../lib/ai'
import type {
  AssessmentRecord,
  ChatMessage,
  MoodRecord,
  MoodScore,
  Settings,
} from '../lib/types'

/**
 * 默认配置
 *
 * 默认走本机 Node 代理（server/proxy.mjs）：baseUrl 写成相对路径 `/api`，
 * 浏览器不持有任何密钥，Key 只存在于服务端的环境变量里。
 * 若想临时直连某个模型服务，可在「岛屿设置」里改成完整地址并填自己的 Key。
 *
 * 注意：VITE_ 前缀的变量会被打包进静态产物，因此不要用它放真实 Key。
 */
export const PROXY_BASE_URL = '/api'

export const DEFAULT_SETTINGS: Settings = {
  baseUrl: import.meta.env.VITE_LLM_BASE_URL || PROXY_BASE_URL,
  model: import.meta.env.VITE_LLM_MODEL || '',
  apiKey: import.meta.env.VITE_LLM_API_KEY || '',
  temperature: 0.7,
  voiceURI: '',
  rate: 0.92,
  pitch: 1,
}

/** 旧版本存过「DeepSeek 默认地址 + 空 Key」的配置，迁移到代理模式，避免用户莫名其妙掉回本地模式 */
function migrateSettings(stored: Partial<Settings>): Partial<Settings> {
  const isOldDefault = !stored.apiKey && (!stored.baseUrl || stored.baseUrl.includes('api.deepseek.com'))
  return isOldDefault ? { ...stored, baseUrl: DEFAULT_SETTINGS.baseUrl, model: DEFAULT_SETTINGS.model } : stored
}

interface AppState {
  records: MoodRecord[]
  assessments: AssessmentRecord[]
  messages: ChatMessage[]
  settings: Settings
  /** 服务端 AI 状态（是否连上、模型、额度）；null 表示代理没起来 */
  aiStatus: AiStatus | null
  introSeen: boolean
  breathing: { open: boolean; pattern: '478' | 'box' | 'coherent' }
  assessmentOpen: boolean
  settingsOpen: boolean

  addMood: (r: Omit<MoodRecord, 'id' | 'ts'> & { ts?: number }) => void
  removeMood: (id: string) => void
  addAssessment: (a: Omit<AssessmentRecord, 'id' | 'ts'>) => void
  addMessage: (m: ChatMessage) => void
  patchMessage: (id: string, patch: Partial<ChatMessage>) => void
  setMessages: (m: ChatMessage[]) => void
  clearChat: () => void
  updateSettings: (patch: Partial<Settings>) => void
  refreshAi: () => Promise<AiStatus | null>
  setAiStatus: (s: AiStatus | null) => void
  openBreathing: (pattern?: '478' | 'box' | 'coherent') => void
  closeBreathing: () => void
  setAssessmentOpen: (v: boolean) => void
  setSettingsOpen: (v: boolean) => void
  markIntroSeen: () => void
  wipeAll: () => void
  /** 切换岛主后，重新从本地存储载入这个人的数据 */
  hydrate: () => void
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

const initialRecords = load<MoodRecord[]>(STORAGE_KEYS.mood, [])
const initialAssessments = load<AssessmentRecord[]>(STORAGE_KEYS.assessments, [])
const initialMessages = load<ChatMessage[]>(STORAGE_KEYS.chat, [])
const initialSettings = { ...DEFAULT_SETTINGS, ...migrateSettings(load<Partial<Settings>>(STORAGE_KEYS.settings, {})) }

export const useAppStore = create<AppState>((set, get) => ({
  records: initialRecords,
  assessments: initialAssessments,
  messages: initialMessages,
  settings: initialSettings,
  aiStatus: null,
  introSeen: load<boolean>(STORAGE_KEYS.intro, false),
  breathing: { open: false, pattern: '478' },
  assessmentOpen: false,
  settingsOpen: false,

  addMood: (r) => {
    const record: MoodRecord = {
      id: uid(),
      ts: r.ts ?? Date.now(),
      score: r.score as MoodScore,
      tags: r.tags ?? [],
      note: r.note,
      source: r.source,
    }
    const records = [record, ...get().records].slice(0, 500)
    save(STORAGE_KEYS.mood, records)
    set({ records })
  },

  removeMood: (id) => {
    const records = get().records.filter((r) => r.id !== id)
    save(STORAGE_KEYS.mood, records)
    set({ records })
  },

  addAssessment: (a) => {
    const rec: AssessmentRecord = { ...a, id: uid(), ts: Date.now() }
    const assessments = [rec, ...get().assessments].slice(0, 100)
    save(STORAGE_KEYS.assessments, assessments)
    set({ assessments })
  },

  addMessage: (m) => {
    const messages = [...get().messages, m].slice(-80)
    save(STORAGE_KEYS.chat, messages)
    set({ messages })
  },

  patchMessage: (id, patch) => {
    const messages = get().messages.map((m) => (m.id === id ? { ...m, ...patch } : m))
    save(STORAGE_KEYS.chat, messages)
    set({ messages })
  },

  setMessages: (messages) => {
    save(STORAGE_KEYS.chat, messages)
    set({ messages })
  },

  clearChat: () => {
    save(STORAGE_KEYS.chat, [])
    set({ messages: [] })
  },

  updateSettings: (patch) => {
    const settings = { ...get().settings, ...patch }
    save(STORAGE_KEYS.settings, settings)
    set({ settings })
  },

  refreshAi: async () => {
    const status = await fetchAiStatus()
    set({ aiStatus: status })
    return status
  },

  setAiStatus: (s) => set({ aiStatus: s }),

  openBreathing: (pattern = '478') => set({ breathing: { open: true, pattern } }),
  closeBreathing: () => set((s) => ({ breathing: { ...s.breathing, open: false } })),
  setAssessmentOpen: (v) => set({ assessmentOpen: v }),
  setSettingsOpen: (v) => set({ settingsOpen: v }),

  markIntroSeen: () => {
    save(STORAGE_KEYS.intro, true)
    set({ introSeen: true })
  },

  hydrate: () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      ...migrateSettings(load<Partial<Settings>>(STORAGE_KEYS.settings, {})),
    }
    set({
      records: load<MoodRecord[]>(STORAGE_KEYS.mood, []),
      assessments: load<AssessmentRecord[]>(STORAGE_KEYS.assessments, []),
      messages: load<ChatMessage[]>(STORAGE_KEYS.chat, []),
      settings,
      introSeen: load<boolean>(STORAGE_KEYS.intro, false),
      breathing: { open: false, pattern: '478' },
      assessmentOpen: false,
      settingsOpen: false,
    })
  },

  wipeAll: () => {
    clearAll()
    set({
      records: [],
      assessments: [],
      messages: [],
      settings: DEFAULT_SETTINGS,
      introSeen: false,
    })
  },
}))
