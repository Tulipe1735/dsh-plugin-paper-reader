/**
 * Durable paper library for dsh-plugin-paper-reader.
 *
 * Layout under `$DSH_HOME/paper-reader/`:
 *   library.json            index rows (one per paper)
 *   papers/<id>/paper.json  structured blocks + metadata
 *   papers/<id>/zh.json     cached Simplified-Chinese translations
 *   papers/<id>/chat.json   chat transcript for the reader's answer rail
 *   papers/<id>/source.(pdf|html)  the fetched original (for the browser view)
 */
import { randomBytes } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const ID_RE = /^p-[a-z0-9]{6,20}$/

function siteFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}

function inferType(paper) {
  if (paper.type !== undefined && paper.type !== '') return paper.type
  if (paper.kind === 'pdf') return 'paper'
  const host = siteFromUrl(paper.url)
  if (
    /(^|\.)(arxiv\.org|aclanthology\.org|openreview\.net|ieee\.org|acm\.org|springer\.com|sciencedirect\.com|neurips\.cc|icml\.cc|iclr\.cc|papers\.nips\.cc|proceedings\.mlr\.press)$/i.test(
      host,
    )
  ) {
    return 'paper'
  }
  if (/(blog|medium\.com|substack\.com|dev\.to|hashnode|github\.io|wordpress\.com|ghost\.io)/i.test(host)) return 'blog'
  return 'article'
}

function normalizePaper(paper) {
  return {
    ...paper,
    type: inferType(paper),
    site: paper.site || siteFromUrl(paper.url),
  }
}

export function createStore(root) {
  const indexFile = path.join(root, 'library.json')
  const papersDir = path.join(root, 'papers')
  let chain = Promise.resolve()

  const serial = (fn) => {
    const run = chain.then(fn, fn)
    chain = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  const paperDir = (id) => {
    if (!ID_RE.test(id)) throw new Error(`invalid paper id "${id}"`)
    return path.join(papersDir, id)
  }

  async function readIndex() {
    try {
      const parsed = JSON.parse(await fs.readFile(indexFile, 'utf8'))
      if (parsed && Array.isArray(parsed.papers)) return parsed
    } catch {
      /* rebuild */
    }
    await fs.mkdir(papersDir, { recursive: true })
    let names = []
    try {
      names = await fs.readdir(papersDir)
    } catch {
      names = []
    }
    const papers = []
    for (const name of names) {
      if (!ID_RE.test(name)) continue
      try {
        const paper = JSON.parse(await fs.readFile(path.join(papersDir, name, 'paper.json'), 'utf8'))
        papers.push(indexRow(paper))
      } catch {
        /* ignore a broken paper */
      }
    }
    const index = { version: 1, papers }
    await writeIndex(index)
    return index
  }

  async function writeIndex(index) {
    await fs.mkdir(root, { recursive: true })
    const temp = `${indexFile}.tmp`
    await fs.writeFile(temp, JSON.stringify(index, null, 2), 'utf8')
    await fs.rename(temp, indexFile)
  }

  async function writeJson(file, value) {
    await fs.mkdir(path.dirname(file), { recursive: true })
    const temp = `${file}.tmp`
    await fs.writeFile(temp, JSON.stringify(value), 'utf8')
    await fs.rename(temp, file)
  }

  async function readJson(file, fallback) {
    try {
      return JSON.parse(await fs.readFile(file, 'utf8'))
    } catch {
      return fallback
    }
  }

  function indexRow(paper) {
    return {
      id: paper.id,
      url: paper.url,
      sourceUrl: paper.sourceUrl,
      kind: paper.kind,
      type: inferType(paper),
      site: paper.site || siteFromUrl(paper.url),
      title: paper.title,
      authors: paper.authors,
      year: paper.year,
      venue: paper.venue,
      publishedAt: paper.publishedAt,
      wordCount: paper.wordCount ?? 0,
      readingMinutes: paper.readingMinutes ?? 0,
      abstract: paper.abstract,
      addedAt: paper.addedAt,
      updatedAt: paper.updatedAt,
      pages: paper.pages ?? 0,
      blocks: paper.blocks?.length ?? 0,
      paragraphs:
        paper.blocks?.filter((b) => ['para', 'abstract', 'list', 'caption', 'quote'].includes(b.type)).length ?? 0,
      status: paper.status ?? 'ready',
      error: paper.error,
      tags: paper.tags ?? [],
      translated: paper.translated ?? 0,
      readAt: paper.readAt ?? 0,
    }
  }

  return {
    root,

    async list() {
      return serial(async () => {
        const index = await readIndex()
        return {
          papers: index.papers
            .map(normalizePaper)
            .sort((a, b) => (b.readAt || b.addedAt) - (a.readAt || a.addedAt)),
        }
      })
    },

    async get(id) {
      return serial(async () => {
        const raw = await fs.readFile(path.join(paperDir(id), 'paper.json'), 'utf8')
        return normalizePaper(JSON.parse(raw))
      })
    },

    async exists(id) {
      try {
        await fs.access(path.join(paperDir(id), 'paper.json'))
        return true
      } catch {
        return false
      }
    },

    async add(paper) {
      return serial(async () => {
        const index = await readIndex()
        let id = paper.id
        if (id === undefined) {
          do {
            id = `p-${randomBytes(5).toString('hex')}`
          } while (index.papers.some((row) => row.id === id))
        }
        const now = Date.now()
        const record = {
          ...paper,
          id,
          addedAt: paper.addedAt ?? now,
          updatedAt: now,
          status: paper.status ?? 'ready',
          tags: paper.tags ?? [],
        }
        await writeJson(path.join(paperDir(id), 'paper.json'), record)
        const row = indexRow(record)
        const at = index.papers.findIndex((item) => item.id === id)
        if (at >= 0) index.papers[at] = row
        else index.papers.push(row)
        await writeIndex(index)
        return row
      })
    },

    async updateMeta(id, patch) {
      return serial(async () => {
        const file = path.join(paperDir(id), 'paper.json')
        const paper = JSON.parse(await fs.readFile(file, 'utf8'))
        const allowed = ['title', 'authors', 'year', 'venue', 'abstract', 'tags']
        for (const key of allowed) {
          if (patch[key] !== undefined) paper[key] = patch[key]
        }
        paper.updatedAt = Date.now()
        await writeJson(file, paper)
        const index = await readIndex()
        const at = index.papers.findIndex((item) => item.id === id)
        if (at >= 0) index.papers[at] = indexRow(paper)
        await writeIndex(index)
        return indexRow(paper)
      })
    },

    async remove(id) {
      return serial(async () => {
        const index = await readIndex()
        index.papers = index.papers.filter((row) => row.id !== id)
        await writeIndex(index)
        await fs.rm(paperDir(id), { recursive: true, force: true })
        return true
      })
    },

    async markRead(id) {
      return serial(async () => {
        const index = await readIndex()
        const row = index.papers.find((item) => item.id === id)
        if (row !== undefined) {
          row.readAt = Date.now()
          await writeIndex(index)
        }
        return true
      })
    },

    async updateBlocks(id, blocks) {
      return serial(async () => {
        const file = path.join(paperDir(id), 'paper.json')
        const paper = JSON.parse(await fs.readFile(file, 'utf8'))
        paper.blocks = blocks
        paper.outline = blocks
          .filter((block) => block.type === 'heading')
          .map((block) => ({ id: block.id, text: block.text, level: block.level || 2 }))
          .slice(0, 80)
        paper.updatedAt = Date.now()
        await writeJson(file, paper)
        const index = await readIndex()
        const at = index.papers.findIndex((item) => item.id === id)
        if (at >= 0) index.papers[at] = indexRow(paper)
        await writeIndex(index)
        return indexRow(paper)
      })
    },

    async saveFigure(id, name, bytes) {
      if (!/^[a-z0-9][a-z0-9._-]{0,80}$/i.test(name)) throw new Error('invalid figure name')
      const dir = path.join(paperDir(id), 'figures')
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(path.join(dir, name), bytes)
      return `/plugins/dsh-plugin-paper-reader/api/figure?id=${id}&name=${name}`
    },

    figurePath(id, name) {
      if (!/^[a-z0-9][a-z0-9._-]{0,80}$/i.test(name)) throw new Error('invalid figure name')
      return path.join(paperDir(id), 'figures', name)
    },

    snapshotPath(id, name) {
      if (!/^[a-z0-9][a-z0-9._-]{0,80}\.(?:png|jpe?g|webp|gif|svg)$/i.test(name)) throw new Error('invalid snapshot name')
      return path.join(paperDir(id), 'snapshots', name)
    },

    async saveSource(id, ext, bytes) {
      const dir = paperDir(id)
      await fs.mkdir(dir, { recursive: true })
      const file = path.join(dir, `source.${ext}`)
      await fs.writeFile(file, bytes)
      return file
    },

    sourcePath(id) {
      return path.join(paperDir(id), 'source.pdf')
    },

    async translations(id) {
      return readJson(path.join(paperDir(id), 'zh.json'), {})
    },

    async mergeTranslations(id, entries) {
      return serial(async () => {
        const file = path.join(paperDir(id), 'zh.json')
        const current = await readJson(file, {})
        let changed = 0
        for (const [key, value] of Object.entries(entries ?? {})) {
          if (typeof value !== 'string' || value.trim() === '') continue
          if (current[key] === value) continue
          current[key] = value
          changed += 1
        }
        if (changed > 0) {
          await writeJson(file, current)
          const index = await readIndex()
          const row = index.papers.find((item) => item.id === id)
          if (row !== undefined) {
            row.translated = Object.keys(current).length
            await writeIndex(index)
          }
        }
        return { changed, translated: Object.keys(current).length, entries: current }
      })
    },

    async chat(id) {
      return readJson(path.join(paperDir(id), 'chat.json'), { messages: [] })
    },

    async saveChat(id, messages) {
      const trimmed = (Array.isArray(messages) ? messages : [])
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-80)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 24_000), at: m.at ?? Date.now() }))
      await writeJson(path.join(paperDir(id), 'chat.json'), { messages: trimmed })
      return trimmed
    },
  }
}
