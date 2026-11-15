import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractPdf, extractHtml } from '../lib/extract.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const cache = path.join(here, '..', '.tmp')
const which = process.argv[2] ?? 'pdf'

async function sample(name, url) {
  const file = path.join(cache, name)
  try {
    return await fs.readFile(file)
  } catch {
    await fs.mkdir(cache, { recursive: true })
    const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } })
    if (!response.ok) throw new Error(`download failed: ${response.status}`)
    const bytes = Buffer.from(await response.arrayBuffer())
    await fs.writeFile(file, bytes)
    return bytes
  }
}

if (which === 'pdf') {
  const bytes = await sample('attention.pdf', 'https://arxiv.org/pdf/1706.03762')
  const result = await extractPdf(bytes, { url: 'https://arxiv.org/pdf/1706.03762' })
  console.log(
    JSON.stringify(
      {
        title: result.title,
        authors: result.authors,
        year: result.year,
        pages: result.pages,
        blocks: result.blocks.length,
        abstract: result.abstract.slice(0, 160),
      },
      null,
      2,
    ),
  )
  for (const block of result.blocks.slice(0, 8)) console.log(`[${block.id}][${block.type}] ${block.text.slice(0, 120)}`)
} else {
  const bytes = await sample('attention.html', 'https://arxiv.org/html/1706.03762')
  const result = extractHtml(bytes.toString('utf8'), { url: 'https://arxiv.org/abs/1706.03762' })
  console.log(JSON.stringify({ title: result.title, authors: result.authors, year: result.year, blocks: result.blocks.length }, null, 2))
  for (const block of result.blocks.slice(0, 10)) console.log(`[${block.id}][${block.type}] ${block.text.slice(0, 120)}`)
}
