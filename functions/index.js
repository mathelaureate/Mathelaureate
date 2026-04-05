import crypto from 'node:crypto'
import admin from 'firebase-admin'
import Razorpay from 'razorpay'
import { onRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'

if (!admin.apps.length) {
  admin.initializeApp()
}

const db = admin.firestore()
const razorpayKeyId = defineSecret('RAZORPAY_KEY_ID')
const razorpayKeySecret = defineSecret('RAZORPAY_KEY_SECRET')

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

function sendJson(response, statusCode, payload) {
  response.status(statusCode).set(corsHeaders()).json(payload)
}

function handleOptions(request, response) {
  if (request.method === 'OPTIONS') {
    response.status(204).set(corsHeaders()).send('')
    return true
  }
  return false
}

function requireRazorpayConfig() {
  const keyId = razorpayKeyId.value()
  const keySecret = razorpayKeySecret.value()
  if (!keyId || !keySecret) {
    throw new Error('Razorpay server credentials are missing.')
  }
  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  })
}

export const createOrder = onRequest({ region: 'us-central1', secrets: [razorpayKeyId, razorpayKeySecret] }, async (request, response) => {
  if (handleOptions(request, response)) return
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed' })
    return
  }

  try {
    const razorpay = requireRazorpayConfig()
    const { uid, courseId, courseSlug, amount, amountInr, currency } = request.body || {}
    const amountValue = Number(amount || amountInr || 0)
    const chargeCurrency = String(currency || 'INR').toUpperCase()
    if (!uid || !courseId || !courseSlug || !amountValue || amountValue <= 0) {
      sendJson(response, 400, { error: 'Invalid order request.' })
      return
    }
    if (!['INR', 'USD'].includes(chargeCurrency)) {
      sendJson(response, 400, { error: 'Unsupported currency.' })
      return
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amountValue * 100),
      currency: chargeCurrency,
      receipt: `${uid}-${courseSlug}-${Date.now()}`.slice(0, 40),
      notes: {
        uid,
        courseId,
        courseSlug,
      },
    })

    sendJson(response, 200, {
      keyId: razorpayKeyId.value(),
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    })
  } catch (error) {
    sendJson(response, 500, { error: error?.message || 'Unable to create Razorpay order.' })
  }
})

export const verifyPayment = onRequest(
  { region: 'us-central1', secrets: [razorpayKeyId, razorpayKeySecret] },
  async (request, response) => {
  if (handleOptions(request, response)) return
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed' })
    return
  }

  try {
    requireRazorpayConfig()
    const {
      uid,
      email,
      courseId,
      courseSlug,
      courseTitle,
      amount,
      amountInr,
      currency,
      countryCode,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = request.body || {}

    if (!uid || !courseId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      sendJson(response, 400, { error: 'Invalid verification payload.' })
      return
    }

    const expectedSignature = crypto
      .createHmac('sha256', razorpayKeySecret.value())
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    if (expectedSignature !== razorpay_signature) {
      sendJson(response, 401, { error: 'Invalid payment signature.' })
      return
    }

    const paymentRef = db.collection('userPayments').doc(uid)
    const paymentSnap = await paymentRef.get()
    const existingCourses = paymentSnap.exists ? paymentSnap.data()?.courses || {} : {}
    const timestamp = new Date().toISOString()

    const nextCourses = {
      ...existingCourses,
      [courseId]: {
        paid: true,
        amount: Number(amount || amountInr || 0),
        amountInr: Number(amountInr || 0),
        currency: String(currency || 'INR').toUpperCase(),
        countryCode: String(countryCode || '').toUpperCase(),
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        title: courseTitle || '',
        slug: courseSlug || '',
        verifiedAt: timestamp,
      },
    }

    await paymentRef.set(
      {
        uid,
        email: email || '',
        courses: nextCourses,
        updatedAt: timestamp,
      },
      { merge: true },
    )

    sendJson(response, 200, { ok: true, courses: nextCourses })
  } catch (error) {
    sendJson(response, 500, { error: error?.message || 'Unable to verify payment.' })
  }
})
