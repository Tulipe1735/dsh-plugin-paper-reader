import React from 'react'
import {
  API,
  ArrowLeftIcon,
  BookIcon,
  ChatIcon,
  EditIcon,
  ExternalIcon,
  LanguagesIcon,
  LibraryIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
  SparkIcon,
  TrashIcon,
  XIcon,
  formatAuthors,
  relativeTime,
  useLanguage,
  api,
} from './shared.jsx'
import { ChatRail } from './chat.jsx'
import { CSS } from './styles.js'

export const inject = ['slots', 'theme', 'locale']

const COPY = {
  zh: {
    brand: '阅读器',
    sub: '论文 · 技术博客 · 长文｜英文原文 / 中文对照',
    addPlaceholder: '粘贴论文、技术博客或文章链接…',
    add: '添加',
    adding: '正在抓取并解析内容…',
    addHint: '支持 arXiv / PDF 论文、技术博客、文档和普通文章页面。',
    papers: '篇内容',
    translated: '已译片段',
    search: '搜索标题、站点或摘要',
    sortNewest: '按最近阅读排序',
    emptyTitle: '书架还是空的',
    emptyText: '把论文、博客或文章链接粘到上面的输入框。解析后会显示英文原文和中文对照，共用一个滚动条。',
    emptyHints: ['arXiv / PDF 自动识别为论文', '技术博客会保留代码块与插图', '右侧对话可以问文章内容'],
    delete: '删除',
    confirmDelete: '从阅读器中删除这篇内容？',
    paras: '段',
    pages: '页',
    open: '打开',
    reading: '阅读中',
    back: '返回书架',
    translateAll: '译全文',
    translating: '翻译中',
    source: '原文',
    bilingual: '双语',
    onlyEn: '原文',
    onlyZh: '译文',
    chat: '对话',
    auto: '自动翻译',
    autoOff: '已暂停自动翻译',
    retry: '重试',
    abstract: '摘要',
    summary: '导语',
    authorsUnknown: '作者未知',
    loadingPaper: '正在打开内容…',
    notFound: '找不到这篇内容。',
    translateThis: '翻译这段',
    translationFailed: '翻译失败',
    noModel: '模型不可用',
    section: '节',
    typePaper: '论文',
    typeBlog: '博客',
    typeArticle: '文章',
    all: '全部',
    minutes: '分钟',
    by: '作者',
    demo: '演示',
    demoHint: '原文包含滚动动画；这里保存了静态演示快照。',
  },
  en: {
    brand: 'Reader',
    sub: 'Papers · tech blogs · long reads — English / Chinese',
    addPlaceholder: 'Paste a paper, tech blog or article link…',
    add: 'Add',
    adding: 'Fetching and parsing…',
    addHint: 'arXiv / PDF papers, tech blogs, docs and readable article pages.',
    papers: 'items',
    translated: 'blocks translated',
    search: 'Search title, site or summary',
    sortNewest: 'Sorted by recent reading',
    emptyTitle: 'Your shelf is empty',
    emptyText: 'Paste a paper, blog or article link above. Once parsed, the English original sits on the left and the Chinese translation on the right, sharing one scrollbar.',
    emptyHints: ['arXiv / PDF links become papers', 'Tech blogs keep code blocks and images', 'The chat on the right can answer questions about the text'],
    delete: 'Delete',
    confirmDelete: 'Remove this item from the reader?',
    paras: 'blocks',
    pages: 'pages',
    open: 'Open',
    reading: 'Reading',
    back: 'Back to library',
    translateAll: 'Translate all',
    translating: 'Translating',
    source: 'Original',
    bilingual: 'Bilingual',
    onlyEn: 'English',
    onlyZh: 'Chinese',
    chat: 'Chat',
    auto: 'Auto-translate',
    autoOff: 'Auto-translation paused',
    retry: 'Retry',
    abstract: 'Abstract',
    summary: 'Summary',
    authorsUnknown: 'Unknown authors',
    loadingPaper: 'Opening…',
    notFound: 'Not found.',
    translateThis: 'Translate this',
    translationFailed: 'Translation failed',
    noModel: 'Model unavailable',
    section: '§',
    typePaper: 'Paper',
    typeBlog: 'Blog',
    typeArticle: 'Article',
    all: 'All',
    minutes: 'min',
    by: 'By',
    demo: 'Demo',
    demoHint: 'The original page has scroll animations; static snapshots are saved here.',
  },
}

function typeLabel(t, type) {
  return type === 'paper' ? t.typePaper : type === 'blog' ? t.typeBlog : t.typeArticle
}

function readerType(paper) {
  return paper?.type ?? (paper?.kind === 'pdf' ? 'paper' : 'article')
}

export function createApp(ctx) {
  return function PaperReaderPanel() {
    const lang = useLanguage(ctx)
    const t = COPY[lang]
    const [papers, setPapers] = React.useState([])
    const [loading, setLoading] = React.useState(true)
    const [loadError, setLoadError] = React.useState('')
    const [view, setView] = React.useState({ kind: 'library' })
    const [model, setModel] = React.useState('')

    const refresh = React.useCallback(async () => {
      try {
        const value = await api('library')
        setPapers(Array.isArray(value.papers) ? value.papers : [])
        setLoadError('')
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : String(error))
      } finally {
        setLoading(false)
      }
    }, [])

    React.useEffect(() => {
      void refresh()
      api('status')
        .then((value) => setModel(String(value.model ?? '')))
        .catch(() => undefined)
    }, [refresh])

    const openPaper = (id) => setView({ kind: 'reader', id })
    const back = () => {
      setView({ kind: 'library' })
      void refresh()
    }

    return React.createElement(
      'div',
      { className: 'pr-root' },
      view.kind === 'library'
        ? React.createElement(LibraryView, {
            lang,
            t,
            papers,
            loading,
            loadError,
            model,
            refresh,
            openPaper,
          })
        : React.createElement(ReaderView, {
            key: view.id,
            ctx,
            lang,
            t,
            id: view.id,
            model,
            onBack: back,
            onDeleted: () => {
              setView({ kind: 'library' })
              void refresh()
            },
          }),
    )
  }
}

/* ------------------------------------------------------------------ */
/* Library                                                            */
/* ------------------------------------------------------------------ */

function LibraryView({ lang, t, papers, loading, loadError, model, refresh, openPaper }) {
  const [query, setQuery] = React.useState('')
  const [filter, setFilter] = React.useState('all')
  const [url, setUrl] = React.useState('')
  const [adding, setAdding] = React.useState(false)
  const [addError, setAddError] = React.useState('')
  const inputRef = React.useRef(null)
  const [editing, setEditing] = React.useState(null)
  const [editTitle, setEditTitle] = React.useState('')
  const [editAuthors, setEditAuthors] = React.useState('')
  const [savingEdit, setSavingEdit] = React.useState(false)
  const [editError, setEditError] = React.useState('')

  const startEdit = (paper) => {
    setEditing(paper)
    setEditTitle(paper.title ?? '')
    setEditAuthors(Array.isArray(paper.authors) ? paper.authors.join(', ') : '')
    setEditError('')
  }

  const closeEdit = () => {
    if (savingEdit) return
    setEditing(null)
    setEditError('')
  }

  const saveEdit = async () => {
    if (editing === null || savingEdit) return
    const title = editTitle.trim()
    if (title === '') {
      setEditError(lang === 'zh' ? '标题不能为空' : 'Title is required')
      return
    }
    setSavingEdit(true)
    setEditError('')
    try {
      await api('update', { id: editing.id, title, authors: editAuthors })
      setEditing(null)
      await refresh()
    } catch (failure) {
      setEditError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setSavingEdit(false)
    }
  }

  React.useEffect(() => {
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle === '') return papers
    return papers.filter((paper) =>
      `${paper.title}\n${(paper.authors ?? []).join(' ')}\n${paper.abstract ?? ''}`.toLowerCase().includes(needle),
    )
  }, [papers, query])

  const totalTranslated = papers.reduce((sum, paper) => sum + (paper.translated ?? 0), 0)
  const totalParagraphs = papers.reduce((sum, paper) => sum + (paper.paragraphs ?? 0), 0)

  const submit = async () => {
    const value = url.trim()
    if (value === '' || adding) return
    setAdding(true)
    setAddError('')
    try {
      const result = await api('add', { url: value })
      if (result.status === 'failed') {
        setAddError(result.error ?? '添加失败')
        return
      }
      setUrl('')
      await refresh()
      if (result.paper?.id) openPaper(result.paper.id)
    } catch (error) {
      setAddError(error instanceof Error ? error.message : String(error))
    } finally {
      setAdding(false)
    }
  }

  const remove = async (paper) => {
    if (!window.confirm(`${t.confirmDelete}\n\n${paper.title}`)) return
    try {
      await api('delete', { id: paper.id })
      await refresh()
    } catch (error) {
      setAddError(error instanceof Error ? error.message : String(error))
    }
  }

  return React.createElement(
    'div',
    { className: 'pr-lib' },
    React.createElement(
      'div',
      { className: 'pr-lib-inner' },
      React.createElement(
        'div',
        { className: 'pr-brand' },
        React.createElement(
          'div',
          { className: 'pr-brand-main' },
          React.createElement('div', { className: 'pr-brand-mark' }, React.createElement(BookIcon, { size: 21 })),
          React.createElement(
            'div',
            null,
            React.createElement('h1', null, t.brand),
            React.createElement('div', { className: 'pr-brand-sub' }, t.sub),
          ),
        ),
        React.createElement(
          'div',
          { className: 'pr-stats' },
          React.createElement(
            'div',
            { className: 'pr-stat' },
            React.createElement('b', null, papers.length),
            React.createElement('span', null, t.papers),
          ),
          React.createElement('div', { className: 'pr-stat-divider' }),
          React.createElement(
            'div',
            { className: 'pr-stat' },
            React.createElement('b', null, totalTranslated),
            React.createElement('span', null, t.translated),
          ),
        ),
      ),
      React.createElement(
        'div',
        { className: 'pr-addbox' },
        React.createElement('span', { className: 'pr-add-icon' }, React.createElement(LibraryIcon, { size: 16 })),
        React.createElement('input', {
          ref: inputRef,
          value: url,
          disabled: adding,
          placeholder: t.addPlaceholder,
          onChange: (event) => setUrl(event.target.value),
          onKeyDown: (event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault()
              void submit()
            }
          },
          'aria-label': t.addPlaceholder,
        }),
        React.createElement(
          'button',
          { type: 'button', className: 'pr-add-btn', disabled: adding || url.trim() === '', onClick: () => void submit() },
          adding ? React.createElement('span', { className: 'pr-note-spin' }) : React.createElement(PlusIcon, { size: 14 }),
          adding ? t.adding : t.add,
        ),
      ),
      React.createElement(
        'div',
        { className: 'pr-add-note', 'data-error': addError !== '' ? 'true' : 'false' },
        addError !== ''
          ? addError
          : adding
            ? t.adding
            : t.addHint,
      ),
      React.createElement(
        'div',
        { className: 'pr-toolbar' },
        React.createElement(
          'div',
          { className: 'pr-search' },
          React.createElement(SearchIcon, { size: 14 }),
          React.createElement('input', {
            value: query,
            placeholder: t.search,
            onChange: (event) => setQuery(event.target.value),
            'aria-label': t.search,
          }),
        ),
        React.createElement(
          'div',
          { className: 'pr-filters' },
          [
            ['all', t.all],
            ['paper', t.typePaper],
            ['blog', t.typeBlog],
            ['article', t.typeArticle],
          ].map(([value, label]) =>
            React.createElement(
              'button',
              {
                key: value,
                type: 'button',
                className: 'pr-filter',
                'data-active': filter === value ? 'true' : 'false',
                onClick: () => setFilter(value),
              },
              label,
            ),
          ),
        ),
        React.createElement(
          'div',
          { className: 'pr-sort' },
          t.sortNewest,
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'pr-icon-btn',
              title: lang === 'zh' ? '刷新列表' : 'Refresh',
              onClick: () => void refresh(),
              style: { width: 26, height: 26, marginLeft: 2 },
            },
            React.createElement(RefreshIcon, { size: 14 }),
          ),
        ),
      ),
    ),
    React.createElement(
      'div',
      { className: 'pr-lib-scroll' },
      React.createElement(
        'div',
        { className: 'pr-lib-grid-wrap' },
        loading
          ? React.createElement(
              'div',
              { className: 'pr-lib-loading' },
              [0, 1, 2, 3, 4, 5].map((index) => React.createElement('div', { key: index, className: 'pr-skel' })),
            )
          : loadError !== ''
            ? React.createElement(
                'div',
                { className: 'pr-empty' },
                React.createElement('h2', null, '连接失败'),
                React.createElement('p', null, loadError),
                React.createElement(
                  'button',
                  { type: 'button', className: 'pr-pill-btn', onClick: () => void refresh() },
                  React.createElement(RefreshIcon, { size: 14 }),
                  t.retry,
                ),
              )
            : papers.length === 0
              ? React.createElement(
                  'div',
                  { className: 'pr-empty' },
                  React.createElement('div', { className: 'pr-empty-mark' }, React.createElement(BookIcon, { size: 30 })),
                  React.createElement('h2', null, t.emptyTitle),
                  React.createElement('p', null, t.emptyText),
                  React.createElement(
                    'div',
                    { className: 'pr-empty-hint' },
                    t.emptyHints.map((hint) => React.createElement('div', { key: hint }, hint)),
                  ),
                  React.createElement(
                    'button',
                    {
                      type: 'button',
                      className: 'pr-pill-btn',
                      style: { marginTop: 16 },
                      onClick: () => inputRef.current?.focus(),
                    },
                    React.createElement(PlusIcon, { size: 14 }),
                    t.add,
                  ),
                )
              : filtered.length === 0
                ? React.createElement(
                    'div',
                    { className: 'pr-empty' },
                    React.createElement(SearchIcon, { size: 26 }),
                    React.createElement('h2', null, lang === 'zh' ? '没有匹配的内容' : 'No matching items'),
                    React.createElement('p', null, query),
                  )
                : React.createElement(
                    'div',
                    { className: 'pr-grid' },
                    filtered.map((paper) =>
                      React.createElement(PaperCard, {
                        key: paper.id,
                        paper,
                        lang,
                        t,
                        onOpen: () => openPaper(paper.id),
                        onEdit: () => startEdit(paper),
                        onDelete: () => void remove(paper),
                      }),
                    ),
                  ),
      ),
      editing !== null
        ? React.createElement(
            'div',
            {
              className: 'pr-modal',
              role: 'dialog',
              'aria-modal': 'true',
              onClick: closeEdit,
              onKeyDown: (event) => {
                if (event.key === 'Escape') {
                  event.stopPropagation()
                  closeEdit()
                }
              },
            },
            React.createElement(
              'div',
              { className: 'pr-modal-card', onClick: (event) => event.stopPropagation() },
              React.createElement('h3', null, lang === 'zh' ? '编辑论文信息' : 'Edit paper'),
              React.createElement(
                'div',
                { className: 'pr-modal-sub' },
                lang === 'zh'
                  ? '原链接的元数据有时不准确，可以在这里改标题。作者只用于阅读页，卡片上不显示。'
                  : 'Fix a title the source page got wrong. Authors are used in the reader but hidden on the card.',
              ),
              React.createElement(
                'div',
                { className: 'pr-field' },
                React.createElement('label', { htmlFor: 'pr-edit-title' }, lang === 'zh' ? '标题' : 'Title'),
                React.createElement('input', {
                  id: 'pr-edit-title',
                  autoFocus: true,
                  value: editTitle,
                  onChange: (event) => setEditTitle(event.target.value),
                  onKeyDown: (event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void saveEdit()
                    }
                  },
                }),
              ),
              React.createElement(
                'div',
                { className: 'pr-field' },
                React.createElement('label', { htmlFor: 'pr-edit-authors' }, lang === 'zh' ? '作者（可选，逗号分隔）' : 'Authors (optional, comma separated)'),
                React.createElement('input', {
                  id: 'pr-edit-authors',
                  value: editAuthors,
                  placeholder: lang === 'zh' ? '不会显示在卡片上' : 'Hidden on the card',
                  onChange: (event) => setEditAuthors(event.target.value),
                  onKeyDown: (event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void saveEdit()
                    }
                  },
                }),
              ),
              editError !== ''
                ? React.createElement('div', { className: 'pr-modal-error' }, editError)
                : null,
              React.createElement(
                'div',
                { className: 'pr-modal-actions' },
                React.createElement(
                  'button',
                  { type: 'button', className: 'pr-pill-btn', disabled: savingEdit, onClick: closeEdit },
                  lang === 'zh' ? '取消' : 'Cancel',
                ),
                React.createElement(
                  'button',
                  { type: 'button', className: 'pr-add-btn', disabled: savingEdit, onClick: () => void saveEdit() },
                  savingEdit
                    ? React.createElement('span', { className: 'pr-note-spin' })
                    : React.createElement(EditIcon, { size: 13 }),
                  lang === 'zh' ? '保存' : 'Save',
                ),
              ),
            ),
          )
        : null,
    ),
  )
}

function PaperCard({ paper, lang, t, onOpen, onEdit, onDelete }) {
  const total = paper.paragraphs ?? 0
  const translated = paper.translated ?? 0
  const ratio = total > 0 ? Math.min(1, translated / total) : 0
  const readAt = paper.readAt ?? paper.addedAt
  const type = readerType(paper)
  const site = paper.site || (() => {
    try {
      return new URL(paper.url).hostname.replace(/^www\./, '')
    } catch {
      return ''
    }
  })()
  const date = paper.publishedAt || paper.year

  return React.createElement(
    'article',
    {
      className: 'pr-card',
      tabIndex: 0,
      onClick: onOpen,
      onKeyDown: (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      },
    },
    React.createElement(
      'button',
      {
        type: 'button',
        className: 'pr-card-edit',
        title: lang === 'zh' ? '编辑标题' : 'Edit title',
        onClick: (event) => {
          event.stopPropagation()
          onEdit()
        },
      },
      React.createElement(EditIcon, { size: 13 }),
    ),
    React.createElement(
      'button',
      {
        type: 'button',
        className: 'pr-card-del',
        title: t.delete,
        onClick: (event) => {
          event.stopPropagation()
          onDelete()
        },
      },
      React.createElement(TrashIcon, { size: 14 }),
    ),
    React.createElement(
      'div',
      { className: 'pr-card-top' },
      React.createElement('span', { className: 'pr-chip', 'data-type': type }, typeLabel(t, type)),
      site !== ''
        ? React.createElement('span', { className: 'pr-chip pr-chip-site', title: site }, site.slice(0, 30))
        : null,
      date !== undefined && date !== '' ? React.createElement('span', { className: 'pr-chip' }, date) : null,
    ),
    React.createElement('h3', null, paper.title || 'Untitled'),
    React.createElement('div', { className: 'pr-card-abs' }, paper.abstract || ''),
    React.createElement(
      'div',
      { className: 'pr-card-foot' },
      React.createElement(
        'div',
        { className: 'pr-card-meta' },
        React.createElement('span', null, `${total} ${t.paras}`),
        paper.readingMinutes ? React.createElement('span', { className: 'pr-dot' }) : null,
        paper.readingMinutes ? React.createElement('span', null, `${paper.readingMinutes} ${t.minutes}`) : null,
        React.createElement('span', { className: 'pr-dot' }),
        React.createElement('span', null, relativeTime(readAt, lang)),
      ),
      React.createElement(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: 8 } },
        React.createElement(
          'span',
          { className: 'pr-card-meta', title: `${translated} / ${total}` },
          `${Math.round(ratio * 100)}%`,
        ),
        React.createElement('div', { className: 'pr-mini-progress' }, React.createElement('i', { style: { width: `${ratio * 100}%` } })),
      ),
    ),
  )
}

/* ------------------------------------------------------------------ */
/* Reader                                                             */
/* ------------------------------------------------------------------ */

function ReaderView({ ctx, lang, t, id, model, onBack, onDeleted }) {
  const [paper, setPaper] = React.useState(null)
  const [chatHistory, setChatHistory] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [mode, setMode] = React.useState(() => localStorage.getItem('dsh-paper-reader:mode') ?? 'both')
  const [chatOpen, setChatOpen] = React.useState(() => {
    const saved = localStorage.getItem('dsh-paper-reader:chat')
    if (saved !== null) return saved !== '0'
    return window.innerWidth > 900
  })
  const [focusId, setFocusId] = React.useState('')
  const [selection, setSelection] = React.useState('')
  const [demoOpen, setDemoOpen] = React.useState(false)
  const [zh, setZh] = React.useState({})
  const [translating, setTranslating] = React.useState(() => new Set())
  const [translateError, setTranslateError] = React.useState('')
  const [auto, setAuto] = React.useState(true)
  const [queueSize, setQueueSize] = React.useState(0)

  const docRef = React.useRef(null)
  const zhRef = React.useRef({})
  const queueRef = React.useRef([])
  const queuedRef = React.useRef(new Set())
  const inflightRef = React.useRef(false)
  const pausedRef = React.useRef(false)
  const paperIdRef = React.useRef(id)
  const autoRef = React.useRef(true)

  React.useEffect(() => {
    paperIdRef.current = id
  }, [id])

  React.useEffect(() => {
    localStorage.setItem('dsh-paper-reader:mode', mode)
  }, [mode])
  React.useEffect(() => {
    localStorage.setItem('dsh-paper-reader:chat', chatOpen ? '1' : '0')
  }, [chatOpen])

  React.useEffect(() => {
    let alive = true
    setLoading(true)
    setError('')
    setPaper(null)
    setZh({})
    zhRef.current = {}
    queueRef.current = []
    queuedRef.current.clear()
    pausedRef.current = false
    setTranslateError('')
    setQueueSize(0)
    fetch(`${API}paper?id=${encodeURIComponent(id)}`, { credentials: 'same-origin' })
      .then(async (response) => {
        const value = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(value.error ?? `请求失败 (${response.status})`)
        if (!alive) return
        zhRef.current = value.translations ?? {}
        setZh(zhRef.current)
        setChatHistory(Array.isArray(value.chat) ? value.chat : [])
        setPaper(value.paper ?? null)
      })
      .catch((failure) => {
        if (alive) setError(failure instanceof Error ? failure.message : String(failure))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [id])

  const pump = React.useCallback(async () => {
    if (inflightRef.current || pausedRef.current) return
    const target = paperIdRef.current
    const batch = queueRef.current.splice(0, 4)
    if (batch.length === 0) return
    inflightRef.current = true
    setTranslating((current) => {
      const next = new Set(current)
      for (const blockId of batch) next.add(blockId)
      return next
    })
    try {
      const result = await api('translate', { id: target, ids: batch })
      if (paperIdRef.current !== target) return
      zhRef.current = { ...zhRef.current, ...(result.translations ?? {}) }
      setZh(zhRef.current)
      if (Array.isArray(result.failed) && result.failed.length > 0) {
        setTranslateError(lang === 'zh' ? '部分段落翻译失败，可重试。' : 'Some blocks failed to translate.')
      }
    } catch (failure) {
      if (paperIdRef.current === target) {
        setTranslateError(failure instanceof Error ? failure.message : String(failure))
        pausedRef.current = true
        setAuto(false)
        autoRef.current = false
      }
    } finally {
      for (const blockId of batch) queuedRef.current.delete(blockId)
      if (paperIdRef.current === target) {
        setTranslating((current) => {
          const next = new Set(current)
          for (const blockId of batch) next.delete(blockId)
          return next
        })
        setQueueSize(queueRef.current.length)
      }
      inflightRef.current = false
      if (queueRef.current.length > 0 && !pausedRef.current) window.setTimeout(() => void pump(), 120)
    }
  }, [lang])

  const enqueue = React.useCallback(
    (ids, force = false) => {
      if (!force && !autoRef.current) return
      for (const blockId of ids) {
        if (typeof blockId !== 'string' || blockId === '') continue
        if (zhRef.current[blockId] !== undefined) continue
        if (queuedRef.current.has(blockId)) continue
        queuedRef.current.add(blockId)
        queueRef.current.push(blockId)
      }
      setQueueSize(queueRef.current.length)
      void pump()
    },
    [pump],
  )

  const enqueueAll = React.useCallback(() => {
    if (paper === null) return
    pausedRef.current = false
    autoRef.current = true
    setAuto(true)
    setTranslateError('')
    enqueue(
      paper.blocks
        .filter(
          (block) =>
            block.type !== 'reference' &&
            block.type !== 'code' &&
            block.type !== 'image' &&
            String(block.text ?? '').trim() !== '',
        )
        .map((block) => block.id),
      true,
    )
  }, [paper, enqueue])

  React.useEffect(() => {
    if (paper === null) return
    const initial = paper.blocks
      .filter((block) => block.type === 'abstract' || block.type === 'para')
      .slice(0, 3)
      .map((block) => block.id)
    if (initial.length > 0) enqueue(initial)
  }, [paper, enqueue])

  React.useEffect(() => {
    if (paper === null || !auto) return undefined
    const root = docRef.current
    if (root === null) return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        const ids = entries
          .filter((entry) => entry.isIntersecting && entry.target.getAttribute('data-translate') !== 'false')
          .map((entry) => entry.target.getAttribute('data-block-id'))
        const valid = ids.filter((value) => typeof value === 'string' && value !== '')
        if (valid.length > 0) enqueue(valid)
      },
      { root, rootMargin: '320px 0px', threshold: 0.01 },
    )
    for (const node of root.querySelectorAll('[data-block-id]')) observer.observe(node)
    return () => observer.disconnect()
  }, [paper, auto, enqueue])

  const onSelect = () => {
    try {
      const current = window.getSelection()
      if (current === null || current.isCollapsed) return
      const text = current.toString().trim()
      if (text === '' || text.length < 2) return
      const anchor = current.anchorNode
      if (anchor === null || docRef.current === null || !docRef.current.contains(anchor)) return
      setSelection(text.slice(0, 4000))
    } catch {
      /* ignore */
    }
  }

  const focusBlock = React.useMemo(
    () => (paper === null || paper === undefined ? undefined : (paper.blocks ?? []).find((block) => block.id === focusId)),
    [paper, focusId],
  )

  if (loading) {
    return React.createElement(
      'div',
      { className: 'pr-reader' },
      React.createElement(
        'div',
        { className: 'pr-main' },
        React.createElement(
          'div',
          { className: 'pr-reader-empty' },
          React.createElement('span', { className: 'pr-note-spin' }),
          t.loadingPaper,
        ),
      ),
    )
  }

  if (error !== '' || paper === null) {
    return React.createElement(
      'div',
      { className: 'pr-reader' },
      React.createElement(
        'div',
        { className: 'pr-main' },
        React.createElement(
          'div',
          { className: 'pr-reader-empty' },
          React.createElement('span', null, error || t.notFound),
          React.createElement(
            'button',
            { type: 'button', className: 'pr-pill-btn', onClick: onBack },
            React.createElement(ArrowLeftIcon, { size: 13 }),
            t.back,
          ),
        ),
      ),
    )
  }

  const blocks = paper.blocks ?? []
  const translatable = blocks.filter(
    (block) => block.type !== 'reference' && block.type !== 'code' && block.type !== 'image' && String(block.text ?? '').trim() !== '',
  )
  const translatedCount = translatable.filter((block) => typeof zh[block.id] === 'string' && zh[block.id] !== '').length
  const total = translatable.length
  const ratio = total > 0 ? translatedCount / total : 0
  const abstractBlocks = blocks.filter((block) => block.type === 'abstract')
  const abstractZh = abstractBlocks.map((block) => zh[block.id]).filter((value) => typeof value === 'string' && value !== '').join(' ')
  const rows = blocks.filter((block) => block.type !== 'abstract' && !(block.type === 'heading' && /^abstract\b/i.test(block.text)))
  const modeLabel = mode === 'both' ? t.bilingual : mode === 'en' ? t.onlyEn : t.onlyZh
  const sourceHref = paper.kind === 'pdf' ? `${API}source?id=${encodeURIComponent(paper.id)}` : paper.url
  const busy = translating.size > 0 || queueSize > 0

  const translateOne = (blockId) => {
    pausedRef.current = false
    autoRef.current = true
    setAuto(true)
    setTranslateError('')
    enqueue([blockId], true)
  }

  return React.createElement(
    'div',
    { className: 'pr-reader' },
    React.createElement(
      'div',
      { className: 'pr-main' },
      React.createElement(
        'header',
        { className: 'pr-reader-head' },
        React.createElement(
          'button',
          { type: 'button', className: 'pr-icon-btn', title: t.back, onClick: onBack },
          React.createElement(ArrowLeftIcon, { size: 17 }),
        ),
        React.createElement(
          'div',
          { className: 'pr-head-title' },
          React.createElement('b', null, paper.title),
          React.createElement(
            'span',
            null,
            [
              typeLabel(t, readerType(paper)),
              paper.site,
              paper.publishedAt || (paper.year !== undefined ? String(paper.year) : ''),
              paper.readingMinutes ? `${paper.readingMinutes} ${t.minutes}` : '',
              `${translatedCount}/${total} ${t.translated}`,
            ]
              .filter(Boolean)
              .join(' · '),
          ),
        ),
        React.createElement(
          'div',
          { className: 'pr-head-actions' },
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'pr-pill-btn',
              title: lang === 'zh' ? '切换显示模式' : 'Toggle display mode',
              onClick: () => setMode(mode === 'both' ? 'en' : mode === 'en' ? 'zh' : 'both'),
            },
            React.createElement(LanguagesIcon, { size: 14 }),
            modeLabel,
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'pr-pill-btn',
              'data-primary': !busy ? 'true' : 'false',
              title: t.translateAll,
              onClick: enqueueAll,
            },
            busy ? React.createElement('span', { className: 'pr-note-spin' }) : React.createElement(RefreshIcon, { size: 14 }),
            busy ? `${t.translating} ${translatedCount}/${total}` : t.translateAll,
          ),
          React.createElement(
            'a',
            {
              className: 'pr-pill-btn',
              href: sourceHref,
              target: '_blank',
              rel: 'noreferrer noopener',
              title: t.source,
            },
            React.createElement(ExternalIcon, { size: 14 }),
            t.source,
          ),
          Array.isArray(paper.snapshots) && paper.snapshots.length > 0
            ? React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'pr-pill-btn',
                  title: t.demoHint,
                  onClick: () => setDemoOpen(true),
                },
                React.createElement(SparkIcon, { size: 13 }),
                t.demo,
              )
            : null,
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'pr-icon-btn',
              'data-active': chatOpen ? 'true' : 'false',
              title: t.chat,
              onClick: () => setChatOpen((value) => !value),
            },
            React.createElement(ChatIcon, { size: 17 }),
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'pr-icon-btn',
              title: t.delete,
              onClick: async () => {
                if (!window.confirm(`${t.confirmDelete}\n\n${paper.title}`)) return
                try {
                  await api('delete', { id: paper.id })
                } catch {
                  /* ignore */
                }
                onDeleted()
              },
            },
            React.createElement(TrashIcon, { size: 16 }),
          ),
        ),
      ),
      React.createElement(
        'div',
        { className: 'pr-progress', 'data-indeterminate': busy && translatedCount === 0 ? 'true' : 'false' },
        React.createElement('i', { style: { width: `${Math.round(ratio * 100)}%` } }),
      ),
      React.createElement(
        'div',
        { className: 'pr-doc', ref: docRef, onMouseUp: onSelect, onKeyUp: onSelect },
        React.createElement(
          'div',
          { className: 'pr-paper' },
          React.createElement(
            'div',
            { className: 'pr-title-row' },
            React.createElement('h1', null, paper.title),
          ),
          React.createElement(
            'div',
            { className: 'pr-paper-meta' },
            React.createElement('span', { className: 'pr-type-dot', 'data-type': readerType(paper) }),
            React.createElement('span', null, typeLabel(t, readerType(paper))),
            paper.site ? React.createElement('span', { className: 'pr-dot' }) : null,
            paper.site ? React.createElement('span', null, paper.site) : null,
            (paper.publishedAt || paper.year !== undefined) ? React.createElement('span', { className: 'pr-dot' }) : null,
            (paper.publishedAt || paper.year !== undefined)
              ? React.createElement('span', null, paper.publishedAt || paper.year)
              : null,
            formatAuthors(paper.authors) !== '' ? React.createElement('span', { className: 'pr-dot' }) : null,
            formatAuthors(paper.authors) !== '' ? React.createElement('span', null, formatAuthors(paper.authors)) : null,
            paper.readingMinutes ? React.createElement('span', { className: 'pr-dot' }) : null,
            paper.readingMinutes
              ? React.createElement('span', null, `${paper.readingMinutes} ${t.minutes}`)
              : null,
            paper.pages ? React.createElement('span', { className: 'pr-dot' }) : null,
            paper.pages ? React.createElement('span', null, `${paper.pages} ${t.pages}`) : null,
          ),
          paper.abstract || abstractBlocks.length > 0
            ? React.createElement(
                'section',
                { className: 'pr-abs-card' },
                React.createElement(
                  'div',
                  { className: 'pr-abs-card-label' },
                  readerType(paper) === 'paper' ? `${t.abstract} / Abstract` : `${t.summary} / Summary`,
                ),
                React.createElement(
                  'div',
                  { className: 'pr-abs-grid' },
                  React.createElement('div', { className: 'pr-abs-en' }, paper.abstract || abstractBlocks.map((block) => block.text).join(' ')),
                  React.createElement(
                    'div',
                    { className: 'pr-abs-zh' },
                    abstractZh !== ''
                      ? abstractZh
                      : busy
                        ? React.createElement(
                            'div',
                            { className: 'pr-zh-empty' },
                            React.createElement('div', { className: 'pr-zh-skel' }),
                            React.createElement('div', { className: 'pr-zh-skel' }),
                          )
                        : React.createElement(
                            'button',
                            {
                              type: 'button',
                              className: 'pr-pill-btn',
                              style: { height: 24, fontSize: 10.5 },
                              onClick: () => enqueue(abstractBlocks.map((block) => block.id), true),
                            },
                            t.translateThis,
                          ),
                  ),
                ),
              )
            : null,
          React.createElement(
            'div',
            { className: 'pr-rows', 'data-mode': mode },
            rows.map((block) =>
              React.createElement(block.type === 'code' ? CodeBlock : block.src ? FigureBlock : BlockRow, {
                key: block.id,
                block,
                zh: zh[block.id],
                lang,
                t,
                mode,
                focused: focusId === block.id,
                pending: translating.has(block.id) || queuedRef.current.has(block.id),
                failed: translateError !== '' && pausedRef.current,
                busy,
                onFocus: () => setFocusId((current) => (current === block.id ? '' : block.id)),
                onTranslate: () => translateOne(block.id),
              }),
            ),
          ),
        ),
      ),
    ),
    React.createElement(ChatRail, {
      key: paper.id,
      lang,
      paper,
      open: chatOpen,
      onToggle: () => setChatOpen((value) => !value),
      model,
      initialMessages: chatHistory,
      focusBlock,
      selection,
      onClearFocus: () => setFocusId(''),
      onClearSelection: () => setSelection(''),
    }),
    demoOpen && Array.isArray(paper.snapshots) && paper.snapshots.length > 0
      ? React.createElement(SnapshotsViewer, {
          lang,
          t,
          snapshots: paper.snapshots,
          onClose: () => setDemoOpen(false),
        })
      : null,
  )
}

function SnapshotsViewer({ snapshots, lang, t, onClose }) {
  React.useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return React.createElement(
    'div',
    { className: 'pr-demo-overlay', onClick: onClose, role: 'presentation' },
    React.createElement(
      'div',
      { className: 'pr-demo-panel', onClick: (event) => event.stopPropagation(), role: 'dialog', 'aria-modal': 'true' },
      React.createElement(
        'div',
        { className: 'pr-demo-head' },
        React.createElement(
          'div',
          null,
          React.createElement('b', null, t.demo),
          React.createElement('span', null, t.demoHint),
        ),
        React.createElement(
          'button',
          { type: 'button', className: 'pr-icon-btn', title: lang === 'zh' ? '关闭' : 'Close', onClick: onClose },
          React.createElement(XIcon, { size: 16 }),
        ),
      ),
      React.createElement(
        'div',
        { className: 'pr-demo-scroll' },
        snapshots.map((snapshot, index) =>
          React.createElement(
            'figure',
            { className: 'pr-demo-shot', key: snapshot.src ?? index },
            React.createElement('img', { src: snapshot.src, alt: snapshot.label ?? '', loading: 'lazy' }),
            React.createElement('figcaption', null, snapshot.label ?? `${index + 1}`),
          ),
        ),
      ),
    ),
  )
}

function TranslationCell({ block, zh, lang, t, pending, failed, busy, onTranslate }) {
  const translation = typeof zh === 'string' ? zh : ''
  if (translation !== '') return React.createElement('p', null, translation)
  const showSkeleton =
    pending ||
    (busy && (block.type === 'para' || block.type === 'heading' || block.type === 'caption' || block.type === 'list' || block.type === 'quote'))
  if (showSkeleton) {
    return React.createElement(
      'div',
      { className: 'pr-zh-empty' },
      React.createElement('div', { className: 'pr-zh-skel' }),
      React.createElement('div', { className: 'pr-zh-skel' }),
      React.createElement('div', { className: 'pr-zh-hint' }, lang === 'zh' ? '翻译中…' : 'Translating…'),
    )
  }
  return React.createElement(
    'div',
    { className: 'pr-zh-empty' },
    React.createElement(
      'button',
      {
        type: 'button',
        className: 'pr-zh-hint',
        style: { border: 0, background: 'transparent', cursor: 'pointer', padding: 0, alignSelf: 'flex-start' },
        'data-error': failed ? 'true' : 'false',
        onClick: (event) => {
          event.stopPropagation()
          onTranslate()
        },
      },
      React.createElement(LanguagesIcon, { size: 12 }),
      failed ? t.translationFailed : t.translateThis,
    ),
  )
}

function BlockRow({ block, zh, lang, t, mode, focused, pending, failed, busy, onFocus, onTranslate }) {
  const heading = block.type === 'heading'
  const caption = block.type === 'caption'
  const className = `pr-row${heading ? ' pr-row-head' : ''}${caption ? ' pr-row-caption' : ''}${focused ? ' is-focus' : ''}`
  const text = String(block.text ?? '')
  const marker = block.type === 'list' ? (block.ordered ? `${block.index || 1}.` : '•') : ''

  const content = (right) => {
    if (marker !== '') {
      return React.createElement(
        'div',
        { className: 'pr-list-line' },
        React.createElement('span', { className: 'pr-list-mark' }, marker),
        right,
      )
    }
    return right
  }

  return React.createElement(
    'div',
    { className, 'data-block-id': block.id, onClick: onFocus, title: lang === 'zh' ? '点击引用这一段' : 'Click to reference this passage' },
    React.createElement('span', { className: 'pr-tag' }, block.id),
    React.createElement(
      'div',
      { className: 'pr-col pr-en' },
      content(
        React.createElement(heading ? 'h2' : 'p', { style: heading ? { margin: 0 } : undefined }, text),
      ),
    ),
    React.createElement(
      'div',
      { className: 'pr-col pr-zh' },
      React.createElement(TranslationCell, { block, zh, lang, t, pending, failed, busy, onTranslate }),
    ),
  )
}

function FigureBlock({ block, zh, lang, t, mode, focused, pending, failed, busy, onFocus, onTranslate }) {
  const text = String(block.text ?? '').trim()
  const hasCaption = block.type === 'caption' && text !== ''
  return React.createElement(
    'figure',
    {
      className: `pr-figure${focused ? ' is-focus' : ''}`,
      'data-block-id': block.id,
      'data-translate': hasCaption ? 'true' : 'false',
      onClick: onFocus,
      title: lang === 'zh' ? '点击引用这张图' : 'Click to reference this figure',
    },
    React.createElement(
      'div',
      { className: 'pr-figure-frame' },
      React.createElement('img', {
        src: block.src,
        alt: block.alt ?? '',
        loading: 'lazy',
        onError: (event) => {
          event.currentTarget.style.display = 'none'
        },
      }),
    ),
    hasCaption
      ? React.createElement(
          'figcaption',
          { className: 'pr-figure-caption' },
          React.createElement('div', { className: 'pr-figure-en' }, text),
          React.createElement(
            'div',
            { className: 'pr-figure-zh' },
            React.createElement(TranslationCell, { block, zh, lang, t, pending, failed, busy, onTranslate }),
          ),
        )
      : null,
  )
}

function CodeBlock({ block, lang, focused, onFocus }) {
  const [copied, setCopied] = React.useState(false)
  const text = String(block.text ?? '')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      /* clipboard unavailable */
    }
  }
  return React.createElement(
    'div',
    {
      className: `pr-code-wrap${focused ? ' is-focus' : ''}`,
      'data-block-id': block.id,
      'data-translate': 'false',
      onClick: onFocus,
    },
    React.createElement(
      'div',
      { className: 'pr-code-head' },
      React.createElement('span', { className: 'pr-code-lang' }, block.lang || 'code'),
      React.createElement(
        'button',
        {
          type: 'button',
          className: 'pr-code-copy',
          onClick: (event) => {
            event.stopPropagation()
            void copy()
          },
        },
        copied ? (lang === 'zh' ? '已复制' : 'Copied') : lang === 'zh' ? '复制' : 'Copy',
      ),
    ),
    React.createElement('pre', { className: 'pr-code' }, React.createElement('code', null, text)),
  )
}

/* Plugin entry                                                       */
/* ------------------------------------------------------------------ */

export function apply(ctx) {
  const style = document.createElement('style')
  style.dataset.plugin = 'dsh-plugin-paper-reader'
  style.textContent = CSS
  document.head.appendChild(style)
  ctx.effect(() => () => style.remove(), 'paper-reader: ui styles')

  const Panel = createApp(ctx)

  // Diagnostics: lets the host (and tests) confirm that the browser half really
  // executed and registered its slots. Fire-and-forget; a failure changes nothing.
  const ping = (kind) =>
    fetch(`${API}ping`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lang: document.documentElement.lang || navigator.language, kind }),
    }).catch(() => undefined)
  void ping('boot')

  ctx.effect(
    () => ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'paper-reader' }, Panel)),
    'paper-reader: main panel',
  )

  ctx.effect(
    () =>
      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          { name: 'sidebar.panellist', id: 'paper-reader', order: 21, label: () => '阅读' },
          function PaperReaderIcon() {
            return React.createElement(BookIcon, { size: 20 })
          },
        ),
      ),
    'paper-reader: sidebar entry',
  )

  void ping('registered')
}
