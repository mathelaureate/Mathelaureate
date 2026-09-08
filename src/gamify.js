import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import { localDateKey } from './userPresence'

export const XP = {
  LOGIN: 10,
  SUBUNIT: 20,
  UNIT: 40,
  SOLUTION: 8,
  MASTER: 15,
  REVIEW: 10,
  TUTOR: 5,
}

export const DAILY_GOAL_XP = 50
export const PRACTICE_QUEST = 3
const AWARDED_MAX = 500
const MASTERED_MAX = 200

const LEVEL_TITLES = ['Spark', 'Scholar', 'Analyst', 'Examiner', 'Laureate', 'Olympian', 'Grandmaster']

export function emptyGamify(today = localDateKey()) {
  return {
    xp: 0,
    awarded: [],
    dailyDate: today,
    dailyXp: 0,
    dailyTopic: false,
    dailyPractice: 0,
    mastered: [],
  }
}

export function normalizeGamify(raw, today = localDateKey()) {
  const next = {
    ...emptyGamify(today),
    ...(raw && typeof raw === 'object' ? raw : {}),
  }
  next.xp = Math.max(0, Number(next.xp) || 0)
  next.awarded = Array.isArray(next.awarded) ? next.awarded.map(String).slice(-AWARDED_MAX) : []
  next.mastered = Array.isArray(next.mastered) ? next.mastered.map(String).slice(-MASTERED_MAX) : []
  if (next.dailyDate !== today) {
    next.dailyDate = today
    next.dailyXp = 0
    next.dailyTopic = false
    next.dailyPractice = 0
  }
  next.dailyXp = Math.max(0, Number(next.dailyXp) || 0)
  next.dailyPractice = Math.max(0, Number(next.dailyPractice) || 0)
  next.dailyTopic = Boolean(next.dailyTopic)
  return next
}

function visitCount(progressDoc) {
  const courses = progressDoc?.courses && typeof progressDoc.courses === 'object' ? progressDoc.courses : {}
  return Object.values(courses).reduce((sum, course) => {
    if (Array.isArray(course?.visitedSubunits)) return sum + course.visitedSubunits.length
    return sum + (Number(course?.visitedSubunitsCount) || 0)
  }, 0)
}

export function hydrateGamify(raw, today = localDateKey(), progressDoc = {}) {
  const next = normalizeGamify(raw, today)
  if (next.awarded.includes('retro:v1')) return next
  const visits = visitCount(progressDoc)
  if (visits > 0) next.xp += Math.min(visits * 15, 300)
  next.awarded = [...next.awarded, 'retro:v1']
  return next
}

export function levelFromXp(xp) {
  const total = Math.max(0, Number(xp) || 0)
  let level = 1
  let spent = 0
  let need = 80
  while (total >= spent + need) {
    spent += need
    level += 1
    need = 70 + level * 35
  }
  const title =
    level > LEVEL_TITLES.length ? `Laureate ${level}` : LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)]
  return { level, title, into: total - spent, need, xp: total }
}

export function questsFrom(gamify) {
  const g = normalizeGamify(gamify)
  return [
    { id: 'topic', label: 'Study a topic', done: g.dailyTopic, hint: `+${XP.SUBUNIT} XP` },
    {
      id: 'practice',
      label: `Practice ${PRACTICE_QUEST} questions`,
      done: g.dailyPractice >= PRACTICE_QUEST,
      hint: `${Math.min(g.dailyPractice, PRACTICE_QUEST)}/${PRACTICE_QUEST}`,
    },
    {
      id: 'goal',
      label: `Earn ${DAILY_GOAL_XP} XP today`,
      done: g.dailyXp >= DAILY_GOAL_XP,
      hint: `${Math.min(g.dailyXp, DAILY_GOAL_XP)}/${DAILY_GOAL_XP}`,
    },
  ]
}

export function applyGamifyEvent(raw, event, today = localDateKey(), progressDoc = {}) {
  const gamify = hydrateGamify(raw, today, progressDoc)
  let gained = 0
  let label = ''

  function award(key, amount, text, { daily = true } = {}) {
    if (!key || gamify.awarded.includes(key) || amount <= 0) return false
    gamify.awarded = [...gamify.awarded, key].slice(-AWARDED_MAX)
    gamify.xp += amount
    if (daily) gamify.dailyXp += amount
    gained += amount
    label = text
    return true
  }

  if (event?.type === 'login') {
    award(`login:${today}`, XP.LOGIN, 'Daily study')
  }

  if (event?.type === 'subunit') {
    const key = `sub:${event.courseSlug || ''}:${event.subunitKey || ''}`
    if (award(key, XP.SUBUNIT, 'Topic studied')) gamify.dailyTopic = true
    if (event.unitComplete && event.unitId) {
      const extra = award(`unit:${event.courseSlug || ''}:${event.unitId}`, XP.UNIT, 'Unit complete')
      if (extra) label = 'Unit complete'
    }
  }

  if (event?.type === 'practice' && event.questionId) {
    const kind = event.kind || 'solution'
    const amount = kind === 'master' ? XP.MASTER : kind === 'review' ? XP.REVIEW : XP.SOLUTION
    const text = kind === 'master' ? 'Got it' : kind === 'review' ? 'Mistake reviewed' : 'Practiced a question'
    if (award(`${kind}:${event.questionId}`, amount, text)) gamify.dailyPractice += 1
    if (kind === 'master' && !gamify.mastered.includes(event.questionId)) {
      gamify.mastered = [...gamify.mastered, event.questionId].slice(-MASTERED_MAX)
    }
  }

  if (event?.type === 'tutor') {
    award(`tutor:${today}`, XP.TUTOR, 'Asked Laureate')
  }

  return { gamify, gained, label }
}

export function emitXp(detail) {
  if (typeof window === 'undefined' || !detail?.gained) return
  window.dispatchEvent(new CustomEvent('ml-xp', { detail }))
}

export async function awardGamify(user, event) {
  if (!user?.uid || !event?.type) return { gained: 0, gamify: emptyGamify() }
  const today = localDateKey()
  const ref = doc(db, 'userCourseProgress', user.uid)
  const snap = await getDoc(ref)
  const existing = snap.exists() ? snap.data() || {} : {}
  const { gamify, gained, label } = applyGamifyEvent(existing.gamify, event, today, existing)
  if (!gained && JSON.stringify(gamify) === JSON.stringify(hydrateGamify(existing.gamify, today, existing))) {
    return { gained: 0, gamify, label }
  }
  await setDoc(
    ref,
    {
      uid: user.uid,
      gamify,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  )
  emitXp({ gained, label, gamify })
  return { gained, label, gamify }
}
