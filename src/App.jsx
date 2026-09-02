import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { auth, db } from './firebase'
import { supabaseConfigured, uploadImageToSupabase, uploadPdfToSupabase } from './supabase'
import { CountUp, Marquee, Reveal } from './motion'
import { CardLangToggle, useCardLang } from './cardLang'
import {
  SAVED_QUESTIONS_KEY,
  WRONG_QUESTIONS_KEY,
  buildStudyQuestionEntry,
  courseContinuePath,
  normalizeStudyList,
  questionStudyPath,
  resolveLastViewedCourse,
  resolveMyCourses,
  suggestSimilarQuestionsByTopic,
  toggleStudyQuestion,
} from './studentStudy'
import './App.css'

const IaDocumentViewer = lazy(() =>
  import('./IaDocumentViewer').then((module) => ({ default: module.IaDocumentViewer })),
)

const defaultCurricula = [
  {
    id: 'ibdp-aa-hl',
    name: 'IBDP AA HL',
    units: [
      {
        id: 'number-algebra',
        name: 'Topic 1: Number and Algebra',
        subunits: [
          'SL 1.1 Number systems and exact values',
          'SL 1.2 Arithmetic and geometric sequences',
          'SL 1.3 Exponents and logarithms basics',
          'SL 1.4 Financial mathematics and growth/decay',
          'SL 1.5 Binomial expansion (positive integer powers)',
          'SL 1.6 Proof basics and counterexamples',
          'SL 1.7 Simultaneous linear equations (2x2)',
          'SL 1.8 Basic counting principles',
          'SL 1.9 Introduction to complex numbers',
          'AHL 1.10 Counting principles, permutations and combinations',
          'AHL 1.11 Partial fractions',
          'AHL 1.12 Complex numbers in Cartesian form',
          'AHL 1.13 Polar/Euler form and complex operations',
          'AHL 1.14 De Moivre theorem and complex roots',
          'AHL 1.15 Proof by induction, contradiction and counterexample',
          'AHL 1.16 Systems of linear equations (up to 3x3)',
        ],
      },
      {
        id: 'functions',
        name: 'Topic 2: Functions',
        subunits: [
          'SL 2.1 Function notation, domain and range',
          'SL 2.2 Composite and inverse functions',
          'SL 2.3 Transformations of graphs',
          'SL 2.4 Exponential and logarithmic models',
          'SL 2.5 Solving equations graphically and algebraically',
          'SL 2.6 Rational functions and asymptotes (intro)',
          'SL 2.7 Piecewise and absolute value functions',
          'SL 2.8 Function modelling in context',
          'SL 2.9 Rate of change from graphs',
          'SL 2.10 Sequences as functions',
          'SL 2.11 Technology-based graph interpretation',
          'AHL 2.12 Polynomial functions, factors and roots',
          'AHL 2.13 Rational functions and asymptotes',
          'AHL 2.14 Odd/even/periodic and inverse functions',
          'AHL 2.15 Solving g(x) >= f(x)',
          'AHL 2.16 Modulus functions and equations/inequalities',
        ],
      },
      {
        id: 'geometry-trigonometry',
        name: 'Topic 3: Geometry and Trigonometry',
        subunits: [
          'SL 3.1 Coordinate geometry of lines',
          'SL 3.2 Distance, midpoint and gradient',
          'SL 3.3 Basic vector notation and operations',
          'SL 3.4 Trigonometric ratios and unit circle',
          'SL 3.5 Sine/cosine rules and area of triangle',
          'SL 3.6 Trig graphs and simple equations',
          'SL 3.7 Radians, arc length and sector area',
          'SL 3.8 2D vectors in geometric problems',
          'AHL 3.9 Reciprocal trig functions and inverse trig graphs',
          'AHL 3.10 Compound-angle identities',
          'AHL 3.11 Symmetry relationships in trig functions',
          'AHL 3.12 Vector basics in 2D/3D',
          'AHL 3.13 Scalar (dot) product and angle between vectors',
          'AHL 3.14 Vector equations of lines',
          'AHL 3.15 Coincident, parallel, intersecting and skew lines',
          'AHL 3.16 Vector (cross) product and geometric interpretation',
          'AHL 3.17 Vector and Cartesian equations of planes',
          'AHL 3.18 Intersections and angles of lines/planes',
        ],
      },
      {
        id: 'statistics-probability',
        name: 'Topic 4: Statistics and Probability',
        subunits: [
          'SL 4.1 Data collection and sampling methods',
          'SL 4.2 Measures of central tendency and spread',
          'SL 4.3 Histograms and cumulative frequency',
          'SL 4.4 Correlation and linear regression',
          'SL 4.5 Probability basics and set notation',
          'SL 4.6 Conditional probability',
          'SL 4.7 Discrete random variables',
          'SL 4.8 Binomial distribution',
          'SL 4.9 Normal distribution',
          'SL 4.10 Expected value and variance basics',
          'SL 4.11 Hypothesis testing (intro)',
          'SL 4.12 Interpretation of statistical results',
          'AHL 4.13 Bayes theorem (up to 3 events)',
          'AHL 4.14 Discrete/continuous random variables, E(X), Var(X)',
        ],
      },
      {
        id: 'calculus',
        name: 'Topic 5: Calculus',
        subunits: [
          'SL 5.1 Limits and continuity (intro)',
          'SL 5.2 Derivative as rate of change',
          'SL 5.3 Differentiation rules and tangent/normal',
          'SL 5.4 Increasing/decreasing and extrema',
          'SL 5.5 Optimization in context',
          'SL 5.6 Antiderivatives and definite integrals',
          'SL 5.7 Area under a curve',
          'SL 5.8 Kinematics with calculus',
          'SL 5.9 Differential equations (intro modelling)',
          'SL 5.10 Numerical methods for roots',
          'SL 5.11 Numerical integration basics',
          'AHL 5.12 Continuity, differentiability and first principles',
          "AHL 5.13 Limits with l'Hopital or Maclaurin methods",
          'AHL 5.14 Implicit differentiation, related rates, optimization',
          'AHL 5.15 Advanced derivatives/integrals and partial fractions links',
          'AHL 5.16 Integration by substitution and by parts',
          'AHL 5.17 Areas and volumes of revolution',
          'AHL 5.18 First-order differential equations',
          'AHL 5.19 Maclaurin series expansions and manipulations',
        ],
      },
    ],
  },
  {
    id: 'ibdp-ai-hl',
    name: 'IBDP AI HL',
    units: [
      {
        id: 'ai-number-algebra',
        name: 'Topic 1: Number and Algebra',
        subunits: [
          'SL 1.1 Number sets, scientific notation, and exact forms',
          'SL 1.2 Arithmetic and geometric sequences',
          'SL 1.3 Financial mathematics (simple and compound growth)',
          'SL 1.4 Exponents and logarithm basics',
          'SL 1.5 Basic binomial expansion',
          'SL 1.6 Introduction to proof and counterexample',
          'SL 1.7 Solving linear and quadratic equations',
          'SL 1.8 Introductory matrices (awareness level)',
          'AHL 1.9 Laws of logarithms',
          'AHL 1.10 Rational exponents and simplification',
          'AHL 1.11 Infinite geometric series',
          'AHL 1.12 Complex numbers in Cartesian form',
          'AHL 1.13 Polar/exponential form of complex numbers',
          'AHL 1.14 Matrix algebra and inverses',
          'AHL 1.15 Eigenvalues/eigenvectors of 2x2 matrices',
        ],
      },
      {
        id: 'ai-functions',
        name: 'Topic 2: Functions',
        subunits: [
          'SL 2.1 Function notation, domain and range',
          'SL 2.2 Composite and inverse functions',
          'SL 2.3 Graph transformations',
          'SL 2.4 Exponential and logarithmic models',
          'SL 2.5 Piecewise and absolute value functions',
          'SL 2.6 Technology-enabled graph interpretation',
          'AHL 2.7 Composite and inverse functions in context',
          'AHL 2.8 Graph transformations',
          'AHL 2.9 HL modelling (logistic, shifted sinusoidal, piecewise)',
          'AHL 2.10 Log scaling and linearization',
        ],
      },
      {
        id: 'ai-geometry-trig',
        name: 'Topic 3: Geometry and Trigonometry',
        subunits: [
          'SL 3.1 Trigonometric ratios and identities (core)',
          'SL 3.2 Sine/cosine rules and area formulas',
          'SL 3.3 Trigonometric graphs and equations',
          'SL 3.4 Radian measure and arc/sector applications',
          'SL 3.5 Vectors in 2D (notation and operations)',
          'SL 3.6 Geometric applications of vectors',
          'AHL 3.7 Radians and arc/sector measures',
          'AHL 3.8 Unit-circle trig and finite-interval equations',
          'AHL 3.9 Matrix transformations and fractals',
          'AHL 3.10 Vectors fundamentals',
          'AHL 3.11 Vector equations of lines',
          'AHL 3.12 Vector kinematics in 2D/3D',
          'AHL 3.13 Dot/cross product applications',
          'AHL 3.14 Graph theory fundamentals',
          'AHL 3.15 Adjacency/transition matrices and walks',
          'AHL 3.16 Network algorithms (MST, Chinese postman, TSP bounds)',
        ],
      },
      {
        id: 'ai-stats-prob',
        name: 'Topic 4: Statistics and Probability',
        subunits: [
          'SL 4.1 Data collection and sampling methods',
          'SL 4.2 Measures of central tendency and dispersion',
          'SL 4.3 Probability rules and conditional probability',
          'SL 4.4 Discrete random variables and expectation',
          'SL 4.5 Binomial distribution',
          'SL 4.6 Normal distribution',
          'SL 4.7 Correlation and linear regression',
          'SL 4.8 Introduction to hypothesis testing',
          'SL 4.9 Statistical inference using technology',
          'SL 4.10 Interpreting model validity in context',
          'SL 4.11 Communication of statistical findings',
          'AHL 4.12 Data collection design, reliability and validity',
          'AHL 4.13 Non-linear regression and R^2',
          'AHL 4.14 Linear transformations of random variables',
          'AHL 4.15 Central limit theorem',
          'AHL 4.16 Confidence intervals for means',
          'AHL 4.17 Poisson distribution and model selection',
          'AHL 4.18 Hypothesis testing (normal/binomial/Poisson/correlation)',
          'AHL 4.19 Transition matrices and Markov chains',
        ],
      },
      {
        id: 'ai-calculus',
        name: 'Topic 5: Calculus',
        subunits: [
          'SL 5.1 Limits and continuity basics',
          'SL 5.2 Derivative as local rate of change',
          'SL 5.3 Differentiation rules and tangent problems',
          'SL 5.4 Optimization and curve behavior',
          'SL 5.5 Antiderivatives and definite integrals',
          'SL 5.6 Area under and between curves',
          'SL 5.7 Kinematics using differentiation/integration',
          'SL 5.8 Introductory differential equations in modelling',
          'AHL 5.9 Derivative rules and related rates',
          'AHL 5.10 Second derivative, concavity and classification',
          'AHL 5.11 HL integration techniques',
          'AHL 5.12 Areas and volumes of revolution',
          'AHL 5.13 Kinematics in calculus form',
          'AHL 5.14 Differential equations by separation',
          'AHL 5.15 Slope fields',
          'AHL 5.16 Euler method for first-order systems',
          'AHL 5.17 Phase portraits for coupled systems',
          'AHL 5.18 Second-order differential equations',
        ],
      },
    ],
  },
  {
    id: 'igcse-add-maths',
    name: 'IGCSE Additional Mathematics 0606',
    units: [
      {
        id: 'add-func',
        name: '1. Functions',
        subunits: ['Function notation', 'Domain/range', 'Inverse and composite functions', 'Sketches and reflections'],
      },
      {
        id: 'add-quad',
        name: '2. Quadratic Functions',
        subunits: ['Completing the square', 'Discriminant and roots', 'Quadratic inequalities'],
      },
      { id: 'add-poly', name: '3. Factors of Polynomials', subunits: ['Remainder/factor theorem', 'Cubic factorization', 'Solving cubic equations'] },
      { id: 'add-eq', name: '4. Equations, Inequalities and Graphs', subunits: ['Modulus equations', 'Modulus inequalities', 'Cubic graph inequalities'] },
      { id: 'add-sim', name: '5. Simultaneous Equations', subunits: ['Linear-nonlinear systems', 'Elimination/substitution', 'Algebraic solving strategies'] },
      { id: 'add-logexp', name: '6. Logarithmic and Exponential Functions', subunits: ['Laws of logs', 'Graphs of e^x and ln x', 'Solving a^x = b'] },
      { id: 'add-line', name: '7. Straight-line Graphs', subunits: ['Parallel/perpendicular conditions', 'Midpoint and bisectors', 'Linearization techniques'] },
      { id: 'add-circle', name: '8. Coordinate Geometry of the Circle', subunits: ['Circle equations', 'Line-circle intersections', 'Tangents and two-circle intersections'] },
      { id: 'add-circular', name: '9. Circular Measure', subunits: ['Radian measure', 'Arc length', 'Sector area'] },
      { id: 'add-trig', name: '10. Trigonometry', subunits: ['Trig graphs', 'Identities', 'Trig equations and proofs'] },
      { id: 'add-perm', name: '11. Permutations and Combinations', subunits: ['n!', 'Permutations', 'Combinations', 'Counting applications'] },
      { id: 'add-series', name: '12. Series', subunits: ['Binomial expansion', 'Arithmetic/geometric series', 'Sigma notation'] },
      { id: 'add-vectors', name: '13. Vectors in Two Dimensions', subunits: ['Vector algebra', 'Magnitude/direction', 'Geometric applications'] },
      { id: 'add-calc', name: '14. Calculus', subunits: ['Differentiation', 'Stationary points', 'Integration and area', 'Kinematics applications'] },
    ],
  },
  {
    id: 'igcse-intl-maths',
    name: 'IGCSE International Mathematics 0607',
    units: [
      {
        id: 'intl-number',
        name: '1. Number',
        subunits: [
          'Types of number and sets',
          'Fractions/decimals/percentages',
          'Ratio, proportion and rates',
          'Standard form and estimation',
          'Interest, money and time calculations',
        ],
      },
      {
        id: 'intl-algebra',
        name: '2. Algebra',
        subunits: [
          'Expressions and manipulation',
          'Indices and algebraic fractions',
          'Linear and simultaneous equations',
          'Inequalities',
          'Sequences and nth-term forms',
        ],
      },
      {
        id: 'intl-functions',
        name: '3. Functions',
        subunits: ['Function notation', 'Graph recognition', 'Graph features with GDC', 'Extended function operations'],
      },
      {
        id: 'intl-coordinate',
        name: '4. Coordinate Geometry',
        subunits: ['Coordinates and gradients', 'Length/midpoint', 'Line equations', 'Parallel/perpendicular lines'],
      },
      {
        id: 'intl-geometry',
        name: '5. Geometry',
        subunits: ['Angles and polygons', 'Similarity/congruence', 'Constructions and loci', 'Circle theorems'],
      },
      {
        id: 'intl-mensuration',
        name: '6. Mensuration',
        subunits: ['Perimeter and area', 'Surface area and volume', 'Compound measures', 'Practical geometry contexts'],
      },
      {
        id: 'intl-trig',
        name: '7. Trigonometry',
        subunits: ['Right-angled trig', 'Sine/cosine rules', 'Bearings and 3D applications', 'Trig graph basics'],
      },
      {
        id: 'intl-transform-vectors',
        name: '8. Transformations and Vectors',
        subunits: ['Transformations', 'Combined transformations', 'Vector notation and operations', 'Vector geometry applications'],
      },
      {
        id: 'intl-prob',
        name: '9. Probability',
        subunits: ['Sample spaces', 'Combined events', 'Conditional probability', 'Expected value'],
      },
      {
        id: 'intl-stats',
        name: '10. Statistics',
        subunits: ['Data representation', 'Central tendency and spread', 'Correlation and regression', 'Investigation and modelling questions'],
      },
    ],
  },
  {
    id: 'ibmyp',
    name: 'IBMYP',
    units: [
      { id: 'number', name: 'Number', subunits: ['Integers', 'Fractions'] },
      { id: 'relations', name: 'Relationships', subunits: ['Patterns', 'Graphing'] },
    ],
  },
]

const adminPasscode = (import.meta.env.VITE_ADMIN_PASSCODE || '').trim()
const adminPasscodeKey = 'mathelaureate-admin-passcode-ok'
const editorPasscode = (import.meta.env.VITE_EDITOR_PASSCODE || '').trim()
const editorPasscodeKey = 'mathelaureate-editor-passcode-ok'
const editorAllowedEmail = (import.meta.env.VITE_EDITOR_EMAIL || 'editor.mathelaureate@gmail.com').trim().toLowerCase()
const adminIaOptionId = '__ia_management__'
const adminTeachersResourcesOptionId = '__teachers_resources_management__'
const adminPricingOptionId = '__pricing__'
const profileCacheKey = 'mathelaureate-profile-cache'
const curriculaDocRef = doc(db, 'appData', 'curricula')
const contentItemsCollectionRef = collection(db, 'courseContentItems')
const paywallDocRef = doc(db, 'appData', 'paywall')
const iaDocRef = doc(db, 'appData', 'ia')
const teachersResourcesDocRef = doc(db, 'appData', 'teachersResources')
const APP_DOC_CACHE_TTL_MS = 5 * 60 * 1000
const appDocMemoryCache = new Map()

function appDocCacheKey(key) {
  return `mathelaureate-doc-cache:${key}`
}

function readCachedAppDoc(key) {
  const memory = appDocMemoryCache.get(key)
  if (memory && Date.now() - memory.at < APP_DOC_CACHE_TTL_MS) return memory.data
  try {
    const raw = sessionStorage.getItem(appDocCacheKey(key))
    if (!raw) return undefined
    const parsed = JSON.parse(raw)
    if (!parsed || Date.now() - parsed.at > APP_DOC_CACHE_TTL_MS) return undefined
    appDocMemoryCache.set(key, parsed)
    return parsed.data
  } catch {
    return undefined
  }
}

function writeCachedAppDoc(key, data) {
  const entry = { at: Date.now(), data }
  appDocMemoryCache.set(key, entry)
  try {
    sessionStorage.setItem(appDocCacheKey(key), JSON.stringify(entry))
  } catch {
    // Ignore storage quota / private mode.
  }
}

function invalidateCachedAppDoc(key) {
  if (key) {
    appDocMemoryCache.delete(key)
    try {
      sessionStorage.removeItem(appDocCacheKey(key))
    } catch {
      // ignore
    }
    return
  }
  appDocMemoryCache.clear()
  try {
    Object.keys(sessionStorage)
      .filter((item) => item.startsWith('mathelaureate-doc-cache:'))
      .forEach((item) => sessionStorage.removeItem(item))
  } catch {
    // ignore
  }
}

async function getCachedAppDoc(key, ref, onFresh) {
  const cached = readCachedAppDoc(key)
  const refresh = async () => {
    const snap = await getDoc(ref)
    const data = snap.exists() ? snap.data() : null
    writeCachedAppDoc(key, data)
    onFresh?.(data)
    return data
  }
  if (cached !== undefined) {
    if (onFresh) {
      void refresh().catch(() => {})
      return cached
    }
    return refresh()
  }
  return refresh()
}

async function getCachedContentItems(onFresh) {
  const key = 'courseContentItems'
  const cached = readCachedAppDoc(key)
  const refresh = async () => {
    const snap = await getDocs(contentItemsCollectionRef)
    const data = snap.docs.map((itemDoc) => ({ id: itemDoc.id, ...itemDoc.data() }))
    writeCachedAppDoc(key, data)
    onFresh?.(data)
    return data
  }
  if (Array.isArray(cached)) {
    if (onFresh) {
      void refresh().catch(() => {})
      return cached
    }
    return refresh()
  }
  return refresh()
}
const paymentApiBaseUrl = (import.meta.env.VITE_PAYMENT_API_BASE_URL || '/api').replace(/\/$/, '')
const FULL_SUBSCRIPTION_PRODUCT_ID = 'platform-full'
const FULL_SUBSCRIPTION_DEFAULT_PRICE_INR = 1499
const FULL_SUBSCRIPTION_DEFAULT_DAYS = 90

function normalizePaywallConfig(raw) {
  const fullSubscriptionRaw = raw?.fullSubscription && typeof raw.fullSubscription === 'object' ? raw.fullSubscription : {}
  const priceInr = Number(fullSubscriptionRaw.priceInr)
  const durationDays = Number(fullSubscriptionRaw.durationDays)
  const defaultIaUnlockPriceInr = Number(raw?.defaultIaUnlockPriceInr)
  return {
    coursePrices: raw?.coursePrices && typeof raw.coursePrices === 'object' ? raw.coursePrices : {},
    lockedUnits: raw?.lockedUnits && typeof raw.lockedUnits === 'object' ? raw.lockedUnits : {},
    lockedSubunits: raw?.lockedSubunits && typeof raw.lockedSubunits === 'object' ? raw.lockedSubunits : {},
    defaultIaUnlockPriceInr:
      Number.isFinite(defaultIaUnlockPriceInr) && defaultIaUnlockPriceInr >= 0 ? defaultIaUnlockPriceInr : 0,
    fullSubscription: {
      priceInr:
        Number.isFinite(priceInr) && priceInr > 0 ? priceInr : FULL_SUBSCRIPTION_DEFAULT_PRICE_INR,
      durationDays:
        Number.isFinite(durationDays) && durationDays > 0 ? durationDays : FULL_SUBSCRIPTION_DEFAULT_DAYS,
      label: String(fullSubscriptionRaw.label || '').trim() ||
        `Mathelaureate Full Access (${
          Number.isFinite(durationDays) && durationDays > 0 ? durationDays : FULL_SUBSCRIPTION_DEFAULT_DAYS
        } days)`,
    },
  }
}

function formatAccessDuration(days) {
  const d = Math.max(1, Math.floor(Number(days) || FULL_SUBSCRIPTION_DEFAULT_DAYS))
  if (d % 30 === 0) {
    const months = d / 30
    return months === 1 ? '1 month' : `${months} months`
  }
  return `${d} days`
}

function friendlyPaymentError(message) {
  const msg = String(message || '')
  if (/RESOURCE_EXHAUSTED|Quota exceeded|\bcode['"]?\s*[:=]\s*8\b/i.test(msg)) {
    return 'Payment service is temporarily over capacity. Please try again in about a minute.'
  }
  if (/temporarily over capacity/i.test(msg)) return msg
  return msg || 'Unable to process payment.'
}

function resolveIaUnlockPrice(item, defaultPrice = 0) {
  const raw = Number(item?.unlockPriceInr)
  if (Number.isFinite(raw) && raw > 0) return raw
  const fallback = Number(defaultPrice)
  return Number.isFinite(fallback) && fallback > 0 ? fallback : 0
}

function normalizeIaItems(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      const previewPagesRaw = Number(item?.previewPages)
      const unlockPriceRaw = Number(item?.unlockPriceInr)
      return {
        id: item?.id || `ia-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: String(item?.title || '').trim(),
        course: String(item?.course || '').trim(),
        topic: String(item?.topic || '').trim(),
        summary: String(item?.summary || '').trim(),
        description: String(item?.description || '').trim(),
        link: String(item?.link || '').trim(),
        imageUrl: String(item?.imageUrl || '').trim(),
        imagePath: String(item?.imagePath || '').trim(),
        pdfUrl: String(item?.pdfUrl || '').trim(),
        pdfPath: String(item?.pdfPath || '').trim(),
        pdfFileName: String(item?.pdfFileName || '').trim(),
        previewPages:
          Number.isFinite(previewPagesRaw) && previewPagesRaw > 0 ? Math.min(20, Math.floor(previewPagesRaw)) : 1,
        unlockPriceInr:
          Number.isFinite(unlockPriceRaw) && unlockPriceRaw > 0 ? unlockPriceRaw : 0,
        createdAt: String(item?.createdAt || ''),
      }
    })
    .filter((item) => item.title)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
}

function normalizeUserPayments(raw) {
  return {
    courses: raw?.courses && typeof raw.courses === 'object' ? raw.courses : {},
    iaUnlocks: raw?.iaUnlocks && typeof raw.iaUnlocks === 'object' ? raw.iaUnlocks : {},
    subscription: raw?.subscription && typeof raw.subscription === 'object' ? raw.subscription : null,
  }
}

function hasActiveSubscription(payments) {
  const subscription = payments?.subscription
  if (!subscription?.active || !subscription?.expiresAt) return false
  const expiresAt = new Date(subscription.expiresAt).getTime()
  return Number.isFinite(expiresAt) && expiresAt > Date.now()
}

function hasCourseAccess(payments, courseId) {
  if (!courseId) return false
  if (hasActiveSubscription(payments)) return true
  return Boolean(payments?.courses?.[courseId]?.paid)
}

function hasIaAccess(payments, iaId) {
  if (!iaId) return false
  if (hasActiveSubscription(payments)) return true
  return Boolean(payments?.iaUnlocks?.[iaId]?.paid)
}

function mapTeachersResourceCategory(value) {
  const raw = String(value || '').trim()
  if (!raw || /^guides?$/i.test(raw)) return 'Activities'
  return raw
}

function normalizeTeachersResourcesPosts(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => ({
      id: item?.id || `tr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: String(item?.title || '').trim(),
      description: String(item?.description || '').trim(),
      category: mapTeachersResourceCategory(item?.category || item?.topic),
      imageUrl: String(item?.imageUrl || '').trim(),
      imagePath: String(item?.imagePath || '').trim(),
      pdfUrl: String(item?.pdfUrl || '').trim(),
      pdfPath: String(item?.pdfPath || '').trim(),
      pdfFileName: String(item?.pdfFileName || '').trim(),
      createdAt: String(item?.createdAt || ''),
      updatedAt: String(item?.updatedAt || item?.createdAt || ''),
    }))
    .filter((item) => item.title && (item.description || item.pdfUrl))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
}

async function ensureRazorpayLoaded() {
  if (typeof window === 'undefined') return false
  if (window.Razorpay) return true
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

async function startProductPurchase({
  user,
  productType = 'course',
  courseId = '',
  courseSlug = '',
  courseTitle = '',
  iaId = '',
  description = '',
  onPaymentsUpdated,
  onError,
  onBusyChange,
}) {
  if (!user) {
    onError?.('Sign in required to purchase.')
    return
  }

  onBusyChange?.(true)
  onError?.('')

  const scriptReady = await ensureRazorpayLoaded()
  if (!scriptReady) {
    onBusyChange?.(false)
    onError?.('Unable to load Razorpay checkout. Please try again.')
    return
  }

  let idToken = ''
  try {
    idToken = await user.getIdToken()
  } catch {
    onBusyChange?.(false)
    onError?.('Unable to verify your login session. Please sign in again.')
    return
  }

  const countryCodeHint = (await detectUserCountryCode()) || 'IN'
  let orderPayload = null

  try {
    const createOrderResponse = await fetch(`${paymentApiBaseUrl}/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        productType,
        courseId,
        courseSlug,
        courseTitle,
        iaId,
        countryCodeHint,
      }),
    })
    const createOrderPayload = await createOrderResponse.json().catch(() => ({}))
    if (!createOrderResponse.ok) {
      throw new Error(friendlyPaymentError(createOrderPayload?.error || 'Unable to create payment order.'))
    }
    orderPayload = createOrderPayload
  } catch (error) {
    onBusyChange?.(false)
    onError?.(friendlyPaymentError(error?.message || 'Unable to create payment order.'))
    return
  }

  if (!orderPayload?.keyId || !orderPayload?.orderId) {
    onBusyChange?.(false)
    onError?.('Payment configuration is incomplete. Please contact support.')
    return
  }

  const options = {
    key: orderPayload.keyId,
    amount: Number(orderPayload.amount || 0),
    currency: orderPayload.currency || 'INR',
    order_id: orderPayload.orderId,
    name: 'Mathelaureate',
    description: description || courseTitle || 'Mathelaureate access',
    prefill: {
      name: user.displayName || '',
      email: user.email || '',
    },
    handler: async function onPaymentSuccess(response) {
      try {
        const verifyResponse = await fetch(`${paymentApiBaseUrl}/verify-payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            productType,
            courseId,
            courseSlug,
            courseTitle,
            iaId,
            razorpay_order_id: response?.razorpay_order_id || '',
            razorpay_payment_id: response?.razorpay_payment_id || '',
            razorpay_signature: response?.razorpay_signature || '',
          }),
        })
        const verifyPayload = await verifyResponse.json().catch(() => ({}))
        if (!verifyResponse.ok) {
          throw new Error(friendlyPaymentError(verifyPayload?.error || 'Payment verification failed.'))
        }

        if (verifyPayload?.ok || verifyPayload?.courses || verifyPayload?.iaUnlocks || verifyPayload?.subscription) {
          onPaymentsUpdated?.(
            normalizeUserPayments({
              courses: verifyPayload.courses,
              iaUnlocks: verifyPayload.iaUnlocks,
              subscription: verifyPayload.subscription,
            }),
          )
        } else {
          const paymentSnap = await getDoc(doc(db, 'userPayments', user.uid))
          const nextPayments = normalizeUserPayments(paymentSnap.exists() ? paymentSnap.data() : {})
          onPaymentsUpdated?.(nextPayments)
        }
        onError?.('')
      } catch (error) {
        onError?.(friendlyPaymentError(error?.message || 'Payment verification failed.'))
      } finally {
        onBusyChange?.(false)
      }
    },
    modal: {
      ondismiss: () => onBusyChange?.(false),
    },
    theme: {
      color: '#0f2c4d',
    },
  }

  try {
    const checkout = new window.Razorpay(options)
    checkout.on('payment.failed', (response) => {
      onBusyChange?.(false)
      onError?.(friendlyPaymentError(response?.error?.description || 'Payment failed. Please try again.'))
    })
    checkout.open()
  } catch (error) {
    onBusyChange?.(false)
    onError?.(friendlyPaymentError(error?.message || 'Unable to open checkout. Please try again.'))
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function isSafeUrl(value, { allowHash = false } = {}) {
  const next = String(value || '').trim().toLowerCase()
  if (!next) return false
  if (allowHash && next.startsWith('#')) return true
  return (
    next.startsWith('http://') ||
    next.startsWith('https://') ||
    next.startsWith('mailto:') ||
    next.startsWith('tel:') ||
    next.startsWith('/') ||
    next.startsWith('data:image/')
  )
}

function sanitizeHtml(value) {
  if (!value) return ''
  if (typeof window === 'undefined') return escapeHtml(value)

  const parser = new window.DOMParser()
  const documentFragment = parser.parseFromString(`<div>${value}</div>`, 'text/html')
  const root = documentFragment.body.firstElementChild
  if (!root) return ''

  const allowedTags = new Set([
    'a',
    'b',
    'blockquote',
    'br',
    'code',
    'div',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'i',
    'img',
    'li',
    'ol',
    'p',
    'pre',
    's',
    'span',
    'strong',
    'sub',
    'sup',
    'table',
    'tbody',
    'td',
    'th',
    'thead',
    'tr',
    'u',
    'ul',
  ])
  const allowedAttributes = new Set(['class', 'title', 'colspan', 'rowspan', 'width', 'height', 'alt'])

  function cleanNode(node) {
    const children = Array.from(node.childNodes)
    for (const child of children) {
      if (child.nodeType === window.Node.ELEMENT_NODE) {
        const tagName = child.tagName.toLowerCase()
        if (!allowedTags.has(tagName)) {
          const nestedChildren = Array.from(child.childNodes)
          for (const nestedChild of nestedChildren) {
            child.parentNode?.insertBefore(nestedChild, child)
          }
          child.remove()
          continue
        }

        for (const attribute of Array.from(child.attributes)) {
          const name = attribute.name.toLowerCase()
          const rawValue = attribute.value
          const tagAllowed =
            (tagName === 'a' && ['href', 'target', 'rel'].includes(name)) ||
            (tagName === 'img' && ['src', 'loading'].includes(name))
          if (!allowedAttributes.has(name) && !tagAllowed) {
            child.removeAttribute(attribute.name)
            continue
          }
          if (name === 'href' && !isSafeUrl(rawValue, { allowHash: true })) {
            child.removeAttribute(attribute.name)
          }
          if (name === 'src' && !isSafeUrl(rawValue)) {
            child.removeAttribute(attribute.name)
          }
        }
        if (tagName === 'a') {
          if (child.getAttribute('target') === '_blank') {
            child.setAttribute('rel', 'noreferrer')
          }
        }
        if (tagName === 'img' && !child.getAttribute('loading')) {
          child.setAttribute('loading', 'lazy')
        }
      } else if (child.nodeType !== window.Node.TEXT_NODE) {
        child.remove()
        continue
      }
      cleanNode(child)
    }
  }

  cleanNode(root)
  return root.innerHTML
}

// ZWNJ (not ZWSP) so (c) cannot ligate into © and cannot wrap as "c)" on the next line.
const OPTION_C_MARK = '(\u200Cc)'

function decorateMcqOptionLetters(html) {
  return String(html || '')
    .replace(/&copy;|&#169;|&#x0*a9;/gi, OPTION_C_MARK)
    .replace(/[©Ⓒⓒ]/g, OPTION_C_MARK)
    .replace(/(^|[^A-Za-z0-9])\(\s*c\s*\)(?![A-Za-z0-9])/gi, (_, prefix) => `${prefix}${OPTION_C_MARK}`)
}

function normalizeQuestionTypography(value) {
  return String(value || '')
    // Word/Docs often auto-convert option (c) into the copyright mark.
    .replace(/\\textcopyright\b/g, OPTION_C_MARK)
    .replace(/\\copyright\b/g, OPTION_C_MARK)
    .replace(/[©Ⓒⓒ]/g, OPTION_C_MARK)
    .replace(/\(\s*©\s*\)/g, OPTION_C_MARK)
    .replace(/(^|[^A-Za-z0-9])\(\s*c\s*\)(?![A-Za-z0-9])/gi, (_, prefix) => `${prefix}${OPTION_C_MARK}`)
}

function renderLatexToHtml(value) {
  if (!value) return ''

  const tokenPrefix = '__LATEX_TOKEN__'
  const pattern = /(\$\$[\s\S]+?\$\$|\$[^$\n]+\$)/g
  const tokenizedText = normalizeQuestionTypography(value).replace(pattern, (segment, _rawMatch, offset) => {
    const token = `${tokenPrefix}${offset}__`
    if (segment.startsWith('$$') && segment.endsWith('$$')) {
      const expression = segment.slice(2, -2).trim()
      return `${token}${katex.renderToString(expression, { throwOnError: false, displayMode: true })}${token}`
    }
    if (segment.startsWith('$') && segment.endsWith('$')) {
      const expression = segment.slice(1, -1).trim()
      return `${token}${katex.renderToString(expression, { throwOnError: false, displayMode: false })}${token}`
    }
    return segment
  })

  const parts = tokenizedText.split(new RegExp(`(${tokenPrefix}\\d+__)`, 'g')).filter(Boolean)
  const rendered = []
  let inLatexSegment = false

  for (const part of parts) {
    if (part.startsWith(tokenPrefix) && part.endsWith('__')) {
      inLatexSegment = !inLatexSegment
      continue
    }
    if (inLatexSegment) {
      rendered.push(part)
    } else {
      rendered.push(
        sanitizeHtml(part)
          .replace(/\r\n/g, '\n')
          .replace(/[ \t]+\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .replaceAll('\n', '<br />'),
      )
    }
  }

  return decorateMcqOptionLetters(rendered.join(''))
}

function LatexText({ value, className = '' }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: renderLatexToHtml(value) }} />
}

function RichTextEditor({ value, onChange, rows = 5, placeholder = '' }) {
  const textareaRef = useRef(null)
  const selectionRef = useRef({ start: 0, end: 0 })

  function captureSelection() {
    const textarea = textareaRef.current
    if (!textarea) return
    selectionRef.current = {
      start: Number.isInteger(textarea.selectionStart) ? textarea.selectionStart : 0,
      end: Number.isInteger(textarea.selectionEnd) ? textarea.selectionEnd : 0,
    }
  }

  function updateSelection(transformer) {
    const textarea = textareaRef.current
    const current = String(value || '')
    const fallbackStart = current.length
    const start = textarea
      ? Number.isInteger(textarea.selectionStart)
        ? textarea.selectionStart
        : fallbackStart
      : selectionRef.current.start ?? fallbackStart
    const end = textarea
      ? Number.isInteger(textarea.selectionEnd)
        ? textarea.selectionEnd
        : start
      : selectionRef.current.end ?? start
    const result = transformer(current, start, end)
    onChange(result.nextValue)
    window.requestAnimationFrame(() => {
      if (!textareaRef.current) return
      textareaRef.current.focus()
      const caret = Math.max(0, Math.min(result.caret, result.nextValue.length))
      textareaRef.current.setSelectionRange(caret, caret)
      selectionRef.current = { start: caret, end: caret }
    })
  }

  function wrapSelection(prefix, suffix = prefix, fallbackText = 'text') {
    updateSelection((current, start, end) => {
      const hasSelection = end > start
      const selected = hasSelection ? current.slice(start, end) : fallbackText
      const replacement = `${prefix}${selected}${suffix}`
      const nextValue = `${current.slice(0, start)}${replacement}${current.slice(end)}`
      const caret = start + replacement.length
      return { nextValue, caret }
    })
  }

  return (
    <div className="rich-text-editor">
      <div className="rich-text-toolbar">
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => wrapSelection('<strong>', '</strong>')}
          title="Bold"
        >
          B
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => wrapSelection('<em>', '</em>')}
          title="Italic"
        >
          I
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => wrapSelection('<u>', '</u>')}
          title="Underline"
        >
          U
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => wrapSelection('<h3>', '</h3>', 'Heading')}
          title="Heading"
        >
          H
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => wrapSelection('<ul><li>', '</li></ul>', 'List item')}
          title="Bulleted list"
        >
          • List
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => wrapSelection('<ol><li>', '</li></ol>', 'List item')}
          title="Numbered list"
        >
          1. List
        </button>
      </div>
      <textarea
        ref={textareaRef}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onSelect={captureSelection}
        onKeyUp={captureSelection}
        onClick={captureSelection}
        placeholder={placeholder}
      />
    </div>
  )
}

function toGeoGebraEmbedUrl(input) {
  const rawInput = String(input || '').trim()
  const iframeSrcMatch = rawInput.match(/src=["']([^"']+)["']/i)
  const raw = String(iframeSrcMatch?.[1] || rawInput).trim()
  if (!raw) return ''
  if (raw.includes('geogebra.org/material/iframe/id/')) return raw

  const idMatch =
    raw.match(/geogebra\.org\/m\/([a-zA-Z0-9]+)/) ||
    raw.match(/material\/show\/id\/([a-zA-Z0-9]+)/) ||
    raw.match(/^([a-zA-Z0-9]{6,})$/)
  const materialId = idMatch?.[1]
  if (!materialId) return raw
  return `https://www.geogebra.org/material/iframe/id/${materialId}/width/900/height/520/border/888888/sfsb/true/smb/false/stb/false/stbh/false/ai/false/asb/false/sri/true/rc/false`
}

function toGeoGebraOpenUrl(input) {
  const rawInput = String(input || '').trim()
  const iframeSrcMatch = rawInput.match(/src=["']([^"']+)["']/i)
  const raw = String(iframeSrcMatch?.[1] || rawInput).trim()
  if (!raw) return ''
  if (raw.includes('geogebra.org/material/iframe/id/')) {
    const iframeMatch = raw.match(/material\/iframe\/id\/([a-zA-Z0-9]+)/)
    return iframeMatch?.[1] ? `https://www.geogebra.org/m/${iframeMatch[1]}` : 'https://www.geogebra.org/'
  }
  const idMatch =
    raw.match(/geogebra\.org\/m\/([a-zA-Z0-9]+)/) ||
    raw.match(/material\/show\/id\/([a-zA-Z0-9]+)/) ||
    raw.match(/^([a-zA-Z0-9]{6,})$/)
  const materialId = idMatch?.[1]
  if (materialId) return `https://www.geogebra.org/m/${materialId}`
  return raw
}

async function detectUserCountryCode() {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 1200)
    const response = await fetch('https://ipapi.co/json/', { cache: 'no-store', signal: controller.signal })
    clearTimeout(timer)
    if (!response.ok) return ''
    const data = await response.json()
    return String(data?.country_code || '').toUpperCase()
  } catch {
    return ''
  }
}

function toYouTubeEmbedUrl(input) {
  const raw = String(input || '').trim()
  if (!raw) return ''
  const watchMatch = raw.match(/[?&]v=([a-zA-Z0-9_-]{6,})/)
  const shortMatch = raw.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/)
  const embedMatch = raw.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/)
  const id = watchMatch?.[1] || shortMatch?.[1] || embedMatch?.[1]
  if (!id) return ''
  return `https://www.youtube.com/embed/${id}`
}

function formatMetaDate(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function clampImageWidthPercent(value, fallback = 100) {
  const next = Number(value)
  if (!Number.isFinite(next)) return fallback
  return Math.min(180, Math.max(20, Math.round(next)))
}

function getRecordImageStyle(item) {
  const width = clampImageWidthPercent(item?.imageWidthPercent, 100)
  return {
    width: `${width}%`,
    maxWidth: width > 100 ? 'none' : '100%',
    height: 'auto',
    objectFit: 'contain',
  }
}
const courseCatalog = [
  {
    slug: 'ibdp-aa',
    title: 'IBDP Mathematics AA',
    shortTitle: 'IBDP AA',
    curriculumId: 'ibdp-aa-hl',
    description: 'Proof-oriented pathway for strong algebraic reasoning and advanced calculus.',
    highlights: ['Functions and Calculus depth', 'Rigorous algebraic manipulation', 'Exam strategy by paper type'],
    icon: 'aa',
  },
  {
    slug: 'igcse-additional',
    title: 'IGCSE Additional Maths',
    shortTitle: 'IGCSE Add. Maths',
    curriculumId: 'igcse-add-maths',
    description: 'Core and Extended preparation with exam-focused checkpoints.',
    highlights: ['Structured concept progression', 'Past-paper style practice', 'Skill-by-skill reinforcement'],
    icon: 'add',
  },
  {
    slug: 'igcse-international',
    title: 'IGCSE International Maths',
    shortTitle: 'IGCSE Intl Maths',
    curriculumId: 'igcse-intl-maths',
    description: 'International pathway with broad concept coverage and application-focused problem solving.',
    highlights: ['Clear concept sequencing', 'Exam-style mixed practice', 'Applied mathematical thinking'],
    icon: 'intl',
  },
]
function ensureRequiredCurricula(cachedCurricula) {
  if (!Array.isArray(cachedCurricula)) return defaultCurricula

  function parseSubunitOrder(label) {
    const match = String(label).match(/(?:^|\s)(\d+)\.(\d+)\b/)
    if (!match) return null
    return { major: Number(match[1]), minor: Number(match[2]) }
  }

  function sortSubunitsInNumericOrder(subunits) {
    if (!Array.isArray(subunits)) return []
    return subunits
      .map((label, index) => ({ label, index, order: parseSubunitOrder(label) }))
      .sort((a, b) => {
        if (a.order && b.order) {
          if (a.order.major !== b.order.major) return a.order.major - b.order.major
          if (a.order.minor !== b.order.minor) return a.order.minor - b.order.minor
          return a.index - b.index
        }
        if (a.order && !b.order) return -1
        if (!a.order && b.order) return 1
        return a.index - b.index
      })
      .map((item) => item.label)
  }

  function normalizeCourseOrdering(course) {
    return {
      ...course,
      units: (course.units || []).map((unit) => ({
        ...unit,
        subunits: sortSubunitsInNumericOrder(unit.subunits || []),
      })),
    }
  }

  const savedById = new Map(cachedCurricula.map((course) => [course.id, course]))
  const merged = defaultCurricula.map((defaultCourse) => {
    const savedCourse = savedById.get(defaultCourse.id)
    if (!savedCourse) return normalizeCourseOrdering(defaultCourse)
    return normalizeCourseOrdering({
      ...savedCourse,
      name: savedCourse.name || defaultCourse.name,
      units: Array.isArray(savedCourse.units) ? savedCourse.units : [],
    })
  })

  const additionalCourses = cachedCurricula
    .filter((savedCourse) => !defaultCurricula.some((defaultCourse) => defaultCourse.id === savedCourse.id))
    .map((course) => normalizeCourseOrdering(course))
  return [...merged, ...additionalCourses]
}

function createTextContentBlock(text = '') {
  return {
    id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'text',
    text: String(text || ''),
  }
}

function createImageContentBlock() {
  return {
    id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'image',
    imageUrl: '',
    imagePath: '',
    caption: '',
    widthPercent: 100,
  }
}

function normalizeContentBlocks(rawBlocks, fallbackText = '') {
  const source = Array.isArray(rawBlocks) ? rawBlocks : []
  const normalized = source
    .map((block, index) => {
      const type = block?.type === 'image' ? 'image' : 'text'
      if (type === 'image') {
        return {
          id: String(block?.id || `blk-${index}`),
          type: 'image',
          imageUrl: String(block?.imageUrl || '').trim(),
          imagePath: String(block?.imagePath || '').trim(),
          caption: String(block?.caption || '').trim(),
          widthPercent: clampImageWidthPercent(block?.widthPercent, 100),
        }
      }
      return {
        id: String(block?.id || `blk-${index}`),
        type: 'text',
        text: String(block?.text || '').trim(),
      }
    })
    .filter((block) => (block.type === 'image' ? Boolean(block.imageUrl) : Boolean(block.text)))

  if (normalized.length > 0) return normalized
  if (String(fallbackText || '').trim()) return [createTextContentBlock(String(fallbackText || '').trim())]
  return []
}

function contentBlocksHaveMediaOrText(blocks) {
  return Array.isArray(blocks) && blocks.some((block) => (block?.type === 'image' ? Boolean(block?.imageUrl || block?.imageFile) : Boolean(String(block?.text || '').trim())))
}

function contentBlocksToPlainText(blocks) {
  if (!Array.isArray(blocks)) return ''
  return blocks
    .map((block) => (block?.type === 'text' ? String(block?.text || '').trim() : ''))
    .filter(Boolean)
    .join('\n\n')
    .trim()
}

function parseLearningObjectivePoints(value) {
  return String(value || '')
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:[-*•●▪]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
}

function isLearningObjectivesLesson(item) {
  const title = String(item?.title || '')
  if (/learning\s*objectives?/i.test(title)) return true
  return Array.isArray(item?.learningObjectives) && item.learningObjectives.some((point) => String(point || '').trim())
}

function getLearningObjectivePoints(item) {
  if (Array.isArray(item?.learningObjectives)) {
    const fromField = item.learningObjectives.map((point) => String(point || '').trim()).filter(Boolean)
    if (fromField.length) return fromField
  }
  const fromBlocks = contentBlocksToPlainText(item?.descriptionBlocks)
  return parseLearningObjectivePoints(fromBlocks || item?.description || '')
}

function isOverviewLesson(item) {
  return /overview/i.test(String(item?.title || ''))
}

function collectCardTranslateFields(item) {
  const fields = {}
  const title = String(item?.title || '').trim()
  const description = String(item?.description || '').trim()
  const solution = String(item?.solution || '').trim()
  if (title) fields.title = title
  if (description) fields.description = description
  if (solution) fields.solution = solution
  getLearningObjectivePoints(item).forEach((point, index) => {
    if (point) fields[`obj_${index}`] = point
  })
  normalizeContentBlocks(item?.descriptionBlocks).forEach((block, index) => {
    if (block.type === 'text' && String(block.text || '').trim()) fields[`block_${index}`] = block.text
    if (String(block.caption || '').trim()) fields[`caption_${index}`] = block.caption
  })
  normalizeContentBlocks(item?.solutionBlocks).forEach((block, index) => {
    if (block.type === 'text' && String(block.text || '').trim()) fields[`solblock_${index}`] = block.text
    if (String(block.caption || '').trim()) fields[`solcaption_${index}`] = block.caption
  })
  return fields
}

function applyTranslatedFields(item, fields) {
  if (!fields) return item
  const next = { ...item }
  if (fields.title != null) next.title = fields.title
  if (fields.description != null) next.description = fields.description
  if (fields.solution != null) next.solution = fields.solution

  const objectiveSource = getLearningObjectivePoints(item)
  if (objectiveSource.length > 0) {
    next.learningObjectives = objectiveSource.map((point, index) => fields[`obj_${index}`] ?? point)
  }

  if (Array.isArray(item?.descriptionBlocks)) {
    next.descriptionBlocks = normalizeContentBlocks(item.descriptionBlocks).map((block, index) => ({
      ...block,
      text: fields[`block_${index}`] ?? block.text,
      caption: fields[`caption_${index}`] ?? block.caption,
    }))
  }
  if (Array.isArray(item?.solutionBlocks)) {
    next.solutionBlocks = normalizeContentBlocks(item.solutionBlocks).map((block, index) => ({
      ...block,
      text: fields[`solblock_${index}`] ?? block.text,
      caption: fields[`solcaption_${index}`] ?? block.caption,
    }))
  }
  return next
}

function BookmarkIcon({ filled = false }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      {filled ? (
        <path d="M7 3.75h10A1.25 1.25 0 0 1 18.25 5v15.4l-6.25-3.35-6.25 3.35V5A1.25 1.25 0 0 1 7 3.75z" fill="currentColor" />
      ) : (
        <path
          d="M7 3.75h10A1.25 1.25 0 0 1 18.25 5v15.4l-6.25-3.35-6.25 3.35V5A1.25 1.25 0 0 1 7 3.75z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}

function WrongMarkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M7 7l10 10M17 7 7 17" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  )
}

function CourseItemCard({
  item,
  index,
  activeTab,
  isIbdpAaAiCourse,
  onOpenImage,
  onOpenSolution,
  renderBlocks,
  isBookmarked = false,
  isWrong = false,
  onToggleBookmark,
  onToggleWrong,
  studyBusy = false,
  isFocused = false,
}) {
  const sourceFields = useMemo(() => collectCardTranslateFields(item), [item])
  const { lang, fields, busy, error, chooseLang } = useCardLang(item.id, sourceFields)
  const view = lang === 'en' ? item : applyTranslatedFields(item, fields)
  const objectivesItem = activeTab === 'lesson' && isLearningObjectivesLesson(item)
  const objectivePoints = objectivesItem ? getLearningObjectivePoints(view) : []
  const overviewItem = activeTab === 'lesson' && (isOverviewLesson(item) || (index === 0 && !objectivesItem))

  return (
    <article
      id={activeTab === 'question' ? `question-${item.id}` : undefined}
      className={`lesson-card ${activeTab === 'lesson' ? 'lesson-card-lesson' : ''} ${
        activeTab === 'question' ? 'lesson-card-question' : ''
      } ${overviewItem ? 'lesson-card-overview' : ''} ${objectivesItem ? 'lesson-card-objectives' : ''}${
        isFocused ? ' is-focused-question' : ''
      }`}
    >
      <CardLangToggle lang={lang} busy={busy} error={error} onChange={chooseLang} />
      {activeTab !== 'question' && !objectivesItem ? (
        index === 0 || overviewItem ? (
          <div className="record-top">
            <span className="pill">{item.itemType}</span>
          </div>
        ) : null
      ) : null}
      {activeTab === 'question' ? (
        <div className="question-card-head">
          <h3 className="question-number-title">Question {index + 1}</h3>
          <div className="question-card-tools">
            <button
              type="button"
              className={`question-tool-btn${isWrong ? ' is-wrong' : ''}`}
              onClick={() => onToggleWrong?.(item)}
              disabled={studyBusy || !onToggleWrong}
              aria-label={isWrong ? 'Remove from mistakes' : 'Mark as wrong'}
              title={isWrong ? 'In mistakes' : 'Mark as wrong'}
            >
              <WrongMarkIcon />
            </button>
            <button
              type="button"
              className={`question-tool-btn${isBookmarked ? ' is-bookmarked' : ''}`}
              onClick={() => onToggleBookmark?.(item)}
              disabled={studyBusy || !onToggleBookmark}
              aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark question'}
              title={isBookmarked ? 'Bookmarked' : 'Bookmark'}
            >
              <BookmarkIcon filled={isBookmarked} />
            </button>
          </div>
        </div>
      ) : objectivesItem ? (
        <div className="objectives-head">
          <span className="objectives-badge" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
          </span>
          <h3>Learning Objectives</h3>
          <span className="objectives-ribbon" aria-hidden="true">
            ★
          </span>
        </div>
      ) : (
        <LatexText value={view.title} className="latex-heading" />
      )}
      {activeTab === 'question' ? (
        <div className="question-meta-row">
          <span className="meta-chip">{normalizeGdc(item.gdc) === 'gdc' ? 'GDC' : 'No GDC'}</span>
          <span className="meta-chip">{item.marks || 0} marks</span>
          {isIbdpAaAiCourse && String(item.questionLevel || '').trim() ? (
            <span className="meta-chip">{String(item.questionLevel).toUpperCase()}</span>
          ) : null}
          <span className={`meta-chip difficulty-${String(item.difficulty || 'medium').toLowerCase()}`}>
            {String(item.difficulty || 'medium')}
          </span>
        </div>
      ) : null}
      {objectivesItem ? (
        <>
          <p className="objectives-intro">By the end of this lesson, you should be able to:</p>
          <ul className="objectives-list">
            {(objectivePoints.length > 0 ? objectivePoints : ['Add learning objective points in the admin dashboard.']).map(
              (point) => (
                <li key={point}>
                  <span className="objectives-check" aria-hidden="true">
                    ✓
                  </span>
                  <LatexText value={point} className="latex-text" />
                </li>
              ),
            )}
          </ul>
        </>
      ) : contentBlocksHaveMediaOrText(view.descriptionBlocks) ? (
        renderBlocks(view.descriptionBlocks, `desc-${item.id || index}`)
      ) : (
        <LatexText value={view.description} className="latex-text" />
      )}
      {item.imageUrl ? (
        <div className="content-image-block">
          <button
            type="button"
            className="image-open-btn"
            onClick={() => onOpenImage(item.imageUrl)}
            aria-label="Open image in full view"
          >
            <img src={item.imageUrl} alt="Lesson visual" style={getRecordImageStyle(item)} />
          </button>
        </div>
      ) : null}
      {activeTab === 'question' &&
      (item.solution ||
        item.solutionVideoLink ||
        item.solutionImageUrl ||
        contentBlocksHaveMediaOrText(item.solutionBlocks)) ? (
        <button type="button" className="btn ghost text-btn" onClick={() => onOpenSolution(view, index)}>
          View Solution
        </button>
      ) : null}
      {activeTab === 'lesson' && toYouTubeEmbedUrl(item.resourceLink) ? (
        <div className="solution-video-wrap">
          <h4>Video</h4>
          <iframe
            title={`lesson-video-${item.id}`}
            src={toYouTubeEmbedUrl(item.resourceLink)}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      ) : null}
      {activeTab === 'lesson' && item.geogebraLink ? (
        <div className="geogebra-block">
          <iframe
            title={`geogebra-${item.id}`}
            src={toGeoGebraEmbedUrl(item.geogebraLink)}
            loading="lazy"
            allowFullScreen
          />
        </div>
      ) : null}
    </article>
  )
}

function getContentBlockImageStyle(block) {
  const width = clampImageWidthPercent(block?.widthPercent, 100)
  return {
    width: `${width}%`,
    maxWidth: width > 100 ? 'none' : '100%',
    height: 'auto',
    objectFit: 'contain',
  }
}

function moveItem(list, fromIndex, toIndex) {
  if (fromIndex === toIndex) return list
  const copy = [...list]
  const [item] = copy.splice(fromIndex, 1)
  copy.splice(toIndex, 0, item)
  return copy
}

function normalizeGdc(value) {
  return String(value || 'not gdc').trim().toLowerCase() === 'gdc' ? 'gdc' : 'not gdc'
}

function shuffleCopy(items) {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function sampleQuestions(pool, count) {
  const n = Math.max(0, Math.min(Number(count) || 0, pool.length))
  return shuffleCopy(pool).slice(0, n)
}

function formatMockClock(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/**
 * Official paper mark/time ratios used to scale mock timing.
 * AA HL P1/P2: 110 marks / 120 min (current syllabus students use).
 * AA SL P1/P2: 80 marks / 90 min.
 * AA HL P3: 55 marks / 75 min.
 * IGCSE Add Maths: 80 marks / 120 min per paper.
 * IGCSE Intl Core / Extended: Cambridge 0607 structure.
 */
const mockExamBlueprints = {
  'ibdp-aa': {
    levels: [
      { id: 'hl', label: 'HL' },
      { id: 'sl', label: 'SL' },
    ],
    defaultLevel: 'hl',
    papersByLevel: {
      hl: [
        {
          id: 'p1',
          label: 'Paper 1',
          shortLabel: 'P1',
          gdc: 'not gdc',
          fullMarks: 110,
          fullMinutes: 120,
          hint: 'No calculator (Not GDC)',
        },
        {
          id: 'p2',
          label: 'Paper 2',
          shortLabel: 'P2',
          gdc: 'gdc',
          fullMarks: 110,
          fullMinutes: 120,
          hint: 'Calculator allowed (GDC)',
        },
        {
          id: 'p3',
          label: 'Paper 3',
          shortLabel: 'P3',
          gdc: 'gdc',
          preferHl: true,
          fullMarks: 55,
          fullMinutes: 75,
          hint: 'HL only · Calculator allowed (GDC)',
        },
      ],
      sl: [
        {
          id: 'p1',
          label: 'Paper 1',
          shortLabel: 'P1',
          gdc: 'not gdc',
          fullMarks: 80,
          fullMinutes: 90,
          hint: 'No calculator (Not GDC)',
        },
        {
          id: 'p2',
          label: 'Paper 2',
          shortLabel: 'P2',
          gdc: 'gdc',
          fullMarks: 80,
          fullMinutes: 90,
          hint: 'Calculator allowed (GDC)',
        },
      ],
    },
  },
  'igcse-additional': {
    levels: [],
    defaultLevel: 'default',
    papersByLevel: {
      default: [
        {
          id: 'p1',
          label: 'Paper 1',
          shortLabel: 'P1',
          gdc: 'not gdc',
          fullMarks: 80,
          fullMinutes: 120,
          hint: 'Non-calculator · 0606',
        },
        {
          id: 'p2',
          label: 'Paper 2',
          shortLabel: 'P2',
          gdc: 'gdc',
          fullMarks: 80,
          fullMinutes: 120,
          hint: 'Calculator · 0606',
        },
      ],
    },
  },
  'igcse-international': {
    levels: [
      { id: 'extended', label: 'Extended' },
      { id: 'core', label: 'Core' },
    ],
    defaultLevel: 'extended',
    papersByLevel: {
      extended: [
        {
          id: 'p2',
          label: 'Paper 2',
          shortLabel: 'P2',
          gdc: 'not gdc',
          fullMarks: 75,
          fullMinutes: 90,
          hint: 'Extended · Non-calculator',
        },
        {
          id: 'p4',
          label: 'Paper 4',
          shortLabel: 'P4',
          gdc: 'gdc',
          fullMarks: 75,
          fullMinutes: 90,
          hint: 'Extended · GDC',
        },
        {
          id: 'p6',
          label: 'Paper 6',
          shortLabel: 'P6',
          gdc: 'gdc',
          fullMarks: 50,
          fullMinutes: 90,
          hint: 'Extended · Investigation & modelling',
        },
      ],
      core: [
        {
          id: 'p1',
          label: 'Paper 1',
          shortLabel: 'P1',
          gdc: 'not gdc',
          fullMarks: 60,
          fullMinutes: 75,
          hint: 'Core · Non-calculator',
        },
        {
          id: 'p3',
          label: 'Paper 3',
          shortLabel: 'P3',
          gdc: 'gdc',
          fullMarks: 60,
          fullMinutes: 75,
          hint: 'Core · GDC',
        },
        {
          id: 'p5',
          label: 'Paper 5',
          shortLabel: 'P5',
          gdc: 'gdc',
          fullMarks: 40,
          fullMinutes: 75,
          hint: 'Core · Investigation',
        },
      ],
    },
  },
}

function getMockBlueprint(courseSlug) {
  return mockExamBlueprints[courseSlug] || mockExamBlueprints['ibdp-aa']
}

function getMockPapersForCourse(courseSlug, level) {
  const blueprint = getMockBlueprint(courseSlug)
  const levelKey = blueprint.levels?.length ? level || blueprint.defaultLevel : 'default'
  return blueprint.papersByLevel[levelKey] || blueprint.papersByLevel.default || []
}

function minutesFromTargetMarks(paper, targetMarks) {
  const marks = Math.max(1, Number(targetMarks) || 1)
  const fullMarks = Math.max(1, Number(paper.fullMarks) || 1)
  const fullMinutes = Math.max(1, Number(paper.fullMinutes) || 1)
  return Math.max(1, Math.round((marks * fullMinutes) / fullMarks))
}

function createDefaultMockPaperSettings(papers) {
  return Object.fromEntries(
    (papers || []).map((paper, index) => [
      paper.id,
      {
        enabled: index === 0,
        targetMarks: paper.fullMarks,
      },
    ]),
  )
}

function normalizeMockDifficulty(value) {
  const difficulty = String(value || 'medium').trim().toLowerCase()
  if (difficulty === 'easy' || difficulty === 'hard') return difficulty
  return 'medium'
}

function sampleFromPoolToMarks(pool, markBudget, usedIds) {
  const budget = Math.max(0, Number(markBudget) || 0)
  if (budget <= 0) return { picked: [], sum: 0 }

  const picked = []
  let sum = 0

  // Never overshoot: only take a question if it still fits under the budget.
  for (const question of shuffleCopy(pool)) {
    if (usedIds.has(question.id)) continue
    const marks = Math.max(0, Number(question.marks) || 0)
    if (marks <= 0 || marks > budget) continue
    if (sum + marks > budget) continue
    picked.push(question)
    usedIds.add(question.id)
    sum += marks
    if (sum === budget) break
  }

  return { picked, sum }
}

function sampleQuestionsToMarks(pool, targetMarks) {
  const goal = Math.max(1, Number(targetMarks) || 1)
  const byDifficulty = { easy: [], medium: [], hard: [] }

  pool.forEach((question) => {
    byDifficulty[normalizeMockDifficulty(question.difficulty)].push(question)
  })

  // Exam-style mix: ~25% easy, ~45% medium, ~30% hard (by marks).
  let easyBudget = Math.round(goal * 0.25)
  let mediumBudget = Math.round(goal * 0.45)
  let hardBudget = Math.max(0, goal - easyBudget - mediumBudget)

  if (goal >= 12) {
    easyBudget = Math.max(1, easyBudget)
    mediumBudget = Math.max(1, mediumBudget)
    hardBudget = Math.max(1, hardBudget)
    const allocated = easyBudget + mediumBudget + hardBudget
    if (allocated !== goal) {
      mediumBudget = Math.max(1, mediumBudget + (goal - allocated))
    }
  }

  const usedIds = new Set()
  const easyPick = sampleFromPoolToMarks(byDifficulty.easy, easyBudget, usedIds)
  const mediumPick = sampleFromPoolToMarks(byDifficulty.medium, mediumBudget, usedIds)
  const hardPick = sampleFromPoolToMarks(byDifficulty.hard, hardBudget, usedIds)

  let picked = [...easyPick.picked, ...mediumPick.picked, ...hardPick.picked]
  let sum = easyPick.sum + mediumPick.sum + hardPick.sum

  // Fill leftover marks without going over the target.
  if (sum < goal) {
    const fill = sampleFromPoolToMarks(pool, goal - sum, usedIds)
    picked = [...picked, ...fill.picked]
  }

  const difficultyOrder = { easy: 0, medium: 1, hard: 2 }
  return picked.sort(
    (a, b) => difficultyOrder[normalizeMockDifficulty(a.difficulty)] - difficultyOrder[normalizeMockDifficulty(b.difficulty)],
  )
}

function BrandWordmark({ className = '' }) {
  return (
    <span className={`brand-wordmark${className ? ` ${className}` : ''}`}>
      Mathe<span>laureate</span>
    </span>
  )
}

function SiteHeader({ user, cachedProfile, bare = false }) {
  const profileLabel =
    user?.displayName?.[0]?.toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    cachedProfile?.displayName?.[0]?.toUpperCase() ||
    cachedProfile?.email?.[0]?.toUpperCase() ||
    'P'
  const navigate = useNavigate()
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function onLoginSignupClick() {
    navigate('/courses/ibdp-aa')
  }

  const path = location.pathname
  const isHome = path === '/'
  const isIa = path.startsWith('/ia')
  const isMock = path.startsWith('/mock-generator')
  const isTeachers = path.startsWith('/teachers-resources')
  const isProfile = path.startsWith('/profile')

  return (
    <header className={`topbar site-topbar ${bare ? 'topbar-bare' : ''}${scrolled ? ' is-scrolled' : ''}`} id="home">
      <div className="topbar-inner">
        <Link to="/" className="brand" aria-label="Mathelaureate home">
          <img src="/menu-logo.png" alt="Mathelaureate" className="brand-logo-image" />
        </Link>
        <nav>
          <a href="/#home" className={isHome ? 'nav-active' : undefined}>
            Home
          </a>
          <a href="/#programs">Programs</a>
          <Link to="/ia" className={isIa ? 'nav-active' : undefined}>
            IA
          </Link>
          <Link to="/mock-generator" className={isMock ? 'nav-active' : undefined}>
            Mock Generator
          </Link>
          <Link to="/teachers-resources" className={isTeachers ? 'nav-active' : undefined}>
            Teachers &amp; Resources
          </Link>
          <a href="/#contact">Contact</a>
          {user || cachedProfile ? (
            <Link to="/profile" className={`profile-icon${isProfile ? ' is-active' : ''}`} aria-label="Study home">
              {profileLabel}
            </Link>
          ) : (
            <button type="button" className="login-btn" onClick={onLoginSignupClick}>
              Login / Signup
            </button>
          )}
        </nav>
      </div>
    </header>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, left: 0, behavior: reduce ? 'auto' : 'smooth' })
  }, [pathname])
  return null
}

function HomePage({ user, cachedProfile }) {
  const location = useLocation()
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactSubject, setContactSubject] = useState('General inquiry')
  const [contactMessage, setContactMessage] = useState('')
  const [contactWebsite, setContactWebsite] = useState('')
  const [contactSending, setContactSending] = useState(false)
  const [contactFeedbackIsError, setContactFeedbackIsError] = useState(false)
  const [contactFeedback, setContactFeedback] = useState('')

  useEffect(() => {
    if (!location.hash) return
    const id = location.hash.replace('#', '')
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [location.hash])

  async function onContactSubmit(event) {
    event.preventDefault()
    if (!contactName.trim() || !contactEmail.trim() || !contactSubject.trim() || !contactMessage.trim()) {
      setContactFeedbackIsError(true)
      setContactFeedback('Please fill in your name, email, subject, and message.')
      return
    }
    if (contactMessage.trim().length < 10) {
      setContactFeedbackIsError(true)
      setContactFeedback('Please add a little more detail to your message.')
      return
    }

    setContactSending(true)
    setContactFeedback('')
    setContactFeedbackIsError(false)
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contactName.trim(),
          email: contactEmail.trim(),
          subject: contactSubject.trim(),
          message: contactMessage.trim(),
          website: contactWebsite.trim(),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to send your message right now. Please try again later.')
      }
      setContactFeedbackIsError(false)
      setContactFeedback('Message sent successfully. We will get back to you within 24 hours.')
      setContactName('')
      setContactEmail('')
      setContactSubject('General inquiry')
      setContactMessage('')
      setContactWebsite('')
    } catch (error) {
      setContactFeedbackIsError(true)
      setContactFeedback(error?.message || 'Unable to send your message right now. Please try again later.')
    } finally {
      setContactSending(false)
    }
  }

  return (
    <main className="site home-site site-full">
      <SiteHeader user={user} cachedProfile={cachedProfile} />

      <section className="hero-section hero-full">
        <div className="hero-grid">
          <div className="hero-content">
            <p className="brand-mark k-hero-pop">
              <BrandWordmark />
            </p>
            <h1 className="k-hero-rise">Learn Math with Clarity and Confidence</h1>
            <p className="hero-copy k-hero-copy">
              Structured pathways for Grade 9–12 students across IBDP, IGCSE, and MYP — with lessons, worked
              examples, and exam-focused practice.
            </p>
            <div className="hero-actions k-hero-actions">
              <a href="#programs" className="btn primary">
                Start Learning →
              </a>
              <a href="#programs" className="btn ghost">
                Explore Courses
              </a>
            </div>
            <ul className="hero-trust k-hero-trust">
              <li>
                <span className="hero-trust-icon" aria-hidden="true">
                  ✓
                </span>
                IB-aligned Content
              </li>
              <li>
                <span className="hero-trust-icon" aria-hidden="true">
                  ✓
                </span>
                Expert Teachers
              </li>
              <li>
                <span className="hero-trust-icon" aria-hidden="true">
                  ✓
                </span>
                Exam-Focused Approach
              </li>
            </ul>
          </div>
          <div className="hero-visual k-hero-visual">
            <img
              src="/math-hero.png"
              alt="Mathematical diagrams including surface plots, unit circle, and key formulas"
              className="hero-math-img"
              width="960"
              height="540"
            />
          </div>
        </div>
      </section>

      <Marquee
        items={[
          'IBDP AA',
          'IBDP AI',
          'IGCSE',
          'MYP',
          'IA Exemplars',
          'Mock Generator',
          'Worked Examples',
          'Question Bank',
        ]}
      />

      <section id="programs" className="panel-section home-programs">
        <Reveal className="section-head">
          <p className="eyebrow">Programs</p>
          <h2>Choose Your Pathway</h2>
          <p>Curriculum-specific courses designed for international maths success.</p>
        </Reveal>
        <ProgramCards withLinks />
      </section>

      <section className="panel-section home-tools-section">
        <div className="home-split">
          <Reveal>
            <div className="section-head left">
              <p className="eyebrow">Featured Pathways</p>
              <h2>Build mastery topic by topic</h2>
            </div>
            <div className="pathway-grid">
              <article className="pathway-card">
                <span className="pathway-num">01</span>
                <h3>Number and Algebra</h3>
                <p>Sequences, series, exponents, and algebraic fluency.</p>
              </article>
              <article className="pathway-card">
                <span className="pathway-num">02</span>
                <h3>Functions</h3>
                <p>Graphs, transformations, and modelling with clarity.</p>
              </article>
              <article className="pathway-card">
                <span className="pathway-num">03</span>
                <h3>Calculus</h3>
                <p>Differentiation and integration with exam technique.</p>
              </article>
              <article className="pathway-card">
                <span className="pathway-num">04</span>
                <h3>Statistics &amp; Probability</h3>
                <p>Data analysis, distributions, and inference basics.</p>
              </article>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="section-head left">
              <p className="eyebrow">Learning Tools</p>
              <h2>Everything you need to improve</h2>
            </div>
            <div className="tools-grid">
              <article className="tool-card">
                <span className="tool-icon tool-icon-lessons" aria-hidden="true" />
                <h3>Interactive Lessons</h3>
                <p>Concept-first explanations with clear structure.</p>
              </article>
              <article className="tool-card">
                <span className="tool-icon tool-icon-examples" aria-hidden="true" />
                <h3>Worked Examples</h3>
                <p>Step-by-step solutions that show the method.</p>
              </article>
              <article className="tool-card">
                <span className="tool-icon tool-icon-bank" aria-hidden="true" />
                <h3>Question Bank</h3>
                <p>Difficulty-filtered practice for every subunit.</p>
              </article>
              <Link className="tool-card tool-card-link" to="/mock-generator">
                <span className="tool-icon tool-icon-exam" aria-hidden="true" />
                <h3>Exam Preparation</h3>
                <p>Build custom mocks by unit for Paper 1, 2, and 3.</p>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="stats-bar" aria-label="Platform highlights">
        <div className="stats-bar-inner">
          <div>
            <CountUp value="10,000+" />
            <span>Students Supported</span>
          </div>
          <div>
            <CountUp value="1,200+" />
            <span>Lessons &amp; Examples</span>
          </div>
          <div>
            <CountUp value="25,000+" />
            <span>Practice Questions</span>
          </div>
          <div>
            <CountUp value="95%" />
            <span>Exam Success Focus</span>
          </div>
        </div>
      </section>

      <section id="testimonials" className="panel-section testimonials-shell">
        <Reveal className="section-head">
          <p className="eyebrow testimonials-eyebrow">Student Voices</p>
          <h2 className="testimonials-title">What Our Students Say</h2>
        </Reveal>
        <div className="testimonial-grid modern-testimonial-grid">
          <Reveal as="article" className="testimonial-card" delay={0}>
            <div className="testimonial-stars">★★★★★</div>
            <blockquote>
              “Mathelaureate&apos;s IBDP AA resources helped me fully grasp calculus. The step-by-step proofs and
              visual explanations made everything click.”
            </blockquote>
            <div className="testimonial-person">
              <span className="testimonial-avatar">AS</span>
              <div>
                <strong>Ananya S.</strong>
                <small>IBDP Year 2 · Singapore</small>
              </div>
            </div>
          </Reveal>
          <Reveal as="article" className="testimonial-card" delay={90}>
            <div className="testimonial-stars">★★★★★</div>
            <blockquote>
              “The IGCSE practice sets were exactly what I needed. Clear, concise, and exam-style questions that were
              incredibly well-targeted.”
            </blockquote>
            <div className="testimonial-person">
              <span className="testimonial-avatar">RK</span>
              <div>
                <strong>Rayan K.</strong>
                <small>IGCSE · Dubai</small>
              </div>
            </div>
          </Reveal>
          <Reveal as="article" className="testimonial-card" delay={180}>
            <div className="testimonial-stars">★★★★★</div>
            <blockquote>
              “As a parent, I appreciate how curriculum-specific Mathelaureate is. My daughter moved from a 4 to a 6
              in IBMYP Maths within one semester.”
            </blockquote>
            <div className="testimonial-person">
              <span className="testimonial-avatar">PM</span>
              <div>
                <strong>Priya M.</strong>
                <small>Parent · Bengaluru</small>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="contact" className="panel-section contact-section">
        <Reveal className="contact-intro">
          <p className="eyebrow">Get In Touch</p>
          <h2>Contact Us</h2>
          <p>Have questions about our programs? Send us a message and we&apos;ll get back to you within 24 hours.</p>
        </Reveal>
        <Reveal delay={80}>
          <form className="contact-form contact-form-card" onSubmit={onContactSubmit}>
          <div className="contact-grid-two">
            <input
              type="text"
              placeholder="Full Name"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              required
            />
            <input
              type="email"
              placeholder="Email Address"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              required
            />
          </div>
          <select value={contactSubject} onChange={(event) => setContactSubject(event.target.value)} required>
            <option value="General inquiry">General inquiry</option>
            <option value="Program guidance">Program guidance</option>
            <option value="Pricing and access">Pricing and access</option>
            <option value="Technical support">Technical support</option>
          </select>
          <textarea
            rows={4}
            placeholder="Your message"
            value={contactMessage}
            onChange={(event) => setContactMessage(event.target.value)}
            required
          />
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={contactWebsite}
            onChange={(event) => setContactWebsite(event.target.value)}
            style={{ position: 'absolute', left: '-9999px', opacity: 0, pointerEvents: 'none' }}
          />
          <div className="contact-actions-row">
            <button type="submit" className="btn primary" id="login" disabled={contactSending}>
              {contactSending ? 'Sending...' : 'Send Message'}
            </button>
          </div>
          {contactFeedback ? <p className={contactFeedbackIsError ? 'error-text' : 'success-text'}>{contactFeedback}</p> : null}
        </form>
        </Reveal>
      </section>

      <footer className="home-footer">
        <div className="home-footer-inner">
          <div className="home-footer-brand">
            <h3>
              <BrandWordmark />
            </h3>
            <p>
              Excellence in International Mathematics Education — empowering IB and IGCSE students to achieve their full
              mathematical potential.
            </p>
          </div>
          <div className="home-footer-column">
            <h4>About</h4>
            <a href="/#home">Our Mission</a>
            <Link to="/teachers-resources">Teachers &amp; Resources</Link>
            <Link to="/ia">IA</Link>
          </div>
          <div className="home-footer-column">
            <h4>Programs</h4>
            <a href="/#programs">IBDP Mathematics</a>
            <a href="/#programs">IGCSE Mathematics</a>
            <Link to="/programs">All Programs</Link>
          </div>
          <div className="home-footer-column">
            <h4>Contact</h4>
            <Link to="/privacy-policy">Privacy Policy</Link>
            <Link to="/terms-of-use">Terms of Use</Link>
          </div>
        </div>
        <div className="home-footer-bottom">
          <small>&copy; 2026 Mathelaureate. All rights reserved.</small>
          <div className="home-footer-legal">
            <Link to="/privacy-policy">Privacy Policy</Link>
            <Link to="/terms-of-use">Terms</Link>
            <a href="/#contact">Accessibility</a>
          </div>
        </div>
      </footer>
    </main>
  )
}

function ProgramCards({ withLinks = false }) {
  return (
    <div className="program-grid">
      {courseCatalog.map((course) => {
        const card = (
          <article className={`program-card icon-${course.icon || 'aa'}`}>
            <span className="program-icon" aria-hidden="true" />
            <h3>{course.title}</h3>
            <p>{course.description}</p>
            {withLinks ? <span className="program-link">View Course →</span> : null}
          </article>
        )

        return (
          <Reveal key={course.slug} className="program-grid-item">
            {withLinks ? (
              <Link className="course-card-link" to={`/courses/${course.slug}`}>
                {card}
              </Link>
            ) : (
              card
            )}
          </Reveal>
        )
      })}
    </div>
  )
}

function ProgramsPage({ user, cachedProfile }) {
  return (
    <main className="site site-full">
      <SiteHeader user={user} cachedProfile={cachedProfile} />
      <section className="panel-section">
        <h1>Programs</h1>
        <p>Browse all curriculum tracks and choose the one aligned to your school pathway.</p>
        <ProgramCards withLinks />
      </section>
    </main>
  )
}

const iaAaCourses = ['IBDP AA HL', 'IBDP AA SL']
const iaTopicChipDefaults = [
  'All',
  'Optimization',
  'Modelling',
  'Probability',
  'Calculus',
  'Surface Area',
  'Volume',
  'Statistics',
  'Differential Equations',
]

function iaLevelFromCourse(course) {
  const value = String(course || '')
  if (value.includes('SL')) return 'SL'
  if (value.includes('HL')) return 'HL'
  return ''
}

function IaTopicBar({ topic }) {
  const parts = String(topic || '')
    .split(/\s*[•·|,;]\s*|\s+\/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === 0) return null
  return (
    <div className="ia-topic-bar">
      {parts.map((part, index) => (
        <span key={`${part}-${index}`} className="ia-topic-chip">
          {part}
        </span>
      ))}
    </div>
  )
}

const IA_TITLE_MAX_WORDS = 20
const IA_TOPIC_MAX_WORDS = 8
const IA_SUMMARY_MAX_WORDS = 120
const IA_DESCRIPTION_MAX_WORDS = 50

function normalizeIaText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function iaStudentSummary(item) {
  const summary = String(item?.summary || '').trim()
  if (!summary) return ''
  const title = normalizeIaText(item?.title)
  const body = normalizeIaText(summary)
  if (title && (body === title || body.startsWith(title) || title.startsWith(body))) return ''
  return summary
}

function countWords(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length
}

function limitWords(value, maxWords) {
  const raw = String(value ?? '')
  const words = raw.trim().split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return raw
  return words.slice(0, maxWords).join(' ')
}

function IaCardPreview({ item }) {
  if (item.imageUrl) {
    return <img src={item.imageUrl} alt="" className="ia-grid-card-image" loading="lazy" decoding="async" />
  }
  return (
    <div className="ia-grid-card-fallback">
      <span>IA</span>
      <p>{item.topic || item.course || 'IA example'}</p>
    </div>
  )
}

function filterAaIaItems(items) {
  return items.filter((item) => iaAaCourses.includes(item.course) || !item.course)
}

function IaPage({ user, cachedProfile }) {
  const [iaItems, setIaItems] = useState(() => filterAaIaItems(normalizeIaItems(readCachedAppDoc('ia')?.items)))
  const [loadingIa, setLoadingIa] = useState(() => readCachedAppDoc('ia') === undefined)
  const [iaError, setIaError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [levelFilters, setLevelFilters] = useState([])
  const [topicFilter, setTopicFilter] = useState('All')
  const [userPayments, setUserPayments] = useState(() => normalizeUserPayments())

  useEffect(() => {
    let active = true

    async function loadIaItems() {
      if (readCachedAppDoc('ia') === undefined) setLoadingIa(true)
      setIaError('')
      try {
        const data = await getCachedAppDoc('ia', iaDocRef, (fresh) => {
          if (!active) return
          setIaItems(filterAaIaItems(normalizeIaItems(fresh?.items)))
          setLoadingIa(false)
        })
        if (!active) return
        setIaItems(filterAaIaItems(normalizeIaItems(data?.items)))
      } catch (error) {
        if (!active) return
        setIaError(error?.message || 'Unable to load IA examples.')
      } finally {
        if (active) setLoadingIa(false)
      }
    }

    loadIaItems()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    async function loadPayments() {
      if (!user?.uid) {
        if (active) setUserPayments(normalizeUserPayments())
        return
      }
      try {
        const paymentSnap = await getDoc(doc(db, 'userPayments', user.uid))
        if (!active) return
        setUserPayments(normalizeUserPayments(paymentSnap.exists() ? paymentSnap.data() : {}))
      } catch {
        if (active) setUserPayments(normalizeUserPayments())
      }
    }
    loadPayments()
    return () => {
      active = false
    }
  }, [user?.uid])

  const topicChips = useMemo(() => {
    const fromItems = iaItems
      .map((item) => item.topic)
      .filter((topic) => topic && topic.length <= 40)
    return [...new Set([...iaTopicChipDefaults, ...fromItems])]
  }, [iaItems])

  const filteredIaItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return iaItems.filter((item) => {
      const level = iaLevelFromCourse(item.course)
      if (levelFilters.length > 0 && !levelFilters.includes(level)) return false
      if (topicFilter !== 'All') {
        const topic = String(item.topic || '').toLowerCase()
        if (topic !== topicFilter.toLowerCase() && !topic.includes(topicFilter.toLowerCase())) return false
      }
      if (!query) return true
      const haystack = [item.title, item.topic, item.course].join(' ').toLowerCase()
      return haystack.includes(query)
    })
  }, [iaItems, searchQuery, levelFilters, topicFilter])

  function toggleLevel(level) {
    setLevelFilters((current) =>
      current.includes(level) ? current.filter((value) => value !== level) : [...current, level],
    )
  }

  function clearFilters() {
    setLevelFilters([])
    setTopicFilter('All')
    setSearchQuery('')
  }

  return (
    <main className="site site-full ia-page">
      <SiteHeader user={user} cachedProfile={cachedProfile} />

      <section className="ia-hero">
        <div className="ia-hero-inner">
          <p className="ia-breadcrumb">
            <Link to="/">Home</Link>
            <span aria-hidden="true"> / </span>
            <span>IA</span>
            <span aria-hidden="true"> / </span>
            <span>Math AA</span>
          </p>
          <h1>IB Math AA IA Examples</h1>
          <p className="ia-hero-sub">Research ideas and exemplar Internal Assessments</p>
        </div>
      </section>

      <section className="ia-browse-shell ia-browse-split">
        <aside className="ia-filter-rail">
          <div className="ia-filter-block">
            <h2>Level</h2>
            <div className="ia-pill-col" role="group" aria-label="Level">
              <button
                type="button"
                className={`ia-pill${levelFilters.length === 0 ? ' is-active' : ''}`}
                onClick={() => setLevelFilters([])}
              >
                All levels
              </button>
              {['HL', 'SL'].map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`ia-pill${levelFilters.includes(level) ? ' is-active' : ''}`}
                  onClick={() => toggleLevel(level)}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className="ia-filter-block">
            <div className="ia-filter-head">
              <h2>Topic</h2>
              <button type="button" className="ia-clear-inline" onClick={clearFilters}>
                Clear
              </button>
            </div>
            <div className="ia-pill-col" role="group" aria-label="Topic">
              {topicChips.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  className={`ia-pill${topicFilter === topic ? ' is-active' : ''}`}
                  onClick={() => setTopicFilter(topic)}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="ia-browse-main">
          <label className="ia-search-simple">
            <span className="sr-only">Search IA ideas</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search ideas — modelling, calculus, probability..."
            />
          </label>

          {loadingIa ? <p className="ia-status">Loading IA examples...</p> : null}
          {iaError ? <p className="error-text">{iaError}</p> : null}
          {!loadingIa && iaItems.length === 0 ? (
            <div className="ia-empty">
              <h2>No IA examples yet</h2>
              <p>Sample investigations will appear here soon.</p>
            </div>
          ) : null}
          {!loadingIa && iaItems.length > 0 && filteredIaItems.length === 0 ? (
            <div className="ia-empty">
              <h2>No matches</h2>
              <p>Try a different search or filter.</p>
            </div>
          ) : null}

          <div className="ia-card-grid">
            {filteredIaItems.map((item) => (
              <Link key={item.id} to={`/ia/${encodeURIComponent(item.id)}`} className="ia-grid-card">
                <div className="ia-grid-card-preview">
                  <IaCardPreview item={item} />
                  {hasIaAccess(userPayments, item.id) ? <span className="ia-grid-unlocked">Unlocked</span> : null}
                </div>
                <div className="ia-grid-card-body">
                  <div className="ia-idea-meta">
                    <span className="ia-meta-chip">IA</span>
                    {iaLevelFromCourse(item.course) ? (
                      <span className="ia-meta-chip">{iaLevelFromCourse(item.course)}</span>
                    ) : null}
                  </div>
                  {item.topic ? <IaTopicBar topic={item.topic} /> : null}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

function IaDetailPage({ user, cachedProfile }) {
  const { iaId } = useParams()
  const navigate = useNavigate()
  const [iaItem, setIaItem] = useState(null)
  const [loadingIa, setLoadingIa] = useState(true)
  const [iaError, setIaError] = useState('')
  const [userPayments, setUserPayments] = useState(() => normalizeUserPayments())
  const [paywallConfig, setPaywallConfig] = useState(() => normalizePaywallConfig())
  const [paymentBusy, setPaymentBusy] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [justUnlocked, setJustUnlocked] = useState(false)

  useEffect(() => {
    let active = true

    async function loadIaItem() {
      setLoadingIa(true)
      setIaError('')
      try {
        const [iaData, paywallData] = await Promise.all([
          getCachedAppDoc('ia', iaDocRef, (fresh) => {
            if (!active) return
            const matched = normalizeIaItems(fresh?.items).find((item) => item.id === iaId) || null
            setIaItem(matched)
            if (!matched) setIaError('This IA example could not be found.')
          }),
          getCachedAppDoc('paywall', paywallDocRef, (fresh) => {
            if (!active) return
            setPaywallConfig(normalizePaywallConfig(fresh))
          }),
        ])
        const items = normalizeIaItems(iaData?.items)
        const matched = items.find((item) => item.id === iaId) || null
        if (!active) return
        setIaItem(matched)
        setPaywallConfig(normalizePaywallConfig(paywallData))
        if (!matched) setIaError('This IA example could not be found.')
      } catch (error) {
        if (!active) return
        setIaError(error?.message || 'Unable to load this IA.')
      } finally {
        if (active) setLoadingIa(false)
      }
    }

    loadIaItem()
    return () => {
      active = false
    }
  }, [iaId])

  useEffect(() => {
    let active = true
    async function loadPayments() {
      if (!user?.uid) {
        if (active) setUserPayments(normalizeUserPayments())
        return
      }
      try {
        const paymentSnap = await getDoc(doc(db, 'userPayments', user.uid))
        if (!active) return
        setUserPayments(normalizeUserPayments(paymentSnap.exists() ? paymentSnap.data() : {}))
      } catch {
        if (active) setUserPayments(normalizeUserPayments())
      }
    }
    loadPayments()
    return () => {
      active = false
    }
  }, [user?.uid])

  const unlocked = iaItem ? hasIaAccess(userPayments, iaItem.id) : false
  const previewPages = iaItem?.previewPages || 1
  const iaUnlockPrice = iaItem ? resolveIaUnlockPrice(iaItem, paywallConfig.defaultIaUnlockPriceInr) : 0
  const iaPurchaseLabel = iaItem?.topic || iaItem?.course || 'IA exemplar'
  const subscriptionPrice = paywallConfig.fullSubscription.priceInr
  const subscriptionDurationLabel = formatAccessDuration(paywallConfig.fullSubscription.durationDays)

  function onIaPaymentsUpdated(nextPayments) {
    const gainedAccess = iaItem?.id && !hasIaAccess(userPayments, iaItem.id) && hasIaAccess(nextPayments, iaItem.id)
    setUserPayments(nextPayments)
    if (!gainedAccess) return
    setJustUnlocked(true)
    window.setTimeout(() => setJustUnlocked(false), 2400)
  }

  async function signInForPurchase() {
    setAuthBusy(true)
    setPaymentError('')
    try {
      const provider = new GoogleAuthProvider()
      const credential = await signInWithPopup(auth, provider)
      return credential?.user || null
    } catch (error) {
      setPaymentError(error?.message || 'Unable to sign in.')
      return null
    } finally {
      setAuthBusy(false)
    }
  }

  async function purchaseIaUnlock() {
    if (!iaItem) return
    const buyer = user || (await signInForPurchase())
    if (!buyer) return
    if (!iaUnlockPrice) {
      setPaymentError('This IA does not have an unlock price configured yet.')
      return
    }
    await startProductPurchase({
      user: buyer,
      productType: 'ia',
      iaId: iaItem.id,
      courseTitle: iaPurchaseLabel,
      description: `Unlock IA · ${iaPurchaseLabel}`,
      onPaymentsUpdated: onIaPaymentsUpdated,
      onError: setPaymentError,
      onBusyChange: setPaymentBusy,
    })
  }

  async function purchaseFullSubscription() {
    const buyer = user || (await signInForPurchase())
    if (!buyer) return
    await startProductPurchase({
      user: buyer,
      productType: 'subscription',
      courseId: FULL_SUBSCRIPTION_PRODUCT_ID,
      courseTitle: paywallConfig.fullSubscription.label,
      description: paywallConfig.fullSubscription.label,
      onPaymentsUpdated: onIaPaymentsUpdated,
      onError: setPaymentError,
      onBusyChange: setPaymentBusy,
    })
  }

  return (
    <main className="site site-full ia-page ia-detail-page">
      <SiteHeader user={user} cachedProfile={cachedProfile} />
      <section className="ia-detail-shell">
        <button type="button" className="ia-back-link" onClick={() => navigate('/ia')}>
          ← Back to IA examples
        </button>

        {loadingIa ? <p className="ia-status">Loading IA...</p> : null}
        {iaError ? <p className="error-text">{iaError}</p> : null}

        {iaItem ? (
          <article className="ia-detail-panel ia-detail-panel-split">
            <div className="ia-detail-info">
              <p className="ia-breadcrumb">
                <Link to="/">Home</Link>
                <span aria-hidden="true"> • </span>
                <Link to="/ia">IA</Link>
                <span aria-hidden="true"> • </span>
                <span>Math AA</span>
              </p>
              <div className="ia-idea-meta">
                <span className="ia-meta-chip">IA</span>
                <span className="ia-meta-chip">Math AA</span>
                {iaLevelFromCourse(iaItem.course) ? (
                  <span className="ia-meta-chip">{iaLevelFromCourse(iaItem.course)}</span>
                ) : null}
                {unlocked ? <span className="ia-meta-chip ia-meta-chip-unlocked">Unlocked</span> : null}
              </div>
              {iaItem.topic ? <IaTopicBar topic={iaItem.topic} /> : null}

              {iaStudentSummary(iaItem) ? (
                <div className="ia-summary-card">
                  <h3>Summary</h3>
                  <LatexText value={iaStudentSummary(iaItem)} className="latex-text" />
                </div>
              ) : null}

              <div className="ia-facts-grid">
                <div className="ia-fact-card">
                  <span>Preview</span>
                  <strong>
                    {previewPages} page{previewPages === 1 ? '' : 's'}
                  </strong>
                </div>
                <div className="ia-fact-card">
                  <span>IA unlock</span>
                  <strong>{iaUnlockPrice ? `₹${iaUnlockPrice}` : 'Not set'}</strong>
                </div>
              </div>

              {!unlocked ? (
                <div className="ia-unlock-card">
                  <h4>Unlock full exemplar</h4>
                  <div className="ia-pay-actions">
                    {!user ? (
                      <button type="button" className="btn primary" onClick={signInForPurchase} disabled={authBusy}>
                        {authBusy ? 'Signing in...' : 'Sign in to continue'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn primary"
                      onClick={purchaseIaUnlock}
                      disabled={paymentBusy || !iaUnlockPrice}
                    >
                      {paymentBusy
                        ? 'Processing...'
                        : iaUnlockPrice
                          ? `Unlock this IA · ₹${iaUnlockPrice}`
                          : 'IA price not set'}
                    </button>
                    <button type="button" className="btn ghost" onClick={purchaseFullSubscription} disabled={paymentBusy}>
                      Full access · ₹{subscriptionPrice} / {subscriptionDurationLabel}
                    </button>
                  </div>
                  {paymentError ? <p className="error-text">{paymentError}</p> : null}
                </div>
              ) : (
                <div className={`ia-unlock-card is-unlocked${justUnlocked ? ' is-just-unlocked' : ''}`}>
                  <div className="ia-unlock-seal" aria-hidden="true">
                    <span>✓</span>
                  </div>
                  <h4>Unlocked</h4>
                  {iaItem.link ? (
                    <div className="ia-pay-actions">
                      <a className="btn ghost" href={iaItem.link} target="_blank" rel="noreferrer">
                        Open related resource
                      </a>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="ia-detail-viewer">
              {iaItem.pdfUrl ? (
                <Suspense fallback={<p className="ia-doc-status">Loading document…</p>}>
                  <IaDocumentViewer
                    url={iaItem.pdfUrl}
                    unlocked={unlocked}
                    previewPages={previewPages}
                    justUnlocked={justUnlocked}
                  />
                </Suspense>
              ) : (
                <p className="muted-text">No PDF uploaded for this IA yet.</p>
              )}
            </div>
          </article>
        ) : null}
      </section>
    </main>
  )
}

const teachersResourceCategories = ['All', 'Activities', 'Worksheets', 'Videos', 'Classroom', 'Assessments', 'Other']

function TeachersResourceCardPreview({ post }) {
  if (post.imageUrl) {
    return <img src={post.imageUrl} alt="" className="ia-grid-card-image" loading="lazy" decoding="async" />
  }
  return (
    <div className="ia-grid-card-fallback">
      <span>PDF</span>
      <p>{post.category || post.title || 'Resource'}</p>
    </div>
  )
}

function TeachersResourcesPage({ user, cachedProfile }) {
  const [posts, setPosts] = useState(() => normalizeTeachersResourcesPosts(readCachedAppDoc('teachersResources')?.items))
  const [loadingPosts, setLoadingPosts] = useState(() => readCachedAppDoc('teachersResources') === undefined)
  const [postsError, setPostsError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')

  useEffect(() => {
    let active = true

    async function loadPosts() {
      if (readCachedAppDoc('teachersResources') === undefined) setLoadingPosts(true)
      setPostsError('')
      try {
        const data = await getCachedAppDoc('teachersResources', teachersResourcesDocRef, (fresh) => {
          if (!active) return
          setPosts(normalizeTeachersResourcesPosts(fresh?.items))
          setLoadingPosts(false)
        })
        if (!active) return
        setPosts(normalizeTeachersResourcesPosts(data?.items))
      } catch (error) {
        if (!active) return
        setPostsError(error?.message || 'Unable to load teachers resources right now.')
      } finally {
        if (active) setLoadingPosts(false)
      }
    }

    loadPosts()
    return () => {
      active = false
    }
  }, [])

  const categoryChips = useMemo(() => {
    const fromPosts = posts.map((post) => post.category).filter(Boolean)
    return [...new Set([...teachersResourceCategories, ...fromPosts])]
  }, [posts])

  const filteredPosts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return posts.filter((post) => {
      if (categoryFilter !== 'All' && String(post.category || '').toLowerCase() !== categoryFilter.toLowerCase()) {
        return false
      }
      if (!query) return true
      const haystack = [post.title, post.description, post.category, post.pdfFileName].join(' ').toLowerCase()
      return haystack.includes(query)
    })
  }, [posts, searchQuery, categoryFilter])

  function clearFilters() {
    setCategoryFilter('All')
    setSearchQuery('')
  }

  return (
    <main className="site site-full ia-page">
      <SiteHeader user={user} cachedProfile={cachedProfile} />

      <section className="ia-hero">
        <div className="ia-hero-inner">
          <p className="ia-breadcrumb">
            <Link to="/">Home</Link>
            <span aria-hidden="true"> / </span>
            <span>Teachers &amp; Resources</span>
          </p>
          <h1>Teachers &amp; Resources</h1>
          <p className="ia-hero-sub">Classroom activities, worksheets, and teaching materials</p>
        </div>
      </section>

      <section className="ia-browse-shell ia-browse-split">
        <aside className="ia-filter-rail">
          <div className="ia-filter-block">
            <div className="ia-filter-head">
              <h2>Category</h2>
              <button type="button" className="ia-clear-inline" onClick={clearFilters}>
                Clear
              </button>
            </div>
            <div className="ia-pill-col" role="group" aria-label="Category">
              {categoryChips.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`ia-pill${categoryFilter === category ? ' is-active' : ''}`}
                  onClick={() => setCategoryFilter(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="ia-browse-main">
          <label className="ia-search-simple">
            <span className="sr-only">Search teachers resources</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search activities, worksheets, classroom ideas..."
            />
          </label>

          {loadingPosts ? <p className="ia-status">Loading resources...</p> : null}
          {postsError ? <p className="error-text">{postsError}</p> : null}
          {!loadingPosts && posts.length === 0 ? (
            <div className="ia-empty">
              <h2>No resources yet</h2>
              <p>Teacher activities and classroom materials will appear here soon.</p>
            </div>
          ) : null}
          {!loadingPosts && posts.length > 0 && filteredPosts.length === 0 ? (
            <div className="ia-empty">
              <h2>No matches</h2>
              <p>Try a different search or category.</p>
            </div>
          ) : null}

          <div className="ia-card-grid">
            {filteredPosts.map((post) => (
              <Link
                key={post.id}
                to={`/teachers-resources/${encodeURIComponent(post.id)}`}
                className="ia-grid-card"
              >
                <div className="ia-grid-card-preview">
                  <TeachersResourceCardPreview post={post} />
                </div>
                <div className="ia-grid-card-body">
                  <div className="ia-idea-meta">
                    <span className="ia-meta-chip">Resource</span>
                    {post.category ? <span className="ia-meta-chip">{post.category}</span> : null}
                  </div>
                  {post.title ? <IaTopicBar topic={post.title} /> : null}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

function TeachersResourceDetailPage({ user, cachedProfile }) {
  const { postId } = useParams()
  const navigate = useNavigate()
  const [post, setPost] = useState(null)
  const [loadingPost, setLoadingPost] = useState(true)
  const [postError, setPostError] = useState('')

  useEffect(() => {
    let active = true

    async function loadPost() {
      setLoadingPost(true)
      setPostError('')
      try {
        const data = await getCachedAppDoc('teachersResources', teachersResourcesDocRef, (fresh) => {
          if (!active) return
          const nextItems = normalizeTeachersResourcesPosts(fresh?.items)
          const nextMatched = nextItems.find((item) => item.id === postId) || null
          setPost(nextMatched)
          if (!nextMatched) setPostError('This resource could not be found.')
        })
        const items = normalizeTeachersResourcesPosts(data?.items)
        const matched = items.find((item) => item.id === postId) || null
        if (!active) return
        setPost(matched)
        if (!matched) setPostError('This resource could not be found.')
      } catch (error) {
        if (!active) return
        setPostError(error?.message || 'Unable to load this resource.')
      } finally {
        if (active) setLoadingPost(false)
      }
    }

    loadPost()
    return () => {
      active = false
    }
  }, [postId])

  return (
    <main className="site site-full ia-page ia-detail-page">
      <SiteHeader user={user} cachedProfile={cachedProfile} />
      <section className="ia-detail-shell">
        <button type="button" className="ia-back-link" onClick={() => navigate('/teachers-resources')}>
          ← Back to Teachers &amp; Resources
        </button>

        {loadingPost ? <p className="ia-status">Loading resource...</p> : null}
        {postError ? <p className="error-text">{postError}</p> : null}

        {post ? (
          <article className="ia-detail-panel ia-detail-panel-split">
            <div className="ia-detail-info">
              <p className="ia-breadcrumb">
                <Link to="/">Home</Link>
                <span aria-hidden="true"> • </span>
                <Link to="/teachers-resources">Teachers &amp; Resources</Link>
                <span aria-hidden="true"> • </span>
                <span>{post.category || 'Resource'}</span>
              </p>
              <div className="ia-idea-meta">
                <span className="ia-meta-chip">Resource</span>
                {post.category ? <span className="ia-meta-chip">{post.category}</span> : null}
                {formatMetaDate(post.createdAt) ? <span className="ia-meta-chip">{formatMetaDate(post.createdAt)}</span> : null}
              </div>
              {post.title ? <IaTopicBar topic={post.title} /> : null}

              {post.description ? (
                <div className="ia-summary-card">
                  <h3>Summary</h3>
                  <LatexText value={post.description} className="latex-text" />
                </div>
              ) : null}

              <div className="ia-facts-grid">
                <div className="ia-fact-card">
                  <span>Document</span>
                  <strong>{post.pdfFileName || (post.pdfUrl ? 'PDF uploaded' : 'Not uploaded')}</strong>
                </div>
                <div className="ia-fact-card">
                  <span>Category</span>
                  <strong>{post.category || 'Activities'}</strong>
                </div>
              </div>
            </div>

            <div className="ia-detail-viewer">
              {post.pdfUrl ? (
                <Suspense fallback={<p className="ia-doc-status">Loading document…</p>}>
                  <IaDocumentViewer url={post.pdfUrl} unlocked previewPages={1} />
                </Suspense>
              ) : (
                <p className="muted-text">No PDF uploaded for this resource yet.</p>
              )}
            </div>
          </article>
        ) : null}
      </section>
    </main>
  )
}

function LegalDocumentPage({ user, cachedProfile, title, intro, sections }) {
  return (
    <main className="site site-full legal-page">
      <SiteHeader user={user} cachedProfile={cachedProfile} />
      <section className="legal-hero">
        <div className="legal-hero-inner">
          <p className="eyebrow">Legal</p>
          <h1>{title}</h1>
          <p className="legal-hero-lead">{intro}</p>
          <p className="legal-updated">Last updated 31 August 2026</p>
        </div>
      </section>
      <section className="legal-shell">
        <nav className="legal-toc" aria-label="On this page">
          <p>On this page</p>
          {sections.map((section) => (
            <a key={section.id} href={`#${section.id}`}>
              {section.title}
            </a>
          ))}
        </nav>
        <div className="legal-sections">
          {sections.map((section, index) => (
            <article key={section.id} id={section.id} className="legal-card">
              <span className="legal-card-num">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h2>{section.title}</h2>
                {(Array.isArray(section.body) ? section.body : [section.body]).map((paragraph, paragraphIndex) => (
                  <p key={paragraphIndex}>{paragraph}</p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

function PrivacyPolicyPage({ user, cachedProfile }) {
  return (
    <LegalDocumentPage
      user={user}
      cachedProfile={cachedProfile}
      title="Privacy Policy"
      intro="This Privacy Policy describes how Mathelaureate collects, uses, stores, and discloses information when you use www.mathelaureate.com and related services. By creating an account, making a purchase, or otherwise using the platform, you agree to this Policy. If you do not agree, do not use the service."
      sections={[
        {
          id: 'who',
          title: 'Who We Are',
          body: [
            'Mathelaureate operates an independent online mathematics learning platform. References to “Mathelaureate”, “we”, “us”, or “our” mean the platform owner and operator.',
            'We are not the International Baccalaureate Organization, Cambridge Assessment, Pearson, or any school, board, or examining body. Curriculum names are used only to describe the type of academic support offered.',
          ],
        },
        {
          id: 'collect',
          title: 'Information We Collect',
          body: [
            'Account data: name, email address, profile image, and authentication identifiers when you sign in (including through Google or similar providers).',
            'Learning data: course progress, visited topics, unlocked IA examples, saved work, and similar activity needed to deliver the product.',
            'Payment data: we receive confirmation, order identifiers, and limited billing metadata from payment processors. We do not store full card numbers on Mathelaureate servers.',
            'Communications: messages, names, and emails sent through contact forms or support channels.',
            'Technical data: device type, browser, IP-derived location or country, cookies or similar identifiers, diagnostic logs, and security events. This is used to run, secure, and improve the service.',
          ],
        },
        {
          id: 'use',
          title: 'How We Use Data',
          body: [
            'We use information to provide access to lessons, questions, IA examples, and teacher resources; to process purchases and unlocks; to prevent fraud and abuse; to diagnose outages; to communicate about your account, payments, or material policy changes; and to improve reliability and content.',
            'We may use aggregated or de-identified information that does not reasonably identify you for analytics and product planning. We do not sell personal information.',
          ],
        },
        {
          id: 'cookies',
          title: 'Cookies and Analytics',
          body: 'We use essential cookies and local or session storage to keep you signed in, remember preferences, and cache content for performance. We may also use analytics tools (including Google Analytics or similar) to understand traffic and feature use. You can control cookies in your browser; disabling them may break sign-in or other core features.',
        },
        {
          id: 'children',
          title: 'Students, Minors, and Parents',
          body: [
            'Mathelaureate is an educational service. If a student is under the age of digital consent in their country, a parent or legal guardian must create or supervise the account and agree to this Policy and the Terms of Use.',
            'Schools, tutors, or parents who provide student information represent that they have authority to do so. We are not a school of record and do not replace a school’s safeguarding, admissions, or examination duties.',
          ],
        },
        {
          id: 'storage',
          title: 'Storage, Processors, and Transfers',
          body: [
            'We use trusted cloud providers for hosting, authentication, databases, file storage, email or contact delivery, analytics, and payments. Those providers process data on our instructions and may store it in India, the United States, the European Union, or other locations where they operate.',
            'We apply reasonable administrative and technical safeguards. No method of transmission or storage is completely secure. You use the platform understanding that residual security risk remains.',
          ],
        },
        {
          id: 'sharing',
          title: 'When We Share Information',
          body: [
            'We share data with service providers only as needed to operate the platform (for example hosting, authentication, media storage, analytics, and payment processing), or when required by law, legal process, or to protect Mathelaureate, our users, or the public from harm, fraud, or abuse.',
            'If the platform is transferred as part of a sale, merger, or reorganization, user data may transfer to the successor so the service can continue, subject to this Policy or a replacement policy with equivalent protections.',
          ],
        },
        {
          id: 'retention',
          title: 'Retention',
          body: 'We keep account, learning, and payment records for as long as the account is active and for a reasonable period afterwards as needed for access control, accounting, dispute handling, security, and legal compliance. We may retain backups for a limited time. We may keep de-identified records indefinitely.',
        },
        {
          id: 'rights',
          title: 'Your Rights and Requests',
          body: [
            'Subject to applicable law, you may request access to, correction of, or deletion of personal information we hold about you. Parents or guardians may make requests for a child whose account they control.',
            'We may decline or limit requests where we cannot verify identity, where deletion would prevent us from providing a paid service you still use, or where we must keep records for legal, security, or accounting reasons. Use the website contact form to submit a request.',
          ],
        },
        {
          id: 'no-sale',
          title: 'No Sale of Personal Data',
          body: 'We do not sell personal information. We do not share it for cross-context behavioral advertising except as described for analytics and essential processors above.',
        },
        {
          id: 'updates',
          title: 'Changes to This Policy',
          body: 'We may update this Policy at any time. The “Last updated” date will change when we do. Continued use after an update constitutes acceptance of the revised Policy. If you do not agree, you must stop using the service and may request account closure.',
        },
        {
          id: 'contact',
          title: 'Contact',
          body: 'Privacy questions and data requests should be sent through the contact form on www.mathelaureate.com. We will respond within a reasonable time after we can verify the request.',
        },
      ]}
    />
  )
}

function TermsOfUsePage({ user, cachedProfile }) {
  return (
    <LegalDocumentPage
      user={user}
      cachedProfile={cachedProfile}
      title="Terms of Use"
      intro="These Terms of Use are a binding agreement between you and Mathelaureate. They protect the platform, its owner, and other users. By accessing www.mathelaureate.com, creating an account, or purchasing access, you accept these Terms. If you do not agree, do not use the service."
      sections={[
        {
          id: 'agreement',
          title: 'Agreement and Eligibility',
          body: [
            'You must be able to form a contract. If you are under the age of majority where you live, a parent or guardian must agree to these Terms on your behalf and supervise use.',
            'If you use Mathelaureate for a school, tutoring centre, or another person, you confirm you have authority to bind them. You are responsible for everyone who uses the service through your account.',
          ],
        },
        {
          id: 'not-affiliated',
          title: 'Independent Service; No Official Affiliation',
          body: [
            'Mathelaureate is an independent educational resource. We are not affiliated with, endorsed by, or sponsored by the International Baccalaureate Organization, Cambridge Assessment International Education, Pearson, any school, or any official examining body.',
            'IB, IBDP, IGCSE, MYP, and similar names are used only to describe the style of preparation offered. Official syllabuses, specimen papers, grade boundaries, and assessments remain the property of those organizations.',
          ],
        },
        {
          id: 'disclaimer',
          title: 'Educational Disclaimer',
          body: [
            'Content is for learning support only. It is not a school, not personal tutoring unless separately agreed, and not a substitute for a qualified teacher, counsellor, or official syllabus.',
            'We do not guarantee exam scores, predicted grades, university admission, IA marks, or any academic outcome. Results depend on the student, school, and examining body. You use all materials at your own academic risk.',
          ],
        },
        {
          id: 'scope',
          title: 'The Service',
          body: [
            'We may provide lessons, worked examples, question banks, mock tools, Internal Assessment examples, teacher resources, and related features. We may change, suspend, or discontinue any feature, price, or piece of content at any time without liability.',
            'The service is provided on an “as is” and “as available” basis. We do not warrant that it will be uninterrupted, error-free, or free of harmful components.',
          ],
        },
        {
          id: 'accounts',
          title: 'Accounts and Access',
          body: [
            'You must keep login details confidential. You are responsible for all activity under your account. Sharing, reselling, or pooling paid access is prohibited.',
            'Access to locked lessons, IA PDFs, or other paid items depends on a valid purchase or subscription as shown at checkout. We may revoke access if payment is reversed, suspected fraudulent, or obtained in breach of these Terms.',
          ],
        },
        {
          id: 'licence',
          title: 'Licence to Use Content',
          body: [
            'Subject to these Terms and any paid access you hold, we grant you a limited, personal, revocable, non-exclusive, non-transferable licence to view content for your own study or classroom teaching.',
            'You may not copy, scrape, download except where we provide a download control, republish, resell, upload to other sites, use content to train AI models, or create competing materials from our lessons, questions, solutions, or IA examples.',
          ],
        },
        {
          id: 'ia-content',
          title: 'IA Examples and Sample Work',
          body: [
            'IA examples and related PDFs are proprietary teaching materials or licensed samples. They are not official IB Internal Assessments, examiner reports, or student work released by the IB.',
            'Purchasing or unlocking an IA grants view access on the platform only, not ownership. Redistribution, classroom-wide file sharing, public posting, or claiming the work as a student’s original submission is forbidden and may result in immediate termination without refund.',
          ],
        },
        {
          id: 'payments',
          title: 'Payments, Taxes, and Refunds',
          body: [
            'Prices, currencies, and unlock rules are those displayed at the time of purchase. Taxes, foreign-exchange, and processor fees may apply. Payment is handled by third-party processors; their terms also apply.',
            'Digital content is generally non-refundable once access is granted. Refunds, if any, are at Mathelaureate’s sole discretion, except where mandatory consumer law requires otherwise. Chargebacks made in bad faith may lead to account closure and recovery of processor fees.',
          ],
        },
        {
          id: 'acceptable',
          title: 'Acceptable Use',
          body: [
            'You must not attempt unauthorized access, probe or overload the service, introduce malware, harvest other users’ data, impersonate anyone, or use the platform for anything unlawful.',
            'You must not use our content to cheat on school or official assessments, or to submit IA or coursework as if it were original student work. Academic honesty remains your responsibility.',
          ],
        },
        {
          id: 'user-content',
          title: 'Your Content',
          body: 'If you submit messages, feedback, or other materials, you grant Mathelaureate a worldwide, royalty-free licence to use them to operate and improve the service. You confirm you have the right to submit them and that they do not infringe others’ rights. We may remove content that we believe violates these Terms.',
        },
        {
          id: 'third-party',
          title: 'Third-Party Services',
          body: 'Sign-in, payments, hosting, analytics, and linked resources are provided by third parties. We are not responsible for their availability, content, or policies. Your use of those services is at your own risk and subject to their terms.',
        },
        {
          id: 'ip',
          title: 'Intellectual Property',
          body: 'The Mathelaureate name, logo, site design, lessons, questions, solutions, videos, IA examples, and other materials are owned by Mathelaureate or its licensors. No rights are granted except the limited licence in these Terms. Unauthorized use may result in civil and criminal liability.',
        },
        {
          id: 'liability',
          title: 'Limitation of Liability',
          body: [
            'To the maximum extent permitted by law, Mathelaureate, its owner, officers, contractors, and suppliers are not liable for indirect, incidental, special, consequential, exemplary, or punitive damages; lost profits, grades, admissions, data, or goodwill; or substitute procurement costs.',
            'Our total liability for any claim arising out of the service is limited to the amount you paid Mathelaureate for the specific product giving rise to the claim in the twelve (12) months before the claim, or USD 50 if you paid nothing. Some jurisdictions do not allow certain limits; in those cases our liability is limited to the fullest extent allowed.',
          ],
        },
        {
          id: 'indemnity',
          title: 'Indemnity',
          body: 'You will defend, indemnify, and hold harmless Mathelaureate and its owner from claims, damages, losses, and reasonable legal fees arising from your use of the service, your content, your breach of these Terms, or your violation of law or third-party rights, including academic-misconduct or copyright claims related to IA or other materials.',
        },
        {
          id: 'termination',
          title: 'Suspension and Termination',
          body: 'We may suspend or terminate access immediately, without refund, if we reasonably believe you have breached these Terms, created legal or security risk, or used payment methods fraudulently. You may stop using the service at any time. Sections that by nature should survive (including licence restrictions, IP, disclaimers, liability limits, indemnity, and governing law) survive termination.',
        },
        {
          id: 'law',
          title: 'Governing Law',
          body: 'These Terms are governed by the laws of India, without regard to conflict-of-law rules. Courts in India have exclusive jurisdiction, except that we may seek injunctive relief in any jurisdiction to protect intellectual property or confidential information. Mandatory consumer protections in your country of residence still apply where they cannot be waived.',
        },
        {
          id: 'general',
          title: 'General',
          body: [
            'These Terms are the entire agreement for use of the website and override prior discussions about the service. If a clause is unenforceable, the rest remains in force. Failure to enforce a right is not a waiver.',
            'We are not liable for delays or failures caused by events beyond our reasonable control, including outages of cloud, payment, or authentication providers.',
            'You may not assign these Terms. We may assign them in connection with a sale or reorganization of the platform.',
          ],
        },
        {
          id: 'updates',
          title: 'Changes to These Terms',
          body: 'We may update these Terms at any time by posting a revised version on the site. The “Last updated” date will change. Continued use after an update is acceptance. If you do not agree, you must stop using the service.',
        },
        {
          id: 'contact',
          title: 'Contact',
          body: 'Questions about these Terms can be sent through the contact form on www.mathelaureate.com.',
        },
      ]}
    />
  )
}

function CoursePage({ user, authReady, cachedProfile }) {
  const { slug } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const course = courseCatalog.find((item) => item.slug === slug)
  const [loginPending, setLoginPending] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [curriculum, setCurriculum] = useState(null)
  const [courseItems, setCourseItems] = useState([])
  const [courseLoading, setCourseLoading] = useState(false)
  const [courseError, setCourseError] = useState('')
  const [selectedUnitId, setSelectedUnitId] = useState('')
  const [selectedSubunit, setSelectedSubunit] = useState('')
  const [activeTab, setActiveTab] = useState('lesson')
  const [selectedDifficulties, setSelectedDifficulties] = useState([])
  const [activeSolutionItem, setActiveSolutionItem] = useState(null)
  const [paywallConfig, setPaywallConfig] = useState(() => normalizePaywallConfig())
  const [userPayments, setUserPayments] = useState(() => normalizeUserPayments())
  const [paidCourses, setPaidCourses] = useState({})
  const [paymentBusy, setPaymentBusy] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [shareFeedback, setShareFeedback] = useState('')
  const [expandedImageUrl, setExpandedImageUrl] = useState('')
  const [visitedSubunitKeys, setVisitedSubunitKeys] = useState([])
  const [savedQuestions, setSavedQuestions] = useState([])
  const [wrongQuestions, setWrongQuestions] = useState([])
  const [studyBusyId, setStudyBusyId] = useState('')

  if (!course) {
    return <Navigate to="/" replace />
  }

  useEffect(() => {
    let active = true

    async function loadCourseWorkspace() {
      if (!user || !course.curriculumId) return
      setCourseLoading(true)
      setCourseError('')

      try {
        const [curriculaData, fetchedRecords, paywallData, paymentSnap, progressSnap] = await Promise.all([
          getCachedAppDoc('curricula', curriculaDocRef),
          getCachedContentItems(),
          getCachedAppDoc('paywall', paywallDocRef),
          getDoc(doc(db, 'userPayments', user.uid)),
          getDoc(doc(db, 'userCourseProgress', user.uid)),
        ])
        const courses = ensureRequiredCurricula(curriculaData?.courses)
        const matchedCurriculum = courses.find((item) => item.id === course.curriculumId) || null

        const filteredItems = fetchedRecords
          .filter((item) => item.curriculumId === course.curriculumId)
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

        const nextPaywallConfig = normalizePaywallConfig(paywallData)
        const nextPayments = normalizeUserPayments(paymentSnap.exists() ? paymentSnap.data() : {})
        const nextPaidCourses = nextPayments.courses

        const progressData = progressSnap.exists() ? progressSnap.data() : {}
        const lastViewedCourse = progressData?.courses?.[course.slug] || null

        function hasSubunit(unitId, subunitName) {
          if (!matchedCurriculum || !unitId || !subunitName) return false
          const unit = matchedCurriculum.units?.find((item) => item.id === unitId)
          return Array.isArray(unit?.subunits) && unit.subunits.includes(subunitName)
        }

        const firstUnit = matchedCurriculum?.units?.[0]
        const firstSubunit = firstUnit?.subunits?.[0] ?? ''
        let nextUnitId = firstUnit?.id ?? ''
        let nextSubunit = firstSubunit
        let nextTab = 'lesson'

        const searchParams = new URLSearchParams(location.search || '')
        const requestedUnitId = searchParams.get('unit') || ''
        const requestedSubunit = searchParams.get('subunit') || ''
        const requestedTab = searchParams.get('tab') === 'question' ? 'question' : 'lesson'

        if (hasSubunit(requestedUnitId, requestedSubunit)) {
          nextUnitId = requestedUnitId
          nextSubunit = requestedSubunit
          nextTab = requestedTab
        } else if (hasSubunit(lastViewedCourse?.lastViewedUnitId, lastViewedCourse?.lastViewedSubunit)) {
          nextUnitId = lastViewedCourse.lastViewedUnitId
          nextSubunit = lastViewedCourse.lastViewedSubunit
        } else {
          const firstContentMatch = filteredItems.find((item) => hasSubunit(item.unitId, item.subunit))
          if (firstContentMatch) {
            nextUnitId = firstContentMatch.unitId
            nextSubunit = firstContentMatch.subunit
          }
        }

        if (!active) return

        setCurriculum(matchedCurriculum)
        setCourseItems(filteredItems)
        setPaywallConfig(nextPaywallConfig)
        setUserPayments(nextPayments)
        setPaidCourses(nextPaidCourses)
        setVisitedSubunitKeys(
          Array.isArray(lastViewedCourse?.visitedSubunits)
            ? lastViewedCourse.visitedSubunits.map((key) => String(key))
            : [],
        )
        setSavedQuestions(normalizeStudyList(progressData?.savedQuestions))
        setWrongQuestions(normalizeStudyList(progressData?.wrongQuestions))
        setSelectedUnitId(nextUnitId)
        setSelectedSubunit(nextSubunit)
        setActiveTab(nextTab)
      } catch (error) {
        if (!active) return
        setCourseError(error?.message || 'Unable to load lessons from Firestore.')
      } finally {
        if (active) setCourseLoading(false)
      }
    }

    loadCourseWorkspace()

    return () => {
      active = false
    }
  }, [user, course.curriculumId, location.search])

  async function startGoogleLogin() {
    setLoginPending(true)
    setLoginError('')
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })

    try {
      await setPersistence(auth, browserLocalPersistence)
      await signInWithPopup(auth, provider)
    } catch (error) {
      const message = error?.message?.replace('Firebase: ', '') || 'Unable to complete Google sign-in.'
      setLoginError(message)
    } finally {
      setLoginPending(false)
    }
  }

  const units = curriculum?.units ?? []
  const selectedUnit = units.find((unit) => unit.id === selectedUnitId) || units[0]
  const currentSubunit = selectedSubunit || selectedUnit?.subunits?.[0] || ''
  const subunitSequence = useMemo(
    () =>
      units.flatMap((unit) =>
        (unit.subunits || []).map((subunitName) => ({
          unitId: unit.id,
          subunit: subunitName,
        })),
      ),
    [units],
  )
  const currentSubunitIndex = subunitSequence.findIndex(
    (entry) => entry.unitId === selectedUnit?.id && entry.subunit === currentSubunit,
  )
  const previousSubunitEntry = currentSubunitIndex > 0 ? subunitSequence[currentSubunitIndex - 1] : null
  const nextSubunitEntry =
    currentSubunitIndex >= 0 && currentSubunitIndex < subunitSequence.length - 1
      ? subunitSequence[currentSubunitIndex + 1]
      : null
  const scopedItems = courseItems.filter((item) => item.unitId === selectedUnit?.id && item.subunit === currentSubunit)
  const sortByStoredOrder = (a, b) => {
    const aOrder = Number.isFinite(Number(a?.sortOrder)) ? Number(a.sortOrder) : Number.MAX_SAFE_INTEGER
    const bOrder = Number.isFinite(Number(b?.sortOrder)) ? Number(b.sortOrder) : Number.MAX_SAFE_INTEGER
    if (aOrder !== bOrder) return aOrder - bOrder
    return String(a?.createdAt || '').localeCompare(String(b?.createdAt || ''))
  }
  const lessons = [...scopedItems.filter((item) => item.itemType === 'lesson' || item.itemType === 'resource')].sort(sortByStoredOrder)
  const questions = scopedItems.filter((item) => item.itemType === 'question')
  const isIbdpAaAiCourse = course.curriculumId === 'ibdp-aa-hl' || course.curriculumId === 'ibdp-ai-hl'
  const difficultyOptions = ['easy', 'medium', 'hard']
  const difficultyRank = { easy: 1, medium: 2, hard: 3 }
  const focusQuestionId = useMemo(() => new URLSearchParams(location.search || '').get('q') || '', [location.search])
  const filteredQuestions = [...(selectedDifficulties.length === 0
    ? questions
    : questions.filter((item) => selectedDifficulties.includes(String(item.difficulty || '').toLowerCase())))].sort((a, b) => {
    const aRank = difficultyRank[String(a?.difficulty || 'medium').toLowerCase()] || 99
    const bRank = difficultyRank[String(b?.difficulty || 'medium').toLowerCase()] || 99
    if (aRank !== bRank) return aRank - bRank
    return sortByStoredOrder(a, b)
  })
  const visibleQuestions =
    focusQuestionId && !filteredQuestions.some((item) => item.id === focusQuestionId)
      ? [questions.find((item) => item.id === focusQuestionId), ...filteredQuestions].filter(Boolean)
      : filteredQuestions
  const activeItems = activeTab === 'lesson' ? lessons : visibleQuestions
  const lessonShareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/courses/${course.slug}?unit=${encodeURIComponent(selectedUnit?.id || '')}&subunit=${encodeURIComponent(currentSubunit || '')}&tab=${encodeURIComponent(activeTab)}`
      : ''
  const paidForCurrentCourse = hasCourseAccess(userPayments, course.curriculumId)
  const coursePrice = Number(paywallConfig.coursePrices?.[course.curriculumId] || 0)
  const subscriptionPrice = Number(paywallConfig.fullSubscription?.priceInr || FULL_SUBSCRIPTION_DEFAULT_PRICE_INR)
  const subscriptionDurationLabel = formatAccessDuration(
    paywallConfig.fullSubscription?.durationDays || FULL_SUBSCRIPTION_DEFAULT_DAYS,
  )
  const lockedUnits = paywallConfig.lockedUnits?.[course.curriculumId] || []
  const lockedSubunits = paywallConfig.lockedSubunits?.[course.curriculumId] || []
  const currentSubunitLockKey = `${selectedUnit?.id}::${currentSubunit}`
  const isCurrentSelectionLocked =
    !paidForCurrentCourse &&
    (lockedUnits.includes(selectedUnit?.id) || lockedSubunits.includes(currentSubunitLockKey))

  function isUnitLocked(unitId) {
    return !paidForCurrentCourse && lockedUnits.includes(unitId)
  }

  function isSubunitLocked(unitId, subunitName) {
    const lockKey = `${unitId}::${subunitName}`
    return !paidForCurrentCourse && (lockedUnits.includes(unitId) || lockedSubunits.includes(lockKey))
  }

  async function handleToggleStudy(listKey, item) {
    if (!user || !item?.id) return
    const list = listKey === SAVED_QUESTIONS_KEY ? savedQuestions : wrongQuestions
    const currentlySaved = list.some((entry) => entry.questionId === item.id)
    setStudyBusyId(`${listKey}:${item.id}`)
    try {
      const entry = buildStudyQuestionEntry({
        item,
        course,
        unitId: selectedUnit?.id,
        subunit: currentSubunit,
        unitName: selectedUnit?.name,
      })
      const next = await toggleStudyQuestion({ user, listKey, entry, currentlySaved })
      if (listKey === SAVED_QUESTIONS_KEY) setSavedQuestions(next)
      else setWrongQuestions(next)
    } catch {
      // Non-blocking: saving a question should not break the course page.
    } finally {
      setStudyBusyId('')
    }
  }

  function openSolution(item, index) {
    setActiveSolutionItem({
      ...item,
      questionNumber: index + 1,
    })
  }

  function closeSolution() {
    setActiveSolutionItem(null)
  }

  function renderContentBlocks(blocks, keyPrefix) {
    const normalizedBlocks = normalizeContentBlocks(blocks)
    if (normalizedBlocks.length === 0) return null
    return (
      <div className="content-blocks-render">
        {normalizedBlocks.map((block, index) =>
          block.type === 'image' ? (
            <div className="content-image-block" key={`${keyPrefix}-img-${index}`}>
              <button
                type="button"
                className="image-open-btn"
                onClick={() => setExpandedImageUrl(block.imageUrl)}
                aria-label="Open image in full view"
              >
                <img
                  src={block.imageUrl}
                  alt={block.caption || 'Content visual'}
                  style={getContentBlockImageStyle(block)}
                />
              </button>
              {block.caption ? <small className="content-block-caption">{block.caption}</small> : null}
            </div>
          ) : (
            <LatexText key={`${keyPrefix}-txt-${index}`} value={block.text} className="latex-text" />
          ),
        )}
      </div>
    )
  }

  async function nativeShareLesson() {
    if (!lessonShareUrl) return
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${course.title} - ${currentSubunit || selectedUnit?.name || 'Lesson'}`,
          text: 'Check out this lesson on Mathelaureate.',
          url: lessonShareUrl,
        })
        setShareFeedback('Lesson shared.')
      } catch {
        // User cancel is non-fatal.
      }
      return
    }
    try {
      await navigator.clipboard.writeText(lessonShareUrl)
      setShareFeedback('Lesson link copied.')
    } catch {
      setShareFeedback('Unable to copy link.')
    }
  }

  async function startCoursePurchase() {
    if (!user || !course.curriculumId) return
    if (!coursePrice || coursePrice <= 0) {
      setPaymentError('Pricing is not configured for this course yet.')
      return
    }
    await startProductPurchase({
      user,
      productType: 'course',
      courseId: course.curriculumId,
      courseSlug: course.slug,
      courseTitle: course.title,
      description: `${course.title} course access`,
      onPaymentsUpdated: (nextPayments) => {
        setUserPayments(nextPayments)
        setPaidCourses(nextPayments.courses || {})
      },
      onError: setPaymentError,
      onBusyChange: setPaymentBusy,
    })
  }

  async function startFullSubscriptionPurchase() {
    if (!user) return
    await startProductPurchase({
      user,
      productType: 'subscription',
      courseId: FULL_SUBSCRIPTION_PRODUCT_ID,
      courseTitle: paywallConfig.fullSubscription.label,
      description: paywallConfig.fullSubscription.label,
      onPaymentsUpdated: (nextPayments) => {
        setUserPayments(nextPayments)
        setPaidCourses(nextPayments.courses || {})
      },
      onError: setPaymentError,
      onBusyChange: setPaymentBusy,
    })
  }

  function toggleDifficultyFilter(level) {
    setSelectedDifficulties((current) =>
      current.includes(level) ? current.filter((item) => item !== level) : [...current, level],
    )
  }

  function jumpToSubunit(target) {
    if (!target?.unitId || !target?.subunit) return
    setSelectedUnitId(target.unitId)
    setSelectedSubunit(target.subunit)
    setActiveTab('lesson')
  }

  useEffect(() => {
    setShareFeedback('')
  }, [selectedUnit?.id, currentSubunit, activeTab])

  useEffect(() => {
    let active = true

    async function trackUserCourseProgress() {
      if (!user || !course.curriculumId || !selectedUnit?.id || !currentSubunit) return

      const subunitKey = `${selectedUnit.id}::${currentSubunit}`
      setVisitedSubunitKeys((current) => (current.includes(subunitKey) ? current : [...current, subunitKey]))

      try {
        const progressRef = doc(db, 'userCourseProgress', user.uid)
        const progressSnap = await getDoc(progressRef)
        const existingData = progressSnap.exists() ? progressSnap.data() : {}
        const existingCourses = existingData?.courses || {}
        const existingCourse = existingCourses[course.slug] || {}
        const visitedSubunits = Array.isArray(existingCourse.visitedSubunits)
          ? existingCourse.visitedSubunits.map((key) => String(key))
          : []
        const alreadyVisited = visitedSubunits.includes(subunitKey)
        const updatedVisitedSubunits = alreadyVisited ? visitedSubunits : [...visitedSubunits, subunitKey]
        const timestamp = new Date().toISOString()
        const updatedCourse = {
          ...existingCourse,
          slug: course.slug,
          title: course.title,
          curriculumId: course.curriculumId,
          visitedSubunits: updatedVisitedSubunits,
          visitedSubunitsCount: updatedVisitedSubunits.length,
          lastViewedUnitId: selectedUnit.id,
          lastViewedSubunit: currentSubunit,
          updatedAt: timestamp,
        }
        const updatedCourses = {
          ...existingCourses,
          [course.slug]: updatedCourse,
        }
        const updatedMyCourses = Object.values(updatedCourses)
          .filter((courseEntry) => Number(courseEntry?.visitedSubunitsCount || 0) > 1)
          .map((courseEntry) => ({
            slug: courseEntry.slug,
            title: courseEntry.title,
            curriculumId: courseEntry.curriculumId,
            visitedSubunitsCount: courseEntry.visitedSubunitsCount,
            lastViewedUnitId: courseEntry.lastViewedUnitId || '',
            lastViewedSubunit: courseEntry.lastViewedSubunit || '',
            updatedAt: courseEntry.updatedAt || timestamp,
          }))

        if (!active) return

        await setDoc(
          progressRef,
          {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || '',
            courses: updatedCourses,
            myCourses: updatedMyCourses,
            updatedAt: timestamp,
          },
          { merge: true },
        )

        if (active) {
          setVisitedSubunitKeys(updatedVisitedSubunits)
        }
      } catch {
        // Non-blocking: progress tracking should never break page access.
      }
    }

    trackUserCourseProgress()

    return () => {
      active = false
    }
  }, [user, course.slug, course.title, course.curriculumId, selectedUnit?.id, currentSubunit])

  useEffect(() => {
    if (activeTab !== 'question' || !focusQuestionId || courseLoading) return
    const timer = window.setTimeout(() => {
      const el = document.getElementById(`question-${focusQuestionId}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [activeTab, focusQuestionId, courseLoading, visibleQuestions.length])

  if (!authReady) {
    return (
      <main className="site site-full">
        <section className="panel-section auth-card">
          <h2>Checking authentication...</h2>
          <p>One moment while we verify your login status.</p>
        </section>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="site site-full">
        <section className="panel-section auth-card auth-status-card">
          <h2>Sign in required</h2>
          <p>Use your Google account to continue to this course.</p>
          {loginError ? <p>{loginError}</p> : null}
          <button type="button" className="btn primary google-btn" onClick={startGoogleLogin} disabled={loginPending}>
            {loginPending ? 'Signing in...' : 'Continue with Google'}
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="site course-page site-full">
      <SiteHeader user={user} cachedProfile={cachedProfile} bare />
      <section className="course-shell-fluid course-workspace">
        {courseLoading ? <p className="course-loading-line">Loading lesson workspace...</p> : null}
        {courseError ? <p className="error-text">{courseError}</p> : null}

        {!course.curriculumId ? (
          <section className="course-basic">
            <h2>Curriculum Workspace Coming Soon</h2>
            <p>This course is available publicly, and its subunit lesson workspace will be added next.</p>
          </section>
        ) : (
          <div className="course-workspace-grid course-workspace-lms">
            <aside className="lesson-sidebar">
              <button type="button" className="sidebar-back-link" onClick={() => navigate('/#programs')}>
                ← Back to Programs
              </button>
              <p className="sidebar-course-label">{course.shortTitle || course.title} · Course</p>
              <h2 className="sidebar-topic-title">{selectedUnit?.name || course.title}</h2>
              <div className="sidebar-nav-list">
                {units.map((unit) => (
                  <div className="sidebar-unit" key={unit.id}>
                    <button
                      type="button"
                      className={`sidebar-unit-btn ${selectedUnit?.id === unit.id ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedUnitId(unit.id)
                        setSelectedSubunit(unit.subunits?.[0] || '')
                      }}
                    >
                      <span>{unit.name}</span>
                      {isUnitLocked(unit.id) ? <small className="lock-badge">Locked</small> : null}
                    </button>
                    {selectedUnit?.id === unit.id ? (
                      <div className="sidebar-subunits">
                        {(unit.subunits || []).map((subtopic) => {
                          const isActive = selectedUnit?.id === unit.id && currentSubunit === subtopic
                          const subunitKey = `${unit.id}::${subtopic}`
                          const isVisited = visitedSubunitKeys.includes(subunitKey)
                          return (
                            <button
                              type="button"
                              key={subtopic}
                              className={`sidebar-subunit-btn ${isActive ? 'active' : ''} ${
                                isVisited && !isActive ? 'done' : ''
                              }`}
                              onClick={() => {
                                setSelectedUnitId(unit.id)
                                setSelectedSubunit(subtopic)
                              }}
                            >
                              <span className="sidebar-status-dot" aria-hidden="true">
                                {isVisited && !isActive ? (
                                  <svg viewBox="0 0 24 24" width="12" height="12">
                                    <path
                                      d="M5 12.5 10 17l9-10"
                                      fill="none"
                                      stroke="#fff"
                                      strokeWidth="2.6"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                ) : isActive ? (
                                  <svg viewBox="0 0 24 24" width="12" height="12">
                                    <path d="M7 4h7l3 3v13H7V4Z" fill="none" stroke="#fff" strokeWidth="2.2" />
                                  </svg>
                                ) : null}
                              </span>
                              <span className="sidebar-subunit-label">{subtopic}</span>
                              {isSubunitLocked(unit.id, subtopic) ? <small className="lock-badge">Locked</small> : null}
                            </button>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="btn ghost sidebar-overview-btn"
                onClick={() => {
                  if (units[0]) {
                    setSelectedUnitId(units[0].id)
                    setSelectedSubunit(units[0].subunits?.[0] || '')
                    setActiveTab('lesson')
                  }
                }}
              >
                <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 19.5V6.5A1.5 1.5 0 0 1 5.5 5H12v14.5H5.5A1.5 1.5 0 0 1 4 19.5Z" fill="none" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M12 5h6.5A1.5 1.5 0 0 1 20 6.5v13a1.5 1.5 0 0 1-1.5 1.5H12V5Z" fill="none" stroke="currentColor" strokeWidth="1.7" />
                </svg>
                Course Overview
              </button>
            </aside>

            <section className="lesson-main">
              <p className="eyebrow lesson-breadcrumb">{currentSubunit || 'Subunit'}</p>
              <div className="lesson-title-row">
                <h1 className="lesson-page-title">{currentSubunit || selectedUnit?.name || course.title}</h1>
                <button
                  type="button"
                  className="icon-share-btn"
                  onClick={nativeShareLesson}
                  title="Share lesson"
                  aria-label="Share lesson"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
                    <path d="M12 16V4" />
                    <path d="M7 9l5-5 5 5" />
                  </svg>
                </button>
              </div>
              <div className="lesson-toolbar">
                <div className="lesson-tabs">
                  <button
                    type="button"
                    className={`lesson-tab ${activeTab === 'lesson' ? 'active' : ''}`}
                    onClick={() => setActiveTab('lesson')}
                  >
                    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 5h16M4 12h16M4 19h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    Lesson
                  </button>
                  <button
                    type="button"
                    className={`lesson-tab ${activeTab === 'question' ? 'active' : ''}`}
                    onClick={() => setActiveTab('question')}
                  >
                    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M9.6 9.4a2.5 2.5 0 0 1 4.7.9c0 1.5-2.35 2-2.35 3.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      <circle cx="12" cy="17.1" r="1" fill="currentColor" />
                    </svg>
                    Question Bank
                  </button>
                </div>
                <div className="lesson-toolbar-actions">
                  <div className="lesson-nav-buttons">
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => jumpToSubunit(previousSubunitEntry)}
                      disabled={!previousSubunitEntry}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => jumpToSubunit(nextSubunitEntry)}
                      disabled={!nextSubunitEntry}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
              {shareFeedback ? (
                <div className="lesson-share-row">
                  <small>{shareFeedback}</small>
                </div>
              ) : null}

              {isCurrentSelectionLocked ? (
                <article className="lesson-card paywall-card">
                  <h3>Premium content</h3>
                  <p>Unlock this course, or get full platform access.</p>
                  {coursePrice > 0 ? <p className="paywall-price">Course · ₹{coursePrice}</p> : <p>Course price not set yet.</p>}
                  <p className="paywall-price">
                    Full access · ₹{subscriptionPrice} / {subscriptionDurationLabel}
                  </p>
                  {paymentError ? <p className="error-text">{paymentError}</p> : null}
                  <div className="ia-pay-actions">
                    <button type="button" className="btn primary" onClick={startCoursePurchase} disabled={paymentBusy || coursePrice <= 0}>
                      {paymentBusy ? 'Opening checkout...' : 'Unlock this course'}
                    </button>
                    <button type="button" className="btn ghost" onClick={startFullSubscriptionPurchase} disabled={paymentBusy}>
                      Full access · ₹{subscriptionPrice}
                    </button>
                  </div>
                </article>
              ) : (
                <>
                  {activeTab === 'question' ? (
                    <div className="question-filter-row">
                      <strong>Filter by difficulty</strong>
                      <div className="difficulty-chip-row">
                        <button
                          type="button"
                          className={`difficulty-chip ${selectedDifficulties.length === 0 ? 'active' : ''}`}
                          onClick={() => setSelectedDifficulties([])}
                        >
                          All
                        </button>
                        {difficultyOptions.map((level) => (
                          <button
                            type="button"
                            key={level}
                            className={`difficulty-chip ${selectedDifficulties.includes(level) ? 'active' : ''}`}
                            onClick={() => toggleDifficultyFilter(level)}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="lesson-content">
                    {activeItems.length === 0 ? (
                      <article className="lesson-card">
                        <h3>No content yet</h3>
                        <p>Use the admin dashboard to add {activeTab}s for this subunit.</p>
                      </article>
                    ) : (
                      activeItems.map((item, index) => (
                        <CourseItemCard
                          key={item.id}
                          item={item}
                          index={index}
                          activeTab={activeTab}
                          isIbdpAaAiCourse={isIbdpAaAiCourse}
                          onOpenImage={setExpandedImageUrl}
                          onOpenSolution={openSolution}
                          renderBlocks={renderContentBlocks}
                          isBookmarked={savedQuestions.some((entry) => entry.questionId === item.id)}
                          isWrong={wrongQuestions.some((entry) => entry.questionId === item.id)}
                          onToggleBookmark={(question) => handleToggleStudy(SAVED_QUESTIONS_KEY, question)}
                          onToggleWrong={(question) => handleToggleStudy(WRONG_QUESTIONS_KEY, question)}
                          studyBusy={studyBusyId.endsWith(`:${item.id}`)}
                          isFocused={item.id === focusQuestionId}
                        />
                      ))
                    )}
                  </div>
                </>
              )}
            </section>

            <aside className="lesson-rail">
              {(() => {
                const subunits = selectedUnit?.subunits || []
                const visitedInUnit = subunits.filter((subtopic) =>
                  visitedSubunitKeys.includes(`${selectedUnit?.id}::${subtopic}`),
                ).length
                const progressPct = subunits.length ? Math.round((visitedInUnit / subunits.length) * 100) : 0

                return (
                  <>
                    <article className="rail-card">
                      <h3>
                        <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M4 19V5M4 19h16M8 15l3-4 3 2 4-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Your Progress
                      </h3>
                      <div className="rail-progress-head">
                        <strong>{progressPct}%</strong>
                        <span>
                          {subunits.length
                            ? `${visitedInUnit} of ${subunits.length} subtopics viewed`
                            : 'No subtopics'}
                        </span>
                      </div>
                      <div className="rail-progress-track" aria-hidden="true">
                        <span className="rail-progress-fill" style={{ width: `${progressPct}%` }} />
                      </div>
                    </article>

                    <article className="rail-cta">
                      <h3>
                        <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M8 14.5 5 21l4-1.5L12 21l3-1.5L19 21l-3-6.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                          <circle cx="12" cy="8" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
                        </svg>
                        Test Your Understanding
                      </h3>
                      <p>Try questions from this topic to strengthen your skills.</p>
                      <button type="button" className="btn rail-cta-btn" onClick={() => setActiveTab('question')}>
                        Start Practice →
                      </button>
                      <Link className="btn ghost rail-cta-btn mock-rail-link" to="/mock-generator">
                        Build a Mock Paper →
                      </Link>
                    </article>
                  </>
                )
              })()}
            </aside>
          </div>
        )}
      </section>
      {activeSolutionItem ? (
        <section className="solution-modal-overlay" role="dialog" aria-modal="true" onClick={closeSolution}>
          <article className="solution-modal" onClick={(event) => event.stopPropagation()}>
            <div className="solution-modal-head">
              <h3>Solution</h3>
              <button type="button" className="icon-back-btn" onClick={closeSolution} aria-label="Close solution popup">
                ×
              </button>
            </div>
            <h4 className="question-number-title">Question {activeSolutionItem.questionNumber || ''}</h4>
            {activeSolutionItem.solution && !contentBlocksHaveMediaOrText(activeSolutionItem.solutionBlocks) ? (
              <div className="solution-box">
                <LatexText value={activeSolutionItem.solution} className="latex-text" />
              </div>
            ) : null}
            {contentBlocksHaveMediaOrText(activeSolutionItem.solutionBlocks)
              ? renderContentBlocks(activeSolutionItem.solutionBlocks, `sol-${activeSolutionItem.id || activeSolutionItem.questionNumber || 'question'}`)
              : null}
            {activeSolutionItem.solutionImageUrl ? (
              <div className="content-image-block">
                <button
                  type="button"
                  className="image-open-btn"
                  onClick={() => setExpandedImageUrl(activeSolutionItem.solutionImageUrl)}
                  aria-label="Open solution image in full view"
                >
                  <img src={activeSolutionItem.solutionImageUrl} alt="Solution visual" />
                </button>
              </div>
            ) : null}
            {activeSolutionItem.solutionVideoLink && toYouTubeEmbedUrl(activeSolutionItem.solutionVideoLink) ? (
              <div className="solution-video-wrap">
                <h4>Video Solution</h4>
                <iframe
                  title={`video-solution-${activeSolutionItem.id || activeSolutionItem.questionNumber || 'question'}`}
                  src={toYouTubeEmbedUrl(activeSolutionItem.solutionVideoLink)}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ) : null}
          </article>
        </section>
      ) : null}
      {expandedImageUrl ? (
        <section className="image-zoom-overlay" role="dialog" aria-modal="true" onClick={() => setExpandedImageUrl('')}>
          <article className="image-zoom-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="icon-back-btn image-zoom-close" onClick={() => setExpandedImageUrl('')} aria-label="Close image view">
              ×
            </button>
            <img src={expandedImageUrl} alt="Expanded content" />
          </article>
        </section>
      ) : null}
    </main>
  )
}

function MockGeneratorPage({ user, authReady, cachedProfile }) {
  const [loginPending, setLoginPending] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [curriculum, setCurriculum] = useState(null)
  const [questionPool, setQuestionPool] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [selectedCourseSlug, setSelectedCourseSlug] = useState('ibdp-aa')
  const [selectedLevel, setSelectedLevel] = useState(() => getMockBlueprint('ibdp-aa').defaultLevel)
  const [selectedUnitIds, setSelectedUnitIds] = useState([])
  const [paperSettings, setPaperSettings] = useState(() =>
    createDefaultMockPaperSettings(getMockPapersForCourse('ibdp-aa', 'hl')),
  )
  const [generatedPapers, setGeneratedPapers] = useState(null)
  const [activePaperId, setActivePaperId] = useState('p1')
  const [buildError, setBuildError] = useState('')
  const [activeSolutionItem, setActiveSolutionItem] = useState(null)
  const [expandedImageUrl, setExpandedImageUrl] = useState('')
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(0)

  const selectedCourse = courseCatalog.find((item) => item.slug === selectedCourseSlug) || courseCatalog[0]
  const blueprint = getMockBlueprint(selectedCourseSlug)
  const availableLevels = blueprint.levels || []
  const activePapers = useMemo(
    () => getMockPapersForCourse(selectedCourseSlug, selectedLevel),
    [selectedCourseSlug, selectedLevel],
  )
  const units = curriculum?.units ?? []

  function resetPaperSettingsFor(courseSlug, level) {
    const papers = getMockPapersForCourse(courseSlug, level)
    setPaperSettings(createDefaultMockPaperSettings(papers))
  }

  useEffect(() => {
    let active = true

    async function loadMockBank() {
      if (!user || !selectedCourse?.curriculumId) return
      setLoading(true)
      setLoadError('')
      setGeneratedPapers(null)
      setBuildError('')

      try {
        const [curriculaData, fetchedRecords] = await Promise.all([
          getCachedAppDoc('curricula', curriculaDocRef),
          getCachedContentItems(),
        ])
        const courses = ensureRequiredCurricula(curriculaData?.courses)
        const matchedCurriculum = courses.find((item) => item.id === selectedCourse.curriculumId) || null

        const questions = fetchedRecords
          .filter((item) => item.curriculumId === selectedCourse.curriculumId && item.itemType === 'question')

        if (!active) return
        setCurriculum(matchedCurriculum)
        setQuestionPool(questions)
        setSelectedUnitIds([])
        const nextLevel = getMockBlueprint(selectedCourse.slug).defaultLevel
        setSelectedLevel(nextLevel)
        resetPaperSettingsFor(selectedCourse.slug, nextLevel)
      } catch (error) {
        if (!active) return
        setLoadError(error?.message || 'Unable to load questions for the mock generator.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadMockBank()
    return () => {
      active = false
    }
  }, [user, selectedCourse?.curriculumId, selectedCourse?.slug])

  useEffect(() => {
    if (!timerRunning) return undefined
    if (timerSecondsLeft <= 0) {
      setTimerRunning(false)
      return undefined
    }
    const id = window.setInterval(() => {
      setTimerSecondsLeft((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [timerRunning, timerSecondsLeft])

  async function startGoogleLogin() {
    setLoginPending(true)
    setLoginError('')
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    try {
      await setPersistence(auth, browserLocalPersistence)
      await signInWithPopup(auth, provider)
    } catch (error) {
      setLoginError(error?.message?.replace('Firebase: ', '') || 'Unable to complete Google sign-in.')
    } finally {
      setLoginPending(false)
    }
  }

  function toggleUnit(unitId) {
    setSelectedUnitIds((prev) => (prev.includes(unitId) ? prev.filter((id) => id !== unitId) : [...prev, unitId]))
  }

  function updatePaperSetting(paperId, patch) {
    setPaperSettings((prev) => ({
      ...prev,
      [paperId]: {
        ...prev[paperId],
        ...patch,
      },
    }))
  }

  function setPaperEnabled(paperId, enabled) {
    updatePaperSetting(paperId, { enabled })
  }

  function onTargetMarksChange(paper, rawValue) {
    const cleaned = String(rawValue ?? '').replace(/[^\d]/g, '')
    if (cleaned === '') {
      updatePaperSetting(paper.id, { targetMarks: '' })
      return
    }
    const next = Number(cleaned)
    if (!Number.isFinite(next)) return
    updatePaperSetting(paper.id, { targetMarks: Math.min(300, next) })
  }

  function matchesSelectedLevel(question) {
    if (selectedCourseSlug !== 'ibdp-aa') return true
    const level = String(question.questionLevel || '').trim().toLowerCase()
    if (selectedLevel === 'sl') {
      return !level || level === 'sl'
    }
    // HL papers can use SL + HL items; P3 still prefers HL via preferHl.
    return true
  }

  function getPoolForPaper(paperDef) {
    const unitFiltered = questionPool.filter((question) => {
      if (!selectedUnitIds.includes(question.unitId)) return false
      if (!matchesSelectedLevel(question)) return false
      return normalizeGdc(question.gdc) === paperDef.gdc
    })

    if (!paperDef.preferHl) return unitFiltered

    const hlOnly = unitFiltered.filter((question) => String(question.questionLevel || '').toLowerCase() === 'hl')
    return hlOnly.length > 0 ? hlOnly : unitFiltered
  }

  function renderMockContentBlocks(blocks, keyPrefix) {
    const normalizedBlocks = normalizeContentBlocks(blocks)
    if (normalizedBlocks.length === 0) return null
    return (
      <div className="content-blocks-render">
        {normalizedBlocks.map((block, index) =>
          block.type === 'image' ? (
            <div className="content-image-block" key={`${keyPrefix}-img-${index}`}>
              <button
                type="button"
                className="image-open-btn"
                onClick={() => setExpandedImageUrl(block.imageUrl)}
                aria-label="Open image in full view"
              >
                <img src={block.imageUrl} alt={block.caption || 'Content visual'} style={getContentBlockImageStyle(block)} />
              </button>
              {block.caption ? <small className="content-block-caption">{block.caption}</small> : null}
            </div>
          ) : (
            <LatexText key={`${keyPrefix}-txt-${index}`} value={block.text} className="latex-text" />
          ),
        )}
      </div>
    )
  }

  function buildMock() {
    setBuildError('')
    if (selectedUnitIds.length === 0) {
      setBuildError('Select at least one unit to include in your mock.')
      return
    }

    const enabledPapers = activePapers.filter((paper) => Boolean(paperSettings[paper.id]?.enabled))
    if (enabledPapers.length === 0) {
      setBuildError('Enable at least one paper — a single paper is fine.')
      return
    }

    const usedIds = new Set()
    const nextPapers = []
    const shortages = []

    enabledPapers.forEach((paperDef) => {
      const settings = paperSettings[paperDef.id]
      const targetMarks = Math.max(1, Number(settings.targetMarks) || paperDef.fullMarks)
      const minutes = minutesFromTargetMarks(paperDef, targetMarks)
      const available = getPoolForPaper(paperDef).filter((question) => !usedIds.has(question.id))
      const picked = sampleQuestionsToMarks(available, targetMarks)
      picked.forEach((question) => usedIds.add(question.id))
      const totalMarks = picked.reduce((sum, question) => sum + (Number(question.marks) || 0), 0)

      if (totalMarks < targetMarks * 0.75) {
        shortages.push(`${paperDef.label}: ${totalMarks}/${targetMarks} marks available`)
      }

      nextPapers.push({
        id: paperDef.id,
        label: paperDef.label,
        shortLabel: paperDef.shortLabel,
        gdc: paperDef.gdc,
        hint: paperDef.hint,
        minutes,
        targetMarks,
        questions: picked,
        totalMarks,
      })
    })

    if (nextPapers.every((paper) => paper.questions.length === 0)) {
      setBuildError('No matching questions found for the selected course, level, units, and paper type.')
      return
    }

    if (shortages.length) {
      setBuildError(`Built with limited bank coverage — ${shortages.join('; ')}.`)
    }

    const levelLabel = availableLevels.find((item) => item.id === selectedLevel)?.label
    setGeneratedPapers({
      courseTitle: selectedCourse.title,
      levelLabel: levelLabel || '',
      unitIds: [...selectedUnitIds],
      unitNames: units.filter((unit) => selectedUnitIds.includes(unit.id)).map((unit) => unit.name),
      createdAt: new Date().toISOString(),
      papers: nextPapers,
    })
    setActivePaperId(nextPapers[0]?.id || activePapers[0]?.id || 'p1')
    setTimerRunning(false)
    setTimerSecondsLeft((nextPapers[0]?.minutes || 0) * 60)
  }

  function startPaperTimer(paper) {
    setActivePaperId(paper.id)
    setTimerSecondsLeft(paper.minutes * 60)
    setTimerRunning(true)
  }

  const activeGeneratedPaper = generatedPapers?.papers?.find((paper) => paper.id === activePaperId) || generatedPapers?.papers?.[0]

  if (!authReady) {
    return (
      <main className="site mock-page site-full">
        <SiteHeader user={user} cachedProfile={cachedProfile} />
        <section className="mock-shell">
          <p>Checking your session...</p>
        </section>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="site mock-page site-full">
        <SiteHeader user={user} cachedProfile={cachedProfile} />
        <section className="mock-shell">
          <article className="auth-card mock-auth-card">
            <p className="eyebrow">Mock Generator</p>
            <h1>Build a custom exam paper</h1>
            <p>Sign in to pick a course, level, and units, then generate paper-style mocks from your question bank.</p>
            <button type="button" className="btn primary" onClick={startGoogleLogin} disabled={loginPending}>
              {loginPending ? 'Signing in...' : 'Continue with Google'}
            </button>
            {loginError ? <p className="error-text">{loginError}</p> : null}
          </article>
        </section>
      </main>
    )
  }

  return (
    <main className="site mock-page site-full">
      <SiteHeader user={user} cachedProfile={cachedProfile} />

      <section className="mock-shell">
        <div className="mock-page-head">
          <div>
            <p className="eyebrow">Exam Builder</p>
            <h1>Custom Mock Generator</h1>
          </div>
          {generatedPapers ? (
            <button
              type="button"
              className="btn mock-secondary-btn"
              onClick={() => {
                setGeneratedPapers(null)
                setBuildError('')
                setTimerRunning(false)
              }}
            >
              ← Edit setup
            </button>
          ) : null}
        </div>

        {loading ? <p>Loading question bank...</p> : null}
        {loadError ? <p className="error-text">{loadError}</p> : null}

        {!loading && !loadError && !generatedPapers ? (
          <div className="mock-builder-grid">
            <article className="mock-panel">
              <h2>1. Course, level &amp; units</h2>
              <label className="mock-field">
                <span>Course</span>
                <select
                  value={selectedCourseSlug}
                  onChange={(event) => {
                    const nextSlug = event.target.value
                    const nextLevel = getMockBlueprint(nextSlug).defaultLevel
                    setSelectedCourseSlug(nextSlug)
                    setSelectedLevel(nextLevel)
                    setSelectedUnitIds([])
                    resetPaperSettingsFor(nextSlug, nextLevel)
                  }}
                >
                  {courseCatalog.map((course) => (
                    <option key={course.slug} value={course.slug}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </label>

              {availableLevels.length > 0 ? (
                <div className="mock-level-row" role="group" aria-label="Course level">
                  <span>Level</span>
                  <div className="mock-level-chips">
                    {availableLevels.map((level) => (
                      <button
                        key={level.id}
                        type="button"
                        className={`mock-level-chip ${selectedLevel === level.id ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedLevel(level.id)
                          resetPaperSettingsFor(selectedCourseSlug, level.id)
                          setBuildError('')
                        }}
                      >
                        {level.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mock-unit-list">
                {units.length === 0 ? (
                  <p className="muted-text">No units found for this course.</p>
                ) : (
                  units.map((unit, index) => {
                    const checked = selectedUnitIds.includes(unit.id)
                    const unitQuestionCount = questionPool.filter((question) => {
                      if (question.unitId !== unit.id) return false
                      if (selectedCourseSlug !== 'ibdp-aa') return true
                      const level = String(question.questionLevel || '').trim().toLowerCase()
                      if (selectedLevel === 'sl') return !level || level === 'sl'
                      return true
                    }).length
                    return (
                      <label className={`mock-unit-option ${checked ? 'active' : ''}`} key={unit.id}>
                        <input type="checkbox" checked={checked} onChange={() => toggleUnit(unit.id)} />
                        <span>
                          <strong>
                            Unit {index + 1}
                            {unit.name ? ` · ${unit.name.replace(/^Topic\s+\d+:\s*/i, '')}` : ''}
                          </strong>
                          <small>{unitQuestionCount} matching questions</small>
                        </span>
                      </label>
                    )
                  })
                )}
              </div>
              <div className="mock-unit-actions">
                <button
                  type="button"
                  className="btn mock-secondary-btn"
                  onClick={() => setSelectedUnitIds(units.map((unit) => unit.id))}
                  disabled={!units.length}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="btn mock-secondary-btn"
                  onClick={() => setSelectedUnitIds([])}
                  disabled={!selectedUnitIds.length}
                >
                  Clear
                </button>
              </div>
            </article>

            <article className="mock-panel">
              <h2>2. Papers · marks · time</h2>
              <div className="mock-paper-settings">
                {activePapers.map((paperDef) => {
                  const settings = paperSettings[paperDef.id] || {
                    enabled: false,
                    targetMarks: paperDef.fullMarks,
                  }
                  const marksValue = settings.targetMarks === '' || settings.targetMarks == null ? '' : String(settings.targetMarks)
                  const autoMinutes = minutesFromTargetMarks(
                    paperDef,
                    Number(settings.targetMarks) > 0 ? settings.targetMarks : paperDef.fullMarks,
                  )
                  const available = selectedUnitIds.length ? getPoolForPaper(paperDef).length : 0
                  const availableMarks = selectedUnitIds.length
                    ? getPoolForPaper(paperDef).reduce((sum, question) => sum + (Number(question.marks) || 0), 0)
                    : 0
                  return (
                    <div className={`mock-paper-row ${settings.enabled ? 'enabled' : ''}`} key={paperDef.id}>
                      <label className="mock-paper-toggle">
                        <input
                          type="checkbox"
                          checked={Boolean(settings.enabled)}
                          onChange={(event) => setPaperEnabled(paperDef.id, event.target.checked)}
                        />
                        <span>
                          <strong>{paperDef.label}</strong>
                          <small>
                            {paperDef.hint} · full paper {paperDef.fullMarks} marks / {paperDef.fullMinutes} min
                          </small>
                        </span>
                      </label>
                      <label className="mock-field compact">
                        <span>Target marks</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          autoComplete="off"
                          placeholder={String(paperDef.fullMarks)}
                          value={marksValue}
                          disabled={!settings.enabled}
                          onChange={(event) => onTargetMarksChange(paperDef, event.target.value)}
                        />
                      </label>
                      <p className={`mock-auto-time ${settings.enabled ? '' : 'dimmed'}`}>
                        <span>Time</span>
                        <strong>{autoMinutes} min</strong>
                      </p>
                      <p className="mock-available">
                        {selectedUnitIds.length
                          ? `${available} Q · ${availableMarks} marks in bank`
                          : 'Select units'}
                      </p>
                    </div>
                  )
                })}
              </div>

              {buildError ? <p className="error-text">{buildError}</p> : null}

              <button type="button" className="btn primary mock-build-btn" onClick={buildMock}>
                Generate mock paper
              </button>
            </article>
          </div>
        ) : null}

        {!loading && generatedPapers ? (
          <div className="mock-exam-view">
            <div className="mock-exam-meta">
              <div>
                <p className="eyebrow">
                  {generatedPapers.courseTitle}
                  {generatedPapers.levelLabel ? ` · ${generatedPapers.levelLabel}` : ''}
                </p>
                <h2>Your mock</h2>
                <p>{generatedPapers.unitNames.join(' · ') || 'Selected units'}</p>
              </div>
              <div className="mock-timer-box">
                <span className="mock-timer-label">Timer</span>
                <strong className={timerSecondsLeft === 0 && !timerRunning ? '' : timerSecondsLeft <= 60 ? 'urgent' : ''}>
                  {formatMockClock(timerSecondsLeft)}
                </strong>
                <div className="mock-timer-actions">
                  {activeGeneratedPaper ? (
                    <button type="button" className="btn primary" onClick={() => startPaperTimer(activeGeneratedPaper)}>
                      {timerRunning ? 'Restart' : 'Start'} {activeGeneratedPaper.shortLabel} timer
                    </button>
                  ) : null}
                  {timerRunning ? (
                    <button type="button" className="btn mock-secondary-btn" onClick={() => setTimerRunning(false)}>
                      Pause
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mock-paper-tabs" role="tablist">
              {generatedPapers.papers.map((paper) => (
                <button
                  key={paper.id}
                  type="button"
                  role="tab"
                  className={`mock-paper-tab ${activeGeneratedPaper?.id === paper.id ? 'active' : ''}`}
                  onClick={() => {
                    setActivePaperId(paper.id)
                    if (!timerRunning) setTimerSecondsLeft(paper.minutes * 60)
                  }}
                >
                  {paper.label}
                  <small>
                    {paper.questions.length} Q · {paper.minutes} min · {paper.totalMarks}/{paper.targetMarks} marks
                  </small>
                </button>
              ))}
            </div>

            {activeGeneratedPaper ? (
              <section className="mock-paper-body">
                {activeGeneratedPaper.questions.length === 0 ? (
                  <article className="lesson-card">
                    <h3>No questions available</h3>
                    <p>Add more {activeGeneratedPaper.gdc === 'gdc' ? 'GDC' : 'Not GDC'} questions for the selected units.</p>
                    <button type="button" className="btn mock-secondary-btn" onClick={buildMock}>
                      Reshuffle questions
                    </button>
                  </article>
                ) : (
                  <>
                    <div className="mock-paper-actions">
                      <button type="button" className="btn mock-secondary-btn" onClick={buildMock}>
                        Reshuffle questions
                      </button>
                    </div>
                    {activeGeneratedPaper.questions.map((item, index) => (
                    <article className="lesson-card lesson-card-question" key={`${activeGeneratedPaper.id}-${item.id}`}>
                      <h3 className="question-number-title">Question {index + 1}</h3>
                      <div className="question-meta-row">
                        <span className="meta-chip">{normalizeGdc(item.gdc) === 'gdc' ? 'GDC' : 'No GDC'}</span>
                        <span className="meta-chip">{item.marks || 0} marks</span>
                        {String(item.questionLevel || '').trim() ? (
                          <span className="meta-chip">{String(item.questionLevel).toUpperCase()}</span>
                        ) : null}
                        <span className={`meta-chip difficulty-${String(item.difficulty || 'medium').toLowerCase()}`}>
                          {String(item.difficulty || 'medium')}
                        </span>
                      </div>
                      {contentBlocksHaveMediaOrText(item.descriptionBlocks) ? (
                        renderMockContentBlocks(item.descriptionBlocks, `mock-${item.id}`)
                      ) : (
                        <LatexText value={item.description} className="latex-text" />
                      )}
                      {item.imageUrl ? (
                        <div className="content-image-block">
                          <button
                            type="button"
                            className="image-open-btn"
                            onClick={() => setExpandedImageUrl(item.imageUrl)}
                            aria-label="Open image in full view"
                          >
                            <img src={item.imageUrl} alt="Question visual" style={getRecordImageStyle(item)} />
                          </button>
                        </div>
                      ) : null}
                      {item.solution ||
                      item.solutionVideoLink ||
                      item.solutionImageUrl ||
                      contentBlocksHaveMediaOrText(item.solutionBlocks) ? (
                        <button
                          type="button"
                          className="btn ghost text-btn"
                          onClick={() => setActiveSolutionItem({ ...item, questionNumber: index + 1 })}
                        >
                          View Solution
                        </button>
                      ) : null}
                    </article>
                  ))}
                  </>
                )}
              </section>
            ) : null}
          </div>
        ) : null}
      </section>

      {activeSolutionItem ? (
        <section className="solution-modal-overlay" role="dialog" aria-modal="true" onClick={() => setActiveSolutionItem(null)}>
          <article className="solution-modal" onClick={(event) => event.stopPropagation()}>
            <div className="solution-modal-head">
              <h3>Solution</h3>
              <button type="button" className="icon-back-btn" onClick={() => setActiveSolutionItem(null)} aria-label="Close solution popup">
                ×
              </button>
            </div>
            <h4 className="question-number-title">Question {activeSolutionItem.questionNumber || ''}</h4>
            {activeSolutionItem.solution && !contentBlocksHaveMediaOrText(activeSolutionItem.solutionBlocks) ? (
              <div className="solution-box">
                <LatexText value={activeSolutionItem.solution} className="latex-text" />
              </div>
            ) : null}
            {contentBlocksHaveMediaOrText(activeSolutionItem.solutionBlocks)
              ? renderMockContentBlocks(activeSolutionItem.solutionBlocks, `mock-sol-${activeSolutionItem.id}`)
              : null}
            {activeSolutionItem.solutionImageUrl ? (
              <div className="content-image-block">
                <button
                  type="button"
                  className="image-open-btn"
                  onClick={() => setExpandedImageUrl(activeSolutionItem.solutionImageUrl)}
                  aria-label="Open solution image in full view"
                >
                  <img src={activeSolutionItem.solutionImageUrl} alt="Solution visual" />
                </button>
              </div>
            ) : null}
            {activeSolutionItem.solutionVideoLink && toYouTubeEmbedUrl(activeSolutionItem.solutionVideoLink) ? (
              <div className="solution-video-wrap">
                <h4>Video Solution</h4>
                <iframe
                  title={`mock-video-solution-${activeSolutionItem.id}`}
                  src={toYouTubeEmbedUrl(activeSolutionItem.solutionVideoLink)}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ) : null}
          </article>
        </section>
      ) : null}

      {expandedImageUrl ? (
        <section className="image-zoom-overlay" role="dialog" aria-modal="true" onClick={() => setExpandedImageUrl('')}>
          <article className="image-zoom-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="icon-back-btn image-zoom-close" onClick={() => setExpandedImageUrl('')} aria-label="Close image view">
              ×
            </button>
            <img src={expandedImageUrl} alt="Expanded content" />
          </article>
        </section>
      ) : null}
    </main>
  )
}

function StudyQuestionList({ title, subtitle, items, emptyTitle, emptyBody, onRemove, removingId }) {
  return (
    <section className="profile-section">
      <div className="profile-section-head">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {items.length === 0 ? (
        <div className="profile-empty">
          <h3>{emptyTitle}</h3>
          <p>{emptyBody}</p>
        </div>
      ) : (
        <div className="study-question-list">
          {items.map((entry) => {
            const href = questionStudyPath(entry)
            return (
              <article className="study-question-card" key={entry.questionId}>
                <div>
                  <p className="study-question-kicker">
                    {[entry.courseTitle || entry.courseSlug, entry.unitName, entry.subunit]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <p className="study-question-preview">{entry.preview || 'Saved question'}</p>
                  <div className="question-meta-row">
                    <span className="meta-chip">{entry.gdc === 'gdc' ? 'GDC' : 'No GDC'}</span>
                    {entry.marks ? <span className="meta-chip">{entry.marks} marks</span> : null}
                    {entry.questionLevel ? (
                      <span className="meta-chip">{String(entry.questionLevel).toUpperCase()}</span>
                    ) : null}
                    {entry.difficulty ? (
                      <span className={`meta-chip difficulty-${entry.difficulty}`}>{entry.difficulty}</span>
                    ) : null}
                  </div>
                </div>
                <div className="study-question-actions">
                  {href ? (
                    <Link className="my-course-link" to={href}>
                      Open question →
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    className="btn ghost text-btn"
                    onClick={() => onRemove(entry)}
                    disabled={removingId === entry.questionId}
                  >
                    Remove
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function SimilarPracticeSection({ groups, empty = false }) {
  if (empty) {
    return (
      <section className="profile-section">
        <div className="profile-section-head">
          <h2>Similar practice</h2>
          <p>Based on questions you marked wrong, grouped by topic.</p>
        </div>
        <div className="profile-empty">
          <h3>No similar questions yet</h3>
          <p>We will suggest nearby questions in these topics as more are added to the bank.</p>
        </div>
      </section>
    )
  }

  if (!groups?.length) return null

  return (
    <section className="profile-section">
      <div className="profile-section-head">
        <h2>Similar practice</h2>
        <p>Based on questions you marked wrong, grouped by topic.</p>
      </div>
      <div className="similar-topic-list">
        {groups.map((group) => (
          <article className="similar-topic-card" key={group.topicKey}>
            <div className="similar-topic-head">
              <h3>{group.topicLabel}</h3>
              <p>
                {group.wrongCount} mistake{group.wrongCount === 1 ? '' : 's'}
                {group.courseTitle ? ` in ${group.courseTitle}` : ''}
              </p>
            </div>
            <div className="study-question-list">
              {group.suggestions.map((entry) => {
                const href = questionStudyPath(entry)
                return (
                  <article className="study-question-card" key={entry.questionId}>
                    <div>
                      <p className="study-question-kicker">
                        {[entry.courseTitle || entry.courseSlug, entry.subunit].filter(Boolean).join(' · ')}
                      </p>
                      <p className="study-question-preview">{entry.preview || 'Practice question'}</p>
                      <div className="question-meta-row">
                        <span className="meta-chip">{entry.gdc === 'gdc' ? 'GDC' : 'No GDC'}</span>
                        {entry.marks ? <span className="meta-chip">{entry.marks} marks</span> : null}
                        {entry.questionLevel ? (
                          <span className="meta-chip">{String(entry.questionLevel).toUpperCase()}</span>
                        ) : null}
                        {entry.difficulty ? (
                          <span className={`meta-chip difficulty-${entry.difficulty}`}>{entry.difficulty}</span>
                        ) : null}
                      </div>
                    </div>
                    {href ? (
                      <Link className="my-course-link" to={href}>
                        Open question →
                      </Link>
                    ) : null}
                  </article>
                )
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function ProfilePage({ user, cachedProfile }) {
  const [myCourses, setMyCourses] = useState([])
  const [lastViewedCourse, setLastViewedCourse] = useState(null)
  const [savedQuestions, setSavedQuestions] = useState([])
  const [wrongQuestions, setWrongQuestions] = useState([])
  const [suggestionGroups, setSuggestionGroups] = useState([])
  const [questionBank, setQuestionBank] = useState([])
  const [curricula, setCurricula] = useState([])
  const [isLoadingCourses, setIsLoadingCourses] = useState(true)
  const [studyBusyId, setStudyBusyId] = useState('')

  function nextSuggestionGroups(wrongList, bank = questionBank, courseList = curricula) {
    return suggestSimilarQuestionsByTopic({
      wrongQuestions: wrongList,
      bankItems: bank,
      courses: courseCatalog,
      curricula: courseList,
    })
  }

  useEffect(() => {
    let active = true

    async function loadStudyHome() {
      if (!user) return
      setIsLoadingCourses(true)

      try {
        const [progressSnap, bankItems, curriculaData] = await Promise.all([
          getDoc(doc(db, 'userCourseProgress', user.uid)),
          getCachedContentItems(),
          getCachedAppDoc('curricula', curriculaDocRef),
        ])
        const nextCurricula = ensureRequiredCurricula(curriculaData?.courses)
        const data = progressSnap.exists() ? progressSnap.data() || {} : {}
        const nextWrong = normalizeStudyList(data.wrongQuestions)
        if (!active) return
        setQuestionBank(Array.isArray(bankItems) ? bankItems : [])
        setCurricula(nextCurricula)
        setMyCourses(resolveMyCourses(data))
        setLastViewedCourse(resolveLastViewedCourse(data))
        setSavedQuestions(normalizeStudyList(data.savedQuestions))
        setWrongQuestions(nextWrong)
        setSuggestionGroups(
          suggestSimilarQuestionsByTopic({
            wrongQuestions: nextWrong,
            bankItems,
            courses: courseCatalog,
            curricula: nextCurricula,
          }),
        )
      } catch {
        if (active) {
          setMyCourses([])
          setLastViewedCourse(null)
          setSavedQuestions([])
          setWrongQuestions([])
          setSuggestionGroups([])
        }
      } finally {
        if (active) setIsLoadingCourses(false)
      }
    }

    loadStudyHome()

    return () => {
      active = false
    }
  }, [user])

  async function removeStudyQuestion(listKey, entry) {
    if (!user || !entry?.questionId) return
    setStudyBusyId(entry.questionId)
    try {
      const next = await toggleStudyQuestion({ user, listKey, entry, currentlySaved: true })
      if (listKey === SAVED_QUESTIONS_KEY) {
        setSavedQuestions(next)
      } else {
        setWrongQuestions(next)
        setSuggestionGroups(nextSuggestionGroups(next))
      }
    } catch {
      // Keep the list as-is if the write fails.
    } finally {
      setStudyBusyId('')
    }
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  const profileInitial =
    user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || cachedProfile?.email?.[0]?.toUpperCase() || 'S'
  const profileName = user.displayName || cachedProfile?.displayName || user.email?.split('@')[0] || 'Student'
  const continueHref = lastViewedCourse ? courseContinuePath(lastViewedCourse) : '/#programs'

  return (
    <main className="site profile-page site-full">
      <SiteHeader user={user} cachedProfile={cachedProfile} />

      <section className="profile-hero">
        <div className="profile-hero-inner">
          <div className="profile-identity">
            <div className="profile-avatar" aria-hidden="true">
              {profileInitial}
            </div>
            <div>
              <p className="eyebrow">Study home</p>
              <h1>{profileName}</h1>
              <p className="profile-email">{user.email}</p>
            </div>
          </div>
          <button className="btn ghost profile-logout-btn" type="button" onClick={() => signOut(auth)}>
            Logout
          </button>
        </div>
      </section>

      {lastViewedCourse ? (
        <section className="profile-section">
          <article className="continue-study-card">
            <div>
              <p className="eyebrow">Continue</p>
              <h2>{lastViewedCourse.title || lastViewedCourse.slug}</h2>
              <p>
                {lastViewedCourse.lastViewedSubunit
                  ? `Pick up ${lastViewedCourse.lastViewedSubunit}.`
                  : 'Pick up where you left off.'}
              </p>
            </div>
            <Link className="btn primary" to={continueHref}>
              Continue →
            </Link>
          </article>
        </section>
      ) : null}

      <section className="profile-section">
        <div className="profile-section-head">
          <h2>My Courses</h2>
          <p>Pick up where you left off across your active pathways.</p>
        </div>
        {isLoadingCourses ? (
          <p>Loading your courses...</p>
        ) : myCourses.length === 0 ? (
          <div className="profile-empty">
            <h3>No courses yet</h3>
            <p>Browse the catalog and start a pathway to see it here.</p>
            <Link className="btn primary" to="/#programs">
              Explore Programs
            </Link>
          </div>
        ) : (
          <div className="my-courses-grid">
            {myCourses.map((courseEntry) => (
              <article className="my-course-card" key={`${courseEntry.slug}-${courseEntry.updatedAt || ''}`}>
                <div className="my-course-card-top">
                  <span className="my-course-icon" aria-hidden="true">
                    ∑
                  </span>
                  <div>
                    <h3>{courseEntry.title || courseEntry.slug}</h3>
                    <p>{courseEntry.visitedSubunitsCount || 0} subunits covered</p>
                  </div>
                </div>
                <Link className="my-course-link" to={courseContinuePath(courseEntry)}>
                  Continue Course →
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      {isLoadingCourses ? (
        <section className="profile-section">
          <p>Loading your saved questions...</p>
        </section>
      ) : (
        <>
          <StudyQuestionList
            title="Bookmarks"
            subtitle="Questions you bookmarked from the question bank."
            items={savedQuestions}
            emptyTitle="No bookmarks yet"
            emptyBody="Open a question and tap the bookmark icon to keep it here."
            onRemove={(entry) => removeStudyQuestion(SAVED_QUESTIONS_KEY, entry)}
            removingId={studyBusyId}
          />

          <StudyQuestionList
            title="Mistakes"
            subtitle="Questions you marked wrong to review later."
            items={wrongQuestions}
            emptyTitle="No mistakes saved"
            emptyBody="Tap the × on a question to add it to this list."
            onRemove={(entry) => removeStudyQuestion(WRONG_QUESTIONS_KEY, entry)}
            removingId={studyBusyId}
          />

          {wrongQuestions.length > 0 ? (
            <SimilarPracticeSection groups={suggestionGroups} empty={suggestionGroups.length === 0} />
          ) : null}
        </>
      )}

      <section className="profile-section">
        <div className="profile-section-head">
          <h2>Quick Links</h2>
          <p>Shortcuts to keep your study flow moving.</p>
        </div>
        <div className="quick-links-grid">
          <Link className="quick-link-card" to="/#programs">
            <span className="quick-link-icon" aria-hidden="true">
              ▦
            </span>
            <div>
              <h3>Explore Catalog</h3>
              <p>Discover new tracks and masterclasses.</p>
            </div>
            <span className="quick-link-arrow" aria-hidden="true">
              →
            </span>
          </Link>
          <Link className="quick-link-card" to="/mock-generator">
            <span className="quick-link-icon" aria-hidden="true">
              ▤
            </span>
            <div>
              <h3>Mock Generator</h3>
              <p>Build P1 / P2 / P3 papers from selected units.</p>
            </div>
            <span className="quick-link-arrow" aria-hidden="true">
              →
            </span>
          </Link>
          <Link className="quick-link-card" to="/ia">
            <span className="quick-link-icon" aria-hidden="true">
              ◎
            </span>
            <div>
              <h3>Internal Assessment</h3>
              <p>Sample IAs, topic ideas, and guidance.</p>
            </div>
            <span className="quick-link-arrow" aria-hidden="true">
              →
            </span>
          </Link>
        </div>
      </section>
    </main>
  )
}

function AdminPasscodeGate({ setUnlocked }) {
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState('')
  const isAdminPasscodeConfigured = Boolean(adminPasscode)

  function unlock() {
    if (!isAdminPasscodeConfigured) {
      setError('Admin passcode is not configured. Add VITE_ADMIN_PASSCODE in .env.local.')
      return
    }
    if (passcode === adminPasscode) {
      sessionStorage.setItem(adminPasscodeKey, 'true')
      setUnlocked(true)
      setError('')
      return
    }
    setError('Incorrect passcode.')
  }

  return (
    <section className="panel passcode-card">
      <h2>Admin Passcode</h2>
      <p>Enter passcode to open dashboard controls.</p>
      <input
        type="password"
        placeholder="Admin passcode"
        value={passcode}
        onChange={(event) => setPasscode(event.target.value)}
      />
      {!isAdminPasscodeConfigured ? <p className="error-text">Admin passcode is not configured.</p> : null}
      {error && <p className="error-text">{error}</p>}
      <button className="btn primary" type="button" onClick={unlock} disabled={!isAdminPasscodeConfigured}>
        Unlock Admin
      </button>
    </section>
  )
}

function EditorPasscodeGate({ setUnlocked }) {
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState('')
  const isEditorPasscodeConfigured = Boolean(editorPasscode)

  function unlock() {
    if (!isEditorPasscodeConfigured) {
      setError('Editor passcode is not configured. Add VITE_EDITOR_PASSCODE in .env.local.')
      return
    }
    if (passcode === editorPasscode) {
      sessionStorage.setItem(editorPasscodeKey, 'true')
      setUnlocked(true)
      setError('')
      return
    }
    setError('Incorrect passcode.')
  }

  return (
    <section className="panel passcode-card">
      <h2>Content Editor Access</h2>
      <p>Enter the editor passcode. This account can only add new lessons and questions.</p>
      <input
        type="password"
        placeholder="Editor passcode"
        value={passcode}
        onChange={(event) => setPasscode(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') unlock()
        }}
      />
      {!isEditorPasscodeConfigured ? <p className="error-text">Editor passcode is not configured.</p> : null}
      {error && <p className="error-text">{error}</p>}
      <button className="btn primary" type="button" onClick={unlock} disabled={!isEditorPasscodeConfigured}>
        Unlock Editor
      </button>
    </section>
  )
}

function ProtectedAdmin() {
  const [passcodeUnlocked, setPasscodeUnlocked] = useState(() => sessionStorage.getItem(adminPasscodeKey) === 'true')

  if (!passcodeUnlocked) {
    return (
      <main className="admin site-full">
        <AdminPasscodeGate setUnlocked={setPasscodeUnlocked} />
      </main>
    )
  }

  return <AdminPage mode="admin" />
}

function ProtectedEditor() {
  const [passcodeUnlocked, setPasscodeUnlocked] = useState(() => sessionStorage.getItem(editorPasscodeKey) === 'true')
  const [authUser, setAuthUser] = useState(() => auth.currentUser)
  const [authReady, setAuthReady] = useState(false)
  const [loginPending, setLoginPending] = useState(false)
  const [loginError, setLoginError] = useState('')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setAuthUser(nextUser)
      setAuthReady(true)
    })
    return unsubscribe
  }, [])

  async function startGoogleLogin() {
    setLoginPending(true)
    setLoginError('')
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    try {
      await setPersistence(auth, browserLocalPersistence)
      await signInWithPopup(auth, provider)
    } catch (error) {
      setLoginError(error?.message?.replace('Firebase: ', '') || 'Unable to complete Google sign-in.')
    } finally {
      setLoginPending(false)
    }
  }

  if (!passcodeUnlocked) {
    return (
      <main className="admin site-full">
        <EditorPasscodeGate setUnlocked={setPasscodeUnlocked} />
      </main>
    )
  }

  if (!authReady) {
    return (
      <main className="admin site-full">
        <section className="panel passcode-card">
          <p>Checking editor session...</p>
        </section>
      </main>
    )
  }

  const signedEmail = String(authUser?.email || '').trim().toLowerCase()
  const isAllowedEditor = Boolean(signedEmail) && signedEmail === editorAllowedEmail

  if (!authUser || !isAllowedEditor) {
    return (
      <main className="admin site-full">
        <section className="panel passcode-card">
          <h2>Editor Google Sign-in</h2>
          <p>
            Sign in with the dedicated content-editor Google account only:
            <br />
            <strong>{editorAllowedEmail}</strong>
          </p>
          {authUser && !isAllowedEditor ? (
            <p className="error-text">
              Signed in as {authUser.email}, which is not the editor account. Sign out and use {editorAllowedEmail}.
            </p>
          ) : null}
          {loginError ? <p className="error-text">{loginError}</p> : null}
          <div className="editor-auth-actions">
            {authUser ? (
              <button type="button" className="btn ghost" onClick={() => signOut(auth)}>
                Sign out
              </button>
            ) : null}
            <button type="button" className="btn primary" onClick={startGoogleLogin} disabled={loginPending}>
              {loginPending ? 'Signing in...' : 'Continue with Google'}
            </button>
          </div>
        </section>
      </main>
    )
  }

  return <AdminPage mode="editor" />
}

function AdminPage({ mode = 'admin' }) {
  const isEditorMode = mode === 'editor'
  const [curricula, setCurricula] = useState(defaultCurricula)
  const [records, setRecords] = useState([])
  const [isDataLoading, setIsDataLoading] = useState(true)
  const [dataError, setDataError] = useState('')
  const [curriculumId, setCurriculumId] = useState(curricula[0]?.id ?? '')
  const [unitId, setUnitId] = useState(curricula[0]?.units[0]?.id ?? '')
  const [subunit, setSubunit] = useState(curricula[0]?.units[0]?.subunits[0] ?? '')
  const [itemType, setItemType] = useState('lesson')
  const [title, setTitle] = useState('')
  const [learningObjectivesText, setLearningObjectivesText] = useState('')
  const [descriptionBlocks, setDescriptionBlocks] = useState(() => [createTextContentBlock('')])
  const [solution, setSolution] = useState('')
  const [solutionBlocks, setSolutionBlocks] = useState([])
  const [solutionVideoLink, setSolutionVideoLink] = useState('')
  const [questionDifficulty, setQuestionDifficulty] = useState('medium')
  const [questionMarks, setQuestionMarks] = useState(1)
  const [questionGdc, setQuestionGdc] = useState('not gdc')
  const [questionLevel, setQuestionLevel] = useState('sl')
  const [geogebraLink, setGeogebraLink] = useState('')
  const [resourceLink, setResourceLink] = useState('')
  const [attachedFileName, setAttachedFileName] = useState('')
  const [selectedImageFile, setSelectedImageFile] = useState(null)
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState('')
  const [solutionImageFile, setSolutionImageFile] = useState(null)
  const [solutionImagePreviewUrl, setSolutionImagePreviewUrl] = useState('')
  const [imageWidthPercent, setImageWidthPercent] = useState(100)
  const [isImageUploading, setIsImageUploading] = useState(false)
  const [bulkQuestionInput, setBulkQuestionInput] = useState('')
  const [isBulkUploading, setIsBulkUploading] = useState(false)
  const [bulkUploadError, setBulkUploadError] = useState('')
  const [bulkUploadSuccess, setBulkUploadSuccess] = useState('')
  const [paywallConfig, setPaywallConfig] = useState(() => normalizePaywallConfig())
  const [paywallCourseId, setPaywallCourseId] = useState(defaultCurricula[0]?.id ?? '')
  const [paywallUnitId, setPaywallUnitId] = useState(defaultCurricula[0]?.units?.[0]?.id ?? '')
  const [paywallSubunit, setPaywallSubunit] = useState(defaultCurricula[0]?.units?.[0]?.subunits?.[0] ?? '')
  const [paywallPriceInput, setPaywallPriceInput] = useState('')
  const [isPaywallSaving, setIsPaywallSaving] = useState(false)
  const [iaItems, setIaItems] = useState([])
  const [teachersResourcesPosts, setTeachersResourcesPosts] = useState([])
  const [adminSelection, setAdminSelection] = useState(curricula[0]?.id ?? '')
  const [iaTitle, setIaTitle] = useState('')
  const [iaCourse, setIaCourse] = useState('IBDP AA HL')
  const [iaTopic, setIaTopic] = useState('')
  const [iaSummary, setIaSummary] = useState('')
  const [iaDescription, setIaDescription] = useState('')
  const [iaLink, setIaLink] = useState('')
  const [iaPreviewPages, setIaPreviewPages] = useState('1')
  const [iaUnlockPrice, setIaUnlockPrice] = useState('')
  const [iaPdfFile, setIaPdfFile] = useState(null)
  const [iaImageFile, setIaImageFile] = useState(null)
  const [iaImagePreviewUrl, setIaImagePreviewUrl] = useState('')
  const [iaExistingPdfUrl, setIaExistingPdfUrl] = useState('')
  const [iaExistingPdfName, setIaExistingPdfName] = useState('')
  const [iaExistingImageUrl, setIaExistingImageUrl] = useState('')
  const [iaExistingImagePath, setIaExistingImagePath] = useState('')
  const [iaExistingPdfPath, setIaExistingPdfPath] = useState('')
  const [editingIaId, setEditingIaId] = useState('')
  const [isIaSaving, setIsIaSaving] = useState(false)
  const [fullSubscriptionPriceInput, setFullSubscriptionPriceInput] = useState(String(FULL_SUBSCRIPTION_DEFAULT_PRICE_INR))
  const [fullSubscriptionDaysInput, setFullSubscriptionDaysInput] = useState(String(FULL_SUBSCRIPTION_DEFAULT_DAYS))
  const [defaultIaUnlockPriceInput, setDefaultIaUnlockPriceInput] = useState('')
  const [resourcePostTitle, setResourcePostTitle] = useState('')
  const [resourcePostDescription, setResourcePostDescription] = useState('')
  const [resourcePostCategory, setResourcePostCategory] = useState('Activities')
  const [resourcePostImageFile, setResourcePostImageFile] = useState(null)
  const [resourcePostImagePreviewUrl, setResourcePostImagePreviewUrl] = useState('')
  const [resourcePostPdfFile, setResourcePostPdfFile] = useState(null)
  const [resourceExistingPdfUrl, setResourceExistingPdfUrl] = useState('')
  const [resourceExistingPdfName, setResourceExistingPdfName] = useState('')
  const [resourceExistingPdfPath, setResourceExistingPdfPath] = useState('')
  const [resourceExistingImageUrl, setResourceExistingImageUrl] = useState('')
  const [resourceExistingImagePath, setResourceExistingImagePath] = useState('')
  const [editingTeachersResourceId, setEditingTeachersResourceId] = useState('')
  const [isTeachersResourcesSaving, setIsTeachersResourcesSaving] = useState(false)
  const [newTopicName, setNewTopicName] = useState('')
  const [newSubtopicName, setNewSubtopicName] = useState('')
  const [renameSubtopicName, setRenameSubtopicName] = useState('')
  const [dragTopicIndex, setDragTopicIndex] = useState(null)
  const [dragSubtopicIndex, setDragSubtopicIndex] = useState(null)
  const [isDeletingTopic, setIsDeletingTopic] = useState(false)
  const [isDeletingSubtopic, setIsDeletingSubtopic] = useState(false)
  const [isRenamingSubtopic, setIsRenamingSubtopic] = useState(false)
  const [storedItemsTab, setStoredItemsTab] = useState('lesson')
  const [dragRecordIndex, setDragRecordIndex] = useState(null)
  const [editingRecordId, setEditingRecordId] = useState('')
  const [editingRecordType, setEditingRecordType] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editLearningObjectivesText, setEditLearningObjectivesText] = useState('')
  const [editDescriptionBlocks, setEditDescriptionBlocks] = useState([])
  const [editSolution, setEditSolution] = useState('')
  const [editSolutionBlocks, setEditSolutionBlocks] = useState([])
  const [editSolutionVideoLink, setEditSolutionVideoLink] = useState('')
  const [editDifficulty, setEditDifficulty] = useState('medium')
  const [editMarks, setEditMarks] = useState(1)
  const [editGdc, setEditGdc] = useState('not gdc')
  const [editQuestionLevel, setEditQuestionLevel] = useState('sl')
  const [editGeogebraLink, setEditGeogebraLink] = useState('')
  const [editResourceLink, setEditResourceLink] = useState('')
  const [editImageWidthPercent, setEditImageWidthPercent] = useState(100)

  const selectedCurriculum = useMemo(
    () => curricula.find((curriculum) => curriculum.id === curriculumId) ?? curricula[0],
    [curricula, curriculumId],
  )
  const isIaManagementSelected = !isEditorMode && adminSelection === adminIaOptionId
  const isTeachersResourcesSelected = !isEditorMode && adminSelection === adminTeachersResourcesOptionId
  const isPricingSelected = !isEditorMode && adminSelection === adminPricingOptionId
  const isCurrentAdminIbdpCourse = curriculumId === 'ibdp-aa-hl' || curriculumId === 'ibdp-ai-hl'
  const selectedUnit = useMemo(
    () => selectedCurriculum?.units.find((unit) => unit.id === unitId) ?? selectedCurriculum?.units[0],
    [selectedCurriculum, unitId],
  )
  const paywallCourse = useMemo(
    () => curricula.find((curriculum) => curriculum.id === paywallCourseId) ?? curricula[0],
    [curricula, paywallCourseId],
  )
  const paywallUnit = useMemo(
    () => paywallCourse?.units.find((unit) => unit.id === paywallUnitId) ?? paywallCourse?.units[0],
    [paywallCourse, paywallUnitId],
  )
  const scopedRecords = records.filter(
    (item) => item.curriculumId === curriculumId && item.unitId === unitId && item.subunit === subunit,
  )
  const sortByStoredOrder = (a, b) => {
    const aOrder = Number.isFinite(Number(a?.sortOrder)) ? Number(a.sortOrder) : Number.MAX_SAFE_INTEGER
    const bOrder = Number.isFinite(Number(b?.sortOrder)) ? Number(b.sortOrder) : Number.MAX_SAFE_INTEGER
    if (aOrder !== bOrder) return aOrder - bOrder
    return String(a?.createdAt || '').localeCompare(String(b?.createdAt || ''))
  }
  const scopedLessons = [...scopedRecords.filter((item) => item.itemType === 'lesson')].sort(sortByStoredOrder)
  const scopedQuestions = [...scopedRecords.filter((item) => item.itemType === 'question')].sort(sortByStoredOrder)
  const activeStoredRecords = storedItemsTab === 'lesson' ? scopedLessons : scopedQuestions

  useEffect(() => {
    setEditingRecordId('')
    setEditingRecordType('')
    setEditTitle('')
    setEditDescriptionBlocks([])
    setEditSolution('')
    setEditSolutionVideoLink('')
    setEditDifficulty('medium')
    setEditMarks(1)
    setEditGdc('not gdc')
    setEditGeogebraLink('')
    setEditResourceLink('')
    setEditImageWidthPercent(100)
    setDragRecordIndex(null)
  }, [curriculumId, unitId, subunit, storedItemsTab])

  useEffect(() => {
    setRenameSubtopicName(subunit || '')
  }, [curriculumId, unitId, subunit])

  function parseSubunitOrder(label) {
    const match = String(label).match(/(?:^|\s)(\d+)\.(\d+)\b/)
    if (!match) return null
    return { major: Number(match[1]), minor: Number(match[2]) }
  }

  function sortSubunitsInNumericOrder(subunits) {
    return [...subunits]
      .map((label, index) => ({ label, index, order: parseSubunitOrder(label) }))
      .sort((a, b) => {
        if (a.order && b.order) {
          if (a.order.major !== b.order.major) return a.order.major - b.order.major
          if (a.order.minor !== b.order.minor) return a.order.minor - b.order.minor
          return a.index - b.index
        }
        if (a.order && !b.order) return -1
        if (!a.order && b.order) return 1
        return a.index - b.index
      })
      .map((item) => item.label)
  }

  function normalizeCurriculaOrdering(nextCurricula) {
    return nextCurricula.map((curriculum) => ({
      ...curriculum,
      units: (curriculum.units || []).map((unit) => ({
        ...unit,
        subunits: sortSubunitsInNumericOrder(unit.subunits || []),
      })),
    }))
  }

  useEffect(() => {
    let active = true

    async function loadAdminData() {
      setIsDataLoading(true)
      setDataError('')
      try {
        const [curriculaData, fetchedRecords, paywallData, iaData, teachersResourcesData] = await Promise.all([
          getCachedAppDoc('curricula', curriculaDocRef),
          getCachedContentItems(),
          getCachedAppDoc('paywall', paywallDocRef),
          getCachedAppDoc('ia', iaDocRef),
          getCachedAppDoc('teachersResources', teachersResourcesDocRef),
        ])
        let courses = defaultCurricula

        if (curriculaData) {
          const savedCourses = curriculaData?.courses
          courses = ensureRequiredCurricula(savedCourses)
          if (JSON.stringify(savedCourses || []) !== JSON.stringify(courses)) {
            await setDoc(curriculaDocRef, { courses })
            writeCachedAppDoc('curricula', { courses })
          }
        } else {
          await setDoc(curriculaDocRef, { courses: defaultCurricula })
          writeCachedAppDoc('curricula', { courses: defaultCurricula })
        }

        const nextPaywallConfig = normalizePaywallConfig(paywallData)
        const nextIaItems = normalizeIaItems(iaData?.items)
        const nextTeachersResourcesPosts = normalizeTeachersResourcesPosts(teachersResourcesData?.items)

        if (!active) return
        setCurricula(courses)
        setRecords([...fetchedRecords].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')))
        setIaItems(nextIaItems)
        setTeachersResourcesPosts(nextTeachersResourcesPosts)
        setCurriculumId(courses[0]?.id ?? '')
        setAdminSelection(courses[0]?.id ?? '')
        setUnitId(courses[0]?.units[0]?.id ?? '')
        setSubunit(courses[0]?.units[0]?.subunits[0] ?? '')
        setPaywallConfig(nextPaywallConfig)
        const initialCourseId = courses[0]?.id ?? ''
        const initialUnit = courses[0]?.units?.[0]
        setPaywallCourseId(initialCourseId)
        setPaywallUnitId(initialUnit?.id ?? '')
        setPaywallSubunit(initialUnit?.subunits?.[0] ?? '')
        setPaywallPriceInput(String(nextPaywallConfig.coursePrices?.[initialCourseId] || ''))
        setFullSubscriptionPriceInput(String(nextPaywallConfig.fullSubscription.priceInr))
        setFullSubscriptionDaysInput(String(nextPaywallConfig.fullSubscription.durationDays))
        setDefaultIaUnlockPriceInput(
          nextPaywallConfig.defaultIaUnlockPriceInr > 0 ? String(nextPaywallConfig.defaultIaUnlockPriceInr) : '',
        )
      } catch (error) {
        if (!active) return
        setDataError(error?.message || 'Unable to load data from Firestore.')
      } finally {
        if (active) setIsDataLoading(false)
      }
    }

    loadAdminData()

    return () => {
      active = false
    }
  }, [])

  async function persistCurricula(updated) {
    if (isEditorMode) {
      setDataError('Content editors cannot change course structure.')
      return
    }
    const normalized = normalizeCurriculaOrdering(updated)
    setCurricula(normalized)
    await setDoc(curriculaDocRef, { courses: normalized })
    writeCachedAppDoc('curricula', { courses: normalized })
  }

  function persistRecords(updated) {
    setRecords(updated)
    writeCachedAppDoc('courseContentItems', updated)
  }

  async function persistPaywall(nextConfig) {
    if (isEditorMode) {
      setDataError('Content editors cannot change paywall settings.')
      return
    }
    setIsPaywallSaving(true)
    setPaywallConfig(nextConfig)
    try {
      await setDoc(paywallDocRef, nextConfig, { merge: true })
      writeCachedAppDoc('paywall', nextConfig)
      setDataError('')
    } catch (error) {
      setDataError(error?.message || 'Unable to save paywall settings.')
    } finally {
      setIsPaywallSaving(false)
    }
  }

  async function persistIaItems(nextItems) {
    if (isEditorMode) {
      setDataError('Content editors cannot manage IA examples.')
      return
    }
    const normalized = normalizeIaItems(nextItems)
    setIaItems(normalized)
    setIsIaSaving(true)
    try {
      await setDoc(iaDocRef, { items: normalized }, { merge: true })
      writeCachedAppDoc('ia', { items: normalized })
      setDataError('')
    } catch (error) {
      setDataError(error?.message || 'Unable to save IA examples.')
    } finally {
      setIsIaSaving(false)
    }
  }

  async function persistTeachersResourcesPosts(nextPosts) {
    if (isEditorMode) {
      setDataError('Content editors cannot manage teachers resources.')
      return
    }
    const normalized = normalizeTeachersResourcesPosts(nextPosts)
    setTeachersResourcesPosts(normalized)
    setIsTeachersResourcesSaving(true)
    try {
      await setDoc(teachersResourcesDocRef, { items: normalized }, { merge: true })
      writeCachedAppDoc('teachersResources', { items: normalized })
      setDataError('')
    } catch (error) {
      setDataError(error?.message || 'Unable to save teachers resources.')
    } finally {
      setIsTeachersResourcesSaving(false)
    }
  }

  function onPaywallCourseChange(nextId) {
    const nextCourse = curricula.find((curriculum) => curriculum.id === nextId)
    const firstUnit = nextCourse?.units?.[0]
    setPaywallCourseId(nextId)
    setPaywallUnitId(firstUnit?.id ?? '')
    setPaywallSubunit(firstUnit?.subunits?.[0] ?? '')
    setPaywallPriceInput(String(paywallConfig.coursePrices?.[nextId] || ''))
  }

  function onPaywallUnitChange(nextId) {
    const nextUnit = paywallCourse?.units?.find((unit) => unit.id === nextId)
    setPaywallUnitId(nextId)
    setPaywallSubunit(nextUnit?.subunits?.[0] ?? '')
  }

  async function saveCoursePrice() {
    const nextPrice = Number(paywallPriceInput || 0)
    const nextConfig = {
      ...paywallConfig,
      coursePrices: {
        ...paywallConfig.coursePrices,
        [paywallCourseId]: nextPrice,
      },
    }
    await persistPaywall(nextConfig)
  }

  async function saveFullSubscriptionSettings() {
    const priceInr = Number(fullSubscriptionPriceInput || 0)
    const durationDays = Number(fullSubscriptionDaysInput || 0)
    if (!Number.isFinite(priceInr) || priceInr <= 0) {
      setDataError('Full subscription price must be greater than 0.')
      return
    }
    if (!Number.isFinite(durationDays) || durationDays <= 0) {
      setDataError('Full subscription duration must be greater than 0 days.')
      return
    }
    const days = Math.floor(durationDays)
    const nextConfig = {
      ...paywallConfig,
      fullSubscription: {
        ...paywallConfig.fullSubscription,
        priceInr,
        durationDays: days,
        label: `Mathelaureate Full Access (${formatAccessDuration(days)})`,
      },
    }
    await persistPaywall(nextConfig)
  }

  async function saveDefaultIaUnlockPrice() {
    const priceInr = Number(defaultIaUnlockPriceInput || 0)
    if (!Number.isFinite(priceInr) || priceInr < 0) {
      setDataError('Default IA unlock price must be a valid number.')
      return
    }
    const nextConfig = {
      ...paywallConfig,
      defaultIaUnlockPriceInr: priceInr,
    }
    await persistPaywall(nextConfig)
  }

  async function toggleUnitLock() {
    const current = paywallConfig.lockedUnits?.[paywallCourseId] || []
    const nextSet = current.includes(paywallUnitId)
      ? current.filter((id) => id !== paywallUnitId)
      : [...current, paywallUnitId]
    const nextConfig = {
      ...paywallConfig,
      lockedUnits: {
        ...paywallConfig.lockedUnits,
        [paywallCourseId]: nextSet,
      },
    }
    await persistPaywall(nextConfig)
  }

  async function toggleSubunitLock() {
    const key = `${paywallUnitId}::${paywallSubunit}`
    const current = paywallConfig.lockedSubunits?.[paywallCourseId] || []
    const nextSet = current.includes(key) ? current.filter((value) => value !== key) : [...current, key]
    const nextConfig = {
      ...paywallConfig,
      lockedSubunits: {
        ...paywallConfig.lockedSubunits,
        [paywallCourseId]: nextSet,
      },
    }
    await persistPaywall(nextConfig)
  }

  function onCurriculumChange(nextId) {
    if (
      isEditorMode &&
      (nextId === adminIaOptionId || nextId === adminTeachersResourcesOptionId || nextId === adminPricingOptionId)
    ) {
      return
    }
    if (nextId === adminIaOptionId || nextId === adminTeachersResourcesOptionId || nextId === adminPricingOptionId) {
      setAdminSelection(nextId)
      return
    }
    const nextCurriculum = curricula.find((curriculum) => curriculum.id === nextId)
    const firstUnit = nextCurriculum?.units[0]
    setAdminSelection(nextId)
    setCurriculumId(nextId)
    setUnitId(firstUnit?.id ?? '')
    setSubunit(firstUnit?.subunits[0] ?? '')
  }

  function onUnitChange(nextId) {
    const nextUnit = selectedCurriculum?.units.find((unit) => unit.id === nextId)
    setUnitId(nextId)
    setSubunit(nextUnit?.subunits[0] ?? '')
  }

  function addTopic(event) {
    event.preventDefault()
    if (!newTopicName.trim()) return

    const newUnit = {
      id: `unit-${Date.now()}`,
      name: newTopicName.trim(),
      subunits: [],
    }
    const updated = curricula.map((curriculum) =>
      curriculum.id === curriculumId ? { ...curriculum, units: [...curriculum.units, newUnit] } : curriculum,
    )
    persistCurricula(updated).catch((error) => setDataError(error?.message || 'Unable to save topic changes.'))
    setUnitId(newUnit.id)
    setSubunit('')
    setNewTopicName('')
  }

  function addSubtopic(event) {
    event.preventDefault()
    if (!newSubtopicName.trim() || !selectedUnit) return

    const label = newSubtopicName.trim()
    const updated = curricula.map((curriculum) => {
      if (curriculum.id !== curriculumId) return curriculum
      return {
        ...curriculum,
        units: curriculum.units.map((unit) =>
          unit.id === unitId ? { ...unit, subunits: sortSubunitsInNumericOrder([...unit.subunits, label]) } : unit,
        ),
      }
    })
    persistCurricula(updated).catch((error) => setDataError(error?.message || 'Unable to save subtopic changes.'))
    setSubunit(label)
    setNewSubtopicName('')
  }

  async function renameSelectedSubtopic(event) {
    event.preventDefault()
    if (!selectedUnit || !subunit) return

    const oldSubunit = String(subunit || '')
    const nextSubunitName = String(renameSubtopicName || '').trim()
    if (!nextSubunitName) {
      setDataError('Enter a subtopic name.')
      return
    }
    if (nextSubunitName === oldSubunit) return
    if ((selectedUnit.subunits || []).some((name) => name === nextSubunitName)) {
      setDataError('A subtopic with this name already exists in this topic.')
      return
    }

    setIsRenamingSubtopic(true)
    setDataError('')
    try {
      const updatedCurricula = curricula.map((curriculum) => {
        if (curriculum.id !== curriculumId) return curriculum
        return {
          ...curriculum,
          units: curriculum.units.map((unit) => {
            if (unit.id !== unitId) return unit
            return {
              ...unit,
              subunits: (unit.subunits || []).map((name) => (name === oldSubunit ? nextSubunitName : name)),
            }
          }),
        }
      })
      await persistCurricula(updatedCurricula)
      setSubunit(nextSubunitName)

      const oldLockKey = `${unitId}::${oldSubunit}`
      const newLockKey = `${unitId}::${nextSubunitName}`
      const nextLockedSubunits = Array.from(
        new Set(
          (paywallConfig.lockedSubunits?.[curriculumId] || []).map((lockKey) => (lockKey === oldLockKey ? newLockKey : lockKey)),
        ),
      )
      const nextPaywallConfig = {
        ...paywallConfig,
        lockedSubunits: {
          ...paywallConfig.lockedSubunits,
          [curriculumId]: nextLockedSubunits,
        },
      }
      await persistPaywall(nextPaywallConfig)

      if (paywallCourseId === curriculumId && paywallUnitId === unitId && paywallSubunit === oldSubunit) {
        setPaywallSubunit(nextSubunitName)
      }

      const recordsToUpdate = records.filter(
        (item) => item.curriculumId === curriculumId && item.unitId === unitId && item.subunit === oldSubunit,
      )
      const updateTimestamp = new Date().toISOString()
      await Promise.all(
        recordsToUpdate.map((item) =>
          setDoc(doc(db, 'courseContentItems', item.id), { subunit: nextSubunitName, updatedAt: updateTimestamp }, { merge: true }),
        ),
      )
      persistRecords(
        records.map((item) =>
          item.curriculumId === curriculumId && item.unitId === unitId && item.subunit === oldSubunit
            ? { ...item, subunit: nextSubunitName, updatedAt: updateTimestamp }
            : item,
        ),
      )
    } catch (error) {
      setDataError(error?.message || 'Unable to rename subtopic.')
    } finally {
      setIsRenamingSubtopic(false)
    }
  }

  function reorderTopics(targetIndex) {
    if (dragTopicIndex === null || dragTopicIndex === targetIndex) return
    const updated = curricula.map((curriculum) => {
      if (curriculum.id !== curriculumId) return curriculum
      return {
        ...curriculum,
        units: moveItem(curriculum.units, dragTopicIndex, targetIndex),
      }
    })
    persistCurricula(updated).catch((error) => setDataError(error?.message || 'Unable to reorder topics.'))
    setDragTopicIndex(null)
  }

  function reorderSubtopics(targetIndex) {
    if (dragSubtopicIndex === null || dragSubtopicIndex === targetIndex || !selectedUnit) return
    const updated = curricula.map((curriculum) => {
      if (curriculum.id !== curriculumId) return curriculum
      return {
        ...curriculum,
        units: curriculum.units.map((unit) => {
          if (unit.id !== unitId) return unit
          return {
            ...unit,
            subunits: moveItem(unit.subunits, dragSubtopicIndex, targetIndex),
          }
        }),
      }
    })
    persistCurricula(updated).catch((error) => setDataError(error?.message || 'Unable to reorder subtopics.'))
    setDragSubtopicIndex(null)
  }

  async function deleteSelectedTopic() {
    if (isEditorMode) {
      setDataError('Content editors cannot delete topics.')
      return
    }
    if (!selectedCurriculum || !unitId) return
    const units = selectedCurriculum.units || []
    if (units.length <= 1) {
      setDataError('At least one topic must remain in a course.')
      return
    }
    const unitToDelete = units.find((unit) => unit.id === unitId)
    if (!unitToDelete) return
    const confirmed = window.confirm(
      `Are you sure you want to delete topic "${unitToDelete.name}" and all its subtopics/content items?\n\nThis cannot be undone.`,
    )
    if (!confirmed) return

    setIsDeletingTopic(true)
    setDataError('')
    try {
      const updatedCurricula = curricula.map((curriculum) => {
        if (curriculum.id !== curriculumId) return curriculum
        return {
          ...curriculum,
          units: curriculum.units.filter((unit) => unit.id !== unitId),
        }
      })
      await persistCurricula(updatedCurricula)

      const nextCurriculum = updatedCurricula.find((curriculum) => curriculum.id === curriculumId)
      const fallbackUnit = nextCurriculum?.units?.[0]
      const fallbackSubunit = fallbackUnit?.subunits?.[0] || ''
      setUnitId(fallbackUnit?.id || '')
      setSubunit(fallbackSubunit)

      const nextLockedUnits = (paywallConfig.lockedUnits?.[curriculumId] || []).filter((lockedUnitId) => lockedUnitId !== unitId)
      const unitPrefix = `${unitId}::`
      const nextLockedSubunits = (paywallConfig.lockedSubunits?.[curriculumId] || []).filter(
        (lockKey) => !String(lockKey).startsWith(unitPrefix),
      )
      const nextPaywallConfig = {
        ...paywallConfig,
        lockedUnits: {
          ...paywallConfig.lockedUnits,
          [curriculumId]: nextLockedUnits,
        },
        lockedSubunits: {
          ...paywallConfig.lockedSubunits,
          [curriculumId]: nextLockedSubunits,
        },
      }
      await persistPaywall(nextPaywallConfig)

      if (paywallCourseId === curriculumId) {
        setPaywallUnitId(fallbackUnit?.id || '')
        setPaywallSubunit(fallbackSubunit)
      }

      const recordsToDelete = records.filter((item) => item.curriculumId === curriculumId && item.unitId === unitId)
      await Promise.all(recordsToDelete.map((item) => deleteDoc(doc(db, 'courseContentItems', item.id))))
      persistRecords(records.filter((item) => !(item.curriculumId === curriculumId && item.unitId === unitId)))
    } catch (error) {
      setDataError(error?.message || 'Unable to delete topic.')
    } finally {
      setIsDeletingTopic(false)
    }
  }

  async function deleteSelectedSubtopic() {
    if (isEditorMode) {
      setDataError('Content editors cannot delete subtopics.')
      return
    }
    if (!selectedCurriculum || !selectedUnit || !subunit) return
    const subunits = selectedUnit.subunits || []
    if (subunits.length <= 1) {
      setDataError('At least one subtopic must remain in a topic.')
      return
    }
    const confirmed = window.confirm(
      `Are you sure you want to delete subtopic "${subunit}" and all its content items?\n\nThis cannot be undone.`,
    )
    if (!confirmed) return

    setIsDeletingSubtopic(true)
    setDataError('')
    try {
      const updatedCurricula = curricula.map((curriculum) => {
        if (curriculum.id !== curriculumId) return curriculum
        return {
          ...curriculum,
          units: curriculum.units.map((unit) =>
            unit.id === unitId ? { ...unit, subunits: unit.subunits.filter((name) => name !== subunit) } : unit,
          ),
        }
      })
      await persistCurricula(updatedCurricula)

      const nextUnit = updatedCurricula.find((curriculum) => curriculum.id === curriculumId)?.units.find((unit) => unit.id === unitId)
      const fallbackSubunit = nextUnit?.subunits?.[0] || ''
      setSubunit(fallbackSubunit)

      const deleteSubunitKey = `${unitId}::${subunit}`
      const nextLockedSubunits = (paywallConfig.lockedSubunits?.[curriculumId] || []).filter(
        (lockKey) => lockKey !== deleteSubunitKey,
      )
      const nextPaywallConfig = {
        ...paywallConfig,
        lockedSubunits: {
          ...paywallConfig.lockedSubunits,
          [curriculumId]: nextLockedSubunits,
        },
      }
      await persistPaywall(nextPaywallConfig)

      if (paywallCourseId === curriculumId && paywallUnitId === unitId && paywallSubunit === subunit) {
        setPaywallSubunit(fallbackSubunit)
      }

      const recordsToDelete = records.filter(
        (item) => item.curriculumId === curriculumId && item.unitId === unitId && item.subunit === subunit,
      )
      await Promise.all(recordsToDelete.map((item) => deleteDoc(doc(db, 'courseContentItems', item.id))))
      persistRecords(records.filter((item) => !(item.curriculumId === curriculumId && item.unitId === unitId && item.subunit === subunit)))
    } catch (error) {
      setDataError(error?.message || 'Unable to delete subtopic.')
    } finally {
      setIsDeletingSubtopic(false)
    }
  }

  function onImageFileChange(event) {
    const file = event.target.files?.[0] || null
    setSelectedImageFile(file)
    setAttachedFileName(file?.name || '')
    setSelectedImagePreviewUrl(file ? URL.createObjectURL(file) : '')
  }

  function onSolutionImageFileChange(event) {
    const file = event.target.files?.[0] || null
    setSolutionImageFile(file)
    setSolutionImagePreviewUrl(file ? URL.createObjectURL(file) : '')
  }

  function updateBlock(setter, blockId, patch) {
    setter((current) => current.map((block) => (block.id === blockId ? { ...block, ...patch } : block)))
  }

  function addBlock(setter, type) {
    setter((current) => [...current, type === 'image' ? createImageContentBlock() : createTextContentBlock('')])
  }

  function moveBlock(setter, fromIndex, toIndex) {
    setter((current) => moveItem(current, fromIndex, toIndex))
  }

  function removeBlock(setter, blockId) {
    const confirmed = window.confirm('Are you sure you want to delete this block?')
    if (!confirmed) return
    setter((current) => current.filter((block) => block.id !== blockId))
  }

  function onBlockImageChange(setter, blockId, event) {
    const file = event.target.files?.[0] || null
    if (!file) return
    updateBlock(setter, blockId, {
      imageFile: file,
      imagePreviewUrl: URL.createObjectURL(file),
    })
  }

  async function uploadBlocksImages(blocks, folder) {
    if (!Array.isArray(blocks) || blocks.length === 0) return []
    const normalized = []
    for (const block of blocks) {
      if (block?.type === 'image') {
        let imageUrl = String(block?.imageUrl || '').trim()
        let imagePath = String(block?.imagePath || '').trim()
        if (block?.imageFile) {
          if (!supabaseConfigured) {
            throw new Error('Supabase not configured. Add Supabase env values before uploading images.')
          }
          const uploadResult = await uploadImageToSupabase(block.imageFile, folder)
          imageUrl = uploadResult.publicUrl
          imagePath = uploadResult.path
        } else if (block?.imagePreviewUrl && !imageUrl) {
          imageUrl = block.imagePreviewUrl
        }
        if (!imageUrl) continue
        normalized.push({
          id: String(block.id || `blk-${Date.now()}`),
          type: 'image',
          imageUrl,
          imagePath,
          caption: String(block?.caption || '').trim(),
          widthPercent: clampImageWidthPercent(block?.widthPercent, 100),
        })
      } else {
        const text = String(block?.text || '').trim()
        if (!text) continue
        normalized.push({
          id: String(block?.id || `blk-${Date.now()}`),
          type: 'text',
          text,
        })
      }
    }
    return normalized
  }

  function renderAdminBlocksEditor({ blocks, setter, label }) {
    return (
      <div className="block-editor">
        <strong>{label}</strong>
        {blocks.map((block, index) => (
          <div className="block-editor-item" key={block.id}>
            <div className="block-editor-head">
              <span>{block.type === 'image' ? 'Image block' : 'Text block'}</span>
              <div className="block-editor-actions">
                <button type="button" onClick={() => moveBlock(setter, index, Math.max(0, index - 1))} disabled={index === 0}>
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveBlock(setter, index, Math.min(blocks.length - 1, index + 1))}
                  disabled={index === blocks.length - 1}
                >
                  ↓
                </button>
                <button type="button" onClick={() => removeBlock(setter, block.id)}>
                  Delete
                </button>
              </div>
            </div>
            {block.type === 'image' ? (
              <>
                <input type="file" accept="image/*" onChange={(event) => onBlockImageChange(setter, block.id, event)} />
                {(block.imagePreviewUrl || block.imageUrl) ? (
                  <div className="image-preview-block">
                    <img src={block.imagePreviewUrl || block.imageUrl} alt="Block preview" />
                  </div>
                ) : null}
                <input
                  value={block.caption || ''}
                  onChange={(event) => updateBlock(setter, block.id, { caption: event.target.value })}
                  placeholder="Caption (optional)"
                />
                <label>
                  Image Size (%)
                  <input
                    type="range"
                    min={20}
                    max={180}
                    value={clampImageWidthPercent(block.widthPercent, 100)}
                    onChange={(event) =>
                      updateBlock(setter, block.id, {
                        widthPercent: clampImageWidthPercent(event.target.value, 100),
                      })
                    }
                  />
                  <small>{clampImageWidthPercent(block.widthPercent, 100)}%</small>
                </label>
              </>
            ) : (
              <RichTextEditor
                rows={4}
                value={block.text || ''}
                onChange={(nextValue) => updateBlock(setter, block.id, { text: nextValue })}
                placeholder="Write text / LaTeX content"
              />
            )}
          </div>
        ))}
        <div className="block-editor-add">
          <button type="button" className="btn ghost" onClick={() => addBlock(setter, 'text')}>
            + Text block
          </button>
          <button type="button" className="btn ghost" onClick={() => addBlock(setter, 'image')}>
            + Image block
          </button>
        </div>
      </div>
    )
  }

  async function submitItem(event) {
    event.preventDefault()
    const objectivePoints = itemType === 'lesson' ? parseLearningObjectivePoints(learningObjectivesText) : []
    const descriptionBlocksEnabled = contentBlocksHaveMediaOrText(descriptionBlocks)
    const solutionBlocksEnabled = itemType === 'question' && contentBlocksHaveMediaOrText(solutionBlocks)
    const preparedSolution = solutionBlocksEnabled ? contentBlocksToPlainText(solutionBlocks) : String(solution || '').trim()
    if (!descriptionBlocksEnabled && objectivePoints.length === 0) {
      setDataError('Add description blocks, or learning objective points (one per line).')
      return
    }
    if (itemType !== 'question' && !String(title || '').trim() && objectivePoints.length === 0) {
      setDataError('Title is required.')
      return
    }
    if (
      itemType === 'question' &&
      !preparedSolution &&
      !String(solutionVideoLink || '').trim() &&
      !solutionImageFile &&
      !solutionBlocksEnabled
    ) {
      setDataError('Add a text solution, solution image, or a YouTube video solution link for question items.')
      return
    }
    let imageUrl = ''
    let imagePath = ''
    let solutionImageUrl = ''
    let solutionImagePath = ''
    let normalizedDescriptionBlocks = []
    let normalizedSolutionBlocks = []

    if (descriptionBlocksEnabled || solutionBlocksEnabled) {
      try {
        setIsImageUploading(true)
        normalizedDescriptionBlocks = descriptionBlocksEnabled
          ? await uploadBlocksImages(descriptionBlocks, `${curriculumId}/${unitId}/blocks/description`)
          : []
        normalizedSolutionBlocks = solutionBlocksEnabled
          ? await uploadBlocksImages(solutionBlocks, `${curriculumId}/${unitId}/blocks/solution`)
          : []
      } catch (error) {
        setIsImageUploading(false)
        setDataError(error?.message || 'Unable to upload block images to Supabase.')
        return
      }
    }
    if (!descriptionBlocksEnabled && objectivePoints.length > 0) {
      normalizedDescriptionBlocks = [
        createTextContentBlock(objectivePoints.map((point, index) => `${index + 1}. ${point}`).join('\n')),
      ]
    }

    if (selectedImageFile) {
      if (!supabaseConfigured) {
        setDataError('Supabase not configured. Add Supabase env values before uploading images.')
        return
      }
      try {
        setIsImageUploading(true)
        const uploadResult = await uploadImageToSupabase(selectedImageFile, `${curriculumId}/${unitId}`)
        imageUrl = uploadResult.publicUrl
        imagePath = uploadResult.path
      } catch (error) {
        setIsImageUploading(false)
        setDataError(error?.message || 'Unable to upload image to Supabase.')
        return
      }
    }
    if (itemType === 'question' && solutionImageFile) {
      if (!supabaseConfigured) {
        setDataError('Supabase not configured. Add Supabase env values before uploading images.')
        setIsImageUploading(false)
        return
      }
      try {
        setIsImageUploading(true)
        const uploadResult = await uploadImageToSupabase(solutionImageFile, `${curriculumId}/${unitId}/solutions`)
        solutionImageUrl = uploadResult.publicUrl
        solutionImagePath = uploadResult.path
      } catch (error) {
        setIsImageUploading(false)
        setDataError(error?.message || 'Unable to upload solution image to Supabase.')
        return
      }
    }

    const sameScopeSameTypeRecords = records.filter(
      (item) =>
        item.curriculumId === curriculumId &&
        item.unitId === unitId &&
        item.subunit === subunit &&
        item.itemType === itemType,
    )
    const maxSortOrder = sameScopeSameTypeRecords.reduce((max, item) => {
      const value = Number(item?.sortOrder)
      return Number.isFinite(value) ? Math.max(max, value) : max
    }, 0)

    const newRecord = {
      itemType,
      title: itemType === 'question' ? '' : title.trim() || (objectivePoints.length ? 'Learning Objectives' : ''),
      description: contentBlocksToPlainText(normalizedDescriptionBlocks),
      descriptionBlocks: normalizedDescriptionBlocks,
      learningObjectives: itemType === 'lesson' ? objectivePoints : [],
      solution: itemType === 'question' ? (solutionBlocksEnabled ? contentBlocksToPlainText(normalizedSolutionBlocks) : solution) : '',
      solutionBlocks: itemType === 'question' && solutionBlocksEnabled ? normalizedSolutionBlocks : [],
      solutionVideoLink: itemType === 'question' ? solutionVideoLink.trim() : '',
      solutionImageUrl: itemType === 'question' ? solutionImageUrl : '',
      solutionImagePath: itemType === 'question' ? solutionImagePath : '',
      questionLevel: itemType === 'question' && isCurrentAdminIbdpCourse ? questionLevel : '',
      difficulty: itemType === 'question' ? questionDifficulty : '',
      marks: itemType === 'question' ? Number(questionMarks || 0) : 0,
      gdc: itemType === 'question' ? questionGdc : '',
      geogebraLink: itemType === 'lesson' ? geogebraLink : '',
      resourceLink,
      attachedFileName,
      imageUrl,
      imagePath,
      imageWidthPercent: clampImageWidthPercent(imageWidthPercent, 100),
      curriculumId,
      unitId,
      subunit,
      sortOrder: maxSortOrder + 1,
      createdAt: new Date().toISOString(),
      createdByEmail: String(auth.currentUser?.email || '').trim().toLowerCase(),
      createdByRole: isEditorMode ? 'editor' : 'admin',
    }
    try {
      const docRef = await addDoc(contentItemsCollectionRef, newRecord)
      persistRecords([{ id: docRef.id, ...newRecord }, ...records])
      setDataError('')
    } catch (error) {
      setDataError(error?.message || 'Unable to save content item.')
    }
    setIsImageUploading(false)
    setTitle('')
    setLearningObjectivesText('')
    setDescriptionBlocks([createTextContentBlock('')])
    setSolution('')
    setSolutionBlocks([])
    setSolutionVideoLink('')
    setQuestionDifficulty('medium')
    setQuestionMarks(1)
    setQuestionGdc('not gdc')
    setQuestionLevel('sl')
    setGeogebraLink('')
    setResourceLink('')
    setAttachedFileName('')
    setSelectedImageFile(null)
    setSelectedImagePreviewUrl('')
    setSolutionImageFile(null)
    setSolutionImagePreviewUrl('')
    setImageWidthPercent(100)
  }

  async function submitBulkQuestions(event) {
    event.preventDefault()
    setDataError('')
    setBulkUploadError('')
    setBulkUploadSuccess('')
    setIsBulkUploading(true)

    try {
      const rawInput = String(bulkQuestionInput || '').trim()
      if (!rawInput) throw new Error('Paste JSON first.')

      const fencedMatch = rawInput.match(/```(?:json)?\s*([\s\S]*?)```/i)
      const jsonSource = fencedMatch?.[1]?.trim() || rawInput
      const parsed = JSON.parse(jsonSource)
      const items = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.questions)
          ? parsed.questions
          : parsed && typeof parsed === 'object'
            ? [parsed]
            : null
      if (!items || items.length === 0) {
        throw new Error('Provide a question JSON object, array, or { "questions": [...] }.')
      }
      if (!curriculumId || !unitId || !subunit) {
        throw new Error('Select course, topic, and subtopic before bulk upload.')
      }

      const existingQuestionRecords = records.filter(
        (item) =>
          item.curriculumId === curriculumId &&
          item.unitId === unitId &&
          item.subunit === subunit &&
          item.itemType === 'question',
      )
      const baseSortOrder = existingQuestionRecords.reduce((max, item) => {
        const value = Number(item?.sortOrder)
        return Number.isFinite(value) ? Math.max(max, value) : max
      }, 0)

      const created = []
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index] || {}
        const descriptionValue = String(item.description || item.question || item.prompt || '').trim()
        if (!descriptionValue) {
          throw new Error(`Question ${index + 1} is missing description/question text.`)
        }

        const newRecord = {
          itemType: 'question',
          title: '',
          description: descriptionValue,
          solution: String(item.solution || '').trim(),
          solutionVideoLink: String(item.solutionVideoLink || item.videoSolutionLink || item.youtubeLink || '').trim(),
          solutionImageUrl: String(item.solutionImageUrl || '').trim(),
          solutionImagePath: '',
          questionLevel:
            isCurrentAdminIbdpCourse && ['sl', 'hl'].includes(String(item.questionLevel || item.level || 'sl').toLowerCase())
              ? String(item.questionLevel || item.level || 'sl').toLowerCase()
              : '',
          difficulty: String(item.difficulty || 'medium').toLowerCase(),
          marks: Math.max(1, Number(item.marks || 1)),
          gdc: String(item.gdc || 'not gdc').toLowerCase() === 'gdc' ? 'gdc' : 'not gdc',
          geogebraLink: '',
          resourceLink: String(item.resourceLink || '').trim(),
          attachedFileName: '',
          imageUrl: '',
          imagePath: '',
          imageWidthPercent: clampImageWidthPercent(item.imageWidthPercent, 100),
          curriculumId,
          unitId,
          subunit,
          sortOrder: baseSortOrder + index + 1,
          createdAt: new Date(Date.now() + index).toISOString(),
          createdByEmail: String(auth.currentUser?.email || '').trim().toLowerCase(),
          createdByRole: isEditorMode ? 'editor' : 'admin',
        }

        const docRef = await addDoc(contentItemsCollectionRef, newRecord)
        created.push({ id: docRef.id, ...newRecord })
      }

      persistRecords([...created, ...records])
      setBulkQuestionInput('')
      setBulkUploadSuccess(`Uploaded ${created.length} question${created.length === 1 ? '' : 's'} successfully.`)
    } catch (error) {
      setDataError(error?.message || 'Unable to parse/upload bulk questions.')
      setBulkUploadError(error?.message || 'Unable to parse/upload bulk questions.')
    } finally {
      setIsBulkUploading(false)
    }
  }

  async function removeRecord(id) {
    if (isEditorMode) {
      setDataError('Content editors cannot delete content.')
      return
    }
    const record = records.find((item) => item.id === id)
    const label = record?.title ? `"${record.title}"` : 'this content item'
    const confirmed = window.confirm(`Are you sure you want to delete ${label}? This cannot be undone.`)
    if (!confirmed) return

    try {
      await deleteDoc(doc(db, 'courseContentItems', id))
      persistRecords(records.filter((item) => item.id !== id))
      setDataError('')
    } catch (error) {
      setDataError(error?.message || 'Unable to delete content item.')
    }
  }

  function beginEditRecord(record) {
    if (isEditorMode) {
      setDataError('Content editors cannot edit existing content.')
      return
    }
    setEditingRecordId(record.id)
    setEditingRecordType(record.itemType)
    setEditTitle(String(record.title || ''))
    setEditLearningObjectivesText(
      Array.isArray(record.learningObjectives) && record.learningObjectives.length
        ? record.learningObjectives.join('\n')
        : /learning\s*objectives?/i.test(String(record.title || ''))
          ? getLearningObjectivePoints(record).join('\n')
          : '',
    )
    setEditDescriptionBlocks(normalizeContentBlocks(record.descriptionBlocks, record.description))
    setEditSolution(String(record.solution || ''))
    setEditSolutionBlocks(normalizeContentBlocks(record.solutionBlocks, record.solution))
    setEditSolutionVideoLink(String(record.solutionVideoLink || ''))
    setEditDifficulty(String(record.difficulty || 'medium'))
    setEditMarks(Number(record.marks || 1))
    setEditGdc(String(record.gdc || 'not gdc'))
    setEditQuestionLevel(String(record.questionLevel || 'sl'))
    setEditGeogebraLink(String(record.geogebraLink || ''))
    setEditResourceLink(String(record.resourceLink || ''))
    setEditImageWidthPercent(clampImageWidthPercent(record.imageWidthPercent, 100))
  }

  function cancelEditRecord() {
    setEditingRecordId('')
    setEditingRecordType('')
    setEditTitle('')
    setEditLearningObjectivesText('')
    setEditDescriptionBlocks([])
    setEditSolution('')
    setEditSolutionBlocks([])
    setEditSolutionVideoLink('')
    setEditDifficulty('medium')
    setEditMarks(1)
    setEditGdc('not gdc')
    setEditQuestionLevel('sl')
    setEditGeogebraLink('')
    setEditResourceLink('')
    setEditImageWidthPercent(100)
  }

  async function saveRecordEdits() {
    if (isEditorMode) {
      setDataError('Content editors cannot edit existing content.')
      return
    }
    if (!editingRecordId || !editingRecordType) return
    const editingRecord = records.find((item) => item.id === editingRecordId) || null
    const editDescriptionBlocksEnabled = contentBlocksHaveMediaOrText(editDescriptionBlocks)
    const editSolutionBlocksEnabled = editingRecordType === 'question' && contentBlocksHaveMediaOrText(editSolutionBlocks)
    const nextSolutionText = editSolutionBlocksEnabled ? contentBlocksToPlainText(editSolutionBlocks) : editSolution.trim()

    if (editingRecordType !== 'question' && !editTitle.trim() && !parseLearningObjectivePoints(editLearningObjectivesText).length) {
      setDataError('Title is required for lessons.')
      return
    }
    if (!editDescriptionBlocksEnabled && !parseLearningObjectivePoints(editLearningObjectivesText).length) {
      setDataError('Add description blocks, or learning objective points (one per line).')
      return
    }
    if (
      editingRecordType === 'question' &&
      !nextSolutionText &&
      !editSolutionVideoLink.trim() &&
      !String(editingRecord?.solutionImageUrl || '').trim() &&
      !editSolutionBlocksEnabled
    ) {
      setDataError('Add either a text solution, solution image, or a YouTube video solution link.')
      return
    }

    let normalizedDescriptionBlocks = []
    let normalizedSolutionBlocks = []
    const editObjectivePoints = editingRecordType === 'lesson' ? parseLearningObjectivePoints(editLearningObjectivesText) : []
    if (editDescriptionBlocksEnabled || editSolutionBlocksEnabled) {
      try {
        setIsImageUploading(true)
        normalizedDescriptionBlocks = editDescriptionBlocksEnabled
          ? await uploadBlocksImages(
              editDescriptionBlocks,
              `${editingRecord?.curriculumId || curriculumId}/${editingRecord?.unitId || unitId}/blocks/description`,
            )
          : []
        normalizedSolutionBlocks = editSolutionBlocksEnabled
          ? await uploadBlocksImages(
              editSolutionBlocks,
              `${editingRecord?.curriculumId || curriculumId}/${editingRecord?.unitId || unitId}/blocks/solution`,
            )
          : []
      } catch (error) {
        setIsImageUploading(false)
        setDataError(error?.message || 'Unable to upload block images to Supabase.')
        return
      }
    }
    if (!editDescriptionBlocksEnabled && editObjectivePoints.length > 0) {
      normalizedDescriptionBlocks = [
        createTextContentBlock(editObjectivePoints.map((point, index) => `${index + 1}. ${point}`).join('\n')),
      ]
    }

    const payload =
      editingRecordType === 'question'
        ? {
            description: contentBlocksToPlainText(normalizedDescriptionBlocks),
            descriptionBlocks: normalizedDescriptionBlocks,
            solution: editSolutionBlocksEnabled ? contentBlocksToPlainText(normalizedSolutionBlocks) : editSolution.trim(),
            solutionBlocks: editSolutionBlocksEnabled ? normalizedSolutionBlocks : [],
            solutionVideoLink: editSolutionVideoLink.trim(),
            questionLevel:
              (editingRecord?.curriculumId === 'ibdp-aa-hl' || editingRecord?.curriculumId === 'ibdp-ai-hl') &&
              ['sl', 'hl'].includes(String(editQuestionLevel || 'sl').toLowerCase())
                ? String(editQuestionLevel || 'sl').toLowerCase()
                : '',
            difficulty: editDifficulty,
            marks: Math.max(1, Number(editMarks || 1)),
            gdc: editGdc,
            resourceLink: editResourceLink.trim(),
            imageWidthPercent: clampImageWidthPercent(editImageWidthPercent, 100),
            updatedAt: new Date().toISOString(),
          }
        : {
            title: editTitle.trim() || (parseLearningObjectivePoints(editLearningObjectivesText).length ? 'Learning Objectives' : ''),
            description: contentBlocksToPlainText(normalizedDescriptionBlocks),
            descriptionBlocks: normalizedDescriptionBlocks,
            learningObjectives: parseLearningObjectivePoints(editLearningObjectivesText),
            geogebraLink: editGeogebraLink.trim(),
            resourceLink: editResourceLink.trim(),
            imageWidthPercent: clampImageWidthPercent(editImageWidthPercent, 100),
            updatedAt: new Date().toISOString(),
          }

    try {
      await setDoc(doc(db, 'courseContentItems', editingRecordId), payload, { merge: true })
      persistRecords(records.map((item) => (item.id === editingRecordId ? { ...item, ...payload } : item)))
      setDataError('')
      cancelEditRecord()
    } catch (error) {
      setDataError(error?.message || 'Unable to save item edits.')
    } finally {
      setIsImageUploading(false)
    }
  }

  async function reorderStoredItems(targetIndex) {
    if (isEditorMode) {
      setDataError('Content editors cannot reorder content.')
      return
    }
    if (dragRecordIndex === null || dragRecordIndex === targetIndex) return
    const reordered = moveItem(activeStoredRecords, dragRecordIndex, targetIndex)
    const reorderedWithOrder = reordered.map((item, index) => ({ ...item, sortOrder: index + 1 }))
    const orderById = new Map(reorderedWithOrder.map((item) => [item.id, item.sortOrder]))
    const updatedRecords = records.map((item) =>
      orderById.has(item.id) ? { ...item, sortOrder: orderById.get(item.id) } : item,
    )

    persistRecords(updatedRecords)
    setDragRecordIndex(null)
    try {
      await Promise.all(
        reorderedWithOrder.map((item) =>
          setDoc(doc(db, 'courseContentItems', item.id), { sortOrder: item.sortOrder }, { merge: true }),
        ),
      )
      setDataError('')
    } catch (error) {
      setDataError(error?.message || 'Unable to reorder stored items.')
    }
  }

  async function submitIaItem(event) {
    event.preventDefault()
    if (!iaTitle.trim()) return
    if (countWords(iaTitle) > IA_TITLE_MAX_WORDS) {
      setDataError(`Research question must be ${IA_TITLE_MAX_WORDS} words or fewer.`)
      return
    }
    if (countWords(iaTopic) > IA_TOPIC_MAX_WORDS) {
      setDataError(`Topic must be ${IA_TOPIC_MAX_WORDS} words or fewer.`)
      return
    }
    if (countWords(iaSummary) > IA_SUMMARY_MAX_WORDS) {
      setDataError(`Summary must be ${IA_SUMMARY_MAX_WORDS} words or fewer.`)
      return
    }
    if (countWords(iaDescription) > IA_DESCRIPTION_MAX_WORDS) {
      setDataError(`Description must be ${IA_DESCRIPTION_MAX_WORDS} words or fewer.`)
      return
    }
    const previewPages = Math.min(20, Math.max(1, Math.floor(Number(iaPreviewPages) || 1)))
    const unlockPriceInr = Number(iaUnlockPrice || 0)
    if (!Number.isFinite(unlockPriceInr) || unlockPriceInr < 0) {
      setDataError('Unlock price must be a valid number.')
      return
    }

    const isEditing = Boolean(editingIaId)
    const existingItem = isEditing ? iaItems.find((item) => item.id === editingIaId) : null
    if (isEditing && !existingItem) {
      setDataError('Could not find the IA you are editing.')
      return
    }
    if (!iaPdfFile && !(isEditing && existingItem?.pdfUrl)) {
      setDataError('Upload a PDF for this IA.')
      return
    }

    let imageUrl = isEditing ? String(existingItem?.imageUrl || iaExistingImageUrl || '') : ''
    let imagePath = isEditing ? String(existingItem?.imagePath || iaExistingImagePath || '') : ''
    let pdfUrl = isEditing ? String(existingItem?.pdfUrl || iaExistingPdfUrl || '') : ''
    let pdfPath = isEditing ? String(existingItem?.pdfPath || iaExistingPdfPath || '') : ''
    let pdfFileName = isEditing ? String(existingItem?.pdfFileName || iaExistingPdfName || '') : ''

    if ((iaPdfFile || iaImageFile) && !supabaseConfigured) {
      setDataError('Supabase not configured. Add Supabase env values before uploading files.')
      return
    }

    try {
      setIsIaSaving(true)
      setDataError('')
      if (iaPdfFile) {
        const pdfUpload = await uploadPdfToSupabase(iaPdfFile, 'ia-pdfs')
        pdfUrl = pdfUpload.publicUrl
        pdfPath = pdfUpload.path
        pdfFileName = String(iaPdfFile.name || 'ia.pdf').slice(0, 180)
      }

      if (iaImageFile) {
        const uploadResult = await uploadImageToSupabase(iaImageFile, 'ia')
        imageUrl = uploadResult.publicUrl
        imagePath = uploadResult.path
      }
    } catch (error) {
      setIsIaSaving(false)
      setDataError(error?.message || 'Unable to upload IA files to Supabase.')
      return
    }

    const payload = {
      id: isEditing ? existingItem.id : `ia-${Date.now()}`,
      title: iaTitle.trim(),
      course: iaCourse.trim(),
      topic: iaTopic.trim(),
      summary: iaSummary.trim(),
      description: iaDescription.trim(),
      link: iaLink.trim(),
      imageUrl,
      imagePath,
      pdfUrl,
      pdfPath,
      pdfFileName,
      previewPages,
      unlockPriceInr,
      createdAt: isEditing ? existingItem.createdAt || new Date().toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const next = isEditing
      ? iaItems.map((item) => (item.id === editingIaId ? { ...item, ...payload } : item))
      : [payload, ...iaItems]

    await persistIaItems(next)
    resetIaForm()
  }

  function resetIaForm() {
    setEditingIaId('')
    setIaTitle('')
    setIaCourse('IBDP AA HL')
    setIaTopic('')
    setIaSummary('')
    setIaDescription('')
    setIaLink('')
    setIaPreviewPages('1')
    setIaUnlockPrice(
      paywallConfig.defaultIaUnlockPriceInr > 0 ? String(paywallConfig.defaultIaUnlockPriceInr) : '',
    )
    setIaPdfFile(null)
    setIaImageFile(null)
    setIaImagePreviewUrl('')
    setIaExistingPdfUrl('')
    setIaExistingPdfName('')
    setIaExistingPdfPath('')
    setIaExistingImageUrl('')
    setIaExistingImagePath('')
  }

  function startEditIaItem(item) {
    if (!item?.id) return
    setEditingIaId(item.id)
    setIaTitle(limitWords(item.title || '', IA_TITLE_MAX_WORDS))
    setIaCourse(iaAaCourses.includes(item.course) ? item.course : 'IBDP AA HL')
    setIaTopic(limitWords(item.topic || '', IA_TOPIC_MAX_WORDS))
    setIaSummary(limitWords(item.summary || '', IA_SUMMARY_MAX_WORDS))
    setIaDescription(limitWords(item.description || '', IA_DESCRIPTION_MAX_WORDS))
    setIaLink(item.link || '')
    setIaPreviewPages(String(item.previewPages || 1))
    setIaUnlockPrice(String(item.unlockPriceInr ?? ''))
    setIaPdfFile(null)
    setIaImageFile(null)
    setIaExistingPdfUrl(item.pdfUrl || '')
    setIaExistingPdfName(item.pdfFileName || '')
    setIaExistingPdfPath(item.pdfPath || '')
    setIaExistingImageUrl(item.imageUrl || '')
    setIaExistingImagePath(item.imagePath || '')
    setIaImagePreviewUrl(item.imageUrl || '')
    setDataError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEditIaItem() {
    resetIaForm()
    setDataError('')
  }

  async function removeIaItem(itemId) {
    const iaItem = iaItems.find((item) => item.id === itemId)
    const label = iaItem?.title ? `"${iaItem.title}"` : 'this IA'
    const confirmed = window.confirm(`Are you sure you want to delete ${label}? This cannot be undone.`)
    if (!confirmed) return
    if (editingIaId === itemId) resetIaForm()
    await persistIaItems(iaItems.filter((item) => item.id !== itemId))
  }

  function onResourcePostImageChange(event) {
    const file = event.target.files?.[0] || null
    setResourcePostImageFile(file)
    setResourcePostImagePreviewUrl(file ? URL.createObjectURL(file) : '')
  }

  function onIaImageChange(event) {
    const file = event.target.files?.[0] || null
    setIaImageFile(file)
    setIaImagePreviewUrl(file ? URL.createObjectURL(file) : '')
  }

  function onIaPdfChange(event) {
    const file = event.target.files?.[0] || null
    if (!file) {
      setIaPdfFile(null)
      return
    }
    const mime = String(file.type || '').toLowerCase()
    const name = String(file.name || '').toLowerCase()
    if (mime !== 'application/pdf' && !name.endsWith('.pdf')) {
      setDataError('Only PDF files are allowed for IA uploads.')
      event.target.value = ''
      setIaPdfFile(null)
      return
    }
    if (file.size > 25 * 1024 * 1024) {
      setDataError('PDF must be 25MB or smaller.')
      event.target.value = ''
      setIaPdfFile(null)
      return
    }
    setDataError('')
    setIaPdfFile(file)
  }

  function onResourcePostPdfChange(event) {
    const file = event.target.files?.[0] || null
    if (!file) {
      setResourcePostPdfFile(null)
      return
    }
    const mime = String(file.type || '').toLowerCase()
    const name = String(file.name || '').toLowerCase()
    if (mime !== 'application/pdf' && !name.endsWith('.pdf')) {
      setDataError('Only PDF files are allowed for resource uploads.')
      event.target.value = ''
      setResourcePostPdfFile(null)
      return
    }
    if (file.size > 25 * 1024 * 1024) {
      setDataError('PDF must be 25MB or smaller.')
      event.target.value = ''
      setResourcePostPdfFile(null)
      return
    }
    setDataError('')
    setResourcePostPdfFile(file)
  }

  async function submitTeachersResourcePost(event) {
    event.preventDefault()
    if (!resourcePostTitle.trim()) return

    const isEditing = Boolean(editingTeachersResourceId)
    const existingItem = isEditing ? teachersResourcesPosts.find((item) => item.id === editingTeachersResourceId) : null
    if (isEditing && !existingItem) {
      setDataError('Could not find the resource you are editing.')
      return
    }
    if (!resourcePostPdfFile && !(isEditing && existingItem?.pdfUrl)) {
      setDataError('Upload a PDF for this resource.')
      return
    }

    let imageUrl = isEditing ? String(existingItem?.imageUrl || resourceExistingImageUrl || '') : ''
    let imagePath = isEditing ? String(existingItem?.imagePath || resourceExistingImagePath || '') : ''
    let pdfUrl = isEditing ? String(existingItem?.pdfUrl || resourceExistingPdfUrl || '') : ''
    let pdfPath = isEditing ? String(existingItem?.pdfPath || resourceExistingPdfPath || '') : ''
    let pdfFileName = isEditing ? String(existingItem?.pdfFileName || resourceExistingPdfName || '') : ''

    if ((resourcePostPdfFile || resourcePostImageFile) && !supabaseConfigured) {
      setDataError('Supabase not configured. Add Supabase env values before uploading files.')
      return
    }

    try {
      setIsTeachersResourcesSaving(true)
      setDataError('')
      if (resourcePostPdfFile) {
        const pdfUpload = await uploadPdfToSupabase(resourcePostPdfFile, 'teachers-resources-pdfs')
        pdfUrl = pdfUpload.publicUrl
        pdfPath = pdfUpload.path
        pdfFileName = String(resourcePostPdfFile.name || 'resource.pdf').slice(0, 180)
      }
      if (resourcePostImageFile) {
        const uploadResult = await uploadImageToSupabase(resourcePostImageFile, 'teachers-resources')
        imageUrl = uploadResult.publicUrl
        imagePath = uploadResult.path
      }
    } catch (error) {
      setIsTeachersResourcesSaving(false)
      setDataError(error?.message || 'Unable to upload resource files to Supabase.')
      return
    }

    const payload = {
      id: isEditing ? existingItem.id : `tr-${Date.now()}`,
      title: resourcePostTitle.trim(),
      description: resourcePostDescription.trim(),
      category: mapTeachersResourceCategory(resourcePostCategory) || 'Activities',
      imageUrl,
      imagePath,
      pdfUrl,
      pdfPath,
      pdfFileName,
      createdAt: isEditing ? existingItem.createdAt || new Date().toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const nextPosts = isEditing
      ? teachersResourcesPosts.map((item) => (item.id === editingTeachersResourceId ? { ...item, ...payload } : item))
      : [payload, ...teachersResourcesPosts]

    await persistTeachersResourcesPosts(nextPosts)
    resetTeachersResourceForm()
  }

  function resetTeachersResourceForm() {
    setEditingTeachersResourceId('')
    setResourcePostTitle('')
    setResourcePostDescription('')
    setResourcePostCategory('Activities')
    setResourcePostImageFile(null)
    setResourcePostImagePreviewUrl('')
    setResourcePostPdfFile(null)
    setResourceExistingPdfUrl('')
    setResourceExistingPdfName('')
    setResourceExistingPdfPath('')
    setResourceExistingImageUrl('')
    setResourceExistingImagePath('')
  }

  function startEditTeachersResourcePost(item) {
    if (!item?.id) return
    setEditingTeachersResourceId(item.id)
    setResourcePostTitle(item.title || '')
    setResourcePostDescription(item.description || '')
    setResourcePostCategory(mapTeachersResourceCategory(item.category) || 'Activities')
    setResourcePostImageFile(null)
    setResourcePostPdfFile(null)
    setResourceExistingPdfUrl(item.pdfUrl || '')
    setResourceExistingPdfName(item.pdfFileName || '')
    setResourceExistingPdfPath(item.pdfPath || '')
    setResourceExistingImageUrl(item.imageUrl || '')
    setResourceExistingImagePath(item.imagePath || '')
    setResourcePostImagePreviewUrl(item.imageUrl || '')
    setDataError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEditTeachersResourcePost() {
    resetTeachersResourceForm()
    setDataError('')
  }

  async function removeTeachersResourcePost(postId) {
    const post = teachersResourcesPosts.find((item) => item.id === postId)
    const label = post?.title ? `"${post.title}"` : 'this resource'
    const confirmed = window.confirm(`Are you sure you want to delete ${label}? This cannot be undone.`)
    if (!confirmed) return
    if (editingTeachersResourceId === postId) resetTeachersResourceForm()
    await persistTeachersResourcesPosts(teachersResourcesPosts.filter((item) => item.id !== postId))
  }

  const isUnitLockedInAdmin = (paywallConfig.lockedUnits?.[paywallCourseId] || []).includes(paywallUnitId)
  const selectedPaywallSubunitKey = `${paywallUnitId}::${paywallSubunit}`
  const isSubunitLockedInAdmin = (paywallConfig.lockedSubunits?.[paywallCourseId] || []).includes(selectedPaywallSubunitKey)

  return (
    <main className={`admin site-full ${isEditorMode ? 'admin-editor-mode' : ''}`}>
      <header className="admin-header">
        <div>
          <h1>{isEditorMode ? 'Content Editor' : 'Admin Dashboard'}</h1>
          <p>
            {isEditorMode
              ? 'Add-only access: upload new lessons and questions. Editing, deleting, and structure changes are blocked.'
              : 'Manage course topics/subtopics and upload mapped lessons, questions, and resources.'}
          </p>
          {isEditorMode ? (
            <p className="editor-account-note">
              Signed in as <strong>{auth.currentUser?.email || editorAllowedEmail}</strong>
            </p>
          ) : null}
        </div>
        <div className="admin-header-actions">
          {isEditorMode ? (
            <button type="button" className="btn ghost" onClick={() => signOut(auth)}>
              Sign out
            </button>
          ) : null}
          <Link className="btn ghost" to="/">
            Back to Website
          </Link>
        </div>
      </header>
      {isDataLoading && <p>Loading course data...</p>}
      {dataError && <p className="error-text">{dataError}</p>}

      <section className="admin-grid">
        <aside className="panel">
          <h2>{isEditorMode ? 'Select placement' : 'Course Structure'}</h2>
          <label>
            Course
            <select value={adminSelection} onChange={(event) => onCurriculumChange(event.target.value)}>
              {!isEditorMode ? <option value={adminPricingOptionId}>Pricing</option> : null}
              {!isEditorMode ? <option value={adminIaOptionId}>IA Management</option> : null}
              {!isEditorMode ? <option value={adminTeachersResourcesOptionId}>Teachers &amp; Resources</option> : null}
              {curricula.map((curriculum) => (
                <option value={curriculum.id} key={curriculum.id}>
                  {curriculum.name}
                </option>
              ))}
            </select>
          </label>
          {!isIaManagementSelected && !isTeachersResourcesSelected && !isPricingSelected ? (
            <>
          <label>
            Topic
            <select value={unitId} onChange={(event) => onUnitChange(event.target.value)}>
              {(selectedCurriculum?.units ?? []).map((unit) => (
                <option value={unit.id} key={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </label>
          {!isEditorMode ? (
          <button className="btn danger" type="button" onClick={deleteSelectedTopic} disabled={isDeletingTopic || !(selectedCurriculum?.units?.length > 1)}>
            {isDeletingTopic ? 'Deleting topic...' : 'Delete Selected Topic'}
          </button>
          ) : null}
          <label>
            Subtopic
            <select value={subunit} onChange={(event) => setSubunit(event.target.value)}>
              {(selectedUnit?.subunits ?? []).map((subunitName) => (
                <option value={subunitName} key={subunitName}>
                  {subunitName}
                </option>
              ))}
            </select>
          </label>
          {!isEditorMode ? (
          <button
            className="btn danger"
            type="button"
            onClick={deleteSelectedSubtopic}
            disabled={isDeletingSubtopic || !(selectedUnit?.subunits?.length > 1)}
          >
            {isDeletingSubtopic ? 'Deleting subtopic...' : 'Delete Selected Subtopic'}
          </button>
          ) : null}

          {!isEditorMode ? (
          <>
          <form onSubmit={addTopic}>
            <label>
              Add Topic
              <input
                value={newTopicName}
                onChange={(event) => setNewTopicName(event.target.value)}
                placeholder="New topic name"
              />
            </label>
            <button className="btn primary" type="submit">
              Add Topic
            </button>
          </form>

          <form onSubmit={addSubtopic}>
            <label>
              Add Subtopic
              <input
                value={newSubtopicName}
                onChange={(event) => setNewSubtopicName(event.target.value)}
                placeholder="New subtopic name"
              />
            </label>
            <button className="btn primary" type="submit">
              Add Subtopic
            </button>
          </form>

          <form onSubmit={renameSelectedSubtopic}>
            <label>
              Rename Selected Subtopic
              <input
                value={renameSubtopicName}
                onChange={(event) => setRenameSubtopicName(event.target.value)}
                placeholder="New subtopic name"
              />
            </label>
            <button className="btn ghost" type="submit" disabled={isRenamingSubtopic || !subunit}>
              {isRenamingSubtopic ? 'Renaming...' : 'Rename Subtopic'}
            </button>
          </form>

          <div className="dnd-block">
            <h3>Drag Topic Order</h3>
            <ul className="dnd-list">
              {(selectedCurriculum?.units ?? []).map((unit, index) => (
                <li
                  key={unit.id}
                  draggable
                  className="dnd-item"
                  onDragStart={() => setDragTopicIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => reorderTopics(index)}
                >
                  {unit.name}
            </li>
              ))}
            </ul>
          </div>

          <div className="dnd-block">
            <h3>Drag Subtopic Order</h3>
            <ul className="dnd-list">
              {(selectedUnit?.subunits ?? []).map((subtopicLabel, index) => (
                <li
                  key={`${subtopicLabel}-${index}`}
                  draggable
                  className="dnd-item"
                  onDragStart={() => setDragSubtopicIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => reorderSubtopics(index)}
                >
                  {subtopicLabel}
            </li>
              ))}
          </ul>
          </div>
          </>
          ) : (
            null
          )}
            </>
          ) : isPricingSelected ? (
            null
          ) : isIaManagementSelected ? (
            null
          ) : isTeachersResourcesSelected ? (
            null
          ) : (
            <p>Select a course to manage topics, subtopics, and content items.</p>
          )}
        </aside>

        <div className="stack">
          {isPricingSelected ? (
          <section className="panel pricing-panel">
            <h2>Pricing</h2>

            <div className="pricing-block">
              <h3>Full access</h3>
              <label>
                Price (INR)
                <input
                  type="number"
                  min={1}
                  value={fullSubscriptionPriceInput}
                  onChange={(event) => setFullSubscriptionPriceInput(event.target.value)}
                />
              </label>
              <label>
                Duration (days)
                <input
                  type="number"
                  min={1}
                  value={fullSubscriptionDaysInput}
                  onChange={(event) => setFullSubscriptionDaysInput(event.target.value)}
                />
              </label>
              <p className="muted-text">
                Unlocks courses, question bank, and all IA PDFs for{' '}
                {formatAccessDuration(Number(fullSubscriptionDaysInput) || FULL_SUBSCRIPTION_DEFAULT_DAYS)}.
              </p>
              <button type="button" className="btn primary" onClick={saveFullSubscriptionSettings} disabled={isPaywallSaving}>
                {isPaywallSaving ? 'Saving...' : 'Save full access price'}
              </button>
            </div>

            <div className="pricing-block">
              <h3>Default IA unlock</h3>
              <label>
                Price for new IAs (INR)
                <input
                  type="number"
                  min={0}
                  value={defaultIaUnlockPriceInput}
                  onChange={(event) => setDefaultIaUnlockPriceInput(event.target.value)}
                  placeholder="e.g. 49"
                />
              </label>
              <button type="button" className="btn primary" onClick={saveDefaultIaUnlockPrice} disabled={isPaywallSaving}>
                {isPaywallSaving ? 'Saving...' : 'Save default IA price'}
              </button>
            </div>

            <div className="pricing-block">
              <h3>Course unlock</h3>
              <label>
                Course
                <select value={paywallCourseId} onChange={(event) => onPaywallCourseChange(event.target.value)}>
                  {curricula.map((curriculum) => (
                    <option key={curriculum.id} value={curriculum.id}>
                      {curriculum.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Price (INR)
                <input
                  type="number"
                  min={0}
                  value={paywallPriceInput}
                  onChange={(event) => setPaywallPriceInput(event.target.value)}
                />
              </label>
              <button type="button" className="btn primary" onClick={saveCoursePrice} disabled={isPaywallSaving}>
                {isPaywallSaving ? 'Saving...' : 'Save course price'}
              </button>
            </div>
          </section>
          ) : isIaManagementSelected ? (
          <section className="panel">
            <h2>{editingIaId ? 'Edit IA' : 'IA Management'}</h2>
            <form onSubmit={submitIaItem}>
              <label>
                IA Idea / Research Question
                <input
                  value={iaTitle}
                  onChange={(event) => setIaTitle(limitWords(event.target.value, IA_TITLE_MAX_WORDS))}
                  required
                />
                <small className="muted-text">
                  Keep it short. {countWords(iaTitle)} / {IA_TITLE_MAX_WORDS} words
                </small>
              </label>
              <label>
                Course
                <select value={iaCourse} onChange={(event) => setIaCourse(event.target.value)}>
                  <option value="IBDP AA HL">IBDP AA HL</option>
                  <option value="IBDP AA SL">IBDP AA SL</option>
                </select>
              </label>
              <label>
                Topic / Focus
                <input
                  value={iaTopic}
                  onChange={(event) => setIaTopic(limitWords(event.target.value, IA_TOPIC_MAX_WORDS))}
                  placeholder="e.g. Calculus, Statistics"
                />
                <small className="muted-text">
                  {countWords(iaTopic)} / {IA_TOPIC_MAX_WORDS} words
                </small>
              </label>
              <label>
                Summary
                <textarea
                  rows={2}
                  value={iaSummary}
                  onChange={(event) => setIaSummary(limitWords(event.target.value, IA_SUMMARY_MAX_WORDS))}
                  placeholder="Short student-facing summary. Not the research question."
                />
                <small className="muted-text">
                  {countWords(iaSummary)} / {IA_SUMMARY_MAX_WORDS} words
                </small>
              </label>
              <label>
                Description (optional)
                <textarea
                  rows={3}
                  value={iaDescription}
                  onChange={(event) => setIaDescription(limitWords(event.target.value, IA_DESCRIPTION_MAX_WORDS))}
                  placeholder="Optional extra note. Keep it brief."
                />
                <small className="muted-text">
                  {countWords(iaDescription)} / {IA_DESCRIPTION_MAX_WORDS} words
                </small>
              </label>
              <label>
                Resource Link (optional)
                <input value={iaLink} onChange={(event) => setIaLink(event.target.value)} placeholder="https://..." />
              </label>
              <label>
                IA PDF {editingIaId ? '(optional — keep current if empty)' : '(required)'}
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={onIaPdfChange}
                  required={!editingIaId}
                />
              </label>
              {iaPdfFile ? <small className="muted-text">Selected: {iaPdfFile.name}</small> : null}
              {!iaPdfFile && iaExistingPdfUrl ? (
                <small className="muted-text">
                  Current PDF:{' '}
                  <a href={iaExistingPdfUrl} target="_blank" rel="noreferrer">
                    {iaExistingPdfName || 'Open current PDF'}
                  </a>
                </small>
              ) : null}
              <label>
                Free preview pages
                <input
                  type="number"
                  min="1"
                  max="20"
                  step="1"
                  value={iaPreviewPages}
                  onChange={(event) => setIaPreviewPages(event.target.value)}
                  required
                />
              </label>
              <label>
                Unlock price (INR)
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={iaUnlockPrice}
                  onChange={(event) => setIaUnlockPrice(event.target.value)}
                  placeholder="e.g. 49"
                  required
                />
              </label>
              <label>
                Card image
                <input type="file" accept="image/*" onChange={onIaImageChange} />
              </label>
              {iaImagePreviewUrl ? (
                <div className="image-preview-block">
                  <img src={iaImagePreviewUrl} alt="IA preview" />
                </div>
              ) : null}
              <div className="paywall-actions">
                <button className="btn primary" type="submit" disabled={isIaSaving}>
                  {isIaSaving ? 'Saving IA...' : editingIaId ? 'Save IA Changes' : 'Add IA'}
                </button>
                {editingIaId ? (
                  <button className="btn ghost" type="button" onClick={cancelEditIaItem} disabled={isIaSaving}>
                    Cancel Edit
                  </button>
                ) : null}
              </div>
            </form>
            <div className="records">
              {iaItems.length === 0 ? (
                <p className="empty">No IA examples added yet.</p>
              ) : (
                iaItems.map((item) => (
                  <article key={item.id} className="record">
                    <div className="record-top">
                      <span className="pill">{editingIaId === item.id ? 'editing' : 'ia'}</span>
                      <div className="record-actions">
                        <button type="button" onClick={() => startEditIaItem(item)}>
                          Edit
                        </button>
                        <button type="button" onClick={() => removeIaItem(item.id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                    <h3>{item.title}</h3>
                    <small>{[item.course, item.topic].filter(Boolean).join(' · ')}</small>
                    <small>
                      Preview {item.previewPages} page{item.previewPages === 1 ? '' : 's'} · Unlock INR{' '}
                      {item.unlockPriceInr || 0}
                      {item.pdfFileName ? ` · ${item.pdfFileName}` : ''}
                    </small>
                    {item.summary ? <LatexText value={item.summary} className="latex-text" /> : null}
                    {item.description ? <LatexText value={item.description} className="latex-text" /> : null}
                    {item.pdfUrl ? (
                      <a href={item.pdfUrl} target="_blank" rel="noreferrer">
                        Open uploaded PDF
                      </a>
                    ) : null}
                    {item.imageUrl ? (
                      <div className="admin-record-image">
                        <img src={item.imageUrl} alt={item.title} />
                      </div>
                    ) : null}
                    {item.link ? (
                      <a href={item.link} target="_blank" rel="noreferrer">
                        Open IA resource
                      </a>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </section>
          ) : isTeachersResourcesSelected ? (
          <section className="panel">
            <h2>{editingTeachersResourceId ? 'Edit Teachers & Resources Post' : 'Teachers & Resources Posts'}</h2>
            <form onSubmit={submitTeachersResourcePost}>
              <label>
                Post Title
                <input value={resourcePostTitle} onChange={(event) => setResourcePostTitle(event.target.value)} required />
              </label>
              <label>
                Category
                <select value={resourcePostCategory} onChange={(event) => setResourcePostCategory(event.target.value)}>
                  {[...new Set([
                    ...teachersResourceCategories.filter((category) => category !== 'All'),
                    resourcePostCategory,
                  ].filter(Boolean))].map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Summary (optional)
                <textarea
                  rows={4}
                  value={resourcePostDescription}
                  onChange={(event) => setResourcePostDescription(event.target.value)}
                  placeholder="Short note shown beside the PDF"
                />
              </label>
              <label>
                Resource PDF {editingTeachersResourceId ? '(optional — keep current if empty)' : '(required)'}
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={onResourcePostPdfChange}
                  required={!editingTeachersResourceId}
                />
              </label>
              {resourcePostPdfFile ? <small className="muted-text">Selected: {resourcePostPdfFile.name}</small> : null}
              {!resourcePostPdfFile && resourceExistingPdfUrl ? (
                <small className="muted-text">
                  Current PDF:{' '}
                  <a href={resourceExistingPdfUrl} target="_blank" rel="noreferrer">
                    {resourceExistingPdfName || 'Open current PDF'}
                  </a>
                </small>
              ) : null}
              <label>
                Preview image (card thumbnail — recommended)
                <input type="file" accept="image/*" onChange={onResourcePostImageChange} />
              </label>
              {resourcePostImagePreviewUrl ? (
                <div className="image-preview-block">
                  <img src={resourcePostImagePreviewUrl} alt="Teachers resource post preview" />
                </div>
              ) : null}
              <div className="paywall-actions">
                <button className="btn primary" type="submit" disabled={isTeachersResourcesSaving}>
                  {isTeachersResourcesSaving
                    ? 'Saving post...'
                    : editingTeachersResourceId
                      ? 'Save Changes'
                      : 'Publish Post'}
                </button>
                {editingTeachersResourceId ? (
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={cancelEditTeachersResourcePost}
                    disabled={isTeachersResourcesSaving}
                  >
                    Cancel Edit
                  </button>
                ) : null}
              </div>
            </form>
            <div className="records">
              {teachersResourcesPosts.length === 0 ? (
                <p className="empty">No posts published yet.</p>
              ) : (
                teachersResourcesPosts.map((item) => (
                  <article key={item.id} className="record">
                    <div className="record-top">
                      <span className="pill">{editingTeachersResourceId === item.id ? 'editing' : 'resource post'}</span>
                      <div className="record-actions">
                        <button type="button" onClick={() => startEditTeachersResourcePost(item)}>
                          Edit
                        </button>
                        <button type="button" onClick={() => removeTeachersResourcePost(item.id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                    <h3>{item.title}</h3>
                    <small>{item.category || 'Activities'}</small>
                    {item.pdfFileName ? <small>{item.pdfFileName}</small> : null}
                    {item.description ? <LatexText value={item.description} className="latex-text" /> : null}
                    {item.imageUrl ? (
                      <div className="admin-record-image">
                        <img src={item.imageUrl} alt={item.title} />
                      </div>
                    ) : null}
                    {item.pdfUrl ? (
                      <a href={item.pdfUrl} target="_blank" rel="noreferrer">
                        Open uploaded PDF
                      </a>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </section>
          ) : (
          <>

          {!isEditorMode ? (
          <section className="panel">
            <h2>Content locks</h2>
            <label>
              Course
              <select value={paywallCourseId} onChange={(event) => onPaywallCourseChange(event.target.value)}>
                {curricula.map((curriculum) => (
                  <option key={curriculum.id} value={curriculum.id}>
                    {curriculum.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Unit
              <select value={paywallUnitId} onChange={(event) => onPaywallUnitChange(event.target.value)}>
                {(paywallCourse?.units || []).map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Subunit
              <select value={paywallSubunit} onChange={(event) => setPaywallSubunit(event.target.value)}>
                {(paywallUnit?.subunits || []).map((subunitName) => (
                  <option key={subunitName} value={subunitName}>
                    {subunitName}
                  </option>
                ))}
              </select>
            </label>
            <div className="paywall-actions">
              <button type="button" className={`btn ${isUnitLockedInAdmin ? 'primary' : 'ghost'}`} onClick={toggleUnitLock}>
                {isUnitLockedInAdmin ? 'Unlock Unit' : 'Lock Unit'}
              </button>
              <button type="button" className={`btn ${isSubunitLockedInAdmin ? 'primary' : 'ghost'}`} onClick={toggleSubunitLock}>
                {isSubunitLockedInAdmin ? 'Unlock Subunit' : 'Lock Subunit'}
              </button>
            </div>
          </section>
          ) : null}

          <form className="panel" onSubmit={submitItem}>
            <h2>{isEditorMode ? 'Add Content Item' : 'Create Content Item'}</h2>
            <label>
              Item Type
              <select value={itemType} onChange={(event) => setItemType(event.target.value)}>
                <option value="lesson">Lesson</option>
                <option value="question">Question</option>
                <option value="resource">Resource</option>
              </select>
            </label>
            {itemType !== 'question' ? (
              <label>
                Title
                <input value={title} onChange={(event) => setTitle(event.target.value)} required={itemType !== 'lesson'} />
              </label>
            ) : null}
            {itemType === 'lesson' ? (
              <label>
                Learning Objectives (one point per line)
                <textarea
                  rows={5}
                  value={learningObjectivesText}
                  onChange={(event) => setLearningObjectivesText(event.target.value)}
                  placeholder={'Identify the common ratio of a geometric sequence\nFind the nth term using u_n = ar^{n-1}\nCalculate the sum of the first n terms'}
                />
              </label>
            ) : null}
            {renderAdminBlocksEditor({
              blocks: descriptionBlocks,
              setter: setDescriptionBlocks,
              label: itemType === 'lesson' ? 'Description blocks (optional if objectives are set)' : 'Description blocks (required)',
            })}
            {itemType === 'question' ? (
              <>
                <label>
                  Difficulty
                  <select value={questionDifficulty} onChange={(event) => setQuestionDifficulty(event.target.value)}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </label>
                <label>
                  Marks
                  <input
                    type="number"
                    min={1}
                    value={questionMarks}
                    onChange={(event) => setQuestionMarks(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Calculator Type
                  <select value={questionGdc} onChange={(event) => setQuestionGdc(event.target.value)}>
                    <option value="gdc">GDC</option>
                    <option value="not gdc">Not GDC</option>
                  </select>
                </label>
                {isCurrentAdminIbdpCourse ? (
                  <label>
                    Level (AA/AI only)
                    <select value={questionLevel} onChange={(event) => setQuestionLevel(event.target.value)}>
                      <option value="sl">SL</option>
                      <option value="hl">HL</option>
                    </select>
                  </label>
                ) : null}
                <label>
                  Solution (supports LaTeX)
                  <RichTextEditor
                    rows={6}
                    value={solution}
                    onChange={setSolution}
                    placeholder="Example: $$x^2 - 4 = 0 \\Rightarrow (x-2)(x+2)=0$$"
                  />
                </label>
                <label>
                  YouTube Video Solution Link (optional)
                  <input
                    value={solutionVideoLink}
                    onChange={(event) => setSolutionVideoLink(event.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                </label>
                <label>
                  Solution Image Upload (optional)
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onSolutionImageFileChange}
                  />
                </label>
                {solutionImagePreviewUrl ? (
                  <div className="image-preview-block">
                    <img src={solutionImagePreviewUrl} alt="Question solution preview" />
                  </div>
                ) : null}
                {renderAdminBlocksEditor({
                  blocks: solutionBlocks,
                  setter: setSolutionBlocks,
                  label: 'Solution blocks (optional advanced layout)',
                })}
                <section className="latex-preview">
                  <h3>Live Preview</h3>
                  <article className="lesson-card">
                    <div className="record-top">
                      <span className="pill">question</span>
                    </div>
                    <h3 className="question-number-title">Question Preview</h3>
                    <div className="question-meta-row">
                      <span className="meta-chip">{normalizeGdc(questionGdc) === 'gdc' ? 'GDC' : 'No GDC'}</span>
                      <span className="meta-chip">{questionMarks} marks</span>
                      {isCurrentAdminIbdpCourse ? <span className="meta-chip">{String(questionLevel).toUpperCase()}</span> : null}
                      <span className={`meta-chip difficulty-${String(questionDifficulty || 'medium').toLowerCase()}`}>
                        {questionDifficulty}
                      </span>
                    </div>
                    <LatexText value={contentBlocksToPlainText(descriptionBlocks) || 'Question statement preview'} className="latex-text" />
                    <div className="solution-box">
                      <LatexText value={solution || 'Solution preview'} className="latex-text" />
                    </div>
                  </article>
                  <small>
                    Use <code>$...$</code> for inline math and <code>$$...$$</code> for block math.
                  </small>
                  {solutionVideoLink && toYouTubeEmbedUrl(solutionVideoLink) ? (
                    <div className="solution-video-wrap">
                      <h4>Video Solution Preview</h4>
                      <iframe
                        title="video-solution-preview"
                        src={toYouTubeEmbedUrl(solutionVideoLink)}
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                  ) : null}
                </section>
              </>
            ) : null}
            {itemType === 'lesson' ? (
              <label>
                GeoGebra Link or Material ID (optional)
                <input
                  value={geogebraLink}
                  onChange={(event) => setGeogebraLink(event.target.value)}
                  placeholder="https://www.geogebra.org/m/abc123 or abc123"
                />
              </label>
            ) : null}
            <label>
              Resource Link (optional)
              <input
                value={resourceLink}
                onChange={(event) => setResourceLink(event.target.value)}
                placeholder="https://..."
              />
            </label>
            <label>
              Image Upload (Supabase, optional)
              <input
                type="file"
                accept="image/*"
                onChange={onImageFileChange}
              />
            </label>
            {selectedImagePreviewUrl ? (
              <div className="image-preview-block">
                <img src={selectedImagePreviewUrl} alt="Selected upload preview" />
                <small>{attachedFileName}</small>
              </div>
            ) : null}
            <div className="image-size-controls">
              <label>
                Image Size (%)
                <input
                  type="range"
                  min={20}
                  max={180}
                  value={clampImageWidthPercent(imageWidthPercent, 100)}
                  onChange={(event) => setImageWidthPercent(clampImageWidthPercent(event.target.value, 100))}
                />
                <small>{clampImageWidthPercent(imageWidthPercent, 100)}%</small>
              </label>
            </div>
            <button className="btn primary" type="submit" disabled={isImageUploading}>
              {isImageUploading ? 'Uploading image...' : 'Save Item'}
            </button>
          </form>

          <form className="panel" onSubmit={submitBulkQuestions}>
            <h2>Bulk Upload Questions</h2>
            <p>Paste ChatGPT JSON. Each item will be uploaded as an individual question card.</p>
            <label>
              Bulk JSON
              <textarea
                rows={12}
                value={bulkQuestionInput}
                onChange={(event) => setBulkQuestionInput(event.target.value)}
                placeholder='[{"description":"Question text", "solution":"...", "difficulty":"medium", "marks":5, "gdc":"gdc"}]'
                required
              />
            </label>
            {bulkUploadError ? <p className="error-text">{bulkUploadError}</p> : null}
            {bulkUploadSuccess ? <p className="success-text">{bulkUploadSuccess}</p> : null}
            <button className="btn primary" type="submit" disabled={isBulkUploading}>
              {isBulkUploading ? 'Uploading questions...' : 'Upload Questions'}
            </button>
          </form>

          <section className="panel">
            <h2>Stored Items ({activeStoredRecords.length})</h2>
            <div className="stored-items-tabs">
              <button
                type="button"
                className={`stored-tab ${storedItemsTab === 'lesson' ? 'active' : ''}`}
                onClick={() => {
                  setStoredItemsTab('lesson')
                  cancelEditRecord()
                  setDragRecordIndex(null)
                }}
              >
                Lessons ({scopedLessons.length})
              </button>
              <button
                type="button"
                className={`stored-tab ${storedItemsTab === 'question' ? 'active' : ''}`}
                onClick={() => {
                  setStoredItemsTab('question')
                  cancelEditRecord()
                  setDragRecordIndex(null)
                }}
              >
                Questions ({scopedQuestions.length})
              </button>
            </div>
            <div className="records">
              {activeStoredRecords.length === 0 ? (
                <p className="empty">No content uploaded yet.</p>
              ) : (
                activeStoredRecords.map((record, index) => {
                  return (
                    <article
                      className="record"
                      key={record.id}
                      draggable={!isEditorMode}
                      onDragStart={isEditorMode ? undefined : () => setDragRecordIndex(index)}
                      onDragOver={isEditorMode ? undefined : (event) => event.preventDefault()}
                      onDrop={isEditorMode ? undefined : () => reorderStoredItems(index)}
                      onDragEnd={isEditorMode ? undefined : () => setDragRecordIndex(null)}
                    >
                      <div className="record-top">
                        <span className="pill">{record.itemType}</span>
                        {!isEditorMode ? (
                        <div className="record-actions">
                          <button type="button" onClick={() => beginEditRecord(record)}>
                            Edit
                          </button>
                          <button type="button" onClick={() => removeRecord(record.id)}>
                            Delete
                          </button>
                        </div>
                        ) : null}
                      </div>
                      {record.itemType === 'question' ? (
                        <h3>{`Question ${index + 1}`}</h3>
                      ) : (
                        <LatexText value={record.title || 'Untitled'} className="latex-heading" />
                      )}
                      <LatexText value={record.description} className="latex-text" />
                      {record.itemType === 'question' ? (
                        <small>
                          {String(record.gdc || 'not gdc').toUpperCase()} · {record.marks || 0} marks
                          {record.curriculumId === 'ibdp-aa-hl' || record.curriculumId === 'ibdp-ai-hl'
                            ? ` · ${String(record.questionLevel || 'sl').toUpperCase()}`
                            : ''}{' '}
                          ·{' '}
                          {String(record.difficulty || 'medium')}
                        </small>
                      ) : null}
                      {record.itemType === 'question' && record.solution ? <small>Solution added</small> : null}
                      {record.itemType === 'question' && record.solutionVideoLink ? <small>Video solution added</small> : null}
                      {record.itemType === 'question' && record.solutionImageUrl ? <small>Solution image added</small> : null}
                      {record.itemType === 'lesson' && record.geogebraLink ? <small>GeoGebra added</small> : null}
                      {!isEditorMode ? <small>Drag to reorder</small> : null}
                      {record.imageUrl ? (
                        <div className="admin-record-image">
                          <img src={record.imageUrl} alt="Uploaded content" style={getRecordImageStyle(record)} />
                        </div>
                      ) : null}
                      {record.resourceLink && (
                        <a href={record.resourceLink} target="_blank" rel="noreferrer">
                          Open link
                        </a>
                      )}
                      {record.attachedFileName && <small>File: {record.attachedFileName}</small>}
                      {editingRecordId === record.id ? (
                        <div className="stored-edit-grid">
                          {editingRecordType === 'lesson' ? (
                            <>
                              <label>
                                Title
                                <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
                              </label>
                              <label>
                                Learning Objectives (one point per line)
                                <textarea
                                  rows={5}
                                  value={editLearningObjectivesText}
                                  onChange={(event) => setEditLearningObjectivesText(event.target.value)}
                                  placeholder={'Point 1\nPoint 2\nPoint 3'}
                                />
                              </label>
                              {renderAdminBlocksEditor({
                                blocks: editDescriptionBlocks,
                                setter: setEditDescriptionBlocks,
                                label: 'Description blocks (optional if objectives are set)',
                              })}
                              <label>
                                GeoGebra Link
                                <input
                                  value={editGeogebraLink}
                                  onChange={(event) => setEditGeogebraLink(event.target.value)}
                                  placeholder="https://www.geogebra.org/m/abc123"
                                />
                              </label>
                              <label>
                                Resource Link
                                <input
                                  value={editResourceLink}
                                  onChange={(event) => setEditResourceLink(event.target.value)}
                                  placeholder="https://..."
                                />
                              </label>
                              <label>
                                Image Size (%)
                                <input
                                  type="range"
                                  min={20}
                                  max={180}
                                  value={clampImageWidthPercent(editImageWidthPercent, 100)}
                                  onChange={(event) =>
                                    setEditImageWidthPercent(clampImageWidthPercent(event.target.value, 100))
                                  }
                                />
                                <small>{clampImageWidthPercent(editImageWidthPercent, 100)}%</small>
                              </label>
                            </>
                          ) : (
                            <>
                              {renderAdminBlocksEditor({
                                blocks: editDescriptionBlocks,
                                setter: setEditDescriptionBlocks,
                                label: 'Description blocks (required)',
                              })}
                              <label>
                                Difficulty
                                <select value={editDifficulty} onChange={(event) => setEditDifficulty(event.target.value)}>
                                  <option value="easy">Easy</option>
                                  <option value="medium">Medium</option>
                                  <option value="hard">Hard</option>
                                </select>
                              </label>
                              <label>
                                Marks
                                <input
                                  type="number"
                                  min={1}
                                  value={editMarks}
                                  onChange={(event) => setEditMarks(event.target.value)}
                                />
                              </label>
                              <label>
                                Calculator Type
                                <select value={editGdc} onChange={(event) => setEditGdc(event.target.value)}>
                                  <option value="gdc">GDC</option>
                                  <option value="not gdc">Not GDC</option>
                                </select>
                              </label>
                              {record.curriculumId === 'ibdp-aa-hl' || record.curriculumId === 'ibdp-ai-hl' ? (
                                <label>
                                  Level (AA/AI only)
                                  <select value={editQuestionLevel} onChange={(event) => setEditQuestionLevel(event.target.value)}>
                                    <option value="sl">SL</option>
                                    <option value="hl">HL</option>
                                  </select>
                                </label>
                              ) : null}
                              <label>
                                Solution (supports LaTeX)
                                <RichTextEditor rows={6} value={editSolution} onChange={setEditSolution} />
                              </label>
                              {renderAdminBlocksEditor({
                                blocks: editSolutionBlocks,
                                setter: setEditSolutionBlocks,
                                label: 'Solution blocks (optional advanced layout)',
                              })}
                              <label>
                                YouTube Video Solution Link
                                <input
                                  value={editSolutionVideoLink}
                                  onChange={(event) => setEditSolutionVideoLink(event.target.value)}
                                  placeholder="https://www.youtube.com/watch?v=..."
                                />
                              </label>
                              <label>
                                Resource Link
                                <input
                                  value={editResourceLink}
                                  onChange={(event) => setEditResourceLink(event.target.value)}
                                  placeholder="https://..."
                                />
                              </label>
                              <label>
                                Image Size (%)
                                <input
                                  type="range"
                                  min={20}
                                  max={180}
                                  value={clampImageWidthPercent(editImageWidthPercent, 100)}
                                  onChange={(event) =>
                                    setEditImageWidthPercent(clampImageWidthPercent(event.target.value, 100))
                                  }
                                />
                                <small>{clampImageWidthPercent(editImageWidthPercent, 100)}%</small>
                              </label>
                            </>
                          )}
                          <div className="stored-edit-actions">
                            <button type="button" className="btn primary" onClick={saveRecordEdits}>
                              Save
                            </button>
                            <button type="button" className="btn ghost" onClick={cancelEditRecord}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  )
                })
              )}
            </div>
          </section>
          </>
          )}
        </div>
      </section>
    </main>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [cachedProfile, setCachedProfile] = useState(() => {
    const cached = localStorage.getItem(profileCacheKey)
    return cached ? JSON.parse(cached) : null
  })

  useEffect(() => {
    let unsubscribe = () => {}
    let active = true

    async function setupAuthPersistence() {
      // Subscribe first so auth state resolves even if Firestore/setup calls are slow.
      unsubscribe = onAuthStateChanged(auth, (nextUser) => {
        if (!active) return
        setUser(nextUser)
        setAuthReady(true)

        if (nextUser) {
          const profile = {
            uid: nextUser.uid,
            email: nextUser.email || '',
            displayName: nextUser.displayName || '',
            photoURL: nextUser.photoURL || '',
          }
          setCachedProfile(profile)
          localStorage.setItem(profileCacheKey, JSON.stringify(profile))
        } else {
          setCachedProfile(null)
          localStorage.removeItem(profileCacheKey)
        }
      })

      try {
        await setPersistence(auth, browserLocalPersistence)
      } catch {
        // Continue with Firebase default persistence if this fails.
      }

      try {
        const [curricula, paywall, ia, teachersResources] = await Promise.all([
          getCachedAppDoc('curricula', curriculaDocRef),
          getCachedAppDoc('paywall', paywallDocRef),
          getCachedAppDoc('ia', iaDocRef),
          getCachedAppDoc('teachersResources', teachersResourcesDocRef),
        ])
        const seeds = []
        if (!curricula) {
          seeds.push(
            setDoc(curriculaDocRef, { courses: defaultCurricula }).then(() =>
              writeCachedAppDoc('curricula', { courses: defaultCurricula }),
            ),
          )
        }
        if (!paywall) {
          seeds.push(
            setDoc(paywallDocRef, normalizePaywallConfig()).then(() =>
              writeCachedAppDoc('paywall', normalizePaywallConfig()),
            ),
          )
        }
        if (!ia) {
          seeds.push(setDoc(iaDocRef, { items: [] }).then(() => writeCachedAppDoc('ia', { items: [] })))
        }
        if (!teachersResources) {
          seeds.push(
            setDoc(teachersResourcesDocRef, { items: [] }).then(() =>
              writeCachedAppDoc('teachersResources', { items: [] }),
            ),
          )
        }
        if (seeds.length) await Promise.all(seeds)
      } catch {
        // Ignore seeding failure; admin view will still show actionable errors.
      }
    }

    setupAuthPersistence()

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage user={user} cachedProfile={cachedProfile} />} />
        <Route path="/programs" element={<ProgramsPage user={user} cachedProfile={cachedProfile} />} />
        <Route path="/ia" element={<IaPage user={user} cachedProfile={cachedProfile} />} />
        <Route path="/ia/:iaId" element={<IaDetailPage user={user} cachedProfile={cachedProfile} />} />
        <Route path="/events" element={<Navigate to="/ia" replace />} />
        <Route path="/teachers-resources" element={<TeachersResourcesPage user={user} cachedProfile={cachedProfile} />} />
        <Route
          path="/teachers-resources/:postId"
          element={<TeachersResourceDetailPage user={user} cachedProfile={cachedProfile} />}
        />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage user={user} cachedProfile={cachedProfile} />} />
        <Route path="/terms-of-use" element={<TermsOfUsePage user={user} cachedProfile={cachedProfile} />} />
        <Route path="/mock-generator" element={<MockGeneratorPage user={user} authReady={authReady} cachedProfile={cachedProfile} />} />
        <Route
          path="/courses/:slug"
          element={
            <CoursePage
              user={user}
              authReady={authReady}
              cachedProfile={cachedProfile}
            />
          }
        />
        <Route path="/profile" element={<ProfilePage user={user} cachedProfile={cachedProfile} />} />
        <Route path="/admin" element={<ProtectedAdmin />} />
        <Route path="/editor" element={<ProtectedEditor />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
