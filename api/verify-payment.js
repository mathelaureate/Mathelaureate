import crypto from 'node:crypto'
import {
  applyVerifiedPayment,
  getAuthUserFromRequest,
  mapPaymentApiError,
  readRequestBody,
  sendJson,
  withFirestoreRetry,
} from './_lib/payment.js'

const ALLOWED_PRODUCT_TYPES = new Set(['course', 'ia', 'subscription'])

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
    const productType = String(body?.productType || 'course').trim().toLowerCase() || 'course'
    if (!ALLOWED_PRODUCT_TYPES.has(productType)) {
      sendJson(response, 400, { error: 'Invalid product type.' })
      return
    }

    const courseId = String(body?.courseId || '').trim()
    const courseSlug = String(body?.courseSlug || '').trim()
    const courseTitle = String(body?.courseTitle || '').trim()
    const iaId = String(body?.iaId || '').trim()
    const orderId = String(body?.razorpay_order_id || '').trim()
    const paymentId = String(body?.razorpay_payment_id || '').trim()
    const signature = String(body?.razorpay_signature || '').trim()
    if (!orderId || !paymentId || !signature) {
      sendJson(response, 400, { error: 'Invalid verification payload.' })
      return
    }
    if (productType === 'course' && !courseId) {
      sendJson(response, 400, { error: 'Invalid verification payload.' })
      return
    }
    if (productType === 'ia' && !iaId) {
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

    const result = await withFirestoreRetry(() =>
      applyVerifiedPayment({
        uid: authUser.uid,
        email: authUser.email || '',
        orderId,
        paymentId,
        expectedProductType: productType,
        expectedCourseId: productType === 'course' ? courseId : '',
        expectedIaId: productType === 'ia' ? iaId : '',
        courseSlugOverride: courseSlug,
        courseTitleOverride: courseTitle,
      }),
    )

    sendJson(response, 200, {
      ok: true,
      alreadyPaid: result.alreadyPaid,
      courses: result.courses,
      iaUnlocks: result.iaUnlocks,
      subscription: result.subscription,
    })
  } catch (error) {
    sendJson(response, 500, { error: mapPaymentApiError(error) })
  }
}
