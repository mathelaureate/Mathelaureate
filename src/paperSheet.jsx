import { useEffect, useState } from 'react'
import { questionPreviewText } from './studentStudy'

export const PAPER_QUESTION_LIMIT = 10
export const FREE_PAPER_LIMIT = 2

function formatPaperDate(date = new Date()) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function PaperDocument({ courseTitle, unitName, subunit, questions, renderQuestion }) {
  const totalMarks = questions.reduce((sum, item) => sum + (Number(item.marks) || 0), 0)
  const topic = [unitName, subunit].filter(Boolean).join(' · ')
  return (
    <article className="paper-sheet">
      <header className="paper-brand">
        <img src="/menu-logo.png" alt="Mathelaureate" />
        <div>
          <p>Practice paper</p>
          <strong>{courseTitle}</strong>
          <span>{topic}</span>
        </div>
        <div className="paper-brand-meta">
          <span>{formatPaperDate()}</span>
          <span>{questions.length} question{questions.length === 1 ? '' : 's'}</span>
          {totalMarks > 0 ? <span>{totalMarks} marks</span> : null}
        </div>
      </header>
      <p className="paper-note">Answer all questions. Show your working. Diagrams are not to scale unless stated.</p>
      <ol className="paper-questions">
        {questions.map((item, index) => (
          <li key={item.id || index}>
            <div className="paper-q-body">{renderQuestion(item, index)}</div>
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

export default function PaperBuilder({
  courseTitle,
  unitName,
  subunit,
  questions,
  used,
  unlimited,
  renderQuestion,
  onClose,
  onRecord,
}) {
  const [picked, setPicked] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const remaining = Math.max(0, FREE_PAPER_LIMIT - used)

  useEffect(() => {
    if (!ready) return undefined
    const previousTitle = document.title
    document.title = `Mathelaureate ${subunit || courseTitle}`
    document.body.classList.add('paper-printing')
    const cleanup = () => {
      document.body.classList.remove('paper-printing')
      document.title = previousTitle
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)
    const timer = window.setTimeout(() => window.print(), 40)
    return () => window.clearTimeout(timer)
  }, [ready, subunit, courseTitle])
  const allowed = unlimited || remaining > 0
  const selected = questions.filter((item) => picked.includes(item.id))

  function toggle(id) {
    setReady(false)
    setPicked((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id)
      if (current.length >= PAPER_QUESTION_LIMIT) return current
      return [...current, id]
    })
  }

  async function download() {
    if (!selected.length || !allowed || busy) return
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
    <section className="paper-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <article className="paper-builder" onClick={(event) => event.stopPropagation()}>
        <header className="paper-builder-head">
          <div>
            <p className="eyebrow">Question paper</p>
            <h3>{subunit || 'This topic'}</h3>
          </div>
          <button type="button" className="icon-back-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <p className="paper-builder-lead">
          Choose up to {PAPER_QUESTION_LIMIT} questions. The PDF uses the Mathelaureate header and leaves the working space blank.
        </p>
        <p className="paper-builder-credit">
          {unlimited
            ? 'Unlimited papers with your access.'
            : remaining > 0
              ? `${remaining} free paper${remaining === 1 ? '' : 's'} left.`
              : 'Your 2 free papers are used. Unlock the course to make more.'}
        </p>
        <ul className="paper-pick-list">
          {questions.length === 0 ? (
            <li className="paper-pick-empty">No questions in this topic yet.</li>
          ) : (
            questions.map((item, index) => {
              const on = picked.includes(item.id)
              const blocked = !on && picked.length >= PAPER_QUESTION_LIMIT
              return (
                <li key={item.id || index}>
                  <label className={blocked ? 'is-blocked' : ''}>
                    <input type="checkbox" checked={on} disabled={blocked} onChange={() => toggle(item.id)} />
                    <span>
                      <strong>Q {index + 1}</strong>
                      {questionPreviewText(item) || 'Question'}
                    </span>
                    {Number(item.marks) > 0 ? <em>{item.marks}</em> : null}
                  </label>
                </li>
              )
            })
          )}
        </ul>
        {error ? <p className="error-text">{error}</p> : null}
        <div className="paper-builder-actions">
          <span>
            {picked.length} / {PAPER_QUESTION_LIMIT}
          </span>
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn primary" onClick={download} disabled={!allowed || !picked.length || busy}>
            {busy ? 'Preparing…' : 'Download PDF'}
          </button>
        </div>
      </article>
      {ready ? (
        <PaperDocument
          courseTitle={courseTitle}
          unitName={unitName}
          subunit={subunit}
          questions={selected}
          renderQuestion={renderQuestion}
        />
      ) : null}
    </section>
  )
}
