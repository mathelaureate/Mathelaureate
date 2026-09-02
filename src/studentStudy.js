import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase'

export const STUDY_LIST_MAX = 80
export const SAVED_QUESTIONS_KEY = 'savedQuestions'
export const WRONG_QUESTIONS_KEY = 'wrongQuestions'

export function questionPreviewText(item) {
  const fromBlocks = Array.isArray(item?.descriptionBlocks)
    ? item.descriptionBlocks
        .map((block) => (block?.type === 'text' ? String(block?.text || '').trim() : ''))
        .filter(Boolean)
        .join(' ')
    : ''
  const raw = String(fromBlocks || item?.description || item?.title || 'Saved question')
  return raw
    .replace(/\$\$[\s\S]+?\$\$/g, ' ')
    .replace(/\$[^$\n]+\$/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
}

export function questionStudyPath(entry) {
  if (!entry?.courseSlug || !entry?.unitId || !entry?.subunit || !entry?.questionId) return ''
  const params = new URLSearchParams({
    unit: entry.unitId,
    subunit: entry.subunit,
    tab: 'question',
    q: entry.questionId,
  })
  return `/courses/${entry.courseSlug}?${params.toString()}`
}

export function normalizeStudyQuestion(raw) {
  const questionId = String(raw?.questionId || '').trim()
  return {
    questionId,
    courseSlug: String(raw?.courseSlug || '').trim(),
    courseTitle: String(raw?.courseTitle || '').trim(),
    curriculumId: String(raw?.curriculumId || '').trim(),
    unitId: String(raw?.unitId || '').trim(),
    subunit: String(raw?.subunit || '').trim(),
    marks: Number(raw?.marks) || 0,
    difficulty: String(raw?.difficulty || 'medium').trim().toLowerCase() || 'medium',
    gdc: String(raw?.gdc || '').trim().toLowerCase() === 'gdc' ? 'gdc' : 'not gdc',
    questionLevel: String(raw?.questionLevel || '').trim(),
    preview: String(raw?.preview || '').trim().slice(0, 180),
    savedAt: String(raw?.savedAt || ''),
  }
}

export function normalizeStudyList(raw) {
  if (!Array.isArray(raw)) return []
  const seen = new Set()
  const next = []
  for (const item of raw) {
    const normalized = normalizeStudyQuestion(item)
    if (!normalized.questionId || seen.has(normalized.questionId)) continue
    seen.add(normalized.questionId)
    next.push(normalized)
  }
  return next.slice(0, STUDY_LIST_MAX)
}

export function buildStudyQuestionEntry({ item, course, unitId, subunit }) {
  return normalizeStudyQuestion({
    questionId: item?.id,
    courseSlug: course?.slug,
    courseTitle: course?.title || course?.shortTitle,
    curriculumId: course?.curriculumId || item?.curriculumId,
    unitId: unitId || item?.unitId,
    subunit: subunit || item?.subunit,
    marks: item?.marks,
    difficulty: item?.difficulty,
    gdc: item?.gdc,
    questionLevel: item?.questionLevel,
    preview: questionPreviewText(item),
    savedAt: new Date().toISOString(),
  })
}

export function courseContinuePath(courseEntry) {
  if (!courseEntry?.slug) return '/#programs'
  const params = new URLSearchParams()
  if (courseEntry.lastViewedUnitId && courseEntry.lastViewedSubunit) {
    params.set('unit', courseEntry.lastViewedUnitId)
    params.set('subunit', courseEntry.lastViewedSubunit)
  }
  const qs = params.toString()
  return `/courses/${courseEntry.slug}${qs ? `?${qs}` : ''}`
}

export function resolveMyCourses(data) {
  const coursesMap = data?.courses || {}
  const persisted = Array.isArray(data?.myCourses) ? data.myCourses : []
  const fallback = Object.values(coursesMap).filter(
    (courseEntry) => Number(courseEntry?.visitedSubunitsCount || 0) > 1,
  )
  const list = (persisted.length > 0 ? persisted : fallback).map((entry) => {
    const fromMap = coursesMap[entry.slug] || {}
    return {
      ...entry,
      title: entry.title || fromMap.title || entry.slug,
      lastViewedUnitId: entry.lastViewedUnitId || fromMap.lastViewedUnitId || '',
      lastViewedSubunit: entry.lastViewedSubunit || fromMap.lastViewedSubunit || '',
    }
  })
  return list.sort((a, b) => String(b?.updatedAt || '').localeCompare(String(a?.updatedAt || '')))
}

export function resolveLastViewedCourse(data) {
  const fromMap = Object.values(data?.courses || {}).sort((a, b) =>
    String(b?.updatedAt || '').localeCompare(String(a?.updatedAt || '')),
  )
  return fromMap[0] || resolveMyCourses(data)[0] || null
}

export async function toggleStudyQuestion({ user, listKey, entry, currentlySaved }) {
  if (!user?.uid || !entry?.questionId) {
    throw new Error('Sign in to save questions.')
  }
  const ref = doc(db, 'userCourseProgress', user.uid)
  const snap = await getDoc(ref)
  const data = snap.exists() ? snap.data() : {}
  const list = normalizeStudyList(data[listKey])
  const next = currentlySaved
    ? list.filter((item) => item.questionId !== entry.questionId)
    : [entry, ...list.filter((item) => item.questionId !== entry.questionId)].slice(0, STUDY_LIST_MAX)
  await setDoc(
    ref,
    {
      uid: user.uid,
      email: user.email || '',
      [listKey]: next,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  )
  return next
}
