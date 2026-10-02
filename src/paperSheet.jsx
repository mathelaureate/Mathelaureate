import { useEffect, useMemo, useRef, useState } from 'react'

export const PAPER_QUESTION_LIMIT = 10
export const FREE_PAPER_LIMIT = 2

function mixSeed(keys, mix) {
  const text = `${mix}|${keys.join('|')}`
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function shuffle(items, rand) {
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rand() * (index + 1))
    ;[next[index], next[swap]] = [next[swap], next[index]]
  }
  return next
}

function questionsForTopic(questions, curriculumId, key) {
  const split = key.indexOf('::')
  const unitId = key.slice(0, split)
  const subunit = key.slice(split + 2)
  return questions.filter(
    (item) => item.curriculumId === curriculumId && item.unitId === unitId && item.subunit === subunit,
  )
}

function buildPaper(questions, curriculumId, keys, isLocked, limit, mix) {
  let state = mixSeed(keys, mix)
  const rand = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
  const pools = keys
    .map((key) => shuffle(questionsForTopic(questions, curriculumId, key).filter((item) => !isLocked?.(item)), rand))
    .filter((pool) => pool.length)
  const picked = []
  let turn = 0
  while (picked.length < limit && pools.some((pool) => pool.length)) {
    const pool = pools[turn % pools.length]
    if (pool.length) picked.push(pool.shift())
    turn += 1
  }
  return picked
}

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
  const [topicKeys, setTopicKeys] = useState([])
  const [mix, setMix] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const course = courses.find((item) => item.slug === courseSlug) || courses[0]
  const units = unitsByCourse[course?.slug] || []
  const firstUnitId = units[0]?.id || ''
  const remaining = Math.max(0, FREE_PAPER_LIMIT - used)
  const allowed = unlimited || remaining > 0
  const lockRef = useRef(isLocked)
  lockRef.current = isLocked

  useEffect(() => {
    setOpenUnitId(firstUnitId)
    setTopicKeys([])
    setMix(0)
    setReady(false)
  }, [course?.slug, firstUnitId])

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

  const paper = useMemo(
    () =>
      buildPaper(questions, course?.curriculumId, topicKeys, (item) => lockRef.current?.(item), PAPER_QUESTION_LIMIT, mix),
    [questions, course?.curriculumId, topicKeys, mix],
  )

  function toggleTopic(key) {
    setReady(false)
    setError('')
    setTopicKeys((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]))
  }

  async function download() {
    if (!paper.length || !allowed || busy) return
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
                      const pool = questionsForTopic(questions, course?.curriculumId, key)
                      const locked = pool.length > 0 && pool.every((item) => isLocked?.(item))
                      const empty = pool.length === 0
                      return (
                        <label key={key} className={locked || empty ? 'is-blocked' : ''}>
                          <input
                            type="checkbox"
                            checked={topicKeys.includes(key)}
                            disabled={locked || empty}
                            onChange={() => toggleTopic(key)}
                          />
                          <span>{name}</span>
                          <small>{locked ? 'Locked' : pool.length}</small>
                        </label>
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
          <h2>Generated paper</h2>
          <p>
            {paper.length
              ? `${paper.length} question${paper.length === 1 ? '' : 's'} from ${topicKeys.length} topic${topicKeys.length === 1 ? '' : 's'}.`
              : 'Tick subtopics on the left. The paper fills itself, up to 10 questions.'}
          </p>
        </header>
        {paper.length === 0 ? (
          <p className="paper-pick-empty">No paper yet.</p>
        ) : (
          <ol className="paper-preview">
            {paper.map((item, index) => (
              <li key={item.id || index}>
                <small>{item.subunit}</small>
                {renderQuestion(item)}
              </li>
            ))}
          </ol>
        )}
      </section>
      <aside className="paper-tray">
        <h3>Your paper</h3>
        <p>
          {paper.length} / {PAPER_QUESTION_LIMIT}
          {' · '}
          {unlimited
            ? 'Unlimited papers'
            : remaining > 0
              ? `${remaining} free paper${remaining === 1 ? '' : 's'} left`
              : '2 free papers used'}
        </p>
        <ul>
          {topicKeys.length === 0 ? (
            <li className="paper-pick-empty">No topics ticked.</li>
          ) : (
            topicKeys.map((key) => (
              <li key={key}>
                <span>{key.slice(key.indexOf('::') + 2)}</span>
                <button type="button" onClick={() => toggleTopic(key)} aria-label="Remove topic">
                  ×
                </button>
              </li>
            ))
          )}
        </ul>
        {error ? <p className="error-text">{error}</p> : null}
        {!allowed ? <p className="paper-builder-credit">Unlock the course to make more papers.</p> : null}
        <button type="button" className="btn ghost" onClick={() => setMix((value) => value + 1)} disabled={!paper.length}>
          New mix
        </button>
        <button type="button" className="btn primary" onClick={download} disabled={!allowed || !paper.length || busy}>
          {busy ? 'Preparing…' : 'Download PDF'}
        </button>
      </aside>
      {ready ? <PaperDocument courseTitle={course?.title} questions={paper} renderQuestion={renderQuestion} /> : null}
    </div>
  )
}
