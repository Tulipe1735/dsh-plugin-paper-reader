import React from 'react'
import { API, ChatIcon, ChevronRightIcon, SendIcon, SparkIcon, StopIcon, TrashIcon, XIcon } from './shared.jsx'
import { Markdown } from './markdown.jsx'

const PAPER_SUGGESTIONS = {
  zh: [
    '这篇论文想解决什么问题？核心贡献是什么？',
    '用三句话概括它的方法。',
    '解释一下这里的关键公式 / 术语。',
    '这篇论文有哪些局限或可疑之处？',
  ],
  en: [
    'What problem does this paper solve, and what is its core contribution?',
    'Summarize the method in three sentences.',
    'Explain the key equation or terminology here.',
    'What are the limitations or questionable points?',
  ],
}

const ARTICLE_SUGGESTIONS = {
  zh: [
    '这篇文章的核心观点是什么？',
    '用三句话概括全文。',
    '解释一下这里的关键概念 / 代码。',
    '这篇文章有哪些值得质疑或补充的地方？',
  ],
  en: [
    'What is the core argument of this article?',
    'Summarize it in three sentences.',
    'Explain the key concept or code snippet here.',
    'What is questionable or missing in this article?',
  ],
}

function suggestionsFor(lang, type) {
  return type === 'paper' ? PAPER_SUGGESTIONS[lang] : ARTICLE_SUGGESTIONS[lang]
}

export function ChatRail({
  lang,
  paper,
  open,
  onToggle,
  model,
  initialMessages,
  focusBlock,
  selection,
  onClearFocus,
  onClearSelection,
}) {
  const [messages, setMessages] = React.useState(() =>
    (Array.isArray(initialMessages) ? initialMessages : []).map((message) => ({
      role: message.role,
      content: message.content,
      at: message.at,
    })),
  )
  const [draft, setDraft] = React.useState('')
  const [streaming, setStreaming] = React.useState(false)
  const [error, setError] = React.useState('')
  const abortRef = React.useRef(null)
  const bodyRef = React.useRef(null)
  const textareaRef = React.useRef(null)

  React.useEffect(
    () => () => {
      abortRef.current?.abort()
    },
    [],
  )

  const scrollToBottom = React.useCallback((smooth = false) => {
    const element = bodyRef.current
    if (element === null) return
    element.scrollTo({ top: element.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  React.useEffect(() => {
    if (!open) return
    const element = bodyRef.current
    if (element === null) return
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 120
    if (nearBottom || streaming) scrollToBottom()
  }, [messages, open, streaming, scrollToBottom])

  React.useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => scrollToBottom(), 40)
    return () => window.clearTimeout(timer)
  }, [open, scrollToBottom])

  React.useEffect(() => {
    const element = textareaRef.current
    if (element === null) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(150, Math.max(62, element.scrollHeight))}px`
  }, [draft, open])

  const send = React.useCallback(
    async (raw) => {
      const text = String(raw ?? draft).trim()
      if (text === '' || streaming) return
      setDraft('')
      setError('')
      const user = { role: 'user', content: text, at: Date.now() }
      const history = [...messages, user]
      setMessages([...history, { role: 'assistant', content: '', streaming: true }])
      setStreaming(true)
      const controller = new AbortController()
      abortRef.current = controller

      const append = (delta) => {
        setMessages((current) =>
          current.map((message, index) =>
            index === current.length - 1 ? { ...message, content: message.content + delta } : message,
          ),
        )
      }
      const settle = () => {
        setMessages((current) =>
          current.map((message, index) =>
            index === current.length - 1 ? { ...message, streaming: false } : message,
          ),
        )
      }

      try {
        const response = await fetch(`${API}chat`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            id: paper.id,
            messages: history,
            selection: selection ?? undefined,
            focusBlockId: focusBlock?.id,
          }),
          signal: controller.signal,
        })
        if (!response.ok) {
          const value = await response.json().catch(() => ({}))
          throw new Error(value.error ?? `请求失败 (${response.status})`)
        }
        const reader = response.body?.getReader()
        if (reader === undefined) throw new Error('浏览器不支持流式响应')
        const decoder = new TextDecoder()
        let buffer = ''
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          let boundary = buffer.indexOf('\n\n')
          while (boundary >= 0) {
            const frame = buffer.slice(0, boundary)
            buffer = buffer.slice(boundary + 2)
            for (const line of frame.split('\n')) {
              if (!line.startsWith('data:')) continue
              const payload = line.slice(5).trim()
              if (payload === '') continue
              let event
              try {
                event = JSON.parse(payload)
              } catch {
                continue
              }
              if (event.type === 'delta' && typeof event.text === 'string') append(event.text)
              else if (event.type === 'error') setError(String(event.message ?? '模型调用失败'))
            }
            boundary = buffer.indexOf('\n\n')
          }
        }
        settle()
        onClearSelection?.()
      } catch (failure) {
        if (failure instanceof DOMException && failure.name === 'AbortError') {
          settle()
        } else {
          setError(failure instanceof Error ? failure.message : String(failure))
          settle()
        }
      } finally {
        setStreaming(false)
        abortRef.current = null
      }
    },
    [draft, messages, streaming, paper.id, selection, focusBlock, onClearSelection],
  )

  const stop = () => {
    abortRef.current?.abort()
  }

  const clear = async () => {
    if (streaming) stop()
    setMessages([])
    setError('')
    try {
      await fetch(`${API}chat/clear`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: paper.id }),
      })
    } catch {
      /* ignore */
    }
  }

  if (!open) {
    return React.createElement(
      'aside',
      { className: 'pr-chat', 'data-open': 'false', 'aria-label': lang === 'zh' ? (paper.type === 'paper' ? '论文对话' : '文章对话') : 'Reader chat' },
      React.createElement(
        'button',
        { type: 'button', className: 'pr-rail', onClick: onToggle, title: lang === 'zh' ? '展开对话' : 'Open chat' },
        React.createElement(ChatIcon, { size: 18 }),
        React.createElement('span', { className: 'pr-rail-label' }, lang === 'zh' ? '问这篇文章' : 'Ask this piece'),
        React.createElement('span', { className: 'pr-rail-dot' }),
      ),
    )
  }

  return React.createElement(
    'aside',
    { className: 'pr-chat', 'data-open': 'true', 'aria-label': lang === 'zh' ? (paper.type === 'paper' ? '论文对话' : '文章对话') : 'Reader chat' },
    React.createElement(
      'div',
      { className: 'pr-chat-head' },
      React.createElement(SparkIcon, { size: 15 }),
      React.createElement('b', null, lang === 'zh' ? (paper.type === 'paper' ? '论文对话' : '文章对话') : 'Reader chat'),
      model !== '' ? React.createElement('span', { className: 'pr-chat-model', title: model }, model) : null,
      React.createElement('span', { className: 'pr-chat-head-spacer' }),
      messages.length > 0
        ? React.createElement(
            'button',
            {
              type: 'button',
              className: 'pr-icon-btn',
              title: lang === 'zh' ? '清空对话' : 'Clear chat',
              onClick: () => void clear(),
            },
            React.createElement(TrashIcon, { size: 15 }),
          )
        : null,
      React.createElement(
        'button',
        {
          type: 'button',
          className: 'pr-icon-btn',
          title: lang === 'zh' ? '收起对话' : 'Collapse chat',
          onClick: onToggle,
        },
        React.createElement(ChevronRightIcon, { size: 16 }),
      ),
    ),
    React.createElement(
      'div',
      { className: 'pr-chat-body', ref: bodyRef },
      messages.length === 0
        ? React.createElement(
            'div',
            { className: 'pr-chat-empty' },
            React.createElement('div', { className: 'pr-chat-empty-mark' }, React.createElement(SparkIcon, { size: 20 })),
            React.createElement('h3', null, lang === 'zh' ? '问点什么' : 'Ask something'),
            React.createElement(
              'p',
              null,
              lang === 'zh'
                ? '模型能看到这篇文章的结构、摘要和相关原文片段。适合问方法、公式、贡献与局限。'
                : 'The model can see this paper\'s structure, abstract and the most relevant passages.',
            ),
            React.createElement(
              'div',
              { className: 'pr-suggests' },
              suggestionsFor(lang, paper.type).map((suggestion) =>
                React.createElement(
                  'button',
                  { key: suggestion, type: 'button', className: 'pr-suggest', onClick: () => void send(suggestion) },
                  suggestion,
                ),
              ),
            ),
          )
        : messages.map((message, index) =>
            message.role === 'user'
              ? React.createElement(
                  'div',
                  { key: index, className: 'pr-msg pr-msg-user', 'data-role': 'user' },
                  React.createElement('div', { className: 'pr-msg-label' }, lang === 'zh' ? '你' : 'You'),
                  React.createElement('div', { className: 'pr-msg-bubble' }, message.content),
                )
              : React.createElement(
                  'div',
                  { key: index, className: 'pr-msg pr-msg-assistant', 'data-role': 'assistant' },
                  React.createElement(
                    'div',
                    { className: 'pr-msg-label' },
                    React.createElement(SparkIcon, { size: 10 }),
                    'DSH',
                  ),
                  React.createElement(
                    'div',
                    { className: 'pr-msg-bubble' },
                    message.content !== ''
                      ? React.createElement(Markdown, { text: message.content })
                      : message.streaming === true
                        ? React.createElement(
                            'span',
                            { className: 'pr-thinking' },
                            React.createElement('i'),
                            React.createElement('i'),
                            React.createElement('i'),
                            lang === 'zh' ? '正在阅读…' : 'Reading…',
                          )
                        : null,
                    message.streaming === true && message.content !== ''
                      ? React.createElement('span', { className: 'pr-caret' })
                      : null,
                  ),
                ),
          ),
    ),
    React.createElement(
      'div',
      { className: 'pr-composer' },
      focusBlock !== undefined || (selection !== undefined && selection !== '')
        ? React.createElement(
            'div',
            { className: 'pr-context-chips' },
            focusBlock !== undefined
              ? React.createElement(
                  'span',
                  { className: 'pr-ctx', title: focusBlock.text },
                  React.createElement('span', null, `${lang === 'zh' ? '引用' : 'Ref'} ${focusBlock.id}`),
                  React.createElement(
                    'button',
                    { type: 'button', onClick: onClearFocus, title: lang === 'zh' ? '取消引用' : 'Remove reference' },
                    React.createElement(XIcon, { size: 9 }),
                  ),
                )
              : null,
            selection !== undefined && selection !== ''
              ? React.createElement(
                  'span',
                  { className: 'pr-ctx', title: selection },
                  React.createElement('span', null, `${lang === 'zh' ? '选中' : 'Selection'} · ${Math.min(selection.length, 999)} ${lang === 'zh' ? '字' : 'chars'}`),
                  React.createElement(
                    'button',
                    { type: 'button', onClick: onClearSelection, title: lang === 'zh' ? '取消选中' : 'Clear selection' },
                    React.createElement(XIcon, { size: 9 }),
                  ),
                )
              : null,
          )
        : null,
      React.createElement(
        'div',
        { className: 'pr-input-wrap' },
        React.createElement('textarea', {
          ref: textareaRef,
          value: draft,
          placeholder: lang === 'zh' ? '问这篇文章的任何问题…' : 'Ask anything about this piece…',
          onChange: (event) => setDraft(event.target.value),
          onKeyDown: (event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              void send()
            }
          },
        }),
        React.createElement(
          'div',
          { className: 'pr-input-foot' },
          React.createElement(
            'span',
            { className: 'pr-input-hint' },
            lang === 'zh' ? 'Enter 发送 · Shift+Enter 换行' : 'Enter to send · Shift+Enter for a new line',
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'pr-send',
              'data-stop': streaming ? 'true' : 'false',
              disabled: !streaming && draft.trim() === '',
              title: streaming ? (lang === 'zh' ? '停止' : 'Stop') : lang === 'zh' ? '发送' : 'Send',
              onClick: () => (streaming ? stop() : void send()),
            },
            streaming ? React.createElement(StopIcon) : React.createElement(SendIcon, { size: 15 }),
          ),
        ),
      ),
      error !== ''
        ? React.createElement(
            'div',
            { className: 'pr-chat-error' },
            error,
            ' ',
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'pr-pill-btn',
                style: { height: 20, padding: '0 6px', marginLeft: 4 },
                onClick: () => {
                  setError('')
                  const lastUser = [...messages].reverse().find((message) => message.role === 'user')
                  if (lastUser !== undefined) {
                    setMessages((current) => current.slice(0, -2))
                    void send(lastUser.content)
                  }
                },
              },
              lang === 'zh' ? '重试' : 'Retry',
            ),
          )
        : null,
    ),
  )
}
