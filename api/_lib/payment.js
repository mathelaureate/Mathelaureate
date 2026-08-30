import admin from 'firebase-admin'
import crypto from 'node:crypto'
import Razorpay from 'razorpay'

const FX_FALLBACK_INR_PER_USD = 95
const PAYWALL_PATH = 'appData/paywall'
const IA_PATH = 'appData/ia'
export const FULL_SUBSCRIPTION_PRODUCT_ID = 'platform-full'
export const FULL_SUBSCRIPTION_DEFAULT_PRICE_INR = 1499
export const FULL_SUBSCRIPTION_DEFAULT_DAYS = 90
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
  expectedProductType = '',
  expectedIaId = '',
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

  const productType = String(orderData.productType || 'course').trim() || 'course'
  if (expectedProductType && productType !== expectedProductType) {
    throw new Error('Order does not match product type.')
  }
  if (productType === 'course' && expectedCourseId && String(orderData.courseId || '') !== String(expectedCourseId || '')) {
    throw new Error('Order does not match course.')
  }
  if (productType === 'ia' && expectedIaId && String(orderData.iaId || '') !== String(expectedIaId || '')) {
    throw new Error('Order does not match IA item.')
  }
  if (productType === 'subscription' && String(orderData.courseId || '') !== FULL_SUBSCRIPTION_PRODUCT_ID) {
    throw new Error('Order does not match subscription product.')
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
  const existing = paymentSnap.exists ? paymentSnap.data() || {} : {}
  const existingCourses = existing.courses && typeof existing.courses === 'object' ? existing.courses : {}
  const existingIaUnlocks = existing.iaUnlocks && typeof existing.iaUnlocks === 'object' ? existing.iaUnlocks : {}
  const existingSubscription = existing.subscription && typeof existing.subscription === 'object' ? existing.subscription : null

  const timestamp = new Date().toISOString()
  const encryptedEmail = email ? encryptSensitiveText(email) : ''
  const paymentMeta = {
    amount: Number(orderData.amount || 0),
    amountInr: Number(orderData.amountInr || 0),
    currency: String(orderData.currency || 'INR').toUpperCase(),
    countryCode: String(orderData.countryCode || '').toUpperCase(),
    paymentId,
    orderId,
    verifiedAt: timestamp,
    paymentStatus: String(payment.status || ''),
  }

  let alreadyPaid = false
  let nextCourses = existingCourses
  let nextIaUnlocks = existingIaUnlocks
  let nextSubscription = existingSubscription

  if (productType === 'subscription') {
    const expiresAt = existingSubscription?.expiresAt
    const stillActive = Boolean(existingSubscription?.active) && expiresAt && new Date(expiresAt).getTime() > Date.now()
    if (stillActive) {
      alreadyPaid = true
    } else {
      const durationDays = Math.max(1, Number(orderData.durationDays || FULL_SUBSCRIPTION_DEFAULT_DAYS))
      const expires = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
      nextSubscription = {
        active: true,
        productId: FULL_SUBSCRIPTION_PRODUCT_ID,
        durationDays,
        startsAt: timestamp,
        expiresAt: expires,
        title: orderData.courseTitle || 'Mathelaureate Full Access',
        ...paymentMeta,
      }
    }
  } else if (productType === 'ia') {
    const iaId = String(orderData.iaId || '')
    if (!iaId) throw new Error('IA id missing on order.')
    if (existingIaUnlocks[iaId]?.paid === true) {
      alreadyPaid = true
    } else {
      nextIaUnlocks = {
        ...existingIaUnlocks,
        [iaId]: {
          paid: true,
          title: courseTitleOverride || orderData.courseTitle || '',
          ...paymentMeta,
        },
      }
    }
  } else {
    const courseId = String(orderData.courseId || '')
    const existingCourse = existingCourses[courseId] || {}
    if (existingCourse.paid === true) {
      alreadyPaid = true
    } else {
      nextCourses = {
        ...existingCourses,
        [courseId]: {
          paid: true,
          title: courseTitleOverride || orderData.courseTitle || '',
          slug: courseSlugOverride || orderData.courseSlug || '',
          ...paymentMeta,
        },
      }
    }
  }

  await Promise.all([
    paymentRef.set(
      {
        uid,
        ...(encryptedEmail ? { emailEncrypted: encryptedEmail } : {}),
        courses: nextCourses,
        iaUnlocks: nextIaUnlocks,
        ...(nextSubscription ? { subscription: nextSubscription } : {}),
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

  return {
    alreadyPaid,
    courses: nextCourses,
    iaUnlocks: nextIaUnlocks,
    subscription: nextSubscription,
  }
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

async function resolveBaseInrPrice({ productType, courseId, iaId }) {
  const db = getDb()
  if (productType === 'subscription') {
    const snap = await db.doc(PAYWALL_PATH).get()
    const raw = Number(snap.exists ? snap.data()?.fullSubscription?.priceInr : 0)
    const price = Number.isFinite(raw) && raw > 0 ? raw : FULL_SUBSCRIPTION_DEFAULT_PRICE_INR
    const durationRaw = Number(snap.exists ? snap.data()?.fullSubscription?.durationDays : 0)
    const durationDays = Number.isFinite(durationRaw) && durationRaw > 0 ? durationRaw : FULL_SUBSCRIPTION_DEFAULT_DAYS
    return {
      baseInrPrice: price,
      productId: FULL_SUBSCRIPTION_PRODUCT_ID,
      durationDays,
      title: 'Mathelaureate Full Access (3 months)',
    }
  }

  if (productType === 'ia') {
    if (!iaId) throw new Error('iaId is required for IA purchases.')
    const snap = await db.doc(IA_PATH).get()
    const items = Array.isArray(snap.data()?.items) ? snap.data().items : []
    const item = items.find((entry) => String(entry?.id || '') === String(iaId))
    if (!item) throw new Error('IA item not found.')
    const rawPrice = Number(item.unlockPriceInr || 0)
    if (!Number.isFinite(rawPrice) || rawPrice <= 0) {
      throw new Error('Pricing is not configured for this IA.')
    }
    return {
      baseInrPrice: rawPrice,
      productId: `ia:${iaId}`,
      iaId,
      title: String(item.title || 'IA unlock').slice(0, 120),
    }
  }

  const baseInrPrice = await readPaywallPrice(courseId)
  if (!baseInrPrice) {
    throw new Error('Pricing is not configured for this course.')
  }
  return {
    baseInrPrice,
    productId: courseId,
  }
}

export async function computeChargeForCountry({ productType = 'course', courseId = '', iaId = '', countryCode }) {
  const resolved = await resolveBaseInrPrice({ productType, courseId, iaId })
  const normalizedCountry = normalizeCountryCode(countryCode)
  const isIndia = normalizedCountry === 'IN'
  const amountInr = Number((resolved.baseInrPrice * (isIndia ? 1 : 5)).toFixed(2))

  const money = isIndia
    ? {
        amount: amountInr,
        amountInr,
        currency: 'INR',
        countryCode: normalizedCountry,
      }
    : await (async () => {
        const inrPerUsd = await fetchInrPerUsd()
        return {
          amount: Number((amountInr / inrPerUsd).toFixed(2)),
          amountInr,
          currency: 'USD',
          countryCode: normalizedCountry,
        }
      })()

  return {
    ...money,
    productId: resolved.productId,
    durationDays: resolved.durationDays || null,
    title: resolved.title || '',
    iaId: resolved.iaId || '',
  }
}
