/**
 * Paper extraction: URL → structured, paragraph-level blocks.
 *
 * HTML goes through Readability (with an arXiv-specific fallback), PDF through
 * pdf.js plus a column/paragraph reconstructor. Both produce the same block
 * list so the reader and the translator never need to know the source format.
 */
import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'

const MAX_DOWNLOAD_BYTES = 48 * 1024 * 1024
const FETCH_TIMEOUT_MS = 60_000

const LIGATURES = {
  '\uFB00': 'ff',
  '\uFB01': 'fi',
  '\uFB02': 'fl',
  '\uFB03': 'ffi',
  '\uFB04': 'ffl',
  '\uFB05': 'ft',
  '\uFB06': 'st',
  '\u00AD': '',
  '\uFEFF': '',
  '\u200B': '',
}

const HEADING_WORDS =
  /^(abstract|introduction|related work|background|motivation|method|methods|methodology|approach|model|architecture|experiment|experiments|experimental setup|evaluation|results|result|analysis|ablation|ablation study|discussion|conclusion|conclusions|future work|limitations|references|bibliography|acknowledg(e)?ments?|appendix|supplementary material)\b/i

export class ExtractError extends Error {
  constructor(message, code = 'extract-failed') {
    super(message)
    this.name = 'ExtractError'
    this.code = code
  }
}

/* ------------------------------------------------------------------ */
/* Public entry                                                        */
/* ------------------------------------------------------------------ */

/** Normalize a user-supplied link into an absolute http(s) URL. */
export function normalizeUrl(input) {
  const raw = String(input ?? '').trim()
  if (raw === '') throw new ExtractError('请输入论文链接', 'bad-url')
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`
  let url
  try {
    url = new URL(withScheme)
  } catch {
    throw new ExtractError('链接格式不正确', 'bad-url')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ExtractError('只支持 http/https 链接', 'bad-url')
  }
  return url.toString()
}

/**
 * Fetch one paper URL and extract it.
 * @param {string} input
 * @param {(msg: string) => void} [log]
 */
export async function extractPaper(input, log = () => {}) {
  const url = normalizeUrl(input)
  assertPublicUrl(url)
  const arxiv = arxivId(url)
  const candidates = []
  if (arxiv !== undefined) {
    candidates.push({ url: `https://arxiv.org/html/${arxiv}`, kind: 'html' })
    candidates.push({ url: `https://ar5iv.labs.arxiv.org/html/${arxiv}`, kind: 'html' })
    candidates.push({ url: `https://arxiv.org/pdf/${arxiv}`, kind: 'pdf' })
  } else {
    candidates.push({ url, kind: /\.pdf(?:$|[?#])/i.test(url) ? 'pdf' : 'auto' })
  }

  const finish = async (result, resource, extra = {}) => {
    const merged = await mergeArxivMeta(result, arxiv)
    return { ...merged, url, sourceUrl: resource.finalUrl, ...extra }
  }

  const failures = []
  for (const candidate of candidates) {
    try {
      log(`fetching ${candidate.url}`)
      const resource = await fetchResource(candidate.url)
      const kind = detectKind(resource, candidate.kind)
      if (kind === 'pdf') {
        const result = await extractPdf(resource.bytes, { url: resource.finalUrl })
        if (result.blocks.length >= 4) {
          return await finish(result, resource, { sourceBytes: resource.bytes })
        }
        failures.push(`${candidate.url}: PDF 中没有可用文字（可能是扫描件）`)
        continue
      }
      const result = extractHtml(resource.text, { url: resource.finalUrl })
      if (result.blocks.length >= 3) return await finish(result, resource)
      failures.push(`${candidate.url}: 页面正文过短`)
    } catch (error) {
      failures.push(`${candidate.url}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (arxiv !== undefined) {
    // A direct PDF URL may still work when the HTML mirrors do not.
    try {
      const resource = await fetchResource(url)
      if (detectKind(resource, 'auto') === 'pdf') {
        const result = await extractPdf(resource.bytes, { url: resource.finalUrl })
        if (result.blocks.length >= 4) {
          return await finish(result, resource, { sourceBytes: resource.bytes })
        }
      } else {
        const result = extractHtml(resource.text, { url: resource.finalUrl })
        if (result.blocks.length >= 3) return await finish(result, resource)
      }
    } catch (error) {
      failures.push(`${url}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  throw new ExtractError(
    `无法从该链接提取论文正文。${failures.slice(-2).join('；') || ''}`,
    'extract-failed',
  )
}

export function arxivId(url) {
  try {
    const parsed = new URL(url)
    if (!/(^|\.)arxiv\.org$/i.test(parsed.hostname)) return undefined
    const match = parsed.pathname.match(/^\/(?:abs|pdf|html)\/(.+?)(?:\.pdf)?\/?$/i)
    if (match === null) return undefined
    return match[1].replace(/v\d+$/i, (v) => v)
  } catch {
    return undefined
  }
}

/** The abs page carries authoritative title/author/abstract metadata. */
async function fetchArxivMeta(id) {
  const resource = await fetchResource(`https://arxiv.org/abs/${id}`)
  const { document } = parseHTML(resource.text)
  const pick = (name) => {
    const element = document.querySelector(`meta[name="${name}"]`)
    return (element?.getAttribute('content') ?? '').trim()
  }
  const authors = []
  for (const element of document.querySelectorAll('meta[name="citation_author"]')) {
    const value = (element.getAttribute('content') ?? '').trim()
    if (value === '') continue
    const name = value.includes(',') ? value.split(',').map((part) => part.trim()).reverse().join(' ') : value
    if (!authors.includes(name)) authors.push(name)
  }
  const date = pick('citation_date') || pick('citation_publication_date')
  const yearMatch = date.match(/(19|20)\d{2}/)
  return {
    title: cleanText(pick('citation_title')),
    authors: authors.slice(0, 24),
    year: yearMatch === null ? undefined : Number(yearMatch[0]),
    venue: cleanText(pick('citation_journal_title') || pick('citation_conference_title')),
    abstract: clip(cleanText(pick('citation_abstract')), 4000),
  }
}

async function mergeArxivMeta(result, arxiv) {
  if (arxiv === undefined) return result
  try {
    const meta = await fetchArxivMeta(arxiv)
    return {
      ...result,
      title: meta.title || result.title,
      authors: meta.authors.length > 0 ? meta.authors : result.authors,
      year: meta.year ?? result.year,
      venue: result.venue || meta.venue,
      abstract: meta.abstract.length > 40 ? meta.abstract : result.abstract,
    }
  } catch {
    return result
  }
}

/* ------------------------------------------------------------------ */
/* Fetching                                                            */
/* ------------------------------------------------------------------ */

function isPrivateHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host === '0.0.0.0' || host === '::1') return true
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return true
  const m = host.match(/^172\.(\d{1,3})\./)
  if (m !== null && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true
  if (/^fc[0-9a-f]{2}:/i.test(host) || /^fd[0-9a-f]{2}:/i.test(host) || /^fe80:/i.test(host)) return true
  return false
}

/** Fetch a binary resource (figures) through the same SSRF/size guards. */
export async function fetchBinary(url) {
  const resource = await fetchResource(url)
  return { bytes: resource.bytes, contentType: resource.contentType, finalUrl: resource.finalUrl }
}

export function assertPublicUrl(url) {
  const parsed = new URL(url)
  if (isPrivateHost(parsed.hostname)) {
    throw new ExtractError('出于安全考虑，不能读取本机 / 内网地址', 'bad-url')
  }
}

async function fetchResource(url) {
  assertPublicUrl(url)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 dsh-paper-reader',
        accept: 'application/pdf,text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8',
      },
    })
    if (!response.ok) throw new ExtractError(`HTTP ${response.status}`, 'fetch-failed')
    const finalUrl = response.url || url
    assertPublicUrl(finalUrl)
    const declared = Number(response.headers.get('content-length') ?? 0)
    if (declared > MAX_DOWNLOAD_BYTES) throw new ExtractError('文件过大（超过 48 MB）', 'too-large')
    const chunks = []
    let total = 0
    if (response.body !== null) {
      for await (const chunk of response.body) {
        total += chunk.byteLength
        if (total > MAX_DOWNLOAD_BYTES) throw new ExtractError('文件过大（超过 48 MB）', 'too-large')
        chunks.push(Buffer.from(chunk))
      }
    }
    const bytes = Buffer.concat(chunks)
    const contentType = (response.headers.get('content-type') ?? '').toLowerCase()
    const charset = (contentType.match(/charset=([^;]+)/) ?? [])[1]
    return {
      bytes,
      contentType,
      charset,
      finalUrl,
      text: decodeText(bytes, charset),
    }
  } finally {
    clearTimeout(timer)
  }
}

function decodeText(bytes, charset) {
  const label = (charset ?? 'utf-8').trim().toLowerCase()
  try {
    return new TextDecoder(label).decode(bytes)
  } catch {
    return new TextDecoder('utf-8').decode(bytes)
  }
}

function detectKind(resource, hint) {
  const type = resource.contentType
  const head = resource.bytes.subarray(0, 5).toString('latin1')
  if (type.includes('application/pdf') || head === '%PDF-' || head.startsWith('%PDF')) return 'pdf'
  if (hint === 'pdf') return 'pdf'
  return 'html'
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

function cleanText(value) {
  let text = String(value ?? '')
  for (const [from, to] of Object.entries(LIGATURES)) text = text.split(from).join(to)
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\u00A0]+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/ +\$/g, '')
    .replace(/ {2,}/g, ' ')
    .trim()
}

function clip(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function makeBlockFactory() {
  let seq = 0
  return (type, text, extra = {}) => {
    seq += 1
    return {
      id: `b${seq}`,
      type,
      text,
      page: extra.page ?? 1,
      level: extra.level ?? 0,
      section: extra.section ?? '',
      ...(extra.caption === true ? { caption: true } : {}),
      ...(typeof extra.image === 'string' && extra.image !== '' ? { image: extra.image, src: extra.image } : {}),
      ...(typeof extra.alt === 'string' && extra.alt !== '' ? { alt: extra.alt } : {}),
      ...(typeof extra.lang === 'string' && extra.lang !== '' ? { lang: extra.lang } : {}),
      ...(extra.ordered === true ? { ordered: true } : {}),
      ...(typeof extra.index === 'number' && extra.index > 0 ? { index: extra.index } : {}),
    }
  }
}

function outlineOf(blocks) {
  return blocks
    .filter((block) => block.type === 'heading')
    .map((block) => ({ id: block.id, text: block.text, level: block.level || 2 }))
    .slice(0, 80)
}

/* ------------------------------------------------------------------ */
/* HTML                                                               */
/* ------------------------------------------------------------------ */

export function extractHtml(html, { url }) {
  const { document } = parseHTML(html)
  const meta = htmlMeta(document, url)
  const front = guessHtmlFrontMatter(document)
  const figureMap = htmlFigures(document, url)
  const academic = isAcademicUrl(url) || meta.hasCitation

  // Readability wants a document-like object with documentElement.
  let article = null
  try {
    const clone = parseHTML(html).document
    const reader = new Readability(clone, { charThreshold: 200, keepClasses: false })
    article = reader.parse()
  } catch {
    article = null
  }

  let root = null
  let title = cleanText(article?.title ?? '')
  if (article !== null && typeof article.content === 'string' && article.content.length > 500) {
    const parsed = parseHTML(`<div id="__article__">${article.content}</div>`)
    root = parsed.document.getElementById('__article__')
  }
  if (root === null) {
    root =
      document.querySelector('article') ??
      document.querySelector('.ltx_page_content') ??
      document.querySelector('main') ??
      document.querySelector('#content') ??
      document.body
    if (title === '') {
      const h1 = document.querySelector('h1')
      title = h1 !== null ? cleanText(h1.textContent) : cleanText(document.title)
    }
  }
  if (root === null) throw new ExtractError('页面中没有可读正文', 'extract-failed')
  if (!plausibleTitle(title)) title = meta.title
  if (!plausibleTitle(title)) title = front.title
  if (!plausibleTitle(title)) title = cleanText(document.title)

  const authors = [...meta.authors]
  if (authors.length === 0 && typeof article?.byline === 'string') {
    for (const part of article.byline.split(/\s*(?:,|and|&)\s*/)) {
      const name = cleanText(part).replace(/^by\s+/i, '')
      if (name.length > 1 && name.length < 80 && !authors.includes(name)) authors.push(name)
    }
  }
  if (authors.length === 0) authors.push(...front.authors)

  wrapInlineImages(root, url)

  for (const node of root.querySelectorAll(
    'script,style,noscript,iframe,form,button,input,select,textarea,header,footer,nav,aside,.ltx_page_header,.ltx_page_footer,.ltx_bibliography',
  )) {
    node.remove()
  }
  for (const svg of root.querySelectorAll('svg')) {
    if (svg.closest('figure') === null) svg.remove()
  }

  const makeBlock = makeBlockFactory()
  const blocks = []
  const seen = new Set()
  const selector = 'h1,h2,h3,h4,h5,h6,p,li,figure,blockquote,pre'
  const nodes = [...root.querySelectorAll(selector)]
  let section = ''
  let inAbstract = false
  let inReferences = false
  const abstractParts = []
  const titleKey = title.toLowerCase()

  for (const node of nodes) {
    if (isNestedBlock(node)) continue
    const tag = node.tagName.toLowerCase()

    if (tag === 'pre') {
      const code = String(node.textContent ?? '')
        .replace(/\r\n?/g, '\n')
        .replace(/^\n+|\n+$/g, '')
      if (code.trim() === '') continue
      const codeElement = node.querySelector('code')
      const className = String(codeElement?.getAttribute('class') ?? node.getAttribute('class') ?? '')
      const language = className.match(/(?:language|lang)-([\w+#.-]+)/i)?.[1] ?? ''
      blocks.push(makeBlock('code', code, { section, lang: language }))
      continue
    }

    if (tag === 'figure') {
      if (inReferences) continue
      const captionElement = node.querySelector('figcaption')
      const caption = captionElement !== null ? cleanText(captionElement.textContent) : ''
      const media = node.querySelector('img[src], object[data]')
      const alt = cleanText(media?.getAttribute('alt') ?? '')
      let image = ''
      const raw = media?.getAttribute('src') ?? media?.getAttribute('data') ?? ''
      if (raw.startsWith('data:') || /^https?:/i.test(raw)) {
        image = raw
      } else if (raw !== '') {
        try {
          image = new URL(raw, url).href
        } catch {
          image = ''
        }
      }
      if (image === '') {
        const svg = node.querySelector('svg')
        if (svg !== null) image = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.outerHTML)}`
      }
      if (caption === '' && image === '') continue
      const text = caption || alt
      if (text !== '' && seen.has(text)) continue
      if (text !== '') seen.add(text)
      blocks.push(makeBlock(caption !== '' ? 'caption' : 'image', text, { section, image, alt }))
      continue
    }

    let text = cleanText(node.textContent)
    if (text.length < 2) continue
    if (text.length > 6000) text = clip(text, 6000)
    if (tag === 'p' && text.length < 18 && !/[.。!?]$/.test(text)) continue
    if (seen.has(text)) continue

    const bold = tag === 'p' ? node.querySelector('strong, b') : null
    const boldHeading =
      bold !== null &&
      text.length <= 120 &&
      !/[.。!?]$/.test(text) &&
      cleanText(bold.textContent) === text
    if (tag.startsWith('h') || isHeadingText(text, tag) || boldHeading) {
      const level = tag.startsWith('h') ? Number(tag[1]) || 2 : 3
      if (titleKey !== '' && text.toLowerCase() === titleKey && blocks.length === 0) continue
      if (inReferences) {
        if (/^(appendix|appendices|a\s+)/i.test(text)) inReferences = false
        else continue
      }
      seen.add(text)
      section = text
      inAbstract = /^abstract\b/i.test(text)
      if (/^(references|bibliography)\b/i.test(text)) inReferences = true
      blocks.push(makeBlock('heading', text, { level }))
      continue
    }

    if (inReferences) continue
    seen.add(text)

    if (/^(abstract|摘要)\b/i.test(text) && text.length < 80) {
      inAbstract = true
      section = 'Abstract'
      continue
    }
    if (inAbstract && /^(introduction|1\.?\s+introduction)\b/i.test(text)) inAbstract = false

    const type = inAbstract ? 'abstract' : tag === 'li' ? 'list' : tag === 'blockquote' ? 'quote' : 'para'
    if (type === 'abstract') abstractParts.push(text)
    let ordered = false
    let index = 0
    if (type === 'list') {
      const parent = node.parentElement
      ordered = parent?.tagName === 'OL'
      index = ordered ? [...(parent?.children ?? [])].filter((child) => child.tagName === 'LI').indexOf(node) + 1 : 0
    }
    blocks.push(makeBlock(type, text, { section, ordered, index }))
  }

  if (blocks.length === 0) {
    const plain = cleanText(root.textContent ?? '').split(/(?<=[.!?])\s+(?=[A-Z])/)
    for (const part of plain) {
      if (part.length > 80) blocks.push(makeBlock('para', part, { section: '' }))
    }
  }
  if (blocks.length === 0) throw new ExtractError('页面中没有可读正文', 'extract-failed')

  if (academic) stripFrontMatter(blocks)

  // Readability can drop <figure> hosts; recover images from the full document.
  for (const block of blocks) {
    if (block.type !== 'caption' || typeof block.src === 'string') continue
    const number = figureNumber(block.text)
    const figure = (number !== null ? figureMap.byNumber.get(number) : undefined) ?? figureMap.byText.get(captionKey(block.text))
    if (figure === undefined) continue
    block.image = figure.url
    block.src = figure.url
    if (figure.alt !== '') block.alt = figure.alt
  }

  const abstract =
    meta.abstract !== ''
      ? meta.abstract
      : clip(cleanText(article?.excerpt ?? ''), 4000) ||
        clip(cleanText(abstractParts.join(' ')), 4000) ||
        clip(
          blocks
            .filter((block) => block.type === 'abstract')
            .slice(0, 4)
            .map((block) => block.text)
            .join(' '),
          4000,
        )

  // Drop a standalone publish-date line ("31st December 2024") that Readability
  // often leaves as the first paragraph.
  const dateOnly = /^(?:\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})$/i
  for (let index = 0; index < Math.min(3, blocks.length); index += 1) {
    if (blocks[index].type === 'para' && dateOnly.test(blocks[index].text.trim())) {
      blocks.splice(index, 1)
      break
    }
  }

  ensureAbstractBlock(blocks, abstract)

  const type = classifyContent(url, meta, academic)
  const site = meta.siteName || siteOf(url)
  const wordCount = countWords(
    blocks
      .filter((block) => block.type !== 'code' && block.type !== 'image')
      .map((block) => block.text)
      .join(' '),
  )
  const publishedAt = meta.publishedAt || normalizeDate(article?.publishedTime) || dateFromUrl(url)
  const year = meta.year ?? yearFromDate(publishedAt)

  return {
    kind: 'html',
    type,
    site,
    title: title || '未命名文章',
    authors: authors.slice(0, 24),
    year,
    venue: meta.venue,
    publishedAt,
    abstract,
    blocks,
    pages: 0,
    wordCount,
    readingMinutes: Math.max(1, Math.round(wordCount / 220)),
    outline: outlineOf(blocks),
  }
}

function wrapInlineImages(root, pageUrl) {
  const images = [...root.querySelectorAll('img')]
  for (const image of images) {
    if (image.closest('figure') !== null) continue
    if (image.closest('header,footer,nav,aside') !== null) continue
    const raw =
      image.getAttribute('src') ??
      image.getAttribute('data-src') ??
      image.getAttribute('data-lazy-src') ??
      image.getAttribute('data-original') ??
      ''
    const alt = cleanText(image.getAttribute('alt') ?? '')
    const width = Number(image.getAttribute('width') ?? 0)
    const height = Number(image.getAttribute('height') ?? 0)
    if (raw === '') continue
    if (/^data:image\/(?:gif|svg\+xml);/i.test(raw) && raw.length < 200) continue
    if ((width > 0 && width <= 48) || (height > 0 && height <= 48)) continue
    if (/logo|avatar|icon|sprite|tracking|pixel/i.test(`${raw} ${alt}`) && (width <= 120 || alt === '')) continue
    let src = raw
    if (!/^https?:/i.test(src) && !src.startsWith('data:')) {
      try {
        src = new URL(src, pageUrl).href
      } catch {
        continue
      }
    }
    image.setAttribute('src', src)
    const figure = root.ownerDocument.createElement('figure')
    figure.setAttribute('class', 'pr-inline-image')
    const blockParent = image.closest('p,li,blockquote')
    const anchor = blockParent !== null && blockParent.parentNode !== null ? blockParent : image
    if (anchor.parentNode === null) continue
    anchor.parentNode.insertBefore(figure, anchor)
    figure.appendChild(image)
  }
}

function dateFromUrl(url) {
  try {
    const path = new URL(url).pathname
    let match = path.match(/\/(20\d{2})\/(\d{1,2})\/(\d{1,2})(?:\/|$)/)
    if (match !== null) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
    match = path.match(/\/(20\d{2})\/([a-z]{3,9})\/(\d{1,2})(?:\/|$)/i)
    if (match !== null) {
      const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }
      const month = months[match[2].slice(0, 3).toLowerCase()]
      if (month !== undefined) return `${match[1]}-${String(month).padStart(2, '0')}-${match[3].padStart(2, '0')}`
    }
  } catch {
    /* ignore */
  }
  return undefined
}

function isAcademicUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, '')
    if (/(^|\.)(arxiv\.org|aclanthology\.org|openreview\.net|ieee\.org|acm\.org|springer\.com|sciencedirect\.com|neurips\.cc|icml\.cc|iclr\.cc|papers\.nips\.cc|proceedings\.mlr\.press)$/i.test(host)) return true
    return /\.pdf(?:$|[?#])/i.test(url)
  } catch {
    return false
  }
}

function classifyContent(url, meta, academic) {
  if (academic) return 'paper'
  const host = siteOf(url)
  if (
    /(medium\.com|substack\.com|dev\.to|hashnode|wordpress\.com|ghost\.io|github\.io|blogspot|bearblog|micro\.blog|simonwillison\.net|joelonsoftware\.com|overreacted\.io|martinfowler\.com|jvns\.ca|danluu\.com|paulgraham\.com)/i.test(
      host,
    ) ||
    /blog/i.test(meta.siteName) ||
    meta.jsonLdType === 'BlogPosting'
  ) {
    return 'blog'
  }
  return 'article'
}

function siteOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}

function countWords(text) {
  const cjk = (String(text).match(/[\u4e00-\u9fff]/g) ?? []).length
  const latin = (String(text).replace(/[\u4e00-\u9fff]/g, ' ').match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) ?? []).length
  return latin + Math.round(cjk / 2)
}

function normalizeDate(value) {
  if (typeof value !== 'string' || value.trim() === '') return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString().slice(0, 10)
}

function yearFromDate(value) {
  if (typeof value !== 'string') return undefined
  const match = value.match(/(19|20)\d{2}/)
  return match === null ? undefined : Number(match[0])
}

function isNestedBlock(node) {
  let parent = node.parentElement
  while (parent !== null) {
    if (/^(P|LI|BLOCKQUOTE|FIGCAPTION|PRE|FIGURE)$/.test(parent.tagName ?? '')) return true
    parent = parent.parentElement
  }
  return false
}

function isHeadingText(text, tag) {
  if (tag !== 'div' && tag !== 'span') return false
  if (text.length > 110) return false
  return HEADING_WORDS.test(text) || /^\d+(\.\d+){0,2}\.?\s+[A-Z]/.test(text)
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

function htmlFigures(document, url) {
  const byNumber = new Map()
  const byText = new Map()
  for (const figure of document.querySelectorAll('figure')) {
    const caption = cleanText(figure.querySelector('figcaption')?.textContent ?? '')
    const img = figure.querySelector('img[src]')
    const object = figure.querySelector('object[data]')
    const raw = img?.getAttribute('src') ?? object?.getAttribute('data') ?? ''
    let source = ''
    if (/^https?:/i.test(raw)) {
      source = raw
    } else if (raw !== '') {
      try {
        source = new URL(raw, url).href
      } catch {
        source = ''
      }
    }
    if (source === '') {
      const svg = figure.querySelector('svg')
      if (svg !== null) source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.outerHTML)}`
    }
    if (source === '') continue
    const entry = { url: source, alt: cleanText(img?.getAttribute('alt') ?? ''), caption }
    const number = figureNumber(caption)
    if (number !== null && !byNumber.has(number)) byNumber.set(number, entry)
    const key = captionKey(caption)
    if (key !== '' && !byText.has(key)) byText.set(key, entry)
  }
  return { byNumber, byText }
}

function plausibleTitle(value) {
  const text = cleanText(value)
  if (text.length < 8) return false
  if (/^\d+\s*[A-Za-z]?[a-z]*$/.test(text)) return false
  if (/^(introduction|abstract|contents|references|untitled|未命名)$/i.test(text)) return false
  if (/^skip to/i.test(text)) return false
  return true
}

/**
 * arXiv's newer HTML has no h1 / citation meta on the page itself, but the
 * front matter is still centred and typeset in larger faces. Recover it.
 */
function guessHtmlFrontMatter(document) {
  const nodes = [...document.querySelectorAll('p, h1, h2, span')].slice(0, 160)
  let title = ''
  const authors = []
  for (const node of nodes) {
    const style = node.getAttribute('style') ?? ''
    const size = Number((style.match(/font-size:\s*([\d.]+)%/) ?? [])[1] ?? 0)
    const className = String(node.getAttribute('class') ?? '')
    const centered = /text-align:\s*center/.test(style) || className.includes('ltx_align_center')
    if (!centered && size === 0) continue
    const text = cleanText(node.textContent ?? '')
    if (text.length < 8 || text.length > 320) continue
    if (size >= 150 && title === '') {
      title = text
      continue
    }
    if (title !== '' && size >= 105 && size < 150 && authors.length < 12 && text.length < 140) {
      if (/@|university|institute|department|research|school|college|laborator|technical report/i.test(text)) continue
      if (!authors.includes(text)) authors.push(text)
    }
  }
  return { title, authors }
}

function htmlMeta(document, url) {
  const pick = (...names) => {
    for (const name of names) {
      const element =
        document.querySelector(`meta[name="${name}"]`) ?? document.querySelector(`meta[property="${name}"]`)
      const value = element?.getAttribute('content')?.trim()
      if (typeof value === 'string' && value !== '') return value
    }
    return ''
  }
  const json = readJsonLd(document)
  const title = cleanText(
    pick('citation_title', 'dc.title', 'og:title', 'twitter:title') ||
      json.title ||
      document.querySelector('h1')?.textContent ||
      document.title,
  )
  const authors = []
  for (const element of document.querySelectorAll('meta[name="citation_author"], meta[name="dc.creator"], meta[name="author"]')) {
    const name = cleanText(element.getAttribute('content') ?? '')
    if (name !== '' && !authors.includes(name)) authors.push(name)
  }
  if (authors.length === 0) {
    for (const element of document.querySelectorAll(
      '.ltx_personname, .author-name, [rel="author"], .byline, .post-author, [itemprop="author"] [itemprop="name"]',
    )) {
      const copy = element.cloneNode(true)
      for (const note of copy.querySelectorAll('.ltx_note, .ltx_role_footnotemark')) note.remove()
      const name = cleanText(copy.textContent ?? '')
        .replace(/^by\s+/i, '')
        .replace(/\s*\d+$/, '')
      if (name !== '' && name.length < 80 && !authors.includes(name)) authors.push(name)
    }
  }
  for (const name of json.authors ?? []) {
    if (name !== '' && name.length < 80 && !authors.includes(name)) authors.push(name)
  }
  const date =
    pick(
      'citation_publication_date',
      'citation_date',
      'dc.date',
      'article:published_time',
      'article:modified_time',
      'datePublished',
      'date',
      'publish-date',
      'pubdate',
      'parsely-pub-date',
      'sailthru.date',
    ) ||
    document.querySelector('time[datetime]')?.getAttribute('datetime') ||
    document.querySelector('[itemprop="datePublished"]')?.getAttribute('content') ||
    json.date ||
    ''
  const yearMatch = String(date).match(/(19|20)\d{2}/)
  const venue = cleanText(pick('citation_journal_title', 'citation_conference_title'))
  const abstract = cleanText(
    pick('citation_abstract', 'dc.description', 'og:description', 'description') || json.description,
  )
  const siteName = cleanText(pick('og:site_name', 'application-name') || json.publisher || '')
  return {
    title,
    authors: authors.slice(0, 24),
    year: yearMatch !== null ? Number(yearMatch[0]) : undefined,
    venue,
    abstract: clip(abstract, 4000),
    url,
    publishedAt: normalizeDate(date),
    siteName,
    jsonLdType: json.type,
    hasCitation: pick('citation_title') !== '',
  }
}

function readJsonLd(document) {
  const result = { authors: [] }
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    let data
    try {
      data = JSON.parse(script.textContent ?? '')
    } catch {
      continue
    }
    const nodes = Array.isArray(data) ? data : data?.['@graph'] !== undefined ? data['@graph'] : [data]
    for (const node of nodes) {
      if (node === null || typeof node !== 'object') continue
      const type = String(node['@type'] ?? '')
      if (!/Article|BlogPosting|NewsArticle|Report|WebPage/i.test(type) && result.title !== undefined) continue
      if (result.title === undefined && typeof node.headline === 'string' && node.headline !== '') result.title = node.headline
      if (result.date === undefined && typeof node.datePublished === 'string' && node.datePublished !== '') result.date = node.datePublished
      if (result.description === undefined && typeof node.description === 'string' && node.description !== '') {
        result.description = node.description
      }
      if (result.type === undefined && type !== '') result.type = type
      if (result.publisher === undefined && node.publisher !== undefined) {
        const publisher = typeof node.publisher === 'string' ? node.publisher : node.publisher?.name
        if (typeof publisher === 'string' && publisher !== '') result.publisher = publisher
      }
      const authors = Array.isArray(node.author) ? node.author : node.author !== undefined ? [node.author] : []
      for (const author of authors) {
        const name = typeof author === 'string' ? author : author?.name
        if (typeof name === 'string' && name.trim() !== '' && !result.authors.includes(name.trim())) {
          result.authors.push(name.trim())
        }
      }
    }
  }
  return result
}

/* PDF                                                                */
/* ------------------------------------------------------------------ */

export async function extractPdf(bytes, { url }) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  // pdf.js transfers (detaches) the input buffer; copy it so the caller can
  // still persist the original PDF for the browser viewer.
  const data = new Uint8Array(bytes.byteLength)
  data.set(bytes)
  const doc = await getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true,
    verbosity: 0,
  }).promise

  let info = {}
  try {
    const metadata = await doc.getMetadata()
    info = metadata?.info ?? {}
  } catch {
    info = {}
  }

  const pages = []
  for (let number = 1; number <= doc.numPages; number += 1) {
    const page = await doc.getPage(number)
    const viewport = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()
    const items = []
    for (const item of content.items) {
      if (typeof item.str !== 'string') continue
      const str = cleanText(item.str)
      if (str === '') continue
      const transform = item.transform ?? [1, 0, 0, 1, 0, 0]
      const size = Math.max(1, Math.hypot(transform[0] ?? 0, transform[1] ?? 0), Math.abs(transform[3] ?? 0))
      items.push({
        str,
        x: transform[4] ?? 0,
        y: transform[5] ?? 0,
        w: Number.isFinite(item.width) ? item.width : str.length * size * 0.5,
        size,
      })
    }
    pages.push({ number, width: viewport.width, height: viewport.height, items })
    page.cleanup()
  }

  // Body font size = weighted median of every character-bearing item.
  const sizes = pages.flatMap((page) => page.items.map((item) => Math.round(item.size * 2) / 2))
  const bodySize = median(sizes) || 10

  const orderedLines = []
  for (const page of pages) {
    const lines = pageLines(page, bodySize)
    for (const line of lines) orderedLines.push({ ...line, page: page.number })
  }

  const { title: guessedTitle, authors: guessedAuthors } = guessFrontMatter(pages, bodySize)
  const metaTitle = cleanText(info.Title ?? '')
  const metaAuthor = cleanText(info.Author ?? '')
  const title =
    metaTitle !== '' && !/^(untitled|microsoft word|powerpoint|document\d*)$/i.test(metaTitle)
      ? metaTitle
      : guessedTitle || '未命名论文'
  const authors =
    metaAuthor !== ''
      ? metaAuthor.split(/[;,]\s*|\s+and\s+/).map(cleanText).filter(Boolean).slice(0, 24)
      : guessedAuthors

  const blocks = stripFrontMatter(linesToBlocks(orderedLines, bodySize))
  const abstract =
    clip(
      blocks
        .filter((block) => block.type === 'abstract')
        .map((block) => block.text)
        .join(' '),
      4000,
    ) || clip(cleanText(info.Subject ?? ''), 4000)

  ensureAbstractBlock(blocks, abstract)
  const pdfWords = countWords(blocks.filter((block) => block.type !== 'code').map((block) => block.text).join(' '))

  return {
    kind: 'pdf',
    type: 'paper',
    site: siteOf(url),
    title,
    authors,
    year: yearFromPdfItems(pages[0]?.items ?? []),
    venue: cleanText(info.Subject ?? '') && cleanText(info.Subject).length < 80 ? cleanText(info.Subject) : '',
    abstract,
    wordCount: pdfWords,
    readingMinutes: Math.max(1, Math.round(pdfWords / 220)),
    blocks,
    pages: doc.numPages,
    outline: outlineOf(blocks),
  }
}

function median(values) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

/**
 * Detect whether a page is two-column and return visual lines in reading order.
 */
function pageLines(page, bodySize) {
  const { width, items } = page
  if (items.length === 0) return []

  // Group text runs into visual lines. Items from two columns can share a
  // baseline, so a horizontal jump starts a new line instead of merging them.
  const lines = groupItems(items, bodySize, page)
    .filter((line) => line.text !== '' && keepLine(line, page, bodySize))
    .map((line) => ({ ...line, pageHeight: page.height }))
  if (lines.length === 0) return []

  const ordered = orderLines(lines, width, bodySize)
  return ordered.map((line) => ({
    ...line,
    columnLeft: line.colLeft ?? line.x,
    columnRight: line.colRight ?? line.x + line.width,
  }))
}

/**
 * XY-cut layout analysis: split the page into horizontal bands at large
 * vertical whitespace, then each band into columns at the gutter, and read
 * bands top-down / columns left-right.
 */
function orderLines(lines, pageWidth, bodySize) {
  const sorted = [...lines].sort((a, b) => b.y - a.y || a.x - b.x)
  const gaps = []
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]
    const current = sorted[index]
    if (!overlapsHorizontally(previous, current)) continue
    const gap = previous.y - current.y
    if (gap > 0 && gap < bodySize * 3.2) gaps.push(gap)
  }
  const normal = median(gaps) || bodySize * 1.35
  const bandGap = Math.max(normal * 2.1, bodySize * 2.2, 22)

  const bands = []
  let band = [sorted[0]]
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]
    const current = sorted[index]
    if (previous.y - current.y > bandGap) {
      bands.push(band)
      band = [current]
    } else {
      band.push(current)
    }
  }
  if (band.length > 0) bands.push(band)

  const result = []
  for (const currentBand of bands) {
    result.push(...orderBand(currentBand, pageWidth, bodySize))
  }
  return result
}

function orderBand(band, pageWidth, bodySize) {
  const sorted = [...band].sort((a, b) => b.y - a.y || a.x - b.x)
  const wide = new Set(
    sorted
      .filter((line) => line.width > pageWidth * 0.55 && line.x < pageWidth * 0.3)
      .map((line) => line),
  )
  if (wide.size === 0) return orderColumns(sorted, pageWidth, bodySize)

  const output = []
  let segment = []
  for (const line of sorted) {
    if (wide.has(line)) {
      if (segment.length > 0) {
        output.push(...orderColumns(segment, pageWidth, bodySize))
        segment = []
      }
      line.colLeft = line.x
      line.colRight = line.x + line.width
      output.push(line)
    } else {
      segment.push(line)
    }
  }
  if (segment.length > 0) output.push(...orderColumns(segment, pageWidth, bodySize))
  return output
}

function orderColumns(band, pageWidth, bodySize) {
  if (band.length <= 1) {
    const line = band[0]
    line.colLeft = line.x
    line.colRight = line.x + line.width
    return band
  }
  const sorted = [...band].sort((a, b) => a.x - b.x)
  const gapMin = Math.max(bodySize * 0.9, pageWidth * 0.012, 6)
  const groups = []
  let group = [sorted[0]]
  let right = sorted[0].x + sorted[0].width
  for (let index = 1; index < sorted.length; index += 1) {
    const line = sorted[index]
    if (line.x - right > gapMin) {
      groups.push(group)
      group = [line]
      right = line.x + line.width
    } else {
      group.push(line)
      right = Math.max(right, line.x + line.width)
    }
  }
  groups.push(group)

  // A one-line "column" is usually a stray (page number, margin note); merging
  // it into the band keeps the reading order stable.
  if (groups.length > 1 && groups.some((items) => items.length < 2)) {
    const colLeft = Math.min(...sorted.map((line) => line.x))
    const colRight = Math.max(...sorted.map((line) => line.x + line.width))
    for (const line of sorted) {
      line.colLeft = colLeft
      line.colRight = colRight
    }
    return sorted.sort((a, b) => b.y - a.y || a.x - b.x)
  }

  const output = []
  for (const items of groups) {
    const colLeft = Math.min(...items.map((line) => line.x))
    const colRight = Math.max(...items.map((line) => line.x + line.width))
    for (const line of items) {
      line.colLeft = colLeft
      line.colRight = colRight
    }
    output.push(...items.sort((a, b) => b.y - a.y || a.x - b.x))
  }
  return output
}

function overlapsHorizontally(left, right) {
  return left.x < right.x + right.width && right.x < left.x + left.width
}

function keepLine(line, page, bodySize) {
  const text = line.text.trim()
  if (text === '') return false
  if (/^\d{1,3}$/.test(text)) return false
  if (/^arxiv:\S+/i.test(text)) return false
  if (/^page\s+\d+(\s+of\s+\d+)?$/i.test(text)) return false
  if (/^https?:\/\/\S+$/i.test(text)) return false
  const nearTop = line.y > page.height * 0.93
  const nearBottom = line.y < page.height * 0.075
  if ((nearTop || nearBottom) && text.length < 140) {
    if (/^(preprint|under review|published|proceedings|conference|workshop|copyright|©|all rights reserved)/i.test(text)) {
      return false
    }
    if (/^[\d\s.|-]+$/.test(text)) return false
  }
  if (line.size < bodySize * 0.55) return false
  // Footnotes and conference blurbs sit below the body in a smaller face.
  if (line.y < page.height * 0.25 && line.size < bodySize * 0.93) return false
  // Running heads / proceedings lines in the top margin.
  if (line.y > page.height * 0.93 && line.size < bodySize * 0.96) return false
  return true
}

function groupItems(items, bodySize, page) {
  if (items.length === 0) return []
  const tolerance = Math.max(2.2, bodySize * 0.28)
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const buckets = []
  for (const item of sorted) {
    let bucket = null
    for (let index = buckets.length - 1; index >= Math.max(0, buckets.length - 8); index -= 1) {
      const candidate = buckets[index]
      if (Math.abs(candidate.y - item.y) > tolerance) continue
      // Same baseline but a real horizontal jump: the other column starts here.
      if (item.x > candidate.maxX + 12 || item.x < candidate.minX - 2) continue
      bucket = candidate
      break
    }
    if (bucket === null) {
      bucket = { y: item.y, items: [], page, minX: item.x, maxX: item.x }
      buckets.push(bucket)
    }
    bucket.items.push(item)
    bucket.minX = Math.min(bucket.minX, item.x)
    bucket.maxX = Math.max(bucket.maxX, item.x + item.w)
  }

  return buckets
    .map((bucket) => {
      const lineItems = bucket.items.sort((a, b) => a.x - b.x)
      let text = ''
      let prev = null
      let maxSize = 0
      let minX = Infinity
      let maxX = -Infinity
      for (const item of lineItems) {
        if (text === '') text = item.str
        else {
          const gap = item.x - (prev.x + prev.w)
          const addSpace =
            gap > Math.max(0.8, item.size * 0.1) &&
            !/[\s\-–—/]$/.test(text) &&
            !/^[,.;:!?%)\]}，。；：！？、》】]/.test(item.str) &&
            !/[\u4e00-\u9fff]$/.test(text)
          text += `${addSpace ? ' ' : ''}${item.str}`
        }
        maxSize = Math.max(maxSize, item.size)
        minX = Math.min(minX, item.x)
        maxX = Math.max(maxX, item.x + item.w)
        prev = item
      }
      return {
        text: cleanText(debracket(text)),
        x: minX,
        width: Math.max(1, maxX - minX),
        y: bucket.y,
        size: maxSize,
        page: bucket.page,
      }
    })
    .sort((a, b) => b.y - a.y || a.x - b.x)
}

function debracket(text) {
  // pdf.js sometimes emits "word(ﬁller)"-style artefacts; keep them readable.
  return text.replace(/\s+([,.;:!?])/g, '$1').replace(/\(\s*\)/g, '')
}

function guessFrontMatter(pages, bodySize) {
  const first = pages[0]
  if (first === undefined) return { title: '', authors: [] }
  const pageTop = first.height * 0.35
  const candidates = first.items.filter((item) => item.y > pageTop)
  const titleItems = candidates.filter((item) => item.size >= bodySize * 1.45)
  const titleLine = titleItems.length > 0 ? groupItems(titleItems, bodySize, first).sort((a, b) => b.y - a.y)[0] : null
  const title = titleLine?.text ?? ''

  const authors = []
  if (titleLine !== null) {
    const abstractY = first.items
      .filter((item) => /^abstract\b/i.test(item.str))
      .reduce((best, item) => (best === null || item.y > best ? item.y : best), null)
    const lower = titleLine.y - 2
    const upper = abstractY !== null ? abstractY + 4 : titleLine.y - bodySize * 18
    const region = first.items.filter(
      (item) =>
        item.y < lower &&
        item.y > upper &&
        item.size >= bodySize * 0.85 &&
        item.size <= bodySize * 1.35 &&
        !/\S+@\S+/.test(item.str),
    )
    const affiliation =
      /\b(google|brain|research|university|universität|institute|department|school|college|laborator|lab|inc\.?|corp|facebook|microsoft|deepmind|openai|nvidia|amazon|meta\b|adobe|tencent|alibaba|bytedance|company|team)\b/i
    for (const line of groupItems(region, bodySize, first).sort((a, b) => b.y - a.y)) {
      if (/equal contribution|work performed|listing order|corresponding author/i.test(line.text)) continue
      if (/^[\d\s.,;:*†‡§¶∗-]+$/.test(line.text)) continue
      for (const match of line.text.matchAll(/\b([A-Z][a-z]+ (?:[A-Z]\. )?[A-Z][a-z]+)\b/g)) {
        const name = match[1].trim()
        if (affiliation.test(name)) continue
        if (!authors.includes(name)) authors.push(name)
      }
    }
  }
  return { title, authors: authors.slice(0, 16) }
}

function yearFromText(text) {
  const matches = [...text.matchAll(/\b(19|20)\d{2}\b/g)].map((match) => Number(match[0]))
  if (matches.length === 0) return undefined
  return Math.max(...matches.filter((year) => year <= new Date().getFullYear() + 1))
}

function yearFromPdfItems(items) {
  const text = items
    .filter((item) => !/^arxiv:/i.test(item.str))
    .map((item) => item.str)
    .join(' ')
  return yearFromText(text)
}

/** Sites with only a meta description still get one translatable abstract block. */
function ensureAbstractBlock(blocks, abstract) {
  const text = cleanText(abstract ?? '')
  if (text.length < 40) return
  if (blocks.some((block) => block.type === 'abstract')) return
  blocks.unshift({ id: 'b0', type: 'abstract', text, page: 1, level: 0, section: 'Abstract' })
}

/** Drop the title/authors/conference front matter above Abstract or Introduction. */
function stripFrontMatter(blocks) {
  const index = blocks.findIndex(
    (block) =>
      block.type === 'heading' &&
      /^(abstract\b|\d+\.?\s+introduction\b|introduction\b)/i.test(block.text.trim()),
  )
  if (index > 0) blocks.splice(0, index)
  return blocks
}

/**
 * Merge visual lines into paragraphs and headings.
 */
function linesToBlocks(lines, bodySize) {
  const makeBlock = makeBlockFactory()
  const blocks = []
  let current = null
  let section = ''
  let inReferences = false
  let abstractSeen = false
  let prevLine = null

  const gapSamples = new Map()
  const columnKey = (line) => `${line.page}:${Math.round((line.colLeft ?? line.x ?? 0) / 24)}`
  for (let index = 1; index < lines.length; index += 1) {
    const before = lines[index - 1]
    const after = lines[index]
    if (before.page !== after.page || columnKey(before) !== columnKey(after)) continue
    const value = before.y - after.y
    if (value <= 0 || value > Math.max(before.size, after.size) * 3) continue
    const key = columnKey(before)
    if (!gapSamples.has(key)) gapSamples.set(key, [])
    gapSamples.get(key).push(value)
  }
  const normalGap = new Map([...gapSamples].map(([key, values]) => [key, median(values)]))

  const flush = () => {
    if (current === null) return
    const text = cleanText(current.text)
    if (text.length > 0) {
      blocks.push(
        makeBlock(current.type, text, {
          page: current.page,
          section: current.section,
          level: current.level,
          caption: current.caption,
        }),
      )
    }
    current = null
  }

  for (const line of lines) {
    let text = line.text.trim()
    if (text === '') continue
    const headingLevel = headingOf(text, line.size, bodySize)
    if (headingLevel > 0) {
      flush()
      if (/^(references|bibliography)\b/i.test(text)) {
        inReferences = true
        section = text
        blocks.push(makeBlock('heading', text, { page: line.page, level: headingLevel }))
        prevLine = line
        continue
      }
      if (inReferences) {
        if (/^(appendix|appendices)\b/i.test(text)) inReferences = false
        else continue
      }
      section = text
      abstractSeen = /^abstract\b/i.test(text)
      blocks.push(makeBlock('heading', text, { page: line.page, level: headingLevel }))
      prevLine = line
      continue
    }
    if (inReferences) {
      prevLine = line
      continue
    }

    const gap = prevLine === null ? 0 : prevLine.y - line.y
    const keyPrev = columnKey(prevLine)
    const keyLine = columnKey(line)
    const sameColumn =
      prevLine !== null &&
      prevLine.page === line.page &&
      Math.abs((prevLine.colLeft ?? prevLine.x) - (line.colLeft ?? line.x)) < line.size * 2.5
    const normal = normalGap.get(keyPrev) || bodySize * 1.35
    const gapThreshold = Math.max(normal * 1.35, (prevLine?.size ?? bodySize) * 1.3, 12.5)
    const indented =
      sameColumn &&
      line.x > prevLine.x + line.size * 0.45 &&
      prevLine.x < (prevLine.colLeft ?? prevLine.x) + line.size * 0.4
    const prevShort =
      sameColumn &&
      Number.isFinite(prevLine.colRight) &&
      prevLine.x + prevLine.width < prevLine.colRight - prevLine.size * 2.2
    const endsSentence = /[.!?:;]$/.test(prevLine?.text ?? '')
    const hyphenContinuation = /-$/.test(prevLine?.text ?? '') && /^[a-z]/.test(text)
    const lowercaseStart = /^[a-z(“"'(]/.test(text)

    let newParagraph = current === null || prevLine === null
    if (!newParagraph) {
      if (hyphenContinuation) {
        newParagraph = false
      } else if (prevLine.page !== line.page || !sameColumn) {
        // A paragraph continues across a column/page boundary only when the old
        // column really ended and the sentence is still open.
        const pageHeight = prevLine.pageHeight ?? line.pageHeight ?? 800
        const atColumnEnd = prevLine.y < pageHeight * 0.2
        const atColumnTop = line.y > pageHeight * 0.68
        const flows = atColumnEnd && atColumnTop && !endsSentence && (lowercaseStart || /^[a-z(“"'(]/.test(text))
        newParagraph = !flows
      } else if (gap > gapThreshold) {
        newParagraph = true
      } else if (indented && (endsSentence || gap > normal * 1.1)) {
        newParagraph = true
      } else if (prevShort && endsSentence && gap > normal * 1.05) {
        newParagraph = true
      } else if (endsSentence && gap > normal * 1.25 && /^[A-Z]/.test(text)) {
        newParagraph = true
      }
    }

    if (newParagraph) {
      flush()
      current = {
        text,
        type: abstractSeen ? 'abstract' : 'para',
        page: line.page,
        section,
        level: 0,
      }
    } else if (text.length > 0) {
      const hyphen = /-$/.test(current.text) && /^[a-z]/.test(text)
      current.text = hyphen ? `${current.text.slice(0, -1)}${text}` : `${current.text} ${text}`
      current.page = line.page
    }
    prevLine = line
  }
  flush()
  return blocks
}

function headingOf(text, size, bodySize) {
  const clean = text.trim()
  if (clean.length > 160) return 0
  const words = clean.split(/\s+/).length
  if (/^(abstract|introduction|related work|background|motivation|method|methods|methodology|approach|experiment|experiments|experimental setup|evaluation|results|result|analysis|ablation|discussion|conclusion|conclusions|future work|limitations|references|bibliography|acknowledg(e)?ments?|appendix|supplementary material)(\s+\d+(\.\d+)*)?$/i.test(clean)) {
    return 2
  }
  const numbered = clean.match(/^(\d+)(?:\.\d+){0,3}\.?\s+[A-Z]/)
  if (numbered !== null && words <= 12 && Number(numbered[1]) <= 20) {
    return clean.split(' ')[0].split('.').filter(Boolean).length + 1
  }
  if (/^[IVX]+\.\s+[A-Z]/.test(clean) && words <= 12) return 2
  if (/^(appendix|acknowledg(e)?ments?)\b/i.test(clean) && words <= 6) return 2
  if (size >= bodySize * 1.5 && words <= 20) return 2
  if (size >= bodySize * 1.16 && words <= 14 && /^[A-Z0-9]/.test(clean)) return 3
  return 0
}

export { clip }
