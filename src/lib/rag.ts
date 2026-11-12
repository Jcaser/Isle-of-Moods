/**
 * 本地 RAG 检索引擎（无服务端、零依赖）
 *
 * 架构：
 *   文档 → 段落切块 → 中文二元组 + 英文词 分词 → 倒排索引 → BM25 排序 → 上下文注入
 * 特点：
 *   - 纯浏览器端运行，知识库与用户问题都不离开设备，符合隐私优先原则
 *   - 查询侧做同义扩展，弥补短查询的词汇不匹配
 *   - 返回带出处的片段，供前端渲染引用卡片，抑制模型幻觉
 */

import { KNOWLEDGE_DOCS, type KnowledgeDoc } from './knowledge'
import type { Citation } from './types'

interface Chunk {
  id: string
  docId: string
  title: string
  category: string
  text: string
  tokens: string[]
  tf: Map<string, number>
  len: number
}

const STOP_CHARS = new Set('的了是我你他她它们在有不都也就很到说要去会着没有好看这那么什么怎么因为所以但是可以还又被把让给对从'.split(''))

/** 查询扩展：把口语表达映射到知识库用词 */
const SYNONYMS: Record<string, string[]> = {
  睡不着: ['失眠', '睡眠'],
  失眠: ['睡不着', '睡眠'],
  紧张: ['焦虑', '唤醒'],
  慌: ['焦虑', '紧张'],
  心慌: ['焦虑', '心跳'],
  学不进去: ['拖延', '专注', '启动'],
  内耗: ['反刍', '自责', '拖延'],
  自责: ['自我关怀', '内疚'],
  脑子空白: ['着陆', '考场'],
  考砸: ['灾难化', '认知'],
  来不及: ['计划', '复习'],
  崩溃: ['情绪', '求助'],
  想哭: ['情绪', '自我关怀'],
  手机: ['拖延', '专注'],
  熬夜: ['睡眠', '作息'],
  呼吸: ['4-7-8', '副交感'],
  心跳快: ['焦虑', '呼吸'],
}

function isCJK(ch: string): boolean {
  return /[\u4e00-\u9fa5]/.test(ch)
}

export function tokenize(text: string): string[] {
  const tokens: string[] = []
  const lower = text.toLowerCase()
  // 英文与数字
  for (const w of lower.match(/[a-z0-9][a-z0-9+#.-]*/g) ?? []) {
    if (w.length >= 2) tokens.push(w)
  }
  // 中文：字 + 二元组
  const runs = lower.match(/[\u4e00-\u9fa5]+/g) ?? []
  for (const run of runs) {
    for (let i = 0; i < run.length; i++) {
      if (!STOP_CHARS.has(run[i])) tokens.push(run[i])
      if (i < run.length - 1) tokens.push(run.slice(i, i + 2))
    }
  }
  return tokens
}

function expandQuery(query: string): string[] {
  const base = tokenize(query)
  const extra: string[] = []
  for (const [key, alts] of Object.entries(SYNONYMS)) {
    if (query.includes(key)) {
      for (const alt of alts) extra.push(...tokenize(alt))
    }
  }
  return [...base, ...extra]
}

function splitChunks(doc: KnowledgeDoc): Chunk[] {
  const paragraphs = doc.content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  // 合并过短段落，避免碎片化引用
  const merged: string[] = []
  let buf = ''
  for (const p of paragraphs) {
    if (buf.length + p.length < 260) {
      buf = buf ? `${buf}\n${p}` : p
    } else {
      if (buf) merged.push(buf)
      buf = p
    }
  }
  if (buf) merged.push(buf)

  return merged.map((text, i) => {
    const tokens = tokenize(`${doc.title} ${doc.tags.join(' ')} ${text}`)
    const tf = new Map<string, number>()
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1)
    return {
      id: `${doc.id}#${i}`,
      docId: doc.id,
      title: doc.title,
      category: doc.category,
      text,
      tokens,
      tf,
      len: tokens.length,
    }
  })
}

interface Index {
  chunks: Chunk[]
  df: Map<string, number>
  avgLen: number
}

let INDEX: Index | null = null

function getIndex(): Index {
  if (INDEX) return INDEX
  const chunks = KNOWLEDGE_DOCS.flatMap(splitChunks)
  const df = new Map<string, number>()
  for (const c of chunks) {
    for (const t of new Set(c.tokens)) df.set(t, (df.get(t) ?? 0) + 1)
  }
  INDEX = {
    chunks,
    df,
    avgLen: chunks.reduce((s, c) => s + c.len, 0) / Math.max(chunks.length, 1),
  }
  return INDEX
}

function makeSnippet(text: string, queryTokens: string[]): string {
  const flat = text.replace(/\n/g, ' ')
  let best = 0
  let bestHits = -1
  const step = 20
  for (let i = 0; i < Math.max(flat.length - 140, 1); i += step) {
    const win = flat.slice(i, i + 140)
    let hits = 0
    for (const t of queryTokens) if (t.length > 1 && win.includes(t)) hits++
    if (hits > bestHits) {
      bestHits = hits
      best = i
    }
  }
  const start = Math.max(0, best - 10)
  const seg = flat.slice(start, start + 150).trim()
  return (start > 0 ? '…' : '') + seg + (start + 150 < flat.length ? '…' : '')
}

/** BM25 检索，返回带出处的引用片段 */
export function retrieve(query: string, topK = 3): Citation[] {
  const qTokens = expandQuery(query)
  if (!qTokens.length) return []
  const { chunks, df, avgLen } = getIndex()
  const N = chunks.length
  const k1 = 1.45
  const b = 0.72

  const querySet = [...new Set(qTokens)]
  const scored: { c: Chunk; s: number }[] = []

  for (const c of chunks) {
    let score = 0
    for (const t of querySet) {
      const f = c.tf.get(t)
      if (!f) continue
      const n = df.get(t) ?? 0
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5))
      // 二元组权重高于单字，避免常用字干扰
      const w = t.length >= 2 ? 1 : 0.35
      score += w * idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * c.len) / avgLen)))
    }
    if (score > 0) scored.push({ c, s: score })
  }

  scored.sort((a, b2) => b2.s - a.s)
  const top = scored.slice(0, Math.max(topK, 1))
  const max = top[0]?.s ?? 1

  return top.map(({ c, s }) => ({
    chunkId: c.id,
    docId: c.docId,
    title: c.title,
    category: c.category,
    snippet: makeSnippet(c.text, querySet),
    score: Number((s / max).toFixed(3)),
  }))
}

/** 知识库页面用的全文匹配（标题 / 标签 / 正文） */
export function searchDocs(keyword: string, category: string): KnowledgeDoc[] {
  const kw = keyword.trim().toLowerCase()
  return KNOWLEDGE_DOCS.filter((d) => {
    if (category !== '全部' && d.category !== category) return false
    if (!kw) return true
    return (
      d.title.toLowerCase().includes(kw) ||
      d.summary.toLowerCase().includes(kw) ||
      d.tags.some((t) => t.toLowerCase().includes(kw)) ||
      d.content.toLowerCase().includes(kw)
    )
  })
}

/** 组装注入大模型的检索上下文 */
export function buildContextBlock(citations: Citation[]): string {
  if (!citations.length) return ''
  return citations
    .map(
      (c, i) =>
        `【资料 ${i + 1}｜${c.title}｜${c.category}】\n${c.snippet}\n（引用编号：${c.chunkId}）`,
    )
    .join('\n\n')
}

export function docById(id: string): KnowledgeDoc | undefined {
  return KNOWLEDGE_DOCS.find((d) => d.id === id)
}

export const KB_STATS = {
  docs: KNOWLEDGE_DOCS.length,
  chunks: KNOWLEDGE_DOCS.flatMap(splitChunks).length,
}
