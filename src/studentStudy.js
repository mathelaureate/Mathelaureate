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
    unitName: String(raw?.unitName || '').trim(),
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

export function buildStudyQuestionEntry({ item, course, unitId, subunit, unitName }) {
  return normalizeStudyQuestion({
    questionId: item?.id,
    courseSlug: course?.slug,
    courseTitle: course?.title || course?.shortTitle,
    curriculumId: course?.curriculumId || item?.curriculumId,
    unitId: unitId || item?.unitId,
    subunit: subunit || item?.subunit,
    unitName: unitName || item?.unitName,
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

const SUGGEST_PER_TOPIC = 3

function topicPart(value) {
  return String(value || '').trim()
}

function topicKey(entry) {
  return `${topicPart(entry?.curriculumId)}::${topicPart(entry?.unitId)}::${topicPart(entry?.subunit)}`
}

function suggestionScore(item, seeds) {
  const difficulty = String(item?.difficulty || 'medium').trim().toLowerCase()
  const level = String(item?.questionLevel || '').trim().toLowerCase()
  const gdc = String(item?.gdc || '').trim().toLowerCase() === 'gdc' ? 'gdc' : 'not gdc'
  let score = 0
  if (seeds.some((seed) => seed.difficulty === difficulty)) score += 3
  if (level && seeds.some((seed) => seed.questionLevel.toLowerCase() === level)) score += 2
  if (seeds.some((seed) => seed.gdc === gdc)) score += 1
  return score
}

export function suggestSimilarQuestionsByTopic({ wrongQuestions, bankItems, courses, curricula }) {
  const wrongList = normalizeStudyList(wrongQuestions)
  if (wrongList.length === 0) return []

  const catalogByCurriculum = new Map((courses || []).map((course) => [course.curriculumId, course]))
  const unitNameByKey = new Map()
  for (const curriculum of curricula || []) {
    for (const unit of curriculum.units || []) {
      unitNameByKey.set(`${curriculum.id}::${unit.id}`, String(unit.name || '').trim())
    }
  }

  const wrongIds = new Set(wrongList.map((item) => String(item.questionId)))
  const bankQuestions = (bankItems || []).filter((item) => item?.itemType === 'question' && item?.id)
  const topicOrder = []
  const topicMeta = new Map()

  for (const wrong of wrongList) {
    const key = topicKey(wrong)
    if (!topicMeta.has(key)) {
      const unitName = wrong.unitName || unitNameByKey.get(`${wrong.curriculumId}::${wrong.unitId}`) || ''
      topicMeta.set(key, {
        key,
        curriculumId: wrong.curriculumId,
        unitId: wrong.unitId,
        subunit: wrong.subunit,
        unitName,
        course: catalogByCurriculum.get(wrong.curriculumId) || null,
        wrongCount: 0,
      })
      topicOrder.push(key)
    }
    topicMeta.get(key).wrongCount += 1
  }

  return topicOrder
    .map((key) => {
      const meta = topicMeta.get(key)
      const seeds = wrongList.filter((item) => topicKey(item) === key)
      const sameTopic = bankQuestions.filter(
        (item) =>
          topicPart(item.curriculumId) === topicPart(meta.curriculumId) &&
          topicPart(item.unitId) === topicPart(meta.unitId) &&
          topicPart(item.subunit) === topicPart(meta.subunit) &&
          !wrongIds.has(String(item.id)),
      )
      const sameUnit =
        sameTopic.length > 0
          ? []
          : bankQuestions.filter(
              (item) =>
                topicPart(item.curriculumId) === topicPart(meta.curriculumId) &&
                topicPart(item.unitId) === topicPart(meta.unitId) &&
                topicPart(item.subunit) !== topicPart(meta.subunit) &&
                !wrongIds.has(String(item.id)),
            )
      const pool = [...sameTopic, ...sameUnit]
      const seen = new Set()
      const suggestions = pool
        .map((item) => ({
          item,
          score: suggestionScore(item, seeds) + (topicPart(item.subunit) === topicPart(meta.subunit) ? 4 : 0),
        }))
        .sort((a, b) => b.score - a.score || String(a.item.id).localeCompare(String(b.item.id)))
        .map(({ item }) =>
          buildStudyQuestionEntry({
            item,
            course: meta.course,
            unitId: item.unitId,
            subunit: item.subunit,
            unitName: unitNameByKey.get(`${item.curriculumId}::${item.unitId}`) || meta.unitName,
          }),
        )
        .filter((entry) => {
          if (!entry.questionId || !entry.courseSlug || seen.has(entry.questionId)) return false
          seen.add(entry.questionId)
          return true
        })
        .slice(0, SUGGEST_PER_TOPIC)

      if (suggestions.length === 0) return null
      return {
        topicKey: key,
        topicLabel: [meta.unitName, meta.subunit].filter(Boolean).join(' · ') || meta.subunit || 'Topic',
        courseTitle: meta.course?.title || seeds[0]?.courseTitle || '',
        wrongCount: meta.wrongCount,
        suggestions,
      }
    })
    .filter(Boolean)
}

export function countSimilarSuggestions(groups) {
  return (groups || []).reduce(
    (sum, group) => sum + (Array.isArray(group?.suggestions) ? group.suggestions.length : 0),
    0,
  )
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
