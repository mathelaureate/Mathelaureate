const env = globalThis.process?.env || {}

const WINDOW_MS = 10 * 60 * 1000
const MAX_REQUESTS_PER_WINDOW = 8
const rateLimitStore = globalThis.__contactRateLimitStore || new Map()
globalThis.__contactRateLimitStore = rateLimitStore

function sendJson(response, statusCode, payload) {
  response.status(statusCode).json(payload)
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function normalizeText(value, maxLength = 1000) {
  return String(value || '').trim().slice(0, maxLength)
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
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

async function sendViaBrevo({ name, email, subject, message }) {
  const apiKey = String(env.BREVO_API_KEY || '').trim()
  const senderEmail = String(env.BREVO_SENDER_EMAIL || '').trim()
  const senderName = String(env.BREVO_SENDER_NAME || 'Mathelaureate').trim()
  const toEmail = String(env.BREVO_TO_EMAIL || '').trim()
  const toName = String(env.BREVO_TO_NAME || 'Mathelaureate').trim()

  if (!apiKey || !senderEmail || !toEmail) {
    throw new Error('Brevo contact email env vars are missing.')
  }

  const payload = {
    sender: { email: senderEmail, name: senderName },
    to: [{ email: toEmail, name: toName }],
    replyTo: { email, name },
    subject: `Mathelaureate inquiry: ${subject}`,
    textContent: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\n\n${message}`,
    htmlContent: `<p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Subject:</strong> ${subject}</p><p><strong>Message:</strong></p><p>${message.replaceAll('\n', '<br />')}</p>`,
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(details || 'Brevo rejected the email request.')
  }
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed' })
    return
  }

  if (!isAllowedOrigin(request)) {
    sendJson(response, 403, { error: 'Origin not allowed.' })
    return
  }

  if (!enforceRateLimit(request)) {
    sendJson(response, 429, { error: 'Too many contact requests. Please try again later.' })
    return
  }

  try {
    const body = await readRequestBody(request)
    const name = normalizeText(body?.name, 120)
    const email = normalizeEmail(body?.email)
    const subject = normalizeText(body?.subject, 140)
    const message = normalizeText(body?.message, 4000)
    const website = normalizeText(body?.website, 200)

    // Honeypot field: if filled, silently accept to avoid bot retries.
    if (website) {
      sendJson(response, 200, { ok: true })
      return
    }

    if (!name || !email || !subject || !message) {
      sendJson(response, 400, { error: 'Name, email, subject, and message are required.' })
      return
    }
    if (!isValidEmail(email)) {
      sendJson(response, 400, { error: 'Please use a valid email address.' })
      return
    }
    if (message.length < 10) {
      sendJson(response, 400, { error: 'Please provide a more detailed message.' })
      return
    }

    await sendViaBrevo({ name, email, subject, message })
    sendJson(response, 200, { ok: true })
  } catch (error) {
    sendJson(response, 500, { error: error?.message || 'Unable to send contact message.' })
  }
}
