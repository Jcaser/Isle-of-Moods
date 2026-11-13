/**
 * 一键开发：同时启动本地 AI 代理（8787）与 Vite 开发服务器（5173）
 * 这样 `npm run dev` 就能既看界面、又真的能和大模型对话。
 */
import { spawn } from 'node:child_process'

const isWin = process.platform === 'win32'
const npmCmd = isWin ? 'npm.cmd' : 'npm'

const children = []

function start(name, cmd, args, color) {
  const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: isWin })
  const prefix = `\x1b[${color}m[${name}]\x1b[0m `
  const pipe = (stream, out) => {
    let buf = ''
    stream.on('data', (chunk) => {
      buf += chunk.toString()
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) if (line.trim()) out.write(prefix + line + '\n')
    })
  }
  pipe(child.stdout, process.stdout)
  pipe(child.stderr, process.stderr)
  child.on('exit', (code) => {
    // 任一进程退出就一起收工，避免留下孤儿端口
    if (code !== 0 && code !== null) console.error(`${prefix}退出，代码 ${code}`)
    shutdown(code ?? 0)
  })
  children.push(child)
  return child
}

let closing = false
function shutdown(code) {
  if (closing) return
  closing = true
  for (const c of children) {
    if (!c.killed) {
      try {
        c.kill()
      } catch {
        /* noop */
      }
    }
  }
  setTimeout(() => process.exit(code), 120)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

start('proxy', process.execPath, ['server/proxy.mjs'], '36')
start('vite', npmCmd, ['run', 'dev:vite'], '35')
