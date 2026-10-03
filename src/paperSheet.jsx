import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Link } from 'react-router-dom'
import { savePagesAsPdf } from './paperPdf'

export const PAPER_QUESTION_LIMIT = 10
export const FREE_PAPER_LIMIT = 2
const SEP = '\u001f'

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

function topicKey(curriculumId, unitId, subunit) {
  return [curriculumId, unitId, subunit].join(SEP)
}

function parseTopicKey(key) {
  const [curriculumId, unitId, subunit] = String(key).split(SEP)
  return { curriculumId, unitId, subunit }
}

function questionsForTopic(questions, key) {
  const { curriculumId, unitId, subunit } = parseTopicKey(key)
  return questions.filter(
    (item) => item.curriculumId === curriculumId && item.unitId === unitId && item.subunit === subunit,
  )
}

function buildPaper(questions, keys, isLocked, limit, mix) {
  let state = mixSeed(keys, mix)
  const rand = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
  const pools = keys
    .map((key) => shuffle(questionsForTopic(questions, key).filter((item) => !isLocked?.(item)), rand))
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

function fileName(title) {
  const clean = String(title || 'practice paper')
    .replace(/[^\w]+/g, ' ')
    .trim()
  return `Mathelaureate ${clean || 'practice paper'}.pdf`
}

function outerHeight(element) {
  const style = getComputedStyle(element)
  return element.offsetHeight + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0)
}

function packQuestions(nodes, firstLimit, nextLimit) {
  const pages = []
  let current = []
  let used = 0
  let limit = firstLimit
  nodes.forEach((node) => {
    const height = outerHeight(node)
    if (current.length && used + height > limit) {
      pages.push(current)
      current = []
      used = 0
      limit = nextLimit
    }
    current.push(node.dataset.index)
    used += height
  })
  if (current.length) pages.push(current)
  return pages
}

const PAPER_NOTE = 'Answer all questions. Show your working. Diagrams are not drawn to scale unless stated.'
const PAPER_SOLUTIONS = 'Solutions to these questions can be found on mathelaureate.com.'

function paperSection(item) {
  return (Number(item.marks) || 0) >= 9 ? 'B' : 'A'
}

function orderPaper(items) {
  return [...items.filter((item) => paperSection(item) === 'A'), ...items.filter((item) => paperSection(item) === 'B')]
}

function sectionHeading(items, index) {
  const section = paperSection(items[index])
  if (index > 0 && paperSection(items[index - 1]) === section) return ''
  return `Section ${section}`
}

function QuestionRow({ item, index, renderQuestion, sectionLabel }) {
  const marks = Number(item.marks) || 0
  return (
    <div className="paper-q" data-index={index}>
      {sectionLabel ? <h3 className="paper-section">{sectionLabel}</h3> : null}
      <div className="paper-q-row">
        <span className="paper-q-num">{index + 1}.</span>
        <div className="paper-q-body">
          {marks > 0 ? <p className="paper-q-max">[Maximum mark: {marks}]</p> : null}
          {renderQuestion(item, index)}
        </div>
      </div>
    </div>
  )
}

function PaperBrand({ courseTitle, subtitle, questions }) {
  const totalMarks = questions.reduce((sum, item) => sum + (Number(item.marks) || 0), 0)
  return (
    <header className="paper-brand" data-part="header">
      <img src="/paper-logo.png" alt="Mathelaureate" />
      <div className="paper-brand-copy">
        <strong>{courseTitle || 'Practice paper'}</strong>
        <span>{subtitle || 'Practice paper'}</span>
      </div>
      <div className="paper-brand-meta">
        <span>{formatPaperDate()}</span>
        <span>
          {questions.length} question{questions.length === 1 ? '' : 's'}
        </span>
        <span>{totalMarks > 0 ? `${totalMarks} marks` : '\u00a0'}</span>
      </div>
    </header>
  )
}

function PaperPage({ first, courseTitle, subtitle, questions, page, pages, children }) {
  return (
    <article className="paper-page-sheet">
      <p className="paper-watermark" aria-hidden="true">
        Mathelaureate
      </p>
      {first ? (
        <>
          <PaperBrand courseTitle={courseTitle} subtitle={subtitle} questions={questions} />
          <p className="paper-note" data-part="note">
            {PAPER_NOTE} {PAPER_SOLUTIONS}
          </p>
        </>
      ) : (
        <div className="paper-run" data-part="run">
          <span>Mathelaureate</span>
          <span>{courseTitle}</span>
        </div>
      )}
      <div className="paper-page-body">{children}</div>
      <footer className="paper-foot" data-part="foot">
        <span>Mathelaureate</span>
        <span>
          {page} / {pages}
        </span>
        <span>www.mathelaureate.com</span>
      </footer>
    </article>
  )
}

function PaperExport({ courseTitle, subtitle, questions, renderQuestion, onPages }) {
  const measureRef = useRef(null)
  const pagesRef = useRef(null)
  const [groups, setGroups] = useState(null)

  useEffect(() => {
    let cancel = false
    async function measure() {
      await document.fonts?.ready
      const root = measureRef.current
      if (!root) return
      const images = [...root.querySelectorAll('img')]
      await Promise.all(
        images.map(
          (img) =>
            img.complete && img.naturalWidth
              ? null
              : new Promise((resolve) => {
                  img.onload = resolve
                  img.onerror = resolve
                }),
        ),
      )
      if (cancel || !measureRef.current) return
      const probe = document.createElement('div')
      probe.className = 'paper-page-sheet'
      probe.style.position = 'absolute'
      probe.style.visibility = 'hidden'
      probe.style.pointerEvents = 'none'
      measureRef.current.appendChild(probe)
      const style = getComputedStyle(probe)
      const innerHeight = probe.clientHeight - (parseFloat(style.paddingTop) || 0) - (parseFloat(style.paddingBottom) || 0)
      probe.remove()
      const header = outerHeight(measureRef.current.querySelector('[data-part="header"]'))
      const note = outerHeight(measureRef.current.querySelector('[data-part="note"]'))
      const run = outerHeight(measureRef.current.querySelector('[data-part="run"]'))
      const foot = measureRef.current.querySelector('[data-part="foot"]').offsetHeight
      const nodes = [...measureRef.current.querySelectorAll('.paper-q')]
      const packed = packQuestions(nodes, innerHeight - header - note - foot, innerHeight - run - foot)
      if (!cancel) setGroups(packed.map((indexes) => indexes.map((index) => questions[Number(index)])))
    }
    measure()
    return () => {
      cancel = true
    }
  }, [questions])

  useEffect(() => {
    if (!groups || !pagesRef.current) return undefined
    const frame = window.requestAnimationFrame(() => {
      onPages?.([...pagesRef.current.querySelectorAll('.paper-page-sheet')])
    })
    return () => window.cancelAnimationFrame(frame)
  }, [groups, onPages])

  return (
    <>
      {groups ? null : (
        <div ref={measureRef} className="paper-measure">
          <PaperBrand courseTitle={courseTitle} subtitle={subtitle} questions={questions} />
          <p className="paper-note" data-part="note">
            {PAPER_NOTE} {PAPER_SOLUTIONS}
          </p>
          <div className="paper-run" data-part="run">
            <span>Mathelaureate</span>
            <span>{courseTitle}</span>
          </div>
          <footer className="paper-foot" data-part="foot">
            <span>Mathelaureate</span>
            <span>1 / 1</span>
            <span>www.mathelaureate.com</span>
          </footer>
          {questions.map((item, index) => (
            <QuestionRow
              key={item.id || index}
              item={item}
              index={index}
              renderQuestion={renderQuestion}
              sectionLabel={sectionHeading(questions, index)}
            />
          ))}
        </div>
      )}
      <div ref={pagesRef}>
        {(groups || []).map((items, pageIndex) => (
          <PaperPage
            key={pageIndex}
            first={pageIndex === 0}
            courseTitle={courseTitle}
            subtitle={subtitle}
            questions={questions}
            page={pageIndex + 1}
            pages={groups.length}
          >
            {items.map((item) => {
              const index = questions.indexOf(item)
              return (
                <QuestionRow
                  key={item.id || index}
                  item={item}
                  index={index}
                  renderQuestion={renderQuestion}
                  sectionLabel={sectionHeading(questions, index)}
                />
              )
            })}
          </PaperPage>
        ))}
      </div>
    </>
  )
}

export default function PaperStudio({ courses, unitsByCourse, questions, used, unlimited, isLocked, renderQuestion, onRecord }) {
  const [openCourses, setOpenCourses] = useState(() => [courses[0]?.slug].filter(Boolean))
  const [openUnits, setOpenUnits] = useState([])
  const [topicKeys, setTopicKeys] = useState([])
  const [mix, setMix] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const remaining = Math.max(0, FREE_PAPER_LIMIT - used)
  const allowed = unlimited || remaining > 0
  const lockRef = useRef(isLocked)
  lockRef.current = isLocked
  const seededUnits = useRef(false)

  useEffect(() => {
    if (seededUnits.current) return
    const course = courses[0]
    const unit = unitsByCourse[course?.slug]?.[0]
    if (!course || !unit) return
    seededUnits.current = true
    setOpenUnits([`${course.slug}${SEP}${unit.id}`])
  }, [courses, unitsByCourse])

  const paper = useMemo(
    () => orderPaper(buildPaper(questions, topicKeys, (item) => lockRef.current?.(item), PAPER_QUESTION_LIMIT, mix)),
    [questions, topicKeys, mix],
  )
  const selectedCourseIds = [...new Set(topicKeys.map((key) => parseTopicKey(key).curriculumId))]
  const courseTitle =
    selectedCourseIds.length === 1
      ? courses.find((item) => item.curriculumId === selectedCourseIds[0])?.title || 'Practice paper'
      : selectedCourseIds
          .map((id) => courses.find((item) => item.curriculumId === id)?.shortTitle)
          .filter(Boolean)
          .join(' · ') || 'Practice paper'
  const topicNames = [...new Set(paper.map((item) => item.subunit).filter(Boolean))]
  const subtitle = selectedCourseIds.length > 1 || topicNames.length > 1 ? 'Mixed topics' : topicNames[0] || 'Practice paper'
  function toggleList(list, setList, key) {
    setList(list.includes(key) ? list.filter((item) => item !== key) : [...list, key])
  }

  function toggleTopic(key) {
    setError('')
    setTopicKeys((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]))
  }

  async function download() {
    if (!paper.length || !allowed || busy) return
    setBusy(true)
    setError('')
    const host = document.createElement('div')
    host.className = 'paper-export-host'
    const cover = document.createElement('div')
    cover.className = 'paper-busy-screen'
    cover.setAttribute('role', 'status')
    cover.textContent = 'Preparing your PDF…'
    document.body.append(host, cover)
    const root = createRoot(host)
    try {
      const pages = await new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error('The paper took too long to prepare.')), 20000)
        root.render(
          <PaperExport
            courseTitle={courseTitle}
            subtitle={subtitle}
            questions={paper}
            renderQuestion={renderQuestion}
            onPages={(nodes) => {
              window.clearTimeout(timer)
              resolve(nodes)
            }}
          />,
        )
      })
      if (!pages.length) throw new Error('Unable to prepare this paper.')
      await savePagesAsPdf(pages, fileName(courseTitle))
      await onRecord?.({
        title: courseTitle,
        subtitle,
        questionIds: paper.map((item) => item.id).filter(Boolean),
      })
    } catch (saveError) {
      setError(saveError?.message || 'Unable to prepare this paper.')
    } finally {
      root.unmount()
      host.remove()
      cover.remove()
      setBusy(false)
    }
  }

  return (
    <div className="paper-studio">
      <aside className="paper-tree">
        <p className="paper-tree-lead">Tick topics from any course. They mix into one paper.</p>
        <div className="paper-units">
          {courses.map((course) => {
            const units = unitsByCourse[course.slug] || []
            const courseOpen = openCourses.includes(course.slug)
            const pickedHere = topicKeys.filter((key) => parseTopicKey(key).curriculumId === course.curriculumId).length
            return (
              <div key={course.slug} className={courseOpen ? 'is-open paper-course' : 'paper-course'}>
                <button type="button" className="paper-course-btn" onClick={() => toggleList(openCourses, setOpenCourses, course.slug)}>
                  <span>{course.shortTitle || course.title}</span>
                  {pickedHere ? <small>{pickedHere}</small> : null}
                </button>
                <div className="paper-fold">
                  <div>
                    {units.map((unit) => {
                      const unitToken = `${course.slug}${SEP}${unit.id}`
                      const unitOpen = openUnits.includes(unitToken)
                      return (
                        <div key={unit.id} className={unitOpen ? 'is-open' : ''}>
                          <button type="button" onClick={() => toggleList(openUnits, setOpenUnits, unitToken)}>
                            {unit.name}
                          </button>
                          <div className="paper-fold">
                            <div>
                              {(unit.subunits || []).map((name) => {
                                const key = topicKey(course.curriculumId, unit.id, name)
                                const pool = questionsForTopic(questions, key)
                                const locked = pool.length > 0 && pool.every((item) => isLocked?.(item))
                                const empty = pool.length === 0
                                const on = topicKeys.includes(key)
                                return (
                                  <label key={key} className={locked || empty ? 'is-blocked' : on ? 'is-on' : ''} title={name}>
                                    <input
                                      type="checkbox"
                                      checked={on}
                                      disabled={locked || empty}
                                      onChange={() => toggleTopic(key)}
                                    />
                                    <span>{name}</span>
                                    <small>{locked ? 'Locked' : pool.length}</small>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
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
              ? `${paper.length} question${paper.length === 1 ? '' : 's'} from ${topicKeys.length} topic${topicKeys.length === 1 ? '' : 's'}. ${PAPER_SOLUTIONS}`
              : 'Tick subtopics from any course. The paper fills itself, up to 10 questions.'}
          </p>
        </header>
        {paper.length === 0 ? (
          <p className="paper-pick-empty">No paper yet.</p>
        ) : (
          <ol key={`${mix}-${paper.map((item) => item.id).join('-')}`} className="paper-preview">
            {paper.map((item, index) => {
              const heading = sectionHeading(paper, index)
              const marks = Number(item.marks) || 0
              return (
                <li key={item.id || index} style={{ '--i': index }}>
                  <span className="paper-preview-num">{index + 1}.</span>
                  <div>
                    {heading ? <strong className="paper-preview-section">{heading}</strong> : null}
                    {marks > 0 ? <p className="paper-q-max">[Maximum mark: {marks}]</p> : null}
                    {renderQuestion(item)}
                  </div>
                </li>
              )
            })}
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
              : '2 free papers used. Please pay to download more.'}
        </p>
        <ul key={topicKeys.join('|')}>
          {topicKeys.length === 0 ? (
            <li className="paper-pick-empty">No topics ticked.</li>
          ) : (
            topicKeys.map((key, index) => {
              const { curriculumId, subunit } = parseTopicKey(key)
              const course = courses.find((item) => item.curriculumId === curriculumId)
              const label = course?.shortTitle ? `${course.shortTitle} · ${subunit}` : subunit
              return (
                <li key={key} style={{ '--i': index }}>
                  <span title={label}>{label}</span>
                  <button type="button" onClick={() => toggleTopic(key)} aria-label="Remove topic">
                    ×
                  </button>
                </li>
              )
            })
          )}
        </ul>
        {error ? <p className="error-text">{error}</p> : null}
        {!allowed ? (
          <p className="paper-builder-credit">You've used your 2 free papers. Please pay to download more.</p>
        ) : null}
        <button type="button" className="btn ghost" onClick={() => setMix((value) => value + 1)} disabled={!paper.length || busy}>
          New mix
        </button>
        {!allowed ? (
          <Link className="btn primary" to="/programs">
            Please pay
          </Link>
        ) : (
          <button type="button" className="btn primary" onClick={download} disabled={!paper.length || busy}>
            {busy ? 'Preparing…' : 'Download PDF'}
          </button>
        )}
      </aside>
    </div>
  )
}
