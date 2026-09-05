import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { auth, db } from './firebase'
import { normalizeStudyList } from './studentStudy'

function normalizePayments(raw) {
  return {
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
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function todayKey() {
  return dateKey(new Date().toISOString())
}

function daysAgoKey(days) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return dateKey(date.toISOString())
}

function formatWhen(value) {
  const parsed = new Date(value || '')
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function courseEntries(data) {
  const fromMap = Object.values(data?.courses || {}).filter((item) => item && typeof item === 'object')
  if (fromMap.length) return fromMap
  return Array.isArray(data?.myCourses) ? data.myCourses : []
}

function paidLabels(payments) {
  const labels = []
  if (hasActiveSubscription(payments)) {
    labels.push(`Subscription to ${payments.subscription?.expiresAt ? dateKey(payments.subscription.expiresAt) : 'active'}`)
  }
  for (const [courseId, entry] of Object.entries(payments.courses || {})) {
    if (entry?.paid) labels.push(entry.courseTitle || entry.title || courseId)
  }
  for (const [iaId, entry] of Object.entries(payments.iaUnlocks || {})) {
    if (entry?.paid) labels.push(entry.title || `IA ${iaId}`)
  }
  return labels
}

function buildUserRow(progress, payments) {
  const courses = courseEntries(progress)
  const bookmarks = normalizeStudyList(progress?.savedQuestions)
  const mistakes = normalizeStudyList(progress?.wrongQuestions)
  const lastSeenAt = progress?.lastSeenAt || progress?.updatedAt || ''
  const visitDates = Array.isArray(progress?.recentVisitDates)
    ? progress.recentVisitDates.map((item) => String(item || '')).filter(Boolean)
    : lastSeenAt
      ? [dateKey(lastSeenAt)].filter(Boolean)
      : []
  return {
    uid: progress?.uid || progress?.id || '',
    email: String(progress?.email || payments?.email || '').trim(),
    displayName: String(progress?.displayName || '').trim(),
    photoURL: String(progress?.photoURL || '').trim(),
    countryCode: String(progress?.countryCode || '').trim().toUpperCase(),
    countryName: String(progress?.countryName || '').trim() || String(progress?.countryCode || '').trim().toUpperCase() || 'Unknown',
    lastSeenAt,
    lastPath: String(progress?.lastPath || '').trim(),
    visitDates,
    courses,
    bookmarks,
    mistakes,
    payments,
    paidLabels: paidLabels(payments),
  }
}

export default function AdminUsersPage({ adminEmail }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState('')

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError('')
      try {
        const [progressSnap, paymentSnap] = await Promise.all([
          getDocs(collection(db, 'userCourseProgress')),
          getDocs(collection(db, 'userPayments')),
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
          next.push(buildUserRow({ id: item.id, uid: item.id, email: item.data()?.email || '' }, paymentsByUid.get(item.id) || normalizePayments()))
        })
        next.sort((a, b) => String(b.lastSeenAt || '').localeCompare(String(a.lastSeenAt || '')))
        if (active) setRows(next)
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

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((row) =>
      [row.displayName, row.email, row.countryName, row.countryCode, row.uid, ...row.courses.map((item) => item.title || item.slug)]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    )
  }, [query, rows])

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
      const seenToday = row.visitDates.includes(today) || dateKey(row.lastSeenAt) === today
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
    return { todayCount, weekCount, paidCount, countries, daily, maxDaily }
  }, [rows, today, weekStart])

  return (
    <main className="admin site-full users-dash">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>User activity</h1>
          <p>Signed in as <strong>{adminEmail}</strong>. Read-only view of saved student data.</p>
        </div>
        <div className="admin-header-actions">
          <Link className="btn ghost" to="/admin">
            Content admin
          </Link>
          <button type="button" className="btn ghost" onClick={() => signOut(auth)}>
            Sign out
          </button>
          <Link className="btn ghost" to="/">
            Back to Website
          </Link>
        </div>
      </header>

      {loading ? <p>Loading user activity...</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      <section className="users-stats">
        <article className="users-stat">
          <p>Total users</p>
          <strong>{rows.length}</strong>
        </article>
        <article className="users-stat">
          <p>Active today</p>
          <strong>{stats.todayCount}</strong>
        </article>
        <article className="users-stat">
          <p>Active last 7 days</p>
          <strong>{stats.weekCount}</strong>
        </article>
        <article className="users-stat">
          <p>Paid users</p>
          <strong>{stats.paidCount}</strong>
        </article>
      </section>

      <section className="users-split">
        <article className="panel">
          <h2>Daily users</h2>
          <p>Unique students seen on each of the last 14 days.</p>
          <div className="users-daily">
            {stats.daily.map(([day, count]) => (
              <div className="users-daily-col" key={day} title={`${day}: ${count}`}>
                <div className="users-daily-bar" style={{ height: `${Math.max(8, (count / stats.maxDaily) * 100)}%` }} />
                <small>{day.slice(5)}</small>
                <span>{count}</span>
              </div>
            ))}
          </div>
        </article>
        <article className="panel">
          <h2>Location</h2>
          <p>Country from the student&apos;s last detected IP lookup.</p>
          {stats.countries.length === 0 ? (
            <p>No location data yet. It is stored the next time a student opens the site.</p>
          ) : (
            <ul className="users-country-list">
              {stats.countries.map(([name, count]) => (
                <li key={name}>
                  <span>{name}</span>
                  <strong>{count}</strong>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="panel users-table-panel">
        <div className="users-table-head">
          <div>
            <h2>All users</h2>
            <p>Courses opened, bookmarks, mistakes, and purchases saved for each account.</p>
          </div>
          <label>
            Search
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, email, country, or course"
            />
          </label>
        </div>
        {filtered.length === 0 && !loading ? (
          <p>No matching users.</p>
        ) : (
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Location</th>
                  <th>Last seen</th>
                  <th>Courses</th>
                  <th>Saved</th>
                  <th>Paid</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.uid}>
                    <td>
                      <button type="button" className="users-name-btn" onClick={() => setOpenId((current) => (current === row.uid ? '' : row.uid))}>
                        <strong>{row.displayName || 'Unnamed student'}</strong>
                        <small>{row.email || row.uid}</small>
                      </button>
                    </td>
                    <td>{row.countryName}</td>
                    <td>
                      <span>{formatWhen(row.lastSeenAt)}</span>
                      {row.lastPath ? <small>{row.lastPath}</small> : null}
                    </td>
                    <td>{row.courses.length}</td>
                    <td>
                      {row.bookmarks.length} bookmarks
                      <br />
                      {row.mistakes.length} mistakes
                    </td>
                    <td>{row.paidLabels.length ? row.paidLabels.join(', ') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {openId
          ? filtered
              .filter((row) => row.uid === openId)
              .map((row) => (
                <article className="users-detail" key={`${row.uid}-detail`}>
                  <h3>{row.displayName || row.email || row.uid}</h3>
                  <p>
                    {row.email || 'No email'} · {row.countryName}
                    {row.countryCode ? ` (${row.countryCode})` : ''} · last seen {formatWhen(row.lastSeenAt)}
                  </p>
                  <div className="users-detail-grid">
                    <div>
                      <h4>Courses accessed</h4>
                      {row.courses.length === 0 ? (
                        <p>No course visits saved yet.</p>
                      ) : (
                        <ul>
                          {row.courses.map((course) => (
                            <li key={course.slug || course.curriculumId || course.title}>
                              <strong>{course.title || course.slug || 'Course'}</strong>
                              <small>
                                {course.visitedSubunitsCount || (course.visitedSubunits || []).length || 0} topics
                                {course.lastViewedSubunit ? ` · last ${course.lastViewedSubunit}` : ''}
                                {course.updatedAt ? ` · ${formatWhen(course.updatedAt)}` : ''}
                              </small>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <h4>Study lists</h4>
                      <p>{row.bookmarks.length} bookmarks · {row.mistakes.length} mistakes</p>
                      {row.bookmarks.slice(0, 6).map((item) => (
                        <small key={`b-${item.questionId}`}>{item.preview || item.questionId}</small>
                      ))}
                      {row.mistakes.slice(0, 6).map((item) => (
                        <small key={`m-${item.questionId}`}>{item.preview || item.questionId}</small>
                      ))}
                    </div>
                    <div>
                      <h4>Purchases</h4>
                      {row.paidLabels.length === 0 ? <p>No paid products.</p> : <ul>{row.paidLabels.map((label) => <li key={label}>{label}</li>)}</ul>}
                    </div>
                  </div>
                </article>
              ))
          : null}
      </section>
    </main>
  )
}
