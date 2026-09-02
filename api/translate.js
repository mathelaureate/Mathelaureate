const env = globalThis.process?.env || {}

const WINDOW_MS = 10 * 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 40
const MAX_TEXTS = 12
const MAX_CHARS = 8000
const rateLimitStore = globalThis.__translateRateLimitStore || new Map()
globalThis.__translateRateLimitStore = rateLimitStore

const TARGETS = {
  zh: 'zh-CN',
  ja: 'ja',
}

function sendJson(response, statusCode, payload) {
  response.status(statusCode).json(payload)
}

function isAllowedOrigin(request) {
  const configured = String(env.CONTACT_ALLOWED_ORIGINS || '').trim()
  if (!configured) return true
  const allowed = configured
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  if (allowed.length === 0) return true
  const origin = String(request.headers?.origin || '').trim()
  return allowed.includes(origin)
}

function enforceRateLimit(request) {
  const key = String(
    request.headers?.['x-forwarded-for'] ||
      request.headers?.['x-real-ip'] ||
      request.socket?.remoteAddress ||
      'unknown',
  )
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

async function translateWithGoogle(text, targetCode) {
  const endpoint = new URL('https://translate.googleapis.com/translate_a/single')
  endpoint.searchParams.set('client', 'gtx')
  endpoint.searchParams.set('sl', 'auto')
  endpoint.searchParams.set('tl', targetCode)
  endpoint.searchParams.set('dt', 't')
  endpoint.searchParams.set('q', text)
  const response = await fetch(endpoint)
  if (!response.ok) throw new Error('Translate upstream failed.')
  const data = await response.json()
  if (!Array.isArray(data?.[0])) throw new Error('Translate upstream returned an unexpected payload.')
  return data[0].map((part) => String(part?.[0] || '')).join('')
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
    sendJson(response, 403, { error: 'Forbidden.' })
    return
  }
  if (!enforceRateLimit(request)) {
    sendJson(response, 429, { error: 'Too many translate requests. Please wait and try again.' })
    return
  }

  try {
    const body = await readRequestBody(request)
    const target = String(body?.target || '').trim()
    const targetCode = TARGETS[target]
    const texts = Array.isArray(body?.texts) ? body.texts.map((item) => String(item ?? '')) : []
    if (!targetCode) {
      sendJson(response, 400, { error: 'Unsupported language.' })
      return
    }
    if (texts.length === 0 || texts.length > MAX_TEXTS) {
      sendJson(response, 400, { error: 'Send between 1 and 12 text strings.' })
      return
    }
    const totalChars = texts.reduce((sum, item) => sum + item.length, 0)
    if (totalChars > MAX_CHARS) {
      sendJson(response, 400, { error: 'Text is too long to translate.' })
      return
    }

    const translations = []
    for (const text of texts) {
      if (!text.trim()) {
        translations.push(text)
        continue
      }
      translations.push(await translateWithGoogle(text, targetCode))
    }
    sendJson(response, 200, { translations })
  } catch {
    sendJson(response, 500, { error: 'Unable to translate right now.' })
  }
}
