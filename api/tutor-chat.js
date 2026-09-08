import { getAuthUserFromRequest, sendJson } from './_lib/payment.js'

const env = globalThis.process?.env || {}
const WINDOW_MS = 10 * 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 30
const MAX_MESSAGE_CHARS = 2000
const MAX_HISTORY = 12
const PUBLIC_ERRORS = {
  400: 'Send a message.',
  401: 'Sign in to chat with Laureate.',
  403: 'Tutor is not available from this site.',
  429: 'Too many tutor messages. Wait a few minutes.',
  503: 'Tutor is not configured.',
}
const rateLimitStore = globalThis.__tutorRateLimitStore || new Map()
globalThis.__tutorRateLimitStore = rateLimitStore

const SYSTEM_PROMPT = `You are Laureate, the in-app maths tutor for Mathelaureate.
You help Grade 9–12 students with IBDP Mathematics AA/AI, IGCSE, and MYP.

Style:
- Warm, clear, and exam-aware. Short paragraphs.
- Prefer a hint or a next step first. If they ask for the full method or are still stuck, give a complete worked solution.
- Use LaTeX with $inline$ and $$display$$ so it renders on the site.
- Do not mention being an AI model or Gemini.
- If the page context names a course, topic, or attached question, stay on that unless they change it.
- If a question is attached, tutor THAT question. Hint first. Do not dump the full answer unless they ask.
- Never invent IB markschemes. If unsure, say so and show a standard method.`

function geminiKey() {
  return String(env.GEMINI_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY || '').trim()
}

function isAllowedOrigin(request) {
  const configured = String(env.CONTACT_ALLOWED_ORIGINS || '').trim()
  if (!configured) return true
  const allowed = configured
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  if (!allowed.length) return true
  const origin = String(request.headers?.origin || '').trim()
  if (!origin) return true
  return allowed.includes(origin)
}

function clientError(status) {
  return PUBLIC_ERRORS[status] || 'Unable to chat right now.'
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
  const course = String(context?.courseTitle || context?.courseSlug || '').trim().slice(0, 120)
  const unit = String(context?.unitName || '').trim().slice(0, 160)
  const subunit = String(context?.subunit || '').trim().slice(0, 160)
  const questionText = String(context?.questionText || '').trim().slice(0, 1800)
  const questionNumber = String(context?.questionNumber || '').trim().slice(0, 12)
  const meta = [
    context?.marks ? `${context.marks} marks` : '',
    context?.difficulty || '',
    context?.gdc || '',
    context?.questionLevel || '',
  ]
    .map((item) => String(item).trim())
    .filter(Boolean)
    .join(', ')
  const lines = []
  const study = [course, unit, subunit].filter(Boolean).join(' · ')
  if (study) lines.push(`Student is studying: ${study}`)
  if (questionText) {
    lines.push(`They attached this exam question${questionNumber ? ` (Question ${questionNumber})` : ''}.`)
    if (meta) lines.push(`Question meta: ${meta}`)
    lines.push(questionText)
    lines.push('Help with THIS question. Give a hint first unless they ask for the full method.')
  } else if (subunit) {
    lines.push('Help with this topic. Hint or a short example first unless they ask for a full worked solution.')
  }
  return lines.join('\n')
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
  if (!isAllowedOrigin(request)) {
    sendJson(response, 403, { error: clientError(403) })
    return
  }

  try {
    const authUser = await getAuthUserFromRequest(request)
    if (!authUser?.uid) {
      sendJson(response, 401, { error: clientError(401) })
      return
    }
    if (!enforceRateLimit(authUser.uid)) {
      sendJson(response, 429, { error: clientError(429) })
      return
    }

    const key = geminiKey()
    if (!key) {
      sendJson(response, 503, { error: clientError(503) })
      return
    }

    const body = await readRequestBody(request)
    const messages = normalizeMessages(body?.messages)
    if (!messages.length) {
      sendJson(response, 400, { error: clientError(400) })
      return
    }

    const prefix = contextBlock(body?.context)
    const contents = messages.map((item, index) => ({
      role: item.role,
      parts: [{ text: prefix && index === 0 && item.role === 'user' ? `${prefix}\n\n${item.text}` : item.text }],
    }))

    const upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { temperature: 0.6, maxOutputTokens: 2048 },
      }),
    })
    const payload = await upstream.json().catch(() => ({}))
    if (!upstream.ok) {
      sendJson(response, 502, { error: 'Tutor is unavailable right now.' })
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
  } catch {
    sendJson(response, 500, { error: clientError(500) })
  }
}
