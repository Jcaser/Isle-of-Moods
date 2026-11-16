/**
 * 极简 MCP Server（Streamable HTTP 传输），只用于验证 proxy 的 MCP 桥接。
 *
 * 启动：node scripts/qa/mcp-mock.mjs 8791
 * 验证：MCP_SERVERS=http://127.0.0.1:8791/mcp node server/proxy.mjs
 *       curl /api/mcp/tools → 应看到 echo_tip
 */

import http from 'node:http'

const PORT = Number(process.argv[2] ?? 8791)
let sid = 'mock-session-1'

const TOOLS = [
  {
    name: 'echo_tip',
    description: '返回一条固定的缓解焦虑小贴士（mock，用于验证 MCP 桥接）',
    inputSchema: {
      type: 'object',
      properties: { topic: { type: 'string', description: '主题，可选' } },
      required: [],
    },
  },
]

function rpc(id, result) {
  return { jsonrpc: '2.0', id, result }
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405).end()
    return
  }
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    let msg = {}
    try {
      msg = JSON.parse(body || '{}')
    } catch {
      res.writeHead(400).end()
      return
    }

    // 通知类消息：202 无内容
    if (!msg.id) {
      res.writeHead(202, { 'Mcp-Session-Id': sid }).end()
      return
    }

    const reply = (obj, extra = {}) => {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Mcp-Session-Id': sid,
        ...extra,
      })
      res.end(JSON.stringify(obj))
    }

    if (msg.method === 'initialize') {
      reply(
        rpc(msg.id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'mock-tips', version: '0.1.0' },
        }),
      )
      return
    }
    if (msg.method === 'tools/list') {
      reply(rpc(msg.id, { tools: TOOLS }))
      return
    }
    if (msg.method === 'tools/call') {
      const name = msg.params?.name
      if (name !== 'echo_tip') {
        reply({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: `未知工具 ${name}` } })
        return
      }
      const topic = msg.params?.arguments?.topic ?? '通用'
      reply(
        rpc(msg.id, {
          content: [{ type: 'text', text: `【${topic}】先做 4 轮 4-7-8 呼吸，再决定下一步。（来自 mock MCP Server）` }],
          isError: false,
        }),
      )
      return
    }
    reply({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'Method not found' } })
  })
})

server.listen(PORT, '127.0.0.1', () => console.log(`mock MCP server on http://127.0.0.1:${PORT}/mcp`))
