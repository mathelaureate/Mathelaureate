import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import { collectVisitDates, localDateKey, studyStreak } from './userPresence'
import { applyGamifyEvent, awardGamify, DAILY_GOAL_XP, emitXp, levelFromXp, normalizeGamify, questsFrom } from './gamify'

const GamifyContext = createContext({
  ready: false,
  gamify: normalizeGamify(null),
  streak: 0,
  level: levelFromXp(0),
  quests: questsFrom(null),
  mastered: new Set(),
  award: async () => ({ gained: 0 }),
})

export function useGamify() {
  return useContext(GamifyContext)
}

export function GamifyProvider({ user, children }) {
  const [gamify, setGamify] = useState(() => normalizeGamify(null, localDateKey()))
  const [streak, setStreak] = useState(0)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    let active = true
    if (!user?.uid) {
      setGamify(normalizeGamify(null, localDateKey()))
      setStreak(0)
      return undefined
    }

    async function load() {
      try {
        const snap = await getDoc(doc(db, 'userCourseProgress', user.uid))
        if (!active) return
        const data = snap.exists() ? snap.data() || {} : {}
        const today = localDateKey()
        const { gamify: next, gained, label } = applyGamifyEvent(data.gamify, { type: 'login' }, today, data)
        if (gained || !data.gamify) {
          await setDoc(
            doc(db, 'userCourseProgress', user.uid),
            { uid: user.uid, gamify: next, updatedAt: new Date().toISOString() },
            { merge: true },
          )
          emitXp({ gained, label, gamify: next })
        }
        if (!active) return
        setGamify(normalizeGamify(next, today))
        setStreak(studyStreak([...collectVisitDates(data), today]))
      } catch {
        if (active) setGamify(normalizeGamify(null, localDateKey()))
      }
    }

    load()
    return () => {
      active = false
    }
  }, [user])

  useEffect(() => {
    function onXp(event) {
      const next = event.detail?.gamify
      if (next) setGamify(normalizeGamify(next, localDateKey()))
      if (event.detail?.gained) {
        setToast({ gained: event.detail.gained, label: event.detail.label || 'XP', id: Date.now() })
      }
    }
    window.addEventListener('ml-xp', onXp)
    return () => window.removeEventListener('ml-xp', onXp)
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  const value = useMemo(
    () => ({
      ready: true,
      gamify,
      streak,
      level: levelFromXp(gamify.xp),
      quests: questsFrom(gamify),
      mastered: new Set(gamify.mastered || []),
      award: (event) => (user ? awardGamify(user, event) : Promise.resolve({ gained: 0 })),
    }),
    [gamify, streak, user],
  )

  return (
    <GamifyContext.Provider value={value}>
      {children}
      {toast ? (
        <div className="xp-toast" role="status">
          <strong>+{toast.gained} XP</strong>
          <span>{toast.label}</span>
        </div>
      ) : null}
    </GamifyContext.Provider>
  )
}

export function GameHud({ compact = false }) {
  const { streak, level, gamify } = useGamify()
  return (
    <div className={`game-hud${compact ? ' is-compact' : ''}`}>
      <span className="game-chip" title={`${streak}-day streak`}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3s2.4 3.2 2.4 5.6c0 1.3-.7 2.4-1.8 3 1.6-.2 3.4-1.6 4.2-3.4.7 3.2-.4 6.4-3.2 8.2C10.4 18.4 8 16.7 8 13.8 8 10.4 12 7.2 12 3Z"
            fill="currentColor"
          />
        </svg>
        {streak}
      </span>
      <span className="game-chip" title={`${level.title} · ${gamify.xp} XP`}>
        <strong>Lv {level.level}</strong>
        <span>{gamify.xp} XP</span>
      </span>
    </div>
  )
}

export function DailyQuestList() {
  const { quests, gamify, level } = useGamify()
  const goalPct = Math.min(100, Math.round((gamify.dailyXp / DAILY_GOAL_XP) * 100))
  const levelPct = Math.min(100, Math.round((level.into / Math.max(1, level.need)) * 100))

  return (
    <div className="game-quest-panel">
      <div className="game-level-row">
        <div>
          <p className="game-kicker">Level {level.level}</p>
          <strong>{level.title}</strong>
        </div>
        <span>{gamify.xp} XP</span>
      </div>
      <div className="game-bar" aria-hidden="true">
        <span style={{ width: `${levelPct}%` }} />
      </div>
      <p className="game-bar-caption">
        {level.need - level.into} XP to level {level.level + 1}
      </p>
      <div className="game-level-row">
        <p className="game-kicker">Today</p>
        <span>
          {gamify.dailyXp}/{DAILY_GOAL_XP} XP
        </span>
      </div>
      <div className="game-bar is-daily" aria-hidden="true">
        <span style={{ width: `${goalPct}%` }} />
      </div>
      <ul className="game-quest-list">
        {quests.map((quest) => (
          <li key={quest.id} className={quest.done ? 'is-done' : ''}>
            <span className="game-quest-mark" aria-hidden="true">
              {quest.done ? '✓' : ''}
            </span>
            <span>{quest.label}</span>
            <small>{quest.hint}</small>
          </li>
        ))}
      </ul>
    </div>
  )
}
