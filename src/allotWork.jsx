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

function formatDue(dueAt) {
  const raw = String(dueAt || '').trim()
  if (!raw) return ''
  const [year, month, day] = raw.split('-').map(Number)
  if (!year || !month || !day) return raw
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function statusCopy(status) {
  if (status === 'done') return 'Done'
  if (status === 'overdue') return 'Overdue'
  return 'To do'
}

function itemMeta(item) {
  return [item.courseTitle || item.courseSlug, item.dueAt ? `due ${formatDue(item.dueAt)}` : '']
    .filter(Boolean)
    .join(' · ')
}

export function AllotModal({ row, curricula, questions, existing, onClose, onSaved }) {
  const [courseSlug, setCourseSlug] = useState(COURSE_OPTIONS[0].slug)
  const [tab, setTab] = useState('topics')
  const [selected, setSelected] = useState(() => new Set())
  const [dueAt, setDueAt] = useState('')
  const [query, setQuery] = useState('')
  const [openUnit, setOpenUnit] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setSelected(new Set())
    setQuery('')
    setOpenUnit('')
  }, [courseSlug])

  const course = COURSE_OPTIONS.find((item) => item.slug === courseSlug) || COURSE_OPTIONS[0]
  const curriculum = curricula.find((item) => item.id === course.curriculumId) || null
  const units = curriculum?.units || []
  const existingKeys = existingAssignmentKeys(existing?.items)
  const courseQuestions = useMemo(
    () => questions.filter((item) => item.itemType === 'question' && item.curriculumId === course.curriculumId),
    [questions, course.curriculumId],
  )
  const filteredQuestions = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return courseQuestions.filter((item) => {
      if (!needle) return true
      return [item.subunit, item.unitId, questionPreviewText(item), item.id].join(' ').toLowerCase().includes(needle)
    })
  }, [courseQuestions, query])
  const questionGroups = useMemo(() => {
    const groups = new Map()
    for (const item of filteredQuestions.slice(0, 80)) {
      const key = item.subunit || 'Other'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(item)
    }
    return [...groups.entries()]
  }, [filteredQuestions])

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

  function unitCounts(unit) {
    const keys = (unit.subunits || []).map((subunit) => topicAssignmentKey(course.slug, unit.id, subunit))
    const already = keys.filter((key) => existingKeys.has(key)).length
    const picked = keys.filter((key) => selected.has(key)).length
    return { total: keys.length, already, picked }
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
        body: `${summary} in ${course.title}${dueAt ? ` · due ${formatDue(dueAt)}` : ''}`,
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
        <div className="allot-tabs" role="tablist">
          <button type="button" className={`allot-tab${tab === 'topics' ? ' is-active' : ''}`} onClick={() => setTab('topics')}>
            Topics
          </button>
          <button
            type="button"
            className={`allot-tab${tab === 'questions' ? ' is-active' : ''}`}
            onClick={() => setTab('questions')}
          >
            Questions
          </button>
        </div>
        {tab === 'topics' ? (
          <div className="allot-list">
            {units.length === 0 ? (
              <p className="allot-empty">No topics loaded for this course.</p>
            ) : (
              units.map((unit) => {
                const counts = unitCounts(unit)
                const expanded = openUnit === unit.id
                return (
                  <div className={`allot-unit${expanded ? ' is-open' : ''}`} key={unit.id}>
                    <div className="allot-unit-row">
                      <button type="button" className="allot-unit-btn" onClick={() => setOpenUnit(expanded ? '' : unit.id)}>
                        <span>{expanded ? '▾' : '▸'}</span>
                        <strong>{unit.name}</strong>
                        <small>
                          {counts.picked ? `${counts.picked} selected · ` : ''}
                          {counts.already ? `${counts.already} allotted · ` : ''}
                          {counts.total} topics
                        </small>
                      </button>
                      <button type="button" className="allot-unit-all" onClick={() => toggleUnit(unit)}>
                        {counts.picked + counts.already === counts.total ? 'Clear' : 'All'}
                      </button>
                    </div>
                    {expanded
                      ? (unit.subunits || []).map((subunit) => {
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
                            </label>
                          )
                        })
                      : null}
                  </div>
                )
              })
            )}
          </div>
        ) : (
          <div className="allot-list">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search questions" />
            {questionGroups.length === 0 ? (
              <p className="allot-empty">No questions match.</p>
            ) : (
              questionGroups.map(([subunit, items]) => (
                <div className="allot-unit is-open" key={subunit}>
                  <div className="allot-unit-row">
                    <p className="allot-group-label">{subunit}</p>
                  </div>
                  {items.map((item) => {
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
                        <span>{questionPreviewText(item)}</span>
                      </label>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        )}
        {error ? <p className="error-text">{error}</p> : null}
        <div className="allot-actions">
          <span>{selected.size ? `${selected.size} selected` : 'Nothing selected'}</span>
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn primary" onClick={save} disabled={busy || selected.size === 0}>
            {busy ? 'Allotting…' : 'Allot'}
          </button>
        </div>
      </article>
    </section>
  )
}

function AssignmentRow({ item, status, onRemove }) {
  return (
    <li className={`allot-task is-${status}`}>
      <Link className="allot-task-link" to={assignmentHref(item)}>
        <span className="allot-task-kind">{item.type === 'question' ? 'Question' : 'Topic'}</span>
        <strong>{assignmentLabel(item)}</strong>
        <small>{itemMeta(item)}</small>
      </Link>
      <div className="allot-task-side">
        <span className={`allot-pill is-${status}`}>{statusCopy(status)}</span>
        {onRemove ? (
          <button type="button" className="allot-task-remove" onClick={() => onRemove(item.id)}>
            Remove
          </button>
        ) : null}
      </div>
    </li>
  )
}

export function AssignedWorkList({ items, progress, onRemove }) {
  const today = todayKey()
  if (!items?.length) return <p className="allot-empty">Nothing allotted yet.</p>
  const ranked = items.map((item) => ({ item, status: assignmentStatus(item, progress, today) }))
  const pending = ranked.filter((entry) => entry.status !== 'done')
  const done = ranked.filter((entry) => entry.status === 'done')
  return (
    <div className="allot-board">
      {pending.length ? (
        <ul className="allot-status-list">
          {pending.map(({ item, status }) => (
            <AssignmentRow key={item.id} item={item} status={status} onRemove={onRemove} />
          ))}
        </ul>
      ) : (
        <p className="allot-empty">All caught up.</p>
      )}
      {done.length ? (
        <details className="allot-done-fold">
          <summary>Done · {done.length}</summary>
          <ul className="allot-status-list">
            {done.map(({ item, status }) => (
              <AssignmentRow key={item.id} item={item} status={status} onRemove={onRemove} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
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
  const preview = pending.slice(0, 4)

  async function openItem(item) {
    setOpen(false)
    await markNoticesRead(
      user,
      unread.map((notice) => notice.id),
    ).catch(() => {})
    navigate(assignmentHref(item))
  }

  async function viewAll() {
    await markNoticesRead(
      user,
      unread.map((notice) => notice.id),
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
          <p>{pending.length ? `${pending.length} to do` : 'From sir'}</p>
          {preview.length === 0 ? (
            <small>No allotted work waiting.</small>
          ) : (
            preview.map((item) => (
              <button type="button" className="notice-item" key={item.id} onClick={() => openItem(item)}>
                <strong>{assignmentLabel(item)}</strong>
                <span>{itemMeta(item)}</span>
              </button>
            ))
          )}
          <button type="button" className="notice-all" onClick={viewAll}>
            Open allotted work
          </button>
        </div>
      ) : null}
    </div>
  )
}
