import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import katex from 'katex'
import { auth } from './firebase'
import { TUTOR_OPEN_EVENT } from './tutor'

const COURSE_TITLES = {
  'ibdp-aa': 'IBDP Mathematics AA',
  'igcse-additional': 'IGCSE Additional Maths',
  'igcse-international': 'IGCSE International Maths',
}

export function SparkleIcon({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M12 3.2 13.2 8.4 18 9.6 13.2 10.8 12 16 10.8 10.8 6 9.6 10.8 8.4 12 3.2Z"
        fill="currentColor"
      />
      <path d="M18.2 14.2 18.8 16.6 21.2 17.2 18.8 17.8 18.2 20.2 17.6 17.8 15.2 17.2 17.6 16.6 18.2 14.2Z" fill="currentColor" />
      <path d="M6.4 13.4 6.9 15.2 8.7 15.7 6.9 16.2 6.4 18 5.9 16.2 4.1 15.7 5.9 15.2 6.4 13.4Z" fill="currentColor" />
    </svg>
  )
}

function apiBase() {
  return String(import.meta.env.VITE_PAYMENT_API_BASE_URL || '/api').replace(/\/$/, '')
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function renderChatSafe(value) {
  const raw = String(value || '')
  const token = '@@K@@'
  const chunks = []
  const masked = raw.replace(/(\$\$[\s\S]+?\$\$|\$[^$\n]+\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g, (segment) => {
    let html = segment
    try {
      if (segment.startsWith('$$') && segment.endsWith('$$')) {
        html = katex.renderToString(segment.slice(2, -2).trim(), { throwOnError: false, displayMode: true, strict: 'ignore' })
      } else if (segment.startsWith('\\[') && segment.endsWith('\\]')) {
        html = katex.renderToString(segment.slice(2, -2).trim(), { throwOnError: false, displayMode: true, strict: 'ignore' })
      } else if (segment.startsWith('\\(') && segment.endsWith('\\)')) {
        html = katex.renderToString(segment.slice(2, -2).trim(), { throwOnError: false, displayMode: false, strict: 'ignore' })
      } else {
        html = katex.renderToString(segment.slice(1, -1).trim(), { throwOnError: false, displayMode: false, strict: 'ignore' })
      }
    } catch {
      html = escapeHtml(segment)
    }
    chunks.push(html)
    return `${token}${chunks.length - 1}${token}`
  })
  return escapeHtml(masked)
    .replace(/\n/g, '<br />')
    .replace(new RegExp(`${token}(\\d+)${token}`, 'g'), (_, index) => chunks[Number(index)] || '')
}

function pageContext(pathname, search) {
  const slug = pathname.match(/^\/courses\/([^/]+)/)?.[1] || ''
  const params = new URLSearchParams(search)
  return {
    kind: 'page',
    path: pathname,
    courseSlug: slug,
    courseTitle: COURSE_TITLES[slug] || '',
    subunit: String(params.get('subunit') || '').trim(),
  }
}

function mergeContext(page, focus) {
  if (!focus) return page
  return { ...page, ...focus }
}

function starterPrompts(context) {
  if (context?.kind === 'question') {
    return ['Give me a hint, not the answer', 'Check my working', 'Explain the method', 'Give me a similar question']
  }
  if (context?.subunit) {
    return [`Explain ${context.subunit} simply`, 'Show a worked example', 'What mistakes should I avoid?', 'Give me a practice question']
  }
  return ['Explain this topic simply', 'Give me a hint, not the answer', 'Check my working', 'Give me a similar exam question']
}

function contextCaption(context) {
  if (context?.kind === 'question') {
    return [context.label, context.subunit].filter(Boolean).join(' · ')
  }
  if (context?.kind === 'topic' || context?.subunit) {
    return [context.subunit || context.label, context.unitName].filter(Boolean).join(' · ')
  }
  return ''
}

async function askTutor({ messages, context, token }) {
  if (!token) throw new Error('Sign in to chat with Laureate.')
  const response = await fetch(`${apiBase()}/tutor-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messages: messages.map((item) => ({ role: item.role, text: item.text })),
      context,
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (response.ok && data?.text) return String(data.text)
  throw new Error(data?.error || 'Tutor is unavailable right now.')
}

function ChatBubble({ message }) {
  if (message.role === 'user') {
    return <div className="tutor-bubble is-user">{message.text}</div>
  }
  return (
    <div
      className="tutor-bubble is-bot latex-text"
      dangerouslySetInnerHTML={{ __html: renderChatSafe(message.text) }}
    />
  )
}

export default function TutorChat({ user }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [messages, setMessages] = useState([])
  const [focus, setFocus] = useState(null)
  const scrollerRef = useRef(null)
  const hidden = /^\/(admin|editor)(\/|$)/.test(location.pathname)
  const page = useMemo(
    () => pageContext(location.pathname, location.search),
    [location.pathname, location.search],
  )
  const context = useMemo(() => mergeContext(page, focus), [page, focus])
  const prompts = starterPrompts(context)
  const caption = contextCaption(context)
  const placeholder =
    context.kind === 'question'
      ? 'Ask about this question…'
      : context.subunit
        ? `Ask about ${context.subunit}…`
        : 'Ask a maths question…'

  useEffect(() => {
    const node = scrollerRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, busy, open])

  useEffect(() => {
    function onOpen(event) {
      const detail = event.detail || {}
      setFocus(detail.kind ? detail : null)
      setMessages([])
      setError('')
      setInput('')
      setOpen(true)
    }
    window.addEventListener(TUTOR_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(TUTOR_OPEN_EVENT, onOpen)
  }, [])

  if (hidden) return null

  async function send(text) {
    const nextText = String(text || '').trim()
    if (!nextText || busy) return
    if (!user) {
      navigate('/courses/ibdp-aa')
      return
    }
    const history = [...messages, { role: 'user', text: nextText }]
    setMessages(history)
    setInput('')
    setBusy(true)
    setError('')
    try {
      const token = await auth.currentUser?.getIdToken?.()
      const reply = await askTutor({ messages: history, context, token })
      setMessages([...history, { role: 'assistant', text: reply }])
    } catch (sendError) {
      setError(sendError?.message || 'Unable to reach Laureate.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="tutor-root">
      {open ? (
        <section className="tutor-panel" aria-label="Laureate maths tutor">
          <header className="tutor-head-wrap">
            <div className="tutor-head">
              <span className="tutor-avatar" aria-hidden="true">
                <SparkleIcon size={16} />
              </span>
              <div>
                <strong>Ask AI</strong>
                <p>{caption || 'IB maths tutor'}</p>
              </div>
              <button type="button" className="tutor-close" onClick={() => setOpen(false)} aria-label="Close chat">
                ×
              </button>
            </div>
            {caption ? (
              <div className="tutor-focus">
                <span>{context.kind === 'question' ? 'Question' : 'Topic'}</span>
                <strong>{caption}</strong>
                {focus ? (
                  <button type="button" onClick={() => setFocus(null)} aria-label="Clear attached question">
                    Clear
                  </button>
                ) : null}
              </div>
            ) : null}
          </header>
          <div className="tutor-thread" ref={scrollerRef}>
            {messages.length === 0 ? (
              <div className="tutor-welcome">
                <p>
                  {context.kind === 'question'
                    ? 'I can see this question. Ask for a hint, a check of your working, or a similar one.'
                    : context.subunit
                      ? `I am with you on ${context.subunit}. Ask for an explanation, example, or practice.`
                      : 'Tap the sparkle on a question or topic, or type anything you are stuck on.'}
                </p>
                <div className="tutor-chips">
                  {prompts.map((prompt) => (
                    <button type="button" key={prompt} onClick={() => send(prompt)}>
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message, index) => <ChatBubble key={`${message.role}-${index}`} message={message} />)
            )}
            {busy ? (
              <div className="tutor-bubble is-bot is-typing" aria-label="Laureate is typing">
                <span />
                <span />
                <span />
              </div>
            ) : null}
            {error ? <p className="tutor-error">{error}</p> : null}
          </div>
          {user ? (
            <form
              className="tutor-composer"
              onSubmit={(event) => {
                event.preventDefault()
                send(input)
              }}
            >
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={placeholder}
                maxLength={2000}
                disabled={busy}
              />
              <button type="submit" className="btn primary" disabled={busy || !input.trim()}>
                Send
              </button>
            </form>
          ) : (
            <div className="tutor-signin">
              <p>Sign in to chat.</p>
              <Link className="btn primary" to="/courses/ibdp-aa">
                Login / Signup
              </Link>
            </div>
          )}
        </section>
      ) : null}
      <button
        type="button"
        className={`tutor-fab${open ? ' is-open' : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Close Ask AI' : 'Ask AI'}
      >
        {open ? (
          '×'
        ) : (
          <>
            <SparkleIcon size={18} />
            <span>Ask AI</span>
          </>
        )}
      </button>
    </div>
  )
}
