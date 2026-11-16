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
  /** 标题与标签，用作"是否在聊这个话题"的强信号 */
  keys: string[]
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
  记不住: ['记忆', '遗忘'],
  背了就忘: ['记忆', '遗忘', '间隔重复'],
  走神: ['注意力', '专注'],
  坐不住: ['注意力', '专注'],
  刷手机: ['手机', '拖延'],
  摆烂: ['拖延', '自责'],
  拖到: ['拖延', '启动'],
  最后一晚: ['拖延', '启动'],
  不想开始: ['拖延', '启动'],
  deadline: ['拖延', '计划'],
  ddl: ['拖延', '计划'],
  还没开始: ['拖延', '启动'],
  室友: ['宿舍', '人际'],
  宿舍: ['室友', '人际'],
  朋友: ['人际', '社交'],
  我妈: ['父母', '家庭'],
  爸妈: ['父母', '家庭'],
  父母: ['家庭', '期待'],
  家里: ['家庭', '父母'],
  亲戚: ['家庭', '比较'],
  比较: ['社会比较', '别人'],
  别人: ['比较'],
  失恋: ['分手', '拒绝'],
  分手: ['失恋', '拒绝'],
  喜欢的人: ['暗恋', '失恋'],
  拒绝: ['失恋', '暗恋'],
  喘不上气: ['惊恐', '过度换气', '呼吸'],
  要死了: ['惊恐', '濒死'],
  胃疼: ['躯体', '压力'],
  拉肚子: ['躯体', '压力'],
  头痛: ['躯体', '压力'],
  暴食: ['进食', '催吐'],
  催吐: ['进食', '暴食'],
  减肥: ['身材', '节食'],
  身材: ['进食', '体重'],
  复读: ['二战', '重来'],
  二战: ['复读'],
  没兴趣: ['低落', '抑郁'],
  不想起床: ['低落', '动力'],
  没意思: ['低落', '求助'],
  抑郁: ['低落'],
  不够好: ['自我批评', '自我关怀'],
  配不上: ['自我批评', '自我关怀'],
  考不上: ['灾难化', '前途'],
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
      keys: [doc.title, ...doc.tags].filter((k) => k.length >= 2),
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

/** 口语 → 检索式：剥掉疑问词与语气词，留下真正承载语义的词 */
export function rewriteQuery(query: string): string {
  return query
    .replace(/[？?！!。，,、；;：:"'“”‘’]/g, ' ')
    .replace(/(怎么办呢|怎么办|怎么样|为什么|是不是|可不可以|能不能|我要怎么|我该怎么|你觉得|请问|帮我看看)/g, ' ')
    .replace(/(我|我们|最近|总是|一直|特别|有点|真的|感觉|觉得|好像|已经|还是|就是)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 十折交叉打分用的覆盖率：查询里的二元组有多少被这一段接住 */
function coverage(chunk: Chunk, querySet: string[]): number {
  const grams = querySet.filter((t) => t.length >= 2)
  if (!grams.length) return 0
  let hit = 0
  for (const g of grams) if (chunk.tf.has(g)) hit++
  return hit / grams.length
}

/**
 * 两阶段检索：
 *   1) 召回 —— BM25 打分，取前 8 段（宽召回，保证不遗漏）；
 *   2) 重排 —— 归一化 BM25 × 0.55 + 查询覆盖率 × 0.35 + 标题命中 × 0.10，
 *      再做「同一篇只留一段」的多样性去重，最后按相对阈值截断。
 * 返回带出处的引用片段。
 */
export function retrieve(query: string, topK = 3): Citation[] {
  const expanded = rewriteQuery(query) || query
  const qTokens = expandQuery(`${query} ${expanded}`)
  if (!qTokens.length) return []
  const { chunks, df, avgLen } = getIndex()
  const N = chunks.length
  const k1 = 1.45
  const b = 0.72

  const querySet = [...new Set(qTokens)]
  const q = query.trim()
  const candidates: { c: Chunk; bm25: number; keys: number; bi: number }[] = []

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

    // 命中标题/标签 = 这段确实在聊这个话题，给一个强加分
    const keys = c.keys.filter((k) => q.includes(k)).length
    score += Math.min(keys, 3) * 9

    // 相关性门控：没有话题锚点、命中的二元组也少于 2 个，就当作没检索到，
    // 宁可返回空，也不要把不相关的段落塞给模型（否则会出现"问食堂菜也引用失眠"）
    const bi = querySet.filter((t) => t.length >= 2 && c.tf.has(t)).length
    if (!keys && bi < 2 && score < 14) continue

    if (score > 0) candidates.push({ c, bm25: score, keys, bi })
  }

  if (!candidates.length) return []

  // 阶段一：宽召回
  candidates.sort((a, b2) => b2.bm25 - a.bm25)
  const recall = candidates.slice(0, 8)
  const maxBm25 = recall[0].bm25 || 1

  // 阶段二：交叉重排
  const reranked = recall
    .map((item) => {
      const norm = item.bm25 / maxBm25
      const cov = coverage(item.c, querySet)
      const title = Math.min(item.keys, 2) / 2
      return { ...item, rerank: norm * 0.55 + cov * 0.35 + title * 0.1 }
    })
    .sort((a, b2) => b2.rerank - a.rerank)

  // 同一篇只留最相关的一段：3 条引用全是同一本书，对用户没有额外信息量
  const picked: typeof reranked = []
  const seen = new Set<string>()
  for (const item of reranked) {
    if (seen.has(item.c.docId)) continue
    seen.add(item.c.docId)
    picked.push(item)
    if (picked.length >= Math.max(topK, 1)) break
  }

  const max = picked[0]?.rerank ?? 1
  return picked
    .filter(({ rerank }) => rerank >= max * 0.45)
    .map(({ c, rerank }) => ({
      chunkId: c.id,
      docId: c.docId,
      title: c.title,
      category: c.category,
      snippet: makeSnippet(c.text, querySet.filter((t) => t.length >= 2)),
      score: Number((rerank / max).toFixed(3)),
    }))
}

/** 把引用拼成一段纯文本，用于 groundedness 计算（不展示给用户） */
export function citationTextOf(citations: Citation[]): string {
  return citations.map((c) => `${c.title} ${c.snippet}`).join('\n')
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

/**
 * 组装注入大模型的检索上下文。
 *
 * 注意：检索本身是本地 BM25 计算，零成本；真正花钱的是这段文字被塞进 prompt。
 * 所以这里只取最相关的 2 条、去掉分类与编号等对模型无用的装饰，尽量短。
 */
export function buildContextBlock(citations: Citation[]): string {
  if (!citations.length) return ''
  return citations
    .slice(0, 2)
    .map((c, i) => `资料${i + 1}《${c.title}》：${c.snippet}`)
    .join('\n')
}

export function docById(id: string): KnowledgeDoc | undefined {
  return KNOWLEDGE_DOCS.find((d) => d.id === id)
}

export const KB_STATS = {
  docs: KNOWLEDGE_DOCS.length,
  chunks: KNOWLEDGE_DOCS.flatMap(splitChunks).length,
}
