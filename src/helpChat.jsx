import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

const TOPICS = [
  {
    id: 'courses',
    chip: 'What courses do you offer?',
    keys: ['course', 'program', 'ibdp', 'igcse', 'myp', 'subject', 'pathway', 'aa', 'ai', 'offer', 'teach'],
    text: 'We have structured Grade 9–12 pathways: IBDP Mathematics AA, IGCSE Additional Maths, and IGCSE International Maths. Each course has lessons, worked examples, and a question bank.',
    links: [
      { to: '/#programs', label: 'View programs' },
      { to: '/courses/ibdp-aa', label: 'IBDP AA' },
    ],
  },
  {
    id: 'signin',
    chip: 'How do I sign in?',
    keys: ['sign', 'login', 'log in', 'account', 'google', 'signup', 'sign up', 'register'],
    text: 'Use Login / Signup with your Google account. That opens the course workspace so you can pick up lessons and practice.',
    links: [{ to: '/courses/ibdp-aa', label: 'Login / Signup' }],
  },
  {
    id: 'price',
    chip: 'How much does it cost?',
    keys: ['price', 'cost', 'pay', 'fee', 'unlock', 'premium', 'subscription', 'razorpay', '₹', 'rs', 'rupee'],
    text: 'Some topics are free to browse. Premium units unlock per course, or you can buy full platform access at checkout. Full access is typically ₹1499 for 90 days, but the live price is always shown before you pay.',
    links: [{ to: '/#programs', label: 'Explore courses' }],
  },
  {
    id: 'ia',
    chip: 'Do you help with IA?',
    keys: ['ia', 'internal assessment', 'exploration', 'exemplar', 'ee'],
    text: 'Yes. The IA section has exemplars and guidance for Internal Assessment. Open it from the top menu.',
    links: [{ to: '/ia', label: 'Open IA' }],
  },
  {
    id: 'mock',
    chip: 'What is the mock generator?',
    keys: ['mock', 'paper', 'exam', 'generator', 'practice paper'],
    text: 'The Mock Generator builds exam-style papers from our question bank. Sign in, pick a course and units, then generate a paper to practise.',
    links: [{ to: '/mock-generator', label: 'Mock Generator' }],
  },
  {
    id: 'study',
    chip: 'How does studying work?',
    keys: ['how', 'work', 'lesson', 'question', 'study', 'start', 'use', 'learn'],
    text: 'Pick a course, open a topic, then switch between Lesson and Question Bank. In a course, tap the sparkle on a topic or question for maths help. Bookmarks and mistakes live in Study home after you sign in.',
    links: [
      { to: '/#programs', label: 'Choose a course' },
      { to: '/profile', label: 'Study home' },
    ],
  },
  {
    id: 'contact',
    chip: 'How do I contact you?',
    keys: ['contact', 'email', 'message', 'support', 'help', 'reach', 'talk'],
    text: 'Use the contact form on this page. We aim to reply within 24 hours. You can also write to mathelaureate@gmail.com.',
    links: [{ to: '/#contact', label: 'Contact form' }],
  },
  {
    id: 'teachers',
    chip: 'Is there anything for teachers?',
    keys: ['teacher', 'resource', 'school'],
    text: 'Yes. Teachers & Resources has posts and materials for educators.',
    links: [{ to: '/teachers-resources', label: 'Teachers & Resources' }],
  },
]

const GREETINGS = ['hi', 'hello', 'hey', 'yo', 'thanks', 'thank you', 'good morning', 'good evening']

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9₹\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function answerFor(input) {
  const query = normalize(input)
  if (!query) return null
  if (GREETINGS.some((item) => query === item || query.startsWith(`${item} `))) {
    return {
      text: 'Hello. I can help with courses, sign-in, pricing, IA, mocks, and how to get started.',
      links: [],
    }
  }
  const exact = TOPICS.find((topic) => normalize(topic.chip) === query)
  if (exact) return exact
  let best = null
  let bestScore = 0
  for (const topic of TOPICS) {
    const score = topic.keys.reduce((total, key) => total + (query.includes(key) ? key.length : 0), 0)
    if (score > bestScore) {
      best = topic
      bestScore = score
    }
  }
  if (best && bestScore >= 3) return best
  return {
    text: 'I can help with courses, sign-in, pricing, IA, the mock generator, and contact. For help with a maths question, sign in and open a course, then tap the sparkle on that question.',
    links: [
      { to: '/#programs', label: 'Programs' },
      { to: '/#contact', label: 'Contact' },
    ],
  }
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H12l-4 3.2V16H7.5A2.5 2.5 0 0 1 5 13.5v-7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  )
}

export default function HelpChat() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const scrollerRef = useRef(null)
  const inputRef = useRef(null)
  const onHome = location.pathname === '/'

  useEffect(() => {
    const node = scrollerRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, open])

  useEffect(() => {
    if (!open) return undefined
    const timer = window.setTimeout(() => inputRef.current?.focus(), 180)
    return () => window.clearTimeout(timer)
  }, [open])

  if (!onHome) return null

  function send(text) {
    const nextText = String(text || '').trim()
    if (!nextText) return
    const reply = answerFor(nextText)
    setMessages((current) => [
      ...current,
      { role: 'user', text: nextText },
      { role: 'assistant', text: reply.text, links: reply.links || [] },
    ])
    setInput('')
  }

  return (
    <div className="tutor-root">
      <section className={`tutor-panel${open ? ' is-open' : ''}`} aria-label="Mathelaureate help" aria-hidden={!open}>
        <header className="tutor-head-wrap">
          <div className="tutor-head">
            <span className="tutor-avatar" aria-hidden="true">
              <ChatIcon />
            </span>
            <div>
              <strong>Help</strong>
              <p>Courses, sign-in, pricing</p>
            </div>
            <button type="button" className="tutor-close" onClick={() => setOpen(false)} aria-label="Close help">
              ×
            </button>
          </div>
        </header>
        <div className="tutor-thread" ref={scrollerRef}>
          {messages.length === 0 ? (
            <div className="tutor-welcome">
              <p>Ask about programs, login, pricing, IA, or how to start. This is instant site help, not a maths tutor.</p>
              <div className="tutor-chips">
                {TOPICS.slice(0, 5).map((topic) => (
                  <button type="button" key={topic.id} onClick={() => send(topic.chip)}>
                    {topic.chip}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message, index) =>
              message.role === 'user' ? (
                <div className="tutor-bubble is-user" key={`user-${index}`}>
                  {message.text}
                </div>
              ) : (
                <div className="tutor-bubble is-bot" key={`bot-${index}`}>
                  {message.text}
                  {message.links?.length ? (
                    <div className="tutor-links">
                      {message.links.map((link) =>
                        link.to.startsWith('/#') || link.to.startsWith('#') ? (
                          <a key={link.to} href={link.to}>
                            {link.label}
                          </a>
                        ) : (
                          <Link key={link.to} to={link.to}>
                            {link.label}
                          </Link>
                        ),
                      )}
                    </div>
                  ) : null}
                </div>
              ),
            )
          )}
        </div>
        <form
          className="tutor-composer"
          onSubmit={(event) => {
            event.preventDefault()
            send(input)
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about the site…"
            maxLength={400}
          />
          <button type="submit" className="btn primary" disabled={!input.trim()}>
            Send
          </button>
        </form>
      </section>
      <button
        type="button"
        className={`tutor-fab${open ? ' is-open' : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Close help' : 'Open help'}
      >
        {open ? '×' : <ChatIcon />}
      </button>
    </div>
  )
}
