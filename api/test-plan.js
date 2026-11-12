import { getAuthUserFromRequest, sendJson } from './_lib/firebaseAdmin.js'
import { buildPlanFromModel, diffIsoDays, isoDate, normalizeTopicList, sessionDates } from '../src/testPlanModel.js'

const env = globalThis.process?.env || {}
const WINDOW_MS = 10 * 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 8
const MODELS = ['gpt-4.1-mini', 'gpt-4o-mini']
const PUBLIC_ERRORS = {
  400: 'Check the topics and the test date.',
  401: 'Sign in to build a test plan.',
  403: 'Test plans are not available from this site.',
  429: 'Too many plans. Wait a few minutes.',
  503: 'Tutor is not configured.',
}
const rateLimitStore = globalThis.__testPlanRateLimitStore || new Map()
globalThis.__testPlanRateLimitStore = rateLimitStore

const SYSTEM_PROMPT = `You plan revision for a Grade 9–12 maths student on Mathelaureate.
Courses include IBDP Mathematics AA, IBDP Mathematics AI, IGCSE, and MYP.
Return a JSON object only.
Shape: {"summary":"one sentence","days":[{"date":"YYYY-MM-DD","title":"4 to 8 words","tasks":[{"label":"one concrete action","topic":"exact topic from the list"}]}]}
Rules:
- Use only the study dates you are given, in that order. Do not add days.
- Two tasks on each day. Three tasks on the last day, and that day must mix the topics.
- Each task fits the minutes given: read a named topic, do a small set of questions, or redo a mistake.
- topic must be copied exactly from the topic list, or be an empty string.
- Stay on the topics they named. Do not invent markschemes or extra syllabus content.
- No markdown.`

function openaiKey() {
  return String(env.OPENAI_API_KEY || env.open_api_key || env.OPEN_API_KEY || '').trim()
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
  return PUBLIC_ERRORS[status] || 'Could not build a plan. Try again.'
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

function serverToday() {
  return new Date().toISOString().slice(0, 10)
}

function messageText(payload) {
  const content = payload?.choices?.[0]?.message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === 'string' ? part : String(part?.text || ''))).join('')
  }
  return ''
}

function planPrompt({ courseTitle, examDate, today, minutes, topics, weakTopics, dates, spaced }) {
  const lines = [
    `Course: ${courseTitle}`,
    `Test date: ${examDate}`,
    `Today: ${today}`,
    `Minutes for each study day: ${minutes}`,
    'Topics:',
    ...topics.map((topic) => `- ${topic}`),
  ]
  if (weakTopics.length) {
    lines.push('Weigh these more heavily because the student missed them:')
    for (const topic of weakTopics) lines.push(`- ${topic}`)
  }
  lines.push(spaced ? 'Study days are spaced out before the test. Use only these dates:' : 'Study days, in order:')
  for (const date of dates) lines.push(date)
  lines.push(
    dates[dates.length - 1] === examDate
      ? 'The test is today, so keep this to a short revision.'
      : 'The last date is the final revision before the test.',
  )
  return lines.join('\n')
}

async function completePlan({ key, prompt, dates, topics }) {
  let lastStatus = 502
  for (const model of MODELS) {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 1800,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
      }),
    })
    if (!upstream.ok) {
      lastStatus = upstream.status === 429 ? 429 : 502
      continue
    }
    const payload = await upstream.json().catch(() => ({}))
    const plan = buildPlanFromModel(messageText(payload), { dates, topics })
    if (plan) return plan
  }
  return { errorStatus: lastStatus }
}

export default async function handler(request, response) {
  if (request.method === 'OPTIONS') {
    response.status(204).end()
    return
  }
  if (request.method === 'GET') {
    sendJson(response, 200, { ok: true })
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
    const key = openaiKey()
    if (!key) {
      sendJson(response, 503, { error: clientError(503) })
      return
    }

    const body = await readRequestBody(request)
    const today = isoDate(body?.today)
    const examDate = isoDate(body?.examDate)
    const topics = normalizeTopicList(body?.topics, 8)
    const weakTopics = normalizeTopicList(body?.weakTopics, 6)
    const minutes = Number(body?.minutesPerDay) === 30 || Number(body?.minutesPerDay) === 60 ? Number(body.minutesPerDay) : 45
    const courseTitle = String(body?.courseTitle || 'Mathematics').trim().slice(0, 80)
    const drift = today ? Math.abs(diffIsoDays(serverToday(), today)) : 99
    const sessions = today && examDate ? sessionDates(today, examDate) : null
    if (!today || !examDate || drift > 1 || !sessions || topics.length === 0) {
      sendJson(response, 400, { error: clientError(400) })
      return
    }

    const result = await completePlan({
      key,
      dates: sessions.dates,
      topics,
      prompt: planPrompt({
        courseTitle,
        examDate,
        today,
        minutes,
        topics,
        weakTopics,
        dates: sessions.dates,
        spaced: sessions.spaced,
      }),
    })
    if (result?.errorStatus || !result?.days) {
      sendJson(response, result?.errorStatus === 429 ? 429 : 502, { error: clientError(result?.errorStatus === 429 ? 429 : 502) })
      return
    }
    sendJson(response, 200, {
      summary: result.summary,
      spaced: sessions.spaced,
      examDate,
      minutesPerDay: minutes,
      days: result.days,
    })
  } catch {
    sendJson(response, 500, { error: clientError(500) })
  }
}
