/**
 * DSH model glue: translation batches and the reader's chat stream.
 *
 * Everything goes through `ctx.llm.stream` (the same service the agent uses),
 * with the provider/model from `agentDefaultModel` so the reader follows the
 * model the user picked in DSH.
 */
import { createAssistantMessage, createUserMessage } from '@deepseek-ai/dsh-llm'

const TRANSLATE_BATCH = 4
const TRANSLATE_MAX_CHARS = 3200
const TRANSLATE_TIMEOUT_MS = 150_000
const CHAT_TIMEOUT_MS = 180_000
const CONTEXT_MAX_CHARS = 28_000

export class LlmUnavailableError extends Error {
  constructor(message) {
    super(message)
    this.name = 'LlmUnavailableError'
    this.code = 'llm-unavailable'
  }
}

export function resolveModel(ctx) {
  try {
    const selection = ctx.get('agentDefaultModel')?.currentSelection?.()
    const provider = String(selection?.provider ?? '').trim()
    const model = String(selection?.model ?? '').trim()
    if (provider !== '' && model !== '') {
      return {
        provider,
        model,
        reasoningEffort: selection?.reasoningEffort,
        label: `${provider} / ${model}`,
      }
    }
  } catch {
    /* fall through */
  }
  const llm = ctx.get('llm')
  const providers = typeof llm?.listProviders === 'function' ? llm.listProviders() : []
  for (const provider of providers) {
    const id = String(provider?.id ?? provider?.name ?? '')
    if (id === '') continue
    return { provider: id, model: '', reasoningEffort: undefined, label: id }
  }
  throw new LlmUnavailableError('DSH 还没有选择模型：请先在对话底部选择一个模型。')
}

function generateOptions(model, extra) {
  return {
    provider: model.provider,
    model: model.model,
    ...(model.reasoningEffort === undefined ? {} : { reasoningEffort: model.reasoningEffort }),
    ...extra,
  }
}

async function collect(stream, signal) {
  let text = ''
  let failure = null
  for await (const chunk of stream) {
    if (signal?.aborted === true) break
    if (chunk.type === 'text-delta') text += chunk.text
    else if (chunk.type === 'finish') {
      if (chunk.reason?.kind === 'error' || chunk.reason?.kind === 'aborted') {
        failure = chunk.reason?.failure?.message ?? `model finish: ${chunk.reason.kind}`
      }
    }
  }
  return { text, failure }
}

/* ------------------------------------------------------------------ */
/* Translation                                                        */
/* ------------------------------------------------------------------ */

const TRANSLATE_SYSTEM = `你是专业的学术论文翻译。把给定的英文论文段落翻译成准确、通顺的简体中文。
规则：
1. 完整翻译，不总结、不增删、不解释。
2. 数学符号、公式、变量名、引用编号（[12]、图 3、表 2、Eq. (1)）保持原样；术语首次出现时可写成「中文（English）」，之后统一。
3. 保留段落中的换行与列表结构（如有）。
4. 只输出一个 JSON 对象：键是输入里的 id，值是译文。不要 markdown 代码围栏，不要任何额外文字。`

/** Translate a list of blocks in small batches; returns an id → Chinese map. */
export async function translateBlocks(ctx, blocks, { signal, onBatch } = {}) {
  const model = resolveModel(ctx)
  if (model.model === '') throw new LlmUnavailableError('当前模型缺少 model id，请重新选择模型。')
  const llm = ctx.get('llm')
  if (llm === undefined) throw new LlmUnavailableError('DSH 的 LLM 服务不可用。')

  const translations = {}
  const failed = []
  const batches = []
  let current = []
  let size = 0
  for (const block of blocks) {
    if (current.length > 0 && (current.length >= TRANSLATE_BATCH || size + block.text.length > TRANSLATE_MAX_CHARS)) {
      batches.push(current)
      current = []
      size = 0
    }
    current.push(block)
    size += block.text.length
  }
  if (current.length > 0) batches.push(current)

  for (const batch of batches) {
    if (signal?.aborted === true) break
    const payload = JSON.stringify(batch.map((block) => ({ id: block.id, text: block.text })))
    try {
      const stream = llm.stream(
        generateOptions(model, {
          messages: [
            createUserMessage({
              content: [{ type: 'text', text: `<blocks>\n${payload}\n</blocks>` }],
              source: { kind: 'user' },
            }),
          ],
          system: TRANSLATE_SYSTEM,
          temperature: 0.2,
          maxTokens: 6000,
          signal: signal ?? AbortSignal.timeout(TRANSLATE_TIMEOUT_MS),
        }),
      )
      const { text, failure } = await collect(stream, signal)
      if (failure !== null) throw new Error(failure)
      const parsed = parseTranslations(text, batch)
      for (const block of batch) {
        const value = parsed[block.id]
        if (typeof value === 'string' && value.trim() !== '') translations[block.id] = tidyTranslation(value, block.text)
        else failed.push(block.id)
      }
    } catch (error) {
      if (signal?.aborted === true) break
      for (const block of batch) failed.push(block.id)
      onBatch?.({ translations, failed, error: error instanceof Error ? error.message : String(error) })
      throw error
    }
    onBatch?.({ translations, failed })
  }
  return { translations, failed }
}

function parseTranslations(text, batch) {
  const ids = new Set(batch.map((block) => block.id))
  const candidates = []
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  candidates.push(fenced !== null ? fenced[1] : text)
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) candidates.push(text.slice(start, end + 1))

  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate)
      if (value === null || typeof value !== 'object') continue
      if (Array.isArray(value)) {
        const mapped = {}
        for (const item of value) {
          if (item === null || typeof item !== 'object') continue
          const id = item.id ?? item.blockId ?? item.key
          const translated = item.text ?? item.translation ?? item.zh
          if (typeof id === 'string' && ids.has(id) && typeof translated === 'string') mapped[id] = translated
        }
        if (Object.keys(mapped).length > 0) return mapped
        continue
      }
      const mapped = {}
      for (const [key, translated] of Object.entries(value)) {
        if (ids.has(key) && typeof translated === 'string') mapped[key] = translated
      }
      if (Object.keys(mapped).length > 0) return mapped
    } catch {
      /* try the next candidate */
    }
  }

  // A single block with a prose answer (no JSON) is still usable.
  if (batch.length === 1) {
    const cleaned = text.trim().replace(/^["'“]|["'”]$/g, '')
    if (cleaned !== '' && !cleaned.startsWith('{')) return { [batch[0].id]: cleaned }
  }
  return {}
}

function tidyTranslation(value, source) {
  let text = value.trim()
  text = text.replace(/^```[\w-]*\n?/, '').replace(/\n?```$/, '').trim()
  if (text === source.trim()) return text
  return text
}

/* ------------------------------------------------------------------ */
/* Chat                                                               */
/* ------------------------------------------------------------------ */

const CHAT_SYSTEM = `你是 DeepSeek Harness 里的阅读助手。用户正在阅读器里读一篇论文、技术博客或文章，下面提供了它的结构、摘要以及和问题最相关的原文片段。
要求：
1. 用简体中文回答；专有名词、缩写、公式保留英文。
2. 直接回答问题，不要复述整篇摘要；需要引用原文时用 [§3.2 · b42] 这种格式（b42 是片段编号）。
3. 如果提供的片段不足以回答，明确说「提供的片段里没有直接说明」，并指出应该看哪一节。
4. 需要公式时用 LaTeX；需要步骤时用 Markdown 列表。`

export function buildChatPrompt(paper, question, { selection, zh, focusBlockId } = {}) {
  const blocks = Array.isArray(paper.blocks) ? paper.blocks : []
  const query = String(question ?? '')
  const terms = queryTerms(query)
  const cjkTerms = cjkGrams(query)
  const generic = terms.length === 0 && cjkTerms.length === 0

  const scored = []
  for (const block of blocks) {
    if (block.type === 'reference') continue
    const haystack = `${block.text}\n${zh?.[block.id] ?? ''}`.toLowerCase()
    let score = 0
    for (const term of terms) if (haystack.includes(term)) score += term.length >= 6 ? 2 : 1
    for (const gram of cjkTerms) if (haystack.includes(gram)) score += 1.5
    if (focusBlockId === block.id) score += 30
    if (block.type === 'abstract') score += 2
    if (score > 0) scored.push({ block, score })
  }
  scored.sort((a, b) => b.score - a.score)

  const picked = new Map()
  for (const { block } of scored.slice(0, 8)) {
    picked.set(block.id, block)
    const at = blocks.indexOf(block)
    for (let offset = -1; offset <= 1; offset += 1) {
      const neighbour = blocks[at + offset]
      if (neighbour !== undefined && neighbour.type !== 'reference') picked.set(neighbour.id, neighbour)
    }
  }
  if (generic || picked.size < 3) {
    const intro = blocks.filter((block) => block.type === 'heading' || block.type === 'abstract' || block.type === 'para')
    for (const block of intro.slice(0, 12)) picked.set(block.id, block)
    const tail = blocks.filter((block) => block.type === 'para').slice(-6)
    for (const block of tail) picked.set(block.id, block)
  }

  const ordered = blocks.filter((block) => picked.has(block.id))
  const outline = paper.outline ?? []
  const abstract =
    paper.abstract !== undefined && paper.abstract !== ''
      ? paper.abstract
      : blocks
          .filter((block) => block.type === 'abstract')
          .slice(0, 3)
          .map((block) => block.text)
          .join(' ')

  const header = [
    `标题：${paper.title}`,
    paper.authors?.length ? `作者：${paper.authors.join(', ')}` : '',
    paper.year !== undefined ? `年份：${paper.year}` : '',
    paper.venue !== undefined && paper.venue !== '' ? `来源：${paper.venue}` : '',
    `原文链接：${paper.url}`,
  ]
    .filter(Boolean)
    .join('\n')

  const outlineText = outline
    .slice(0, 40)
    .map((item) => `${'  '.repeat(Math.max(0, (item.level ?? 2) - 2))}- ${item.text}`)
    .join('\n')

  let context = `## 论文信息\n${header}\n\n## 章节结构\n${outlineText || '（无）'}\n\n## 摘要\n${abstract || '（无）'}\n\n## 相关原文片段\n`
  let used = context.length
  let included = 0
  for (const block of ordered) {
    const section = block.section !== undefined && block.section !== '' ? block.section : block.type === 'heading' ? block.text : ''
    const line = `[${section !== '' ? `§${section} · ` : ''}${block.id}] ${block.text}\n`
    if (used + line.length > CONTEXT_MAX_CHARS) break
    context += line
    used += line.length
    included += 1
  }
  if (included === 0) context += '（没有匹配到片段）\n'

  if (selection !== undefined && String(selection).trim() !== '') {
    context += `\n## 用户当前选中的原文\n${String(selection).slice(0, 4000)}\n`
  }

  return `${context}\n## 用户的问题\n${query}`
}

export async function streamChat(ctx, paper, messages, { signal, selection, zh, focusBlockId, onDelta } = {}) {
  const model = resolveModel(ctx)
  if (model.model === '') throw new LlmUnavailableError('当前模型缺少 model id，请重新选择模型。')
  const llm = ctx.get('llm')
  if (llm === undefined) throw new LlmUnavailableError('DSH 的 LLM 服务不可用。')

  const history = (Array.isArray(messages) ? messages : [])
    .filter((message) => (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string')
    .slice(-16)
  const last = history.pop()
  const question = last?.role === 'user' ? last.content : ''
  const prompt = buildChatPrompt(paper, question, { selection, zh, focusBlockId })

  const requestMessages = []
  for (const message of history) {
    if (message.role === 'assistant') {
      requestMessages.push(
        createAssistantMessage({
          content: [{ type: 'text', text: message.content }],
          provider: model.provider,
          model: model.model,
        }),
      )
    } else {
      requestMessages.push(createUserMessage({ content: [{ type: 'text', text: message.content }], source: { kind: 'user' } }))
    }
  }
  requestMessages.push(createUserMessage({ content: [{ type: 'text', text: prompt }], source: { kind: 'user' } }))

  const stream = llm.stream(
    generateOptions(model, {
      messages: requestMessages,
      system: CHAT_SYSTEM,
      temperature: 0.4,
      maxTokens: 6000,
      signal: signal ?? AbortSignal.timeout(CHAT_TIMEOUT_MS),
    }),
  )

  let text = ''
  for await (const chunk of stream) {
    if (signal?.aborted === true) break
    if (chunk.type === 'text-delta') {
      text += chunk.text
      onDelta?.(chunk.text)
    } else if (chunk.type === 'finish') {
      if (chunk.reason?.kind === 'error' || chunk.reason?.kind === 'aborted') {
        throw new Error(chunk.reason?.failure?.message ?? `model finish: ${chunk.reason.kind}`)
      }
    }
  }
  return { text, model: model.label }
}

/* ------------------------------------------------------------------ */
/* Retrieval helpers                                                  */
/* ------------------------------------------------------------------ */

const STOP = new Set(
  `a an the and or but if then than that this these those is are was were be been being of to in on at for from by with without as it its we our you your they their he she his her not no do does did how what why which who whom when where can could should would may might will about into over under between among paper article author authors study work result results section figure table equation eq ref reference please explain summarize summary main contribution contributions method methods approach experiment experiments conclusion abstract introduce related question answer tell show give`.split(
    /\s+/,
  ),
)

function queryTerms(query) {
  return [
    ...new Set(
      String(query)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
        .split(/\s+/)
        .filter((term) => term.length >= 3 && !STOP.has(term)),
    ),
  ].slice(0, 24)
}

function cjkGrams(query) {
  const chars = String(query).replace(/[^\u4e00-\u9fff]/g, '')
  if (chars.length < 2) return []
  const grams = new Set()
  for (let index = 0; index < chars.length - 1; index += 1) grams.add(chars.slice(index, index + 2))
  for (const word of String(query).match(/[\u4e00-\u9fff]{2,6}/g) ?? []) grams.add(word)
  return [...grams].slice(0, 24)
}
