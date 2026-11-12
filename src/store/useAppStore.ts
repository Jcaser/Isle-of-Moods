import { create } from 'zustand'
import { STORAGE_KEYS, clearAll, load, save } from '../lib/storage'
import type {
  AssessmentRecord,
  ChatMessage,
  MoodRecord,
  MoodScore,
  Settings,
} from '../lib/types'

/**
 * 默认配置：优先读取构建期环境变量（见 .env.example），
 * 其次使用内置默认值。用户也可在界面的「岛屿设置」中随时覆盖。
 * 注意：VITE_ 前缀的变量会被打包进静态产物，公开部署时不要把真实 Key 写进 .env。
 */
export const DEFAULT_SETTINGS: Settings = {
  baseUrl: import.meta.env.VITE_LLM_BASE_URL || 'https://api.deepseek.com/v1',
  model: import.meta.env.VITE_LLM_MODEL || 'deepseek-chat',
  apiKey: import.meta.env.VITE_LLM_API_KEY || '',
  temperature: 0.7,
  voiceURI: '',
  rate: 0.92,
  pitch: 1,
}

interface AppState {
  records: MoodRecord[]
  assessments: AssessmentRecord[]
  messages: ChatMessage[]
  settings: Settings
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
  openBreathing: (pattern?: '478' | 'box' | 'coherent') => void
  closeBreathing: () => void
  setAssessmentOpen: (v: boolean) => void
  setSettingsOpen: (v: boolean) => void
  markIntroSeen: () => void
  wipeAll: () => void
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

const initialRecords = load<MoodRecord[]>(STORAGE_KEYS.mood, [])
const initialAssessments = load<AssessmentRecord[]>(STORAGE_KEYS.assessments, [])
const initialMessages = load<ChatMessage[]>(STORAGE_KEYS.chat, [])
const initialSettings = { ...DEFAULT_SETTINGS, ...load<Partial<Settings>>(STORAGE_KEYS.settings, {}) }

export const useAppStore = create<AppState>((set, get) => ({
  records: initialRecords,
  assessments: initialAssessments,
  messages: initialMessages,
  settings: initialSettings,
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

  openBreathing: (pattern = '478') => set({ breathing: { open: true, pattern } }),
  closeBreathing: () => set((s) => ({ breathing: { ...s.breathing, open: false } })),
  setAssessmentOpen: (v) => set({ assessmentOpen: v }),
  setSettingsOpen: (v) => set({ settingsOpen: v }),

  markIntroSeen: () => {
    save(STORAGE_KEYS.intro, true)
    set({ introSeen: true })
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
