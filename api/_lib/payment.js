import admin from 'firebase-admin'
import crypto from 'node:crypto'
import Razorpay from 'razorpay'

const FX_FALLBACK_INR_PER_USD = 95
const PAYWALL_PATH = 'appData/paywall'
const env = globalThis.process?.env || {}
const BufferApi = globalThis.Buffer
const ENCRYPTION_VERSION = 'v1'

function parseServiceAccountFromEnv() {
  const rawJson = env.FIREBASE_SERVICE_ACCOUNT_JSON || env.FIREBASE_SERVICE_ACCOUNT
  if (rawJson) {
    const parsed = JSON.parse(rawJson)
    if (parsed?.private_key) {
      parsed.private_key = String(parsed.private_key).replace(/\\n/g, '\n')
    }
    return parsed
  }

  const projectId = env.FIREBASE_PROJECT_ID
  const clientEmail = env.FIREBASE_CLIENT_EMAIL
  const privateKey = env.FIREBASE_PRIVATE_KEY

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin credentials are missing.')
  }

  return {
    project_id: projectId,
    client_email: clientEmail,
    private_key: String(privateKey).replace(/\\n/g, '\n'),
  }
}

export function getAdminApp() {
  if (!admin.apps.length) {
    const serviceAccount = parseServiceAccountFromEnv()
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    })
  }
  return admin.app()
}

export function getDb() {
  getAdminApp()
  return admin.firestore()
}

export function getRazorpayClient() {
  const keyId = String(env.RAZORPAY_KEY_ID || env.VITE_RAZORPAY_KEY_ID || '').trim()
  const keySecret = String(env.RAZORPAY_KEY_SECRET || '').trim()
  if (!keyId || !keySecret) {
    throw new Error('Razorpay server credentials are missing.')
  }
  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  })
}

export function getRazorpayPublicKey() {
  return String(env.RAZORPAY_KEY_ID || env.VITE_RAZORPAY_KEY_ID || '').trim()
}

function getEncryptionKeyBuffer() {
  const raw = String(env.PAYMENT_DATA_ENCRYPTION_KEY || '').trim()
  if (!raw) {
    throw new Error('PAYMENT_DATA_ENCRYPTION_KEY is missing.')
  }

  let keyBuffer = null
  try {
    keyBuffer = BufferApi?.from(raw, 'base64')
  } catch {
    keyBuffer = null
  }
  if (!keyBuffer || keyBuffer.length !== 32) {
    keyBuffer = BufferApi?.from(raw, 'hex')
  }
  if (!keyBuffer || keyBuffer.length !== 32) {
    throw new Error('PAYMENT_DATA_ENCRYPTION_KEY must be a 32-byte key in base64 or hex.')
  }
  return keyBuffer
}

export function encryptSensitiveText(value) {
  const plainText = String(value || '')
  if (!plainText) return ''

  const key = getEncryptionKeyBuffer()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = BufferApi.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${ENCRYPTION_VERSION}:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`
}

export async function applyVerifiedPayment({
  uid,
  email,
  orderId,
  paymentId,
  expectedCourseId = '',
  courseSlugOverride = '',
  courseTitleOverride = '',
}) {
  const db = getDb()
  const orderRef = db.collection('paymentOrders').doc(orderId)
  const orderSnap = await orderRef.get()
  if (!orderSnap.exists) {
    throw new Error('Order not found.')
  }

  const orderData = orderSnap.data() || {}
  if (String(orderData.uid || '') !== String(uid || '')) {
    throw new Error('Order does not match user.')
  }
  if (expectedCourseId && String(orderData.courseId || '') !== String(expectedCourseId || '')) {
    throw new Error('Order does not match course.')
  }

  const razorpay = getRazorpayClient()
  const [order, payment] = await Promise.all([razorpay.orders.fetch(orderId), razorpay.payments.fetch(paymentId)])
  if (!order || !payment) {
    throw new Error('Unable to validate payment details.')
  }
  if (String(payment.order_id || '') !== orderId) {
    throw new Error('Payment does not belong to this order.')
  }
  if (String(order.currency || '') !== String(orderData.currency || '')) {
    throw new Error('Currency mismatch for order.')
  }
  if (Number(order.amount || 0) !== Number(orderData.amountPaise || 0)) {
    throw new Error('Amount mismatch for order.')
  }
  if (!['authorized', 'captured'].includes(String(payment.status || ''))) {
    throw new Error('Payment is not in a successful state.')
  }

  const paymentRef = db.collection('userPayments').doc(uid)
  const paymentSnap = await paymentRef.get()
  const existingCourses = paymentSnap.exists ? paymentSnap.data()?.courses || {} : {}
  const courseId = String(orderData.courseId || '')
  const existingCourse = existingCourses[courseId] || {}
  if (existingCourse.paid === true) {
    return { alreadyPaid: true, courses: existingCourses }
  }

  const timestamp = new Date().toISOString()
  const encryptedEmail = email ? encryptSensitiveText(email) : ''
  const nextCourses = {
    ...existingCourses,
    [courseId]: {
      paid: true,
      amount: Number(orderData.amount || 0),
      amountInr: Number(orderData.amountInr || 0),
      currency: String(orderData.currency || 'INR').toUpperCase(),
      countryCode: String(orderData.countryCode || '').toUpperCase(),
      paymentId,
      orderId,
      title: courseTitleOverride || orderData.courseTitle || '',
      slug: courseSlugOverride || orderData.courseSlug || '',
      verifiedAt: timestamp,
      paymentStatus: String(payment.status || ''),
    },
  }

  await Promise.all([
    paymentRef.set(
      {
        uid,
        ...(encryptedEmail ? { emailEncrypted: encryptedEmail } : {}),
        courses: nextCourses,
        updatedAt: timestamp,
      },
      { merge: true },
    ),
    orderRef.set(
      {
        status: 'verified',
        paymentId,
        paymentStatus: String(payment.status || ''),
        updatedAt: timestamp,
      },
      { merge: true },
    ),
  ])

  return { alreadyPaid: false, courses: nextCourses }
}

export async function getAuthUserFromRequest(request) {
  getAdminApp()
  const authHeader = String(request.headers?.authorization || request.headers?.Authorization || '')
  if (!authHeader.startsWith('Bearer ')) {
    return null
  }
  const token = authHeader.slice('Bearer '.length).trim()
  if (!token) return null
  return admin.auth().verifyIdToken(token)
}

export async function readRequestBody(request) {
  if (!request?.body) return {}
  if (typeof request.body === 'string') {
    return JSON.parse(request.body || '{}')
  }
  return request.body
}

export function sendJson(response, statusCode, payload) {
  response.status(statusCode).json(payload)
}

export async function fetchInrPerUsd() {
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' })
    if (!response.ok) return FX_FALLBACK_INR_PER_USD
    const data = await response.json()
    const rate = Number(data?.rates?.INR)
    return Number.isFinite(rate) && rate > 0 ? rate : FX_FALLBACK_INR_PER_USD
  } catch {
    return FX_FALLBACK_INR_PER_USD
  }
}

export function normalizeCountryCode(input) {
  const value = String(input || '').trim().toUpperCase()
  if (/^[A-Z]{2}$/.test(value)) return value
  return 'IN'
}

export async function readPaywallPrice(courseId) {
  const db = getDb()
  const snap = await db.doc(PAYWALL_PATH).get()
  const coursePrices = snap.exists && typeof snap.data()?.coursePrices === 'object' ? snap.data().coursePrices : {}
  const rawPrice = Number(coursePrices?.[courseId] || 0)
  return Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : 0
}

export async function computeChargeForCountry({ courseId, countryCode }) {
  const baseInrPrice = await readPaywallPrice(courseId)
  if (!baseInrPrice) {
    throw new Error('Pricing is not configured for this course.')
  }

  const normalizedCountry = normalizeCountryCode(countryCode)
  const isIndia = normalizedCountry === 'IN'
  const amountInr = Number((baseInrPrice * (isIndia ? 1 : 5)).toFixed(2))

  if (isIndia) {
    return {
      amount: amountInr,
      amountInr,
      currency: 'INR',
      countryCode: normalizedCountry,
    }
  }

  const inrPerUsd = await fetchInrPerUsd()
  return {
    amount: Number((amountInr / inrPerUsd).toFixed(2)),
    amountInr,
    currency: 'USD',
    countryCode: normalizedCountry,
  }
}
