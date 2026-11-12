import { useEffect, useState } from 'react'
import { testConnection } from '../lib/llm'
import { estimateUsage, STORAGE_KEYS, drop } from '../lib/storage'
import { isTTSSupported, listVoices, type VoiceOption } from '../lib/tts'
import { useAppStore } from '../store/useAppStore'
import { Icon } from './Icons'
import { Modal } from './Modal'

const PRESETS = [
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  { name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { name: '本地 Ollama', baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5:7b' },
]

type TestState = { status: 'idle' | 'loading' | 'ok' | 'error'; message: string }

export function SettingsModal() {
  const open = useAppStore((s) => s.settingsOpen)
  const setOpen = useAppStore((s) => s.setSettingsOpen)
  const settings = useAppStore((s) => s.settings)
  const update = useAppStore((s) => s.updateSettings)
  const wipeAll = useAppStore((s) => s.wipeAll)
  const clearChat = useAppStore((s) => s.clearChat)

  const [test, setTest] = useState<TestState>({ status: 'idle', message: '' })
  const [voices, setVoices] = useState<VoiceOption[]>([])
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [usage, setUsage] = useState('—')

  useEffect(() => {
    if (!open) return
    setUsage(estimateUsage())
    listVoices().then(setVoices)
    setTest({ status: 'idle', message: '' })
  }, [open])

  const runTest = async () => {
    setTest({ status: 'loading', message: '正在连接…' })
    try {
      const msg = await testConnection({
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        model: settings.model,
        temperature: 0,
      })
      setTest({ status: 'ok', message: msg })
    } catch (e) {
      setTest({ status: 'error', message: (e as Error).message })
    }
  }

  const exportData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: 'SereneIsle',
      version: 1,
      mood: JSON.parse(localStorage.getItem('sereneisle.v1.mood') ?? '[]'),
      assessments: JSON.parse(localStorage.getItem('sereneisle.v1.assessments') ?? '[]'),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `sereneisle-data-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="岛屿设置"
      subtitle="AI 接入配置与本地数据管理"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        <section>
          <div className="flex items-center justify-between">
            <h3 className="text-[13px] font-semibold tracking-wide text-ink-900">AI 模型接入</h3>
            <span className="chip">
              <Icon name="shield" size={12} />
              Key 仅存本机
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => {
                  update({ baseUrl: p.baseUrl, model: p.model })
                  setTest({ status: 'idle', message: '' })
                }}
                className={`rounded-full border px-3 py-1.5 text-[11.5px] transition ${
                  settings.baseUrl === p.baseUrl
                    ? 'border-sea-300 bg-sea-50 text-sea-700'
                    : 'border-white/70 bg-white/50 text-ink-500 hover:bg-white/80'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="baseUrl">
                Base URL
              </label>
              <input
                id="baseUrl"
                className="input py-2.5 text-[13px]"
                value={settings.baseUrl}
                onChange={(e) => update({ baseUrl: e.target.value })}
                placeholder="https://api.deepseek.com/v1"
                spellCheck={false}
              />
            </div>
            <div>
              <label className="label" htmlFor="model">
                模型名称
              </label>
              <input
                id="model"
                className="input py-2.5 text-[13px]"
                value={settings.model}
                onChange={(e) => update({ model: e.target.value })}
                placeholder="deepseek-chat"
                spellCheck={false}
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="label" htmlFor="apiKey">
              API Key
            </label>
            <input
              id="apiKey"
              type="password"
              className="input py-2.5 font-mono text-[13px]"
              value={settings.apiKey}
              onChange={(e) => update({ apiKey: e.target.value })}
              placeholder="sk-…（留空则使用本地知识模式）"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-300">
              浏览器直连模型服务商，不经过本项目服务器。公共电脑上不建议保存 Key；评委可留空体验本地模式。
            </p>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={runTest} disabled={!settings.apiKey || test.status === 'loading'} className="btn-ghost disabled:opacity-40">
              {test.status === 'loading' ? '连接中…' : '测试连接'}
            </button>
            <button
              onClick={() => update({ apiKey: '' })}
              className="btn-quiet text-[12px]"
              aria-label="清除 API Key"
            >
              清除 Key
            </button>
            {test.status !== 'idle' && (
              <span
                className={`text-[11.5px] ${
                  test.status === 'ok' ? 'text-sea-600' : test.status === 'error' ? 'text-coral-500' : 'text-ink-400'
                }`}
                role="status"
              >
                {test.message}
              </span>
            )}
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <label className="label mb-0" htmlFor="temp">
                创造性 temperature
              </label>
              <span className="text-[11px] tabular-nums text-ink-400">{settings.temperature.toFixed(1)}</span>
            </div>
            <input
              id="temp"
              type="range"
              min={0}
              max={1.2}
              step={0.1}
              value={settings.temperature}
              onChange={(e) => update({ temperature: Number(e.target.value) })}
              className="mt-2 w-full accent-sea-500"
            />
            <p className="mt-1 text-[11px] text-ink-300">建议 0.6–0.8：既保持温度，又不至于偏离知识库。</p>
          </div>
        </section>

        <div className="hairline" />

        <section>
          <h3 className="text-[13px] font-semibold tracking-wide text-ink-900">语音引导（Web Speech API）</h3>
          {isTTSSupported() ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="voice">
                  音色
                </label>
                <select
                  id="voice"
                  className="input py-2.5 text-[13px]"
                  value={settings.voiceURI}
                  onChange={(e) => update({ voiceURI: e.target.value })}
                >
                  <option value="">自动选择中文音色</option>
                  {voices.map((v) => (
                    <option key={v.uri} value={v.uri}>
                      {v.name}（{v.lang}）
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="label mb-0" htmlFor="rate">
                    语速
                  </label>
                  <span className="text-[11px] tabular-nums text-ink-400">{settings.rate.toFixed(2)}×</span>
                </div>
                <input
                  id="rate"
                  type="range"
                  min={0.6}
                  max={1.4}
                  step={0.02}
                  value={settings.rate}
                  onChange={(e) => update({ rate: Number(e.target.value) })}
                  className="mt-2 w-full accent-sea-500"
                />
              </div>
            </div>
          ) : (
            <p className="mt-2 text-[12px] text-ink-400">当前浏览器不支持语音合成，建议使用 Chrome / Edge。</p>
          )}
        </section>

        <div className="hairline" />

        <section>
          <h3 className="text-[13px] font-semibold tracking-wide text-ink-900">本地数据</h3>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-500">
            当前占用约 {usage}。所有情绪记录、自评结果与对话历史都保存在浏览器 localStorage，不经过服务器。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={exportData} className="btn-ghost text-[12.5px]">
              <Icon name="download" size={15} />
              导出我的数据
            </button>
            <button
              onClick={() => {
                clearChat()
                drop(STORAGE_KEYS.chat)
              }}
              className="btn-quiet text-[12.5px]"
            >
              清空对话
            </button>
            {!confirmWipe ? (
              <button onClick={() => setConfirmWipe(true)} className="btn-quiet text-[12.5px] text-coral-500">
                <Icon name="trash" size={15} />
                删除全部本地数据
              </button>
            ) : (
              <span className="flex items-center gap-2 rounded-full bg-coral-300/15 px-3 py-1.5">
                <span className="text-[11.5px] text-ink-600">不可恢复，确认？</span>
                <button
                  onClick={() => {
                    wipeAll()
                    setConfirmWipe(false)
                    setOpen(false)
                  }}
                  className="text-[11.5px] font-semibold text-coral-500"
                >
                  确认删除
                </button>
                <button onClick={() => setConfirmWipe(false)} className="text-[11.5px] text-ink-400">
                  取消
                </button>
              </span>
            )}
          </div>
        </section>
      </div>
    </Modal>
  )
}
