import React from 'react'

export const PLUGIN_ID = 'dsh-plugin-paper-reader'
export const BASE = `/plugins/${PLUGIN_ID}/`
export const API = `${BASE}api/`

export async function api(path, body) {
  const response = await fetch(`${API}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const value = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(value.error ?? `请求失败 (${response.status})`)
  return value
}

export function useLanguage(ctx) {
  const read = () => {
    try {
      const snapshot = ctx.locale?.getLocale?.()
      const active = snapshot?.active
      const id = typeof active === 'string' ? active : active?.id ?? active?.locale
      if (typeof id === 'string' && id !== '') return /^zh/i.test(id) ? 'zh' : 'en'
    } catch {
      /* ignore */
    }
    return typeof navigator !== 'undefined' && /^zh/i.test(navigator.language ?? '') ? 'zh' : 'en'
  }
  const [lang, setLang] = React.useState(read)
  React.useEffect(() => {
    let dispose
    try {
      dispose = ctx.locale?.subscribe?.(() => setLang(read()))
    } catch {
      dispose = undefined
    }
    return () => {
      if (typeof dispose === 'function') dispose()
    }
  }, [ctx])
  return lang
}

export function formatAuthors(authors, max = 4) {
  if (!Array.isArray(authors) || authors.length === 0) return ''
  if (authors.length <= max) return authors.join(' · ')
  return `${authors.slice(0, max).join(' · ')} +${authors.length - max}`
}

export function relativeTime(timestamp, lang) {
  if (!timestamp) return ''
  const diff = Date.now() - timestamp
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return lang === 'zh' ? '刚刚' : 'just now'
  if (diff < hour) {
    const value = Math.floor(diff / minute)
    return lang === 'zh' ? `${value} 分钟前` : `${value} min ago`
  }
  if (diff < day) {
    const value = Math.floor(diff / hour)
    return lang === 'zh' ? `${value} 小时前` : `${value} h ago`
  }
  if (diff < 7 * day) {
    const value = Math.floor(diff / day)
    return lang === 'zh' ? `${value} 天前` : `${value} d ago`
  }
  return new Date(timestamp).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US')
}

/* ------------------------------------------------------------------ */
/* Icons                                                              */
/* ------------------------------------------------------------------ */

function icon(paths, size = 18) {
  return function Icon({ size: custom } = {}) {
    return React.createElement(
      'svg',
      {
        viewBox: '0 0 24 24',
        width: custom ?? size,
        height: custom ?? size,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.7,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
        style: { display: 'block' },
      },
      paths.map((path, index) =>
        typeof path === 'string'
          ? React.createElement('path', { key: index, d: path })
          : React.createElement(path.tag, { key: index, ...path.props }),
      ),
    )
  }
}

export const BookIcon = icon([
  'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z',
  'M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5',
  'M8 7h8',
])
export const LibraryIcon = icon(['M4 4h5v16H4z', 'M11 4h4v16h-4z', 'M17 4.5l3.4.9-3 15.1-3.4-.9z'])
export const PlusIcon = icon(['M12 5v14', 'M5 12h14'])
export const SearchIcon = icon([{ tag: 'circle', props: { cx: 11, cy: 11, r: 7 } }, 'M20 20l-3.6-3.6'])
export const ArrowLeftIcon = icon(['M19 12H5', 'M12 19l-7-7 7-7'])
export const ExternalIcon = icon([
  'M14 4h6v6',
  'M20 4l-9 9',
  'M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5',
])
export const TrashIcon = icon(['M4 7h16', 'M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2', 'M6 7l1 13h10l1-13', 'M10 11v5', 'M14 11v5'])
export const SparkIcon = icon([
  'M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z',
  'M18.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
])
export const SendIcon = icon(['M4.5 12L20 4l-5.5 16-3.2-6.3z', 'M11.3 13.7L20 4'])
export const StopIcon = icon([{ tag: 'rect', props: { x: 7, y: 7, width: 10, height: 10, rx: 2 } }], 14)
export const ChevronRightIcon = icon(['M9 6l6 6-6 6'])
export const ChevronLeftIcon = icon(['M15 6l-6 6 6 6'])
export const LanguagesIcon = icon([
  'M4 5h9',
  'M8.5 3v2',
  'M11 5c-.6 4-3 7-7 9',
  'M6 8c1.2 2.4 3 4.2 5.2 5.4',
  'M13 19l3.5-8 3.5 8',
  'M14.4 16h4.2',
])
export const ChatIcon = icon(['M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 3V6a1 1 0 0 1 1-1z', 'M8.5 10h7'])
export const RefreshIcon = icon(['M20 11a8 8 0 1 0-.6 4', 'M20 5v6h-6'])
export const XIcon = icon(['M6 6l12 12', 'M18 6L6 18'])
export const EditIcon = icon(['M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z', 'M13.5 6.5l3 3'])
export const DownloadIcon = icon(['M12 4v11', 'M7 11l5 5 5-5', 'M4 20h16'])
