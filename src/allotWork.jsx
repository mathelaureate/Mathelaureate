import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from './firebase'
import { questionPreviewText } from './studentStudy'
import {
  COURSE_OPTIONS,
  assignmentHref,
  assignmentLabel,
  assignmentStatus,
  buildQuestionAssignment,
  buildTopicAssignment,
  existingAssignmentKeys,
  markNoticesRead,
  normalizeAssignmentDoc,
  questionAssignmentKey,
  saveStudentAssignments,
  topicAssignmentKey,
  unreadNotices,
} from './assignments'

function todayKey() {
  return new Date().toLocaleDateString('en-CA')
}

export function AllotModal({ row, curricula, questions, existing, onClose, onSaved }) {
  const [courseSlug, setCourseSlug] = useState(COURSE_OPTIONS[0].slug)
  const [tab, setTab] = useState('topics')
  const [selected, setSelected] = useState(() => new Set())
  const [dueAt, setDueAt] = useState('')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setSelected(new Set())
    setQuery('')
  }, [courseSlug])
  const course = COURSE_OPTIONS.find((item) => item.slug === courseSlug) || COURSE_OPTIONS[0]
  const curriculum = curricula.find((item) => item.id === course.curriculumId) || null
  const units = curriculum?.units || []
  const existingKeys = existingAssignmentKeys(existing?.items)
  const courseQuestions = useMemo(
    () =>
      questions.filter(
        (item) => item.itemType === 'question' && item.curriculumId === course.curriculumId,
      ),
    [questions, course.curriculumId],
  )
  const filteredQuestions = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return courseQuestions.filter((item) => {
      if (!needle) return true
      return [item.subunit, item.unitId, questionPreviewText(item), item.id].join(' ').toLowerCase().includes(needle)
    })
  }, [courseQuestions, query])

  function toggle(key) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleUnit(unit) {
    const keys = (unit.subunits || []).map((subunit) => topicAssignmentKey(course.slug, unit.id, subunit))
    setSelected((current) => {
      const next = new Set(current)
      const allOn = keys.every((key) => next.has(key) || existingKeys.has(key))
      for (const key of keys) {
        if (existingKeys.has(key)) continue
        if (allOn) next.delete(key)
        else next.add(key)
      }
      return next
    })
  }

  async function save() {
    if (!selected.size) {
      setError('Pick at least one topic or question.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const added = []
      for (const unit of units) {
        for (const subunit of unit.subunits || []) {
          const key = topicAssignmentKey(course.slug, unit.id, subunit)
          if (!selected.has(key) || existingKeys.has(key)) continue
          added.push(buildTopicAssignment({ course, unit, subunit, dueAt }))
        }
      }
      for (const item of courseQuestions) {
        const key = questionAssignmentKey(item.id)
        if (!selected.has(key) || existingKeys.has(key)) continue
        added.push(buildQuestionAssignment({ course, item, dueAt }))
      }
      if (!added.length) {
        setError('Those items are already allotted.')
        setBusy(false)
        return
      }
      const topics = added.filter((item) => item.type === 'topic').length
      const qs = added.filter((item) => item.type === 'question').length
      const summary = [
        topics ? `${topics} topic${topics === 1 ? '' : 's'}` : '',
        qs ? `${qs} question${qs === 1 ? '' : 's'}` : '',
      ]
        .filter(Boolean)
        .join(' and ')
      const notice = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `notice-${Date.now()}`,
        title: 'New work from sir',
        body: `${summary} in ${course.title}${dueAt ? ` · due ${dueAt}` : ''}`,
        href: added.length === 1 ? assignmentHref(added[0]) : '/profile#allotted',
        createdAt: new Date().toISOString(),
      }
      const nextDoc = {
        items: [...(existing?.items || []), ...added],
        notices: [...(existing?.notices || []), notice],
      }
      await saveStudentAssignments({
        uid: row.uid,
        email: row.email,
        displayName: row.displayName,
        ...nextDoc,
      })
      onSaved?.(row.uid, nextDoc)
      onClose()
    } catch (saveError) {
      setError(saveError?.message || 'Unable to allot work.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="allot-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <article className="allot-modal" onClick={(event) => event.stopPropagation()}>
        <header className="allot-modal-head">
          <div>
            <p className="eyebrow">Allot work</p>
            <h3>{row.displayName || row.email || 'Student'}</h3>
          </div>
          <button type="button" className="icon-back-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <p className="allot-lead">Pick topics and questions. The student gets a notification, and you will see if they have not done it.</p>
        <div className="allot-toolbar">
          <label>
            Course
            <select value={courseSlug} onChange={(event) => setCourseSlug(event.target.value)}>
              {COURSE_OPTIONS.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Due date
            <input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
          </label>
        </div>
        <div className="lesson-tabs allot-tabs">
          <button type="button" className={`lesson-tab${tab === 'topics' ? ' active' : ''}`} onClick={() => setTab('topics')}>
            Topics
          </button>
          <button type="button" className={`lesson-tab${tab === 'questions' ? ' active' : ''}`} onClick={() => setTab('questions')}>
            Questions
          </button>
        </div>
        {tab === 'topics' ? (
          <div className="allot-list">
            {units.length === 0 ? (
              <p>No topics loaded for this course.</p>
            ) : (
              units.map((unit) => (
                <div className="allot-unit" key={unit.id}>
                  <button type="button" className="allot-unit-btn" onClick={() => toggleUnit(unit)}>
                    {unit.name}
                  </button>
                  {(unit.subunits || []).map((subunit) => {
                    const key = topicAssignmentKey(course.slug, unit.id, subunit)
                    const already = existingKeys.has(key)
                    return (
                      <label key={key} className={`allot-check${already ? ' is-done' : ''}`}>
                        <input
                          type="checkbox"
                          checked={already || selected.has(key)}
                          disabled={already}
                          onChange={() => toggle(key)}
                        />
                        <span>{subunit}</span>
                        {already ? <small>Allotted</small> : null}
                      </label>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="allot-list">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search questions"
            />
            {filteredQuestions.length === 0 ? (
              <p>No questions match.</p>
            ) : (
              filteredQuestions.slice(0, 80).map((item) => {
                const key = questionAssignmentKey(item.id)
                const already = existingKeys.has(key)
                return (
                  <label key={item.id} className={`allot-check${already ? ' is-done' : ''}`}>
                    <input
                      type="checkbox"
                      checked={already || selected.has(key)}
                      disabled={already}
                      onChange={() => toggle(key)}
                    />
                    <span>
                      <strong>{item.subunit || 'Question'}</strong>
                      <small>{questionPreviewText(item)}</small>
                    </span>
                    {already ? <small>Allotted</small> : null}
                  </label>
                )
              })
            )}
          </div>
        )}
        {error ? <p className="error-text">{error}</p> : null}
        <div className="allot-actions">
          <span>
            {selected.size} selected
            {dueAt ? ` · due ${dueAt}` : ''}
          </span>
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn primary" onClick={save} disabled={busy || selected.size === 0}>
            {busy ? 'Allotting…' : 'Allot and notify'}
          </button>
        </div>
      </article>
    </section>
  )
}

export function AssignedWorkList({ items, progress, onRemove, compact = false }) {
  const today = todayKey()
  if (!items?.length) return <p>{compact ? 'No allotted work yet.' : 'Sir has not allotted any topics or questions yet.'}</p>
  return (
    <ul className="allot-status-list">
      {items.map((item) => {
        const status = assignmentStatus(item, progress, today)
        return (
          <li key={item.id} className={`allot-status-item is-${status}`}>
            <div>
              <strong>{assignmentLabel(item)}</strong>
              <small>
                {item.courseTitle || item.courseSlug}
                {item.unitName ? ` · ${item.unitName}` : ''}
                {item.type === 'question' ? ' · Question' : ' · Topic'}
                {item.dueAt ? ` · due ${item.dueAt}` : ''}
              </small>
            </div>
            <span className={`allot-pill is-${status}`}>
              {status === 'done' ? 'Done' : status === 'overdue' ? 'Not done · overdue' : 'Not done'}
            </span>
            <Link className="ia-clear-inline" to={assignmentHref(item)}>
              Open
            </Link>
            {onRemove ? (
              <button type="button" className="ia-clear-inline" onClick={() => onRemove(item.id)}>
                Remove
              </button>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

export function AssignmentInbox({ user }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [pack, setPack] = useState({ items: [], notices: [] })
  const [readIds, setReadIds] = useState([])
  const [progress, setProgress] = useState({})

  useEffect(() => {
    if (!user?.uid) return undefined
    const unsubAssign = onSnapshot(doc(db, 'userAssignments', user.uid), (snap) => {
      setPack(normalizeAssignmentDoc(snap.exists() ? snap.data() : {}))
    })
    const unsubProgress = onSnapshot(doc(db, 'userCourseProgress', user.uid), (snap) => {
      const data = snap.exists() ? snap.data() : {}
      setReadIds(Array.isArray(data.readNoticeIds) ? data.readNoticeIds.map(String) : [])
      setProgress(data)
    })
    return () => {
      unsubAssign()
      unsubProgress()
    }
  }, [user?.uid])

  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(event) {
      if (!event.target.closest?.('.notice-wrap')) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  if (!user?.uid) return null
  const unread = unreadNotices(pack.notices, readIds)
  const pending = pack.items.filter((item) => assignmentStatus(item, progress, todayKey()) !== 'done')

  async function openNotice(notice) {
    setOpen(false)
    await markNoticesRead(user, [notice.id]).catch(() => {})
    if (notice.href) navigate(notice.href)
  }

  async function markAllRead() {
    await markNoticesRead(
      user,
      unread.map((item) => item.id),
    ).catch(() => {})
    setOpen(false)
    navigate('/profile#allotted')
  }

  return (
    <div className="notice-wrap">
      <button
        type="button"
        className={`notice-bell${unread.length ? ' has-unread' : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-label={unread.length ? `${unread.length} new assignments` : 'Assignments'}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            d="M6 9a6 6 0 1 1 12 0c0 4.2 1.6 5.6 1.6 5.6H4.4S6 13.2 6 9Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M10 18.2a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {unread.length ? <span>{unread.length}</span> : pending.length ? <i /> : null}
      </button>
      {open ? (
        <div className="notice-panel">
          <p>Work from sir</p>
          {unread.length === 0 && pack.items.length === 0 ? (
            <small>No allotted work yet.</small>
          ) : (
            <>
              {(unread.length ? unread : pack.notices.slice(-4).reverse()).map((notice) => (
                <button type="button" className="notice-item" key={notice.id} onClick={() => openNotice(notice)}>
                  <strong>{notice.title}</strong>
                  <span>{notice.body}</span>
                </button>
              ))}
              <button type="button" className="notice-all" onClick={markAllRead}>
                View allotted work
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
