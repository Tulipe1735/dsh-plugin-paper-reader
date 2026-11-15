import React from 'react'

/**
 * A deliberately small Markdown renderer for chat answers: headings, lists,
 * quotes, fenced code, tables, and inline emphasis/links. It never injects
 * HTML, so model output is safe to render.
 */
export function Markdown({ text }) {
  const blocks = parseBlocks(String(text ?? ''))
  return React.createElement(
    'div',
    { className: 'pr-md' },
    blocks.map((block, index) => renderBlock(block, index)),
  )
}

function parseBlocks(source) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    if (line.trim() === '') {
      index += 1
      continue
    }
    const fence = line.match(/^```([\w-]*)\s*$/)
    if (fence !== null) {
      const code = []
      index += 1
      while (index < lines.length && !/^```/.test(lines[index])) {
        code.push(lines[index])
        index += 1
      }
      index += 1
      blocks.push({ type: 'code', lang: fence[1], text: code.join('\n') })
      continue
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading !== null) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] })
      index += 1
      continue
    }
    if (/^\s*(?:---+|\*\*\*+)\s*$/.test(line)) {
      blocks.push({ type: 'hr' })
      index += 1
      continue
    }
    if (/^>\s?/.test(line)) {
      const quote = []
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, ''))
        index += 1
      }
      blocks.push({ type: 'quote', text: quote.join('\n') })
      continue
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = []
      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*+]\s+/, ''))
        index += 1
      }
      blocks.push({ type: 'list', ordered: false, items })
      continue
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = []
      while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+[.)]\s+/, ''))
        index += 1
      }
      blocks.push({ type: 'list', ordered: true, items })
      continue
    }
    if (/^\s*\|.*\|\s*$/.test(line) && index + 1 < lines.length && /^\s*\|?[\s:|-]+\|/.test(lines[index + 1])) {
      const rows = []
      while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) {
        rows.push(splitRow(lines[index]))
        index += 1
      }
      const header = rows.shift() ?? []
      if (rows.length > 0 && rows[0].every((cell) => /^:?-{2,}:?$/.test(cell.trim()))) rows.shift()
      blocks.push({ type: 'table', header, rows })
      continue
    }
    const paragraph = []
    while (
      index < lines.length &&
      lines[index].trim() !== '' &&
      !/^```/.test(lines[index]) &&
      !/^#{1,4}\s/.test(lines[index]) &&
      !/^\s*[-*+]\s+/.test(lines[index]) &&
      !/^\s*\d+[.)]\s+/.test(lines[index]) &&
      !/^>\s?/.test(lines[index])
    ) {
      paragraph.push(lines[index])
      index += 1
    }
    blocks.push({ type: 'paragraph', text: paragraph.join('\n') })
  }
  return blocks
}

function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function renderBlock(block, key) {
  switch (block.type) {
    case 'code':
      return React.createElement(
        'pre',
        { key },
        React.createElement('code', null, block.text),
      )
    case 'heading':
      return React.createElement(
        `h${Math.min(4, block.level)}`,
        { key },
        inline(block.text, `${key}-`),
      )
    case 'hr':
      return React.createElement('hr', { key })
    case 'quote':
      return React.createElement('blockquote', { key }, inline(block.text, `${key}-`))
    case 'list': {
      const children = block.items.map((item, index) =>
        React.createElement('li', { key: index }, inline(item, `${key}-${index}-`)),
      )
      return React.createElement(block.ordered ? 'ol' : 'ul', { key }, children)
    }
    case 'table':
      return React.createElement(
        'table',
        { key },
        React.createElement(
          'thead',
          null,
          React.createElement(
            'tr',
            null,
            block.header.map((cell, index) => React.createElement('th', { key: index }, inline(cell, `${key}-h${index}-`))),
          ),
        ),
        React.createElement(
          'tbody',
          null,
          block.rows.map((row, rowIndex) =>
            React.createElement(
              'tr',
              { key: rowIndex },
              row.map((cell, cellIndex) =>
                React.createElement('td', { key: cellIndex }, inline(cell, `${key}-${rowIndex}-${cellIndex}-`)),
              ),
            ),
          ),
        ),
      )
    default:
      return React.createElement('p', { key }, inline(block.text, `${key}-`))
  }
}

const INLINE = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\)|https?:\/\/[^\s<]+)/g

function inline(text, prefix) {
  const nodes = []
  let last = 0
  let match
  let index = 0
  INLINE.lastIndex = 0
  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index))
    const token = match[0]
    const key = `${prefix}${index}`
    index += 1
    if (token.startsWith('**')) {
      nodes.push(React.createElement('strong', { key }, token.slice(2, -2)))
    } else if (token.startsWith('`')) {
      nodes.push(React.createElement('code', { key }, token.slice(1, -1)))
    } else if (token.startsWith('[')) {
      const link = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)
      if (link !== null && /^https?:\/\//i.test(link[2])) {
        nodes.push(
          React.createElement(
            'a',
            { key, href: link[2], target: '_blank', rel: 'noreferrer noopener' },
            link[1],
          ),
        )
      } else {
        nodes.push(token)
      }
    } else if (token.startsWith('http')) {
      nodes.push(
        React.createElement('a', { key, href: token, target: '_blank', rel: 'noreferrer noopener' }, token),
      )
    } else if (token.startsWith('*')) {
      nodes.push(React.createElement('em', { key }, token.slice(1, -1)))
    } else {
      nodes.push(token)
    }
    last = match.index + token.length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}
