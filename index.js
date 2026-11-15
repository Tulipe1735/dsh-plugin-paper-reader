/**
 * dsh-plugin-paper-reader — Host half.
 *
 * A Zotero-like paper library inside DSH:
 *   - add a paper by URL (arXiv HTML/PDF, any PDF, or readable HTML)
 *   - extract paragraph-level blocks so the client can align the original
 *     English with a Simplified-Chinese translation in one shared scroll
 *   - translate batches through DSH's own `llm` service and cache every block
 *   - stream the reader's "ask the paper" chat through the same model
 *   - expose `paper_list` / `paper_read` / `paper_add` tools, so the main DSH
 *     agent can see exactly what the reader is showing.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

import { createStore } from './lib/store.js'
import { extractPaper, clip, ExtractError, arxivId, fetchBinary } from './lib/extract.js'
import { LlmUnavailableError, streamChat, translateBlocks } from './lib/llm.js'

const PLUGIN_ID = 'dsh-plugin-paper-reader'
const ROUTE_PREFIX = `/plugins/${PLUGIN_ID}/`
const API_PREFIX = `${ROUTE_PREFIX}api/`
const MAX_BODY_BYTES = 2 * 1024 * 1024
const FIGURE_MAX_BYTES = 12 * 1024 * 1024
const FIGURE_LIMIT = 20
const FIGURE_MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
}

const pluginRoot = path.dirname(fileURLToPath(import.meta.url))
let clientLoadedAt = 0
let clientLoadedInfo = null

export const name = PLUGIN_ID
export const inject = ['tools', 'webServer', 'llm']

/** @param {import('@deepseek-ai/cordis').Context} ctx */
export function apply(ctx) {
  const root = path.join(process.env.DSH_HOME || path.join(os.homedir(), '.dsh'), 'paper-reader')
  const store = createStore(root)
  const origin = () => {
    try {
      return ctx.webServer.getOrigin()
    } catch {
      return undefined
    }
  }

  ctx.logger?.debug?.(`[${PLUGIN_ID}] papers at ${root}`)

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'prefix',
        path: ROUTE_PREFIX.replace(/\/$/, ''),
        handler: (req, res) => handleRequest(ctx, store, origin, req, res),
      }),
    'paper-reader: HTTP bridge',
  )

  ctx.effect(
    () =>
      ctx.tools.register({
        name: 'paper_list',
        description:
          'List the papers in the user\'s DSH Paper Reader library (newest first): id, title, authors, year, source, translation progress. Use it before paper_read when the user says "the paper I am reading" and you need its id.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        output: {
          schema: { type: 'object', additionalProperties: true },
          render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
        },
        async execute() {
          const library = await store.list()
          return {
            papers: library.papers.map((paper) => ({
              id: paper.id,
              title: paper.title,
              type: paper.type,
              site: paper.site,
              authors: paper.authors,
              year: paper.year,
              venue: paper.venue,
              kind: paper.kind,
              url: paper.url,
              blocks: paper.blocks,
              paragraphs: paper.paragraphs,
              translated: paper.translated,
              addedAt: paper.addedAt,
            })),
            hint: 'Call paper_read with one of these ids to read its text.',
          }
        },
      }),
    'paper-reader: list tool',
  )

  ctx.effect(
    () =>
      ctx.tools.register({
        name: 'paper_read',
        description:
          'Read a paper from the user\'s DSH Paper Reader: metadata, section outline, and paragraph text (English original). The user sees the same paper in the bilingual reader panel, possibly with a Chinese translation beside it. Use mode "summary" for metadata + outline, "section" with a section name, or "full" for the whole text (bounded).',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Paper id from paper_list (e.g. "p-1a2b3c4d5e").' },
            section: { type: 'string', description: 'Only blocks from this section (case-insensitive substring).' },
            mode: {
              type: 'string',
              enum: ['summary', 'outline', 'full', 'section'],
              description: 'summary (default): metadata + outline + first paragraphs. outline: headings only. full: all blocks (bounded).',
            },
            offset: { type: 'integer', description: 'First block index for mode "full" (default 0).' },
            limit: { type: 'integer', description: 'Maximum blocks to return (default 80, max 300).' },
          },
          additionalProperties: false,
        },
        output: {
          schema: { type: 'object', additionalProperties: true },
          render: (_args, value) => [{ type: 'text', text: typeof value.text === 'string' ? value.text : JSON.stringify(value, null, 2) }],
        },
        async execute(args) {
          const library = await store.list()
          if (library.papers.length === 0) return { error: '阅读器里还没有论文。' }
          const id = typeof args.id === 'string' && args.id !== '' ? args.id : undefined
          const paper = await pickPaper(library, store, id)
          if (paper === null) return { error: id === undefined ? '无法定位论文。' : `找不到论文 ${id}。` }
          const mode = args.mode ?? 'summary'
          const blocks = Array.isArray(paper.blocks) ? paper.blocks.filter((block) => block.type !== 'reference') : []
          const header = [
            `标题：${paper.title}`,
            paper.authors?.length ? `作者：${paper.authors.join(', ')}` : '',
            paper.year !== undefined ? `年份：${paper.year}` : '',
            paper.venue ? `来源：${paper.venue}` : '',
            `链接：${paper.url}`,
            `片段数：${blocks.length} · 页数：${paper.pages ?? 0}`,
          ]
            .filter(Boolean)
            .join('\n')

          if (mode === 'outline') {
            return {
              id: paper.id,
              title: paper.title,
              text: `${header}\n\n章节：\n${(paper.outline ?? []).map((item) => `${item.text} (${item.id})`).join('\n')}`,
            }
          }

          const sectionFilter = typeof args.section === 'string' && args.section.trim() !== '' ? args.section.trim().toLowerCase() : null
          let selected = blocks
          if (sectionFilter !== null) {
            selected = blocks.filter((block) => String(block.section ?? '').toLowerCase().includes(sectionFilter))
            if (selected.length === 0) return { error: `没有找到包含「${args.section}」的章节。` }
          } else if (mode === 'summary') {
            selected = blocks.slice(0, 10)
          }
          const offset = clampNumber(args.offset, 0, 0, Math.max(0, selected.length - 1))
          const limit = clampNumber(args.limit, mode === 'full' ? 120 : 60, 1, 300)
          const slice = selected.slice(offset, offset + limit)
          const lines = slice.map(
            (block) =>
              `[${block.id}]${block.type === 'heading' ? ' [标题]' : ''}${block.section ? ` (§${block.section})` : ''} ${block.text}`,
          )
          let text = `${header}\n\n`
          if (paper.abstract) text += `摘要：${paper.abstract}\n\n`
          text += `正文片段 ${offset + 1}–${offset + slice.length} / ${selected.length}：\n${lines.join('\n')}`
          text = clip(text, 26_000)
          return {
            id: paper.id,
            title: paper.title,
            mode,
            total: selected.length,
            returned: slice.length,
            nextOffset: offset + slice.length < selected.length ? offset + slice.length : undefined,
            text,
          }
        },
      }),
    'paper-reader: read tool',
  )

  ctx.effect(
    () =>
      ctx.tools.register({
        name: 'paper_add',
        description:
          'Add a paper to the user\'s DSH Paper Reader by URL (arXiv abs/pdf/html links, direct PDF links, or readable article URLs). It downloads and extracts the text so the bilingual reader can show it. Use only when the user asks to add/collect a paper.',
        parameters: {
          type: 'object',
          properties: { url: { type: 'string', description: 'Absolute http(s) URL of the paper.' } },
          required: ['url'],
          additionalProperties: false,
        },
        output: {
          schema: { type: 'object', additionalProperties: true },
          render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
        },
        async execute(args) {
          const result = await addPaper(store, args.url)
          return result
        },
      }),
    'paper-reader: add tool',
  )
}

/* ------------------------------------------------------------------ */
/* Shared operations                                                  */
/* ------------------------------------------------------------------ */

async function pickPaper(library, store, id) {
  if (id !== undefined) {
    if (!library.papers.some((paper) => paper.id === id)) return null
    return store.get(id)
  }
  const latest = library.papers[0]
  return latest === undefined ? null : store.get(latest.id)
}

async function addPaper(store, rawUrl) {
  const library = await store.list()
  try {
    const result = await extractPaper(rawUrl)
    const wantedArxiv = arxivId(result.url) ?? arxivId(result.sourceUrl)
    const existing = library.papers.find(
      (paper) =>
        paper.url === result.url ||
        paper.sourceUrl === result.sourceUrl ||
        (wantedArxiv !== undefined && (arxivId(paper.url) === wantedArxiv || arxivId(paper.sourceUrl) === wantedArxiv)) ||
        paper.title.trim().toLowerCase() === result.title.trim().toLowerCase(),
    )
    if (existing !== undefined) {
      const patch = {}
      if (needsTitleRepair(existing.title) && !needsTitleRepair(result.title)) patch.title = result.title
      if ((existing.authors ?? []).length === 0 && (result.authors ?? []).length > 0) patch.authors = result.authors
      if (existing.year === undefined && result.year !== undefined) patch.year = result.year
      if (!existing.venue && result.venue) patch.venue = result.venue
      if (!existing.abstract && result.abstract) patch.abstract = result.abstract
      const figures = await repairFigures(store, existing.id, result.blocks)
      if (Object.keys(patch).length > 0 || figures > 0) {
        const row = Object.keys(patch).length > 0 ? await store.updateMeta(existing.id, patch) : existing
        return {
          status: 'updated',
          paper: row,
          hint:
            `已补全这篇论文的${[...Object.keys(patch), ...(figures > 0 ? [`${figures} 张插图`] : [])].join(' / ')}。`,
        }
      }
      return {
        status: 'duplicate',
        paper: existing,
        hint: `这篇论文已经在阅读器里了：${existing.title}`,
      }
    }
    const row = await store.add({
      url: result.url,
      sourceUrl: result.sourceUrl,
      kind: result.kind,
      type: result.type,
      site: result.site,
      title: result.title,
      authors: result.authors,
      year: result.year,
      venue: result.venue,
      abstract: result.abstract,
      publishedAt: result.publishedAt,
      wordCount: result.wordCount,
      readingMinutes: result.readingMinutes,
      blocks: result.blocks,
      pages: result.pages,
      outline: result.outline,
    })
    if (result.kind === 'pdf' && result.sourceBytes !== undefined) {
      await store.saveSource(row.id, 'pdf', result.sourceBytes).catch(() => undefined)
    }
    const figures = await hydrateFigures(store, row.id, result.blocks)
    return {
      status: 'added',
      paper: row,
      structure: { blocks: result.blocks.length, pages: result.pages, headings: result.outline.length, figures },
      hint: `已在阅读器中打开：${row.title}`,
    }
  } catch (error) {
    if (error instanceof ExtractError) {
      return { status: 'failed', error: error.message }
    }
    throw error
  }
}

/* ------------------------------------------------------------------ */
/* HTTP bridge                                                        */
/* ------------------------------------------------------------------ */

async function handleRequest(ctx, store, origin, req, res) {
  const url = new URL(req.url ?? '/', 'http://paper-reader.local')
  if (!url.pathname.startsWith(API_PREFIX)) {
    send(res, 404, { error: 'not found' })
    return
  }
  if (!isTrusted(req, origin)) {
    send(res, 403, { error: 'forbidden origin' })
    return
  }

  const action = url.pathname.slice(API_PREFIX.length).replace(/\/+$/, '')
  try {
    switch (`${req.method ?? 'GET'} ${action}`) {
      case 'GET library': {
        send(res, 200, await store.list())
        return
      }
      case 'POST add': {
        const body = await readJson(req)
        const result = await addPaper(store, String(body.url ?? ''))
        send(res, 200, result)
        return
      }
      case 'GET paper': {
        const id = requireId(url.searchParams.get('id'))
        const paper = await store.get(id)
        const translations = await store.translations(id)
        const chat = await store.chat(id)
        await store.markRead(id)
        send(res, 200, { paper, translations, chat: chat.messages ?? [] })
        return
      }
      case 'POST delete': {
        const body = await readJson(req)
        const id = requireId(body.id)
        await store.remove(id)
        send(res, 200, { ok: true })
        return
      }
      case 'POST update': {
        const body = await readJson(req)
        const id = requireId(body.id)
        const patch = normalizeMetadataPatch(body)
        const paper = await store.updateMeta(id, patch)
        send(res, 200, { ok: true, paper })
        return
      }
      case 'POST translate': {
        const body = await readJson(req)
        const id = requireId(body.id)
        const paper = await store.get(id)
        const ids = Array.isArray(body.ids) ? new Set(body.ids.map(String)) : null
        const cached = await store.translations(id)
        const blocks = (paper.blocks ?? []).filter(
          (block) =>
            block.type !== 'reference' &&
            block.type !== 'code' &&
            block.type !== 'image' &&
            (ids === null || ids.has(block.id)) &&
            (typeof cached[block.id] !== 'string' || cached[block.id].trim() === ''),
        )
        if (blocks.length === 0) {
          send(res, 200, { translations: cached, translated: 0, failed: [] })
          return
        }
        const { translations, failed } = await translateBlocks(ctx, blocks, { signal: abortSignal(res) })
        const merged = await store.mergeTranslations(id, translations)
        send(res, 200, { translations: merged.entries, translated: merged.changed, failed })
        return
      }
      case 'POST chat': {
        await handleChat(ctx, store, req, res)
        return
      }
      case 'POST chat/clear': {
        const body = await readJson(req)
        const id = requireId(body.id)
        await store.saveChat(id, [])
        send(res, 200, { ok: true })
        return
      }
      case 'GET figure': {
        const id = requireId(url.searchParams.get('id'))
        const name = String(url.searchParams.get('name') ?? '')
        const file = store.figurePath(id, name)
        try {
          const bytes = await fs.readFile(file)
          const ext = name.split('.').pop()?.toLowerCase() ?? 'png'
          res.writeHead(200, {
            'content-type': FIGURE_MIME[ext] ?? 'application/octet-stream',
            'content-length': String(bytes.byteLength),
            'cache-control': 'private, max-age=3600',
            'x-content-type-options': 'nosniff',
          })
          res.end(bytes)
        } catch {
          send(res, 404, { error: 'figure not found' })
        }
        return
      }
      case 'GET snapshot': {
        const id = requireId(url.searchParams.get('id'))
        const name = String(url.searchParams.get('name') ?? '')
        const file = store.snapshotPath(id, name)
        try {
          const bytes = await fs.readFile(file)
          const ext = name.split('.').pop()?.toLowerCase() ?? 'jpg'
          res.writeHead(200, {
            'content-type': FIGURE_MIME[ext] ?? 'application/octet-stream',
            'content-length': String(bytes.byteLength),
            'cache-control': 'private, max-age=3600',
            'x-content-type-options': 'nosniff',
          })
          res.end(bytes)
        } catch {
          send(res, 404, { error: 'snapshot not found' })
        }
        return
      }
      case 'GET source': {
        const id = requireId(url.searchParams.get('id'))
        const paper = await store.get(id)
        const file = store.sourcePath(id)
        try {
          const bytes = await fs.readFile(file)
          res.writeHead(200, {
            'content-type': 'application/pdf',
            'content-length': String(bytes.byteLength),
            'content-disposition': 'inline; filename="paper.pdf"',
            'cache-control': 'private, max-age=3600',
            'x-content-type-options': 'nosniff',
          })
          res.end(bytes)
          return
        } catch {
          res.writeHead(302, { location: paper.sourceUrl || paper.url })
          res.end()
          return
        }
      }
      case 'POST ping': {
        const body = await readJson(req)
        clientLoadedAt = Date.now()
        clientLoadedInfo = { lang: body.lang, kind: body.kind, at: clientLoadedAt }
        send(res, 200, { ok: true, at: clientLoadedAt })
        return
      }
      case 'GET status': {
        const library = await store.list()
        send(res, 200, {
          root: store.root,
          count: library.papers.length,
          plugin: PLUGIN_ID,
          version: '0.1.0',
          model: safeModel(ctx),
          clientLoadedAt,
          clientLoadedInfo,
        })
        return
      }
      default:
        send(res, 404, { error: `unknown paper-reader action: ${req.method} ${action}` })
    }
  } catch (error) {
    const status = error instanceof LlmUnavailableError ? 503 : error instanceof ExtractError ? 400 : 500
    if (status === 500) ctx.logger?.warn?.(error instanceof Error ? error : new Error(String(error)))
    send(res, status, { error: error instanceof Error ? error.message : String(error) })
  }
}

function extensionFor(contentType, source) {
  const type = String(contentType ?? '').toLowerCase()
  if (type.includes('svg')) return 'svg'
  if (type.includes('png')) return 'png'
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpg'
  if (type.includes('gif')) return 'gif'
  if (type.includes('webp')) return 'webp'
  const match = String(source).match(/\.([a-z0-9]{2,5})(?:[?#]|$)/i)
  const ext = match?.[1]?.toLowerCase()
  return ext !== undefined && FIGURE_MIME[ext] !== undefined ? ext : 'png'
}

function decodeDataUrl(source) {
  if (!source.startsWith('data:')) return undefined
  const comma = source.indexOf(',')
  if (comma < 0) return undefined
  const meta = source.slice(5, comma)
  const payload = source.slice(comma + 1)
  try {
    return {
      bytes: /;base64/i.test(meta)
        ? Buffer.from(payload, 'base64')
        : Buffer.from(decodeURIComponent(payload), 'utf8'),
      contentType: meta.split(';')[0],
    }
  } catch {
    return undefined
  }
}

async function hydrateFigures(store, id, blocks) {
  let saved = 0
  for (const block of blocks) {
    if (saved >= FIGURE_LIMIT) break
    const source = typeof block.image === 'string' ? block.image : ''
    if (source === '') continue
    if (typeof block.src === 'string' && block.src.startsWith('/plugins/')) continue
    try {
      const decoded = decodeDataUrl(source)
      const data = decoded ?? (await fetchBinary(source))
      if (data.bytes.byteLength === 0 || data.bytes.byteLength > FIGURE_MAX_BYTES) continue
      const name = `fig-${saved + 1}.${extensionFor(data.contentType, source)}`
      block.src = await store.saveFigure(id, name, data.bytes)
      delete block.image
      saved += 1
    } catch {
      /* keep the original external URL as a fallback */
    }
  }
  if (saved > 0) await store.updateBlocks(id, blocks)
  return saved
}

function figureNumber(text) {
  const match = String(text ?? '').match(/(?:figure|fig\.|图)\s*(\d+)/i)
  return match === null ? null : Number(match[1])
}

function captionKey(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/^[^a-z一-鿿]+/i, '')
    .replace(/\s+/g, ' ')
    .slice(0, 90)
}

async function repairFigures(store, id, newBlocks) {
  const paper = await store.get(id)
  const byNumber = new Map()
  const byText = new Map()
  for (const block of newBlocks) {
    if (block.type !== 'caption' || typeof block.src !== 'string') continue
    const number = figureNumber(block.text)
    if (number !== null && !byNumber.has(number)) byNumber.set(number, block)
    const key = captionKey(block.text)
    if (key !== '' && !byText.has(key)) byText.set(key, block)
  }
  let attached = 0
  for (const block of paper.blocks ?? []) {
    if (block.type !== 'caption' || block.src !== undefined) continue
    const number = figureNumber(block.text)
    const match = (number !== null ? byNumber.get(number) : undefined) ?? byText.get(captionKey(block.text))
    if (match === undefined) continue
    block.image = match.image ?? match.src
    block.src = match.src
    if (match.alt !== undefined) block.alt = match.alt
    attached += 1
  }
  if (attached > 0) {
    await store.updateBlocks(id, paper.blocks)
    await hydrateFigures(store, id, paper.blocks)
  }
  return attached
}

function needsTitleRepair(value) {
  const title = String(value ?? '').trim()
  return (
    title === '' ||
    title.length < 4 ||
    /^(untitled|未命名|1\s*introduction|\d+\s*[a-z]*|paper|document)$/i.test(title)
  )
}

function normalizeMetadataPatch(body) {
  const patch = {}
  if (typeof body.title === 'string') {
    const title = body.title.trim().slice(0, 500)
    if (title === '') throw new Error('标题不能为空')
    patch.title = title
  }
  if (Array.isArray(body.authors)) {
    patch.authors = body.authors.map((name) => String(name ?? '').trim()).filter(Boolean).slice(0, 24)
  } else if (typeof body.authors === 'string') {
    patch.authors = body.authors
      .split(/[,;，；]|\s+and\s+/i)
      .map((name) => name.trim())
      .filter(Boolean)
      .slice(0, 24)
  }
  if (typeof body.year === 'number' && Number.isFinite(body.year)) patch.year = Math.trunc(body.year)
  if (typeof body.venue === 'string') patch.venue = body.venue.trim().slice(0, 200)
  return patch
}

function safeModel(ctx) {
  try {
    const selection = ctx.get('agentDefaultModel')?.currentSelection?.()
    return selection === undefined ? undefined : `${selection.provider}/${selection.model}`
  } catch {
    return undefined
  }
}

async function handleChat(ctx, store, req, res) {
  const body = await readJson(req)
  const id = requireId(body.id)
  const paper = await store.get(id)
  const messages = Array.isArray(body.messages) ? body.messages : []
  const lastUser = [...messages].reverse().find((message) => message.role === 'user')

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  })
  res.flushHeaders?.()

  const send = (event) => {
    if (res.writableEnded) return
    res.write(`data: ${JSON.stringify(event)}\n\n`)
  }

  const controller = new AbortController()
  const keepAlive = setInterval(() => {
    if (!res.writableEnded) res.write(': keep-alive\n\n')
  }, 12_000)
  res.on('close', () => {
    clearInterval(keepAlive)
    controller.abort()
  })

  try {
    const zh = await store.translations(id)
    const { text, model } = await streamChat(ctx, paper, messages, {
      signal: controller.signal,
      selection: typeof body.selection === 'string' ? body.selection : undefined,
      focusBlockId: typeof body.focusBlockId === 'string' ? body.focusBlockId : undefined,
      zh,
      onDelta: (delta) => send({ type: 'delta', text: delta }),
    })
    if (lastUser !== undefined && text.trim() !== '') {
      await store.saveChat(id, [...messages, { role: 'assistant', content: text, at: Date.now() }])
    }
    send({ type: 'done', model })
  } catch (error) {
    if (controller.signal.aborted !== true) {
      send({ type: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  } finally {
    clearInterval(keepAlive)
    if (!res.writableEnded) res.end()
  }
}

function abortSignal(res) {
  const controller = new AbortController()
  res.on('close', () => controller.abort())
  return controller.signal
}

function requireId(value) {
  const id = String(value ?? '').trim()
  if (!/^p-[a-z0-9]{6,20}$/.test(id)) throw new Error('无效的论文 id')
  return id
}

function clampNumber(value, fallback, min, max) {
  const parsed = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback
  return Math.min(max, Math.max(min, parsed))
}

function isTrusted(req, origin) {
  const site = req.headers['sec-fetch-site']
  if (typeof site === 'string' && site !== 'same-origin' && site !== 'none') return false
  const expected = origin()
  if (expected === undefined) return false
  const requestOrigin = req.headers.origin
  if (typeof requestOrigin === 'string' && requestOrigin !== expected) return false
  const referer = req.headers.referer
  if (typeof requestOrigin !== 'string' && typeof referer === 'string') {
    try {
      if (new URL(referer).origin !== expected) return false
    } catch {
      return false
    }
  }
  return true
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.byteLength
      if (size > MAX_BODY_BYTES) {
        reject(new Error('request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch (error) {
        reject(new Error(`invalid JSON body: ${error instanceof Error ? error.message : String(error)}`))
      }
    })
    req.on('error', reject)
  })
}

function send(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': String(Buffer.byteLength(body)),
    'x-content-type-options': 'nosniff',
  })
  res.end(body)
}
