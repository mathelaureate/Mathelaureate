import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { AllotModal, AssignedWorkList } from './allotWork'
import { assignmentStatus, normalizeAssignmentDoc, saveStudentAssignments } from './assignments'
import { signOut } from 'firebase/auth'
import { auth, db } from './firebase'
import { collectVisitDates, localDateKey } from './userPresence'
import { normalizeStudyList } from './studentStudy'
import { CountUp } from './motion'

function normalizePayments(raw) {
  return {
    email: String(raw?.email || '').trim(),
    courses: raw?.courses && typeof raw.courses === 'object' ? raw.courses : {},
    iaUnlocks: raw?.iaUnlocks && typeof raw.iaUnlocks === 'object' ? raw.iaUnlocks : {},
    subscription: raw?.subscription && typeof raw.subscription === 'object' ? raw.subscription : null,
  }
}

function hasActiveSubscription(payments) {
  const expiresAt = new Date(payments?.subscription?.expiresAt || '').getTime()
  return Boolean(payments?.subscription?.active && Number.isFinite(expiresAt) && expiresAt > Date.now())
}

function dateKey(value) {
  const raw = String(value || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return ''
  return localDateKey(parsed)
}

function todayKey() {
  return localDateKey()
}

function daysAgoKey(days) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return localDateKey(date)
}

function visitedOn(row, day) {
  if (!day) return false
  return row.visitDates.includes(day) || dateKey(row.lastSeenAt) === day
}

function formatWhen(value) {
  const parsed = new Date(value || '')
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDayLabel(key) {
  const [year, month, day] = String(key || '').split('-').map(Number)
  if (!year || !month || !day) return key
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function courseEntries(data) {
  const fromMap = Object.values(data?.courses || {}).filter((item) => item && typeof item === 'object')
  if (fromMap.length) return fromMap
  return Array.isArray(data?.myCourses) ? data.myCourses : []
}

function formatMoney(entry) {
  const amount = Number(entry?.amount || entry?.amountInr || 0)
  const currency = String(entry?.currency || '').toUpperCase()
  if (!Number.isFinite(amount) || amount <= 0) return ''
  if (currency === 'INR' || (!currency && entry?.amountInr)) return `₹${amount}`
  if (currency === 'USD') return `$${amount}`
  return currency ? `${amount} ${currency}` : String(amount)
}

function parseSubunitKey(key) {
  const raw = String(key || '').trim()
  if (!raw) return null
  const sep = raw.indexOf('::')
  if (sep === -1) return { key: raw, unitId: '', name: raw }
  const unitId = raw.slice(0, sep)
  const name = raw.slice(sep + 2).trim() || raw
  return { key: raw, unitId, name }
}

function courseSubunits(course) {
  const keys = Array.isArray(course?.visitedSubunits) ? course.visitedSubunits : []
  return keys.map(parseSubunitKey).filter(Boolean)
}

function purchaseItems(payments) {
  const items = []
  const subscription = payments?.subscription
  if (subscription) {
    const active = hasActiveSubscription(payments)
    items.push({
      id: 'subscription',
      kind: 'Subscription',
      title: subscription.title || 'Full access',
      status: active ? 'Active' : subscription.active ? 'Expired' : 'Inactive',
      expiresAt: subscription.expiresAt || '',
      startsAt: subscription.startsAt || '',
      amount: formatMoney(subscription),
      verifiedAt: subscription.verifiedAt || '',
      paymentId: subscription.paymentId || '',
    })
  }
  for (const [courseId, entry] of Object.entries(payments?.courses || {})) {
    if (!entry?.paid) continue
    items.push({
      id: `course-${courseId}`,
      kind: 'Course',
      title: entry.courseTitle || entry.title || entry.slug || courseId,
      status: 'Paid',
      amount: formatMoney(entry),
      verifiedAt: entry.verifiedAt || '',
      paymentId: entry.paymentId || '',
    })
  }
  for (const [iaId, entry] of Object.entries(payments?.iaUnlocks || {})) {
    if (!entry?.paid) continue
    items.push({
      id: `ia-${iaId}`,
      kind: 'IA',
      title: entry.title || `IA ${iaId}`,
      status: 'Paid',
      amount: formatMoney(entry),
      verifiedAt: entry.verifiedAt || '',
      paymentId: entry.paymentId || '',
    })
  }
  return items
}

function paidLabels(payments) {
  return purchaseItems(payments).map((item) => {
    if (item.kind === 'Subscription') {
      return item.expiresAt ? `${item.title} to ${dateKey(item.expiresAt)}` : item.title
    }
    return item.title
  })
}

function progressFromRow(row) {
  const courses = {}
  for (const course of row.courses || []) {
    if (course?.slug) courses[course.slug] = course
  }
  return {
    courses,
    viewedQuestions: row.viewedQuestions || [],
    savedQuestions: row.bookmarks || [],
    wrongQuestions: row.mistakes || [],
  }
}

function uniqueEmails(rows) {
  return [...new Set(rows.map((row) => String(row.email || '').trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  )
}

function downloadEmails(rows) {
  const emails = uniqueEmails(rows)
  const csv = ['email', ...emails].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `mathelaureate-emails-${todayKey()}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function buildUserRow(progress, payments) {
  const courses = courseEntries(progress)
  const bookmarks = normalizeStudyList(progress?.savedQuestions)
  const mistakes = normalizeStudyList(progress?.wrongQuestions)
  const lastSeenAt = progress?.lastSeenAt || progress?.updatedAt || ''
  const visitDates = collectVisitDates({ ...progress, lastSeenAt })
  return {
    uid: progress?.uid || progress?.id || '',
    email: String(progress?.email || payments?.email || '').trim(),
    displayName: String(progress?.displayName || '').trim(),
    photoURL: String(progress?.photoURL || '').trim(),
    countryCode: String(progress?.countryCode || '').trim().toUpperCase(),
    countryName:
      String(progress?.countryName || '').trim() ||
      String(progress?.countryCode || '').trim().toUpperCase() ||
      'Unknown',
    lastSeenAt,
    lastPath: String(progress?.lastPath || '').trim(),
    visitDates,
    courses,
    bookmarks,
    mistakes,
    viewedQuestions: Array.isArray(progress?.viewedQuestions) ? progress.viewedQuestions.map(String) : [],
    payments,
    purchases: purchaseItems(payments),
    paidLabels: paidLabels(payments),
    visitCount: visitDates.length,
  }
}

function DailyUsersChart({ daily, maxDaily, selectedDay, onSelectDay }) {
  const [hoverDay, setHoverDay] = useState('')
  const width = 640
  const height = 228
  const pad = { top: 28, right: 12, bottom: 36, left: 28 }
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const points = daily.map(([day, count], index) => {
    const x = pad.left + (daily.length <= 1 ? innerW / 2 : (index / (daily.length - 1)) * innerW)
    const y = pad.top + innerH - (count / maxDaily) * innerH
    return { day, count, x, y }
  })
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
  const area = points.length
    ? `${line} L${points[points.length - 1].x.toFixed(1)},${(pad.top + innerH).toFixed(1)} L${points[0].x.toFixed(1)},${(pad.top + innerH).toFixed(1)} Z`
    : ''
  const activeDay = hoverDay || selectedDay
  const activePoint = points.find((point) => point.day === activeDay)

  return (
    <div className="users-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily unique users for the last 14 days. Click a day to see who visited.">
        <defs>
          <linearGradient id="usersDailyFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0b7a75" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#0b7a75" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((frac) => {
          const y = pad.top + innerH * (1 - frac)
          return (
            <g key={frac}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#e2e8f0" />
              <text x={4} y={y + 4} className="users-chart-axis">
                {Math.round(maxDaily * frac)}
              </text>
            </g>
          )
        })}
        {area ? <path d={area} fill="url(#usersDailyFill)" /> : null}
        {line ? <path d={line} fill="none" stroke="#0b7a75" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" /> : null}
        {points.map((point) => {
          const selected = selectedDay === point.day
          const hovered = hoverDay === point.day
          return (
            <g key={point.day}>
              {point.count > 0 ? (
                <text x={point.x} y={point.y - 12} textAnchor="middle" className="users-chart-count">
                  {point.count}
                </text>
              ) : null}
              <circle
                cx={point.x}
                cy={point.y}
                r={selected || hovered ? 6 : 3.6}
                fill={selected ? '#0b7a75' : '#fff'}
                stroke="#0b7a75"
                strokeWidth="2"
              />
              <text x={point.x} y={height - 10} textAnchor="middle" className={`users-chart-axis${selected ? ' is-active' : ''}`}>
                {formatDayLabel(point.day).replace(' ', '\u00a0')}
              </text>
              <rect
                x={point.x - 18}
                y={pad.top - 8}
                width="36"
                height={innerH + 28}
                fill="transparent"
                className="users-chart-hit"
                role="button"
                tabIndex="0"
                aria-label={`${formatDayLabel(point.day)}: ${point.count} students`}
                onClick={() => onSelectDay(selected ? '' : point.day)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelectDay(selected ? '' : point.day)
                  }
                }}
                onMouseEnter={() => setHoverDay(point.day)}
                onMouseLeave={() => setHoverDay('')}
              />
            </g>
          )
        })}
      </svg>
      <p className={`users-chart-tip${selectedDay ? ' is-selected' : ''}`}>
        {activePoint
          ? `${formatDayLabel(activePoint.day)} · ${activePoint.count} student${activePoint.count === 1 ? '' : 's'}${selectedDay ? ' · click the day again to clear' : ''}`
          : 'Click a day to see who visited.'}
      </p>
    </div>
  )
}

function userInitial(row) {
  return (row.displayName || row.email || 'S').trim().charAt(0).toUpperCase() || 'S'
}

export default function AdminUsersPage({ adminEmail }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState('')
  const [insight, setInsight] = useState({ kind: 'all' })
  const [curricula, setCurricula] = useState([])
  const [questions, setQuestions] = useState([])
  const [assignmentsByUid, setAssignmentsByUid] = useState({})
  const [allotRow, setAllotRow] = useState(null)

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError('')
      try {
        const [progressSnap, paymentSnap, curriculaSnap, contentSnap, assignSnap] = await Promise.all([
          getDocs(collection(db, 'userCourseProgress')),
          getDocs(collection(db, 'userPayments')),
          getDoc(doc(db, 'appData', 'curricula')),
          getDocs(collection(db, 'courseContentItems')),
          getDocs(collection(db, 'userAssignments')),
        ])
        const paymentsByUid = new Map()
        paymentSnap.forEach((item) => {
          paymentsByUid.set(item.id, normalizePayments(item.data() || {}))
        })
        const next = []
        progressSnap.forEach((item) => {
          next.push(buildUserRow({ id: item.id, uid: item.id, ...(item.data() || {}) }, paymentsByUid.get(item.id) || normalizePayments()))
        })
        paymentSnap.forEach((item) => {
          if (next.some((row) => row.uid === item.id)) return
          next.push(
            buildUserRow({ id: item.id, uid: item.id, email: item.data()?.email || '' }, paymentsByUid.get(item.id) || normalizePayments()),
          )
        })
        next.sort((a, b) => String(b.lastSeenAt || '').localeCompare(String(a.lastSeenAt || '')))
        const assignMap = {}
        assignSnap.forEach((item) => {
          assignMap[item.id] = normalizeAssignmentDoc(item.data() || {})
        })
        const questionItems = []
        contentSnap.forEach((item) => {
          const data = { id: item.id, ...(item.data() || {}) }
          if (data.itemType === 'question') questionItems.push(data)
        })
        if (active) {
          setRows(next)
          setCurricula(Array.isArray(curriculaSnap.data()?.courses) ? curriculaSnap.data().courses : [])
          setQuestions(questionItems)
          setAssignmentsByUid(assignMap)
        }
      } catch (loadError) {
        if (active) setError(loadError?.message || 'Unable to load user activity.')
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [])

  const today = todayKey()
  const weekStart = daysAgoKey(6)

  const emails = useMemo(() => uniqueEmails(rows), [rows])
  const selectedDay = insight.kind === 'day' ? insight.day : ''

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (insight.kind === 'today' && !visitedOn(row, today)) return false
      if (insight.kind === 'week' && !(row.visitDates.some((day) => day >= weekStart) || dateKey(row.lastSeenAt) >= weekStart)) {
        return false
      }
      if (insight.kind === 'paid' && !row.paidLabels.length) return false
      if (insight.kind === 'country' && row.countryName !== insight.country) return false
      if (insight.kind === 'day' && !visitedOn(row, insight.day)) return false
      if (!needle) return true
      return [
        row.displayName,
        row.email,
        row.countryName,
        row.countryCode,
        row.uid,
        ...row.courses.map((item) => item.title || item.slug),
        ...row.courses.flatMap((item) => courseSubunits(item).map((subunit) => subunit.name)),
        ...row.purchases.map((item) => item.title),
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [insight, query, rows, today, weekStart])

  const stats = useMemo(() => {
    const countryCounts = new Map()
    const dailyCounts = new Map()
    for (let index = 13; index >= 0; index -= 1) {
      dailyCounts.set(daysAgoKey(index), 0)
    }
    let todayCount = 0
    let weekCount = 0
    let paidCount = 0
    for (const row of rows) {
      countryCounts.set(row.countryName, (countryCounts.get(row.countryName) || 0) + 1)
      if (row.paidLabels.length) paidCount += 1
      const seenToday = visitedOn(row, today)
      const seenWeek = row.visitDates.some((day) => day >= weekStart) || dateKey(row.lastSeenAt) >= weekStart
      if (seenToday) todayCount += 1
      if (seenWeek) weekCount += 1
      const counted = new Set(row.visitDates)
      if (dateKey(row.lastSeenAt)) counted.add(dateKey(row.lastSeenAt))
      for (const day of counted) {
        if (dailyCounts.has(day)) dailyCounts.set(day, dailyCounts.get(day) + 1)
      }
    }
    const countries = [...countryCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    const daily = [...dailyCounts.entries()]
    const maxDaily = Math.max(1, ...daily.map((item) => item[1]))
    const maxCountry = Math.max(1, ...countries.map((item) => item[1]), 1)
    return { todayCount, weekCount, paidCount, countries, daily, maxDaily, maxCountry }
  }, [rows, today, weekStart])

  return (
    <main className="site site-full ia-page users-page">
      <section className="ia-hero">
        <div className="ia-hero-inner">
          <p className="ia-breadcrumb">
            <Link to="/admin">Admin</Link>
            <span aria-hidden="true"> / </span>
            <span>User activity</span>
          </p>
          <div className="profile-hero-row">
            <div>
              <h1>User activity</h1>
              <p className="ia-hero-sub">Monitor sign-ins, allotted work, course use, and purchases.</p>
            </div>
            <div className="profile-account">
              <span className="profile-avatar" aria-hidden="true">
                {(adminEmail || 'A').charAt(0).toUpperCase()}
              </span>
              <div>
                <p className="profile-email">{adminEmail}</p>
                <div className="users-hero-links">
                  <Link className="ia-clear-inline" to="/admin">
                    Content admin
                  </Link>
                  <button type="button" className="ia-clear-inline" onClick={() => signOut(auth)}>
                    Log out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="ia-browse-shell users-shell">
        {error ? <p className="error-text">{error}</p> : null}

        <section className="users-stats">
          {[
            ['all', 'Total users', rows.length],
            ['today', 'Active today', stats.todayCount],
            ['week', 'Last 7 days', stats.weekCount],
            ['paid', 'Paid users', stats.paidCount],
          ].map(([kind, label, value]) => (
            <button
              type="button"
              className={`users-stat${insight.kind === kind ? ' is-active' : ''}`}
              key={kind}
              onClick={() => setInsight(insight.kind === kind ? { kind: 'all' } : { kind })}
            >
              <p>{label}</p>
              <CountUp value={String(value)} />
            </button>
          ))}
        </section>

        <section className="users-split">
          <article className="profile-panel">
            <div className="profile-section-head">
              <h2>Daily users</h2>
              <p>Unique students seen across the last 14 days. Click a day to open that list.</p>
            </div>
            {loading ? (
              <p className="ia-status">Loading chart...</p>
            ) : (
              <DailyUsersChart
                daily={stats.daily}
                maxDaily={stats.maxDaily}
                selectedDay={selectedDay}
                onSelectDay={(day) => setInsight(day ? { kind: 'day', day } : { kind: 'all' })}
              />
            )}
          </article>
          <article className="profile-panel">
            <div className="profile-section-head">
              <h2>Location</h2>
              <p>Country from the last detected visit. Click to filter.</p>
            </div>
            {loading ? (
              <p className="ia-status">Loading locations...</p>
            ) : stats.countries.length === 0 ? (
              <div className="ia-empty">
                <h2>No locations yet</h2>
                <p>Country is stored the next time a student opens the site.</p>
              </div>
            ) : (
              <ul className="users-country-list">
                {stats.countries.map(([name, count]) => (
                  <li key={name}>
                    <button
                      type="button"
                      className={`users-country-btn${insight.kind === 'country' && insight.country === name ? ' is-active' : ''}`}
                      onClick={() =>
                        setInsight(insight.kind === 'country' && insight.country === name ? { kind: 'all' } : { kind: 'country', country: name })
                      }
                    >
                      <div>
                        <span>{name}</span>
                        <div className="users-loc-track" aria-hidden="true">
                          <div className="users-loc-fill" style={{ width: `${Math.max(8, (count / stats.maxCountry) * 100)}%` }} />
                        </div>
                      </div>
                      <strong>{count}</strong>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>

        <section className="profile-panel">
          <div className="users-table-head">
            <div className="profile-section-head">
              <h2>
                {insight.kind === 'day'
                  ? `Users on ${formatDayLabel(insight.day)}`
                  : insight.kind === 'today'
                    ? 'Active today'
                    : insight.kind === 'week'
                      ? 'Last 7 days'
                      : insight.kind === 'paid'
                        ? 'Paid users'
                        : insight.kind === 'country'
                          ? insight.country
                          : 'All users'}
              </h2>
              <p>
                {insight.kind === 'all'
                  ? 'Subunits opened, purchases, bookmarks, and mistakes.'
                  : `${filtered.length} matching student${filtered.length === 1 ? '' : 's'}. Click the chart, stat, or country again to clear.`}
              </p>
            </div>
            <div className="users-table-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={() => downloadEmails(rows)}
                disabled={loading || emails.length === 0}
              >
                Download emails{emails.length ? ` (${emails.length})` : ''}
              </button>
              <label className="ia-search-simple">
                <span className="sr-only">Search users</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name, email, country, course, or subunit"
                />
              </label>
            </div>
          </div>

          {loading ? (
            <p className="ia-status">Loading students...</p>
          ) : filtered.length === 0 ? (
            <div className="ia-empty">
              <h2>No matching users</h2>
              <p>{insight.kind === 'all' ? 'Try another name, email, or course.' : 'No students match this filter. Click the chart or stat again to clear.'}</p>
            </div>
          ) : (
            <div className="users-people">
              {filtered.map((row) => {
                const open = openId === row.uid
                const assigned = assignmentsByUid[row.uid] || { items: [], notices: [] }
                const progress = progressFromRow(row)
                const pending = assigned.items.filter((item) => assignmentStatus(item, progress, today) !== 'done').length
                const overdue = assigned.items.filter((item) => assignmentStatus(item, progress, today) === 'overdue').length
                return (
                  <article className={`users-person${open ? ' is-open' : ''}`} key={row.uid}>
                    <button type="button" className="users-person-btn" onClick={() => setOpenId(open ? '' : row.uid)}>
                      {row.photoURL ? (
                        <img className="users-avatar-img" src={row.photoURL} alt="" />
                      ) : (
                        <span className="profile-avatar" aria-hidden="true">
                          {userInitial(row)}
                        </span>
                      )}
                      <span className="users-person-copy">
                        <strong>{row.displayName || 'Unnamed student'}</strong>
                        <small>{row.email || row.uid}</small>
                      </span>
                      <span className="users-person-meta">
                        <span className="meta-chip">{row.countryName}</span>
                        <span className="meta-chip">
                          {row.courses.reduce((count, course) => count + courseSubunits(course).length, 0) ||
                            row.courses.reduce((count, course) => count + Number(course.visitedSubunitsCount || 0), 0)}{' '}
                          subunits
                        </span>
                        <span className="meta-chip">{row.paidLabels.length ? 'Paid' : 'Free'}</span>
                        {assigned.items.length ? (
                          <span className={`meta-chip${overdue ? ' is-overdue' : pending ? ' is-pending' : ''}`}>
                            {overdue
                              ? `${overdue} overdue`
                              : pending
                                ? `${pending} not done`
                                : `${assigned.items.length} allotted · done`}
                          </span>
                        ) : null}
                        <small>{formatWhen(row.lastSeenAt)}</small>
                      </span>
                    </button>
                    {open ? (
                      <div className="users-detail">
                        <p>
                          {row.lastPath ? `Last page ${row.lastPath} · ` : ''}
                          {row.countryCode ? `${row.countryCode} · ` : ''}
                          {row.uid ? `${row.uid} · ` : ''}
                          {row.bookmarks.length} bookmarks · {row.mistakes.length} mistakes
                          {row.visitDates.length ? ` · ${row.visitDates.length} visit days` : ''}
                        </p>
                        {row.visitDates.length ? (
                          <p className="users-visit-dates">{row.visitDates.map(formatDayLabel).join(' · ')}</p>
                        ) : null}
                        <div className="users-allot-block">
                          <div className="users-allot-head">
                            <h4>Allotted work</h4>
                            <button type="button" className="btn ghost" onClick={() => setAllotRow(row)}>
                              Allot topics / questions
                            </button>
                          </div>
                          <AssignedWorkList
                            items={assigned.items}
                            progress={progress}
                            onRemove={async (id) => {
                              const nextItems = assigned.items.filter((item) => item.id !== id)
                              const nextDoc = { items: nextItems, notices: assigned.notices }
                              await saveStudentAssignments({
                                uid: row.uid,
                                email: row.email,
                                displayName: row.displayName,
                                ...nextDoc,
                              })
                              setAssignmentsByUid((current) => ({ ...current, [row.uid]: nextDoc }))
                            }}
                          />
                        </div>
                        <div className="users-detail-stack">
                          <div>
                            <h4>Subunits accessed</h4>
                            {row.courses.length === 0 ? (
                              <p>No course visits saved yet.</p>
                            ) : (
                              <ul className="users-course-access">
                                {row.courses.map((course) => {
                                  const subunits = courseSubunits(course)
                                  return (
                                    <li key={course.slug || course.curriculumId || course.title}>
                                      <strong>{course.title || course.slug || 'Course'}</strong>
                                      <small>
                                        {subunits.length || course.visitedSubunitsCount || 0} subunits
                                        {course.lastViewedSubunit ? ` · last ${course.lastViewedSubunit}` : ''}
                                        {course.updatedAt ? ` · ${formatWhen(course.updatedAt)}` : ''}
                                      </small>
                                      {subunits.length ? (
                                        <div className="users-subunit-row">
                                          {subunits.map((subunit) => (
                                            <span className="meta-chip" key={subunit.key} title={subunit.unitId || subunit.key}>
                                              {subunit.name}
                                            </span>
                                          ))}
                                        </div>
                                      ) : (
                                        <p>No subunit names stored yet.</p>
                                      )}
                                    </li>
                                  )
                                })}
                              </ul>
                            )}
                          </div>
                          <div className="users-detail-grid">
                            <div>
                              <h4>Paid for</h4>
                              {row.purchases.length === 0 ? (
                                <p>No paid products.</p>
                              ) : (
                                <ul>
                                  {row.purchases.map((item) => (
                                    <li key={item.id}>
                                      <strong>
                                        {item.kind}: {item.title}
                                      </strong>
                                      <small>
                                        {item.status}
                                        {item.expiresAt ? ` · expires ${dateKey(item.expiresAt)}` : ''}
                                        {item.amount ? ` · ${item.amount}` : ''}
                                        {item.verifiedAt ? ` · ${formatWhen(item.verifiedAt)}` : ''}
                                        {item.paymentId ? ` · ${item.paymentId}` : ''}
                                      </small>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div>
                              <h4>Study lists</h4>
                              {row.bookmarks.length ? (
                                <>
                                  <small className="users-list-label">Bookmarks</small>
                                  {row.bookmarks.map((item) => (
                                    <small key={`b-${item.questionId}`}>{item.preview || item.questionId}</small>
                                  ))}
                                </>
                              ) : null}
                              {row.mistakes.length ? (
                                <>
                                  <small className="users-list-label">Mistakes</small>
                                  {row.mistakes.map((item) => (
                                    <small key={`m-${item.questionId}`}>{item.preview || item.questionId}</small>
                                  ))}
                                </>
                              ) : null}
                              {row.bookmarks.length + row.mistakes.length === 0 ? <p>No saved questions.</p> : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </section>
      {allotRow ? (
        <AllotModal
          row={allotRow}
          curricula={curricula}
          questions={questions}
          existing={assignmentsByUid[allotRow.uid] || { items: [], notices: [] }}
          onClose={() => setAllotRow(null)}
          onSaved={(uid, nextDoc) => setAssignmentsByUid((current) => ({ ...current, [uid]: nextDoc }))}
        />
      ) : null}
    </main>
  )
}
