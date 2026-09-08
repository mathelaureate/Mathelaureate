import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import katex from 'katex'
import { auth, firebaseWebApiKey } from './firebase'
import { useGamify } from './gameHud'

const SYSTEM_PROMPT = `You are Laureate, the in-app maths tutor for Mathelaureate.
You help Grade 9–12 students with IBDP Mathematics AA/AI, IGCSE, and MYP.
Warm, clear, exam-aware. Short paragraphs. Hint first, then a full method if they ask or stay stuck.
Use LaTeX with $inline$ and $$display$$. Do not mention being an AI model.`

const COURSE_TITLES = {
  'ibdp-aa': 'IBDP Mathematics AA',
  'igcse-additional': 'IGCSE Additional Maths',
  'igcse-international': 'IGCSE International Maths',
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
    path: pathname,
    courseSlug: slug,
    courseTitle: COURSE_TITLES[slug] || '',
    subunit: String(params.get('subunit') || '').trim(),
  }
}

function starterPrompts(context) {
  const topic = context.subunit ? `Help me with ${context.subunit}` : 'Explain this topic simply'
  return [topic, 'Give me a hint, not the answer', 'Check my working', 'Give me a similar exam question']
}

async function askTutor({ messages, context, token }) {
  const payload = {
    messages: messages.map((item) => ({ role: item.role, text: item.text })),
    context,
  }
  if (token) {
    try {
      const response = await fetch(`${apiBase()}/tutor-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok && data?.text) return String(data.text)
      if (response.status !== 404 && response.status !== 503) {
        throw new Error(data?.error || 'Tutor is unavailable right now.')
      }
    } catch (error) {
      if (error?.message && !/fetch|404|Failed to fetch/i.test(error.message)) throw error
    }
  }

  const key = firebaseWebApiKey
  if (!key) throw new Error('Tutor is not configured.')
  const contents = payload.messages.map((item, index) => ({
    role: item.role === 'assistant' ? 'model' : 'user',
    parts: [
      {
        text:
          index === 0 && item.role === 'user' && (context.courseTitle || context.subunit)
            ? `Student context: ${[context.courseTitle, context.subunit, context.path].filter(Boolean).join(' · ')}\n\n${item.text}`
            : item.text,
      },
    ],
  }))
  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { temperature: 0.6, maxOutputTokens: 2048 },
      }),
    },
  )
  const data = await upstream.json().catch(() => ({}))
  if (!upstream.ok) throw new Error(data?.error?.message || 'Tutor is unavailable right now.')
  const text = (data?.candidates?.[0]?.content?.parts || []).map((part) => String(part?.text || '')).join('').trim()
  if (!text) throw new Error('Laureate did not return a reply. Try again.')
  return text
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
  const { award } = useGamify()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [messages, setMessages] = useState([])
  const scrollerRef = useRef(null)
  const hidden = /^\/(admin|editor)(\/|$)/.test(location.pathname)
  const context = useMemo(
    () => pageContext(location.pathname, location.search),
    [location.pathname, location.search],
  )
  const prompts = starterPrompts(context)

  useEffect(() => {
    const node = scrollerRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, busy, open])

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
      award({ type: 'tutor' }).catch(() => {})
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
          <header className="tutor-head">
            <span className="tutor-avatar" aria-hidden="true">
              L
            </span>
            <div>
              <strong>Laureate</strong>
              <p>IB maths tutor</p>
            </div>
            <button type="button" className="tutor-close" onClick={() => setOpen(false)} aria-label="Close chat">
              ×
            </button>
          </header>
          <div className="tutor-thread" ref={scrollerRef}>
            {messages.length === 0 ? (
              <div className="tutor-welcome">
                <p>Ask for a hint, a worked method, or a similar question. I stay with you on this page.</p>
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
                placeholder="Ask Laureate…"
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
        aria-label={open ? 'Close Laureate' : 'Ask Laureate'}
      >
        {open ? (
          '×'
        ) : (
          <>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H12l-4 3.2V16H7.5A2.5 2.5 0 0 1 5 13.5v-7Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path d="M8.5 9h7M8.5 12h4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span>Ask</span>
          </>
        )}
      </button>
    </div>
  )
}
