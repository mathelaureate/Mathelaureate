import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import { questionPreviewText, questionStudyPath } from './studentStudy'

export const COURSE_OPTIONS = [
  { slug: 'ibdp-aa', title: 'IBDP Mathematics AA', curriculumId: 'ibdp-aa-hl' },
  { slug: 'igcse-additional', title: 'IGCSE Additional Maths', curriculumId: 'igcse-add-maths' },
  { slug: 'igcse-international', title: 'IGCSE International Maths', curriculumId: 'igcse-intl-maths' },
]

export function courseOptionForCurriculum(curriculumId) {
  return COURSE_OPTIONS.find((item) => item.curriculumId === curriculumId) || null
}

export function topicAssignmentKey(courseSlug, unitId, subunit) {
  return `topic:${courseSlug}:${unitId}::${subunit}`
}

export function questionAssignmentKey(questionId) {
  return `question:${questionId}`
}

export function assignmentHref(item) {
  if (item?.type === 'question') {
    return (
      questionStudyPath({
        courseSlug: item.courseSlug,
        unitId: item.unitId,
        subunit: item.subunit,
        questionId: item.questionId,
      }) || `/courses/${item.courseSlug || 'ibdp-aa'}`
    )
  }
  if (!item?.courseSlug) return '/#programs'
  const params = new URLSearchParams()
  if (item.unitId) params.set('unit', item.unitId)
  if (item.subunit) params.set('subunit', item.subunit)
  params.set('tab', 'lesson')
  return `/courses/${item.courseSlug}?${params.toString()}`
}

export function assignmentLabel(item) {
  if (item?.type === 'question') {
    return item.questionPreview || 'Assigned question'
  }
  return item?.subunit || item?.unitName || 'Assigned topic'
}

export function normalizeAssignment(raw) {
  const type = raw?.type === 'question' ? 'question' : 'topic'
  const questionId = String(raw?.questionId || '').trim()
  const unitId = String(raw?.unitId || '').trim()
  const subunit = String(raw?.subunit || '').trim()
  const courseSlug = String(raw?.courseSlug || '').trim()
  return {
    id: String(raw?.id || `${type}:${courseSlug}:${unitId}:${subunit}:${questionId}`).trim(),
    type,
    courseSlug,
    courseTitle: String(raw?.courseTitle || '').trim(),
    curriculumId: String(raw?.curriculumId || '').trim(),
    unitId,
    unitName: String(raw?.unitName || '').trim(),
    subunit,
    questionId,
    questionPreview: String(raw?.questionPreview || '').trim().slice(0, 180),
    assignedAt: String(raw?.assignedAt || '').trim(),
    dueAt: String(raw?.dueAt || '').trim(),
  }
}

export function normalizeNotice(raw) {
  return {
    id: String(raw?.id || '').trim(),
    title: String(raw?.title || 'New work from sir').trim(),
    body: String(raw?.body || '').trim(),
    href: String(raw?.href || '/profile#allotted').trim(),
    createdAt: String(raw?.createdAt || '').trim(),
  }
}

export function normalizeAssignmentDoc(raw) {
  const items = Array.isArray(raw?.items) ? raw.items.map(normalizeAssignment).filter((item) => item.id) : []
  const notices = Array.isArray(raw?.notices) ? raw.notices.map(normalizeNotice).filter((item) => item.id) : []
  return { items, notices }
}

export function visitedSubunitSet(progress) {
  const keys = new Set()
  for (const course of Object.values(progress?.courses || {})) {
    const slug = String(course?.slug || '').trim()
    for (const key of Array.isArray(course?.visitedSubunits) ? course.visitedSubunits : []) {
      keys.add(String(key))
      if (slug) keys.add(`${slug}:${key}`)
    }
  }
  return keys
}

export function viewedQuestionSet(progress) {
  const ids = new Set()
  for (const id of Array.isArray(progress?.viewedQuestions) ? progress.viewedQuestions : []) {
    if (id) ids.add(String(id))
  }
  for (const listKey of ['savedQuestions', 'wrongQuestions']) {
    for (const item of Array.isArray(progress?.[listKey]) ? progress[listKey] : []) {
      if (item?.questionId) ids.add(String(item.questionId))
    }
  }
  return ids
}

export function isAssignmentDone(item, progress) {
  if (item?.type === 'question') return viewedQuestionSet(progress).has(item.questionId)
  const keys = visitedSubunitSet(progress)
  return keys.has(`${item.unitId}::${item.subunit}`) || keys.has(`${item.courseSlug}:${item.unitId}::${item.subunit}`)
}

export function assignmentStatus(item, progress, today) {
  if (isAssignmentDone(item, progress)) return 'done'
  if (item?.dueAt && String(item.dueAt) < String(today)) return 'overdue'
  return 'pending'
}

export function buildTopicAssignment({ course, unit, subunit, dueAt }) {
  return normalizeAssignment({
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `topic-${Date.now()}`,
    type: 'topic',
    courseSlug: course?.slug,
    courseTitle: course?.title,
    curriculumId: course?.curriculumId,
    unitId: unit?.id,
    unitName: unit?.name,
    subunit,
    assignedAt: new Date().toISOString(),
    dueAt,
  })
}

export function buildQuestionAssignment({ course, item, dueAt }) {
  const option = courseOptionForCurriculum(item?.curriculumId) || course
  return normalizeAssignment({
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `question-${Date.now()}`,
    type: 'question',
    courseSlug: option?.slug || course?.slug,
    courseTitle: option?.title || course?.title,
    curriculumId: item?.curriculumId || option?.curriculumId,
    unitId: item?.unitId,
    unitName: item?.unitName || '',
    subunit: item?.subunit,
    questionId: item?.id,
    questionPreview: questionPreviewText(item),
    assignedAt: new Date().toISOString(),
    dueAt,
  })
}

export function existingAssignmentKeys(items) {
  return new Set(
    (items || []).map((item) =>
      item.type === 'question'
        ? questionAssignmentKey(item.questionId)
        : topicAssignmentKey(item.courseSlug, item.unitId, item.subunit),
    ),
  )
}

export async function saveStudentAssignments({ uid, email, displayName, items, notices }) {
  if (!uid) throw new Error('Missing student.')
  await setDoc(
    doc(db, 'userAssignments', uid),
    {
      uid,
      email: email || '',
      displayName: displayName || '',
      items,
      notices: (notices || []).slice(-40),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  )
}

export async function markNoticesRead(user, noticeIds) {
  if (!user?.uid || !noticeIds?.length) return
  const ref = doc(db, 'userCourseProgress', user.uid)
  const snap = await getDoc(ref)
  const data = snap.exists() ? snap.data() : {}
  const current = Array.isArray(data.readNoticeIds) ? data.readNoticeIds.map(String) : []
  const next = [...new Set([...current, ...noticeIds])]
  if (next.length === current.length) return
  await setDoc(
    ref,
    {
      uid: user.uid,
      email: user.email || '',
      readNoticeIds: next.slice(-80),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  )
}

export function unreadNotices(notices, readIds) {
  const read = new Set(readIds || [])
  return (notices || []).filter((item) => item.id && !read.has(item.id))
}
