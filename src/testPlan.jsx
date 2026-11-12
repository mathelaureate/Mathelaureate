import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteField, doc, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import { openTutor, topicTutorContext } from './tutor'
import {
  calendarMonths,
  diffIsoDays,
  formatPlanDate,
  localISODate,
  monthGrid,
  monthLabel,
  normalizeTestPlan,
  normalizeTopicList,
  unitsForCourse,
} from './testPlanModel'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function MonthCalendar({
  months,
  monthIndex,
  onMonth,
  selected,
  onSelect,
  today,
  studyDates,
  doneDates,
  examDate,
  min,
  max,
}) {
  const page = months[monthIndex] || months[0]
  if (!page) return null
  const cells = monthGrid(page.year, page.month)
  const study = studyDates || new Set()
  const done = doneDates || new Set()

  return (
    <div className="plan-cal">
      <div className="plan-cal-head">
        <button type="button" className="plan-cal-nav" onClick={() => onMonth(monthIndex - 1)} disabled={monthIndex <= 0} aria-label="Previous month">
          ‹
        </button>
        <strong>{monthLabel(page.year, page.month)}</strong>
        <button
          type="button"
          className="plan-cal-nav"
          onClick={() => onMonth(monthIndex + 1)}
          disabled={monthIndex >= months.length - 1}
          aria-label="Next month"
        >
          ›
        </button>
      </div>
      <div className="plan-cal-week" aria-hidden="true">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="plan-cal-grid" aria-label={monthLabel(page.year, page.month)}>
        {cells.map((iso, index) => {
          if (!iso) return <span key={`empty-${index}`} className="plan-cal-empty" />
          const isExam = iso === examDate
          const isStudy = study.has(iso)
          const isDone = isStudy && done.has(iso)
          const disabled = (min && iso < min) || (max && iso > max)
          const classes = [
            'plan-cal-cell',
            iso === today ? 'is-today' : '',
            iso === selected ? 'is-selected' : '',
            isStudy ? 'is-study' : '',
            isDone ? 'is-done' : '',
            isExam ? 'is-exam' : '',
            study.size === 0 && !isExam && examDate && iso > (min || today) && iso < examDate ? 'is-span' : '',
          ]
            .filter(Boolean)
            .join(' ')
          const kind = isExam ? 'test' : isStudy ? 'study' : 'day'
          return (
            <button
              key={iso}
              type="button"
              className={classes}
              disabled={disabled}
              aria-pressed={iso === selected}
              aria-label={`${formatPlanDate(iso)}, ${kind}`}
              onClick={() => onSelect(iso)}
            >
              <span>{Number(iso.slice(-2))}</span>
            </button>
          )
        })}
      </div>
      <ul className="plan-legend">
        {study.size ? (
          <li>
            <i className="is-study" /> Study
          </li>
        ) : null}
        <li>
          <i className="is-exam" /> Test
        </li>
        <li>
          <i className="is-today" /> Today
        </li>
      </ul>
    </div>
  )
}

function apiBase() {
  return String(import.meta.env.VITE_PAYMENT_API_BASE_URL || '/api').replace(/\/$/, '')
}

async function saveTestPlan(user, plan) {
  const ref = doc(db, 'userCourseProgress', user.uid)
  await setDoc(
    ref,
    {
      uid: user.uid,
      email: user.email || '',
      testPlan: plan || deleteField(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  )
}

function topicKey(unitId, label) {
  return `${unitId}::${label}`.toLowerCase()
}

function topicFromOutline(label, units, links) {
  for (const unit of units || []) {
    if (unit.subunits.includes(label)) {
      return {
        key: topicKey(unit.id, label),
        label,
        unitId: unit.id,
        subunit: label,
        unitName: unit.name,
        custom: false,
      }
    }
  }
  const link = (links || []).find((item) => item.label === label && item.unitId)
  if (link) {
    return {
      key: topicKey(link.unitId, label),
      label,
      unitId: link.unitId,
      subunit: link.subunit || label,
      unitName: link.unitName || '',
      custom: false,
    }
  }
  return { key: topicKey('custom', label), label, unitId: '', subunit: '', unitName: '', custom: true }
}

function weakTopicsFor(wrongQuestions, curriculumId) {
  const seen = new Set()
  const topics = []
  for (const item of wrongQuestions || []) {
    if (curriculumId && item?.curriculumId && item.curriculumId !== curriculumId) continue
    const label = String(item?.subunit || '').trim()
    const key = label.toLowerCase()
    if (!label || seen.has(key)) continue
    seen.add(key)
    topics.push(label)
    if (topics.length >= 6) break
  }
  return topics
}

function examLead(examDate) {
  const left = diffIsoDays(localISODate(), examDate)
  if (left < 0) return 'The test date has passed'
  if (left === 0) return 'The test is today'
  if (left === 1) return 'The test is tomorrow'
  return `The test is in ${left} days`
}

function topicHref(plan, topicLabel) {
  const link = (plan?.topicLinks || []).find((item) => item.label === topicLabel)
  if (!plan?.courseSlug || !link?.unitId || !link?.subunit) return ''
  const params = new URLSearchParams({ unit: link.unitId, subunit: link.subunit })
  return `/courses/${plan.courseSlug}?${params.toString()}`
}

export default function TestPlanPanel({ user, curricula, courses, wrongQuestions, savedPlan, isLoading }) {
  const [plan, setPlan] = useState(null)
  const [hydrated, setHydrated] = useState(false)
  const [showForm, setShowForm] = useState(true)
  const [courseSlug, setCourseSlug] = useState(courses?.[0]?.slug || '')
  const [selected, setSelected] = useState([])
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [examDate, setExamDate] = useState('')
  const [minutes, setMinutes] = useState(45)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [focusDate, setFocusDate] = useState('')
  const [planMonth, setPlanMonth] = useState(0)
  const [pickMonth, setPickMonth] = useState(0)

  const course = (courses || []).find((item) => item.slug === courseSlug) || courses?.[0] || null
  const units = useMemo(() => unitsForCourse(curricula, course?.curriculumId), [curricula, course?.curriculumId])
  const today = localISODate()
  const maxDate = useMemo(() => {
    const [year, month, day] = today.split('-').map(Number)
    const date = new Date(year, month - 1, day + 60)
    const nextMonth = String(date.getMonth() + 1).padStart(2, '0')
    const nextDay = String(date.getDate()).padStart(2, '0')
    return `${date.getFullYear()}-${nextMonth}-${nextDay}`
  }, [today])
  const needle = query.trim().toLowerCase()
  const visibleUnits = units
    .map((unit) => ({
      ...unit,
      subunits: unit.subunits.filter((subunit) => !needle || subunit.toLowerCase().includes(needle) || unit.name.toLowerCase().includes(needle)),
    }))
    .filter((unit) => unit.subunits.length)

  useEffect(() => {
    if (isLoading || hydrated) return
    const next = normalizeTestPlan(savedPlan)
    setPlan(next)
    setShowForm(!next)
    if (next?.courseSlug) setCourseSlug(next.courseSlug)
    if (next?.examDate) setExamDate(next.examDate)
    if (next?.minutesPerDay) setMinutes(next.minutesPerDay)
    if (next?.topics?.length) {
      const savedCourse = (courses || []).find((item) => item.slug === next.courseSlug)
      const outline = unitsForCourse(curricula, savedCourse?.curriculumId)
      setSelected(next.topics.map((label) => topicFromOutline(label, outline, next.topicLinks)))
    }
    setHydrated(true)
  }, [courses, curricula, hydrated, isLoading, savedPlan])

  function addLabels(text) {
    const labels = normalizeTopicList(String(text || '').split(/[\n,]/), 8)
    if (!labels.length) return
    let dropped = false
    setSelected((current) => {
      const next = [...current]
      for (const label of labels) {
        if (next.some((item) => item.label.toLowerCase() === label.toLowerCase())) continue
        if (next.length >= 8) {
          dropped = true
          break
        }
        next.push({ key: topicKey('custom', label), label, unitId: '', subunit: '', unitName: '', custom: true })
      }
      return next
    })
    setDraft('')
    setError(dropped ? 'A plan can cover up to 8 topics.' : '')
  }

  function toggleTopic(topic) {
    setError('')
    setSelected((current) => {
      if (current.some((item) => item.key === topic.key)) return current.filter((item) => item.key !== topic.key)
      if (current.length >= 8) return current
      return [...current, topic]
    })
  }

  function removeTopic(key) {
    setSelected((current) => current.filter((item) => item.key !== key))
  }

  async function onGenerate(event) {
    event.preventDefault()
    if (!user || busy) return
    if (!selected.length) {
      setError('Add at least one topic.')
      return
    }
    if (!examDate || examDate < today || examDate > maxDate) {
      setError('Choose a test date within the next 60 days.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const token = await auth.currentUser?.getIdToken?.()
      if (!token) throw new Error('Sign in to build a test plan.')
      const response = await fetch(`${apiBase()}/test-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          courseTitle: course?.title || 'Mathematics',
          examDate,
          today,
          minutesPerDay: minutes,
          topics: selected.map((item) => item.label),
          weakTopics: weakTopicsFor(wrongQuestions, course?.curriculumId),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error || 'Could not build a plan. Try again.')
      const next = normalizeTestPlan({
        id: `plan-${Date.now()}`,
        courseSlug: course?.slug || '',
        courseTitle: course?.title || '',
        examDate,
        topics: selected.map((item) => item.label),
        topicLinks: selected
          .filter((item) => item.unitId && item.subunit)
          .map((item) => ({
            label: item.label,
            unitId: item.unitId,
            subunit: item.subunit,
            unitName: item.unitName,
          })),
        minutesPerDay: minutes,
        summary: data.summary,
        spaced: data.spaced,
        days: data.days,
        doneIds: [],
        createdAt: new Date().toISOString(),
      })
      if (!next) throw new Error('Could not build a plan. Try again.')
      await saveTestPlan(user, next)
      setPlan(next)
      setShowForm(false)
    } catch (cause) {
      setError(cause?.message || 'Could not build a plan. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function toggleTask(taskId) {
    if (!plan || busy) return
    const done = new Set(plan.doneIds)
    if (done.has(taskId)) done.delete(taskId)
    else done.add(taskId)
    const next = { ...plan, doneIds: [...done] }
    setPlan(next)
    try {
      await saveTestPlan(user, next)
    } catch {
      setPlan(plan)
      setError('Could not save that tick.')
    }
  }

  async function removePlan() {
    if (!user || busy) return
    setBusy(true)
    setError('')
    try {
      await saveTestPlan(user, null)
      setPlan(null)
      setShowForm(true)
    } catch {
      setError('Could not remove the plan.')
    } finally {
      setBusy(false)
    }
  }

  const totalTasks = (plan?.days || []).reduce((sum, day) => sum + day.tasks.length, 0)
  const doneTasks = (plan?.days || []).reduce(
    (sum, day) => sum + day.tasks.filter((task) => plan.doneIds.includes(task.id)).length,
    0,
  )
  const atTopicCap = selected.length >= 8
  const pickMonths = useMemo(() => calendarMonths(today, maxDate), [today, maxDate])
  const planMonths = useMemo(() => {
    if (!plan) return []
    const dates = [today, plan.examDate, ...plan.days.map((day) => day.date)].filter(Boolean).sort()
    return calendarMonths(dates[0], dates[dates.length - 1])
  }, [plan, today])
  const studyDates = useMemo(() => new Set((plan?.days || []).map((day) => day.date)), [plan])
  const doneDates = useMemo(() => {
    const done = new Set()
    for (const day of plan?.days || []) {
      if (day.tasks.length && day.tasks.every((task) => plan.doneIds.includes(task.id))) done.add(day.date)
    }
    return done
  }, [plan])
  const focusDay = (plan?.days || []).find((day) => day.date === focusDate) || null
  const syncedPlanId = useRef('')

  useEffect(() => {
    if (!plan?.id || syncedPlanId.current === plan.id) return
    syncedPlanId.current = plan.id
    const upcoming = plan.days.find((day) => day.date >= today)?.date || plan.days[plan.days.length - 1]?.date || plan.examDate
    setFocusDate(upcoming || '')
    const dates = [today, plan.examDate, ...plan.days.map((day) => day.date)].filter(Boolean).sort()
    const months = calendarMonths(dates[0], dates[dates.length - 1])
    const key = String(upcoming || '').slice(0, 7)
    const index = months.findIndex((item) => `${item.year}-${String(item.month + 1).padStart(2, '0')}` === key)
    setPlanMonth(index >= 0 ? index : 0)
  }, [plan, today])

  useEffect(() => {
    if (!examDate) return
    const key = examDate.slice(0, 7)
    const index = pickMonths.findIndex((item) => `${item.year}-${String(item.month + 1).padStart(2, '0')}` === key)
    if (index >= 0) setPickMonth(index)
  }, [examDate, pickMonths])

  return (
    <section className="profile-panel" id="test-plan">
      <div className="profile-section-head">
        <h2>Test plan</h2>
        <p>
          {plan && !showForm
            ? plan.summary || 'Work through the days and tick each task as you finish it.'
            : 'Name the topics and the test date. Laureate builds each study day.'}
        </p>
      </div>

      {isLoading || !hydrated ? <p className="ia-status">Loading your plan...</p> : null}

      {hydrated && plan && !showForm ? (
        <div className="plan-board">
          <div className="plan-meta">
            <p>
              {plan.courseTitle ? `${plan.courseTitle} · ` : ''}
              {examLead(plan.examDate)}
              {plan.spaced ? ' · study days are spaced out' : ''}
            </p>
            <p>
              {doneTasks} of {totalTasks} done
            </p>
          </div>
          <div
            className="plan-meter"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={totalTasks}
            aria-valuenow={doneTasks}
            aria-label="Plan progress"
          >
            <span style={{ width: totalTasks ? `${Math.round((doneTasks / totalTasks) * 100)}%` : '0%' }} />
          </div>
          <div className="plan-layout">
            <MonthCalendar
              months={planMonths}
              monthIndex={planMonth}
              onMonth={setPlanMonth}
              selected={focusDate}
              onSelect={setFocusDate}
              today={today}
              studyDates={studyDates}
              doneDates={doneDates}
              examDate={plan.examDate}
            />
            <article className="plan-detail">
              <p className="plan-kicker">
                {focusDate ? formatPlanDate(focusDate) : 'Pick a day'}
                {focusDate === today ? ' · Today' : ''}
                {focusDate === plan.examDate ? ' · Test' : ''}
              </p>
              <h3>{focusDay?.title || (focusDate === plan.examDate ? 'Test day' : 'Free day')}</h3>
              {focusDay ? (
                <ul>
                  {focusDay.tasks.map((task) => {
                    const href = topicHref(plan, task.topic)
                    const checked = plan.doneIds.includes(task.id)
                    return (
                      <li key={task.id} className={checked ? 'is-done' : ''}>
                        <label>
                          <input type="checkbox" checked={checked} onChange={() => toggleTask(task.id)} />
                          <span>{task.label}</span>
                        </label>
                        {href ? <Link to={href}>Open topic</Link> : null}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p>{focusDate === plan.examDate ? 'The test is on this day.' : 'Nothing is set for this day.'}</p>
              )}
              {focusDay ? (
                <button
                  type="button"
                  className="plan-ask"
                  onClick={() =>
                    openTutor(
                      topicTutorContext({
                        courseTitle: plan.courseTitle,
                        courseSlug: plan.courseSlug,
                        unitName: focusDay.title,
                        subunit: focusDay.tasks.map((task) => task.topic).find(Boolean) || focusDay.title,
                      }),
                    )
                  }
                >
                  Ask Laureate
                </button>
              ) : null}
            </article>
          </div>
          <div className="plan-actions">
            <button type="button" className="btn ghost" onClick={() => setShowForm(true)}>
              New plan
            </button>
            <button type="button" className="plan-ask" onClick={removePlan} disabled={busy}>
              Remove plan
            </button>
          </div>
        </div>
      ) : null}

      {hydrated && showForm ? (
        <form className="plan-form" onSubmit={onGenerate}>
          <label className="plan-field">
            <span>Course</span>
            <select
              value={course?.slug || ''}
              onChange={(event) => {
                setCourseSlug(event.target.value)
                setSelected((current) => current.filter((item) => item.custom))
                setQuery('')
              }}
            >
              {(courses || []).map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>

          <div className="plan-field">
            <span>Topics</span>
            <div className="plan-add">
              <input
                value={draft}
                placeholder="Type a topic, or several separated by commas"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addLabels(draft)
                  }
                }}
              />
              <button type="button" className="btn ghost" onClick={() => addLabels(draft)} disabled={!draft.trim() || atTopicCap}>
                Add
              </button>
            </div>
          </div>

          {selected.length ? (
            <div className="plan-chips">
              {selected.map((topic) => (
                <button type="button" key={topic.key} className="plan-chip" onClick={() => removeTopic(topic.key)}>
                  {topic.label}
                  <span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className={`plan-setup${units.length ? '' : ' is-calendar-only'}`}>
            {units.length ? (
            <div className="plan-setup-main">
                <div className="plan-field">
                  <span>From this course</span>
                  <input
                    value={query}
                    placeholder="Search the course outline"
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  <div className="plan-topics">
                    {visibleUnits.length === 0 ? <p className="plan-empty">No topics match.</p> : null}
                    {visibleUnits.map((unit) => (
                      <div key={unit.id}>
                        <p className="plan-unit">{unit.name}</p>
                        {unit.subunits.map((subunit) => {
                          const key = topicKey(unit.id, subunit)
                          const on = selected.some((item) => item.key === key)
                          return (
                            <label key={key} className={`plan-topic${on ? ' is-on' : ''}`}>
                              <input
                                type="checkbox"
                                checked={on}
                                disabled={!on && atTopicCap}
                                onChange={() =>
                                  toggleTopic({
                                    key,
                                    label: subunit,
                                    unitId: unit.id,
                                    subunit,
                                    unitName: unit.name,
                                    custom: false,
                                  })
                                }
                              />
                              <span>{subunit}</span>
                            </label>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
            </div>
            ) : null}
            <div className="plan-setup-side">
              <MonthCalendar
                months={pickMonths}
                monthIndex={pickMonth}
                onMonth={setPickMonth}
                selected={examDate}
                onSelect={setExamDate}
                today={today}
                examDate={examDate}
                min={today}
                max={maxDate}
              />
              <label className="plan-field">
                <span>Minutes a day</span>
                <select value={minutes} onChange={(event) => setMinutes(Number(event.target.value))}>
                  <option value={30}>30</option>
                  <option value={45}>45</option>
                  <option value={60}>60</option>
                </select>
              </label>
              <p className="plan-note">
                {examDate ? `Test on ${formatPlanDate(examDate)}.` : 'Pick the test date on the calendar.'} Up to 8 topics.
                {weakTopicsFor(wrongQuestions, course?.curriculumId).length
                  ? ' Missed questions in this course are weighed more heavily.'
                  : ''}
              </p>
              {error ? <p className="error-text">{error}</p> : null}
              <div className="plan-actions">
                <button className="btn primary" type="submit" disabled={busy || !selected.length || !examDate}>
                  {busy ? 'Building the plan…' : 'Build my plan'}
                </button>
                {plan ? (
                  <button type="button" className="plan-ask" onClick={() => setShowForm(false)}>
                    Back to plan
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </form>
      ) : null}
    </section>
  )
}
