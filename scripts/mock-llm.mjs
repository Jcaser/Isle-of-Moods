/**
 * 本地 OpenAI 兼容 Mock 服务（仅用于端到端验证 Agent 链路）
 * 第一轮返回 tool_call，第二轮按工具结果流式输出 Markdown。
 */
import http from 'node:http'

const PORT = 4180

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end()
    return
  }

  if (req.url?.startsWith('/v1/models')) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ data: [{ id: 'mock-model' }] }))
    return
  }

  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    const payload = JSON.parse(body || '{}')
    const messages = payload.messages ?? []
    const hasToolResult = messages.some((m) => m.role === 'tool')

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`)

    if (!hasToolResult) {
      send({
        id: 'chatcmpl-mock',
        choices: [
          {
            index: 0,
            delta: {
              role: 'assistant',
              tool_calls: [
                {
                  index: 0,
                  id: 'call_mock_1',
                  type: 'function',
                  function: { name: 'search_knowledge_base', arguments: '{"query":"考前焦虑 失眠"}' },
                },
              ],
            },
          },
        ],
      })
      send({ id: 'chatcmpl-mock', choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] })
      res.write('data: [DONE]\n\n')
      res.end()
      return
    }

    const text = `我听见了，**心慌和失眠**往往是同一套警报系统在工作，不是你"扛不住"。

可以分两步走：

- **先把身体慢下来**：4-7-8 呼吸，吸 4 秒、屏 7 秒、呼 8 秒，做 4 个循环。呼气比吸气长，心率会跟着降下来 [1]。
- **再把担心放到纸上**：写下"我在担心____"，标一下哪些是能控制的。

另外提醒一句：单晚没睡好对已掌握知识的影响，远小于"我完了"这种解读带来的影响 [1]。

今晚想先试哪一个？`

    const chunks = text.match(/[\s\S]{1,8}/g) ?? []
    let i = 0
    const timer = setInterval(() => {
      if (i >= chunks.length) {
        clearInterval(timer)
        send({ id: 'chatcmpl-mock', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })
        res.write('data: [DONE]\n\n')
        res.end()
        return
      }
      send({ id: 'chatcmpl-mock', choices: [{ index: 0, delta: { content: chunks[i++] } }] })
    }, 16)
  })
})

server.listen(PORT, '127.0.0.1', () => console.log('mock llm on', PORT))
