import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase'

const RECENT_VISIT_MAX = 60
const PRESENCE_THROTTLE_MS = 5 * 60 * 1000
let locationCache = null
let presenceInFlight = null

export function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function shiftDateKey(key, days) {
  const [year, month, day] = String(key || '').split('-').map(Number)
  if (!year || !month || !day) return ''
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return localDateKey(date)
}

export function normalizeVisitDate(value) {
  const raw = String(value || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return ''
  return localDateKey(parsed)
}

export function collectVisitDates(progress) {
  const dates = new Set()
  const raw = Array.isArray(progress?.recentVisitDates) ? progress.recentVisitDates : []
  for (const value of raw) {
    const key = normalizeVisitDate(value)
    if (key) dates.add(key)
  }
  const lastSeenDate = normalizeVisitDate(progress?.lastSeenDate || progress?.lastSeenAt || progress?.updatedAt)
  if (lastSeenDate) dates.add(lastSeenDate)
  return [...dates].sort()
}

function normalizeVisitDates(raw, today) {
  const dates = new Set(collectVisitDates({ recentVisitDates: raw }))
  dates.add(today)
  return [...dates].sort().slice(-RECENT_VISIT_MAX)
}

export function studyStreak(dates, today = localDateKey()) {
  const set = new Set((dates || []).map(normalizeVisitDate).filter(Boolean))
  let cursor = set.has(today) ? today : shiftDateKey(today, -1)
  if (!set.has(cursor)) return 0
  let streak = 0
  while (cursor && set.has(cursor)) {
    streak += 1
    cursor = shiftDateKey(cursor, -1)
  }
  return streak
}

function presenceCacheKey(uid) {
  return `ml-presence-${uid}`
}

function readPresenceCache(uid) {
  try {
    return JSON.parse(localStorage.getItem(presenceCacheKey(uid)) || '{}')
  } catch {
    return {}
  }
}

function writePresenceCache(uid, payload) {
  try {
    localStorage.setItem(presenceCacheKey(uid), JSON.stringify(payload))
  } catch {
    // Ignore private-mode quota errors.
  }
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

  const today = localDateKey()
  const now = Date.now()
  const cached = readPresenceCache(user.uid)
  if (cached.day === today && now - Number(cached.at || 0) < PRESENCE_THROTTLE_MS) {
    return
  }

  presenceInFlight = (async () => {
    const location = await detectUserLocation()
    const timestamp = new Date().toISOString()
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
    writePresenceCache(user.uid, { day: today, at: Date.now() })
  })()

  try {
    await presenceInFlight
  } finally {
    presenceInFlight = null
  }
}
