import crypto from 'node:crypto'
import { applyVerifiedPayment, getAuthUserFromRequest, readRequestBody, sendJson } from './_lib/payment.js'

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed' })
    return
  }

  try {
    const authUser = await getAuthUserFromRequest(request)
    if (!authUser?.uid) {
      sendJson(response, 401, { error: 'Unauthorized request.' })
      return
    }

    const body = await readRequestBody(request)
    const courseId = String(body?.courseId || '').trim()
    const courseSlug = String(body?.courseSlug || '').trim()
    const courseTitle = String(body?.courseTitle || '').trim()
    const orderId = String(body?.razorpay_order_id || '').trim()
    const paymentId = String(body?.razorpay_payment_id || '').trim()
    const signature = String(body?.razorpay_signature || '').trim()
    if (!courseId || !orderId || !paymentId || !signature) {
      sendJson(response, 400, { error: 'Invalid verification payload.' })
      return
    }

    const keySecret = String(globalThis.process?.env?.RAZORPAY_KEY_SECRET || '').trim()
    if (!keySecret) {
      sendJson(response, 500, { error: 'Razorpay secret is missing.' })
      return
    }

    const expectedSignature = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex')
    if (expectedSignature !== signature) {
      sendJson(response, 401, { error: 'Invalid payment signature.' })
      return
    }

    const result = await applyVerifiedPayment({
      uid: authUser.uid,
      email: authUser.email || '',
      orderId,
      paymentId,
      expectedCourseId: courseId,
      courseSlugOverride: courseSlug,
      courseTitleOverride: courseTitle,
    })

    sendJson(response, 200, { ok: true, alreadyPaid: result.alreadyPaid, courses: result.courses })
  } catch (error) {
    sendJson(response, 500, { error: error?.message || 'Unable to verify payment.' })
  }
}
