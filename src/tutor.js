export const TUTOR_OPEN_EVENT = 'ml-tutor-open'

export function openTutor(detail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(TUTOR_OPEN_EVENT, { detail: detail || {} }))
}

export function tutorTextFromItem(item) {
  const fromBlocks = Array.isArray(item?.descriptionBlocks)
    ? item.descriptionBlocks
        .map((block) => (block?.type === 'text' ? String(block.text || '').trim() : ''))
        .filter(Boolean)
        .join('\n\n')
    : ''
  return String(fromBlocks || item?.description || item?.title || item?.preview || '').trim()
}

export function questionTutorContext({
  item,
  index = 0,
  questionNumber,
  courseTitle = '',
  courseSlug = '',
  unitName = '',
  subunit = '',
} = {}) {
  const number = questionNumber ?? (Number.isFinite(index) ? index + 1 : '')
  return {
    kind: 'question',
    label: number ? `Question ${number}` : 'This question',
    courseTitle: String(courseTitle || '').trim(),
    courseSlug: String(courseSlug || '').trim(),
    unitName: String(unitName || item?.unitName || '').trim(),
    subunit: String(subunit || item?.subunit || '').trim(),
    questionNumber: number || '',
    questionId: String(item?.id || item?.questionId || '').trim(),
    questionText: tutorTextFromItem(item).slice(0, 1800),
    marks: Number(item?.marks) || 0,
    difficulty: String(item?.difficulty || '').trim(),
    gdc: String(item?.gdc || '').trim(),
    questionLevel: String(item?.questionLevel || '').trim(),
  }
}

export function topicTutorContext({
  courseTitle = '',
  courseSlug = '',
  unitName = '',
  subunit = '',
} = {}) {
  const topic = String(subunit || unitName || 'this topic').trim()
  return {
    kind: 'topic',
    label: topic,
    courseTitle: String(courseTitle || '').trim(),
    courseSlug: String(courseSlug || '').trim(),
    unitName: String(unitName || '').trim(),
    subunit: String(subunit || '').trim(),
  }
}
