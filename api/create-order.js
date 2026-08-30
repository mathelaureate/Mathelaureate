import {
  computeChargeForCountry,
  encryptSensitiveText,
  FULL_SUBSCRIPTION_PRODUCT_ID,
  getAuthUserFromRequest,
  getDb,
  getRazorpayClient,
  getRazorpayPublicKey,
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
    const countryCode = request.headers?.['x-vercel-ip-country'] || body?.countryCodeHint || 'IN'

    if (productType === 'course' && !courseId) {
      sendJson(response, 400, { error: 'courseId is required.' })
      return
    }
    if (productType === 'ia' && !iaId) {
      sendJson(response, 400, { error: 'iaId is required.' })
      return
    }

    const charge = await withFirestoreRetry(() =>
      computeChargeForCountry({
        productType,
        courseId: productType === 'subscription' ? FULL_SUBSCRIPTION_PRODUCT_ID : courseId,
        iaId,
        countryCode,
      }),
    )

    const resolvedCourseId =
      productType === 'subscription' ? FULL_SUBSCRIPTION_PRODUCT_ID : productType === 'ia' ? `ia:${iaId}` : courseId
    const resolvedTitle = courseTitle || charge.title || resolvedCourseId

    const razorpay = getRazorpayClient()
    const order = await razorpay.orders.create({
      amount: Math.round(charge.amount * 100),
      currency: charge.currency,
      receipt: `${authUser.uid}-${productType}-${Date.now()}`.slice(0, 40),
      notes: {
        uid: authUser.uid,
        productType,
        courseId: resolvedCourseId,
        iaId: iaId || '',
        courseSlug: courseSlug || '',
      },
    })

    const timestamp = new Date().toISOString()
    let encryptedEmail = ''
    try {
      encryptedEmail = authUser.email ? encryptSensitiveText(authUser.email) : ''
    } catch {
      encryptedEmail = ''
    }

    await withFirestoreRetry(() =>
      getDb()
        .collection('paymentOrders')
        .doc(order.id)
        .set({
          uid: authUser.uid,
          ...(encryptedEmail ? { emailEncrypted: encryptedEmail } : {}),
          productType,
          courseId: resolvedCourseId,
          courseSlug,
          courseTitle: resolvedTitle,
          iaId: iaId || '',
          durationDays: charge.durationDays || null,
          amount: charge.amount,
          amountInr: charge.amountInr,
          amountPaise: order.amount,
          currency: order.currency,
          countryCode: charge.countryCode,
          orderId: order.id,
          status: 'created',
          createdAt: timestamp,
          updatedAt: timestamp,
        }),
    )

    const keyId = getRazorpayPublicKey()
    if (!keyId) {
      sendJson(response, 500, { error: 'Razorpay public key is missing.' })
      return
    }

    sendJson(response, 200, {
      keyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      amountInr: charge.amountInr,
      countryCode: charge.countryCode,
      productType,
    })
  } catch (error) {
    sendJson(response, 500, { error: mapPaymentApiError(error) })
  }
}
