import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import { questionPreviewText } from './studentStudy'

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

export const HOMEWORK_MIX = { easy: 2, medium: 4, hard: 4 }

export function assignmentHref(item) {
  if (item?.id) return `/homework/${item.id}`
  return '/profile#homework'
}

function shuffleList(items) {
  const arr = [...(items || [])]
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function normalizeHomeworkDifficulty(value) {
  const difficulty = String(value || 'medium').trim().toLowerCase()
  if (difficulty === 'easy' || difficulty === 'hard') return difficulty
  return 'medium'
}

export function questionsForTopic(bank, assignment) {
  const curriculumId = String(assignment?.curriculumId || '').trim()
  const unitId = String(assignment?.unitId || '').trim()
  const subunit = String(assignment?.subunit || '').trim()
  return (bank || []).filter((item) => {
    if (item?.itemType !== 'question' || !item?.id) return false
    if (curriculumId && String(item.curriculumId || '').trim() !== curriculumId) return false
    if (unitId && String(item.unitId || '').trim() && String(item.unitId || '').trim() !== unitId) return false
    if (subunit && String(item.subunit || '').trim() !== subunit) return false
    return true
  })
}

export function pickHomeworkQuestions(pool) {
  const byDifficulty = { easy: [], medium: [], hard: [] }
  for (const item of pool || []) {
    byDifficulty[normalizeHomeworkDifficulty(item.difficulty)].push(item)
  }
  const take = (list, count) => shuffleList(list).slice(0, count)
  let picked = [
    ...take(byDifficulty.easy, HOMEWORK_MIX.easy),
    ...take(byDifficulty.medium, HOMEWORK_MIX.medium),
    ...take(byDifficulty.hard, HOMEWORK_MIX.hard),
  ]
  const used = new Set(picked.map((item) => item.id))
  const need = HOMEWORK_MIX.easy + HOMEWORK_MIX.medium + HOMEWORK_MIX.hard - picked.length
  if (need > 0) {
    picked = [...picked, ...shuffleList((pool || []).filter((item) => !used.has(item.id))).slice(0, need)]
  }
  const order = { easy: 0, medium: 1, hard: 2 }
  return picked.sort(
    (a, b) => order[normalizeHomeworkDifficulty(a.difficulty)] - order[normalizeHomeworkDifficulty(b.difficulty)],
  )
}

export function normalizeHomeworkSession(raw) {
  const questionIds = Array.isArray(raw?.questionIds) ? raw.questionIds.map(String).filter(Boolean) : []
  const solvedCount = Math.min(questionIds.length, Math.max(0, Number(raw?.solvedCount) || 0))
  return {
    questionIds,
    solvedCount,
    completedAt: String(raw?.completedAt || '').trim(),
  }
}

export function homeworkSessionsMap(progress) {
  const raw = progress?.homeworkSessions && typeof progress.homeworkSessions === 'object' ? progress.homeworkSessions : {}
  const next = {}
  for (const [id, session] of Object.entries(raw)) {
    if (id) next[id] = normalizeHomeworkSession(session)
  }
  return next
}

export async function saveHomeworkSession(user, assignmentId, session) {
  if (!user?.uid || !assignmentId) return
  const ref = doc(db, 'userCourseProgress', user.uid)
  const snap = await getDoc(ref)
  const data = snap.exists() ? snap.data() : {}
  const current = homeworkSessionsMap(data)
  await setDoc(
    ref,
    {
      uid: user.uid,
      email: user.email || '',
      homeworkSessions: { ...current, [assignmentId]: normalizeHomeworkSession(session) },
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  )
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
    title: String(raw?.title || 'New homework').trim(),
    body: String(raw?.body || '').trim(),
    href: String(raw?.href || '/profile#homework').trim(),
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
  const session = homeworkSessionsMap(progress)[item?.id]
  if (!session) return false
  if (session.completedAt) return true
  return Boolean(session.questionIds.length && session.solvedCount >= session.questionIds.length)
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

export function normalizeClassGroup(raw, id = '') {
  const memberUids = [...new Set((Array.isArray(raw?.memberUids) ? raw.memberUids : []).map(String).filter(Boolean))]
  return {
    id: String(raw?.id || id || '').trim(),
    name: String(raw?.name || '').trim() || 'Untitled class',
    memberUids,
    createdAt: String(raw?.createdAt || '').trim(),
    updatedAt: String(raw?.updatedAt || '').trim(),
  }
}

export async function saveClassGroup(klass) {
  const id = String(klass?.id || '').trim()
  if (!id) throw new Error('Missing class.')
  const next = normalizeClassGroup({ ...klass, updatedAt: new Date().toISOString() }, id)
  await setDoc(
    doc(db, 'classGroups', id),
    {
      name: next.name,
      memberUids: next.memberUids,
      createdAt: next.createdAt || new Date().toISOString(),
      updatedAt: next.updatedAt,
    },
    { merge: true },
  )
  return next
}

export async function assignHomeworkToTargets({ targets, existingByUid, course, units, selectedKeys, dueAt }) {
  const selected = selectedKeys instanceof Set ? selectedKeys : new Set(selectedKeys || [])
  const updates = {}
  let reached = 0
  for (const target of targets || []) {
    if (!target?.uid) continue
    const existing = existingByUid?.[target.uid] || { items: [], notices: [] }
    const keys = existingAssignmentKeys(existing.items)
    const added = []
    for (const unit of units || []) {
      for (const subunit of unit.subunits || []) {
        const key = topicAssignmentKey(course.slug, unit.id, subunit)
        if (!selected.has(key) || keys.has(key)) continue
        added.push(buildTopicAssignment({ course, unit, subunit, dueAt }))
      }
    }
    if (!added.length) {
      updates[target.uid] = existing
      continue
    }
    reached += 1
    const notice = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `notice-${Date.now()}-${target.uid}`,
      title: 'New homework',
      body: `${added.length} topic${added.length === 1 ? '' : 's'} in ${course.title}${dueAt ? ` · due ${dueAt}` : ''}`,
      href: added.length === 1 ? assignmentHref(added[0]) : '/profile#homework',
      createdAt: new Date().toISOString(),
    }
    const nextDoc = {
      items: [...(existing.items || []), ...added],
      notices: [...(existing.notices || []), notice],
    }
    await saveStudentAssignments({
      uid: target.uid,
      email: target.email,
      displayName: target.displayName,
      ...nextDoc,
    })
    updates[target.uid] = nextDoc
  }
  return { updates, reached }
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
