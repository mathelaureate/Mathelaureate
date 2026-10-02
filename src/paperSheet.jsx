import { useEffect, useMemo, useState } from 'react'
import { questionPreviewText } from './studentStudy'

export const PAPER_QUESTION_LIMIT = 10
export const FREE_PAPER_LIMIT = 2

function formatPaperDate(date = new Date()) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function PaperDocument({ courseTitle, questions, renderQuestion }) {
  const totalMarks = questions.reduce((sum, item) => sum + (Number(item.marks) || 0), 0)
  const topics = [...new Set(questions.map((item) => item.subunit).filter(Boolean))]
  const mixed = topics.length > 1
  return (
    <article className="paper-sheet">
      <header className="paper-brand">
        <img src="/menu-logo.png" alt="Mathelaureate" />
        <div>
          <p>Mathelaureate</p>
          <strong>{courseTitle || 'Practice paper'}</strong>
          <span>{mixed ? 'Mixed topics' : topics[0] || 'Practice paper'}</span>
        </div>
        <div className="paper-brand-meta">
          <span>{formatPaperDate()}</span>
          <span>
            {questions.length} question{questions.length === 1 ? '' : 's'}
          </span>
          {totalMarks > 0 ? <span>{totalMarks} marks</span> : null}
        </div>
      </header>
      <p className="paper-note">Answer all questions. Show your working. Diagrams are not drawn to scale unless stated.</p>
      <ol className="paper-questions">
        {questions.map((item, index) => (
          <li key={item.id || index}>
            <div className="paper-q-body">
              {mixed && item.subunit ? <small className="paper-q-topic">{item.subunit}</small> : null}
              {renderQuestion(item, index)}
            </div>
            <span className="paper-q-marks">{Number(item.marks) > 0 ? `[${Number(item.marks)}]` : ''}</span>
          </li>
        ))}
      </ol>
      <footer className="paper-foot">
        <span>Mathelaureate</span>
        <span>www.mathelaureate.com</span>
      </footer>
    </article>
  )
}

export default function PaperStudio({
  courses,
  unitsByCourse,
  questions,
  used,
  unlimited,
  isLocked,
  renderQuestion,
  onRecord,
}) {
  const [courseSlug, setCourseSlug] = useState(courses[0]?.slug || '')
  const [openUnitId, setOpenUnitId] = useState('')
  const [subunitKey, setSubunitKey] = useState('')
  const [picked, setPicked] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const course = courses.find((item) => item.slug === courseSlug) || courses[0]
  const units = unitsByCourse[course?.slug] || []
  const firstUnit = units[0]
  const firstKey = firstUnit?.id && firstUnit?.subunits?.[0] ? `${firstUnit.id}::${firstUnit.subunits[0]}` : ''
  const remaining = Math.max(0, FREE_PAPER_LIMIT - used)
  const allowed = unlimited || remaining > 0

  useEffect(() => {
    const [id, name] = firstKey.split('::')
    setOpenUnitId(id || '')
    setSubunitKey(id && name ? firstKey : '')
    setPicked([])
    setReady(false)
  }, [course?.slug, firstKey])

  useEffect(() => {
    if (!ready) return undefined
    const previousTitle = document.title
    document.title = `Mathelaureate ${course?.shortTitle || 'paper'}`
    document.body.classList.add('paper-printing')
    const cleanup = () => {
      document.body.classList.remove('paper-printing')
      document.title = previousTitle
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)
    const timer = window.setTimeout(() => window.print(), 40)
    return () => window.clearTimeout(timer)
  }, [ready, course?.shortTitle])

  const [unitId, subunit] = subunitKey.split('::')
  const bank = useMemo(
    () =>
      questions.filter(
        (item) => item.curriculumId === course?.curriculumId && item.unitId === unitId && item.subunit === subunit,
      ),
    [questions, course?.curriculumId, unitId, subunit],
  )

  function toggle(item) {
    setReady(false)
    setError('')
    setPicked((current) => {
      if (current.some((entry) => entry.id === item.id)) return current.filter((entry) => entry.id !== item.id)
      if (current.length >= PAPER_QUESTION_LIMIT) return current
      return [...current, item]
    })
  }

  async function download() {
    if (!picked.length || !allowed || busy) return
    setBusy(true)
    setError('')
    try {
      await onRecord?.()
      setReady(true)
    } catch (saveError) {
      setError(saveError?.message || 'Unable to prepare this paper.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="paper-studio">
      <aside className="paper-tree">
        <label>
          Course
          <select
            value={course?.slug || ''}
            onChange={(event) => setCourseSlug(event.target.value)}
          >
            {courses.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.shortTitle || item.title}
              </option>
            ))}
          </select>
        </label>
        <div className="paper-units">
          {units.map((unit) => {
            const open = openUnitId === unit.id
            return (
              <div key={unit.id} className={open ? 'is-open' : ''}>
                <button type="button" onClick={() => setOpenUnitId(open ? '' : unit.id)}>
                  {unit.name}
                </button>
                {open
                  ? (unit.subunits || []).map((name) => {
                      const key = `${unit.id}::${name}`
                      return (
                        <button
                          type="button"
                          key={key}
                          className={subunitKey === key ? 'is-active' : ''}
                          onClick={() => setSubunitKey(key)}
                        >
                          {name}
                        </button>
                      )
                    })
                  : null}
              </div>
            )
          })}
        </div>
      </aside>
      <section className="paper-bank">
        <header>
          <h2>{subunit || 'Choose a topic'}</h2>
          <p>Tick questions from any topic. Free papers hold up to {PAPER_QUESTION_LIMIT}.</p>
        </header>
        {bank.length === 0 ? (
          <p className="paper-pick-empty">No questions in this topic yet.</p>
        ) : (
          <ul className="paper-bank-list">
            {bank.map((item) => {
              const on = picked.some((entry) => entry.id === item.id)
              const locked = isLocked?.(item)
              const full = !on && picked.length >= PAPER_QUESTION_LIMIT
              return (
                <li key={item.id}>
                  <label className={locked || full ? 'is-blocked' : ''}>
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={locked || full}
                      onChange={() => toggle(item)}
                    />
                    <span>
                      {locked ? <strong>Locked</strong> : null}
                      {renderQuestion(item)}
                    </span>
                    {Number(item.marks) > 0 ? <em>{item.marks}</em> : null}
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      <aside className="paper-tray">
        <h3>Your paper</h3>
        <p>
          {picked.length} / {PAPER_QUESTION_LIMIT}
          {' · '}
          {unlimited
            ? 'Unlimited papers'
            : remaining > 0
              ? `${remaining} free paper${remaining === 1 ? '' : 's'} left`
              : '2 free papers used'}
        </p>
        <ul>
          {picked.length === 0 ? (
            <li className="paper-pick-empty">Nothing selected.</li>
          ) : (
            picked.map((item, index) => (
              <li key={item.id}>
                <span>
                  <strong>Q {index + 1}</strong>
                  {item.subunit}
                  <small>{questionPreviewText(item) || 'Question'}</small>
                </span>
                <button type="button" onClick={() => toggle(item)} aria-label="Remove question">
                  ×
                </button>
              </li>
            ))
          )}
        </ul>
        {error ? <p className="error-text">{error}</p> : null}
        {!allowed ? <p className="paper-builder-credit">Unlock the course to make more papers.</p> : null}
        <button type="button" className="btn primary" onClick={download} disabled={!allowed || !picked.length || busy}>
          {busy ? 'Preparing…' : 'Download PDF'}
        </button>
      </aside>
      {ready ? <PaperDocument courseTitle={course?.title} questions={picked} renderQuestion={renderQuestion} /> : null}
    </div>
  )
}
