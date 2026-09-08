import admin from 'firebase-admin'

const env = globalThis.process?.env || {}

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

export async function getAuthUserFromRequest(request) {
  getAdminApp()
  const authHeader = String(request.headers?.authorization || request.headers?.Authorization || '')
  if (!authHeader.startsWith('Bearer ')) return null
  const token = authHeader.slice('Bearer '.length).trim()
  if (!token) return null
  return admin.auth().verifyIdToken(token)
}

export function sendJson(response, statusCode, payload) {
  response.status(statusCode).json(payload)
}
