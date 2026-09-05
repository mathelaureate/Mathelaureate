import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase'

const RECENT_VISIT_MAX = 60
let locationCache = null
let presenceInFlight = null

function todayKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function normalizeVisitDates(raw, today) {
  const dates = new Set()
  if (Array.isArray(raw)) {
    for (const value of raw) {
      const key = String(value || '').trim()
      if (/^\d{4}-\d{2}-\d{2}$/.test(key)) dates.add(key)
    }
  }
  dates.add(today)
  return [...dates].sort().slice(-RECENT_VISIT_MAX)
}

export async function detectUserLocation() {
  if (locationCache) return locationCache
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 1200)
    const response = await fetch('https://ipapi.co/json/', { cache: 'no-store', signal: controller.signal })
    clearTimeout(timer)
    if (!response.ok) {
      locationCache = { countryCode: '', countryName: '' }
      return locationCache
    }
    const data = await response.json()
    locationCache = {
      countryCode: String(data?.country_code || '').toUpperCase(),
      countryName: String(data?.country_name || '').trim(),
    }
    return locationCache
  } catch {
    locationCache = { countryCode: '', countryName: '' }
    return locationCache
  }
}

export async function recordUserPresence(user) {
  if (!user?.uid) return
  if (presenceInFlight) return presenceInFlight

  presenceInFlight = (async () => {
    const location = await detectUserLocation()
    const timestamp = new Date().toISOString()
    const today = todayKey()
    const ref = doc(db, 'userCourseProgress', user.uid)
    const snap = await getDoc(ref)
    const existing = snap.exists() ? snap.data() || {} : {}
    await setDoc(
      ref,
      {
        uid: user.uid,
        email: user.email || existing.email || '',
        displayName: user.displayName || existing.displayName || '',
        photoURL: user.photoURL || existing.photoURL || '',
        countryCode: location.countryCode || existing.countryCode || '',
        countryName: location.countryName || existing.countryName || '',
        lastSeenAt: timestamp,
        lastSeenDate: today,
        lastPath: typeof window !== 'undefined' ? String(window.location.pathname || '/') : '/',
        recentVisitDates: normalizeVisitDates(existing.recentVisitDates, today),
        updatedAt: timestamp,
      },
      { merge: true },
    )
  })()

  try {
    await presenceInFlight
  } finally {
    presenceInFlight = null
  }
}
