import { computeChargeForCountry, encryptSensitiveText, getAuthUserFromRequest, getDb, getRazorpayClient, getRazorpayPublicKey, readRequestBody, sendJson } from './_lib/payment.js'

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
    const countryCode = request.headers?.['x-vercel-ip-country'] || body?.countryCodeHint || 'IN'
    if (!courseId) {
      sendJson(response, 400, { error: 'courseId is required.' })
      return
    }

    const charge = await computeChargeForCountry({ courseId, countryCode })
    const razorpay = getRazorpayClient()
    const order = await razorpay.orders.create({
      amount: Math.round(charge.amount * 100),
      currency: charge.currency,
      receipt: `${authUser.uid}-${courseSlug || courseId}-${Date.now()}`.slice(0, 40),
      notes: {
        uid: authUser.uid,
        courseId,
        courseSlug,
      },
    })

    const timestamp = new Date().toISOString()
    const encryptedEmail = authUser.email ? encryptSensitiveText(authUser.email) : ''
    await getDb()
      .collection('paymentOrders')
      .doc(order.id)
      .set({
        uid: authUser.uid,
        emailEncrypted: encryptedEmail,
        courseId,
        courseSlug,
        courseTitle,
        amount: charge.amount,
        amountInr: charge.amountInr,
        amountPaise: order.amount,
        currency: order.currency,
        countryCode: charge.countryCode,
        orderId: order.id,
        status: 'created',
        createdAt: timestamp,
        updatedAt: timestamp,
      })

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
    })
  } catch (error) {
    sendJson(response, 500, { error: error?.message || 'Unable to create payment order.' })
  }
}
