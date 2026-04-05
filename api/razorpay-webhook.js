import crypto from 'node:crypto'
import { applyVerifiedPayment, getDb, sendJson } from './_lib/payment.js'

const BufferApi = globalThis.Buffer

async function readRawBody(request) {
  if (typeof request.body === 'string') return request.body
  if (BufferApi?.isBuffer(request.body)) return request.body.toString('utf8')
  if (request.body && typeof request.body === 'object') return JSON.stringify(request.body)

  return new Promise((resolve, reject) => {
    let data = ''
    request.on('data', (chunk) => {
      data += chunk
    })
    request.on('end', () => resolve(data || '{}'))
    request.on('error', reject)
  })
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed' })
    return
  }

  try {
    const webhookSecret = String(globalThis.process?.env?.RAZORPAY_WEBHOOK_SECRET || '').trim()
    if (!webhookSecret) {
      sendJson(response, 500, { error: 'Webhook secret is missing.' })
      return
    }

    const signature = String(request.headers?.['x-razorpay-signature'] || '').trim()
    if (!signature) {
      sendJson(response, 401, { error: 'Missing webhook signature.' })
      return
    }

    const rawBody = await readRawBody(request)
    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex')
    if (expected !== signature) {
      sendJson(response, 401, { error: 'Invalid webhook signature.' })
      return
    }

    const payload = JSON.parse(rawBody || '{}')
    const event = String(payload?.event || '')
    if (!['payment.authorized', 'payment.captured'].includes(event)) {
      sendJson(response, 200, { ok: true, ignored: true })
      return
    }

    const paymentEntity = payload?.payload?.payment?.entity || {}
    const orderId = String(paymentEntity?.order_id || '').trim()
    const paymentId = String(paymentEntity?.id || '').trim()
    if (!orderId || !paymentId) {
      sendJson(response, 400, { error: 'Missing order/payment details in webhook payload.' })
      return
    }

    const orderSnap = await getDb().collection('paymentOrders').doc(orderId).get()
    if (!orderSnap.exists) {
      sendJson(response, 200, { ok: true, ignored: true, reason: 'Unknown orderId' })
      return
    }
    const orderData = orderSnap.data() || {}
    const uid = String(orderData.uid || '')
    if (!uid) {
      sendJson(response, 200, { ok: true, ignored: true, reason: 'Order missing uid' })
      return
    }

    const result = await applyVerifiedPayment({
      uid,
      email: '',
      orderId,
      paymentId,
      expectedCourseId: String(orderData.courseId || ''),
      courseSlugOverride: String(orderData.courseSlug || ''),
      courseTitleOverride: String(orderData.courseTitle || ''),
    })

    sendJson(response, 200, { ok: true, alreadyPaid: result.alreadyPaid })
  } catch (error) {
    sendJson(response, 500, { error: error?.message || 'Webhook processing failed.' })
  }
}
