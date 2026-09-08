import { getAuthUserFromRequest, sendJson } from './_lib/payment.js'

const env = globalThis.process?.env || {}
const WINDOW_MS = 10 * 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 30
const MAX_MESSAGE_CHARS = 2000
const MAX_HISTORY = 12
const rateLimitStore = globalThis.__tutorRateLimitStore || new Map()
globalThis.__tutorRateLimitStore = rateLimitStore

const SYSTEM_PROMPT = `You are Laureate, the in-app maths tutor for Mathelaureate.
You help Grade 9–12 students with IBDP Mathematics AA/AI, IGCSE, and MYP.

Style:
- Warm, clear, and exam-aware. Short paragraphs.
- Prefer a hint or a next step first. If they ask for the full method or are still stuck, give a complete worked solution.
- Use LaTeX with $inline$ and $$display$$ so it renders on the site.
- Do not mention being an AI model or Gemini.
- If the page context names a course or subunit, stay on that topic unless they change it.
- Never invent IB markschemes. If unsure, say so and show a standard method.`

function geminiKey() {
  return String(env.GEMINI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY || '').trim()
}

function enforceRateLimit(uid) {
  const key = String(uid || 'unknown')
  const now = Date.now()
  const current = rateLimitStore.get(key)
  if (!current || now - current.windowStart > WINDOW_MS) {
    rateLimitStore.set(key, { windowStart: now, count: 1 })
    return true
  }
  if (current.count >= MAX_REQUESTS_PER_WINDOW) return false
  current.count += 1
  rateLimitStore.set(key, current)
  return true
}

async function readRequestBody(request) {
  if (!request?.body) return {}
  if (typeof request.body === 'string') return JSON.parse(request.body || '{}')
  return request.body
}

function normalizeMessages(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => ({
      role: item?.role === 'assistant' || item?.role === 'model' ? 'model' : 'user',
      text: String(item?.text || item?.content || '').trim().slice(0, MAX_MESSAGE_CHARS),
    }))
    .filter((item) => item.text)
    .slice(-MAX_HISTORY)
}

function contextBlock(context) {
  const course = String(context?.courseTitle || context?.courseSlug || '').trim()
  const subunit = String(context?.subunit || '').trim()
  const path = String(context?.path || '').trim()
  if (!course && !subunit && !path) return ''
  return `Student context: ${[course, subunit, path].filter(Boolean).join(' · ')}`
}

export default async function handler(request, response) {
  if (request.method === 'OPTIONS') {
    response.status(204).end()
    return
  }
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed.' })
    return
  }

  try {
    const authUser = await getAuthUserFromRequest(request)
    if (!authUser?.uid) {
      sendJson(response, 401, { error: 'Sign in to chat with Laureate.' })
      return
    }
    if (!enforceRateLimit(authUser.uid)) {
      sendJson(response, 429, { error: 'Too many tutor messages. Wait a few minutes.' })
      return
    }

    const key = geminiKey()
    if (!key) {
      sendJson(response, 503, { error: 'Tutor is not configured.' })
      return
    }

    const body = await readRequestBody(request)
    const messages = normalizeMessages(body?.messages)
    if (!messages.length) {
      sendJson(response, 400, { error: 'Send a message.' })
      return
    }

    const prefix = contextBlock(body?.context)
    const contents = messages.map((item, index) => ({
      role: item.role,
      parts: [{ text: prefix && index === 0 && item.role === 'user' ? `${prefix}\n\n${item.text}` : item.text }],
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
    const payload = await upstream.json().catch(() => ({}))
    if (!upstream.ok) {
      sendJson(response, 502, { error: payload?.error?.message || 'Tutor is unavailable right now.' })
      return
    }
    const text = (payload?.candidates?.[0]?.content?.parts || [])
      .map((part) => String(part?.text || ''))
      .join('')
      .trim()
    if (!text) {
      sendJson(response, 502, { error: 'Laureate did not return a reply. Try again.' })
      return
    }
    sendJson(response, 200, { text })
  } catch (error) {
    sendJson(response, 500, { error: error?.message || 'Unable to chat right now.' })
  }
}
