const MAX_SESSIONS = 12
const MAX_SPAN_DAYS = 60
const MAX_TOPICS = 8

export function isoDate(value) {
  const text = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return ''
  const [year, month, day] = text.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return ''
  return text
}

export function localISODate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addIsoDays(iso, days) {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

export function diffIsoDays(from, to) {
  const [y1, m1, d1] = from.split('-').map(Number)
  const [y2, m2, d2] = to.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000)
}

export function sessionDates(today, examDate) {
  const start = isoDate(today)
  const exam = isoDate(examDate)
  if (!start || !exam) return null
  const span = diffIsoDays(start, exam)
  if (span < 0 || span > MAX_SPAN_DAYS) return null
  if (span === 0) return { dates: [start], spaced: false }
  const all = []
  for (let index = 0; index < span; index += 1) all.push(addIsoDays(start, index))
  if (all.length <= MAX_SESSIONS) return { dates: all, spaced: false }
  const picked = []
  for (let index = 0; index < MAX_SESSIONS; index += 1) {
    const at = Math.round((index * (all.length - 1)) / (MAX_SESSIONS - 1))
    const date = all[at]
    if (picked[picked.length - 1] !== date) picked.push(date)
  }
  return { dates: picked, spaced: true }
}

function cleanText(value, max) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

export function normalizeTopicList(raw, max = MAX_TOPICS) {
  const seen = new Set()
  const topics = []
  const source = Array.isArray(raw) ? raw : String(raw || '').split(/\n|,/)
  for (const item of source) {
    const label = cleanText(typeof item === 'string' ? item : item?.label || item?.subunit, 120)
    const key = label.toLowerCase()
    if (!label || seen.has(key)) continue
    seen.add(key)
    topics.push(label)
    if (topics.length >= max) break
  }
  return topics
}

export function unitsForCourse(curricula, curriculumId) {
  const course = (curricula || []).find((item) => item?.id === curriculumId)
  return (course?.units || [])
    .map((unit) => ({
      id: cleanText(unit?.id, 80),
      name: cleanText(unit?.name, 160) || 'Unit',
      subunits: (unit?.subunits || [])
        .map((subunit) => cleanText(typeof subunit === 'string' ? subunit : subunit?.name || subunit?.title, 120))
        .filter(Boolean),
    }))
    .filter((unit) => unit.id && unit.subunits.length)
}

export function calendarMonths(fromIso, toIso) {
  const start = isoDate(fromIso)
  const end = isoDate(toIso)
  if (!start || !end || end < start) return []
  const months = []
  let year = Number(start.slice(0, 4))
  let month = Number(start.slice(5, 7)) - 1
  const endYear = Number(end.slice(0, 4))
  const endMonth = Number(end.slice(5, 7)) - 1
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push({ year, month })
    month += 1
    if (month > 11) {
      month = 0
      year += 1
    }
  }
  return months
}

export function monthGrid(year, month) {
  const pad = (new Date(year, month, 1).getDay() + 6) % 7
  const count = new Date(year, month + 1, 0).getDate()
  const cells = Array.from({ length: pad }, () => null)
  for (let day = 1; day <= count; day += 1) {
    cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
  }
  while (cells.length % 7) cells.push(null)
  return cells
}

export function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

export function formatPlanDate(iso) {
  const [year, month, day] = String(iso || '').split('-').map(Number)
  if (!year || !month || !day) return iso
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function buildPlanFromModel(text, { dates, topics }) {
  const cleaned = String(text || '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  let data
  try {
    data = JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    return null
  }
  const allowed = new Set(topics)
  const modelDays = Array.isArray(data?.days) ? data.days : []
  const byDate = new Map()
  for (const day of modelDays) {
    const date = isoDate(day?.date)
    if (date) byDate.set(date, day)
  }
  const days = []
  for (let index = 0; index < dates.length; index += 1) {
    const date = dates[index]
    const source = byDate.get(date) || modelDays[index] || {}
    const rawTasks = Array.isArray(source?.tasks) ? source.tasks : []
    const tasks = rawTasks
      .slice(0, 3)
      .map((task) => {
        if (typeof task === 'string') return { label: cleanText(task, 160), topic: '' }
        const topic = cleanText(task?.topic, 120)
        return {
          label: cleanText(task?.label || task?.task, 160),
          topic: allowed.has(topic) ? topic : '',
        }
      })
      .filter((task) => task.label)
      .slice(0, 3)
      .map((task, taskIndex) => ({
        id: `d${index}-t${taskIndex}`,
        label: task.label,
        topic: task.topic,
      }))
    if (!tasks.length) return null
    days.push({
      date,
      title: cleanText(source?.title, 80) || 'Study',
      tasks,
    })
  }
  if (days.length !== dates.length) return null
  return {
    summary: cleanText(data?.summary, 280),
    days,
  }
}

export function normalizeTestPlan(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const examDate = isoDate(raw.examDate)
  const topics = normalizeTopicList(raw.topics, MAX_TOPICS)
  const topicLinks = []
  const seenLinks = new Set()
  for (const link of Array.isArray(raw.topicLinks) ? raw.topicLinks : []) {
    const label = cleanText(link?.label, 120)
    const key = label.toLowerCase()
    if (!label || seenLinks.has(key)) continue
    seenLinks.add(key)
    topicLinks.push({
      label,
      unitId: cleanText(link?.unitId, 80),
      subunit: cleanText(link?.subunit, 120),
      unitName: cleanText(link?.unitName, 160),
    })
  }
  const days = []
  const sourceDays = Array.isArray(raw.days) ? raw.days.slice(0, MAX_SESSIONS) : []
  sourceDays.forEach((day, index) => {
    const date = isoDate(day?.date)
    if (!date) return
    const tasks = []
    const sourceTasks = Array.isArray(day?.tasks) ? day.tasks : []
    sourceTasks.slice(0, 3).forEach((task, taskIndex) => {
      const label = cleanText(typeof task === 'string' ? task : task?.label, 160)
      if (!label) return
      tasks.push({
        id: cleanText(task?.id, 20) || `d${index}-t${taskIndex}`,
        label,
        topic: cleanText(task?.topic, 120),
      })
    })
    if (!tasks.length) return
    days.push({
      date,
      title: cleanText(day?.title, 80) || 'Study',
      tasks,
    })
  })
  if (!examDate || !topics.length || !days.length) return null
  const minutes = Number(raw.minutesPerDay)
  const doneIds = Array.isArray(raw.doneIds)
    ? [...new Set(raw.doneIds.map((id) => cleanText(id, 20)).filter(Boolean))].slice(0, 48)
    : []
  return {
    id: cleanText(raw.id, 40) || `plan-${examDate}`,
    courseSlug: cleanText(raw.courseSlug, 80),
    courseTitle: cleanText(raw.courseTitle, 80),
    examDate,
    topics,
    topicLinks,
    minutesPerDay: minutes === 30 || minutes === 60 ? minutes : 45,
    summary: cleanText(raw.summary, 280),
    spaced: Boolean(raw.spaced),
    days,
    doneIds,
    createdAt: cleanText(raw.createdAt, 40),
  }
}
