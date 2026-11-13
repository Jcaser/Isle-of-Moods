/**
 * 查看当前火山方舟账号可见的对话模型
 * 用法：npm run ark:models
 *
 * 注意：列表里能看到的模型不一定都已开通，未开通的调用会返回 ModelNotOpen，
 * 需要先到控制台「开通管理」里点开通。本项目默认使用 doubao-seed-* 系列。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readEnv(file) {
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return out
}

const env = { ...readEnv(path.join(ROOT, '.env')), ...readEnv(path.join(ROOT, '.env.local')), ...process.env }
const key = env.ARK_API_KEY
const base = (env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/+$/, '')

if (!key) {
  console.error('未找到 ARK_API_KEY：请先把 .env.example 复制为 .env.local 并填入密钥。')
  process.exit(1)
}

const res = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${key}` } })
if (!res.ok) {
  console.error(`请求失败：HTTP ${res.status}`)
  process.exit(1)
}

const json = await res.json()
const list = (json.data ?? []).filter((m) => m.api_supported?.['chat/completions'])

console.log(`共 ${list.length} 个可对话模型（当前配置：${env.ARK_MODEL || '未设置'}）\n`)
for (const m of list) {
  const tools = m.features?.tools?.function_calling ? '工具✓' : '工具✗'
  const mark = m.id === env.ARK_MODEL ? ' ← 当前使用' : ''
  console.log(`  ${m.id.padEnd(34)} ${tools}  上下文 ${m.context_window ?? '-'}${mark}`)
}
console.log('\n若当前模型调用返回 ModelNotOpen，请到火山方舟控制台「开通管理」开通后再试。')
