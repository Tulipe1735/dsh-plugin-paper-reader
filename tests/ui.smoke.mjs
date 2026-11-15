/**
 * Browser-half smoke test: boot client.js inside happy-dom with a mocked DSH
 * module loader and plugin context, then drive the library → reader flow.
 */
import assert from 'node:assert/strict'

const { Window } = await import('happy-dom')
const window = new Window({ url: 'http://127.0.0.1:62540/', pretendToBeVisual: true })
globalThis.window = window
globalThis.document = window.document
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true })
globalThis.HTMLElement = window.HTMLElement
globalThis.Node = window.Node
globalThis.MouseEvent = window.MouseEvent
globalThis.localStorage = window.localStorage
globalThis.getComputedStyle = window.getComputedStyle.bind(window)
globalThis.requestAnimationFrame = (callback) => window.setTimeout(callback, 0)
globalThis.cancelAnimationFrame = (id) => window.clearTimeout(id)
globalThis.IS_REACT_ACT_ENVIRONMENT = true
globalThis.IntersectionObserver = class {
  constructor(callback) {
    this.callback = callback
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

const React = await import('react')
const { createRoot } = await import('react-dom/client')
const { act } = await import('react-dom/test-utils')

const paper = {
  id: 'p-abcdef1234',
  url: 'https://arxiv.org/abs/1706.03762',
  sourceUrl: 'https://arxiv.org/html/1706.03762',
  kind: 'html',
  title: 'Attention Is All You Need',
  authors: ['Ashish Vaswani', 'Noam Shazeer'],
  year: 2017,
  venue: 'NeurIPS',
  abstract: 'The dominant sequence transduction models are based on complex recurrent neural networks.',
  pages: 0,
  addedAt: Date.now() - 1000,
  readAt: Date.now(),
  status: 'ready',
  tags: [],
  translated: 1,
  paragraphs: 2,
  blocks: [
    { id: 'b1', type: 'heading', text: '1 Introduction', level: 2, section: '', page: 1 },
    { id: 'b2', type: 'para', text: 'Recurrent neural networks have been firmly established.', section: '1 Introduction', page: 1 },
    { id: 'b3', type: 'para', text: 'Attention mechanisms allow modeling dependencies.', section: '1 Introduction', page: 1 },
    {
      id: 'b4',
      type: 'caption',
      text: 'Figure 1: The Transformer architecture.',
      section: '3 Model Architecture',
      page: 1,
      src: '/plugins/dsh-plugin-paper-reader/api/figure?id=p-abcdef1234&name=fig-1.svg',
      alt: 'Figure 1',
    },
  ],
  outline: [{ id: 'b1', text: '1 Introduction', level: 2 }],
}

const translations = { b1: '1 引言', b2: '循环神经网络已经被牢固确立。' }

let currentTitle = paper.title
let currentAuthors = paper.authors
const calls = []
globalThis.fetch = window.fetch = async (url, options = {}) => {
  const path = String(url).replace('http://127.0.0.1:62540', '')
  calls.push({ path, method: options.method ?? 'GET', body: options.body })
  const json = (value) => ({
    ok: true,
    status: 200,
    json: async () => value,
    text: async () => JSON.stringify(value),
  })
  if (path.includes('/api/ping')) return json({ ok: true })
  if (path.includes('/api/status')) return json({ model: 'test/model' })
  if (path.includes('/api/library')) return json({ papers: [{ ...paper, title: currentTitle, authors: currentAuthors }] })
  if (path.includes('/api/paper')) return json({ paper: { ...paper, title: currentTitle, authors: currentAuthors }, translations, chat: [] })
  if (path.includes('/api/translate')) return json({ translations: {}, failed: [] })
  if (path.includes('/api/add')) return json({ status: 'added', paper })
  if (path.includes('/api/update')) {
    const body = JSON.parse(options.body ?? '{}')
    if (typeof body.title === 'string') currentTitle = body.title
    if (typeof body.authors === 'string') currentAuthors = body.authors.split(',').map((part) => part.trim()).filter(Boolean)
    return json({ ok: true, paper: { ...paper, title: currentTitle, authors: currentAuthors } })
  }
  if (path.includes('/api/delete')) return json({ ok: true })
  if (path.includes('/api/chat/clear')) return json({ ok: true })
  return json({})
}

let pluginExports = null
window.__ModuleLoader__ = {
  load(spec) {
    pluginExports = spec.factory((id) => {
      if (id === 'react') return React
      throw new Error(`unexpected module ${id}`)
    })
  },
}

await import(`../client.js?smoke=${Date.now()}`)
assert.equal(typeof pluginExports.apply, 'function', 'client.js should export apply')
assert.deepEqual(pluginExports.inject, ['slots', 'theme', 'locale'])

const registered = new Map()
const ctx = {
  effect(fn) {
    return fn()
  },
  slots: {
    inject(key, callback) {
      callback()
      return () => {}
    },
    register(registration, component) {
      registered.set(`${registration.name}:${registration.key ?? registration.id}`, component)
      return () => {}
    },
  },
  locale: {
    getLocale: () => ({ active: 'zh' }),
    subscribe: () => () => {},
  },
  theme: {
    getTheme: () => ({ active: { colorScheme: 'light' } }),
  },
}

pluginExports.apply(ctx)
assert.ok(registered.has('main:paper-reader'), 'main panel registered')
assert.ok(registered.has('sidebar.panellist:paper-reader'), 'sidebar icon registered')

const Panel = registered.get('main:paper-reader')
const container = document.createElement('div')
document.body.appendChild(container)
const root = createRoot(container)

await act(async () => {
  root.render(React.createElement(Panel))
  await new Promise((resolve) => window.setTimeout(resolve, 50))
})

let text = container.textContent
assert.match(text, /阅读器/, 'library header renders')
assert.match(text, /Attention Is All You Need/, 'paper card renders')
assert.ok(calls.some((call) => call.path === '/plugins/dsh-plugin-paper-reader/api/library'), 'library fetched')
assert.ok(calls.some((call) => call.path === '/plugins/dsh-plugin-paper-reader/api/ping'), 'ping fired')

const card = container.querySelector('.pr-card')
assert.ok(card, 'paper card exists')
assert.ok(!card.textContent.includes('Ashish Vaswani'), 'authors are hidden on the card')

const editButton = container.querySelector('.pr-card-edit')
assert.ok(editButton, 'card edit button exists')
await act(async () => {
  editButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await new Promise((resolve) => window.setTimeout(resolve, 20))
})
assert.ok(container.querySelector('.pr-modal'), 'edit modal opens')
const titleInput = container.querySelector('#pr-edit-title')
const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
await act(async () => {
  setValue.call(titleInput, 'Edited Paper Title')
  titleInput.dispatchEvent(new window.Event('input', { bubbles: true }))
  const save = [...container.querySelectorAll('.pr-modal-actions button')].find((button) => button.textContent.includes('保存'))
  save.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await new Promise((resolve) => window.setTimeout(resolve, 80))
})
assert.ok(calls.some((call) => call.path.endsWith('/api/update')), 'update endpoint called')
assert.match(container.textContent, /Edited Paper Title/, 'title edited on the card')

await act(async () => {
  container.querySelector('.pr-card').dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await new Promise((resolve) => window.setTimeout(resolve, 80))
})

text = container.textContent
assert.match(text, /1 Introduction/, 'reader renders headings')
assert.match(text, /循环神经网络已经被牢固确立/, 'reader renders cached Chinese translation')
assert.ok(container.querySelector('.pr-figure'), 'figure block renders')
assert.ok(container.querySelector('.pr-figure img')?.getAttribute('src').includes('/api/figure'), 'figure image uses the local route')
assert.ok(calls.some((call) => call.path.includes('/api/paper?id=')), 'paper fetched')

const translateCall = calls.find((call) => call.path.endsWith('/api/translate'))
assert.ok(translateCall, 'visible rows enqueue translation')

console.log('UI smoke test passed:', {
  renderChars: text.length,
  calls: calls.map((call) => `${call.method} ${call.path}`),
})

root.unmount()
